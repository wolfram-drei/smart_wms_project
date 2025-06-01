# src/apis/outbound_delivery_request.py
from flask import Blueprint, request, jsonify
import mysql.connector

bp_delivery_list = Blueprint('delivery_list', __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}

# ✅ 배차 신청 리스트 조회
@bp_delivery_list.route('/api/outbound/delivery-request-list', methods=['GET'])
def delivery_request_list():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT id, barcode_num, company_name, last_outbound_date, outbound_status,
                   category,warehouse_type,warehouse_location,warehouse_num,contact_phone,contact_person,address
            FROM Smart_Phone_Outbound
            WHERE outbound_status = '배차 신청'
            ORDER BY id DESC
        """
        cursor.execute(query)
        results = cursor.fetchall()

        return jsonify(results), 200

    except Exception as e:
        print(f"❌ Error in delivery_request_list: {e}")
        return jsonify({'error': 'Internal Server Error'}), 500

    finally:
        cursor.close()
        conn.close()
