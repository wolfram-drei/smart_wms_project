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

def register_outbound_unprocessed_routes(app):
    @app.route('/api/outbound/unprocessed', methods=['GET'])
    def get_outbound_unprocessed():
        kst = pytz.timezone('Asia/Seoul')
        today = datetime.now(kst).strftime('%Y-%m-%d')

        conn, cursor = get_cursor()

        # ✅ 미처리 조건: 오늘 이전 + 출고 상태가 미완료 상태
        cursor.execute("""
            SELECT m.*, c.is_checked
            FROM MainTable m
            LEFT JOIN Checklist c ON m.id = c.schedule_id AND c.direction = 'outbound'
            WHERE DATE(m.last_outbound_date) < %s
              AND m.outbound_status IN ('출고요청', '출고 준비중', '출고 준비 완료', '배차 완료')
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
                    'warehouse_num': row['warehouse_num'],
                    'barcode_num': row['barcode_num'],
                    'outbound_status': row['outbound_status'],
                    'checklist': []
                }
            if row['is_checked'] is not None:
                grouped[sid]['checklist'].append({'is_checked': row['is_checked']})

        # ✅ 각 항목에 percent 계산 추가
        total_tasks = 0
        completed_tasks = 0

        for item in grouped.values():
            total = len(item['checklist'])
            completed = sum(1 for c in item['checklist'] if c['is_checked'])
            percent = round((completed / total) * 100) if total > 0 else 0
            item['percent'] = percent
            total_tasks += total
            completed_tasks += completed

        # ✅ 전체 미처리 상태 요약 정보
        summary = {
            'count': len(grouped),
            'percent': round((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0
        }

        cursor.close()
        conn.close()

        return jsonify({
            'summary': summary,
            'data': list(grouped.values())
        })
