# src/apis/inbound_done.py
from flask import Blueprint, request, jsonify
import mysql.connector

bp_done = Blueprint("inbound_done", __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

# ✅ 입고 완료 상태 기준으로 MainTable 업데이트 후 삭제
@bp_done.route("/api/inbound/finalize", methods=["POST"])
def finalize_inbound():
    data = request.get_json()
    barcode = data.get("barcode")

    if not barcode:
        return jsonify({"error": "barcode is required"}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # ✅ 입고 완료 상태의 정보 조회
        cursor.execute(
            "SELECT * FROM Smart_Phone_Inbound WHERE barcode_num = %s AND inbound_status = '입고 완료'",
            (barcode,)
        )
        inbound_data = cursor.fetchone()

        if not inbound_data:
            cursor.close()
            conn.close()
            return jsonify({"error": "입고 완료 상태의 데이터를 찾을 수 없습니다."}), 404

        # ✅ MainTable 업데이트
        cursor.execute(
            """
            UPDATE MainTable SET
                company_name = %(company_name)s,
                contact_person = %(contact_person)s,
                contact_phone = %(contact_phone)s,
                address = %(address)s,
                weight = %(weight)s,
                pallet_size = %(pallet_size)s,
                width_size = %(width_size)s,
                length_size = %(length_size)s,
                warehouse_type = %(warehouse_type)s,
                category = %(category)s,
                warehouse_num = %(warehouse_num)s,
                barcode = %(barcode)s,
                barcode_num = %(barcode_num)s,
                img_inbound = %(img_inbound)s,
                img_pallet = %(img_pallet)s,
                inbound_status = %(inbound_status)s,
                contract_date = %(contract_date)s,
       
                outbound_date = %(outbound_date)s,
                estimate = %(estimate)s
            WHERE barcode_num = %(barcode_num)s
            """,
            inbound_data
        )

        # ✅ Smart_Phone_Inbound에서 삭제
        cursor.execute(
            "DELETE FROM Smart_Phone_Inbound WHERE barcode_num = %s",
            (barcode,)
        )

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": f"{barcode} MainTable에 반영 후 Smart_Phone_Inbound에서 삭제 완료 ✅"}), 200

    except Exception as e:
        print("❌ 오류:", e)
        return jsonify({"error": "서버 오류", "message": str(e)}), 500
