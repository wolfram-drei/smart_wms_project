# file: inbound_unprocessed.py

from flask import request, jsonify
import mysql.connector
from datetime import datetime
import pytz

def get_cursor():
    conn = mysql.connector.connect(
        host='연결호스트',
        user='데이터베이스 사용자 이름',
        password='데이터베이스 비밀번호',
        database='데이터베이스 이름'
    )
    return conn, conn.cursor(dictionary=True)

def register_inbound_unprocessed_routes(app):
    @app.route('/api/inbound/unprocessed', methods=['GET'])
    def get_inbound_unprocessed():
        kst = pytz.timezone('Asia/Seoul')
        today = datetime.now(kst).strftime('%Y-%m-%d')

        conn, cursor = get_cursor()

        cursor.execute("""
            SELECT m.*, c.is_checked
            FROM MainTable m
            LEFT JOIN Checklist c ON m.id = c.schedule_id AND c.direction = 'inbound'
            WHERE DATE(m.subscription_inbound_date) < %s
              AND m.inbound_status IN ('입고 준비', '입고 대기', '입고 중')
        """, (today,))
        rows = cursor.fetchall()

        grouped = {}
        for row in rows:
            sid = row['id']
            if sid not in grouped:
                grouped[sid] = {
                    'id': row['id'],
                    'company_name': row['company_name'],
                    'product_name': row['product_name'],
                    'contract_date': row['contract_date'],
                    'inbound_status': row['inbound_status'],
                    'checklist': []
                }
            if row['is_checked'] is not None:
                grouped[sid]['checklist'].append({'is_checked': row['is_checked']})

        cursor.close()
        conn.close()

        return jsonify(list(grouped.values()))
