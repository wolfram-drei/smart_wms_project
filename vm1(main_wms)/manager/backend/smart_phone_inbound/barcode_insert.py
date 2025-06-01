#insert , update등만 기재

from flask import Flask, request, jsonify
import mysql.connector

app = Flask(__name__)

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}

# ✅ insert 함수 (중복 체크 포함)
def insert_to_smart_phone_inbound(product):
    barcode_num = product.get("barcode_num")

    if not barcode_num:
        print("❌ barcode_num is missing or empty:", product)
        return

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()

    check_query = "SELECT id FROM Smart_Phone_Inbound WHERE barcode_num = %s"
    cursor.execute(check_query, (barcode_num,))
    exists = cursor.fetchone()

    if exists:
        print(f"🔁 중복된 바코드로 인한 INSERT 무시됨: {barcode_num}")
        cursor.close()
        conn.close()
        return

    insert_query = """
        INSERT INTO Smart_Phone_Inbound (
            company_name, contact_person, contact_phone, address,
            weight, pallet_size, width_size, length_size,
            warehouse_type, category, warehouse_num,
            barcode, barcode_num, img_inbound, img_pallet,
            inbound_status, contract_date, inbound_date, outbound_date,estimate
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,%s)
    """
    values = (
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
    )

    cursor.execute(insert_query, values)
    conn.commit()
    print(f"✅ INSERT 성공: {barcode_num}")
    cursor.close()
    conn.close()




# ✅ 계약서 확인 단계 (1단계): 상태를 '입고 대기'로 바꾸고 INSERT
@app.route('/api/contract', methods=['GET'])
def contract_scan():
    barcode = request.args.get('barcode')
    if not barcode:
        return jsonify({'error': 'barcode required'}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM MainTable WHERE barcode_num = %s", (barcode,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    if result:
        if result['inbound_status'] == '입고 준비':
            # 중복 검사
            conn2 = mysql.connector.connect(**db_config)
            cursor2 = conn2.cursor()
            cursor2.execute("SELECT id FROM Smart_Phone_Inbound WHERE barcode_num = %s", (barcode,))
            already = cursor2.fetchone()
            cursor2.close()
            conn2.close()

            if already:
                return jsonify({
                    'error': 'Already scanned',
                    'message': '이미 스캔 완료된 계약 품목입니다.'
                }), 409

            # ✅ insert 시 상태는 '입고 대기'
            result['inbound_status'] = '입고 준비'

            # Smart_Phone_Inbound에 저장 (입고 대기 상태로)
            insert_to_smart_phone_inbound(result)

            return jsonify({
                'message': f"{barcode} 계약 스캔 완료 → 입고 준비 상태로 등록됨",
                'status': '입고 준비'
            }), 200
        else:
            return jsonify({
                'error': 'Wrong status',
                'message': f"🚫 현재 상태: '{result['inbound_status']}' — 입고 준비가 아닙니다."
            }), 400
    else:
        return jsonify({'error': 'No matching barcode', 'message': '❌ 계약 정보 없음'}), 404
    
@app.route('/api/contract/approve', methods=['POST'])
def approve_contract():
    data = request.get_json()
    barcode = data.get('barcode')

    if not barcode:
        return jsonify({'error': 'barcode is required'}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()

    # Smart_Phone_Inbound 상태를 '입고 대기'로 변경
    cursor.execute("UPDATE Smart_Phone_Inbound SET inbound_status = '입고 대기' WHERE barcode_num = %s", (barcode,))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'message': f"{barcode} 승인 완료 → 입고 대기 상태로 변경됨"}), 200


