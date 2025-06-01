from flask import Flask, jsonify, request
import pandas as pd
from flask_cors import CORS
import os
import mysql.connector
import numpy as np
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
            "http://34.64.211.3:5003"
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


# 데이터베이스에서 데이터 로드
def load_data_from_db():
    connection = mysql.connector.connect(**DB_CONFIG)
    query = "SELECT * FROM BackupTable"  # 테이블 이름
    df = pd.read_sql(query, connection)
    print(df)  # 디버깅: 데이터 확인
    connection.close()
    return df

# 데이터 로드 (서버 시작 시 데이터 로드)
data_df = load_data_from_db()


@app.route("/refresh-outbound-status", methods=["POST"])
def refresh_outbound_status():
    """
    데이터베이스에서 데이터를 다시 로드
    """
    try:
        token = request.cookies.get("accessToken")
        if not token:
            return jsonify({"error": "Authorization token is required"}), 401

        try:
            decoded = decode(token, SECRET_KEY, algorithms=["HS256"])
            user_email = decoded.get("sub")
        except ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        global data_df
        data_df = load_data_from_db()
        return jsonify({"message": "outbound status data refreshed successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to refresh outbound status data: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5014, debug=True)