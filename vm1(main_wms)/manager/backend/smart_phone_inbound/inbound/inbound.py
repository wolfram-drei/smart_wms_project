from flask import Blueprint, request, jsonify
import mysql.connector
import os


bp_inbound = Blueprint("inbound", __name__)

db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}
"""
@bp_inbound.route("/api/product", methods=["GET"])
def product_scan():
    barcode = request.args.get("barcode")
    if not barcode:
        return jsonify({"error": "barcode required"}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM Smart_Phone_Inbound WHERE barcode_num = %s", (barcode,))
    result = cursor.fetchone(); cursor.close(); conn.close()

    if result:
        if result["inbound_status"] == "입고 대기":
            conn2 = mysql.connector.connect(**db_config)
            cur2 = conn2.cursor()
            cur2.execute("UPDATE Smart_Phone_Inbound SET inbound_status = '입고 중' WHERE barcode_num = %s", (barcode,))
            conn2.commit(); cur2.close(); conn2.close()
            result["inbound_status"] = "입고 중"
            return jsonify(result)
        return jsonify({"error": "Wrong status","message": f"🚫 현재 상태: '{result['inbound_status']}' — 입고 대기 상태가 아닙니다."}), 400
    return jsonify({"error": "No matching barcode","message": "❌ 물품 정보 없음"}), 404
"""
@bp_inbound.route("/api/product", methods=["GET"])
def product_scan():
    barcode = request.args.get("barcode")
    if not barcode:
        return jsonify({"error": "barcode required"}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM Smart_Phone_Inbound WHERE barcode_num = %s", (barcode,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    if result:
        if result["inbound_status"] == "입고 대기":
            conn2 = mysql.connector.connect(**db_config)
            cur2 = conn2.cursor()

            # ✅ Smart_Phone_Inbound 상태 변경
            cur2.execute("""
                UPDATE Smart_Phone_Inbound
                SET inbound_status = '입고 중'
                WHERE barcode_num = %s
            """, (barcode,))

            # ✅ MainTable 상태 동기화
            cur2.execute("""
                UPDATE MainTable
                SET inbound_status = '입고 중'
                WHERE barcode_num = %s
            """, (barcode,))

            conn2.commit()
            cur2.close()
            conn2.close()

            result["inbound_status"] = "입고 중"
            return jsonify(result)

        return jsonify({
            "error": "Wrong status",
            "message": f"🚫 현재 상태: '{result['inbound_status']}' — 입고 대기 상태가 아닙니다."
        }), 400

    return jsonify({
        "error": "No matching barcode",
        "message": "❌ 물품 정보 없음"
    }), 404


@bp_inbound.route("/api/inbound-list", methods=["GET"])
def get_all_inbound_products():
    status = request.args.get("status", None)  # ✅ 추가: 상태 쿼리 파라미터

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    # ✅ 동적으로 상태별 필터링
    if status:
        cursor.execute(
            """
            SELECT id, barcode_num, company_name, contact_phone,
                   warehouse_type, inbound_status, inbound_date, outbound_date
            FROM Smart_Phone_Inbound
            WHERE inbound_status = %s
            ORDER BY id DESC
            """,
            (status,)
        )
    else:
        cursor.execute(
            """
            SELECT id, barcode_num, company_name, contact_phone,
                   warehouse_type, inbound_status, inbound_date, outbound_date
            FROM Smart_Phone_Inbound
            WHERE inbound_status IN ('입고 대기', '입고 중')
            ORDER BY id DESC
            """
        )

    results = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(results)


@bp_inbound.route("/api/inbound/delete", methods=["DELETE"])
def delete_inbound_item():
    item_id = request.get_json().get("id")
    if not item_id:
        return jsonify({"error": "id is required"}), 400
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM Smart_Phone_Inbound WHERE id = %s", (item_id,))
        if not cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({"error": "not found","message": "❌ 해당 ID의 항목이 존재하지 않습니다."}), 404
        cursor.execute("DELETE FROM Smart_Phone_Inbound WHERE id = %s", (item_id,))
        conn.commit(); cursor.close(); conn.close()
        return jsonify({"message": f"✅ ID {item_id} 삭제 완료"}), 200
    except Exception as e:
        print("❌ 삭제 오류:", e)
        return jsonify({"error": "server error","message": str(e)}), 500


@bp_inbound.route("/api/inbound/detail", methods=["GET"])
def get_inbound_detail():
    barcode = request.args.get("barcode")
    if not barcode:
        return jsonify({"error": "barcode is required"}), 400
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT company_name, category, warehouse_type,
               warehouse_num, barcode, barcode_num, inbound_status
        FROM Smart_Phone_Inbound
        WHERE barcode_num = %s
        """,
        (barcode,),
    )
    result = cursor.fetchone(); cursor.close(); conn.close()

    if not result:
        return jsonify({"error": "Not found"}), 404

    response = {
        "company_name": result.get("company_name"),
        "category": result.get("category"),
        "warehouse_type": result.get("warehouse_type"),
        "warehouse_num": result.get("warehouse_num"),
        "barcode": result.get("barcode"),
        "barcode_num": result.get("barcode_num"),
        "inbound_status": result.get("inbound_status")
    }
    
    return jsonify(response), 200

@bp_inbound.route("/api/inbound/last-confirm-detail", methods=["GET"])
def get_last_confirm_detail():
    barcode = request.args.get("barcode")
    if not barcode:
        return jsonify({"error": "barcode is required"}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT company_name, category, warehouse_type,
               warehouse_num, barcode, barcode_num, inbound_status,
               img_inbound,
               img_pallet
        FROM Smart_Phone_Inbound
        WHERE barcode_num = %s
        """,
        (barcode,),
    )
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    if not result:
        return jsonify({"error": "Not found"}), 404

    # 서버 URL 설정
    SERVER_URL = "http://34.64.211.3:8050/images"

    # 경로에서 /images/ 부분을 제거하고, 파일명만 가져옴
    def clean_path(path):
        return path.split('/')[-1] if path else None

    photo1_url = f"{SERVER_URL}/img_inbound/{clean_path(result['img_inbound'])}" if result.get('img_inbound') else None
    photo2_url = f"{SERVER_URL}/img_pallet/{clean_path(result['img_pallet'])}" if result.get('img_pallet') else None
    
    response = {
        "company_name": result.get("company_name"),
        "category": result.get("category"),
        "warehouse_type": result.get("warehouse_type"),
        "warehouse_num": result.get("warehouse_num"),
        "barcode": result.get("barcode"),
        "barcode_num": result.get("barcode_num"),
        "inbound_status": result.get("inbound_status"),
        "photo1_url": photo1_url,
        "photo2_url": photo2_url,
    }
    return jsonify(response), 200