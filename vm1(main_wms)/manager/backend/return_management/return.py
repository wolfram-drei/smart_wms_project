from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
from datetime import datetime
from werkzeug.utils import secure_filename
import os
import json
from tensorflow.keras.models import load_model
from PIL import Image 
import io 
import numpy as np

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'return_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}
def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

# CNN 모델 불러오기 (예: TensorFlow/Keras 모델)
model = load_model('model/defect_classifier.h5')

def preprocess_image(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img = img.resize((224, 224))  # ← 모델 입력 크기에 맞게 수정
    img_array = np.array(img) / 255.0
    return np.expand_dims(img_array, axis=0)

# ✅ 백엔드 수정 (Flask)
# 주요 수정: backup_id 필드 처리 추가
@app.route('/submit-return', methods=['POST'])
def submit_return():
    try:
        data = request.form.get('returns')
        if not data:
            return jsonify({'error': '반품 데이터 없음'}), 400

        returns = json.loads(data)
        conn = get_db_connection()
        cursor = conn.cursor()

        result = []

        for i, item in enumerate(returns):
            image_key = f'image_{i}'
            image_url = None

            if image_key in request.files:
                image_file = request.files[image_key]
                filename = secure_filename(image_file.filename)
                path = os.path.join(UPLOAD_FOLDER, filename)
                image_file.save(path)
                image_url = f'/return_uploads/{filename}'

            sql = """
                INSERT INTO returns (outbound_id, return_type, return_quantity, remark, image_url, is_market_return, created_at, backup_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql, (
                item['outbound_id'],
                item['return_type'],
                item['return_quantity'],
                item.get('remark'),
                image_url,
                item.get('is_market_return', 'X'),
                datetime.now(),
                item.get('backup_id')
            ))

            result.append({'outbound_id': item['outbound_id']})

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': '반품 등록 완료', 'data': result}), 200

    except Exception as e:
        print("\u274c 서버 오류:", e)
        return jsonify({'error': '서버 오류'}), 500

@app.route('/get-returns', methods=['GET'])
def get_returns():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM returns ORDER BY created_at DESC")
        data = cursor.fetchall()

        print("📦 불러온 반품 데이터:", data)  # ✅ 로그 추가

        cursor.close()
        conn.close()

        return jsonify({'returns': data}), 200

    except Exception as e:
        print("❌ 조회 오류:", e)
        return jsonify({'error': '조회 실패'}), 500

@app.route('/get-completed-backups', methods=['GET'])
def get_completed_backups():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 출고완료 상태인 OutboundRequestTable 데이터 조회
        cursor.execute("SELECT id, product_name, company_name FROM OutboundRequestTable WHERE outbound_status = '출고완료'")
        data = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({'backups': data}), 200

    except Exception as e:
        print("❌ 출고완료 항목 조회 오류:", e)
        return jsonify({'error': '조회 실패'}), 500


@app.route('/get-backup-detail/<int:backup_id>', methods=['GET'])
def get_backup_detail(backup_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM OutboundRequestTable WHERE id = %s", (backup_id,))
        data = cursor.fetchone()
        cursor.close()
        conn.close()

        if data:
            return jsonify({'detail': data}), 200
        else:
            return jsonify({'error': '해당 ID가 존재하지 않음'}), 404

    except Exception as e:
        print("❌ 상세조회 오류:", e)
        return jsonify({'error': '서버 오류'}), 500

@app.route('/predict-defect', methods=['POST'])
def predict_defect():
    print("✅ 예측 요청 시작")
    if 'image' not in request.files:
        print("❌ 이미지 파일 없음")
        return jsonify({'error': '이미지 필요'}), 400

    try:
        image_file = request.files['image']
        input_tensor = preprocess_image(image_file.read())
        pred = model.predict(input_tensor)
        result = '불량' if pred[0][0] > 0.5 else '정상'
        print(f"✅ 예측 결과: {result}, 신뢰도: {pred[0][0]}")
        return jsonify({'prediction': result, 'confidence': float(pred[0][0])}), 200
    except Exception as e:
        print("❌ 예측 중 오류:", e)
        return jsonify({'error': '서버 오류', 'message': str(e)}), 500

@app.route('/delete-return/<int:return_id>', methods=['DELETE'])
def delete_return(return_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM returns WHERE id = %s", (return_id,))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': '반품 삭제 완료'}), 200

    except Exception as e:
        print("❌ 삭제 오류:", e)
        return jsonify({'error': '삭제 실패'}), 500

@app.route('/update-return', methods=['PUT'])
def update_return():
    try:
        data = request.get_json()

        conn = get_db_connection()
        cursor = conn.cursor()

        sql = """
            UPDATE returns
            SET return_type = %s,
                return_quantity = %s,
                remark = %s,
                is_market_return = %s
            WHERE id = %s
        """

        cursor.execute(sql, (
            data['return_type'],
            data['return_quantity'],
            data.get('remark'),
            data.get('is_market_return', 'X'),
            data['id']
        ))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': '반품 수정 완료'}), 200

    except Exception as e:
        print("❌ 수정 오류:", e)
        return jsonify({'error': '수정 실패'}), 500

@app.route('/return_uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5100)
