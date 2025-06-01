# src/apis/outbound_ready_detail_api.py
from flask import Blueprint, request, jsonify
import mysql.connector

bp_outbound_ready_detail = Blueprint("outbound_ready_detail", __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}

# 출고 준비중 단건 상세 조회
@bp_outbound_ready_detail.route("/api/outbound/ready-detail", methods=["GET"])
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
    
    # ✅ 출고 준비 완료 → 배차 신청 상태로 변경
@bp_outbound_ready_detail.route("/api/outbound/request-ready-dispatch", methods=["POST"])
def request_dispatch():
    data = request.get_json()
    barcode_num = data.get("barcode_num")

    if not barcode_num:
        return jsonify({"error": "barcode_num이 필요합니다."}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # ✅ Smart_Phone_Outbound 테이블 업데이트
        cursor.execute("""
            UPDATE Smart_Phone_Outbound
            SET outbound_status = '배차 신청'
            WHERE barcode_num = %s AND outbound_status = '출고 준비 완료'
        """, (barcode_num,))
        conn.commit()

        if cursor.rowcount == 0:
            # 출고 준비 완료 상태인 항목이 없으면 오류 반환
            return jsonify({"error": "해당 바코드에 대해 출고 준비 완료 상태가 아닙니다."}), 409

        cursor.close()
        conn.close()

        return jsonify({"message": "배차 신청 완료"}), 200

    except Exception as e:
        print(f"❌ 오류: {e}")
        return jsonify({"error": "서버 오류가 발생했습니다."}), 500