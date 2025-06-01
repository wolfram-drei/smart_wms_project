from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from openai import OpenAI
import mysql.connector
import json
import jwt
from datetime import datetime, timedelta
from rag_engine import generate_rag_answer

client = OpenAI(api_key='키입력')
SECRET_KEY = "scret_key_for_jwt"

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://34.64.211.3:3000",
            "http://34.64.211.3:4000",
            "http://34.64.211.3:4001",
            "http://34.64.211.3:4002",  
            "http://34.64.211.3:5003",
            "http://34.64.211.3:3050"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True  # 쿠키 전송을 허용
    }
})

DB_CONFIG = {
    'host': '연결호스트',
    'user': '사용자',
    'password': '비밀번호',
    'database': '데이터베이스이름',
}

# 쿠키에서 JWT 추출하는 함수
def get_user_from_token():
    token = request.cookies.get("accessToken")
    if not token:
        return None, None, "Access token is missing"
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_email = decoded.get("sub")

        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM users WHERE email = %s", (user_email,))
        result = cursor.fetchone()
        role = result[0] if result else 'user'
        return user_email, role, None
    except jwt.ExpiredSignatureError:
        return None, None, "Access token expired"
    except jwt.InvalidTokenError:
        return None, None, "Invalid token"
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# 인텐트 데이터
with open('chatbot_intents.json', 'r', encoding='utf-8') as f:
    intents_data = json.load(f)
intent_to_action = {item['intent']: item['action_name'] for item in intents_data}

# GPT로 인텐트 분류하는 함수
def classify_intent(user_message):
    intent_list = "\n".join([
        f"- {item['intent']}: {item['description']}"
        for item in intents_data
    ])
    prompt = f"""
            당신은 WMS 시스템 고객지원 챗봇입니다.
            아래 인텐트 목록 중에서 사용자 질문과 가장 관련 있는 인텐트 이름을 '딱 하나만' 영어 소문자로 반환하세요.
            인텐트 목록:
            {intent_list}
            사용자 질문: "{user_message}"
            정답 형식: outbound_estimate_count (다른 말 없이 인텐트 이름만)
            """
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "당신은 인텐트 분류 시스템입니다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[GPT 오류] {e}")
        return "unknown"

# flow_type(inbound인지, outbound인지)자동 추론 함수
def detect_flow_type(user_message):
    """
    사용자의 질문 안에서 '출고' 또는 '입고' 키워드를 탐지해서 flow_type을 결정한다.
    기본은 'outbound'로 한다.
    """
    if "입고" in user_message:
        return 'inbound'
    else:
        return 'outbound'
    
# 사용자 질문에서 기간 파라미터 추출 함수
def extract_date_range_with_gpt(user_message):
    today_str = datetime.today().strftime('%Y-%m-%d')  # 현재 날짜 가져오기
    prompt = f"""
            오늘 날짜는 "{today_str}"입니다.
            "{user_message}"이라는 질문에서 의미하는 날짜 범위를 시작일과 종료일로 파악해서 알려주세요.
            반드시 다음과 같은 형식으로 답해주세요:

            시작일, 종료일 (YYYY-MM-DD, YYYY-MM-DD)

            예:  
            - "오늘 출고 예정 몇 건 있어?" → "{today_str}, {today_str}"  
            - "5월 첫째 주 입고는 몇 건이야?" → "2025-05-01, 2025-05-07"

            **날짜만**, 쉼표로 구분해서 출력하고 다른 말은 하지 마세요.
            """
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "당신은 사용자 질문에서 날짜 범위를 추출하는 보조 시스템입니다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0
        )
        content = response.choices[0].message.content.strip()
        parts = content.split(",")
        if len(parts) == 2:
            start = parts[0].strip()
            end = parts[1].strip()
            return start, end
    except Exception as e:
        print(f"[GPT 날짜 파싱 오류] {e}")
    return None, None

