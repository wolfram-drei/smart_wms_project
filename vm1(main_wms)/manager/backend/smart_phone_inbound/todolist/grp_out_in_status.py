# grp_out_in_status.py

from flask import jsonify
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


def register_summary_routes(app):
    @app.route('/api/summary-status', methods=['GET'])
    def summary_status():
        kst = pytz.timezone('Asia/Seoul')
        today = datetime.now(kst).strftime('%Y-%m-%d')
        conn, cursor = get_cursor()

        # ✅ 입고 상태 카운트
        cursor.execute("""
            SELECT inbound_status AS status, COUNT(*) AS count
            FROM MainTable
            WHERE DATE(subscription_inbound_date) = %s
            GROUP BY inbound_status
        """, (today,))
        inbound_rows = cursor.fetchall()

        # ✅ 출고 상태 카운트 (last_outbound_date 기준으로 수정 필요 시 여기도 바꿔야 함)
        cursor.execute("""
            SELECT outbound_status AS status, COUNT(*) AS count
            FROM MainTable
            WHERE DATE(last_outbound_date) = %s
            GROUP BY outbound_status
        """, (today,))
        outbound_rows = cursor.fetchall()

        # ✅ None 값 제거 후 일반 딕셔너리로 반환
        inbound_result = {
            row['status']: row['count']
            for row in inbound_rows
            if row['status'] is not None
        }

        outbound_result = {
            row['status']: row['count']
            for row in outbound_rows
            if row['status'] is not None
        }

        cursor.close()
        conn.close()

        return jsonify({
            'inbound': inbound_result,
            'outbound': outbound_result
        })
