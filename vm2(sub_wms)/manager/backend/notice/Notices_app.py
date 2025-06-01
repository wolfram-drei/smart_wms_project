from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import pandas as pd
from datetime import datetime


app = Flask(__name__)
CORS(app)

# MySQL 데이터베이스 연결 설정
db_config = {
    'host': '호스트',       # MySQL 호스트 (GCP 인스턴스의 IP 또는 로컬)
    'user': '사용자',             # MySQL 사용자
    'password': '비밀번호',        # MySQL 비밀번호
    'database': '데이터베이스 이름',      # MySQL 데이터베이스 이름
    'autocommit': True
}

def get_db_connection():
    """MySQL 데이터베이스 연결"""
    return mysql.connector.connect(**db_config)

@app.route('/api/notices', methods=['GET', 'POST'])
def manage_notices():
    if request.method == 'GET':
        # 검색 키워드 받기
        search_query = request.args.get('search', '')  # 기본값은 빈 문자열

        # MySQL 데이터를 Pandas DataFrame으로 로드
        conn = get_db_connection()
        query = "SELECT * FROM notices"
        notices_df = pd.read_sql(query, conn)
        conn.close()

        # 'date' 필드 형식 변경 (YYYY-MM-DD)
        if 'date' in notices_df.columns:
            notices_df['date'] = pd.to_datetime(notices_df['date']).dt.strftime('%Y-%m-%d')

        # 검색 필터 적용
        if search_query:
            # 제목, 작성자, 내용, 작성일 기준으로 필터링
            search_query = search_query.lower()
            notices_df = notices_df[
                notices_df['title'].str.lower().str.contains(search_query, na=False) |
                notices_df['author'].str.lower().str.contains(search_query, na=False) |
                notices_df['content'].str.lower().str.contains(search_query, na=False) |
                notices_df['date'].str.contains(search_query, na=False)
            ]

        return notices_df.to_json(orient='records')  # 데이터를 JSON으로 반환

    if request.method == 'POST':
        # 새 공지사항 추가
        new_notice = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "INSERT INTO notices (title, content, author) VALUES (%s, %s, %s)"
        cursor.execute(query, (new_notice['title'], new_notice['content'], new_notice['author']))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Notice added successfully'}), 201

@app.route('/api/notices/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def notice_detail(id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    if request.method == 'GET':
        # 특정 공지사항 반환
        query = "SELECT * FROM notices WHERE id = %s"
        cursor.execute(query, (id,))
        notice = cursor.fetchone()
        conn.close()
        if notice:
            # 날짜 필드 형식 변경
            if 'date' in notice and notice['date']:
                notice['date'] = notice['date'].strftime('%Y-%m-%d')
            return jsonify(notice)
        else:
            return jsonify({'error': 'Notice not found'}), 404

    if request.method == 'PUT':
        # 공지사항 수정
        updated_notice = request.json
        query = "UPDATE notices SET title = %s, content = %s, author = %s WHERE id = %s"
        cursor.execute(query, (updated_notice['title'], updated_notice['content'], updated_notice['author'], id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Notice updated successfully'})

    if request.method == 'DELETE':
        # 공지사항 삭제
        query = "DELETE FROM notices WHERE id = %s"
        cursor.execute(query, (id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Notice deleted successfully'})
    




if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

