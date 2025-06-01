from flask import Flask, request, jsonify
import mysql.connector
from datetime import datetime
import requests
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# DB 연결 설정
def get_db_connection():
    try:
        return mysql.connector.connect(
            host="연결호스트",
            user="이름",
            password="비밀번호",
            database="db이름"
        )
    except mysql.connector.Error as e:
        print(f"[ERROR] Failed to connect to the database: {e}")
        raise


# 문의사항 조회 및 추가 API
@app.route('/api/inquiries', methods=['GET', 'POST'])
def manage_inquiries():
    cursor = None
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == 'GET':
            search_query = request.args.get('search', '').strip()

            query = "SELECT id, title, content, author_email, date FROM inquiries"
            params = []

            if search_query:
                query += " WHERE LOWER(title) LIKE LOWER(%s) OR LOWER(content) LIKE LOWER(%s)"
                params.extend([f"%{search_query}%", f"%{search_query}%"])

            cursor.execute(query, params)
            inquiries = cursor.fetchall()

            for inquiry in inquiries:
                inquiry['date'] = inquiry['date'].strftime('%Y-%m-%d')

            return jsonify({"inquiries": inquiries}), 200

        elif request.method == 'POST':
            data = request.get_json()
            title = data.get('title', '').strip()
            content = data.get('content', '').strip()
            author_email = data.get('author_email', '').strip()

            if not title or not content or not author_email:
                print("[ERROR] Title, content, and author_email are required.")
                return jsonify({'error': 'Title, content, and author_email are required'}), 400

            query = "INSERT INTO inquiries (title, content, author_email, date) VALUES (%s, %s, %s, %s)"
            cursor.execute(query, (title, content, author_email, datetime.utcnow()))
            conn.commit()

            return jsonify({'message': 'Inquiry added successfully'}), 201

        return jsonify({'error': 'Method not allowed'}), 405

    except mysql.connector.Error as e:
        print(f"[ERROR] Database error: {e}")
        return jsonify({'error': f"Database error: {e}"}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return jsonify({'error': f"Unexpected error: {e}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# 📌 상세 조회, 수정, 삭제 API
@app.route('/api/inquiries/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def inquiry_detail(id):
    cursor = None
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if request.method == 'GET':
            cursor.execute("SELECT * FROM inquiries WHERE id = %s", (id,))
            inquiry = cursor.fetchone()
            if inquiry:
                inquiry['date'] = inquiry['date'].strftime('%Y-%m-%d')
                return jsonify(inquiry)
            else:
                return jsonify({'error': 'Inquiry not found'}), 404

        if request.method == 'PUT':
            data = request.get_json()
            title = data.get('title', '').strip()
            content = data.get('content', '').strip()
            author_email = data.get('author_email', '').strip()

            if not title or not content or not author_email:
                return jsonify({'error': 'All fields are required'}), 400

            cursor.execute(
                "UPDATE inquiries SET title=%s, content=%s, author_email=%s WHERE id=%s",
                (title, content, author_email, id)
            )
            conn.commit()
            return jsonify({'message': 'Inquiry updated successfully'}), 200

        if request.method == 'DELETE':
            cursor.execute("DELETE FROM inquiries WHERE id = %s", (id,))
            conn.commit()
            return jsonify({'message': 'Inquiry deleted successfully'}), 200

    except mysql.connector.Error as e:
        print(f"[ERROR] Database error: {e}")
        return jsonify({'error': f"Database error: {e}"}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return jsonify({'error': f"Unexpected error: {e}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

#답글 작성
@app.route('/api/comments', methods=['POST'])
def add_comment():
    cursor = None
    conn = None
    try:
        data = request.get_json()
        inquiry_id = data.get('inquiry_id')
        comment = data.get('content')
        admin_email = data.get('author')
        date = datetime.utcnow()

        if not inquiry_id or not comment or not admin_email:
            return jsonify({'error': 'Missing fields'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO inquiry_comments (inquiry_id, comment, admin_email, date) VALUES (%s, %s, %s, %s)",
            (inquiry_id, comment, admin_email, date)
        )
        conn.commit()
        return jsonify({'message': 'Comment added'}), 201
    except Exception as e:
        print(f"[ERROR] Failed to add comment: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# 답글 확인
@app.route('/api/comments/<int:inquiry_id>', methods=['GET'])
def get_comments(inquiry_id):
    cursor = None
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = "SELECT id, inquiry_id, comment AS content, admin_email AS author, date FROM inquiry_comments WHERE inquiry_id = %s ORDER BY date ASC"
        cursor.execute(query, (inquiry_id,))
        comments = cursor.fetchall()

        for comment in comments:
            comment['date'] = comment['date'].strftime('%Y-%m-%d %H:%M')

        return jsonify(comments), 200
    except Exception as e:
        print(f"[ERROR] Failed to fetch comments: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5088, debug=True)
