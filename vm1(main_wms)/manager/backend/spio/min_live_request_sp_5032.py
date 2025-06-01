# app.py

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
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
import uuid  # 고유 ID 생성용
import base64
import eventlet

# Flask 애플리케이션 초기화
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# GCP 환경의 경로 설정
BASE_DIR = '/var/human/wms/manager/backend/inbound'  # 실제 경로로 수정
UPLOAD_FOLDER = '/var/human/wms/manager/backend/spio/uploads'  # 실제 경로로 수정

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
MODEL_PATH = os.path.join(BASE_DIR, 'best_model.pt')
try:
    model = torch.hub.load('ultralytics/yolov5', 'custom', path=MODEL_PATH, trust_repo=True)
    model.eval()
    print("YOLO 모델 로드 성공")
except Exception as e:
    print(f"YOLO 모델 로드 실패: {str(e)}")
    model = None

# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "MySQL 호스트",       
    "user": "MySQL 사용자 이름",              
    "password": "MySQL 비밀번호",           
    "database": "MySQL 데이터베이스 이름",       
}

# 바코드 디코딩 함수 (딕셔너리 반환, 전처리 포함)
def decode_barcodes_to_dicts(image):
    try:
        # 이미지 전처리: 그레이스케일 변환
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # 적응형 임계값 처리 (이진화)
        binary_img = cv2.adaptiveThreshold(gray, 255,
                                          cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                          cv2.THRESH_BINARY, 11, 2)

        # 노이즈 제거를 위한 블러링
        denoised_img = cv2.GaussianBlur(binary_img, (3, 3), 0)

        # 추가 전처리 단계: 확대, 블러, 샤프닝, 대비 향상
        resized_img = cv2.resize(denoised_img, None, fx=2.0, fy=2.0)
        blurred_img = cv2.GaussianBlur(resized_img, (5, 5), 0)
        sharpened_img = cv2.filter2D(blurred_img, -1, np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]]))
        equalized_img = cv2.equalizeHist(sharpened_img)

        # 디코딩 시도
        barcodes = decode(equalized_img)
        decoded_results = []
        for barcode in barcodes:
            try:
                barcode_data = barcode.data.decode('utf-8')
                barcode_type = barcode.type
                decoded_results.append({
                    'barcode_num': barcode_data,
                    'inbound_status': "valid" if barcode_data.startswith('CONTRACT') else "invalid",
                    'x1': barcode.rect.left,
                    'y1': barcode.rect.top,
                    'x2': barcode.rect.left + barcode.rect.width,
                    'y2': barcode.rect.top + barcode.rect.height,
                    'confidence': barcode.rect.width * barcode.rect.height  # 임시 신뢰도 계산
                })
                print(f"디코딩 성공: {barcode_data}, 타입: {barcode_type}")
            except Exception as e:
                print(f"바코드 데이터 처리 중 에러: {str(e)}")
        return decoded_results  # 디코딩 성공 시 반환
    except Exception as e:
        print(f"decode_barcodes_to_dicts 에러: {str(e)}")
        return []
    
