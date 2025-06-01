from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import os
import mysql.connector
from pyzbar.pyzbar import decode
from PIL import Image, ImageEnhance
from werkzeug.utils import secure_filename
from decimal import Decimal
import cv2
import numpy as np
from datetime import datetime
import uuid  # 코드 상단에 추가

# Ultralytics 라이브러리 임포트
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
            # 필요 시 폴더 권한 설정 (예: os.chmod(directory, 0o777))
    except Exception as e:
        print(f"Error creating directory {directory}: {str(e)}")

ensure_dir(UPLOAD_FOLDER)

# YOLO 모델 로드 (포맷 변경 후 best.pt 파일 사용)
try:
    model = YOLO(MODEL_PATH)
    print("Ultralytics YOLOv5 모델 로드 성공")
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

# 바코드 디코딩 함수 (딕셔너리 반환)
def decode_barcodes_to_dicts(image):
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        preprocessing_methods = [
            lambda img: img,  # 원본
            lambda img: cv2.resize(img, None, fx=2.0, fy=2.0),
            lambda img: cv2.GaussianBlur(img, (3, 3), 0),
            lambda img: cv2.filter2D(img, -1, np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])),
            lambda img: cv2.equalizeHist(img),
            lambda img: cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                              cv2.THRESH_BINARY, 11, 2)
        ]
        
        decoded_results = []
        for preprocess in preprocessing_methods:
            processed_img = preprocess(gray)
            barcodes = decode(processed_img)
            if barcodes:
                for barcode in barcodes:
                    try:
                        barcode_data = barcode.data.decode('utf-8')
                        barcode_type = barcode.type
                        decoded_results.append({
                            'data': barcode_data,
                            'type': barcode_type,
                            'valid': barcode_data.startswith('CONTRACT')
                        })
                        print(f"디코딩된 데이터: {barcode_data}, 타입: {barcode_type}")
                    except Exception as e:
                        print(f"바코드 데이터 처리 중 에러: {str(e)}")
                break
        print(f"총 디코딩된 바코드: {len(decoded_results)}개")
        return decoded_results
    except Exception as e:
        print(f"전처리 중 에러: {str(e)}")
        return []

