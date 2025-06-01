
#내일 다시해봐야지 서버에는 업데이트한내용이고 여기는 업데이트 전 버젼으로 저장함

# server.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import cv2
import base64
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
from pyzbar.pyzbar import decode
import numpy as np
import mysql.connector
import redis
from ultralytics import YOLO

# -------------------------------
# [서버 기본 설정]
# -------------------------------
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# 서버에서 이미지 저장 폴더
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# YOLO 모델 경로
MODEL_PATH = os.path.join(BASE_DIR, 'best.pt')

# -------------------------------
# [전역 플래그: 파랑(conf≥0.6) 검출 후 한 번만 캡처]
# -------------------------------
capture_done = False  # 파랑박스(높은 신뢰도) 캡처가 이미 이뤄졌는지 여부

# -------------------------------
# [Redis 연결 (중복 바코드 체크용)]
# -------------------------------
try:
    redis_client = redis.Redis(host='localhost', port=6379, db=0)
    redis_client.ping()
    print("✅ Redis 연결 성공")
except Exception as e:
    print(f"❌ Redis 연결 실패: {e}")
    redis_client = None
    recognized_set = set()  # Redis가 없을 경우 임시 Python set 사용

# -------------------------------
# [MySQL 연결 정보 및 테이블 생성]
# -------------------------------
DB_CONFIG = {
    "host": "연결호스트",
    "user": "사용자이름",
    "password": "비밀번호",
    "database": "데이터베이스이름"
}