# YOLO를 이용한 바코드 검출 및 디코딩 함수
def detect_barcodes_yolo(image, original_filename):
    try:
        # 1. 디버깅 로그 출력
        print(f"UPLOAD_FOLDER: {UPLOAD_FOLDER}")
        print(f"Original filename: {original_filename}")

        # 2. 파일 이름 안전하게 변환
        safe_filename = secure_filename(original_filename)
        if not safe_filename:
            raise ValueError("Invalid filename provided")
        print(f"Safe filename: {safe_filename}")

        # 3. 파일 경로 생성
        upload_path = os.path.join(UPLOAD_FOLDER, safe_filename)
        print(f"Upload path: {upload_path}")

        # 4. 이미지 데이터 유효성 검사
        if image is None:
            raise ValueError("Received image is None")
        if not isinstance(image, np.ndarray):
            raise TypeError(f"Expected image to be a numpy array, but got {type(image)}")
        if len(image.shape) != 3 or image.shape[2] != 3:
            raise ValueError(f"Expected image to have 3 channels (BGR), but got shape {image.shape}")

        # 5. 이미지 저장 시도
        success = cv2.imwrite(upload_path, image)
        if not success:
            raise IOError(f"Failed to save image to {upload_path}")
        print(f"원본 이미지 저장됨: {upload_path}")

        # 6. YOLO 모델로 바코드 영역 탐지
        if model is None:
            print("YOLO 모델이 로드되지 않았습니다.")
            return {'decoded_codes': [], 'count': 0, 'result_image': None}

        results = model(image)
        predictions = results.pred[0]
        predictions = predictions.cpu().numpy() if predictions is not None else []
        print(f"YOLO 감지된 객체 수: {len(predictions)}")
        for det in predictions:
            print(f"Detected object: {det}")

        # 7. 결과 이미지 준비 (디버깅 용도)
        top_padding = 60  # 결과 이미지용 패딩
        height, width = image.shape[:2]
        result_image = np.ones((height + top_padding, width, 3), dtype=np.uint8) * 255
        result_image[top_padding:, :] = image

        # 8. YOLO 바운딩 박스 별로 디코딩 시도
        decoded_codes = []
        seen_data = set()

        for det in predictions:
            x1, y1, x2, y2, conf, cls = det
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            print(f"Processing bounding box: x1={x1}, y1={y1}, x2={x2}, y2={y2}, confidence={conf}, class={cls}")

            # 바코드 영역 잘라내기
            cropped = image[y1:y2, x1:x2]

            # 바코드 영역 디코딩
            cropped_barcodes = decode_barcodes_to_dicts(cropped)
            if not cropped_barcodes:
                print(f"바코드 영역 {x1},{y1},{x2},{y2}에서 디코딩 실패")
            else:
                for barcode in cropped_barcodes:
                    barcode_data = barcode['barcode_num']
                    barcode_type = barcode['inbound_status']
                    if barcode_data not in seen_data and barcode['inbound_status'] == "valid":
                        seen_data.add(barcode_data)
                        print(f"YOLO 탐지 기반 디코딩 성공: {barcode_data}")

                        # 바운딩 박스 표시 (파란색) - 디버깅용 이미지에만 적용
                        cv2.rectangle(result_image,
                                      (x1, y1 + top_padding),
                                      (x2, y2 + top_padding),
                                      (255, 0, 0), 2)

                        # 텍스트 표시 (디버깅용 이미지에만 적용)
                        text = f"{barcode_data} ({barcode_type})"
                        font = cv2.FONT_HERSHEY_SIMPLEX
                        font_scale = 0.8
                        thickness = 2

                        (text_width, text_height), _ = cv2.getTextSize(text, font, font_scale, thickness)
                        padding = 5
                        text_y = y1 + top_padding - text_height - padding
                        text_y = max(text_y, padding)  # 텍스트가 이미지 밖으로 나가지 않도록 조정

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

                        # Append detection with bounding box info
                        decoded_codes.append({
                            'barcode_num': barcode_data,
                            'inbound_status': barcode_type,
                            'x1': x1,
                            'y1': y1,  # top_padding 제거
                            'x2': x2,
                            'y2': y2,  # top_padding 제거
                            'confidence': conf
                        })

        # 9. 결과 이미지 저장 (디버깅 용도)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = uuid.uuid4().hex  # 고유 ID 추가
        result_filename = f"result_{unique_id}_{timestamp}.jpg"
        result_path = os.path.join(UPLOAD_FOLDER, result_filename)
        success_save = cv2.imwrite(result_path, result_image)
        if not success_save:
            print(f"결과 이미지 저장 실패: {result_path}")
        else:
            print(f"결과 이미지 저장됨: {result_path}")

        return {
            'decoded_codes': decoded_codes,
            'count': len(decoded_codes),
            'result_image': result_filename
        }
    except Exception as e:
        print(f"detect_barcodes_yolo 에러: {e}")
        return {'decoded_codes': [], 'count': 0, 'result_image': None}

