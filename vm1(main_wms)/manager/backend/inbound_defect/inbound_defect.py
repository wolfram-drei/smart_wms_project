from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from datetime import datetime
from PIL import Image
from tensorflow.keras.models import load_model
from werkzeug.utils import secure_filename
import io
import os
import numpy as np
import json


app = Flask(__name__)
CORS(app)

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

def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    image = image.resize((224, 224))
    image = np.array(image) / 255.0
    return np.expand_dims(image, axis=0)

@app.route('/predict-defect', methods=['POST'])
def predict_defect():
    print("이미지 예측 요청 받음")
    if 'image' not in request.files:
        print("이미지 파일이 없습니다.")
        return jsonify({'error': '이미지 필요'}), 400
    image_file = request.files['image']
    input_tensor = preprocess_image(image_file.read())
    pred = model.predict(input_tensor)
    result = '불량' if pred[0][0] > 0.5 else '정상'
    print(f"예측 결과: {result}")
    return jsonify({'prediction': result, 'confidence': float(pred[0][0])}), 200

@app.route('/inbound-items', methods=['GET'])
def get_inbound_items():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ✅ LEFT JOIN으로 불량 수량 합산
        cursor.execute("""
            SELECT 
                m.id,
                m.product_name AS name,
                m.inbound_quantity,
                IFNULL(SUM(d.defect_quantity), 0) AS defect_quantity,
                m.inbound_quantity - IFNULL(SUM(d.defect_quantity), 0) AS actual_quantity
            FROM MainTable m
            LEFT JOIN inbound_defects d ON m.id = d.inbound_id
            GROUP BY m.id, m.product_name, m.inbound_quantity
        """)

        items = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(items), 200

    except Exception as e:
        print("❌ 입고 품목 조회 오류:", e)
        return jsonify({'error': '입고 품목 조회 실패'}), 500


@app.route('/get-defects/<int:inbound_id>', methods=['GET'])
def get_defects(inbound_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        sql = """
            SELECT id, defect_type, defect_quantity, remark, created_at 
            FROM inbound_defects 
            WHERE inbound_id = %s
            ORDER BY created_at DESC
        """
        cursor.execute(sql, (inbound_id,))
        defects = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({'defects': defects}), 200

    except Exception as e:
        print("❌ 오류 발생:", e)
        return jsonify({'error': '서버 오류'}), 500

#이미지랑 불량 저장
@app.route('/submit-defects', methods=['POST'])
def submit_defects():
    try:
        defects_json = request.form.get('defects')
        if not defects_json:
            return jsonify({'error': '불량 데이터가 없습니다.'}), 400

        data = json.loads(defects_json)
        print("📦 받은 불량 데이터:", data)

        conn = get_db_connection()
        cursor = conn.cursor()
        result = []

        for i, item in enumerate(data):
            if item['defectType'].strip() == '정상':
                print("✅ 정상 → DB 저장 생략")
                continue

            image_key = f'image_{i}'
            image_url = None

            if image_key in request.files:
                image_file = request.files[image_key]
                filename = secure_filename(image_file.filename)
                image_path = os.path.join(UPLOAD_FOLDER, filename)
                image_file.save(image_path)
                image_url = f'/uploads/{filename}'
                print(f"✅ 이미지 저장: {image_url}")

            cursor.execute("""
                INSERT INTO inbound_defects 
                (inbound_id, defect_type, defect_quantity, remark, image_url, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                item['itemId'],
                item['defectType'],
                item['defectQuantity'],
                item['remark'],
                image_url,
                datetime.now()
            ))

            cursor.execute("SELECT inbound_quantity FROM MainTable WHERE id = %s", (item['itemId'],))
            total_quantity = cursor.fetchone()[0]

            cursor.execute("SELECT SUM(defect_quantity) FROM inbound_defects WHERE inbound_id = %s", (item['itemId'],))
            defect_quantity = cursor.fetchone()[0] or 0

            actual_quantity = total_quantity - defect_quantity

            result.append({
                'inbound_id': item['itemId'],
                'total_quantity': total_quantity,
                'defect_quantity': defect_quantity,
                'actual_quantity': actual_quantity
            })

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "불량 검수가 완료되었습니다.", "data": result}), 200

    except Exception as e:
        print("❌ 서버 오류:", e)
        return jsonify({'error': '서버 내부 오류'}), 500
    
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# 삭제
@app.route('/delete-defect/<int:defect_id>', methods=['DELETE'])
def delete_defect(defect_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 삭제할 불량 정보 가져오기
        cursor.execute("""
            SELECT inbound_id, defect_quantity 
            FROM inbound_defects 
            WHERE id = %s
        """, (defect_id,))
        defect = cursor.fetchone()

        if not defect:
            return jsonify({'error': '해당 불량 정보가 존재하지 않습니다.'}), 404

        # MainTable 수량 되돌리기
        cursor.execute("""
            UPDATE MainTable 
            SET inbound_quantity = inbound_quantity + %s 
            WHERE id = %s
        """, (defect['defect_quantity'], defect['inbound_id']))

        # 불량 데이터 삭제
        cursor.execute("""
            DELETE FROM inbound_defects 
            WHERE id = %s
        """, (defect_id,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': '불량 데이터가 삭제되었습니다.'}), 200

    except Exception as e:
        print("❌ 삭제 오류:", e)
        return jsonify({'error': '서버 내부 오류'}), 500

# 수정
@app.route('/update-defect', methods=['PUT'])
def update_defect():
    try:
        data = request.get_json()

        defect_id = data.get('defect_id')
        new_type = data.get('defect_type')
        new_quantity = int(data.get('defect_quantity'))
        new_remark = data.get('remark')

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 기존 수량 조회
        cursor.execute("""
            SELECT inbound_id, defect_quantity 
            FROM inbound_defects 
            WHERE id = %s
        """, (defect_id,))
        old = cursor.fetchone()

        if not old:
            return jsonify({'error': '불량 정보가 존재하지 않습니다.'}), 404

        inbound_id = old['inbound_id']
        old_quantity = old['defect_quantity']
        delta = new_quantity - old_quantity

        # MainTable 수량 업데이트
        cursor.execute("""
            UPDATE MainTable 
            SET inbound_quantity = inbound_quantity - %s 
            WHERE id = %s
        """, (delta, inbound_id))

        # 불량 테이블 수정
        cursor.execute("""
            UPDATE inbound_defects 
            SET defect_type = %s, defect_quantity = %s, remark = %s 
            WHERE id = %s
        """, (new_type, new_quantity, new_remark, defect_id))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': '불량 정보가 수정되었습니다.'}), 200

    except Exception as e:
        print("❌ 수정 오류:", e)
        return jsonify({'error': '서버 내부 오류'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5099)