def ensure_mysql_table():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS BarcodeLogs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                barcode_num VARCHAR(255),
                detected_at DATETIME,
                image_path VARCHAR(255)
            )
        """)
        connection.commit()
        cursor.close()
        connection.close()
        print("✅ MySQL 테이블 확인/생성 완료")
    except Exception as e:
        print(f"❌ MySQL 테이블 생성 실패: {e}")

ensure_mysql_table()

# -------------------------------
# [YOLO 모델 로드]
# -------------------------------
try:
    model = YOLO(MODEL_PATH)
    print("✅ YOLO 모델 로드 성공!")
except Exception as e:
    print(f"❌ YOLO 모델 로드 실패: {str(e)}")
    model = None

# -------------------------------
# [바코드 디코딩 함수 - pyzbar]
# -------------------------------
def decode_barcodes(image_bgr):
    """
    Pyzbar로 바코드를 디코딩하고 결과 리스트를 반환.
    """
    results = []
    try:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        barcodes = decode(gray)
        for b in barcodes:
            data = b.data.decode('utf-8')
            x, y, w, h = b.rect
            results.append({
                'barcode_num': data,
                'x1': x,
                'y1': y,
                'x2': x + w,
                'y2': y + h
            })
    except Exception as e:
        print(f"decode_barcodes error: {e}")
    return results

# -------------------------------
# [YOLO + 바코드 검출 함수]
# -------------------------------
def detect_and_decode_barcode(image_bgr):
    """
    YOLO로 바코드(객체) 탐지 + conf>=0.6 시 저장 & pyzbar 디코딩
    """
    global capture_done
    if model is None:
        return []

    # YOLO 검출
    results = model(image_bgr)
    detections = results[0].boxes.xyxy.cpu().numpy()  # [x1, y1, x2, y2, conf, cls]

    decoded_list = []  # 클라이언트에 보내줄 바운딩 박스 정보
    high_conf_detected = False  # 파랑(conf≥0.6) 감지 여부

    for *xyxy, conf, cls in detections:
        x1, y1, x2, y2 = map(int, xyxy)
        confidence = float(conf)

        # 시각화용 바운딩박스 정보
        det_dict = {
            'barcode_num': None,  # pyzbar 결과
            'x1': x1,
            'y1': y1,
            'x2': x2,
            'y2': y2,
            'confidence': confidence
        }

        # 파랑박스 여부
        if confidence < 0.3:
            det_dict['color'] = 'red'
        elif confidence < 0.7:
            det_dict['color'] = 'yellow'
        else:
            det_dict['color'] = 'blue'
            high_conf_detected = True

        print(f"🎯 감지된 박스: conf={confidence:.2f}, 색상={det_dict['color']}")
        
        decoded_list.append(det_dict)

    # -----------------------------
    # 파랑(conf≥0.6) 첫 발견 시 → 이미지 1장 저장 + pyzbar 디코딩 + DB 저장
    # -----------------------------
    if high_conf_detected and not capture_done:
        capture_done = True  # 이후에는 추가 저장 안 함
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"capture_{timestamp}.jpg"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        cv2.imwrite(filepath, image_bgr)
        print(f"🖼️ 파랑(conf>=0.6) 발견, 이미지 한 장 저장 완료: {filepath}")

        # 저장된 전체 이미지에서 바코드 디코딩
        barcodes = decode_barcodes(image_bgr)

        # 중복 방지를 위해 Redis / 임시 set으로 체크
        for bc in barcodes:
            bc_num = bc['barcode_num']
            already_seen = False
            if redis_client:
                already_seen = redis_client.sismember("recognized_barcodes", bc_num)
            else:
                already_seen = (bc_num in recognized_set)

            if not already_seen:
                # DB 저장
                try:
                    conn = mysql.connector.connect(**DB_CONFIG)
                    cur = conn.cursor()
                    insert_sql = """
                        INSERT INTO BarcodeLogs (barcode_num, detected_at, image_path)
                        VALUES (%s, %s, %s)
                    """
                    cur.execute(insert_sql, (bc_num, datetime.now(), filename))
                    conn.commit()
                    cur.close()
                    conn.close()
                    print(f"✅ DB 저장 완료: 바코드={bc_num}")
                except Exception as e:
                    print(f"❌ DB 저장 실패: {e}")

                # Redis/Set에 등록
                if redis_client:
                    redis_client.sadd("recognized_barcodes", bc_num)
                else:
                    recognized_set.add(bc_num)
            else:
                print(f"이미 저장된 바코드: {bc_num}, DB 저장 생략")

    return decoded_list

# -------------------------------
# [SocketIO 이벤트: 클라이언트 연결/해제]
# -------------------------------
@socketio.on('connect')
def on_connect():
    print("클라이언트 연결됨")

@socketio.on('disconnect')
def on_disconnect():
    print("클라이언트 연결 해제")

# -------------------------------
# [SocketIO 이벤트: 프레임 수신 -> YOLO 검출 -> 결과 반환]
# -------------------------------
@socketio.on('frame')
def handle_frame(data):
    """
    클라이언트에서 Base64 JPEG 이미지를 0.5초 간격으로 보내줌.
    """
    try:
        # data: "data:image/jpeg;base64,~~~~"
        if not isinstance(data, str) or "base64," not in data:
            raise ValueError("받은 데이터가 Base64 문자열이 아닙니다.")

        header, encoded = data.split(",", 1)
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # YOLO + 바코드 디코딩 수행 (파랑 박스 검출 시 한 장만 저장)
        detections = detect_and_decode_barcode(frame_bgr)

        # 결과(바운딩박스들)를 클라이언트에 emit
        # 예: [{barcode_num, x1, y1, x2, y2, confidence, color}, ...]
        emit("barcode-detection", detections)

    except Exception as e:
        print(f"[handle_frame] 에러: {e}")
        emit("barcode-detection", {"error": str(e)})

# -------------------------------
# [정적 파일 제공: 저장된 이미지]
# -------------------------------
@app.route('/uploads/<filename>')
def serve_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# -------------------------------
# [서버 실행]
# -------------------------------
if __name__ == '__main__':
    import eventlet
    import eventlet.wsgi
    # debug=True 시 코드 수정 즉시 반영
    socketio.run(app, host="0.0.0.0", port=5032, debug=True)
