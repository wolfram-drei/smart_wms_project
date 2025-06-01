from flask import Blueprint, request, jsonify
import mysql.connector

bp_delivery_final_status = Blueprint('delivery_final_status', __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}


@bp_delivery_final_status.route('/api/outbound/driver-update-status', methods=['PUT'])
def update_outbound_status():
    data = request.get_json()
    barcode_num = data.get('barcode_num')
    new_status = data.get('new_status')

    if not barcode_num or not new_status:
        return jsonify({"error": "barcode_num과 new_status가 필요합니다."}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        # ✅ 1. Smart_Phone_Outbound 테이블 상태 업데이트
        cursor.execute("""
            UPDATE Smart_Phone_Outbound
            SET outbound_status = %s
            WHERE barcode_num = %s
        """, (new_status, barcode_num))

        # ✅ 2. MainTable 테이블 상태도 함께 업데이트
        cursor.execute("""
            UPDATE MainTable
            SET outbound_status = %s
            WHERE barcode_num = %s
        """, (new_status, barcode_num))

        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "출고 요청을 찾을 수 없습니다."}), 404

        return jsonify({"message": f"출고 상태를 '{new_status}'로 업데이트 완료"}), 200

    except Exception as e:
        print('❌ 상태 업데이트 실패:', e)
        return jsonify({"error": "서버 에러"}), 500

    finally:
        cursor.close()
        conn.close()


@bp_delivery_final_status.route('/api/outbound/driver-customer-load-detail', methods=['GET'])
def get_outbound_detail():
    barcode_num = request.args.get('barcode_num')

    if not barcode_num:
        return jsonify({"error": "barcode_num 파라미터가 필요합니다."}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # ✅ 1. 고객 정보 + 기사 ID 포함
        cursor.execute("""
            SELECT
                delivery_customer_name,
                delivery_customer_phone,
                delivery_address,
                category,
                warehouse_location,
                contract_date,
                last_outbound_date,
                memo,
                outbound_status,
                assigned_driver_id
            FROM Smart_Phone_Outbound
            WHERE barcode_num = %s
        """, (barcode_num,))
        outbound_row = cursor.fetchone()

        if not outbound_row:
            return jsonify({"error": "출고 요청을 찾을 수 없습니다."}), 404

        assigned_driver_id = outbound_row.get("assigned_driver_id")

        driver_info = None
        if assigned_driver_id:
            # ✅ 2. 기사 정보
            cursor.execute("""
                SELECT
                    driver_name,
                    driver_phone,
                    truck_type,
                    truck_size,
                    current_location,
                    destination
                FROM VehiclesTable
                WHERE id = %s
            """, (assigned_driver_id,))
            driver_info = cursor.fetchone()

        # ✅ 응답 구조화
        return jsonify({
            "customer_info": {
                "name": outbound_row.get("delivery_customer_name"),
                "phone": outbound_row.get("delivery_customer_phone"),
                "address": outbound_row.get("delivery_address"),
                "category": outbound_row.get("category"),
                "warehouse_location": outbound_row.get("warehouse_location"),
                "contract_date": str(outbound_row.get("contract_date")),
                "last_outbound_date": str(outbound_row.get("last_outbound_date")),
                "memo": outbound_row.get("memo"),
                "status": outbound_row.get("outbound_status")
            },
            "driver_info": driver_info or {}
        }), 200

    except Exception as e:
        print("❌ 상세정보 조회 실패:", e)
        return jsonify({"error": "서버 오류"}), 500

    finally:
        cursor.close()
        conn.close()

