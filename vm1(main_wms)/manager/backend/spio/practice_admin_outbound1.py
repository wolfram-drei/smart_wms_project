from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import mysql.connector
from pyzbar.pyzbar import decode
from PIL import Image, ImageEnhance
from werkzeug.utils import secure_filename
from pyzbar.pyzbar import decode as pyzbar_decode
import cv2
import pandas as pd
import numpy as np
from decimal import Decimal
from datetime import datetime
import uuid
import pytesseract
import re

import imutils

# Ultralytics YOLO
from ultralytics import YOLO


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # 모든 도메인에서의 요청 허용

# GCP 환경의 경로 설정
BASE_DIR = '/home/wms/work/manager/backend/spio'
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
MODEL_PATH = os.path.join(BASE_DIR, 'best.pt')

# 업로드 폴더 생성 및 권한 설정
def ensure_dir(directory):
    try:
        if not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            print(f"Created directory: {directory}")
            # 폴더 권한 설정 (필요 시)
            # os.chmod(directory, 0o777)
    except Exception as e:
        print(f"Error creating directory {directory}: {str(e)}")

ensure_dir(UPLOAD_FOLDER)

# YOLOv5 모델 로드
try:
    model = YOLO(MODEL_PATH)
    print("Ultralytics YOLO 모델 로드 성공")
except Exception as e:
    print(f"Ultralytics YOLO 모델 로드 실패: {str(e)}")
    model = None



# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "연결호스트",
    "user": "사용자이름",
    "password": "비밀번호",
    "database": "데이터베이스이름"
}

# 바코드 디코딩 함수 (문자열 반환)
def decode_barcodes_to_strings(image):
    decoded_objects = decode(image)
    barcode_nums = [obj.data.decode("utf-8").strip() for obj in decoded_objects]
    return barcode_nums

# 회전된 바코드 디코딩
def rotate_image(img, angle):
    (h, w) = img.shape[:2]
    center = (w // 2, h // 2)
    mat = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(img, mat, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

# 이미지 전처리 및 pyzbar 디코딩
def pyzbar_decode_with_preprocessing(gray_img):
    results = []

    methods = [
        ("resize", lambda g: cv2.resize(g, None, fx=2.0, fy=2.0)),
        ("sharpen", lambda g: cv2.filter2D(g, -1, np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]]))),
        ("morph_close", lambda g: cv2.morphologyEx(g, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))),
        ("blur", lambda g: cv2.GaussianBlur(g, (3, 3), 0)),
        ("equalize", lambda g: cv2.equalizeHist(g)),
        ("adaptive_thresh", lambda g: cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                                            cv2.THRESH_BINARY, 11, 2)),
        ("otsu", lambda g: cv2.threshold(cv2.medianBlur(g, 3), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]),
    ]

    for i, (name, prep) in enumerate(methods):
        try:
            proc = prep(gray_img)
            debug_path = os.path.join(UPLOAD_FOLDER, f"debug_prep_{i+1}_{name}.jpg")
            cv2.imwrite(debug_path, proc)
            print(f"[전처리 {i+1}] 저장됨: {debug_path} / shape={proc.shape}")

            for angle in [0, 90, -90]:  # 회전도 도전!
                rotated = rotate_image(proc, angle) if angle != 0 else proc
                barcodes = pyzbar_decode(rotated)
                for b in barcodes:
                    try:
                        code_str = b.data.decode('utf-8').strip()
                        if code_str:
                            results.append(code_str)
                            print(f"[pyzbar] 디코딩 성공 (angle={angle}): {code_str}")
                    except Exception as e:
                        print(f"디코딩 오류: {e}")
                if results:
                    break
            if results:
                break
        except Exception as e:
            print(f"[전처리 {i+1}] 처리 중 오류 발생: {e}")
            continue

    return results

# OCR 디코딩 함수 추가
def decode_with_ocr(image):
    """
    OCR로 숫자 또는 CONTRACT로 시작하는 텍스트 추출
    """
    try:
        # 전처리
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        enhanced = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        enhanced = cv2.bilateralFilter(enhanced, 9, 75, 75)  # 노이즈 제거

        for angle in [0, 90, 180, 270]:
            rotated = imutils.rotate_bound(gray, angle)
            barcodes = decode(rotated)

        # OCR 실행
        config = '--psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        text = pytesseract.image_to_string(enhanced, config=config)

        lines = text.split('\n')
        codes = []

        for line in lines:
            cleaned = line.strip().replace(' ', '')
            if len(cleaned) > 5 and ('CONTRACT' in cleaned or cleaned.isdigit()):
                print(f"[OCR] 추출 성공: {cleaned}")
                codes.append(cleaned)

        return codes
    except Exception as e:
        print(f"[OCR 디코딩 에러] {e}")
        return []

