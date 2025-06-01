from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
import os


app = Flask(__name__)
CORS(app)  # React Native 등 외부 요청 허용

# 📌 MariaDB 연결 정보
# 데이터베이스 연결 정보
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

# 🔍 일정 조회 API (subscription_inbound_date 기준)
# ✅ 일정 조회 API (subscription_inbound_date 기준)
@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    date = request.args.get('date')
    if not date:
        return jsonify({'error': '날짜 파라미터가 필요합니다'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT id, company_name, contact_person, contact_phone, product_name, category, inbound_quantity,
                   width_size, length_size, height_size, warehouse_type, warehouse_num, inbound_status,
                   barcode, barcode_num, contract_date, subscription_inbound_date
            FROM MainTable
            WHERE subscription_inbound_date = %s
        """
        cursor.execute(query, (date,))
        results = cursor.fetchall()

        # ✅ barcode 경로 → 파일명만 추출
        for row in results:
            if 'barcode' in row and row['barcode']:
                row['barcode'] = os.path.basename(row['barcode'])

        cursor.close()
        conn.close()
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ✏️ 일정 수정 API
@app.route('/api/schedules/<int:schedule_id>', methods=['PUT'])
def update_schedule(schedule_id):
    data = request.json
    fields = [
        "company_name", "contact_person", "contact_phone", "product_name", "category","inbound_quantity",
        "width_size", "length_size", "height_size", "warehouse_type", "warehouse_num",
        "barcode", "barcode_num", "contract_date", "subscription_inbound_date"
    ]

    update_fields = [f"{field} = %s" for field in fields if field in data]
    update_values = [data[field] for field in fields if field in data]

    if not update_fields:
        return jsonify({'error': '업데이트할 필드가 없습니다'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        query = f"""
            UPDATE MainTable
            SET {', '.join(update_fields)}
            WHERE id = %s
        """
        cursor.execute(query, (*update_values, schedule_id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'message': '일정이 수정되었습니다'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/schedules/status-map', methods=['GET'])
def get_status_map():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT subscription_inbound_date, inbound_status
            FROM MainTable
            WHERE subscription_inbound_date IS NOT NULL
        """)

        status_map = {}  # 일반 dict 사용
        for row in cursor.fetchall():
            date = row['subscription_inbound_date'].isoformat()
            status = row['inbound_status']

            if date not in status_map:
                status_map[date] = set()  # 수동 초기화
            status_map[date].add(status)

        cursor.close()
        conn.close()

        # 집합(set)을 리스트로 변환해서 JSON 직렬화
        result = {date: list(statuses) for date, statuses in status_map.items()}
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ✅ 바코드 이미지 제공 (정적 이미지 파일 반환용)
@app.route('/barcodes/<filename>')
def serve_barcode(filename):
    return send_from_directory('/home/wms/work/manager/backend/inbound/barcode', filename)

    


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8055, debug=True)

