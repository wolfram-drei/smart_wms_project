# inbound_checklist.py
from flask import request, jsonify
import mysql.connector
from datetime import datetime
import pytz
import re

def get_cursor():
    conn = mysql.connector.connect(
        host='연결호스트',
        user='데이터베이스 사용자 이름',
        password='데이터베이스 비밀번호',
        database='데이터베이스 이름'
    )
    return conn, conn.cursor(dictionary=True)

def normalize(text):
    return re.sub(r'\s+', '', text or '')

# ✅ 입고 체크리스트 구성
CHECKLIST_FLOW_INBOUND = {
    '입고 준비': [
        '계약서 자동 로딩 확인 (바코드 스캔 결과)',
        '계약서 내용 확인 및 조건 검토',
        '계약서 승인 처리 (승인 버튼 클릭)',
        '담당자 확인 및 배정 여부 체크',
        '입고 예정 시간 및 날짜 설정',
        '입고 일정 스케줄 등록 완료 확인'
    ],
    '입고 대기': [
        '입고 대상 차량 번호 확인',
        '차량 도착 시간 기록 및 확인',
        '담당자에게 입고 예정 알림 전송 또는 공유 여부',
        '창고 입구 라인 정리 및 안내',
        '계약 정보와 차량 정보 일치 여부 확인',
        '입고 대기 현황 리스트에 등록 완료'
    ],
    '입고 중': [
        '실제 적치 위치 재확인 (현장 기준)',
        '적치 위치 태그 또는 바닥 마킹 확인',
        '제품 수량과 적치 위치 기록 일치 여부 확인',
        '제품 적치 완료 후 사진 촬영',
        '사진 저장 및 이상 여부 검토',
        '사진 업로드 시스템 등록 완료 확인',
        '입고 최종 완료 버튼 클릭 준비 확인'
    ]
}

def register_inbound_routes(app):
    @app.route('/api/generate-checklists', methods=['POST'])
    def generate_checklists():
        kst = pytz.timezone('Asia/Seoul')
        today = datetime.now(kst).strftime('%Y-%m-%d')
        cursor, conn = get_cursor()

        # ✅ 입고 대상 상태별 가져오기
        cursor.execute("""
            SELECT id, inbound_status FROM MainTable
            WHERE DATE(subscription_inbound_date) = %s
              AND inbound_status IN ('입고 준비', '입고 대기', '입고 중')
        """, (today,))
        inbound_rows = cursor.fetchall()

        # ✅ 이미 체크리스트 생성된 항목 제외
        cursor.execute("SELECT DISTINCT schedule_id FROM Checklist WHERE direction = 'inbound'")
        existing_ids = {row['schedule_id'] for row in cursor.fetchall()}

        # ✅ 상태별 해당 phase 체크리스트만 생성
        def insert_checklist(schedule_id, status):
            for phase, items in CHECKLIST_FLOW_INBOUND.items():
                if normalize(phase) != normalize(status):
                    continue
                for item in items:
                    cursor.execute("""
                        INSERT INTO Checklist (schedule_id, direction, phase, checklist_item)
                        VALUES (%s, 'inbound', %s, %s)
                    """, (schedule_id, phase, item))
            conn.commit()

        # ✅ 삽입 실행
        for row in inbound_rows:
            if row['id'] not in existing_ids:
                insert_checklist(row['id'], row['inbound_status'])

        return jsonify({'result': 'inbound checklists inserted'})


    # ✅ 입고 체크리스트 조회
    @app.route('/api/checklist/today', methods=['GET'])
    def get_today_checklists():
        date = request.args.get('date')
        direction = request.args.get('direction')  # 'inbound' 전달 필요
        cursor, _ = get_cursor()

        cursor.execute("""
            SELECT c.*, m.company_name, m.product_name, m.warehouse_num, 
                   m.contract_date, m.barcode_num, m.inbound_status
            FROM Checklist c
            JOIN MainTable m ON c.schedule_id = m.id
            WHERE DATE(m.subscription_inbound_date) = %s
              AND c.direction = %s
              AND m.inbound_status = c.phase
            ORDER BY c.schedule_id, c.id
        """, (date, direction))

        rows = cursor.fetchall()
        grouped = {}

        for row in rows:
            sid = row['schedule_id']
            if sid not in grouped:
                grouped[sid] = {
                    'id': sid,
                    'company_name': row['company_name'],
                    'product_name': row['product_name'],
                    'warehouse_num': row['warehouse_num'],
                    'contract_date': row['contract_date'],
                    'barcode_num': row['barcode_num'],
                    'inbound_status': row['inbound_status'],
                    'phase': row['phase'],
                    'checklist': []
                }
            grouped[sid]['checklist'].append({
                'id': row['id'],
                'phase': row['phase'],
                'checklist_item': row['checklist_item'],
                'is_checked': row['is_checked']
            })

        return jsonify(list(grouped.values()))

    # ✅ 체크 항목 상태 업데이트
    @app.route('/api/checklist/<int:check_id>', methods=['PUT'])
    def update_check_item(check_id):
        is_checked = request.json.get('is_checked', False)
        cursor, conn = get_cursor()
        cursor.execute("""
            UPDATE Checklist
            SET is_checked = %s
            WHERE id = %s
        """, (is_checked, check_id))
        conn.commit()
        return jsonify({'result': 'success'})