def detect_barcodes_yolo(image, original_filename, confidence_threshold=0.25):
    # 1. 이미지 저장
    upload_path = os.path.join(UPLOAD_FOLDER, original_filename)
    cv2.imwrite(upload_path, image)
    print(f"원본 이미지 저장됨: {upload_path}")

    if model is None:
        print("YOLO 모델이 로드되지 않았습니다.")
        return {'decoded_codes': [], 'count': 0, 'result_image': None}

    # 2. YOLO 추론 (시각화용)
    model.conf = confidence_threshold
    results = model(image)
    result = results[0]
    predictions = result.boxes.xyxy.cpu().numpy() if result.boxes else []
    confidences = result.boxes.conf.cpu().numpy() if result.boxes else []
    print(f"YOLO 감지된 객체 수: {len(predictions)}")

    # 3. 결과 이미지 생성
    top_padding = 60
    height, width = image.shape[:2]
    result_image = np.ones((height + top_padding, width, 3), dtype=np.uint8) * 255
    result_image[top_padding:, :] = image

    # 4. 전체 이미지로 디코딩 시도
    decoded_codes = []
    seen_data = set()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    barcodes = decode(gray)

    if barcodes:
        for barcode in barcodes:
            barcode_data = barcode.data.decode('utf-8')
            barcode_type = barcode.type
            if barcode_data not in seen_data:
                seen_data.add(barcode_data)
                rect = barcode.rect
                x1, y1 = rect.left, rect.top
                x2, y2 = rect.left + rect.width, rect.top + rect.height

                # 초록색 박스 (전체 디코딩 성공)
                cv2.rectangle(result_image, (x1, y1 + top_padding), (x2, y2 + top_padding), (0, 255, 0), 3)
                text = f"{barcode_data} ({barcode_type})"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 1.2
                thickness = 2
                (text_width, text_height), _ = cv2.getTextSize(text, font, font_scale, thickness)
                padding = 5
                text_y = y1 + top_padding - text_height - padding
                cv2.rectangle(result_image, (x1, text_y - padding),
                              (x1 + text_width + 2*padding, text_y + text_height + padding),
                              (0, 0, 0), -1)
                cv2.putText(result_image, text, (x1 + padding, text_y + text_height),
                            font, font_scale, (255, 255, 255), thickness)
                decoded_codes.append({
                    'data': barcode_data,
                    'type': barcode_type,
                    'valid': barcode_data.startswith('CONTRACT'),
                    'bounding_box': [x1, y1, x2, y2],
                    'confidence': None
                })

    # 5. YOLO 박스 시각화 (디코딩 여부 무관)
    for i, det in enumerate(predictions):
        x1, y1, x2, y2 = map(int, det[:4])
        conf = confidences[i]
        label = f"YOLO {conf:.2f}"

        # 디코딩된 박스와 겹치는지 확인해서 파랑/노랑 결정
        is_decoded = False
        for d in decoded_codes:
            dx1, dy1, dx2, dy2 = d['bounding_box']
            if x1 <= dx1 <= x2 and y1 <= dy1 <= y2:
                is_decoded = True
                break

        box_color = (255, 0, 0) if is_decoded else (0, 255, 255)  # 파랑 or 노랑
        cv2.rectangle(result_image, (x1, y1 + top_padding), (x2, y2 + top_padding), box_color, 2)
        cv2.putText(result_image, label, (x1, y1 + top_padding - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, box_color, 2)

    # 6. 저장 및 결과 반환
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    result_filename = f"result_{timestamp}.jpg"
    result_path = os.path.join(UPLOAD_FOLDER, result_filename)
    cv2.imwrite(result_path, result_image)
    print(f"결과 이미지 저장됨: {result_path}")

    return {
        'decoded_codes': decoded_codes,
        'count': len(decoded_codes),
        'result_image': result_filename
    }

    

@app.route("/barcode-upload", methods=["POST"])
def barcode_upload():
    """
    1) 클라이언트로부터 이미지 파일 수신
    2) YOLO를 사용하여 바코드 영역 인식
    3) 인식된 바코드를 pyzbar로 디코딩
    4) MainTable에서 바코드 조회 후 Sm_Phone_Inbound에 삽입 또는 기존 데이터 반환
    5) 처리된 바코드들을 프론트엔드에 반환
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Empty file"}), 400

    try:
        data = request.form
        confidence_threshold = float(data.get('confidence_threshold', 0.25))
        if not (0.0 < confidence_threshold <= 1.0):
            raise ValueError("confidence_threshold must be between 0 and 1")
    except Exception as e:
        return jsonify({"error": "Invalid confidence_threshold value"}), 400

    connection = None
    try:
        nparr = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            return jsonify({"error": "Invalid image file"}), 400

        original_filename = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        detection_result = detect_barcodes_yolo(image, original_filename, confidence_threshold=confidence_threshold)
        decoded_barcodes = detection_result.get('decoded_codes', [])
        print(f"디코딩된 바코드 수: {len(decoded_barcodes)}")

        if not decoded_barcodes:
            return jsonify({"message": "No barcode found"}), 404

        valid_barcodes = [barcode for barcode in decoded_barcodes if barcode['valid']]
        if not valid_barcodes:
            return jsonify({"message": "No valid barcodes found"}), 404

        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        connection.start_transaction()

        result_barcodes = []
        for barcode in valid_barcodes:
            barcode_num = barcode['data']
            select_sql = "SELECT * FROM MainTable WHERE barcode_num = %s"
            cursor.execute(select_sql, (barcode_num,))
            main_row = cursor.fetchone()
            if not main_row:
                print(f"MainTable에 존재하지 않는 바코드: {barcode_num}")
                continue

            check_sql = "SELECT * FROM Sm_Phone_Inbound WHERE barcode_num = %s"
            cursor.execute(check_sql, (barcode_num,))
            existing_row = cursor.fetchone()
            if existing_row:
                result_barcodes.append(existing_row)
                print(f"Existing barcode found: ID={existing_row['id']}, Barcode={existing_row['barcode_num']}")
            else:
                insert_sql = """
                    INSERT INTO Sm_Phone_Inbound (
                        company_name, product_name, product_number, inbound_quantity, warehouse_type, 
                        warehouse_location, pallet_size, pallet_num, barcode_num, barcode, inbound_status
                    ) VALUES (
                        %(company_name)s, %(product_name)s, %(product_number)s, %(inbound_quantity)s, %(warehouse_type)s, 
                        %(warehouse_location)s, %(pallet_size)s, %(pallet_num)s, %(barcode_num)s, %(barcode)s, '입고 준비'
                    )
                """
                cursor.execute(insert_sql, main_row)
                cursor.execute("SELECT * FROM Sm_Phone_Inbound WHERE barcode_num = %s ORDER BY id DESC LIMIT 1", (barcode_num,))
                inbound_row = cursor.fetchone()
                result_barcodes.append(inbound_row)
                print(f"Inserted new barcode: ID={inbound_row['id']}, Barcode={inbound_row['barcode_num']}")

        connection.commit()
        cursor.close()
        connection.close()

        if not result_barcodes:
            return jsonify({"message": "No new or existing valid barcodes processed."}), 200

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
        if connection is not None:
            connection.rollback()
        return jsonify({"error": str(e)}), 500

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
        filtered_data = [
            {
                "id": row["id"],
                "company_name": row["company_name"],
                "product_name": row["product_name"],
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

@app.route('/uploads/<filename>')
def serve_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5030, debug=True)
