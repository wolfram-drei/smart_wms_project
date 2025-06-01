from flask import Blueprint, request, jsonify
import mysql.connector
import re

vehicle_bp = Blueprint("vehicle", __name__)

# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

@vehicle_bp.route("/matching-vehicles", methods=["POST"])
def get_matching_vehicles():
    try:
        request_data = request.json
        main_table_id = request_data.get("main_table_id")

        if not main_table_id:
            return jsonify({"error": "main_table_id is required"}), 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # 출고 요청 정보 가져오기
        cursor.execute("""
            SELECT warehouse_location, warehouse_type, address, pallet_size
            FROM OutboundRequestTable
            WHERE id = %s
        """, (main_table_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "해당 ID에 대한 출고 요청이 없습니다."}), 404

        warehouse_location = row["warehouse_location"]
        warehouse_type = row["warehouse_type"]
        address = row["address"]
        pallet_size = row["pallet_size"]

        # '서울 창고 A' → '서울'
        city_match = re.match(r"([가-힣]+)", warehouse_location)
        city = city_match.group(1) if city_match else ""

        # 주소에서 앞부분 도시명 추출
        destination_match = re.match(r"^([가-힣]+?)(?:광역시|특별시|도)?", address) if address else None
        destination = destination_match.group(1) if destination_match else ""

        # pallet_size와 truck_type 매핑
        size_to_truck_types = {
            "S": ("1톤", "1.5톤"),
            "M": ("1.5톤", "5톤"),
            "L": ("5톤", "10톤")
        }
        truck_types = size_to_truck_types.get(pallet_size, ())

        if not truck_types:
            return jsonify({"error": "알 수 없는 pallet_size 값입니다."}), 400

        # 조건에 맞는 차량 조회
        placeholders = ', '.join(['%s'] * len(truck_types))
        query = f"""
            SELECT *
            FROM VehiclesTable
            WHERE status = '배차 가능'
            AND current_location LIKE %s
            AND destination LIKE %s
            AND storage_condition = %s
            AND truck_type IN ({placeholders})
        """
        params = (f"%{city}%", f"%{destination}%", warehouse_type, *truck_types)


        cursor.execute(query, params)

        vehicles = cursor.fetchall()
        return jsonify(vehicles), 200

    except Exception as e:
        print("Error in get_matching_vehicles:", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if connection: connection.close()

@vehicle_bp.route("/assign-vehicle", methods=["POST"])
def assign_vehicle():
    try:
        data = request.json
        vehicle_id = data.get("vehicle_id")
        main_table_id = data.get("main_table_id")

        if not vehicle_id or not main_table_id:
            return jsonify({"error": "vehicle_id와 main_table_id는 필수입니다."}), 400

        connection = get_db_connection()
        cursor = connection.cursor()

        # 1. 차량 상태 업데이트
        update_vehicle_query = """
            UPDATE VehiclesTable
            SET status = '배차 완료',
                assigned_main_table_id = %s
            WHERE id = %s
        """
        cursor.execute(update_vehicle_query, (main_table_id, vehicle_id))

        # 2. 출고 상태를 '배차 완료'로 변경 (MainTable, OutboundRequestTable 동기화)
        update_status_query = """
            UPDATE MainTable
            SET outbound_status = '배차 완료'
            WHERE id = %s
        """
        cursor.execute(update_status_query, (main_table_id,))

        update_request_query = """
            UPDATE OutboundRequestTable
            SET outbound_status = '배차 완료'
            WHERE id = %s
        """
        cursor.execute(update_request_query, (main_table_id,))

        connection.commit()
        return jsonify({"message": "배차 완료 처리 성공"}), 200

    except Exception as e:
        print("Error in assign_vehicle:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if connection: connection.close()
