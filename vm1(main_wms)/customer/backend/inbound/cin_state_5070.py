from flask import Flask, jsonify, request, send_from_directory
import os
import pandas as pd
from flask_cors import CORS
from jwt import decode, ExpiredSignatureError
import requests

# 비밀키 설정 (같은 키로 서명된 JWT만 유효함)
SECRET_KEY = "scret_key_for_jwt"

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://34.64.211.3:3000",
            "http://34.64.211.3:4000",
            "http://34.64.211.3:4001",
            "http://34.64.211.3:4002",  
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True  # 쿠키 전송을 허용
    }
})

# 데이터베이스 연결 정보
DB_CONFIG = {
    'host': '연결호스트',
    'user': '사용자이름',
    'password': '비밀번호',
    'database': '데이터베이스이름',
}


def load_data_from_db():
    """
    MariaDB에서 데이터 로드
    """
    import mysql.connector

    # 데이터베이스 연결 및 데이터 로드
    connection = mysql.connector.connect(**DB_CONFIG)
    query = "SELECT * FROM MainTable"
    df = pd.read_sql(query, connection)
    connection.close()
    return df


@app.route('/product-images/<int:product_id>', methods=['GET'])
def get_product_images(product_id):
    """
    특정 상품의 이미지 데이터 반환
    """
    try:
        # accessToken 쿠키에서 추출 → 디코딩
        token = request.cookies.get("accessToken")
        if not token:
            return jsonify({"error": "Access token required"}), 401

        try:
            decoded = decode(token, SECRET_KEY, algorithms=["HS256"])
            user_email = decoded.get("sub")
            if not user_email:
                return jsonify({"error": "Invalid token"}), 401
        except ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        
        data_df = load_data_from_db()  # 데이터프레임 로드
        
        # 데이터프레임에서 이미지 경로 찾기
        product_row = data_df[data_df['id'] == product_id]
        if product_row.empty:
            return jsonify({"error": "Product not found"}), 404

        product_image = product_row['img_inbound'].values[0]
        pallet_image = product_row['img_pallet'].values[0]

        return jsonify({
            "product_image": product_image,
            "pallet_image": pallet_image
        })
    except Exception as e:
        return jsonify({"error": f"Failed to fetch product images: {str(e)}"}), 500


@app.route('/images/<path:filename>')
def serve_images(filename):
    """
    서버의 images 디렉토리에서 파일 제공
    """
    base_dir = '/home/wms/work/manager/backend/inventory/images'
    file_path = os.path.join(base_dir, filename)

    # 파일이 존재하는지 확인
    if not os.path.exists(file_path):
        print(f"Image not found: {file_path}")  # 디버깅 로그
        return jsonify({"error": "Image not found"}), 404

    directory = os.path.dirname(file_path)
    file_name = os.path.basename(file_path)
    return send_from_directory(directory, file_name)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5070, debug=True)
