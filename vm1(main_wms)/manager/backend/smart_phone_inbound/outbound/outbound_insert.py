# src/apis/outbound_register.py
# Barcode_num이 일치(MainTable테이블의 바코드와 디코딩한 바코드 정보)하면 MainTable -> Smart_Phone_Outbound 테이블
# INSERT하도록 구성
from flask import Blueprint, request, jsonify
import mysql.connector

bp_outbound_insert = Blueprint('outbound_insert', __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}

@bp_outbound_insert.route('/api/outbound/insert', methods=['POST'])
def insert_outbound():
    data = request.get_json()
    barcode_num = data.get('barcode_num')

    if not barcode_num:
        return jsonify({"error": "barcode_num is required"}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # 1. MainTable에서 해당 바코드 찾기
        cursor.execute("""
            SELECT id, company_name, contact_person, contact_phone, address,
                   weight, width_size, length_size,
                   warehouse_type, category, warehouse_num,
                   barcode, barcode_num, outbound_status,
                   contract_date, last_outbound_date, warehouse_location
            FROM MainTable
            WHERE barcode_num = %s
        """, (barcode_num,))
        product = cursor.fetchone()

        if not product:
            return jsonify({"error": "MainTable에서 해당 바코드를 찾을 수 없습니다."}), 404

        # 2. Smart_Phone_Outbound에 INSERT
        cursor.execute("""
            INSERT INTO Smart_Phone_Outbound (
                company_name, contact_person, contact_phone, address,
                weight, width_size, length_size,
                warehouse_type, category, warehouse_num,
                barcode, barcode_num, outbound_status,
                contract_date, last_outbound_date, warehouse_location
            ) VALUES (
                %(company_name)s, %(contact_person)s, %(contact_phone)s, %(address)s,
                %(weight)s, %(width_size)s, %(length_size)s,
                %(warehouse_type)s, %(category)s, %(warehouse_num)s,
                %(barcode)s, %(barcode_num)s, %(outbound_status)s,
                %(contract_date)s, %(last_outbound_date)s, %(warehouse_location)s
            )
        """, product)
        conn.commit()

        return jsonify({"message": "출고 등록 완료"}), 200

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()
