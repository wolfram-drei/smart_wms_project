from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
from datetime import datetime, timedelta
import requests
import openai
import re
import pandas as pd
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from config import SECRET_KEY
import jwt

app = Flask(__name__)

# OpenAI API 키 설정
openai.api_key = "키입력"
CORS(app, supports_credentials=True, resources={
    r"/*": {
        "origins": ["http://34.64.211.3:3050", "http://localhost:3050", "http://34.47.73.162:5000"]
    }
})

@app.route("/api/manager/protected", methods=["GET"])
def protected():
    token = request.cookies.get("accessToken")
    print("📌 accessToken from cookie:", token) 
    if not token:
        return jsonify({"error": "Access token missing"}), 401

    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        print("✅ decoded JWT:", decoded)
        user_email = decoded.get("sub")
        user_role = decoded.get("role")
        return jsonify({"email": user_email, "role": user_role})
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Access token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

DB_CONFIG = {
    'host': '연결호스트',
    'user': '사용자',
    'password': '비밀번호',
    'database': '데이터베이스이름',
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

@app.route('/api/manager/dashboard/query', methods=['POST'])
def query():
    user_query = request.json.get('query')
    print("Received query:", user_query)  # 디버깅 로그

    # 사용자 요청 분석: 연속된 날짜 범위 추출
    match = re.search(r'(\d{4})[-년\s]*(\d{1,2})[-월\s]*부터\s(\d{4})?[-년\s]*(\d{1,2})[-월\s]*', user_query)
    if match:
        start_year = match.group(1)
        start_month = match.group(2).zfill(2)
        end_year = match.group(3) if match.group(3) else start_year
        end_month = match.group(4).zfill(2)

        # 시작 월과 종료 월로 범위 구성
        start_date = f"{start_year}-{start_month}-01"
        end_date = f"{end_year}-{end_month}-31"  # 종료 월의 마지막 날로 설정
    else:
        return jsonify(response="올바른 날짜 범위를 입력해주세요. 예: 2024년 5월부터 12월까지", labels=[], quantities=[])

    print("Extracted date range:", start_date, "to", end_date)

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT inbound_date, outbound_status, inbound_quantity
            FROM MainTable
            WHERE inbound_date BETWEEN %s AND %s AND outbound_status = '입고완료'
        """
        cursor.execute(query, (start_date, end_date))
        stats = cursor.fetchall()
        print("Query results:", stats)

        cursor.close()
        connection.close()

        if not stats:
            return jsonify(response=f"{start_date}부터 {end_date}까지의 데이터가 없습니다.", labels=[], quantities=[])

        # 데이터 처리
        data = [{
            "inbound_date": record['inbound_date'].strftime('%Y-%m-%d') if record['inbound_date'] else None,
            "inbound_quantity": record['inbound_quantity']
        } for record in stats]
        print("Processed data:", data)

        df = pd.DataFrame(data)
        monthly_data = df.groupby('inbound_date')['inbound_quantity'].sum()
        total_quantity = monthly_data.sum()
        details = "\n".join([f"- {date}: {quantity}개의 제품이 입고완료되었습니다."
                             for date, quantity in monthly_data.items()])

        summary_prompt = (f"{start_year}년 {start_month}월부터 {end_year}년 {end_month}월까지 "
                          f"입고된 제품은 총 {total_quantity}개 입니다. "
                          f"이는 다음과 같이 분류됩니다:\n{details}")

        gpt_response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": summary_prompt}],
            max_tokens=300
        )
        print("GPT response:", gpt_response)

        labels = monthly_data.index.astype(str).tolist()
        quantities = monthly_data.tolist()

        return jsonify(
            response=gpt_response['choices'][0]['message']['content'],
            labels=labels,
            quantities=quantities
        )
    except Exception as e:
        print("Error:", str(e))
        return jsonify(response="서버 처리 중 오류가 발생했습니다.", labels=[], quantities=[])

@app.route('/api/manager/dashboard/statistics', methods=['GET'])
def get_dashboard_statistics():
    print("통계 API 호출됨")
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                COUNT(CASE WHEN estimate_description IS NOT NULL THEN 1 END) as estimate_count,
                COUNT(CASE WHEN inbound_status = '입고 완료' THEN 1 END) as inbound_count,
                COUNT(CASE WHEN outbound_status = '출고완료' THEN 1 END) as outbound_count,
                COALESCE(SUM(CASE WHEN total_cost IS NOT NULL THEN total_cost ELSE 0 END), 0) as total_revenue
            FROM MainTable
        """
        cursor.execute(query)
        stats = cursor.fetchone()
        print("조회된 통계:", stats)
        
        response_data = {
            'success': True,
            'data': {
                'totalContracts': stats['estimate_count'] or 0,
                'totalProducts': stats['inbound_count'] or 0,
                'totalInquiries': stats['outbound_count'] or 0,
                'totalRevenue': format(float(stats['total_revenue'] or 0), ',')
            }
        }
        print("응답 데이터:", response_data)
        return jsonify(response_data)
    except Exception as e:
        print("에러 발생:", str(e))
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/api/manager/dashboard/status-distribution', methods=['GET'])
def get_status_distribution():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        query = """
            SELECT inbound_status, COUNT(*) as count
            FROM MainTable
            GROUP BY inbound_status
        """
        cursor.execute(query)
        results = cursor.fetchall()
        
        labels = []
        data = []
        for status, count in results:
            labels.append(status)
            data.append(count)

        return jsonify({
            'success': True,
            'data': {
                'labels': labels,
                'datasets': [{
                    'data': data,
                    'backgroundColor': ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
                }]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/manager/dashboard/monthly-contracts', methods=['GET'])
def get_monthly_contracts():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        six_months_ago = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
        
        query = """
            SELECT 
                YEAR(contract_date) as year,
                MONTH(contract_date) as month,
                COUNT(*) as count
            FROM MainTable
            WHERE contract_date >= %s
            GROUP BY YEAR(contract_date), MONTH(contract_date)
            ORDER BY year, month
        """
        cursor.execute(query, (six_months_ago,))
        results = cursor.fetchall()
        
        labels = []
        data = []
        for year, month, count in results:
            labels.append(f'{month}월')
            data.append(count)

        return jsonify({
            'success': True,
            'data': {
                'labels': labels,
                'datasets': [{
                    'label': '월별 계약 현황',
                    'data': data,
                    'backgroundColor': '#36A2EB'
                }]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/manager/dashboard/recent-contracts', methods=['GET'])
def get_recent_contracts():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                company_name,
                product_name,
                inbound_status,
                contract_date,
                inbound_date,
                total_cost
            FROM MainTable
            ORDER BY contract_date DESC
            LIMIT 10
        """
        cursor.execute(query)
        contracts = cursor.fetchall()
        
        contracts_list = []
        for contract in contracts:
            contracts_list.append({
                'customerName': contract['company_name'],
                'productName': contract['product_name'],
                'status': contract['inbound_status'],
                'contractDate': contract['contract_date'].strftime('%Y-%m-%d') if contract['contract_date'] else None,
                'inboundDate': contract['inbound_date'].strftime('%Y-%m-%d') if contract['inbound_date'] else None,
                'amount': format(float(contract['total_cost']), ',') if contract['total_cost'] else '0'
            })

        return jsonify({
            'success': True,
            'data': contracts_list
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/manager/dashboard/storage-status', methods=['GET'])
def get_storage_status():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                COUNT(CASE WHEN inbound_status = '입고 완료' THEN 1 END) as inbound_complete,
                COUNT(CASE WHEN inbound_status = '입고 준비' THEN 1 END) as inbound_ready,
                COUNT(CASE WHEN outbound_status = '출고요청' THEN 1 END) as outbound_request,
                COUNT(CASE WHEN outbound_status = '출고완료' THEN 1 END) as outbound_complete,
                COUNT(CASE WHEN contract_date IS NULL THEN 1 END) as contract_waiting,
                COUNT(CASE WHEN contract_date IS NOT NULL THEN 1 END) as contract_complete
            FROM MainTable
        """
        cursor.execute(query)
        stats = cursor.fetchone()
        
        return jsonify({
            'success': True,
            'data': {
                'inboundComplete': stats['inbound_complete'] or 0,
                'inboundReady': stats['inbound_ready'] or 0,
                'outboundRequest': stats['outbound_request'] or 0,
                'outboundComplete': stats['outbound_complete'] or 0,
                'contractWaiting': stats['contract_waiting'] or 0,
                'contractComplete': stats['contract_complete'] or 0
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/api/manager/dashboard/inquiries', methods=['GET'])
def get_inquiries():
    try:
        # qna_app.py 서버로 요청 전달
        response = requests.get('http://34.64.126.43:5020/api/inquiries')
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"문의사항 조회 실패: {response.status_code}")
            return jsonify({'success': False, 'error': '문의사항 조회 실패'}), response.status_code
            
    except Exception as e:
        print(f"문의사항 조회 중 에러: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/manager/dashboard/notices', methods=['GET'])
def get_notices():
    try:
        # notices_app.py 서버로 요청 전달
        response = requests.get('http://34.64.126.43:5020/api/notices')
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"공지사항 조회 실패: {response.status_code}")
            return jsonify({'success': False, 'error': '공지사항 조회 실패'}), response.status_code
            
    except Exception as e:
        print(f"공지사항 조회 중 에러: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/manager/dashboard/storage-items', methods=['GET'])
def get_storage_items():
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # 모든 상태의 물품 데이터 조회 (고객 대시보드와 동일한 쿼리)
        items_query = """
            SELECT 
                id,
                company_name,
                product_name,
                product_number,
                category,
                warehouse_location,
                warehouse_type,
                inbound_status,
                outbound_status,
                inbound_date,
                outbound_date,
                storage_duration,
                total_cost,
                contract_date
            FROM MainTable
        """
        cursor.execute(items_query)
        all_items = cursor.fetchall()

        # 상태별 통계 조회
        stats_query = """
            SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN inbound_status = '입고 완료' AND 
                    (outbound_status IS NULL OR outbound_status != '출고완료') 
                    THEN total_cost ELSE 0 END) as active_total_cost,
                COUNT(CASE WHEN inbound_status = '입고 완료' THEN 1 END) as inbound_complete,
                COUNT(CASE WHEN inbound_status = '입고 준비' THEN 1 END) as inbound_ready,
                COUNT(CASE WHEN outbound_status = '출고요청' THEN 1 END) as outbound_request,
                COUNT(CASE WHEN outbound_status = '출고완료' THEN 1 END) as outbound_complete
            FROM MainTable
        """
        cursor.execute(stats_query)
        stats = cursor.fetchone()
        
        # 날짜 형식 변환
        for item in all_items:
            if item['inbound_date']:
                item['inbound_date'] = item['inbound_date'].strftime('%Y-%m-%d')
            if item['outbound_date']:
                item['outbound_date'] = item['outbound_date'].strftime('%Y-%m-%d')
        
        return jsonify({
            'success': True,
            'data': {
                'items': all_items,
                'statistics': {
                    'totalItems': stats['total_items'] or 0,
                    'totalCost': float(stats['active_total_cost'] or 0),
                    'statusCounts': {
                        'inboundComplete': stats['inbound_complete'] or 0,
                        'inboundReady': stats['inbound_ready'] or 0,
                        'outboundRequest': stats['outbound_request'] or 0,
                        'outboundComplete': stats['outbound_complete'] or 0
                    }
                }
            }
        })
        
    except Exception as e:
        print(f"에러 발생: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
