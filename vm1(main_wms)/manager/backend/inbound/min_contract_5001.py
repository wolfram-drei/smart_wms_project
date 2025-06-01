from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import mysql.connector
from urllib.parse import unquote
import os
from barcode import Code128
from barcode.writer import ImageWriter
import numpy as np

# JWT 인증 관련련
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from config import SECRET_KEY, DB_CONFIG
import jwt

app = Flask(__name__)
CORS(app, supports_credentials=True, resources={
    r"/*": {
        "origins": ["http://34.64.211.3:3001"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

@app.route("/api/inbound/protected", methods=["GET"])
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


def load_data_from_db(query=None):
    """SQL 쿼리에서 데이터를 필터링하여 로드"""
    try:
        print("DB 연결 시도...")  # 디버깅 로그 추가
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        print("DB 연결 성공")  # 디버깅 로그 추가
        
        # MainTable에서 전체 조회
        sql_query = "SELECT * FROM MainTable"
        print(f"실행할 쿼리: {sql_query}")  # 디버깅 로그 추가
        
        # 검색 조건 추가
        if query:
            search_term = f"%{query}%"
            # CONCAT_WS에 포함할 컬럼들을 MainTable 기준으로 변경
            # 예: id, company_name, product_name, warehouse_location, warehouse_type, contract_date
            sql_query += " WHERE CONCAT_WS(' ', id, company_name, product_name, warehouse_location, warehouse_type, contract_date) LIKE %s"
            print(f"검색 조건 추가된 쿼리: {sql_query}")  # 디버깅 로그 추가
            cursor.execute(sql_query, (search_term,))
        else:
            cursor.execute(sql_query)
        
        # 결과 가져오기
        results = cursor.fetchall()
        print(f"조회된 데이터 수: {len(results)}")
        
        # DataFrame 변환
        df = pd.DataFrame(results)
        
        # contract_date 처리
        if 'contract_date' in df.columns:
            df['contract_date'] = pd.to_datetime(df['contract_date'], errors='coerce')
            df['contract_date'] = df['contract_date'].apply(
                lambda x: x.strftime('%Y-%m-%d') if pd.notnull(x) else None
            )
        
        # NaN 값을 None으로 변환
        df = df.replace({np.nan: None})
        
        cursor.close()
        connection.close()
        
        return df
    except Exception as e:
        print(f"DB 연결/조회 에러: {str(e)}")
        return None
    

# 바코드 숫자로 구성
def generate_barcode(contract_id):
    try:
        # 바코드 저장 디렉토리 설정
        barcode_dir = '/home/wms/work/manager/backend/inbound/barcode'
        
        # 바코드에 들어갈 텍스트 생성 (숫자만, 3자리 패딩)
        barcode_text = str(contract_id) 
        
        # 파일명 설정
        filename = f"barcode{barcode_text}"
        barcode_path = os.path.join(barcode_dir, filename)
        
        # Code128 바코드 생성
        code = Code128(barcode_text, writer=ImageWriter())
        
        # 바코드 이미지 저장
        filepath = code.save(barcode_path)

        if not os.path.exists(filepath):
            raise Exception(f"파일 저장 실패: {filepath}")
        
        # DB 업데이트
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        update_query = """
            UPDATE MainTable 
            SET barcode = %s, barcode_num = %s 
            WHERE id = %s
        """
        cursor.execute(update_query, (filepath, barcode_text, contract_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        print(f"바코드 생성 완료: {filepath}")
        return True
    except Exception as e:
        print(f"바코드 생성 에러: {str(e)}")
        return False



@app.route('/contract-status', methods=['GET'])
def get_contracts():
    """계약 목록 조회 및 필터링"""
    print("contracts 엔드포인트 호출됨")
    query = unquote(request.args.get('query', '')).lower()
    print(f"검색 쿼리: {query}")

    # DB에서 데이터 로드
    df = load_data_from_db(query)
    if df is None:
        print("데이터베이스 연결 실패")
        return jsonify({"error": "데이터베이스 연결 실패"}), 500

    try:
        # 딕셔너리로 변환
        contracts = df.to_dict(orient='records')
        print(f"반환할 데이터 수: {len(contracts)}")
        return jsonify(contracts)
    except Exception as e:
        print(f"데이터 변환 에러: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/contract-status/<int:contract_id>', methods=['GET'])
def get_contract_status_by_id(contract_id):
    connection = mysql.connector.connect(**DB_CONFIG)
    cursor = connection.cursor(dictionary=True)

    try:
        # 기존 contract-form 조인 쿼리
        query = """
            SELECT 
                cf.title,
                cf.content,
                m.estimate as terms,
                cf.signature,
                m.id,
                m.company_name,
                m.product_name,
                m.product_number,
                m.inbound_quantity,
                m.warehouse_location,
                m.warehouse_type,
                m.inbound_status,
                m.contract_date,
                m.subscription_inbound_date,
                m.outbound_date,
                m.storage_duration,
                m.warehouse_num,
                m.pallet_size,
                m.pallet_num,
                m.weight,
                m.barcode,
                m.barcode_num,
                m.total_cost
            FROM MainTable m
            LEFT JOIN ContractForms cf ON m.id = cf.contract_id
            WHERE m.id = %s
        """
        cursor.execute(query, (contract_id,))
        data = cursor.fetchone()

        if not data:
            return jsonify({"error": "계약 데이터를 찾을 수 없습니다."}), 404

        # 날짜 처리
        for col in ['contract_date', 'subscription_inbound_date', 'outbound_date']:
            if data.get(col):
                data[col] = data[col].strftime('%Y-%m-%d')
            elif col == 'contract_date':
                data[col] = '계약 대기'
            elif col == 'outbound_date':
                data[col] = '출고 대기'
            else:
                data[col] = None

        return jsonify(data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        connection.close()

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

@app.route('/images/<path:filename>')
def serve_images(filename):
    """서버의 images 디렉토리에서 파일 제공"""
    image_dir = os.path.join(os.getcwd(), 'images')
    file_path = os.path.join(image_dir, filename)

    if not os.path.exists(file_path):
        return jsonify({"error": "Image not found"}), 404

    return send_from_directory(image_dir, filename)


@app.route('/contract-form/<int:contract_id>', methods=['GET', 'POST'])
def handle_contract_form(contract_id):
    connection = mysql.connector.connect(**DB_CONFIG)
    cursor = connection.cursor(dictionary=True)
    
    try:
        if request.method == 'GET':
            # MainTable에서 견적서 정보와 계약서 정보를 함께 가져오기
            query = """
                SELECT 
                    cf.title,
                    cf.content,
                    m.estimate as terms,  # 계약 조항 대신 견적서 정보
                    cf.signature
                FROM ContractForms cf
                LEFT JOIN MainTable m ON m.id = cf.contract_id
                WHERE cf.contract_id = %s
            """
            cursor.execute(query, (contract_id,))
            form = cursor.fetchone()

            if not form:
                # 계약서가 없는 경우 견적서 정보만 가져오기
                query = "SELECT estimate FROM MainTable WHERE id = %s"
                cursor.execute(query, (contract_id,))
                estimate = cursor.fetchone()
                
                return jsonify({
                    "title": "",
                    "content": "",
                    "terms": estimate['estimate'] if estimate else "",
                    "signature": ""
                })

            return jsonify(form)
            
        elif request.method == 'POST':
            data = request.json
            print("받은 데이터:", data)
            
            # 데이터 유효성 검사
            if not all(key in data for key in ['title', 'content', 'signature']):
                return jsonify({"error": "필수 필드가 누락되었습니다."}), 400
                
            # ContractForms 테이블 업데이트 (contract_date 업데이트 제거)
            query = """
                INSERT INTO ContractForms 
                (contract_id, title, content, signature)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                content = VALUES(content),
                signature = VALUES(signature)
            """
            values = (
                contract_id,
                data.get('title'),
                data.get('content'),
                data.get('signature')
            )
            
            print("실행할 쿼리:", query)
            print("쿼리 파라미터:", values)
            
            cursor.execute(query, values)
            connection.commit()
            
            # 바코드 생성
            if generate_barcode(contract_id):
                print(f"바코드 생성 성공: contract_id={contract_id}")
            else:
                print(f"바코드 생성 실패: contract_id={contract_id}")
            
            return jsonify({
                "message": "저장 완료",
                "contract_id": contract_id,
                "barcode_url": f"/barcode/{contract_id}.png"
            }), 200
            
    except Exception as e:
        print(f"에러 발생: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
    finally:
        cursor.close()
        connection.close()

@app.route('/contract-cancel/<int:contract_id>', methods=['POST'])
def cancel_contract(contract_id):
    connection = mysql.connector.connect(**DB_CONFIG)
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("SELECT contract_date FROM MainTable WHERE id = %s", (contract_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({"error": "Contract not found"}), 404
        
        # contract_date를 NULL로 업데이트하여 다시 "계약 대기" 상태로
        cursor.execute("UPDATE MainTable SET contract_date = NULL WHERE id = %s", (contract_id,))
        connection.commit()
        
        return jsonify({"message": "계약이 취소되었습니다. 다시 '계약 대기' 상태입니다."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        connection.close()



if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5001)