# OCR 결과 후처리로 오타 교정
def clean_ocr_code(raw):
    # CONTRACT로 시작하면 숫자만 남기기
    m = re.match(r'(CONTRACT)([0-9OIlBDS]+)', raw.upper())
    if m:
        prefix, suffix = m.groups()
        # 문자 교정: O->0, I->1, B->8, S->5
        corrected = (
            suffix.replace('O', '0')
                  .replace('I', '1')
                  .replace('B', '8')
                  .replace('S', '5')
                  .replace('T', '1')
        )
        return prefix + corrected
    return raw

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

    min_area = 10000   # 최소 영역 (너무 작으면 무시)
    max_area = 500000000  # 최대 영역 (너무 크면 무시)

    for i, det in enumerate(boxes):
        x1, y1, x2, y2 = map(int, det[:4])
        area = (x2 - x1) * (y2 - y1)
        if area < min_area or area > max_area:
            print(f"[YOLO] box {i+1}: 영역 필터링으로 제외됨 (area={area})")
            continue
        c = float(confs[i])
        print(f"[YOLO] box {i+1}: conf={c:.2f}, coords=({x1},{y1})-({x2},{y2}), area={area}")

        # 🔧 먼저 패딩된 crop 영역을 구해줍니다 (모든 경우 공통)
        box_w = x2 - x1
        box_h = y2 - y1
        pad_x = int(box_w * 0.4)
        pad_y = int(box_h * 0.4)

        xx1 = max(0, x1 - pad_x)
        yy1 = max(0, y1 - pad_y)
        xx2 = min(w, x2 + pad_x)
        yy2 = min(h, y2 + pad_y)

        cropped = image[yy1:yy2, xx1:xx2]  # ✅ 모든 경우 대비해서 먼저 선언

        if c < 0.5:
            # 낮은 confidence → 회색 박스
            cv2.rectangle(result_img, (x1, y1+top_pad), (x2, y2+top_pad), (150,150,150), 2)
            cv2.putText(result_img, f"LOWCONF {c:.2f}", (x1, max(y1+top_pad-10, 0)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (150,150,150), 2)
            fail_path = os.path.join(UPLOAD_FOLDER, f"fail_crop_{i}.jpg")
            cv2.imwrite(fail_path, cropped)  # 이제 오류 안 남

            decoded_codes.append({
                'data': '',
                'type': None,
                'valid': False,
                'bounding_box': [x1, y1, x2, y2],
                'confidence': c
            })
            continue

        # conf≥0.5 → 디코딩 시도
        box_w = x2 - x1
        box_h = y2 - y1
        pad_x = int(box_w * 0.4)
        pad_y = int(box_h * 0.4)

        xx1 = max(0, x1 - pad_x)
        yy1 = max(0, y1 - pad_y)
        xx2 = min(w, x2 + pad_x)
        yy2 = min(h, y2 + pad_y)

        cropped = image[yy1:yy2, xx1:xx2]
        gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
        # 디지털 화면 바코드 이미지 전처리 강화
        blurred = cv2.medianBlur(gray, 3)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        decode_res = pyzbar_decode_with_preprocessing(binary)

        decode_type = "BARCODE"  # 기본 값

        if not decode_res:
            decode_res = decode_with_ocr(cropped)
            if decode_res:
                decode_type = "OCR"  # OCR로 디코딩 성공

        if decode_res:  # 디코딩 성공 시 (pyzbar든 OCR이든)
            cv2.rectangle(result_img, (xx1, yy1+top_pad), (xx2, yy2+top_pad), (0,255,0), 2)
            label_text = f"{decode_type} {c:.2f}"
            cv2.putText(result_img, label_text, (xx1, max(yy1+top_pad-10,0)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2)

            for code_str in decode_res:
                cleaned = clean_ocr_code(code_str)
                print(f"[오타 보정] {code_str} → {cleaned}")
                if cleaned not in seen_data:
                    seen_data.add(cleaned)
                    decoded_codes.append({
                        'data': cleaned,
                        'type': decode_type,
                        'valid': cleaned.startswith('CONTRACT'),
                        'bounding_box': [xx1, yy1, xx2, yy2],
                        'confidence': c
                    })
        else:
            # decode_res = pyzbar_decode_with_preprocessing(gray)
            # 디코딩 실패 → 노랑 박스
            cv2.rectangle(result_img, (xx1, yy1+top_pad), (xx2, yy2+top_pad), (0,255,255), 2)
            label_text = f"NO-DECODE {c:.2f}"
            cv2.putText(result_img, label_text, (xx1, max(yy1+top_pad-10,0)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,255), 2)

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

# 단일 /barcode-upload 엔드포인트 정의
@app.route("/barcode-upload", methods=["POST"])
def barcode_upload():
        """
        1) 클라이언트에서 이미지 파일 수신
        2) YOLO를 사용하여 바코드 객체 인식
        3) 인식된 바코드를 디코딩 (pyzbar 사용)
        4) MainTable에서 바코드 조회 및 Sm_Phone_Outbound에 삽입 또는 기존 데이터 반환
        5) 처리된 바코드들을 프론트엔드에 반환
        """
        # (A) 이미지 파일 수신
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400

        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "Empty file"}), 400

        # 클라이언트로부터 신뢰도 임계값 받기 (옵션)
        try:
            data = request.form  # form 데이터에서 가져오기
            confidence_threshold = float(data.get('confidence_threshold', 0.25))
            if not (0.0 < confidence_threshold <= 1.0):
                raise ValueError("confidence_threshold must be between 0 and 1")
        except Exception as e:
            return jsonify({"error": "Invalid confidence_threshold value"}), 400
        
        connection = None

        try:
            # 이미지를 numpy 배열로 변환
            nparr = np.frombuffer(file.read(), np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                return jsonify({"error": "Invalid image file"}), 400

            # 바코드 감지 및 디코딩 (YOLO 통합)
            original_filename = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            detection_result = detect_barcodes_yolo(image, original_filename, confidence_threshold=confidence_threshold)

            decoded_barcodes = detection_result.get('decoded_codes', [])
            print(f"디코딩된 바코드 수: {len(decoded_barcodes)}")

            if not decoded_barcodes:
                return jsonify({"message": "No barcode found"}), 404

            # 바코드 데이터 필터링 및 유효성 검증
            valid_barcodes = [barcode for barcode in decoded_barcodes if barcode['valid']]
            invalid_barcodes = [barcode for barcode in decoded_barcodes if not barcode['valid']]

            if not valid_barcodes:
                return jsonify({"message": "No valid barcodes found"}), 404
            

            # 데이터베이스 연결
            connection = mysql.connector.connect(**DB_CONFIG)
            cursor = connection.cursor(dictionary=True)

            # 트랜잭션 시작
            connection.start_transaction()

            result_barcodes = []

            mode = data.get("mode", "inspect")

            for barcode in valid_barcodes:
                raw_data = barcode['data']
                barcode_num = re.sub(r'\s+', '', raw_data).strip()
                print(f"[비교용] barcode_num='{barcode_num}' / len={len(barcode_num)}")

                # MainTable에서 바코드 조회
                select_sql = "SELECT * FROM MainTable WHERE barcode_num = %s"
                cursor.execute(select_sql, (barcode_num,))
                main_row = cursor.fetchone()

                if not main_row:
                    print(f"MainTable에 존재하지 않는 바코드: {barcode_num}")
                    continue  # 또는 원하는 로직에 따라 처리

                # Sm_Phone_Outbound에서 바코드 조회
                check_sql = "SELECT * FROM Sm_Phone_Outbound WHERE barcode_num = %s"
                cursor.execute(check_sql, (barcode_num,))
                existing_row = cursor.fetchone()

                if existing_row:
                    # 이미 존재하는 바코드인 경우, 기존 데이터를 result_barcodes에 추가
                    result_barcodes.append(existing_row)
                    print(f"Existing barcode found: ID={existing_row['id']}, Barcode={existing_row['barcode_num']}")
                else:
                    # 중복이 없을 때만 삽입
                    insert_sql = """
                        INSERT INTO Sm_Phone_Outbound (
                            company_name, product_name, product_number, warehouse_type, 
                            warehouse_location, pallet_size, pallet_num, barcode_num, barcode, outbound_status, outbound_date
                        ) VALUES (
                            %(company_name)s, %(product_name)s, %(product_number)s, %(warehouse_type)s, 
                            %(warehouse_location)s, %(pallet_size)s, %(pallet_num)s, %(barcode_num)s, %(barcode)s, %(outbound_status)s, %(outbound_date)s
                        )
                    """
                    cursor.execute(insert_sql, main_row)

                    # 방금 인서트한 데이터 다시 불러오기
                    cursor.execute("SELECT * FROM Sm_Phone_Outbound WHERE barcode_num = %s ORDER BY id DESC LIMIT 1", (barcode_num,))
                    inbound_row = cursor.fetchone()
                    result_barcodes.append(inbound_row)
                    print(f"Inserted new barcode: ID={inbound_row['id']}, Barcode={inbound_row['barcode_num']}")

                    # ✅ MainTable에서 출고대상인 경우 삭제
                    today = datetime.today().date()
                    cursor.execute("""
                        SELECT * FROM MainTable 
                        WHERE barcode_num = %s 
                        AND outbound_status = '출고요청' 
                        AND DATE(outbound_date) = %s
                    """, (barcode_num, today))
                    target_row = cursor.fetchone()
                    if mode == "auto" and target_row:
                        cursor.execute("""
                            UPDATE MainTable 
                            SET outbound_status = '출고완료', last_outbound_date = %s 
                            WHERE id = %s
                        """, (today, target_row['id']))
                        print(f"[출고완료로 상태 변경] MainTable.id={target_row['id']} / barcode_num={barcode_num}")

            # 트랜잭션 커밋
            connection.commit()

            cursor.close()
            connection.close()

            if not result_barcodes:
                return jsonify({"message": "No new or existing valid barcodes processed."}), 200

            # Decimal과 datetime을 JSON 직렬화 가능한 형태로 변환
            for barcode in result_barcodes:
                for key, value in barcode.items():
                    if isinstance(value, Decimal):
                        barcode[key] = float(value)
                    elif isinstance(value, (datetime,)):
                        barcode[key] = value.isoformat()
                    elif value is None:
                        barcode[key] = ""

            return jsonify({
                "message": "Upload completed.",
                "barcodes": result_barcodes,
                "result_image": detection_result.get('result_image')
            }), 200

        except Exception as e:
            print("Error in /barcode-upload POST:", e)
            if connection:  # ← 반드시 이 조건문 추가!
                connection.rollback()
            return jsonify({"error": str(e)}), 500

@app.route("/outbound-status", methods=["GET"])
def get_outbound_status():
    """
    출고요청 상태이면서 outbound_date가 오늘인 데이터만 반환
    """
    search_text = request.args.get("searchText", "").strip()
    try:
        # 오늘 날짜 문자열 (YYYY-MM-DD)
        today = datetime.today().strftime('%Y-%m-%d')

        # DB 연결
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)

        # 필터 조건 추가
        filtered_query = """
            SELECT 
                id,
                company_name,
                product_name,
                barcode_num,
                inbound_quantity,
                warehouse_location,
                warehouse_type,
                outbound_status,
                outbound_date,
                last_outbound_date
            FROM MainTable
            WHERE outbound_status = '출고요청'
              AND DATE(outbound_date) = %s
        """
        cursor.execute(filtered_query, (today,))

        rows = cursor.fetchall()
        cursor.close()
        connection.close()

        # 데이터 정리
        filtered_data = [
            {
                "id": row["id"],
                "company_name": row["company_name"],
                "product_name": row["product_name"],
                "barcode_num": row["barcode_num"],
                "inbound_quantity": row["inbound_quantity"],
                "warehouse_location": row["warehouse_location"],
                "warehouse_type": row["warehouse_type"],
                "outbound_status": row["outbound_status"],
                "outbound_date": row["outbound_date"].isoformat() if row["outbound_date"] else "",
                "last_outbound_date": row["last_outbound_date"].isoformat() if row["last_outbound_date"] else ""
            }
            for row in rows
        ]

        return jsonify(filtered_data)
    except Exception as e:
        print(f"Error in /outbound-status GET: {str(e)}")
        return jsonify({"error": f"Failed to fetch outbound status data: {str(e)}"}), 500


