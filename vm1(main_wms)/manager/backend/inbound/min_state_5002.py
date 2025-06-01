from flask import Flask, jsonify, request,send_from_directory
import pandas as pd
from flask_cors import CORS
import mysql.connector
import os
from datetime import datetime
import numpy as np
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from config import SECRET_KEY
import jwt


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# 데이터베이스 연결 정보
DB_CONFIG = {
    'host': '연결호스트',
    'user': '사용자',
    'password': '비밀번호',
    'database': '데이터베이스이름',
}

@app.route("/api/inbound/protected", methods=["GET"])
def protected():
    token = request.cookies.get("accessToken")
    if not token:
        return jsonify({"error": "Access token missing"}), 401
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return jsonify({
            "success": True,
            "email": decoded.get("sub"),
            "role": decoded.get("role")})
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Access token expired"}), 401
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid JWT: {str(e)}")
        return jsonify({"error": "Invalid token"}), 401

# 이미지가 저장된 절대 경로 설정 둘다가능
#BARCODE_IMAGE_DIR = "../../inbound/src/assets/images/barcodes"
BARCODE_IMAGE_DIR = "/home/wms/work/manager/backend/inbound/barcode"

# 데이터베이스에서 데이터 로드
def load_data_from_db():
    connection = mysql.connector.connect(**DB_CONFIG)
    query = "SELECT * FROM MainTable"  # ProductInfo 테이블에서 데이터 로드
    df = pd.read_sql(query, connection)
    print(df)  # 디버깅: 데이터 확인
    connection.close()
    return df

# 데이터 로드 (서버 시작 시 데이터 로드)
data_df = load_data_from_db()


@app.route("/inbound-status", methods=["GET"])
def get_inbound_status():
    """
    입고 현황 데이터를 반환
    """
    data_df = load_data_from_db()  # 데이터 갱신
    search_text = request.args.get("searchText", "").strip()
    try:
        # 데이터 복사
        filtered_df = data_df.copy()

        # 검색어 필터 적용
        if search_text:
            filtered_df = filtered_df[
                filtered_df["company_name"].str.contains(search_text, na=False, case=False)
                | filtered_df["product_name"].str.contains(search_text, na=False, case=False)
                | filtered_df["warehouse_location"].str.contains(search_text, na=False, case=False)
                | filtered_df["inbound_status"].str.contains(search_text, na=False, case=False)
            ]

        # 날짜 컬럼 안전 변환
        # contract_date 변환: NaT -> "계약대기"
        filtered_df["contract_date"] = pd.to_datetime(filtered_df["contract_date"], errors="coerce")
        filtered_df["contract_date"] = filtered_df["contract_date"].apply(
            lambda x: x.strftime("%Y-%m-%d") if pd.notnull(x) else "계약대기"
        )

        # inbound_date 변환: NaT -> None
        filtered_df["subscription_inbound_date"] = pd.to_datetime(filtered_df["subscription_inbound_date"], errors="coerce")
        filtered_df["subscription_inbound_date"] = filtered_df["subscription_inbound_date"].apply(
            lambda x: x.strftime("%Y-%m-%d") if pd.notnull(x) else None
        )

        # outbound_date 변환: NaT -> "출고 대기"
        filtered_df["outbound_date"] = pd.to_datetime(filtered_df["outbound_date"], errors="coerce")
        filtered_df["outbound_date"] = filtered_df["outbound_date"].apply(
            lambda x: x.strftime("%Y-%m-%d") if pd.notnull(x) else "출고 대기"
        )

        # 필요한 컬럼만 반환
        filtered_df = filtered_df[
            [
                "id",                # 고유 ID
                "company_name",      # 업체 이름
                "product_name",      # 상품명
                "product_number",    # 상품번호
                "inbound_quantity",  # 수량
                "warehouse_location",# 창고 위치
                "warehouse_type",    # 창고 타입 (냉장/냉동/상온)
                "inbound_status",    # 입고 상태
                "contract_date",     # 계약일
                "subscription_inbound_date",      # 입고 날짜
                "outbound_date",     # 출고 날짜
                "storage_duration",  # 보관기간
                "warehouse_num",     # 창고넘버
                "pallet_size",       # 팔렛트 사이즈
                "pallet_num",        # 팔렛트 개수
                "weight",            # 무게
                "barcode",           # 바코드
                "barcode_num"        # 바코드 일련번호
            ]
        ]

        # 모든 NaN 값을 None으로 치환
        filtered_df = filtered_df.replace({np.nan: None})

        return jsonify(filtered_df.to_dict(orient="records"))
    except Exception as e:
        print(f"예외 발생: {e}")
        return jsonify({"error": f"Failed to fetch inbound status data: {str(e)}"}), 500

