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

def register_progress_routes(app):
    @app.route('/api/checklist/progress', methods=['GET'])
    def checklist_progress():
        date_param = request.args.get('date')
        if not date_param:
            kst = pytz.timezone('Asia/Seoul')
            date_param = datetime.now(kst).strftime('%Y-%m-%d')

        result = {}
        conn, cursor = get_cursor()

        for direction in ['inbound', 'outbound']:
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN is_checked = 1 THEN 1 ELSE 0 END) AS completed
                FROM Checklist
                WHERE direction = %s AND DATE(created_at) = %s
            """, (direction, date_param))

            row = cursor.fetchone()
            result[direction] = {
                "total": row["total"] or 0,
                "completed": row["completed"] or 0
            }

        cursor.close()
        conn.close()
        return jsonify(result)