@app.route("/complete/<barcode_num>", methods=["POST"])
def complete_outbound(barcode_num):
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        today = datetime.today().date()

        # MainTable에서 해당 바코드 존재 여부 확인
        cursor.execute("SELECT * FROM MainTable WHERE barcode_num = %s", (barcode_num,))
        main_row = cursor.fetchone()

        if not main_row:
            return jsonify({"error": "MainTable에 해당 바코드가 없습니다."}), 404

        # 상태 업데이트
        cursor.execute("""
            UPDATE MainTable 
            SET outbound_status = '출고완료', last_outbound_date = %s 
            WHERE barcode_num = %s
        """, (today, barcode_num))

        # Sm_Phone_Outbound에 삽입 (존재하지 않을 경우에만)
        cursor.execute("SELECT * FROM Sm_Phone_Outbound WHERE barcode_num = %s", (barcode_num,))
        exists = cursor.fetchone()
        if not exists:
            insert_sql = """
                INSERT INTO Sm_Phone_Outbound (
                    company_name, product_name, product_number, warehouse_type, 
                    warehouse_location, pallet_size, pallet_num, barcode_num, barcode, 
                    outbound_status, outbound_date
                ) VALUES (
                    %(company_name)s, %(product_name)s, %(product_number)s, %(warehouse_type)s,
                    %(warehouse_location)s, %(pallet_size)s, %(pallet_num)s, %(barcode_num)s, 
                    %(barcode)s, '출고완료', %s
                )
            """
            cursor.execute(insert_sql, {**main_row, "outbound_date": today})

        conn.commit()
        return jsonify({"message": f"{barcode_num} 출고 완료 처리됨."}), 200

    except Exception as e:
        print("Error in /complete/<barcode_num>:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        

# 이미지 파일 제공을 위한 라우트
@app.route('/uploads/<filename>')
def serve_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == "__main__":
    # Flask 서버 실행
    app.run(host="0.0.0.0", port=5050, debug=True)
