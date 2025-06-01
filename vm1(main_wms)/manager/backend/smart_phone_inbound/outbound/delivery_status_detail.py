#배차 신청, 배차 중, 배차 완료 상태보기(배차현황) 
from flask import Blueprint, request, jsonify
import mysql.connector

bp_delivery_status_detail = Blueprint('delivery_status_detail', __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}


@bp_delivery_status_detail.route('/api/outbound/list-by-status', methods=['GET'])
def list_by_status():
    status = request.args.get('status')

    if not status:
        return jsonify({"error": "상태 값이 필요합니다."}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        if status == '배차 신청':
            # ✅ 배차 신청: 출고 기본정보만
            cursor.execute("""
                SELECT 
                    o.id,
                    o.barcode_num,
                    o.company_name,
                    o.contact_person,
                    o.contact_phone,
                    o.category,
                    o.warehouse_type
                FROM Smart_Phone_Outbound o
                WHERE o.outbound_status = %s
                ORDER BY o.id DESC
            """, (status,))
        
        elif status == '배차 중':
            # ✅ 배차 중: 출고 기본정보 + 배송고객정보
            cursor.execute("""
                SELECT 
                    o.id,
                    o.barcode_num,
                    o.company_name,
                    o.contact_person,
                    o.contact_phone,
                    o.category,
                    o.warehouse_type,
                    o.delivery_customer_name,
                    o.delivery_customer_phone,
                    o.delivery_address
                FROM Smart_Phone_Outbound o
                WHERE o.outbound_status = %s
                ORDER BY o.id DESC
            """, (status,))

        elif status == '배차 완료':
            # ✅ 배차 완료: 배송고객정보 + 배송기사정보
            cursor.execute("""
                SELECT 
                    o.id,
                    o.barcode_num,
                    o.delivery_customer_name,
                    o.delivery_customer_phone,
                    o.delivery_address,
                    v.driver_name,
                    v.driver_phone,
                    v.truck_type,
                    v.destination
                FROM Smart_Phone_Outbound o
                LEFT JOIN VehiclesTable v ON o.assigned_driver_id = v.id
                WHERE o.outbound_status = %s
                ORDER BY o.id DESC
            """, (status,))
        
        else:
            return jsonify({"error": "올바르지 않은 상태입니다."}), 400

        rows = cursor.fetchall()
        return jsonify(rows)

    except Exception as e:
        print("❌ 배차 리스트 오류:", e)
        return jsonify({"error": "서버 오류"}), 500

    finally:
        cursor.close()
        conn.close()

