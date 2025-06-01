# src/apis/inbound_slot.py
from flask import Blueprint, request, jsonify
import mysql.connector

bp_slot = Blueprint("inbound_slot", __name__)

# DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

# ✅ 슬롯 저장 처리
@bp_slot.route("/set-slot", methods=["POST"])
def set_slot():
    try:
        data = request.get_json()
        print('✅ 받은 데이터:', data)
        barcode = data.get("barcode")
        slot = data.get("slot")

        if not barcode or not slot:
            return jsonify({"error": "barcode와 slot은 필수입니다."}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE Smart_Phone_Inbound
            SET warehouse_num = %s
            WHERE barcode_num = %s
            """,
            (slot, barcode)
        )

        if cursor.rowcount == 0:
            conn.rollback()
            cursor.close()
            conn.close()
            return jsonify({"error": "해당 바코드 항목을 찾을 수 없습니다."}), 404

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"{barcode} 슬롯 저장 완료 ✅"}), 200

    except Exception as e:
        print("❌ 슬롯 저장 오류:", e)
        return jsonify({"error": "서버 오류", "message": str(e)}), 500

#슬롯 로드
@bp_slot.route("/slot", methods=["GET"])
def get_slot_by_barcode():
    barcode_num = request.args.get("barcode_num")

    if not barcode_num:
        return jsonify({"error": "barcode_num 파라미터가 필요합니다."}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT warehouse_num FROM Smart_Phone_Inbound WHERE barcode_num = %s",
            (barcode_num,)
        )
        row = cursor.fetchone()

        cursor.close()
        conn.close()

        if row:
            return jsonify({"warehouse_num": row["warehouse_num"]}), 200
        else:
            return jsonify({"error": "해당 barcode_num에 대한 슬롯이 없습니다."}), 404

    except Exception as e:
        print("❌ 슬롯 조회 오류:", e)
        return jsonify({"error": "서버 오류", "message": str(e)}), 500
    
    # 전체 슬롯 상태 반환
@bp_slot.route("/slot-status", methods=["GET"])
def get_slot_status():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # 슬롯 후보 전체 불러오기
        all_slots = []
        for x in range(3):
            for y in range(3):
                for z in range(5):
                    all_slots.append(f"SLOT-{x}-{y}-{z}")

        results = []

        for slot_name in all_slots:
            # 슬롯 이름에서 S-을 SLOT-으로 바꿔서 DB에 맞추기
            original_slot = slot_name.replace("S-", "SLOT-")

            cursor.execute("""
                SELECT barcode_num, inbound_status, warehouse_num
                FROM Smart_Phone_Inbound
                WHERE warehouse_num = %s
                ORDER BY id DESC
                LIMIT 1
            """, (original_slot,))

            info = cursor.fetchone()

            if info:
                # ✅ 입고 중 또는 입고 완료된 슬롯
                results.append({
                    "slot_name": slot_name,
                    "available": False,   # ❗❗ 사용 중인 슬롯은 False
                    "barcode_num": info["barcode_num"],
                    "warehouse_num": original_slot,
                    "inbound_status": info["inbound_status"]
                })
            else:
                # ✅ 사용 이력 없는 빈 슬롯
                results.append({
                    "slot_name": slot_name,
                    "available": True,
                    "barcode_num": None,
                    "warehouse_num": original_slot,
                    "inbound_status": None
                })

        cursor.close()
        conn.close()

        return jsonify(results), 200

    except Exception as e:
        print("❌ 슬롯 상태 조회 오류:", e)
        return jsonify({"error": "서버 오류", "message": str(e)}), 500

@bp_slot.route("/locations", methods=["GET"])
def get_warehouse_locations():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        # ✅ '보관소'라는 단어가 포함된 항목만 조회
        cursor.execute("""
            SELECT DISTINCT warehouse_location
            FROM MainTable
            WHERE warehouse_location IS NOT NULL
              AND warehouse_location != ''
              AND warehouse_location LIKE '%보관소%'
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        locations = [row[0] for row in rows]
        return jsonify(locations), 200

    except Exception as e:
        print("❌ 보관소 목록 조회 실패:", e)
        return jsonify({"error": "서버 오류", "message": str(e)}), 500