# 회사명 추출 함수
def extract_company_name(user_message):
    """
    사용자의 질문 안에서 '삼성', '현대' 등의 회사명을 추출한다.
    """
    prompt = f"""
    사용자가 다음과 같이 질문했습니다:
    "{user_message}"
    이 질문에 등장하는 특정 '회사 이름'만 딱 한 단어로 출력하세요. 
    없으면 '없음'이라고만 답하세요.
    예시:
    - "삼성의 출고 현황 보여줘" → 삼성
    - "삼성전자 출고 현황" → 삼성전자
    - "출고량 알려줘" → 없음
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "당신은 문장에서 회사 이름만 추출하는 도우미입니다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0
        )
        result = response.choices[0].message.content.strip()
        return None if result == "없음" else result
    except Exception as e:
        print(f"[회사명 추출 오류] {e}")
        return None
    
# ---------------------------
# 기능별 함수
# ---------------------------
# 1.입/출고 요청 건수 계산
def get_estimate_count(user_email, user_message, flow_type, role):
    # 시작날짜, 끝날짜 추출
    start_date, end_date = extract_date_range_with_gpt(user_message)
    if not start_date or not end_date:
        return "날짜를 정확히 이해하지 못했습니다. 예: '이번 주', '오늘', '5월 첫째 주'처럼 말씀해 주세요."
    # 회사명 추출
    company_name = extract_company_name(user_message)
    # user인데 타사 요청을 했는지 확인
    if role == 'user' and company_name:
        # 현재 로그인된 사용자의 회사명 조회
        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            cursor = conn.cursor()
            cursor.execute("SELECT company_name FROM MainTable WHERE email = %s LIMIT 1", (user_email,))
            result = cursor.fetchone()
            user_company = result[0] if result else None
        finally:
            if conn.is_connected():
                cursor.close()
                conn.close()
        if user_company and company_name not in user_company:
            return f"현재 로그인한 사용자에게 '{company_name}' 회사의 데이터에 대한 조회 권한이 없습니다."
    # flow_type: 'outbound' 또는 'inbound'
    if flow_type == 'outbound':
        date_field = 'outbound_date'
        status_values = ('출고요청','출고 준비중','출고 준비 완료','출고완료')
    else:
        date_field = 'subscription_inbound_date'
        status_values = ('입고 준비','입고 대기','입고 중','입고 완료')
    status_field = f"{flow_type}_status"  # outbound_status 또는 inbound_status
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        query = f"""
            SELECT COUNT(*) FROM MainTable
            WHERE {date_field} BETWEEN %s AND %s
              AND {status_field} IN (%s, %s, %s, %s)
        """
        params = [start_date, end_date, *status_values]
        # 조건 분기: 회사명 or 이메일
        if role == 'admin' and company_name:
            query += " AND company_name = LIKE %s"
            params.append(company_name)
        else:
            query += " AND email = %s"
            params.append(user_email)
        cursor.execute(query, params)
        count = cursor.fetchone()[0]
        return f"{start_date} ~ {end_date} {company_name or ''} {flow_type.upper()} 예정 건수는 총 {count}건입니다."
    except Exception as e:
        print(f"[{flow_type.upper()} 수량 계산 오류] {e}")
        return f"{flow_type.upper()} 수량을 계산하는 중 오류가 발생했습니다."
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

# 2.입/출고 요청 현황이나 목록
def query_requests(user_email, user_message, flow_type, role):
    # 시작날짜, 끝날짜 추출
    start_date, end_date = extract_date_range_with_gpt(user_message)
    if not start_date or not end_date:
        return "날짜를 정확히 이해하지 못했습니다. 예: '이번 주', '오늘', '5월 첫째 주'처럼 말씀해 주세요."
    # 회사명 추출
    company_name = extract_company_name(user_message)
    # user인데 타사 요청을 했는지 확인
    if role == 'user' and company_name:
        # 현재 로그인된 사용자의 회사명 조회
        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            cursor = conn.cursor()
            cursor.execute("SELECT company_name FROM MainTable WHERE email = %s LIMIT 1", (user_email,))
            result = cursor.fetchone()
            user_company = result[0] if result else None
        finally:
            if conn.is_connected():
                cursor.close()
                conn.close()
        if user_company and company_name not in user_company:
            return f"현재 로그인한 사용자에게 '{company_name}' 회사의 데이터에 대한 조회 권한이 없습니다."
    # flow_type: 'outbound' 또는 'inbound'
    if flow_type == 'outbound':
        date_field = 'outbound_date'
        status_values = ('출고요청','출고 준비중','출고 준비 완료','출고완료')
    else:
        date_field = 'subscription_inbound_date'
        status_values = ('입고 준비','입고 대기','입고 중','입고 완료')
    status_field = f"{flow_type}_status"  # outbound_status 또는 inbound_status
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        query = f"""
            SELECT company_name, product_name, {status_field}, {date_field}
            FROM MainTable
            WHERE {date_field} BETWEEN %s AND %s
              AND {status_field} IN (%s, %s, %s, %s)
        """
        params = [start_date, end_date, *status_values]
        # 조건 분기: 회사명 or 이메일
        if role == 'admin' and company_name:
            query += " AND company_name LIKE %s"
            params.append(f"%{company_name}%")
        else:
            query += " AND email = %s"
            params.append(user_email)
        query += f" ORDER BY {date_field} DESC LIMIT 5"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        if not rows:
            return f"{start_date}부터 {end_date}까지 {flow_type.upper()} 없습니다."
         # ✅ HTML 테이블 생성
        table_html = f"""
        <div>{start_date} ~ {end_date}</div>
        <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead style="background-color: #6f47c5; color: white;">
                <tr>
                    <th style="padding: 8px; border: 1px solid #ccc;">회사명</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">상품명</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">상태</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">예정일</th>
                </tr>
            </thead>
            <tbody>
        """
        for row in rows:
            status_value = row[status_field]  # ✅ 컬럼명 문자열로 접근
            date_value = row[date_field].strftime('%Y-%m-%d')  # ✅ 컬럼명 문자열로 접근
            table_html += f"""
                <tr style="background-color: #f5f0ff;">
                    <td style="padding: 8px; border: 1px solid #ccc;">{row['company_name']}</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">{row['product_name']}</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">{status_value}</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">{date_value}</td>
                </tr>
            """
        table_html += "</tbody></table>"
        return table_html
    except Exception as e:
        print(f"[{flow_type.upper()} 조회 오류] {e}")
        return f"{flow_type.upper()} 데이터를 불러오는 데 실패했습니다."
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

# 3. 날짜별 입/출고 상태 그래프
def get_status_chart_data(user_email, user_message, flow_type, role):
    # 시작날짜, 끝날짜 추출
    start_date, end_date = extract_date_range_with_gpt(user_message)
    if not start_date or not end_date:
        return {
            "chart_type": "bar",
            "labels": [],
            "data": [],
            "error": "날짜를 정확히 이해하지 못했습니다. 예: '이번 주', '5월 첫째 주'처럼 말씀해주세요."
        }
    # 회사명 추출
    company_name = extract_company_name(user_message)
    # user인데 타사 요청을 했는지 확인
    if role == 'user' and company_name:
        # 현재 로그인된 사용자의 회사명 조회
        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            cursor = conn.cursor()
            cursor.execute("SELECT company_name FROM MainTable WHERE email = %s LIMIT 1", (user_email,))
            result = cursor.fetchone()
            user_company = result[0] if result else None
        finally:
            if conn.is_connected():
                cursor.close()
                conn.close()
        if user_company and company_name not in user_company:
            return f"현재 로그인한 사용자에게 '{company_name}' 회사의 데이터에 대한 조회 권한이 없습니다."
    # flow_type: 'outbound' 또는 'inbound'
    if flow_type == 'outbound':
        date_field = 'outbound_date'
        status_values = ('출고요청','출고 준비중','출고 준비 완료','출고완료')
    else:
        date_field = 'subscription_inbound_date'
        status_values = ('입고 준비','입고 대기','입고 중','입고 완료')
    status_field = f"{flow_type}_status"  # outbound_status 또는 inbound_status
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        query = f"""
            SELECT {status_field}, COUNT(*) AS count
            FROM MainTable
            WHERE {date_field} BETWEEN %s AND %s
              AND {status_field} IN (%s, %s, %s, %s)
        """
        params = [start_date, end_date, *status_values]

        if role == 'admin' and company_name:
            query += " AND company_name LIKE %s"
            params.append(f"%{company_name}%")
        else:
            query += " AND email = %s"
            params.append(user_email)
        query += f" GROUP BY {status_field}"
        cursor.execute(query, params)
        results = cursor.fetchall()
        labels = []
        data = []
        dates = []
        for date, status, count in results:
            labels.append(status)
            data.append(count)
            dates.append(date)

        print(f"[📊 차트 반환 데이터] {labels=} {data=} {dates=}")
        return {
            "chart_type": "bar",
            "labels": labels,
            "data": data,
            "start_date": start_date,
            "end_date": end_date
        }
    except Exception as e:
        print(f"[차트 데이터 오류] {e}")
        return {
            "chart_type": "bar",
            "labels": [],
            "data": [],
            "error": "차트 데이터를 가져오는 데 실패했습니다."
        }
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

# 4. 관리자용 창고 위치 슬롯 배정 추천
def recommend_slot_location(user_message):
    try:
        all_data = []
        for location_id in range(1,10): #보관소 A~I
            location_name = f'보관소 {chr(64 + location_id)}'
            assigned = requests.get(f"http://34.64.211.3:5002/storage/slots/{location_id}").json()
            unassigned = requests.get(f"http://34.64.211.3:5002/storage/unassigned/{location_id}").json()
            all_data.append({
                "location_name": location_name,
                "assigned_slots": assigned,
                "unassigned_items": unassigned
            })
        # rag_engine에서 문서 검색 함수 갖고오기
        from rag_engine import search_documents, client
        matched_paragraphs = search_documents(user_message)
        # GPT 프롬프트 구성
        location_summaries = ""
        for data in all_data:
            location_summaries += f"\n[📍 {data['location_name']}]\n"
            location_summaries += f"🔲 미배정 물품:\n{json.dumps(data['unassigned_items'], ensure_ascii=False, indent=2)}\n"
            location_summaries += f"🗃️ 슬롯 현황:\n{json.dumps(data['assigned_slots'], ensure_ascii=False, indent=2)}\n"
        print(f"[슬롯 추천 프롬프트] {location_summaries}")
        prompt = f"""
        [📘 관리자 기준 문서 요약]
        {chr(10).join(f"- {p}" for p in matched_paragraphs)}
        아래는 전체 보관소의 물품 및 슬롯 현황입니다:
        {location_summaries}
        이 정보를 종합하여, 어떤 물품을 어느 보관소의 어느 슬롯(SLOT-x-y-z)에 배정하면 좋을지 추천해 주세요.
        추천 사유도 명확하게 적어주세요.
        """
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "너는 창고 규칙과 현황을 바탕으로 최적 슬롯과 보관소를 추천하는 관리자 도우미야."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[슬롯 추천 오류] {e}")
        return "슬롯 위치 추천 중 오류가 발생했습니다."

    
# ---------------------------
# 메인 API 엔드포인트
# ---------------------------
@app.route('/chat', methods=['POST'])
def chat():
    user_email, user_role, token_error = get_user_from_token()
    if token_error:
        return jsonify({"answer": token_error}), 401
    try:
        user_message = request.json.get('message', '')
        intent = classify_intent(user_message)
        action_name = intent_to_action.get(intent)
        if not action_name:
            return jsonify({"answer": "죄송합니다. 이해하지 못했습니다. 다른 질문을 해주세요."})
        print(f"📌 인텐트 분류 결과: {intent}, 액션: {action_name}, 역할: {user_role}")
        
        flow_type = detect_flow_type(user_message)
        # 액션 실행
        if action_name == "get_estimate_count":
            answer = get_estimate_count(user_email, user_message, flow_type=flow_type, role=user_role)
        elif action_name == "query_requests":
            answer = query_requests(user_email, user_message, flow_type=flow_type, role=user_role)
        elif action_name == "get_status_chart_data":
            chart_data = get_status_chart_data(user_email, user_message, flow_type=flow_type, role=user_role)
            return jsonify(chart_data)
        elif action_name == "generate_rag_answer":
            answer = generate_rag_answer(user_message)
        elif action_name == "recommend_slot_location":
            if user_role != 'admin':
                return jsonify({"answer": "해당 기능은 관리자만 사용할 수 있습니다."})
            answer = recommend_slot_location(user_message)
        else:
            answer = "죄송합니다. 이 인텐트에 대한 처리가 아직 준비되지 않았습니다."
        return jsonify({"answer": answer})

    except Exception as e:
        print(f"[Flask 오류] {e}")
        return jsonify({"answer": "서버 오류가 발생했습니다."}), 500

# ---------------------------
# 서버 실행
# ---------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5098, debug=True)
