# file: status_list.py

from flask import request, jsonify
import mysql.connector
from datetime import datetime
import pytz
from collections import defaultdict

def get_cursor():
    conn = mysql.connector.connect(
        host='연결호스트',
        user='데이터베이스 사용자 이름',
        password='데이터베이스 비밀번호',
        database='데이터베이스 이름'
    )
    return conn, conn.cursor(dictionary=True)

def register_status_list_routes(app):
    @app.route('/api/status-list', methods=['GET'])
    def status_list():
        date_param = request.args.get('date')
        if not date_param:
            kst = pytz.timezone('Asia/Seoul')
            date_param = datetime.now(kst).strftime('%Y-%m-%d')

        conn, cursor = get_cursor()

        # ✅ 입고 상태 목록 조회
        cursor.execute("""
            SELECT id, inbound_status AS status
            FROM MainTable
            WHERE DATE(subscription_inbound_date) = %s
              AND inbound_status IN ('입고 준비', '입고 대기', '입고 중', '미처리')
        """, (date_param,))
        inbound_main = cursor.fetchall()

        # ✅ 출고 상태 목록 조회
        cursor.execute("""
            SELECT id, outbound_status AS status
            FROM MainTable
            WHERE DATE(last_outbound_date) = %s
              AND outbound_status IN ('출고요청', '출고 준비중', '출고 준비 완료', '배차 완료', '미처리')
        """, (date_param,))
        outbound_main = cursor.fetchall()

        # ✅ Checklist 모두 조회
        cursor.execute("""
            SELECT schedule_id, direction, is_checked
            FROM Checklist
            WHERE DATE(created_at) = %s
        """, (date_param,))
        checklist = cursor.fetchall()

        # ✅ 상태별 정리 함수
        def summarize_by_status(main_rows, direction):
            status_group = defaultdict(list)
            for row in main_rows:
                status_group[row["status"]].append(row["id"])

            result = {}
            for status, ids in status_group.items():
                total_check = 0
                completed = 0
                for row in checklist:
                    if row["direction"] == direction and row["schedule_id"] in ids:
                        total_check += 1
                        if row["is_checked"]:
                            completed += 1
                percent = round((completed / total_check) * 100) if total_check else 0
                result[status] = {
    "count": len(ids),
    "completed": completed,
    "percent": percent
}
            return result

        inbound_summary = summarize_by_status(inbound_main, 'inbound')
        outbound_summary = summarize_by_status(outbound_main, 'outbound')

        cursor.close()
        conn.close()

        return jsonify({
            'inbound': inbound_summary,
            'outbound': outbound_summary
        })
