# src/apis/outbound_ready_list.py
from flask import Blueprint, request, jsonify
import mysql.connector

bp_outbound_ready_list = Blueprint('outbound_ready_list', __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}

@bp_outbound_ready_list.route('/api/outbound/ready-list', methods=['GET'])
def ready_list():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                id,
                company_name,
                contact_person,
                contact_phone,
                category,
                warehouse_type,
                warehouse_num,
                barcode,
                barcode_num,
                outbound_status,
                last_outbound_date,
                warehouse_location,
                weight,
                width_size,
                length_size
            FROM Smart_Phone_Outbound
            WHERE outbound_status = '출고 준비 완료'
        """)
        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(rows), 200

    except Exception as e:
        print('❌ 서버 오류:', e)
        return jsonify({"error": "Server error"}), 500