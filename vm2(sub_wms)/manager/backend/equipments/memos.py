from flask import Blueprint, request, jsonify
import mysql.connector
from datetime import datetime
from config import DB_CONFIG

memo_bp = Blueprint("memo", __name__)

# 메모 전체 조회
@memo_bp.route("/memos", methods=["GET"])
def get_memos():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT * FROM memo ORDER BY date DESC")
        memos = cursor.fetchall()
        connection.close()
        return jsonify(memos), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 메모 추가
@memo_bp.route("/memos", methods=["POST"])
def add_memo():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        data = request.json
        query = "INSERT INTO memo (title, content, date, created_by) VALUES (%s, %s, %s, %s)"
        cursor.execute(query, (
            data["title"],
            data.get("content", ""),
            data["date"],
            data.get("created_by", "unknown")  # 나중에 로그인 연동 가능
        ))
        connection.commit()
        connection.close()
        return jsonify({"message": "메모 추가 성공"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 메모 수정
@memo_bp.route("/memos/<int:id>", methods=["PUT"])
def update_memo(id):
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        data = request.json
        query = "UPDATE memo SET title = %s, content = %s, date = %s WHERE id = %s"
        cursor.execute(query, (
            data["title"],
            data["content"],
            data["date"],
            id
        ))
        connection.commit()
        connection.close()
        return jsonify({"message": "메모 수정 완료"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 메모 삭제
@memo_bp.route("/memos/<int:id>", methods=["DELETE"])
def delete_memo(id):
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        cursor.execute("DELETE FROM memo WHERE id = %s", (id,))
        connection.commit()
        connection.close()
        return jsonify({"message": "메모 삭제 완료"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
