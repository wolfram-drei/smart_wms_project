import openai
import os
from flask import Blueprint, request, jsonify
import mysql.connector

bp_delivery_driver = Blueprint('delivery_driver', __name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}
#openai.api_key = '' # 또는 직접 키 문자열 입력

@bp_delivery_driver.route('/api/driver/recommend', methods=['POST'])
def recommend_driver():
    data = request.get_json()
    barcode_num = data.get('barcode_num')
    
    # ✅ 필터링 조건 추가
    include_driver_names = data.get('include_driver_names', [])
    exclude_driver_names = data.get('exclude_driver_names', [])
    include_destinations = data.get('include_destinations', [])
    exclude_destinations = data.get('exclude_destinations', [])

    if not barcode_num:
        return jsonify({"error": "barcode_num is required"}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT warehouse_type, delivery_address, category
            FROM Smart_Phone_Outbound
            WHERE barcode_num = %s
        """, (barcode_num,))
        outbound = cursor.fetchone()

        if not outbound:
            return jsonify({"error": "Outbound not found"}), 404

        warehouse_type = outbound['warehouse_type']
        delivery_address = outbound['delivery_address']
        category = outbound['category']

        cursor.execute("""
            SELECT v.id, v.driver_name, v.driver_phone, v.truck_type, v.truck_size, v.storage_condition, v.destination
            FROM VehiclesTable v
            WHERE v.status = '배차 가능'
        """)
        candidates = cursor.fetchall()

        if not candidates:
            return jsonify({"error": "No available drivers"}), 404

        # ✅ 서버 레벨에서 완전한 필터링
        filtered_candidates = []

        for c in candidates:
            # 이름 필터링
            if include_driver_names and c['driver_name'] not in include_driver_names:
                continue
            if exclude_driver_names and c['driver_name'] in exclude_driver_names:
                continue

            # 행선지 필터링
            if include_destinations and c['destination'] not in include_destinations:
                continue
            if exclude_destinations and c['destination'] in exclude_destinations:
                continue

            filtered_candidates.append(c)

        if not filtered_candidates:
            return jsonify({"error": "No matching drivers after filtering"}), 404

        # ✅ GPT 프롬프트
        prompt = f"""
배송 요청 조건:
- 운송 조건: {warehouse_type}
- 배송지: {delivery_address}
- 차량 카테고리: {category}

아래 필터링된 기사 목록 중에서 배송 요청에 가장 적합한 기사 1명 이상 5명 이하를 추천하고, 추천된 기사의 ID만 콤마로 구분해서 반환하세요.
(설명이나 이유 없이 ID 숫자만 보내세요.)

기사 목록:
"""
        for c in filtered_candidates:
            prompt += f"\nID: {c['id']} / 이름: {c['driver_name']} / 차량: {c['truck_type']}({c['truck_size']}) / 운송 조건: {c['storage_condition']} / 목적지: {c['destination']}"

        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "당신은 배송 최적화 전문가입니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=200
            )
            gpt_reply = response['choices'][0]['message']['content'].strip()
        except Exception as e:
            print('❌ OpenAI 호출 실패:', e)
            return jsonify({"error": "Failed to connect to GPT"}), 500

        try:
            recommended_ids = [int(x.strip()) for x in gpt_reply.split(',') if x.strip().isdigit()]
        except Exception as e:
            print('❌ 추천 ID 파싱 에러:', e)
            return jsonify({"error": "Invalid GPT response"}), 500

        if not recommended_ids:
            return jsonify({"error": "No recommended drivers from GPT"}), 404

        selected_drivers = [c for c in filtered_candidates if c['id'] in recommended_ids]

        if not selected_drivers:
            return jsonify({"error": "Recommended drivers not found"}), 404

        return jsonify({
            "recommended_driver_ids": recommended_ids,
            "drivers": selected_drivers
        })

    except Exception as e:
        print('❌ 추천 에러', e)
        return jsonify({"error": "Server Error"}), 500

    finally:
        cursor.close()
        conn.close()


@bp_delivery_driver.route('/api/outbound/assign-drivers', methods=['POST'])
def assign_drivers():
    data = request.get_json()
    barcode_num = data.get('barcode_num')
    driver_ids = data.get('driver_ids')  # 리스트로 받아야 함

    if not barcode_num or not driver_ids:
        return jsonify({"error": "barcode_num과 driver_ids가 필요합니다."}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        driver_id = driver_ids[0]  # 라디오버튼이라 1명만 선택됨

        # ✅ 배송기사 배정 + 출고 상태 '배차 중' 변경
        cursor.execute("""
            UPDATE Smart_Phone_Outbound
            SET assigned_driver_id = %s,
                outbound_status = '배차 중'
            WHERE barcode_num = %s
        """, (driver_id, barcode_num))

        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "해당 바코드 출고 요청을 찾을 수 없습니다."}), 404

        return jsonify({"message": "배송기사 배정 및 출고 상태 변경 완료"}), 200

    except Exception as e:
        print('❌ 기사 배정 실패:', e)
        return jsonify({"error": "서버 에러"}), 500

    finally:
        cursor.close()
        conn.close()
