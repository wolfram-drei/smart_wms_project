# src/apis/outbound_delivery_request.py
from flask import Blueprint, request, jsonify
import mysql.connector

bp_delivery_detail = Blueprint('delivery_detail', __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}


# 📂 배차 신청 주소 자동입력
@bp_delivery_detail.route('/api/outbound/get-address', methods=['GET'])
def get_address():
    barcode_num = request.args.get('barcode')

    if not barcode_num:
        return jsonify({"error": "barcode is required"}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT address FROM Smart_Phone_Outbound WHERE barcode_num = %s",
            (barcode_num,)
        )
        row = cursor.fetchone()

        cursor.close()
        conn.close()

        if row and row.get('address'):
            return jsonify({"address": row['address']})
        else:
            return jsonify({"error": "no address found"}), 404

    except Exception as e:
        print('❌ 배송지 조회 실패:', e)
        return jsonify({"error": "server error"}), 500


# 📂 통합: 배송지 + 메모 + 고객정보 업데이트
@bp_delivery_detail.route('/api/outbound/update-delivery-address', methods=['POST'])
def update_delivery_address():
    data = request.get_json()
    barcode_num = data.get('barcode_num')
    delivery_address = data.get('delivery_address')  # 사용자가 직접 입력한 배송지
    use_saved_address = data.get('use_saved_address')  # 저장된 address 사용 여부
    memo = data.get('memo')
    delivery_customer_name = data.get('delivery_customer_name')
    delivery_customer_phone = data.get('delivery_customer_phone')

    if not barcode_num:
        return jsonify({"error": "barcode_num is required"}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        updates = []
        params = []

        # ✅ 배송지 처리: 저장된 address 사용 요청이면 DB에서 가져오기
        final_delivery_address = delivery_address  # 기본은 직접 입력한 값

        if use_saved_address:
            cursor.execute("SELECT address FROM Smart_Phone_Outbound WHERE barcode_num = %s", (barcode_num,))
            result = cursor.fetchone()
            if result and result.get('address'):
                final_delivery_address = result['address']
            else:
                return jsonify({"error": "저장된 address가 없습니다."}), 404

        # ✅ delivery_address 업데이트
        if final_delivery_address:
            updates.append("delivery_address = %s")
            params.append(final_delivery_address)

        # ✅ 추가 필드들 업데이트
        if memo is not None:
            updates.append("memo = %s")
            params.append(memo)

        if delivery_customer_name is not None:
            updates.append("delivery_customer_name = %s")
            params.append(delivery_customer_name)

        if delivery_customer_phone is not None:
            updates.append("delivery_customer_phone = %s")
            params.append(delivery_customer_phone)

        # ✅ 실제 업데이트 항목이 없으면 오류
        if not updates:
            return jsonify({"error": "업데이트할 항목이 없습니다."}), 400

        # ✅ 최종 UPDATE 쿼리 실행
        update_query = f"""
            UPDATE Smart_Phone_Outbound
            SET {', '.join(updates)}
            WHERE barcode_num = %s
        """
        params.append(barcode_num)

        cursor.execute(update_query, tuple(params))
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "해당 바코드 출고 요청이 없습니다."}), 404

        return jsonify({
            "message": "배송 정보 업데이트 완료",
            "delivery_address": final_delivery_address
        }), 200

    except Exception as e:
        print("❌ 배송 정보 업데이트 실패:", e)
        return jsonify({"error": "server error"}), 500

    finally:
        cursor.close()
        conn.close()