# WebSocket 이벤트 핸들러
@socketio.on('connect')
def handle_connect():
    print("클라이언트가 연결되었습니다.")

@socketio.on('disconnect')
def handle_disconnect():
    print("클라이언트가 연결을 끊었습니다.")
"""
@socketio.on('frame')
def handle_frame(data):
   
    클라이언트로부터 받은 프레임을 처리하고 결과를 반환

    try:
        print("Received frame data")
        # Base64 인코딩된 이미지 디코딩
        header, encoded = data.split(",", 1)
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            print("Received image is None")
            emit("barcode-detection", {"error": "Invalid image data"})
            return

        # 바코드 감지 및 디코딩 (YOLO 통합)
        original_filename = f"upload_{uuid.uuid4().hex}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        detection_result = detect_barcodes_yolo(image, original_filename)

        decoded_barcodes = detection_result.get('decoded_codes', [])
        print(f"디코딩된 바코드 수: {len(decoded_barcodes)}개")

        if not decoded_barcodes:
            emit("barcode-detection", [])
            return

        # 바코드 데이터 필터링 및 유효성 검증 (모든 바코드 전송)
        valid_barcodes = decoded_barcodes
        if not valid_barcodes:
            emit("barcode-detection", [])
            return

        # 데이터베이스 연결
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)

        # 트랜잭션 시작
        connection.start_transaction()

        result_barcodes = []

        for barcode in valid_barcodes:
            barcode_num = barcode['barcode_num']

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
                insert_sql = 
                    INSERT INTO Sm_Phone_Inbound (
                        company_name, product_name, product_number, inbound_quantity, warehouse_type, 
                        warehouse_location, pallet_size, pallet_num, barcode_num, barcode, inbound_status
                    ) VALUES (
                        %(company_name)s, %(product_name)s, %(product_number)s, %(inbound_quantity)s, %(warehouse_type)s, 
                        %(warehouse_location)s, %(pallet_size)s, %(pallet_num)s, %(barcode_num)s, %(barcode)s, '입고 준비'
                    )
                
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
            emit("barcode-detection", [])
            return

        # Decimal과 datetime을 JSON 직렬화 가능한 형태로 변환
        for barcode in result_barcodes:
            for key, value in barcode.items():
                if isinstance(value, Decimal):
                    barcode[key] = float(value)
                elif isinstance(value, datetime):
                    barcode[key] = value.isoformat()
                elif value is None:
                    barcode[key] = ""

        # 탐지된 바코드 정보와 바운딩 박스 정보 전송
        emit("barcode-detection", result_barcodes)

    except Exception as e:
        print("handle_frame 에러:", e)
        emit("barcode-detection", {"error": str(e)})
        """
@socketio.on('frame')
def handle_frame(data):
    try:
        print("Received frame data")
        # 데이터 타입 확인
        if not isinstance(data, str):
            raise ValueError("Invalid data type received. Expected string.")
        
        # Base64 데이터 디코딩
        header, encoded = data.split(",", 1)
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Failed to decode image from Base64 string.")

        # YOLO 및 바코드 디코딩 처리
        original_filename = f"upload_{uuid.uuid4().hex}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        detection_result = detect_barcodes_yolo(image, original_filename)
        decoded_barcodes = detection_result.get('decoded_codes', [])

        emit("barcode-detection", decoded_barcodes)

    except Exception as e:
        print(f"handle_frame 에러: {e}")
        emit("barcode-detection", {"error": str(e)})

# 이미지 파일 제공을 위한 라우트
@app.route('/uploads/<filename>')
def serve_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == "__main__":
    # Flask 서버 실행 (WebSocket 지원을 위해 eventlet 사용)
    socketio.run(app, host="0.0.0.0", port=5032, debug=True)
