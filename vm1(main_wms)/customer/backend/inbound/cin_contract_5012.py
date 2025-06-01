from flask import Flask, jsonify, request, send_from_directory,send_file
from flask_cors import CORS
import pandas as pd
import mysql.connector
from urllib.parse import unquote
import os
from barcode import Code128
from barcode.writer import ImageWriter
from datetime import datetime
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

DB_CONFIG = {
    'host': '연결호스트',
    'user': '사용자이름',
    'password': '비밀번호',
    'database': '데이터베이스이름',
}

def load_data_from_db(query=None):
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        sql_query = "SELECT * FROM MainTable"
        if query:
            search_term = f"%{query}%"
            sql_query += """ WHERE CONCAT_WS(' ', 
                id, company_name, contact_person, phone_number, product_name, warehouse_location, 
                warehouse_type, contract_date) LIKE %s"""
            print(f"실행될 쿼리: {sql_query}")
            df = pd.read_sql(sql_query, connection, params=(search_term,))
        else:
            print("전체 데이터 조회")
            df = pd.read_sql(sql_query, connection)
        print(f"조회된 데이터 수: {len(df)}")
        connection.close()
        return df
    except Exception as e:
        print(f"DB 연결/로드 에러: {str(e)}")
        return None

@app.route('/contracts', methods=['GET'])
def get_contracts():
    query = unquote(request.args.get('query', '')).lower()
    df = load_data_from_db(query)
    if df is None:
        return jsonify({"error": "데이터베이스 연결 실패"}), 500
    
    token = request.cookies.get("accessToken")
    if not token:
        return jsonify({"error": "Authorization token is required"}), 401

    try:
        decoded = decode(token, SECRET_KEY, algorithms=["HS256"])
        user_email = decoded.get("sub")
    except ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    
    try:
        # contract_date 처리
        if 'contract_date' in df.columns:
            df['contract_date'] = pd.to_datetime(df['contract_date'], errors='coerce')
            df['contract_date'] = df['contract_date'].apply(
                lambda x: x.strftime('%Y-%m-%d') if pd.notnull(x) else None
            )
        
        # 모든 NaN 값을 None으로 변환
        df = df.replace({np.nan: None})

        # 딕셔너리 변환
        contracts = df.to_dict(orient='records')
        
        return jsonify(contracts)
    except Exception as e:
        print(f"예외 발생: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/contracts/<int:contract_id>', methods=['GET'])
def get_contract(contract_id):
    df = load_data_from_db()
    if df is None:
        return jsonify({"error": "데이터베이스 연결 실패"}), 500

    contract = df[df['id'] == contract_id].to_dict(orient='records')
    if contract:
        # 날짜 형식 변환
        if contract[0].get('contract_date'):
            contract[0]['contract_date'] = contract[0]['contract_date'].strftime('%Y-%m-%d')
        return jsonify(contract[0])
    return jsonify({"error": "Contract not found"}), 404

@app.route('/barcode/<contract_id>')
def get_barcode(contract_id):
    """바코드 이미지 제공"""
    image_dir = '/home/wms/work/manager/backend/inbound/barcode'
    # contract_id에서 .png 확장자를 제거하고 파일명 생성
    contract_id = contract_id.replace('.png', '')
    filename = f"barcode{contract_id}.png"
    file_path = os.path.join(image_dir, filename)

    print(f"Requested barcode path: {file_path}")  # 디버깅용

    if not os.path.exists(file_path):
        print(f"Barcode not found: {filename}")  # 디버깅용
        return jsonify({"error": "Barcode not found"}), 404

    try:
        return send_from_directory(image_dir, filename)
    except Exception as e:
        print(f"Error serving barcode: {str(e)}")  # 디버깅용
        return jsonify({"error": str(e)}), 500
    
@app.route('/contract-form/<int:contract_id>', methods=['GET', 'POST'])
def handle_contract_form(contract_id):
    connection = mysql.connector.connect(**DB_CONFIG)
    cursor = connection.cursor(dictionary=True)
    
    try:
        if request.method == 'GET':
            # 에러 처리 추가
            try:
                query = """
                    SELECT 
                        title,
                        content,
                        terms,
                        signature,
                        created_at,
                        updated_at
                    FROM ContractForms 
                    WHERE contract_id = %s
                """
                cursor.execute(query, (contract_id,))
                form_data = cursor.fetchone()
                
                if form_data:
                    # datetime 객체를 문자열로 변환
                    if form_data.get('created_at'):
                        form_data['created_at'] = form_data['created_at'].strftime('%Y-%m-%d %H:%M:%S')
                    if form_data.get('updated_at'):
                        form_data['updated_at'] = form_data['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
                    
                    return jsonify(form_data)
                else:
                    # 데이터가 없을 경우 빈 폼 반환
                    return jsonify({
                        "title": "",
                        "content": "",
                        "terms": "",
                        "signature": "",
                        "created_at": None,
                        "updated_at": None
                    })
            except Exception as e:
                print(f"계약서 조회 중 에러 발생: {str(e)}")
                return jsonify({"error": str(e)}), 500

    except Exception as e:
        print(f"전체 처리 중 에러 발생: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/approve-contract/<int:contract_id>', methods=['POST'])
def approve_contract(contract_id):
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        # 현재 날짜를 계약일로 설정
        current_date = datetime.now().strftime('%Y-%m-%d')
        update_query = """
            UPDATE MainTable 
            SET contract_date = %s 
            WHERE id = %s AND contract_date IS NULL
        """
        cursor.execute(update_query, (current_date, contract_id))
        
        if cursor.rowcount == 0:
            return jsonify({"message": "이미 승인된 계약이거나 존재하지 않는 계약입니다."}), 400
            
        connection.commit()
        return jsonify({
            "message": "계약이 승인되었습니다.",
            "contract_date": current_date
        }), 200

    except Exception as e:
        print(f"에러 발생: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/contract-form/<int:contract_id>', methods=['POST'])
def save_contract_form(contract_id):
    try:
        data = request.json
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        # 계약서 내용만 업데이트 (계약일 제외)
        update_query = """
            UPDATE ContractForms 
            SET title = %s, content = %s, terms = %s, signature = %s 
            WHERE contract_id = %s
        """
        cursor.execute(update_query, (
            data.get('title'),
            data.get('content'),
            data.get('terms'),
            data.get('signature'),
            contract_id
        ))
        
        connection.commit()
        return jsonify({"message": "계약서가 저장되었습니다."}), 200

    except Exception as e:
        print(f"에러 발생: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5012)
