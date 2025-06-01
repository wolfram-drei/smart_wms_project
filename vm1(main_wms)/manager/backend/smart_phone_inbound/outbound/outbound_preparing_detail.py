# src/apis/outbound_preparing_api.py
from flask import Blueprint, request, jsonify
import mysql.connector

bp_outbound_preparing_detail = Blueprint("outbound_preparing_detail", __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}


# 출고 준비중 단건 상세 조회
@bp_outbound_preparing_detail.route("/api/outbound/preparing-detail", methods=["GET"])
def preparing_detail():
    record_id = request.args.get("id")
    if not record_id:
        return jsonify({"error": "id is required"}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                id,
                company_name,
                contact_person,
                contact_phone,
                address,
                weight,
                width_size,
                length_size,
                warehouse_type,
                category,
                warehouse_num,
                barcode,
                barcode_num,
                outbound_status,
                contract_date,
                last_outbound_date,
                warehouse_location
            FROM Smart_Phone_Outbound
            WHERE id = %s
        """, (record_id,))
        
        row = cursor.fetchone()

        cursor.close()
        conn.close()

        if row:
            return jsonify(row), 200
        else:
            return jsonify({"error": "❌ 데이터가 없습니다."}), 404

    except Exception as e:
        print(e)
        return jsonify({"error": "Server error"}), 500

# 출고 준비중 전체 리스트 조회 (명시적 컬럼 선택)
@bp_outbound_preparing_detail.route("/api/outbound/preparing-list", methods=["GET"])
def preparing_list():
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
            WHERE outbound_status = '출고 준비중'
        """)
        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(rows), 200

    except Exception as e:
        print(e)
        return jsonify({"error": "Server error"}), 500


# ✅ 출고 준비중 스캔 (Smart_Phone_Outbound 조회) 스캐너 전용 api
@bp_outbound_preparing_detail.route("/api/outbound/preparing-scan", methods=["GET"])
def preparing_scan():
    barcode = request.args.get("barcode")
    if not barcode:
        return jsonify({"error": "barcode is required"}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT * FROM Smart_Phone_Outbound
            WHERE barcode_num = %s
              AND outbound_status = '출고 준비중'
        """, (barcode,))
        row = cursor.fetchone()

        cursor.close()
        conn.close()

        if row:
            return jsonify(row), 200
        else:
            return jsonify({"message": "❌ 출고 준비중 상태가 아닙니다."}), 400

    except Exception as e:
        print(e)
        return jsonify({"error": "Server error"}), 500

# ✅ 출고 준비 완료 처리 (Smart_Phone_Outbound 업데이트)
@bp_outbound_preparing_detail.route("/api/outbound/complete-preparing", methods=["POST"])
def complete_preparing():
    data = request.get_json()
    barcode = data.get("barcode_num")
    if not barcode:
        return jsonify({"error": "barcode_num is required"}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        # ✅ Smart_Phone_Outbound 상태 변경
        cursor.execute("""
            UPDATE Smart_Phone_Outbound
            SET outbound_status = '출고 준비 완료'
            WHERE barcode_num = %s AND outbound_status = '출고 준비중'
        """, (barcode,))
        outbound_updated = cursor.rowcount

        # ✅ MainTable 상태 동기화
        cursor.execute("""
            UPDATE MainTable
            SET outbound_status = '출고 준비 완료'
            WHERE barcode_num = %s AND outbound_status != '출고 준비 완료'
        """, (barcode,))

        conn.commit()
        cursor.close()
        conn.close()

        if outbound_updated:
            return jsonify({"message": "✅ 출고 준비 완료로 상태 변경됨 (Smart_Phone_Outbound + MainTable)"}), 200
        else:
            return jsonify({"message": "❌ 출고 준비중 상태가 아니거나 존재하지 않습니다."}), 400

    except Exception as e:
        print("❌ 오류:", e)
        return jsonify({"error": "Server error", "message": str(e)}), 500