@app.route("/inbound-status/<int:item_id>", methods=["PUT"])
def update_inbound_status(item_id):
    try:
        # 클라이언트로부터 데이터 가져오기
        update_data = request.json
        print("Received update data:", update_data)

        # 🔄 최신 데이터 로드
        data_df = load_data_from_db()

        # 업데이트 가능한 컬럼 리스트
        allowed_columns = [
            "pallet_size", "pallet_num", "weight", "warehouse_type", "total_cost",
            "company_name", "product_name", "inbound_quantity", "product_number",
            "warehouse_location", "subscription_inbound_date", "outbound_date", "storage_duration",
            "estimate"
        ]

        # 데이터프레임에서 해당 id의 행 확인
        if item_id not in data_df["id"].values:
            return jsonify({"error": "Inbound item not found"}), 404

        # 기존 데이터 가져오기
        current_data = data_df.loc[data_df["id"] == item_id].to_dict("records")[0]

        # 업데이트 데이터 처리 (활성화된 필드만 업데이트)
        for key, value in update_data.items():
            if key in allowed_columns and value is not None:
                print(f"Updating field {key} with value {value}")
                data_df.loc[data_df["id"] == item_id, key] = value
                current_data[key] = value  # 기존 데이터에 업데이트된 값 반영

        # SQL 업데이트 준비
        update_fields = [f"{key} = %s" for key in allowed_columns if key in current_data]
        update_values = [current_data[key] for key in allowed_columns if key in current_data]
        if 'estimate' in update_data:
            update_fields.append("estimate = %s")
            update_values.append(update_data['estimate'])

        # SQL 실행
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        update_query = f"""
            UPDATE MainTable
            SET {', '.join(update_fields)}
            WHERE id = %s
        """
        update_values.append(item_id)
        print("Executing query:", update_query, "with values:", update_values)
        cursor.execute(update_query, update_values)
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({"message": "Inbound status and detail updated successfully"}), 200

    except Exception as e:
        print("Error updating inbound status:", str(e))
        return jsonify({"error": f"Failed to update inbound status: {str(e)}"}), 500

@app.route("/refresh-inbound-status", methods=["POST"])
def refresh_inbound_status():
    """
    데이터베이스에서 데이터를 다시 로드
    """
    try:
        global data_df
        data_df = load_data_from_db()
        return jsonify({"message": "Inbound status data refreshed successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to refresh inbound status data: {str(e)}"}), 500
    
@app.route("/barcode-images/<filename>", methods=["GET"])
def serve_barcode_image(filename):
    """
    바코드 이미지를 제공
    """
    try:
        return send_from_directory(BARCODE_IMAGE_DIR, filename)
    except FileNotFoundError:
        return jsonify({"error": "Barcode image not found"}), 404

#입고현황의 상태만 변경하는
@app.route("/inbound-status-detail/<int:item_id>", methods=["PUT"])
def update_inbound_status_detail(item_id):
    """
    MainTable 특정 ID 행에 대한 'inbound_status' 필드만 업데이트.
    """
    try:
        global data_df
        update_data = request.json  # { "inbound_status": "입고 중" } 등등
        print("📥 요청 들어옴! item_id =", item_id)
        print("Received update data:", update_data)

        if item_id not in data_df["id"].values:
            return jsonify({"error": "Item not found"}), 404

        if "inbound_status" not in update_data:
            return jsonify({"error": "inbound_status field is required"}), 400

        new_status = update_data["inbound_status"]

        # 메모리 DataFrame 업데이트
        data_df.loc[data_df["id"] == item_id, "inbound_status"] = new_status

        # DB 업데이트
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        update_query = """
            UPDATE MainTable
            SET inbound_status = %s
            WHERE id = %s
        """
        cursor.execute(update_query, (new_status, item_id))
        connection.commit()

        cursor.close()
        connection.close()

        return jsonify({"message": "Inbound status updated successfully"}), 200

    except Exception as e:
        print("Error in update_inbound_status_detail:", str(e))
        return jsonify({"error": f"Failed to update inbound status detail: {str(e)}"}), 500
    


