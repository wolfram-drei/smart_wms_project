from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import mysql.connector
from datetime import datetime
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO
from jwt import decode, ExpiredSignatureError
import requests

# 비밀키 설정 (같은 키로 서명된 JWT만 유효함)
SECRET_KEY = "scret_key_for_jwt"

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://34.64.211.3:3000",
            "http://34.64.211.3:4000",
            "http://34.64.211.3:4001",
            "http://34.64.211.3:4002",  
            "http://34.64.211.3:5003"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True  # 쿠키 전송을 허용
    }
})

DB_CONFIG = {
    'host': '연결호스트',
    'user': '사용자이름',
    'password': '비밀번호',
    'database': '데이터베이스이름',
}

# 데이터베이스 연결 함수
def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


# 출고 요청서 생성 및 상태 업데이트
@app.route('/create-outbound-request', methods=['POST'])
def create_outbound_request():
    data = request.json
    request_id = data['id']

    token = request.cookies.get("accessToken")
    if not token:
        return jsonify({"error": "Authorization token is required"}), 401

    try:
        decoded = decode(token, SECRET_KEY, algorithms=["HS256"])
        user_email = decoded.get("sub")
    except ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # 기존 데이터 가져오기
        cursor.execute("""
            SELECT subscription_inbound_date, outbound_date, total_cost
            FROM MainTable
            WHERE id = %s
        """, (request_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "요청 데이터를 찾을 수 없습니다."}), 404

        inbound_date = row['subscription_inbound_date']
        outbound_date = row['outbound_date']
        # 디버그용 로그 추가
        print(f"[디버그] subscription_inbound_date: {inbound_date}, outbound_date: {outbound_date}")
        if not inbound_date or not outbound_date:
            return jsonify({"error": "subscription_inbound_date 또는 outbound_date 값이 없습니다."}), 400
        
        total_cost = row['total_cost']

        today = datetime.now().date()

        expected_days = (outbound_date - inbound_date).days
        actual_days = (today - inbound_date).days

        if expected_days <= 0:
            expected_days = 1  # 나누기 방지용

        unit_cost = total_cost / expected_days

        # ✅ 비용 재계산 로직
        if actual_days < expected_days:
            new_total_cost = round(unit_cost * actual_days, 2)
            cost_difference = new_total_cost - total_cost
            message = f"{abs(cost_difference):,.2f}원 감액되었습니다."
        elif actual_days > expected_days:
            new_total_cost = round(unit_cost * actual_days, 2)
            cost_difference = new_total_cost - total_cost
            message = f"{cost_difference:,.2f}원 추가 청구됩니다."
        else:
            new_total_cost = total_cost
            cost_difference = 0
            message = "예정일에 맞게 출고되었습니다. 비용 변동 없음."

        # 잘라내기 방어 (만약 너무 크거나 음수로 계산된 경우 대비))
        if new_total_cost > 9999999999:
            new_total_cost = 9999999999
        elif new_total_cost < 0:
            new_total_cost = 0

        # 디버그 로그 추가
        print(f"[디버그] expected_days: {expected_days}, actual_days: {actual_days}")
        print(f"[디버그] unit_cost: {unit_cost}, new_total_cost: {new_total_cost}") 
        print(f"[디버그] cost_difference: {cost_difference}") 

        # 업데이트 쿼리 실행 (출고요청 상태 및 날짜, 추가비용 반영)
        cursor.execute("""
            UPDATE MainTable
            SET 
                outbound_status = '출고요청',
                last_outbound_date = %s,
                total_cost = %s,
                cost_difference = %s
            WHERE id = %s
        """, (today, new_total_cost, cost_difference, request_id))

        connection.commit()

        return jsonify({
            "비용차이": round(cost_difference, 2),
            "최종청구비용": round(new_total_cost, 2),
            "설명": message
        }), 200

    except Exception as e:
        connection.rollback()
        print(f"[❌ 서버 에러] 출고 요청 처리 중 오류 발생: {str(e)}")  # 이런 로그 찍혀야 함
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        connection.close()


# PDF 출고 요청서 생성
@app.route('/generate-outbound-pdf/<int:request_id>', methods=['GET'])
def generate_outbound_pdf(request_id):
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        token = request.cookies.get("accessToken")
        if not token:
            return jsonify({"error": "Authorization token is required"}), 401

        try:
            decoded = decode(token, SECRET_KEY, algorithms=["HS256"])
            user_email = decoded.get("sub")
        except ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        
        # MainTable에서 직접 데이터 조회
        query = """
        SELECT 
            company_name,
            product_name,
            product_number,
            inbound_quantity,
            warehouse_location,
            warehouse_type,
            warehouse_num,
            outbound_status,
            contract_date
        FROM MainTable
        WHERE id = %s
        """
        cursor.execute(query, (request_id,))
        data = cursor.fetchone()
        
        if not data:
            return jsonify({"error": "요청을 찾을 수 없습니다."}), 404
            
        # 현재 날짜
        current_date = datetime.now().strftime('%Y-%m-%d')
            
        # PDF 생성
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        
        # 폰트 설정 (한글 지원)
        pdfmetrics.registerFont(TTFont('NanumGothic', 'NanumGothic.ttf'))
        p.setFont('NanumGothic', 12)
        
        # PDF 내용 작성
        p.drawString(250, 800, "출고 요청서")
        p.drawString(50, 750, f"업체명: {data['company_name']}")
        p.drawString(50, 730, f"상품명: {data['product_name']}")
        p.drawString(50, 710, f"제품번호: {data['product_number']}")
        p.drawString(50, 690, f"현재 재고: {data['inbound_quantity']}")
        p.drawString(50, 670, f"창고위치: {data['warehouse_location']}")
        p.drawString(50, 650, f"창고타입: {data['warehouse_type']}")
        p.drawString(50, 630, f"창고번호: {data['warehouse_num']}")
        p.drawString(50, 610, f"출고상태: {data['outbound_status']}")
        p.drawString(50, 590, f"계약일: {data['contract_date']}")
        p.drawString(50, 570, f"출력일: {current_date}")
        
        p.save()
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f'outbound_request_{request_id}.pdf',
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"PDF Generation Error: {str(e)}")  # 에러 로깅 추가
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        connection.close()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5013)