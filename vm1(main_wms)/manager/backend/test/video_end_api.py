# video_end_api.py
from flask import Flask, Blueprint, request, jsonify
import mysql.connector

# ✅ DB 설정
# 데이터베이스 연결 정보
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

# ✅ DB 연결 함수
def get_db_connection():
    """DB 연결을 반환하는 함수"""
    connection = mysql.connector.connect(**db_config)
    return connection

# ✅ 블루프린트 생성
video_end_api = Blueprint('video_end_api', __name__)

@video_end_api.route('/video-end', methods=['POST'])
def video_end():
    try:
        data = request.get_json()
        main_table_id = data.get('main_table_id')
        video_type = data.get('video_type')  # 'start' 또는 'complete'

        if not main_table_id or not video_type:
            return jsonify({"error": "필수 데이터가 누락되었습니다."}), 400

        if video_type == 'start':
            new_status = '출고 준비중'
        elif video_type == 'complete':
            new_status = '출고 준비 완료'
        else:
            return jsonify({"error": "올바른 video_type이 아닙니다."}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        update_query = """
            UPDATE Smart_Phone_Outbound
            SET outbound_status = %s
            WHERE id = %s
        """
        cursor.execute(update_query, (new_status, main_table_id))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": f"출고 상태가 '{new_status}'로 변경되었습니다."}), 200

    except Exception as e:
        print(f"❌ 출고 상태 변경 중 오류 발생: {e}")
        return jsonify({"error": "서버 오류가 발생했습니다."}), 500


