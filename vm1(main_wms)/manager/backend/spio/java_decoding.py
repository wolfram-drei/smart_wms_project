"""
RealEsrgan 추가 안한거

Flask 기반:
1) YOLO로 바코드 감지
2) conf≥0.5 박스만 크롭(pad=10)
3) Pyzbar 전처리 루프(확대, blur, morphological 등)
4) DB(MainTable, Sm_Phone_Inbound) 연동
5) OCR, OpenCV BarcodeDetector 등은 사용하지 않음
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import mysql.connector
from decimal import Decimal
from datetime import datetime
import cv2
import numpy as np
from pyzbar.pyzbar import decode as pyzbar_decode
from PIL import Image, ImageEnhance
from werkzeug.utils import secure_filename
import uuid



# Ultralytics YOLO
from ultralytics import YOLO

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_DIR = '/home/wms/work/manager/backend/spio'
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
MODEL_PATH = os.path.join(BASE_DIR, 'best.pt')

def ensure_dir(directory):
    try:
        if not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            print(f"Created directory: {directory}")
    except Exception as e:
        print(f"Error creating directory {directory}: {str(e)}")

ensure_dir(UPLOAD_FOLDER)

# YOLO 모델 로드
try:
    model = YOLO(MODEL_PATH)
    print("Ultralytics YOLO 모델 로드 성공")
except Exception as e:
    print(f"Ultralytics YOLO 모델 로드 실패: {str(e)}")
    model = None

DB_CONFIG = {
    "host": "localhost",
    "user": "username",
    "password": "pw",
    "database": "dbname",
}


###############################################
# Pyzbar 전처리 (문자+숫자 혼합 표준 바코드)
#이제 전처리 되는 것을 업로드파일에서 확인이 가능하니
# 각종 전처리를 이용해서 작게 나오는 바코드도 잘 나오도록 적용해봐야지
###############################################
"""
def pyzbar_decode_with_preprocessing(gray_img):
    results = []
    seen = set()

    methods = [
        lambda g: g,
        lambda g: cv2.resize(g, None, fx=1.5, fy=1.5),
        lambda g: cv2.filter2D(g, -1, np.array([[-1, -1, -1],
                                                [-1,  9, -1],
                                                [-1, -1, -1]])),
        lambda g: cv2.morphologyEx(g, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8)),
        lambda g: cv2.GaussianBlur(g, (3, 3), 0),
        lambda g: cv2.equalizeHist(g),
        lambda g: cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                        cv2.THRESH_BINARY, 11, 2)
    ]

    for i, prep in enumerate(methods):
        try:
            proc = prep(gray_img)

            # 저장 경로 지정 (UPLOAD_FOLDER 사용)
            debug_path = os.path.join(UPLOAD_FOLDER, f"debug_prep_{i+1}.jpg")
            cv2.imwrite(debug_path, proc)
            print(f"[전처리 {i+1}] 저장됨: {debug_path} / shape={proc.shape}")

            barcodes = pyzbar_decode(proc)
            if barcodes:
                for b in barcodes:
                    try:
                        code_str = b.data.decode('utf-8').strip()
                        if code_str:
                            results.append(code_str)
                            print(f"[pyzbar] 디코딩 성공: {code_str}")
                    except Exception as e:
                        print(f"디코딩 오류: {e}")
                if results:
                    break
        except Exception as e:
            print(f"[전처리 {i+1}] 처리 중 오류 발생: {e}")
            continue

    return results
