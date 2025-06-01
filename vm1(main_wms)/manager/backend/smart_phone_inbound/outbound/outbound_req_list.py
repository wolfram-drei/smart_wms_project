from flask import Blueprint, request, jsonify,send_from_directory
import mysql.connector


bp_outbound = Blueprint("outbound", __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}

# ✅ MainTable 출고 요청 상태만 조회
@bp_outbound.route("/api/outbound/maintable-request-list", methods=["GET"])
def get_maintable_outbound_requests():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, company_name, contact_person, contact_phone, address,
                   weight, width_size, length_size,
                   warehouse_type, category, warehouse_num,
                   barcode, barcode_num, outbound_status,
                   contract_date,last_outbound_date,
                   warehouse_location
            FROM MainTable
            WHERE outbound_status = '출고요청'
            ORDER BY id DESC
            """
        )
        results = cursor.fetchall()
        cursor.close(); conn.close()

        return jsonify(results) if results else jsonify([]), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": "Server error"}), 500
    

# ✅ MainTable 출고 요청 중에서 바코드로 조회 (1개 찾기)
@bp_outbound.route("/api/outbound/maintable-request-scan", methods=["GET"])
def scan_maintable_barcode():
    barcode = request.args.get("barcode")

    if not barcode:
        return jsonify({"error": "barcode is required"}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, company_name, barcode_num, outbound_status
            FROM MainTable
            WHERE outbound_status = '출고요청' AND barcode_num = %s
        """, (barcode,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()

        if result:
            return jsonify(result), 200
        else:
            return jsonify({"error": "출고요청 상태에 해당하는 바코드가 없습니다."}), 404

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": "Server error"}), 500


# ✅ uploads 경로를 public하게 열어줌
@bp_outbound.route('/barcode/<path:filename>')
def serve_barcode_image(filename):
    return send_from_directory('/home/wms/work/manager/backend/inbound/barcode', filename)