# 이미 배정되어 있는 슬롯 조회
@app.route('/storage/slots/<int:location_id>', methods=['GET'])
def get_slots(location_id):
    
    data_df = load_data_from_db()  # 데이터 갱신

    # 1. 보관소 이름으로 변환 (예: 1 → 보관소 A)
    location_name = f'보관소 {chr(64 + location_id)}'
    print(f"✅ 요청 받은 location_id: {location_id}")
    print(f"➡️ 매핑된 warehouse_location 이름: {location_name}")

    # 슬롯 이름 리스트
    slot_names = []
    for i in range(45):
        x = i % 3
        y = (i // 3) % 3
        z = i // (3 * 3)
        slot_name = f"SLOT-{x}-{y}-{z}"
        slot_names.append(slot_name)
    print(slot_names)

    # 해당 보관소 + 슬롯에 배정된 물품 필터링
    filtered = data_df[
        (data_df['warehouse_location'] == location_name) &
        (data_df['warehouse_num'].isin(slot_names))
    ][['company_name', 'product_name', 'warehouse_num']]

    # 슬롯 결과 초기화
    slots = []

    for i in range(45):
        x = i % 3
        y = (i // 3) % 3
        z = i // (3 * 3)
        slot_name = f"SLOT-{x}-{y}-{z}"
        row = filtered[filtered['warehouse_num'] == slot_name]
        print(filtered[['warehouse_num']])
        if not row.empty:
            item = row.iloc[0]
            slots.append({
                "available": False,
                "company_name": item['company_name'],
                "product_name": item['product_name'],
                "slot_name": slot_name
            })
        else:
            slots.append({ 
                "available": True,
                "slot_name": slot_name   # 👈 빈 슬롯도 포함!
            })

    return jsonify(slots)

# 아직 배정되지 않은 물품 조회
@app.route('/storage/unassigned/<int:location_id>', methods=['GET'])
def get_unassigned_items(location_id):
    data_df = load_data_from_db()

    location_name = f'보관소 {chr(64 + location_id)}'
    print(f"📦 조회 요청: {location_name}의 미할당 물품")

    # warehouse_num이 비어있고, 입고 준비 상태인 항목 필터링
    filtered = data_df[
        (data_df['warehouse_location'] == location_name) &
        (data_df['inbound_status'] == '입고 준비') &
        (data_df['warehouse_num'].isnull() | (data_df['warehouse_num'] == ''))
    ][['id', 'company_name', 'product_name']]

    print(f"🔍 필터된 미할당 물품 수: {len(filtered)}")

    # JSON 변환 후 응답
    return jsonify(filtered.to_dict(orient='records'))

# 슬롯 배정
@app.route('/storage/assign', methods=['POST', 'OPTIONS'])
def assign_to_slot():
    if request.method == 'OPTIONS':
        return jsonify({"message": "CORS preflight passed"}), 200

    try:
        data = request.get_json()
        warehouse_num = data.get('warehouse_num')
        product_name = data.get('product_name')
        warehouse_location = data.get('warehouse_location')

        print("📦 슬롯 배정 요청:", data)

        if not warehouse_num or not product_name or not warehouse_location:
            return jsonify({"error": "필수 데이터 누락"}), 400

        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # warehouse_num이 NULL or ''인 애만 배정 (중복 방지)
        query = """
            UPDATE MainTable
            SET warehouse_num = %s
            WHERE product_name = %s AND warehouse_location = %s
              AND (warehouse_num IS NULL OR warehouse_num = '')
            LIMIT 1
        """
        cursor.execute(query, (warehouse_num, product_name, warehouse_location))
        conn.commit()

        affected_rows = cursor.rowcount
        cursor.close()
        conn.close()

        if affected_rows == 0:
            return jsonify({"error": "해당 물품에 대해 배정되지 않았습니다."}), 400

        return jsonify({"message": f"{warehouse_num} 슬롯에 배정 완료"}), 200

    except Exception as e:
        print("❌ 오류:", str(e))
        return jsonify({"error": f"슬롯 배정 중 오류 발생: {str(e)}"}), 500



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
