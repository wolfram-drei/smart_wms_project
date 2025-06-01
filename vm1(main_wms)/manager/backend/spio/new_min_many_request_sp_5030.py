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
    "host": "연결호스트",
    "user": "사용자이름",
    "password": "비밀번호",
    "database": "데이터베이스이름"
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
from pyzbar.pyzbar import decode as pyzbar_decode
import os
from PIL import Image
import pyzxing

UPLOAD_FOLDER = "./debug_outputs"
zxing_reader = pyzxing.BarCodeReader()  # ZXING_JAR_PATH 환경변수 필요

def pyzbar_decode_with_preprocessing(gray_img, bbox_list=None):
    results = []
    seen = set()

    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

    if bbox_list and isinstance(bbox_list[0], dict):
        try:
            bbox_list = [(b['x1'], b['y1'], b['x2'], b['y2']) for b in bbox_list]
        except KeyError as e:
            print(f"[bbox_list 변환 오류] 잘못된 키 사용: {e}")
            return results

    initial_targets = [gray_img] if bbox_list is None else [
        gray_img[y1:y2, x1:x2] for (x1, y1, x2, y2) in bbox_list
    ]

    for idx, region in enumerate(initial_targets):
        try:
            barcodes = pyzbar_decode(region)
            for b in barcodes:
                data = b.data.decode("utf-8").strip()
                if data and data not in seen:
                    seen.add(data)
                    results.append({
                        "data": data,
                        "type": b.type,
                        "valid": data.startswith("CONTRACT"),
                        "source": "original",
                        "index": idx
                    })
        except Exception as e:
            print(f"[원본 디코딩 오류] 영역 {idx}: {e}")

    remaining_targets = [
        (idx, gray_img if bbox_list is None else gray_img[y1:y2, x1:x2])
        for idx, (x1, y1, x2, y2) in enumerate(bbox_list)
        if idx not in {r['index'] for r in results}
    ] if bbox_list else [(0, gray_img)] if not results else []

    if not remaining_targets:
        return results

    print(f"전처리 필요한 영역 수: {len(remaining_targets)}")

    PREPROCESS_COMBINATIONS = {
        "resize+sharpen": [
            lambda g: cv2.resize(g, None, fx=2.0, fy=1.5),
            lambda g: cv2.filter2D(g, -1, np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])),
        ],
        "resize+sharpen+equalize": [
            lambda g: cv2.resize(g, None, fx=2.0, fy=2.0),
            lambda g: cv2.filter2D(g, -1, np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])),
            lambda g: cv2.equalizeHist(g),
        ],
        "resize+adaptive": [
            lambda g: cv2.resize(g, None, fx=2.0, fy=2.0),
            lambda g: cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                            cv2.THRESH_BINARY, 11, 2)
        ],
    }

    for idx, region in remaining_targets:
        success = False
        for combo_name, steps in PREPROCESS_COMBINATIONS.items():
            try:
                processed = region.copy()
                for step_fn in steps:
                    processed = step_fn(processed)

                debug_path = os.path.join(UPLOAD_FOLDER, f"combo_{combo_name}_box{idx}.jpg")
                cv2.imwrite(debug_path, processed)

                pil_img = Image.fromarray(processed)
                barcodes = pyzbar_decode(pil_img)
                print(f"[pyzbar] box {idx}, 조합: {combo_name}, 감지 수: {len(barcodes)}")

                # ✅ ZXing fallback if pyzbar failed
                if not barcodes:
                    temp_path = os.path.join(UPLOAD_FOLDER, f"zxing_{combo_name}_box{idx}.png")
                    cv2.imwrite(temp_path, processed)
                    zxing_result = zxing_reader.decode(temp_path)
                    print(f"[ZXING] box {idx}, 조합: {combo_name}, 결과 수: {len(zxing_result)}")

                    for r in zxing_result:
                        data = r.get('raw', '').strip()
                        if data and data not in seen:
                            seen.add(data)
                            results.append({
                                "data": data,
                                "type": r.get('format', 'UNKNOWN'),
                                "valid": data.startswith("CONTRACT"),
                                "source": f"zxing_{combo_name}",
                                "index": idx
                            })
                            print(f"[ZXING ✅] box {idx} / 조합: {combo_name} / 데이터: {data}")
                            success = True
                    if success:
                        break

                elif barcodes:
                    for b in barcodes:
                        data = b.data.decode("utf-8").strip()
                        if data and data not in seen:
                            seen.add(data)
                            results.append({
                                "data": data,
                                "type": b.type,
                                "valid": data.startswith("CONTRACT"),
                                "source": f"pyzbar_{combo_name}",
                                "index": idx
                            })
                            print(f"[✅ pyzbar] box {idx} / 조합: {combo_name} / 데이터: {data}")
                            success = True
                    if success:
                        break

            except Exception as e:
                print(f"[전처리 실패] box {idx}, 조합: {combo_name} / 오류: {e}")

        if not success:
            print(f"[❌ 디코딩 실패] box {idx} - 모든 조합 실패")

    return results