"""

import cv2
import numpy as np
from PIL import Image
import os
import pyzxing

UPLOAD_FOLDER = "./debug_outputs"
# ZXing Reader
zxing_reader = pyzxing.BarCodeReader()

# ZXing 전용 전처리 + 디코딩
def zxing_decode_with_preprocessing(gray_img, bbox_list=None):
    results = []
    seen = set()
    PREPROCESS_COMBOS = {
        "resize+adaptive": [
        lambda g: cv2.resize(g, None, fx=2.0, fy=2.0),
        lambda g: cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                        cv2.THRESH_BINARY, 11, 2)
    ],
    "resize+sharpen+equalize": [
        lambda g: cv2.resize(g, None, fx=2.0, fy=2.0),
        lambda g: cv2.filter2D(g, -1, np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])),
        lambda g: cv2.equalizeHist(g)
    ]
    }

    regions = [gray_img] if not bbox_list else [gray_img[y1:y2, x1:x2] for x1, y1, x2, y2 in bbox_list]

    for idx, region in enumerate(regions):
        for combo_name, steps in PREPROCESS_COMBOS.items():
            try:
                processed = region.copy()
                for step in steps:
                    processed = step(processed)

                img_path = os.path.join(UPLOAD_FOLDER, f"zxing_{combo_name}_box{idx}.png")
                cv2.imwrite(img_path, processed)
                decoded = zxing_reader.decode(img_path)

                for d in decoded:
                    raw_data = d.get("raw", b"")

                    # bytes -> str 안전하게 변환
                    if isinstance(raw_data, bytes):
                        data = raw_data.decode("utf-8").strip()
                    else:
                        data = str(raw_data).strip()

                    if data and data not in seen:
                        seen.add(data)
                        results.append({
                            "data": data,
                            "type": d.get("format", "UNKNOWN"),
                            "valid": data.startswith("CONTRACT"),
                            "source": f"zxing_{combo_name}",
                            "index": idx
                        })
                        print(f"[ZXING ✅] box {idx} / 조합: {combo_name} / 데이터: {data}")
                        success = True
                        break
                if results:
                    break
            except Exception as e:
                print(f"[ERROR] Combo {combo_name} failed: {e}")
    return results




###############################################
# YOLO 감지 + Pyzbar 디코딩
###############################################
# YOLO + ZXING 디코딩

def detect_barcodes_yolo(image, original_filename, confidence_threshold=0.25):
    cv2.imwrite(os.path.join(UPLOAD_FOLDER, original_filename), image)
    model.conf = confidence_threshold
    res = model(image)

    boxes = res[0].boxes.xyxy.cpu().numpy()
    confs = res[0].boxes.conf.cpu().numpy()

    top_pad = 60
    h, w = image.shape[:2]
    result_img = np.ones((h + top_pad, w, 3), dtype=np.uint8) * 255
    result_img[top_pad:, :] = image

    decoded_codes = []
    seen_data = set()

    for i, (x1, y1, x2, y2) in enumerate(boxes):
        x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
        c = float(confs[i])
        pad = 10
        xx1, yy1 = max(0, x1 - pad), max(0, y1 - pad)
        xx2, yy2 = min(w, x2 + pad), min(h, y2 + pad)
        box_h = yy2 - yy1
        yy2 -= int(box_h * 0.15)

        cropped = image[yy1:yy2, xx1:xx2]
        gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)

        if c < 0.5:
            color = (150,150,150)
            label = f"LOWCONF {c:.2f}"
        else:
            decode_res = zxing_decode_with_preprocessing(gray, [(0,0,gray.shape[1], gray.shape[0])])
            if decode_res:
                color = (0,255,0)
                label = f"BARCODE {c:.2f}"
                for d in decode_res:
                    if d['data'] not in seen_data:
                        seen_data.add(d['data'])
                        decoded_codes.append({
                            'data': d['data'],
                            'type': d['type'],
                            'valid': d['valid'],
                            'bounding_box': [xx1, yy1, xx2, yy2],
                            'confidence': c
                        })
            else:
                color = (0,255,255)
                label = f"NO-DECODE {c:.2f}"
                decoded_codes.append({
                    'data': '', 'type': None, 'valid': False,
                    'bounding_box': [xx1, yy1, xx2, yy2],
                    'confidence': c
                })

        cv2.rectangle(result_img, (xx1, yy1+top_pad), (xx2, yy2+top_pad), color, 2)
        cv2.putText(result_img, label, (xx1, max(yy1+top_pad-10,0)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    result_fn = f"result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    result_path = os.path.join(UPLOAD_FOLDER, result_fn)
    cv2.imwrite(result_path, result_img)

    return {
        'decoded_codes': decoded_codes,
        'count': len(decoded_codes),
        'result_image': result_fn
    }

###############################################
# Flask 라우트
###############################################
@app.route("/barcode-upload", methods=["POST"])
def barcode_upload():
    """
    - 이미지 수신
    - YOLO로 바코드 감지
    - conf >= 0.5만 크롭 후 pyzbar 디코딩
    - 디코딩 성공 → DB(MainTable, Sm_Phone_Inbound) 등록(CONTRACT 접두어만)
    - 디코딩 여부와 관계없이 result_image 항상 반환
    """

    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Empty file name"}), 400

    try:
        # Confidence threshold 파라미터
        data = request.form
        conf_th = float(data.get('confidence_threshold', 0.25))
        if not (0.0 < conf_th <= 1.0):
            raise ValueError("confidence_threshold out of range")
    except Exception as e:
        return jsonify({"error": "Invalid confidence_threshold value"}), 400

    connection = None
    try:
        # 이미지 디코딩
        nparr = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            return jsonify({"error": "Invalid image file"}), 400

        # 바코드 감지 및 디코딩 수행
        fname = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        detection_result = detect_barcodes_yolo(image, fname, conf_th)
        decoded_barcodes = detection_result.get('decoded_codes', [])
        result_img_name = detection_result.get('result_image', '')

        # ✅ bytes → str 변환 (JSON 직렬화 오류 방지용)
        for b in decoded_barcodes:
            if isinstance(b.get("data"), bytes):
             b["data"] = b["data"].decode("utf-8", errors="replace")

        # 디코딩 성공/실패 구분
        decoded_success = [b for b in decoded_barcodes if b['data']]
        decoded_fail = [b for b in decoded_barcodes if not b['data']]

        # 로그 출력
        print(f"[barcode_upload] YOLO 감지된 바코드 박스: {len(decoded_barcodes)}개")
        print(f"[barcode_upload] 디코딩 성공: {len(decoded_success)}개, 실패: {len(decoded_fail)}개")

        # 디코딩된 바코드 중 유효한 것(CONTRACT 접두어)만 필터
        valid_barcodes = [b for b in decoded_barcodes if b['valid']]

        if not valid_barcodes:
            return jsonify({
                "message": "No valid barcodes found",
                "barcodes": decoded_barcodes,  # 디코딩 실패도 포함
                "result_image": result_img_name
            }), 200

        # DB 연결 시작
        import mysql.connector
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        connection.start_transaction()

        result_barcodes = []

        for vb in valid_barcodes:
            barcode_num = vb['data']

            # MainTable 조회
            cursor.execute("SELECT * FROM MainTable WHERE barcode_num = %s", (barcode_num,))
            main_row = cursor.fetchone()
            if not main_row:
                print(f"[barcode_upload] MainTable에 없음: {barcode_num}")
                continue

            # Sm_Phone_Inbound 중복 확인
            cursor.execute("SELECT * FROM Sm_Phone_Inbound WHERE barcode_num = %s", (barcode_num,))
            existing = cursor.fetchone()
            if existing:
                result_barcodes.append(existing)
                print(f"[barcode_upload] 기존 데이터 사용: {barcode_num}")
            else:
                # 새로 삽입
                insert_sql = """
                    INSERT INTO Sm_Phone_Inbound (
                        company_name, product_name, product_number, inbound_quantity,
                        warehouse_type, warehouse_location, pallet_size, pallet_num,
                        barcode_num, barcode, inbound_status
                    ) VALUES (
                        %(company_name)s, %(product_name)s, %(product_number)s, %(inbound_quantity)s,
                        %(warehouse_type)s, %(warehouse_location)s, %(pallet_size)s, %(pallet_num)s,
                        %(barcode_num)s, %(barcode)s, '입고 준비'
                    )
                """
                cursor.execute(insert_sql, main_row)

                cursor.execute("SELECT * FROM Sm_Phone_Inbound WHERE barcode_num = %s ORDER BY id DESC LIMIT 1", (barcode_num,))
                new_row = cursor.fetchone()
                result_barcodes.append(new_row)
                print(f"[barcode_upload] 새로 삽입: {barcode_num}")

        connection.commit()
        cursor.close()
        connection.close()

        # Decimal, datetime 등 JSON 직렬화 변환
        from decimal import Decimal
        from datetime import datetime as dt
        for row in result_barcodes:
            for key, val in row.items():
                if isinstance(val, Decimal):
                    row[key] = float(val)
                elif isinstance(val, dt):
                    row[key] = val.isoformat()
                elif val is None:
                    row[key] = ""

        return jsonify({
            "message": "Upload completed.",
            "barcodes": result_barcodes,
            "result_image": result_img_name
        }), 200

    except Exception as e:
        print("[barcode_upload] 오류:", e)
        if connection:
            connection.rollback()
        return jsonify({
            "error": str(e),
            "result_image": result_img_name if 'result_img_name' in locals() else ""
        }), 500



@app.route("/update-inbound-status", methods=["PUT"])
def update_inbound_status():
    data = request.json
    barcode_num = data.get("barcode_num")
    new_status = data.get("inbound_status")
    if not barcode_num or not new_status:
        return jsonify({"error": "barcode_num and inbound_status required"}), 400

    ALLOWED_STATUS = {'입고 준비', '입고 중', '입고 완료'}
    if new_status not in ALLOWED_STATUS:
        return jsonify({"error": "Invalid inbound_status value"}), 400

    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        update_sm_sql = "UPDATE Sm_Phone_Inbound SET inbound_status = %s WHERE barcode_num = %s"
        cursor.execute(update_sm_sql, (new_status, barcode_num))
        connection.commit()

        update_main_sql = "UPDATE MainTable SET inbound_status = %s WHERE barcode_num = %s"
        cursor.execute(update_main_sql, (new_status, barcode_num))
        connection.commit()

        cursor.close()
        connection.close()
        return jsonify({"message": "입고 상태가 성공적으로 업데이트되었습니다."}), 200
    except Exception as e:
        print("Error in /update-inbound-status PUT:", e)
        return jsonify({"error": f"Failed to update inbound status: {str(e)}"}), 500

@app.route("/outbound-status", methods=["GET"])
def get_outbound_status():
    search_text = request.args.get("searchText", "").strip()
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        if search_text:
            filtered_query = """
                SELECT id, company_name, product_name, inbound_quantity, warehouse_location,
                       warehouse_type, outbound_status, outbound_date, last_outbound_date
                FROM MainTable
                WHERE company_name LIKE %s OR warehouse_location LIKE %s OR outbound_status LIKE %s
            """
            like_pattern = f"%{search_text}%"
            cursor.execute(filtered_query, (like_pattern, like_pattern, like_pattern))
        else:
            filtered_query = """
                SELECT id, company_name, product_name, inbound_quantity, warehouse_location,
                       warehouse_type, outbound_status, outbound_date, last_outbound_date
                FROM MainTable
            """
            cursor.execute(filtered_query)
        rows = cursor.fetchall()
        cursor.close()
        connection.close()

        filtered_data = []
        for row in rows:
            filtered_data.append({
                "id": row["id"],
                "company_name": row["company_name"],
                "product_name": row["product_name"],
                "inbound_quantity": row["inbound_quantity"],
                "warehouse_location": row["warehouse_location"],
                "warehouse_type": row["warehouse_type"],
                "outbound_status": row["outbound_status"],
                "outbound_date": row["outbound_date"].isoformat() if row["outbound_date"] else "",
                "last_outbound_date": row["last_outbound_date"].isoformat() if row["last_outbound_date"] else ""
            })
        return jsonify(filtered_data)
    except Exception as e:
        print(f"Error in /outbound-status GET: {str(e)}")
        return jsonify({"error": f"Failed to fetch outbound status data: {str(e)}"}), 500

@app.route('/uploads/<filename>')
def serve_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5030, debug=True)
