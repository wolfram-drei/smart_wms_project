from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import os
import mysql.connector
from pyzbar.pyzbar import decode
from PIL import Image, ImageEnhance
from werkzeug.utils import secure_filename
from decimal import Decimal
import torch
import cv2
import numpy as np
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # 모든 도메인에서의 요청 허용

# GCP 환경의 경로 설정
BASE_DIR = '/home/wms/work/manager/backend/spio'
UPLOAD_FOLDER = '/home/wms/work/manager/backend/spio/uploads'
MODEL_PATH = os.path.join(BASE_DIR, 'best_model.pt')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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
    model = torch.hub.load('ultralytics/yolov5', 'custom', path=MODEL_PATH, trust_repo=True)
    model.eval()
    print("YOLO 모델 로드 성공")
except Exception as e:
    print(f"YOLO 모델 로드 실패: {str(e)}")
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
        # 이미지 전처리 강화
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 이미지 처리 방법들
        preprocessing_methods = [
            lambda img: img,  # 원본
            lambda img: cv2.resize(img, None, fx=2.0, fy=2.0),  # 확대
            lambda img: cv2.GaussianBlur(img, (5, 5), 0),  # 블러
            lambda img: cv2.filter2D(img, -1, np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])),  # 샤프닝
            lambda img: cv2.equalizeHist(img),  # 대비 향상
            lambda img: cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)  # 적응형 임계값
        ]
        
        decoded_results = []
        
        # 각 전처리 방법 시도
        for preprocess in preprocessing_methods:
            processed_img = preprocess(gray)
            barcodes = decode(processed_img)  # pyzbar로 바코드 디코딩
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
                break  # 성공적으로 디코딩되면 더 이상 시도하지 않음
        
        print(f"총 디코딩된 바코드: {len(decoded_results)}개")
        return decoded_results
    except Exception as e:
        print(f"전처리 중 에러: {str(e)}")
        return []

