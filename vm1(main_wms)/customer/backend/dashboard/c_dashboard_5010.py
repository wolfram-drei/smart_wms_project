from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import mysql.connector
from datetime import datetime
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

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

DB_CONFIG = {
    'host': '연결호스트',
    'user': '사용자이름',
    'password': '비밀번호',
    'database': '데이터베이스이름',
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


@app.route('/dashboard/storage-items', methods=['GET'])
def get_storage_items():
    cursor = None  # cursor 초기화
    connection = None  # connection 초기화
    try:
        # 쿠키에서 accessToken 추출
        token = request.cookies.get("accessToken")
        print(f"Access token from cookies: {token}")
        if not token:
            return jsonify({"error": "Authorization token is required"}), 401

        try:
            # JWT 토큰 디코딩 (user_id 추출)
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            print(jwt.decode(token, SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False}))
            print(datetime.fromtimestamp(1745219334))
            user_email = decoded.get("sub")
            print(f"Extracted user_email: {user_email}")  # 디버깅 로그 추가
        except ExpiredSignatureError:
            return jsonify({"error": "Access token expired"}), 401
        except InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # DB 연결
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # 모든 상태의 물품 데이터를 가져오는 쿼리 (실제 컬럼명으로 수정)
        items_query = """
            SELECT 
                m.id, u.contact_person, u.contact_phone, u.address, u.email,
                m.company_name, m.product_name, m.product_number, m.img_inbound, m.img_pallet,
                m.category, m.warehouse_location, m.warehouse_type, m.pallet_size, m.pallet_num,
                m.width_size, m.length_size, m.height_size, m.weight, m.inbound_quantity, 
                m.inbound_status, m.outbound_status, m.subscription_inbound_date, m.outbound_date,
                m.storage_duration, m.total_cost, m.contract_date, m.estimate, m.last_outbound_date,
                m.warehouse_num
            FROM MainTable m
            JOIN users u ON u.email = m.email  
            WHERE u.email = %s  
        """
        cursor.execute(items_query, (user_email,))
        all_items = cursor.fetchall()

        # 상태별 통계 쿼리 수정
        stats_query = """
            SELECT 
                COUNT(CASE WHEN inbound_status = '입고 완료' THEN 1 END) as inbound_complete,
                COUNT(CASE WHEN inbound_status = '입고 준비' THEN 1 END) as inbound_ready,
                COUNT(CASE WHEN outbound_status = '출고요청' THEN 1 END) as outbound_request,
                COUNT(CASE WHEN outbound_status = '출고완료' THEN 1 END) as outbound_complete,
                COUNT(CASE WHEN contract_date IS NULL THEN 1 END) as contract_waiting,
                COUNT(CASE WHEN contract_date IS NOT NULL THEN 1 END) as contract_complete,
                SUM(CASE WHEN inbound_status = '입고 완료' AND 
                    (outbound_status IS NULL OR outbound_status != '출고완료') 
                    THEN total_cost ELSE 0 END) as active_total_cost
            FROM MainTable m
            JOIN users u ON u.email = m.email
            WHERE u.email = %s  -- user_id 필터링
        """
        cursor.execute(stats_query, (user_email,))
        status_counts = cursor.fetchone()
        
        # 날짜 형식 변환
        for item in all_items:
            if item['subscription_inbound_date']:
                item['subscription_inbound_date'] = item['subscription_inbound_date'].strftime('%Y-%m-%d')
            if item['outbound_date']:
                item['outbound_date'] = item['outbound_date'].strftime('%Y-%m-%d')
            if item.get('contract_date'):
                item['contract_date'] = item['contract_date'].strftime('%Y-%m-%d')
        
        # 현재 보관중인 물품만 필터링 (입고 완료되고 출고 완료되지 않은 물품)
        active_items = [
            item for item in all_items 
            if item['inbound_status'] == '입고 완료' and 
            (item.get('outbound_status') is None or item['outbound_status'] != '출고 완료')
        ]
        
        # 통계 데이터 구성
        stats = {
            'total_items': len(active_items),
            'total_cost': status_counts['active_total_cost'] or 0,
            'status_counts': {
                'inbound_complete': status_counts['inbound_complete'] or 0,
                'inbound_ready': status_counts['inbound_ready'] or 0,
                'outbound_request': status_counts['outbound_request'] or 0,
                'outbound_complete': status_counts['outbound_complete'] or 0,
                'contract_waiting': status_counts['contract_waiting'] or 0,
                'contract_complete': status_counts['contract_complete'] or 0
            },
            'storage_count': {
                '냉장': sum(1 for item in active_items if item['warehouse_type'] == '냉장'),
                '냉동': sum(1 for item in active_items if item['warehouse_type'] == '냉동'),
                '상온': sum(1 for item in active_items if item['warehouse_type'] == '상온')
            }
        }
        
        return jsonify({
            'items': active_items,
            'stats': stats,
            'all_items': all_items
        })
        
    except Exception as e:
        print(f"에러 발생: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/dashboard/recent-activities', methods=['GET'])
def get_recent_activities():
    connection = None  # connection 변수를 먼저 초기화
    cursor = None  # cursor 변수도 초기화
    try:
        # 쿠키에서 accessToken 추출
        token = request.cookies.get("accessToken")
        if not token:
            return jsonify({"error": "Authorization token is required"}), 401

        try:
            # JWT 토큰 디코딩 (user_id 추출)
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_email = decoded.get("sub")
            print(f"Extracted user_email: {user_email}")  # 디버깅 로그 추가
        except ExpiredSignatureError:
            return jsonify({"error": "Access token expired"}), 401
        except InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401


        # 최근 활동 내역 조회 (최근 5개)
        query = """
            SELECT 
                'contract' as type,
                email, company_name, product_name,
                contract_date as activity_date
            FROM MainTable
            WHERE contract_date IS NOT NULL AND email = %s
            ORDER BY contract_date DESC
            LIMIT 5
        """
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, (user_email,))  # user_id를 매개변수로 전달
        activities = cursor.fetchall()
        
        # 날짜 형식 변환
        for activity in activities:
            if activity['activity_date']:
                activity['activity_date'] = activity['activity_date'].strftime('%Y-%m-%d')
        
        return jsonify(activities)
        
    except Exception as e:
        print(f"에러 발생: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

# 사용자 정보 조회 API 추가
@app.route('/api/user-info', methods=['GET'])
def get_user_info():
    token = request.cookies.get("accessToken")
    if not token:
        return jsonify({"error": "Token required"}), 401

    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_email = decoded.get("sub")
    except ExpiredSignatureError:
        return jsonify({"error": "Access token expired"}), 401
    except InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (user_email,))
    user = cursor.fetchone()
    cursor.close()
    connection.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user)

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5010)