# ✅ 물품 확인 단계 (2단계): 상태가 '입고 대기'인 경우에만 '입고 중'으로 업데이트
@app.route('/api/product', methods=['GET'])
def product_scan():
    barcode = request.args.get('barcode')
    if not barcode:
        return jsonify({'error': 'barcode required'}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM Smart_Phone_Inbound WHERE barcode_num = %s", (barcode,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    if result:
        if result['inbound_status'] == '입고 대기':
            conn2 = mysql.connector.connect(**db_config)
            cursor2 = conn2.cursor()
            cursor2.execute("UPDATE Smart_Phone_Inbound SET inbound_status = '입고 중' WHERE barcode_num = %s", (barcode,))
            conn2.commit()
            cursor2.close()
            conn2.close()
            result['inbound_status'] = '입고 중'
            return jsonify(result)
        else:
            return jsonify({
                'error': 'Wrong status',
                'message': f"🚫 현재 상태: '{result['inbound_status']}' — 입고 대기 상태가 아닙니다."
            }), 400
    else:
        return jsonify({'error': 'No matching barcode', 'message': '❌ 물품 정보 없음'}), 404
    



@app.route('/api/contract-list', methods=['GET'])
def get_contract_list():
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    # ✅ Smart_Phone_Inbound에서 '입고 대기' 상태인 계약서 항목들 조회
    query = """
        SELECT 
            id,
            company_name,
            contract_date,
            contact_person,
            contact_phone,
            warehouse_type,
            total_cost,
            estimate,
            barcode_num,
            inbound_status
        FROM Smart_Phone_Inbound
        WHERE inbound_status = '입고 준비'
        ORDER BY id DESC
    """
    cursor.execute(query)
    results = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(results) if results else jsonify([]), 200


# ✅ 입고 리스트 (입고 대기 & 입고 중 상태만 조회)
@app.route('/api/inbound-list', methods=['GET'])
def get_all_inbound_products():
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT 
            id, barcode_num, company_name, contact_phone,
            warehouse_type, inbound_status,
            inbound_date, outbound_date
        FROM Smart_Phone_Inbound
        WHERE inbound_status IN ('입고 대기', '입고 중')
        ORDER BY id DESC
    """
    cursor.execute(query)
    results = cursor.fetchall()

    cursor.close()
    conn.close()
    return jsonify(results)



# ✅ 계약정보 복수 삭제 API (id 리스트 기반)
@app.route('/api/contract/delete-bulk', methods=['POST'])
def delete_bulk_contracts():
    data = request.get_json()
    ids = data.get('ids')

    if not ids or not isinstance(ids, list):
        return jsonify({'error': 'ids (list) is required'}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    format_strings = ','.join(['%s'] * len(ids))
    query = f"DELETE FROM Smart_Phone_Inbound WHERE id IN ({format_strings})"
    cursor.execute(query, tuple(ids))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'message': f"{len(ids)}개 항목 삭제 완료"}), 200




#입고물품 리스트 삭제 api
@app.route('/api/inbound/delete', methods=['DELETE'])
def delete_inbound_item():
    data = request.get_json()
    item_id = data.get('id')

    if not item_id:
        return jsonify({'error': 'id is required'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        # ✅ 존재 확인
        cursor.execute("SELECT id FROM Smart_Phone_Inbound WHERE id = %s", (item_id,))
        exists = cursor.fetchone()

        if not exists:
            return jsonify({'error': 'not found', 'message': '❌ 해당 ID의 항목이 존재하지 않습니다.'}), 404

        # ✅ 삭제
        cursor.execute("DELETE FROM Smart_Phone_Inbound WHERE id = %s", (item_id,))
        conn.commit()

        return jsonify({'message': f'✅ ID {item_id} 삭제 완료'}), 200

    except Exception as e:
        print("❌ 삭제 오류:", e)
        return jsonify({'error': 'server error', 'message': str(e)}), 500

    finally:
        cursor.close()
        conn.close()


@app.route('/api/inbound/detail', methods=['GET'])
def get_inbound_detail():
    barcode = request.args.get('barcode')
    if not barcode:
        return jsonify({'error': 'barcode is required'}), 400

    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT company_name, category, warehouse_type,
               warehouse_num, barcode, barcode_num, inbound_status
        FROM Smart_Phone_Inbound
        WHERE barcode_num = %s AND inbound_status = '입고 중'
    """
    cursor.execute(query, (barcode,))
    result = cursor.fetchone()

    cursor.close()
    conn.close()

    if result:
        return jsonify(result), 200
    else:
        return jsonify({'error': 'Not found or wrong status'}), 404
    
@app.route('/api/inbound/complete', methods=['POST'])
def complete_inbound():
    data = request.get_json()
    barcode = data.get('barcode')
    img_inbound = data.get('img_inbound')
    img_pallet = data.get('img_pallet')

    if not barcode or not img_inbound or not img_pallet:
        return jsonify({'error': 'barcode, img_inbound, img_pallet are required'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # ✅ Smart_Phone_Inbound 업데이트
        cursor.execute("""
            UPDATE Smart_Phone_Inbound
            SET inbound_status = '입고 완료',
                img_inbound = %s,
                img_pallet = %s
            WHERE barcode_num = %s
        """, (img_inbound, img_pallet, barcode))

        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({'error': '입고 중인 항목을 찾을 수 없습니다.'}), 404

        # ✅ Smart_Phone_Inbound에서 최신 데이터 가져오기
        cursor.execute("""
            SELECT company_name, contact_person, contact_phone,
                   product_name, category, width_size, length_size, height_size,
                   warehouse_type, warehouse_num, barcode, barcode_num,
                   contract_date, inbound_date, outbound_date, img_inbound, img_pallet
            FROM Smart_Phone_Inbound
            WHERE barcode_num = %s
        """, (barcode,))
        inbound_data = cursor.fetchone()

        if not inbound_data:
            conn.rollback()
            return jsonify({'error': '입고 정보 조회 실패'}), 500

        # ✅ MainTable 업데이트
        update_main_query = """
            UPDATE MainTable SET
                company_name = %(company_name)s,
                contact_person = %(contact_person)s,
                contact_phone = %(contact_phone)s,
                product_name = %(product_name)s,
                category = %(category)s,
                width_size = %(width_size)s,
                length_size = %(length_size)s,
                height_size = %(height_size)s,
                warehouse_type = %(warehouse_type)s,
                warehouse_num = %(warehouse_num)s,
                barcode = %(barcode)s,
                barcode_num = %(barcode_num)s,
                contract_date = %(contract_date)s,
                subscription_inbound_date = %(inbound_date)s,
                last_inbound_date = %(inbound_date)s,
                inbound_status = '입고 완료',
                img_inbound = %(img_inbound)s,
                img_pallet = %(img_pallet)s
            WHERE barcode_num = %(barcode_num)s
        """
        cursor.execute(update_main_query, inbound_data)
        conn.commit()

        return jsonify({'message': f'{barcode} 입고 완료 처리 완료 ✅'}), 200

    except Exception as e:
        print("❌ 오류:", e)
        return jsonify({'error': '서버 오류', 'message': str(e)}), 500

    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8050, debug=True)
