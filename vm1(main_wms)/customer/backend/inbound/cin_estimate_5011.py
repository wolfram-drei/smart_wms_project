from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from datetime import datetime
import pandas as pd
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

# 데이터베이스 설정
DB_CONFIG = {
    'host': '연결호스트',
    'user': '사용자이름',
    'password': '비밀번호',
    'database': '데이터베이스이름',
}

# 사용자 정보 조회 요청
def get_user_info_from_5010(token):
    try:
        res = requests.get(
            "http://34.64.211.3:5010/api/user-info",
            cookies={"accessToken": token}
        )
        if res.status_code == 200:
            return res.json()
        else:
            print("사용자 정보 요청 실패:", res.json())
            return None
    except Exception as e:
        print("5010 사용자 정보 요청 에러:", str(e))
        return None


# 견적 데이터 저장 API
@app.route("/add_inbound_estimate", methods=["POST"])
def add_inbound_estimate():
    connection = None
    cursor = None
    try:
        data = request.json
        print("Received data:", data)

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
        
        # 사용자 정보 가져오기 (5010번 API)
        user_info = get_user_info_from_5010(token)
        if not user_info:
            return jsonify({"error": "사용자 정보 조회 실패"}), 500

        # 필수 필드 검증
        required_fields = [
            "product_name", "category", "width_size", "length_size", "height_size",
            "weight", "inbound_quantity", "warehouse_type",
            "subscription_inbound_date", "outbound_date"
        ]
        for field in required_fields:
            if field not in data or data[field] is None:
                return jsonify({"error": f"'{field}' is required"}), 400

        # 데이터 변환 및 준비
        width_size = int(data["width_size"])
        length_size = int(data["length_size"])
        height_size = int(data["height_size"])
        weight = float(data["weight"])
        inbound_quantity = int(data["inbound_quantity"])
        subscription_inbound_date = datetime.strptime(data["subscription_inbound_date"], "%Y-%m-%d")
        outbound_date = datetime.strptime(data["outbound_date"], "%Y-%m-%d")

        # DB 연결 및 데이터 저장
        print("📦 DB 연결 시도 중...")
        connection = mysql.connector.connect(**DB_CONFIG)
        print("✅ DB 연결 성공!")
        cursor = connection.cursor()

        # MainTable 저장 (사용자 이메일 포함)
        main_query = """
            INSERT INTO MainTable (
                email, user_id, company_name, contact_person, contact_phone, address,
                product_name, category, width_size, length_size, height_size, weight, 
                inbound_quantity, warehouse_type, subscription_inbound_date, outbound_date, inbound_status
            )
            VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            )
        """

        main_values = (
            user_email, user_info.get("user_id"), user_info.get("company_name"),
            user_info.get("contact_person"), user_info.get("contact_phone"), user_info.get("address"),
            data["product_name"], data["category"], width_size, length_size, height_size, weight,
            inbound_quantity, data["warehouse_type"],
            subscription_inbound_date, outbound_date, "입고 준비"
        )
        cursor.execute(main_query, main_values)
        connection.commit()
        return jsonify({"message": "데이터가 성공적으로 저장되었습니다."}), 201

    except Exception as e:
        print(f"Error inserting data: {e}")  # 상세 오류 출력
        return jsonify({"error": f"Failed to save data: {str(e)}"}), 500
    
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5011, debug=True)
