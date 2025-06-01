from flask import Blueprint, request, jsonify
import mysql.connector

bp_contract = Blueprint("contract", __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

# ✅ insert 함수 (중복 체크 포함) ── **원본 그대로**
def insert_to_smart_phone_inbound(product):
    barcode_num = product.get("barcode_num")
    if not barcode_num:
        print("❌ barcode_num is missing or empty:", product)
        return
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM Smart_Phone_Inbound WHERE barcode_num = %s", (barcode_num,))
    if cursor.fetchone():
        print(f"🔁 중복된 바코드로 인한 INSERT 무시됨: {barcode_num}")
        cursor.close(); conn.close(); return
    cursor.execute(
        """
        INSERT INTO Smart_Phone_Inbound (
            company_name, contact_person, contact_phone, address,
            weight, pallet_size, width_size, length_size,
            warehouse_type, category, warehouse_num,
            barcode, barcode_num, img_inbound, img_pallet,
            inbound_status, contract_date, inbound_date, outbound_date,estimate
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,%s)
        """,
        (
            product.get("company_name"),
            product.get("contact_person"),
            product.get("contact_phone"),
            product.get("address"),
            product.get("weight"),
            product.get("pallet_size"),
            product.get("width_size"),
            product.get("length_size"),
            product.get("warehouse_type"),
            product.get("category"),
            product.get("warehouse_num"),
            product.get("barcode"),
            barcode_num,
            product.get("img_inbound"),
            product.get("img_pallet"),
            product.get("inbound_status"),
            product.get("contract_date"),
            product.get("inbound_date"),
            product.get("outbound_date"),
            product.get("estimate"),
        ),
    )
    conn.commit()
    print(f"✅ INSERT 성공: {barcode_num}")
    cursor.close(); conn.close()


# ---------- 라우트 (원본 그대로) ----------
@bp_contract.route("/api/contract", methods=["GET"])
def contract_scan():
    barcode = request.args.get("barcode")
    if not barcode:
        return jsonify({"error": "barcode required"}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM MainTable WHERE barcode_num = %s", (barcode,))
    result = cursor.fetchone()
    cursor.close(); conn.close()

    if result:
        if result["inbound_status"] == "입고 준비":
            conn2 = mysql.connector.connect(**db_config)
            cur2 = conn2.cursor()
            cur2.execute("SELECT id FROM Smart_Phone_Inbound WHERE barcode_num = %s", (barcode,))
            if cur2.fetchone():
                cur2.close(); conn2.close()
                return jsonify({"error": "Already scanned","message": "이미 스캔 완료된 계약 품목입니다."}), 409
            cur2.close(); conn2.close()

            result["inbound_status"] = "입고 준비"
            insert_to_smart_phone_inbound(result)

            return jsonify({"message": f"{barcode} 계약 스캔 완료 → 입고 준비 상태로 등록됨","status": "입고 준비"}), 200
        return jsonify({"error": "Wrong status","message": f"🚫 현재 상태: '{result['inbound_status']}' — 입고 준비가 아닙니다."}), 400
    return jsonify({"error": "No matching barcode","message": "❌ 계약 정보 없음"}), 404


"""@bp_contract.route("/api/contract/approve", methods=["POST"])
def approve_contract():
    barcode = request.get_json().get("barcode")
    if not barcode:
        return jsonify({"error": "barcode is required"}), 400
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    cursor.execute("UPDATE Smart_Phone_Inbound SET inbound_status = '입고 대기' WHERE barcode_num = %s", (barcode,))
    conn.commit(); cursor.close(); conn.close()
    return jsonify({"message": f"{barcode} 승인 완료 → 입고 대기 상태로 변경됨"}), 200"""

#입고 대기 상태변경 (스마트폰인바운드 테이블 + 메인테이블 상태 변경)
@bp_contract.route("/api/contract/approve", methods=["POST"])
def approve_contract():
    barcode = request.get_json().get("barcode")
    if not barcode:
        return jsonify({"error": "barcode is required"}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()

    # ✅ 1. Smart_Phone_Inbound 상태 업데이트
    cursor.execute("""
        UPDATE Smart_Phone_Inbound
        SET inbound_status = '입고 대기'
        WHERE barcode_num = %s
    """, (barcode,))

    # ✅ 2. MainTable 상태도 같이 업데이트
    cursor.execute("""
        UPDATE MainTable
        SET inbound_status = '입고 대기'
        WHERE barcode_num = %s
    """, (barcode,))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": f"{barcode} 승인 완료 → 입고 대기 상태로 변경됨"}), 200



@bp_contract.route("/api/contract-list", methods=["GET"])
def get_contract_list():
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT id, company_name, contract_date, contact_person, contact_phone,
               warehouse_type, total_cost, estimate, barcode_num, inbound_status
        FROM Smart_Phone_Inbound
        WHERE inbound_status = '입고 준비'
        ORDER BY id DESC
        """
    )
    results = cursor.fetchall(); cursor.close(); conn.close()
    return jsonify(results) if results else jsonify([]), 200


@bp_contract.route("/api/contract/delete-bulk", methods=["POST"])
def delete_bulk_contracts():
    ids = request.get_json().get("ids")
    if not ids or not isinstance(ids, list):
        return jsonify({"error": "ids (list) is required"}), 400
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM Smart_Phone_Inbound WHERE id IN ({','.join(['%s']*len(ids))})", tuple(ids))
    conn.commit(); cursor.close(); conn.close()
    return jsonify({"message": f"{len(ids)}개 항목 삭제 완료"}), 200
