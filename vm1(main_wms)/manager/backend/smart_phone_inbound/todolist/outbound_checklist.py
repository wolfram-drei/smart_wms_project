# outbound_checklist.py
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

# ✅ 출고 체크리스트 단계 정의
CHECKLIST_FLOW_OUTBOUND = {
    '출고요청': [
        '고객 출고 요청 접수 확인',
        '요청서 기반 출고 대상 품목 정리',
        '출고 요청 리스트업 완료'
    ],
    '출고 준비중': [
        '출고 대상 물품 정보 확인',
        '적재 위치 좌표(x, y) 확인 및 출력',
        '피킹 대상 물품 물리적 이동 시작',
        '피킹 완료 후 출고 대기 장소로 이동',
        '피킹 완료 여부 시스템 업로드'
    ],
    '출고 준비 완료': [
        '출고 대기 장소에서 상차 위치로 이송 완료',
        '상차 준비 완료 여부 확인',
        '운송사 및 담당자 배차 요청 처리',
        '배차 정보 확인 및 승인 처리'
    ],
    '배차 완료': [
        '배차 승인 완료 확인',
        '운송 일정 시스템에 반영 여부 확인'
    ]
}

def register_outbound_routes(app):
    # ✅ 출고 체크리스트 자동 생성
    @app.route('/api/generate-outbound-checklists', methods=['POST'])
    def generate_outbound_checklists():
        kst = pytz.timezone('Asia/Seoul')
        today = datetime.now(kst).strftime('%Y-%m-%d')
        conn, cursor = get_cursor()

        # ✅ 오늘 날짜의 출고 대상 가져오기
        cursor.execute("""
            SELECT id, outbound_status FROM MainTable
            WHERE DATE(last_outbound_date) = %s
            AND outbound_status IN ('출고요청', '출고 준비중', '출고 준비 완료', '배차 완료')
        """, (today,))
        outbound_rows = cursor.fetchall()

        # ✅ 기존에 checklist가 생성된 스케줄 ID 추출
        cursor.execute("SELECT DISTINCT schedule_id FROM Checklist WHERE direction = 'outbound'")
        existing_ids = {row['schedule_id'] for row in cursor.fetchall()}

        # ✅ 상태에 따라 해당 단계만 checklist 생성
        def insert_checklist(schedule_id, status):
            for phase, items in CHECKLIST_FLOW_OUTBOUND.items():
                if normalize(phase) != normalize(status):
                    continue
                for item in items:
                    cursor.execute("""
                        INSERT INTO Checklist (schedule_id, direction, phase, checklist_item)
                        VALUES (%s, 'outbound', %s, %s)
                    """, (schedule_id, phase, item))
            conn.commit()

        # ✅ 체크리스트 생성 실행
        for row in outbound_rows:
            if row['id'] not in existing_ids:
                insert_checklist(row['id'], row['outbound_status'])

        return jsonify({'result': 'outbound checklists inserted'})


    # ✅ 출고 체크리스트 항목 체크 업데이트 (별도 endpoint name 지정)
    @app.route('/api/checklist/outbound/<int:check_id>', methods=['PUT'], endpoint='update_outbound_check_item')
    def update_outbound_check_item(check_id):
        is_checked = request.json.get('is_checked', False)
        conn, cursor = get_cursor()
        cursor.execute("""
            UPDATE Checklist
            SET is_checked = %s
            WHERE id = %s
        """, (is_checked, check_id))
        conn.commit()
        return jsonify({'result': 'success'})

    # ✅ 출고 체크리스트 + MainTable 정보 조회
    @app.route('/api/checklist/outbound', methods=['GET'])
    def get_outbound_checklists():
        date = request.args.get('date')
        conn, cursor = get_cursor()

        STATUS_MAP = {
            '출고요청': '출고요청',
            '출고 준비중': '출고 준비중',
            '출고 준비 완료': '출고 준비 완료',
            '배차 완료': '배차 완료'
        }

        cursor.execute("""
    SELECT c.*, m.company_name, m.product_name, m.warehouse_num, m.contract_date, 
           m.barcode_num, m.outbound_status
    FROM Checklist c
    JOIN MainTable m ON c.schedule_id = m.id
    WHERE DATE(m.last_outbound_date) = %s
      AND c.direction = 'outbound'
""", (date,))

        rows = cursor.fetchall()
        grouped = {}

        for row in rows:
            main_status = row['outbound_status']
            checklist_phase = row['phase']
            mapped_status = STATUS_MAP.get(normalize(main_status), main_status)

            if normalize(mapped_status) != normalize(checklist_phase):
                continue

            sid = row['schedule_id']
            if sid not in grouped:
                grouped[sid] = {
                    'id': sid,
                    'company_name': row['company_name'],
                    'product_name': row['product_name'],
                    'warehouse_num': row['warehouse_num'],
                    'contract_date': row['contract_date'],
                    'barcode_num': row['barcode_num'],
                    'phase': checklist_phase,
                    'status': mapped_status,
                    'checklist': []
                }

            grouped[sid]['checklist'].append({
                'id': row['id'],
                'phase': checklist_phase,
                'checklist_item': row['checklist_item'],
                'is_checked': row['is_checked']
            })

        return jsonify(list(grouped.values()))