###############################################
# YOLO 감지 + Pyzbar 디코딩
###############################################
def detect_barcodes_yolo(image, original_filename, confidence_threshold=0.25):
    """
    1) YOLO로 바코드 감지
    2) conf>=0.5만 크롭(pad=10) 후 pyzbar_decode_with_preprocessing
    3) 성공 → 초록 박스, 실패 → 노랑 박스, conf<0.5 → 회색
    """
    # 원본 이미지 저장
    upload_path = os.path.join(UPLOAD_FOLDER, original_filename)
    cv2.imwrite(upload_path, image)
    print(f"[detect_barcodes_yolo] 원본 저장: {upload_path}")

    if model is None:
        print("YOLO 모델 없음")
        return {'decoded_codes': [], 'count': 0, 'result_image': None}

    # YOLO 추론
    model.conf = confidence_threshold
    res = model(image)
    if not res or not res[0].boxes:
        print("YOLO 감지 결과 없음")
        return {'decoded_codes': [], 'count': 0, 'result_image': None}

    boxes = res[0].boxes.xyxy.cpu().numpy()
    confs = res[0].boxes.conf.cpu().numpy()
    print(f"[YOLO] 감지 박스 수: {len(boxes)}")

    top_pad = 60
    h, w = image.shape[:2]
    result_img = np.ones((h + top_pad, w, 3), dtype=np.uint8) * 255
    result_img[top_pad:, :] = image

    decoded_codes = []
    seen_data = set()

    for i, det in enumerate(boxes):
        x1, y1, x2, y2 = map(int, det[:4])
        c = float(confs[i])
        print(f"[YOLO] box {i+1}: conf={c:.2f}, coords=({x1},{y1})-({x2},{y2})")

        if c < 0.5:
            # 낮은 confidence → 회색 박스
            cv2.rectangle(result_img, (x1, y1+top_pad), (x2, y2+top_pad), (150,150,150), 2)
            cv2.putText(result_img, f"LOWCONF {c:.2f}", (x1, max(y1+top_pad-10, 0)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (150,150,150), 2)
            # 여기에 추가!!
            decoded_codes.append({
                'data': '',
                'type': None,
                'valid': False,
                'bounding_box': [x1, y1, x2, y2],
                'confidence': c
            })
            
            
            continue

        # conf≥0.5 → 디코딩 시도
        pad = 10
        xx1 = max(0, x1 - pad)
        yy1 = max(0, y1 - pad)
        xx2 = min(w, x2 + pad)
        yy2 = min(h, y2 + pad)

        # ✅ 바운딩 박스의 하단 일부 잘라내기 (텍스트 제거용)
        box_height = yy2 - yy1
        cut_ratio = 0.15  # 하단 20% 제거 (비율 조절 가능)
        yy2 = yy2 - int(box_height * cut_ratio)

        cropped = image[yy1:yy2, xx1:xx2]

        gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)

        # ✅ 바운딩 박스 내부 전체를 전처리 대상으로 넘김
        decode_res = pyzbar_decode_with_preprocessing(
            gray_img=gray,
            bbox_list=[(0, 0, gray.shape[1], gray.shape[0])]
        )

        if decode_res:
            # 성공 → 초록 박스
            cv2.rectangle(result_img, (xx1, yy1+top_pad), (xx2, yy2+top_pad), (0,255,0), 2)
            label_text = f"BARCODE {c:.2f}"
            cv2.putText(result_img, label_text, (xx1, max(yy1+top_pad-10,0)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2)

            for code_dict in decode_res:
                code_str = code_dict['data']  # 문자열 추출
                if code_str not in seen_data:
                    seen_data.add(code_str)
                    decoded_codes.append({
                        'data': code_str,
                        'type': code_dict.get('type'),
                        'valid': code_dict.get('valid', False),
                        'bounding_box': [xx1, yy1, xx2, yy2],
                        'confidence': c
        })
        else:
            # 실패 → 노랑 박스
            cv2.rectangle(result_img, (xx1, yy1+top_pad), (xx2, yy2+top_pad), (0,255,255), 2)
            label_text = f"NO-DECODE {c:.2f}"
            cv2.putText(result_img, label_text, (xx1, max(yy1+top_pad-10,0)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,255), 2)
            
             # 디코딩 실패 바코드도 bounding box 정보 포함해 전달
            decoded_codes.append({
        'data': '',
        'type': None,
        'valid': False,
        'bounding_box': [xx1, yy1, xx2, yy2],
        'confidence': c
    })

    # 결과 이미지 저장
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    result_fn = f"result_{ts}.jpg"
    result_path = os.path.join(UPLOAD_FOLDER, result_fn)
    cv2.imwrite(result_path, result_img)
    print(f"[detect_barcodes_yolo] 결과 이미지: {result_path}")

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
