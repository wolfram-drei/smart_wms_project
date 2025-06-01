from flask import Flask, jsonify, request, send_from_directory
import os
import pandas as pd
from flask_cors import CORS
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from config import SECRET_KEY, DB_CONFIG
import jwt

app = Flask(__name__)
CORS(app, supports_credentials=True, resources={
    r"/*": {
        "origins": [
            "http://34.64.211.3:3000",
            "http://34.64.211.3:3003",
            "http://34.64.211.3:4000",
            "http://34.64.211.3:4001",
            "http://34.64.211.3:4002",  
            "http://34.64.211.3:5003"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

@app.route("/api/inventory/protected", methods=["GET"])
def protected():
    token = request.cookies.get("accessToken")
    if not token:
        return jsonify({"error": "Access token missing"}), 401
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return jsonify({
            "success": True,
            "email": decoded.get("sub"),
            "role": decoded.get("role")})
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Access token expired"}), 401
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid JWT: {str(e)}")  # 디버깅에 유용
        return jsonify({"error": "Invalid token"}), 401
    
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

@app.route('/dropdown-data', methods=['GET'])
def get_dropdown_data():
    """
    드롭다운용 유니크 필드값 반환
    """
    try:
        df = load_data_from_db()

        # 중복 제거 + 결측값 제거
        centers = df['warehouse_location'].dropna().unique().tolist()
        types = df['warehouse_type'].dropna().unique().tolist()
        regions = df['warehouse_num'].dropna().unique().tolist()

        return jsonify({
            "distribution_centers": centers,
            "functionalities": types,
            "regions": regions
        })
    except Exception as e:
        return jsonify({"error": f"Failed to fetch dropdown data: {str(e)}"}), 500
    

@app.route('/products', methods=['GET'])
def get_products():
    """
    필터 조건 및 검색어에 따른 상품 데이터 반환
    """
    try:
        data_df = load_data_from_db()  # 데이터프레임 로드
        
        # 드롭다운 필터 값 가져오기   V 여기는 리엑트에서 보낸값이 들어가야함(엉뚱하게 p_name)이런식으로 들어가있으니 필터안됨 
        center = request.args.get('center', None)
        functionality = request.args.get('functionality', None)
        region = request.args.get('region', None)

        # 추가 필터 값 가져오기
        product_number = request.args.get('productNumber', None)  # 제품번호 필터
        arrival_date = request.args.get('arrivalDate', None)  # 입고날짜 필터
        search_text = request.args.get('searchText', None)  # 서치바 검색어

        # 데이터 필터링
        filtered_df = data_df.copy()

        # 드롭다운 필터 적용
        if center:
            filtered_df = filtered_df[filtered_df['warehouse_location'] == center]
        if functionality:
            filtered_df = filtered_df[filtered_df['warehouse_type'] == functionality]
        if region:
            filtered_df = filtered_df[filtered_df['warehouse_num'] == region]


        # 제품번호 필터 적용
        if product_number:
            filtered_df = filtered_df[filtered_df['product_number'].str.contains(product_number, na=False, case=False)]

        # 입고날짜 필터 적용
        if arrival_date:
            filtered_df = filtered_df[filtered_df['inbound_date'] == arrival_date]

        # 서치바 검색어 필터 적용 (모든 컬럼 검색 가능)
        if search_text:
            filtered_df = filtered_df[
                filtered_df['product_name'].str.contains(search_text, na=False, case=False) |
                filtered_df['product_number'].str.contains(search_text, na=False, case=False)
            ]

        # 필요한 컬럼만 반환 (AgGrid에서 사용하는 컬럼)
        filtered_df = filtered_df[[
             'id', 
            'product_name',       # 상품명
            'product_number',     # 제품번호
            'inbound_quantity',     # 현재 재고량
            'warehouse_num',        # 현 위치
            'warehouse_type'      # 현 상태
        ]]

        # JSON으로 반환
        return jsonify(filtered_df.to_dict(orient='records'))
    except Exception as e:
        return jsonify({"error": f"Failed to fetch products: {str(e)}"}), 500



@app.route('/product-images/<int:product_id>', methods=['GET'])
def get_product_images(product_id):
    """
    특정 상품의 이미지 데이터 반환
    """
    try:
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
    image_dir = '/home/wms/work/manager/backend/inventory/images'
    file_path = os.path.join(image_dir, filename)

    # 파일이 존재하는지 확인
    if not os.path.exists(file_path):
        print(f"Image not found: {filename}")  # 디버깅 로그
        return jsonify({"error": "Image not found"}), 404

    return send_from_directory(image_dir, filename)



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003, debug=True)
