from flask import Flask, request, jsonify
import jwt
import mysql.connector
from mysql.connector import Error

app = Flask(__name__)

# JWT 시크릿 키
SECRET_KEY = 'thisissecretkeyforWMSSystemjwtreactconnectwithspringserverthisissecretkeyforWMSSystemjwtreactconnectwithspringserver'

# ✅ DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름",
    "password": "데이터베이스 비밀번호",
    "database": "데이터베이스 이름",
    "charset": "utf8",
}
@app.route('/api/me', methods=['GET'])
def get_user_info():
    # ✅ accessToken 쿠키 읽기
    access_token = request.cookies.get('accessToken')

    if not access_token:
        return jsonify({'message': '토큰 없음'}), 401

    try:
        # ✅ JWT 디코딩
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=['HS256'])
        print('[디코딩된 JWT payload]', payload)

        user_email = payload.get('sub')  # 예: 이메일을 sub에 담았다고 가정
        if not user_email:
            return jsonify({'message': 'JWT에 사용자 이메일 없음'}), 400

        # ✅ DB 연결 및 사용자 정보 조회
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = "SELECT * FROM users WHERE email = %s"
        cursor.execute(query, (user_email,))
        user = cursor.fetchone()

        cursor.close()
        conn.close()

        if not user:
            return jsonify({'message': '사용자 없음'}), 404

        return jsonify(user)

    except jwt.ExpiredSignatureError:
        return jsonify({'message': '토큰 만료'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'message': '유효하지 않은 토큰'}), 403
    except Error as db_err:
        print('[DB 오류]', db_err)
        return jsonify({'message': 'DB 오류'}), 500
    except Exception as e:
        print('[서버 오류]', e)
        return jsonify({'message': '서버 오류'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9000, debug=True)