def detect_barcodes_yolo(image, original_filename, confidence_threshold=0.25):
    # 원본 이미지 저장
    upload_path = os.path.join(UPLOAD_FOLDER, original_filename)
    cv2.imwrite(upload_path, image)
    print(f"원본 이미지 저장됨: {upload_path}")

    # YOLO 모델로 바코드 영역 탐지
    if model is None:
        print("YOLO 모델이 로드되지 않았습니다.")
        return {'decoded_codes': [], 'count': 0, 'result_image': None}

    # 신뢰도 임계값 설정
    model.conf = confidence_threshold  # 신뢰도 임계값 설정
    results = model(image)  # 'conf' 인자 제거
    predictions = results.pred[0]
    predictions = predictions.cpu().numpy() if predictions is not None else []
    print(f"YOLO 감지된 객체 수: {len(predictions)}")

    # 결과 이미지 준비 (디버깅 용도)
    top_padding = 60
    height, width = image.shape[:2]
    result_image = np.ones((height + top_padding, width, 3), dtype=np.uint8) * 255
    result_image[top_padding:, :] = image

    # 전체 이미지에 대해 먼저 디코딩 시도
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
                print(f"디코딩 성공: {barcode_data}")

                # 바코드 위치 정보
                rect = barcode.rect
                x1, y1 = rect.left, rect.top
                x2, y2 = rect.left + rect.width, rect.top + rect.height

                # 바코드 영역 표시 (녹색)
                cv2.rectangle(result_image, 
                              (x1, y1 + top_padding),
                              (x2, y2 + top_padding),
                              (0, 255, 0), 10)

                # 텍스트 표시
                text = f"{barcode_data} ({barcode_type})"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 1.5
                thickness = 2

                (text_width, text_height), _ = cv2.getTextSize(text, font, font_scale, thickness)
                padding = 5
                text_y = y1 + top_padding - text_height - padding

                cv2.rectangle(result_image,
                              (x1, text_y - padding),
                              (x1 + text_width + 2*padding, text_y + text_height + padding),
                              (0, 0, 0),
                              -1)

                cv2.putText(result_image, text,
                            (x1 + padding, text_y + text_height),
                            font,
                            font_scale,
                            (255, 255, 255),
                            thickness)

                decoded_codes.append({
                    'data': barcode_data,
                    'type': barcode_type,
                    'valid': barcode_data.startswith('CONTRACT'),
                    'bounding_box': [x1, y1, x2, y2],
                    'confidence': None  # 바코드 디코딩에는 confidence가 없으므로 None으로 설정
                })

    # YOLO 바운딩 박스 별로 디코딩 시도
    for det in predictions:
        x1, y1, x2, y2, conf, cls = det
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

        cropped = image[y1:y2, x1:x2]

        # 단계적 확대 및 디코딩
        max_scale = 4.0  # 최대 4배 확대
        scale_step = 1.5  # 단계적 확대 비율
        decoded_success = False

        for scale in [1.0, 2.0, 3.0, max_scale]:
            # 확대
            scaled_cropped = cv2.resize(cropped, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            gray_cropped = cv2.cvtColor(scaled_cropped, cv2.COLOR_BGR2GRAY)
            enhanced_cropped = cv2.equalizeHist(gray_cropped)

            # 디코딩 시도
            barcodes = decode(enhanced_cropped)
            if barcodes:
                for barcode in barcodes:
                    barcode_data = barcode.data.decode('utf-8')
                    barcode_type = barcode.type
                    if barcode_data not in seen_data:
                        seen_data.add(barcode_data)
                        print(f"확대 비율 {scale}에서 디코딩 성공: {barcode_data}")

                        # 바운딩 박스 표시 (파란색)
                        cv2.rectangle(result_image,
                                      (x1, y1 + top_padding),
                                      (x2, y2 + top_padding),
                                      (255, 0, 0), 2)

                        # 텍스트 표시
                        text = f"{barcode_data} ({barcode_type})"
                        font = cv2.FONT_HERSHEY_SIMPLEX
                        font_scale = 0.8
                        thickness = 2

                        (text_width, text_height), _ = cv2.getTextSize(text, font, font_scale, thickness)
                        padding = 5
                        text_y = y1 + top_padding - text_height - padding

                        cv2.rectangle(result_image,
                                      (x1, text_y - padding),
                                      (x1 + text_width + 2 * padding, text_y + text_height + padding),
                                      (0, 0, 0),
                                      -1)

                        cv2.putText(result_image, text,
                                    (x1 + padding, text_y + text_height),
                                    font,
                                    font_scale,
                                    (255, 255, 255),
                                    thickness)

                        decoded_codes.append({
                            'data': barcode_data,
                            'type': barcode_type,
                            'valid': barcode_data.startswith('CONTRACT'),
                            'bounding_box': [x1, y1, x2, y2],
                            'confidence': float(conf)
                        })
                decoded_success = True
                break  # 디코딩 성공 시 추가 확대 중단

            if decoded_success:
                break

    # 결과 이미지 저장 (디버깅 용도)
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

# 공통 데이터베이스 연결 함수
def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

# 단일 /barcode-upload 엔드포인트 정의 (입고용)
@app.route("/barcode-upload", methods=["POST"])
def barcode_upload_inbound():
    """
    입고 처리:
    1) 클라이언트에서 이미지 파일 수신
    2) YOLO를 사용하여 바코드 객체 인식
    3) 인식된 바코드를 디코딩 (pyzbar 사용)
    4) MainTable에서 바코드 조회 및 Sm_Phone_Inbound에 삽입 또는 기존 데이터 반환
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
        print(f"디코딩된 바코드 수: {len(decoded_barcodes)}개")

        if not decoded_barcodes:
            return jsonify({"message": "No barcode found"}), 404

        # 바코드 데이터 필터링 및 유효성 검증
        valid_barcodes = [barcode for barcode in decoded_barcodes if barcode['valid']]
        invalid_barcodes = [barcode for barcode in decoded_barcodes if not barcode['valid']]

        if not valid_barcodes:
            return jsonify({"message": "No valid barcodes found"}), 404

        # 데이터베이스 연결
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # 트랜잭션 시작
        connection.start_transaction()

        result_barcodes = []

        for barcode in valid_barcodes:
            barcode_num = barcode['data']

            # MainTable에서 바코드 조회
            select_sql = "SELECT * FROM MainTable WHERE barcode_num = %s"
            cursor.execute(select_sql, (barcode_num,))
            main_row = cursor.fetchone()

            if not main_row:
                print(f"MainTable에 존재하지 않는 바코드: {barcode_num}")
                continue  # 또는 원하는 로직에 따라 처리

            # Sm_Phone_Inbound에서 바코드 조회
            check_sql = "SELECT * FROM Sm_Phone_Inbound WHERE barcode_num = %s"
            cursor.execute(check_sql, (barcode_num,))
            existing_row = cursor.fetchone()

            if existing_row:
                # 이미 존재하는 바코드인 경우, 기존 데이터를 result_barcodes에 추가
                result_barcodes.append(existing_row)
                print(f"Existing barcode found: ID={existing_row['id']}, Barcode={existing_row['barcode_num']}")
            else:
                # 중복이 없을 때만 삽입
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

                # 방금 인서트한 데이터 다시 불러오기
                cursor.execute("SELECT * FROM Sm_Phone_Inbound WHERE barcode_num = %s ORDER BY id DESC LIMIT 1", (barcode_num,))
                inbound_row = cursor.fetchone()
                result_barcodes.append(inbound_row)
                print(f"Inserted new barcode: ID={inbound_row['id']}, Barcode={inbound_row['barcode_num']}")

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
        # 트랜잭션 롤백
        connection.rollback()
        return jsonify({"error": str(e)}), 500

# 출고 업로드 엔드포인트 정의
@app.route("/outbound-upload", methods=["POST"])
def barcode_upload_outbound():
    """
    출고 처리:
    1) 클라이언트에서 이미지 파일 수신
    2) YOLO를 사용하여 바코드 객체 인식
    3) 인식된 바코드를 디코딩 (pyzbar 사용)
    4) MainTable에서 바코드 조회 및 BackupTable에 인서트 후 MainTable에서 삭제
    5) 처리된 바코드들을 프론트엔드에 반환
    """
    # (A) 이미지 파일 수신
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Empty file"}), 400

    try:
        # 이미지를 numpy 배열로 변환
        nparr = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return jsonify({"error": "Invalid image file"}), 400

        # 바코드 감지 및 디코딩 (YOLO 통합)
        original_filename = f"outbound_upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        detection_result = detect_barcodes_yolo(image, original_filename, confidence_threshold=0.25)

        decoded_barcodes = detection_result.get('decoded_codes', [])
        print(f"디코딩된 바코드 수: {len(decoded_barcodes)}개")

        if not decoded_barcodes:
            return jsonify({"message": "No barcode found"}), 404

        # 바코드 데이터 필터링 및 유효성 검증
        valid_barcodes = [barcode for barcode in decoded_barcodes if barcode['valid']]
        invalid_barcodes = [barcode for barcode in decoded_barcodes if not barcode['valid']]

        if not valid_barcodes:
            return jsonify({"message": "No valid barcodes found"}), 404

        # 데이터베이스 연결
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # 트랜잭션 시작
        connection.start_transaction()

        result_barcodes = []

        for barcode in valid_barcodes:
            barcode_num = barcode['data']

            # MainTable에서 바코드 조회
            select_sql = "SELECT * FROM MainTable WHERE barcode_num = %s"
            cursor.execute(select_sql, (barcode_num,))
            main_row = cursor.fetchone()

            if not main_row:
                print(f"MainTable에 존재하지 않는 바코드: {barcode_num}")
                continue  # 또는 원하는 로직에 따라 처리

            # BackupTable에 데이터 인서트
            insert_backup_sql = """
                INSERT INTO BackupTable (
                    id, company_name, product_name, product_number, inbound_quantity, 
                    warehouse_location, warehouse_type, inbound_status, outbound_status,
                    contract_date, inbound_date, outbound_date, storage_duration,
                    warehouse_num, pallet_size, pallet_num, weight,
                    barcode, barcode_num, total_cost
                ) VALUES (
                    %(id)s, %(company_name)s, %(product_name)s, %(product_number)s, %(inbound_quantity)s, 
                    %(warehouse_location)s, %(warehouse_type)s, %(inbound_status)s, '출고완료',
                    %(contract_date)s, %(inbound_date)s, NOW(), %(storage_duration)s,
                    %(warehouse_num)s, %(pallet_size)s, %(pallet_num)s, %(weight)s,
                    %(barcode)s, %(barcode_num)s, %(total_cost)s
                )
            """
            cursor.execute(insert_backup_sql, main_row)
            print(f"Inserted into BackupTable: ID={main_row['id']} Barcode={main_row['barcode_num']}")

            # MainTable에서 데이터 삭제
            delete_sql = "DELETE FROM MainTable WHERE id = %s"
            cursor.execute(delete_sql, (main_row['id'],))
            print(f"Deleted from MainTable: ID={main_row['id']} Barcode={main_row['barcode_num']}")

            result_barcodes.append({"barcode_num": main_row['barcode_num'], "status": "success"})
            print(f"Processed barcode: {main_row['barcode_num']}")

        # 트랜잭션 커밋
        connection.commit()

        cursor.close()
        connection.close()

        if not result_barcodes:
            return jsonify({"message": "No barcodes were processed."}), 200

        return jsonify({
            "message": "Outbound process completed. Data moved to BackupTable and removed from MainTable.",
            "barcodes": result_barcodes,
            "result_image": detection_result.get('result_image')
        }), 200

    except Exception as e:
        print("Error in /outbound-upload POST:", e)
        # 트랜잭션 롤백
        connection.rollback()
        return jsonify({"error": str(e)}), 500

# 출고 완료 엔드포인트 정의 (선택 사항, 만약 별도의 완료 처리가 필요할 경우)
@app.route("/complete-outbound", methods=["POST"])
def complete_outbound():
    """
    출고 완료 버튼 클릭 시 호출되는 엔드포인트:
    1) barcode_num 수신
    2) BackupTable에 인서트
    3) MainTable에서 삭제
    """
    data = request.json
    barcode_num = data.get("barcode_num")

    if not barcode_num:
        return jsonify({"error": "barcode_num is required"}), 400

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # 트랜잭션 시작
        connection.start_transaction()

        # MainTable에서 바코드 조회
        select_sql = "SELECT * FROM MainTable WHERE barcode_num = %s"
        cursor.execute(select_sql, (barcode_num,))
        main_row = cursor.fetchone()

        if not main_row:
            cursor.close()
            connection.close()
            return jsonify({"error": "No matching barcode found in MainTable"}), 404

        # BackupTable에 데이터 인서트
        insert_backup_sql = """
            INSERT INTO BackupTable (
                id, company_name, product_name, product_number, inbound_quantity, 
                warehouse_location, warehouse_type, inbound_status, outbound_status,
                contract_date, inbound_date, outbound_date, storage_duration,
                warehouse_num, pallet_size, pallet_num, weight,
                barcode, barcode_num, total_cost
            ) VALUES (
                %(id)s, %(company_name)s, %(product_name)s, %(product_number)s, %(inbound_quantity)s, 
                %(warehouse_location)s, %(warehouse_type)s, %(inbound_status)s, '출고완료',
                %(contract_date)s, %(inbound_date)s, NOW(), %(storage_duration)s,
                %(warehouse_num)s, %(pallet_size)s, %(pallet_num)s, %(weight)s,
                %(barcode)s, %(barcode_num)s, %(total_cost)s
            )
        """
        cursor.execute(insert_backup_sql, main_row)
        print(f"Inserted into BackupTable: ID={main_row['id']} Barcode={main_row['barcode_num']}")

        # MainTable에서 데이터 삭제
        delete_sql = "DELETE FROM MainTable WHERE id = %s"
        cursor.execute(delete_sql, (main_row['id'],))
        print(f"Deleted from MainTable: ID={main_row['id']} Barcode={main_row['barcode_num']}")

        # 트랜잭션 커밋
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({"message": f"Barcode {barcode_num} processed successfully."}), 200

    except Exception as e:
        print("Error in /complete-outbound POST:", e)
        # 트랜잭션 롤백
        connection.rollback()
        return jsonify({"error": str(e)}), 500

# 이미지 파일 제공을 위한 라우트
@app.route('/uploads/<filename>')
def serve_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# 출고 상태 조회 엔드포인트 정의 (필요 시)
@app.route("/outbound-status", methods=["GET"])
def get_outbound_status():
    """
    1) 검색어를 받아 MainTable에서 필터링된 데이터를 반환
    """
    search_text = request.args.get("searchText", "").strip()
    try:
        # 데이터 필터링
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        if search_text:
            filtered_query = """
                SELECT 
                    id,
                    company_name,
                    product_name,
                    inbound_quantity,
                    warehouse_location,
                    warehouse_type,
                    outbound_status,
                    outbound_date,
                    last_outbound_date
                FROM MainTable
                WHERE company_name LIKE %s
                   OR warehouse_location LIKE %s
                   OR outbound_status LIKE %s
            """
            like_pattern = f"%{search_text}%"
            cursor.execute(filtered_query, (like_pattern, like_pattern, like_pattern))
        else:
            filtered_query = """
                SELECT 
                    id,
                    company_name,
                    product_name,
                    inbound_quantity,
                    warehouse_location,
                    warehouse_type,
                    outbound_status,
                    outbound_date,
                    last_outbound_date
                FROM MainTable
            """
            cursor.execute(filtered_query)

        rows = cursor.fetchall()
        cursor.close()
        connection.close()

        # 필요한 컬럼만 반환
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
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

# 기존 출고 관련 라우트는 필요에 따라 추가/수정할 수 있습니다.

if __name__ == "__main__":
    # Flask 서버 실행
    app.run(host="0.0.0.0", port=5031, debug=True)
