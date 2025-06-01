from flask import Blueprint, request, jsonify
import mysql.connector

bp_outbound_preparing_complete = Blueprint("outbound_preparing_complete", __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}

# ✅ 출고 준비 완료 처리 (Smart_Phone_Outbound + MainTable 업데이트)
@bp_outbound_preparing_complete.route("/api/outbound/complete-preparing", methods=["POST"])
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
            WHERE barcode_num = %s
        """, (barcode,))

        # ✅ MainTable 상태 동기화
        cursor.execute("""
            UPDATE MainTable
            SET outbound_status = '출고 준비 완료'
            WHERE barcode_num = %s
        """, (barcode,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "✅ 출고 준비 완료로 상태 변경 완료 (Smart_Phone_Outbound + MainTable)"}), 200

    except Exception as e:
        print("❌ Server Error:", e)
        return jsonify({"error": "Server error", "message": str(e)}), 500
