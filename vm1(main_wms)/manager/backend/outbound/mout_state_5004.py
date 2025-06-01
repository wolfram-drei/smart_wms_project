from flask import Flask, jsonify, request
import pandas as pd
from flask_cors import CORS
import os
import mysql.connector
from vehicle.vehicle import vehicle_bp

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from config import SECRET_KEY
import jwt


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://34.64.211.3:3002"}}, supports_credentials=True)

app.register_blueprint(vehicle_bp, url_prefix="/")

# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

@app.route("/api/outbound/protected", methods=["GET"])
def protected():
    token = request.cookies.get("accessToken")
    if not token:
        return jsonify({"error": "Access token missing"}), 401
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return jsonify({
            "success": True,
            "email": decoded.get("sub"),
            "role": decoded.get("role")
        })
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Access token expired"}), 401
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid JWT: {str(e)}")
        return jsonify({"error": "Invalid token"}), 401

def load_data_from_db():
    connection = mysql.connector.connect(**DB_CONFIG)
    query = "SELECT * FROM MainTable"
    df = pd.read_sql(query, connection)
    print(df)
    connection.close()
    return df

# 출고 요청 조회 API
@app.route("/outbound-status", methods=["GET"])
def get_outbound_status():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)

        where_clauses = [
            "outbound_status IN ('출고요청', '출고 준비중', '출고 준비 완료', '배차 완료', '출고완료')"
        ]

        filter_status = request.args.get("status")
        if filter_status:
            where_clauses.append(f"outbound_status = '{filter_status}'")

        search_text = request.args.get("searchText", "").strip()
        if search_text:
            search_clause = f"""(
                id LIKE '%{search_text}%' OR
                product_name LIKE '%{search_text}%' OR
                company_name LIKE '%{search_text}%' OR
                warehouse_location LIKE '%{search_text}%' OR
                warehouse_type LIKE '%{search_text}%' OR
                outbound_status LIKE '%{search_text}%'
            )"""
            where_clauses.append(search_clause)

        where_sql = " AND ".join(where_clauses)
        query = f"""
            SELECT id, company_name, product_name, contact_phone, inbound_quantity,
                   warehouse_location, warehouse_type, outbound_status,
                   outbound_date, last_outbound_date
            FROM MainTable
            WHERE {where_sql}
        """

        df = pd.read_sql(query, connection)
        connection.close()

        return jsonify(df.to_dict(orient="records"))

    except Exception as e:
        return jsonify({"error": f"Failed to fetch outbound request data: {str(e)}"}), 500

@app.route("/refresh-outbound-request", methods=["POST"])
def refresh_outbound_request():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        # MainTable에서 '출고요청'이고 아직 OutboundRequestTable에 없는 항목만 복사
        query = """
            INSERT INTO OutboundRequestTable (
                id, company_name, product_name, contact_phone, inbound_quantity,
                warehouse_location, warehouse_type, outbound_status,
                outbound_date, last_outbound_date, address, pallet_size, pallet_num,
                width_size, length_size, height_size, barcode_num
            )
            SELECT m.id, m.company_name, m.product_name, m.contact_phone, m.inbound_quantity,
                m.warehouse_location, m.warehouse_type, m.outbound_status,
                m.outbound_date, m.last_outbound_date, m.address, m.pallet_size, m.pallet_num,
                m.width_size, m.length_size, m.height_size, m.barcode_num
            FROM MainTable m
            WHERE m.outbound_status = '출고요청'
            AND m.id IS NOT NULL
            AND m.id NOT IN (SELECT id FROM OutboundRequestTable)
        """
        cursor.execute(query)
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "동기화 완료"}), 200

    except Exception as e:
        return jsonify({"error": f"동기화 실패: {str(e)}"}), 500

# 출고 상태 수정
@app.route("/outbound-status/<int:item_id>", methods=["PUT"])
def update_outbound_status(item_id):
    try:
        data_df = load_data_from_db()

        update_data = request.json
        print("update_data:", update_data)

        if item_id not in data_df["id"].values:
            return jsonify({"error": "Outbound item not found"}), 404
        
        for key, value in update_data.items():
            if key in data_df.columns:
                data_df.loc[data_df["id"] == item_id, key] = value

        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        # MainTable Update
        set_clause = ", ".join([f"{key} = %s" for key in update_data.keys()])
        query = f"UPDATE MainTable SET {set_clause} WHERE id = %s"
        cursor.execute(query, list(update_data.values()) + [item_id])
        connection.commit()

        # OutboundRequestTable도 동일하게 업데이트
        query_outbound = f"UPDATE OutboundRequestTable SET {set_clause} WHERE id = %s"
        cursor.execute(query_outbound, list(update_data.values()) + [item_id])
        connection.commit()

        # 2) 만약 outbound_status가 '출고완료'라면 BackupTable로 복사 후 MainTable에서 삭제
        if update_data.get('outbound_status') == '출고완료':
            # MainTable에서 해당 id의 전체 행 정보를 다시 읽음
            select_query = "SELECT * FROM MainTable WHERE id = %s"
            cursor.execute(select_query, (item_id,))
            row = cursor.fetchone()

            if not row:
                return jsonify({"error": "Row not found in MainTable"}), 404

            # 컬럼 정보를 가져옴
            col_query = "SHOW COLUMNS FROM MainTable"
            cursor.execute(col_query)
            columns = [col[0] for col in cursor.fetchall()]

            # BackupTable에 Insert할 쿼리 구성
            # BackupTable 구조가 MainTable과 동일하다고 가정
            # (단, product_number UNIQUE 제약 등은 제거했다고 했으므로 주의)
            placeholders = ", ".join(["%s"] * len(columns))
            col_names = ", ".join(columns)
            insert_query = f"INSERT INTO BackupTable ({col_names}) VALUES ({placeholders})"
            cursor.execute(insert_query, row)
            connection.commit()

            # BackupTable로 정상 복사된 후 MainTable에서 해당 행 삭제
            delete_query = "DELETE FROM MainTable WHERE id = %s"
            cursor.execute(delete_query, (item_id,))
            connection.commit()

            # data_df에서도 삭제
            data_df = data_df[data_df["id"] != item_id]

        connection.close()

        return jsonify({"message": "Outbound status updated successfully"}), 200
    except Exception as e:
        print("Error in update_outbound_status:", str(e))
        return jsonify({"error": f"Failed to update outbound status: {str(e)}"}), 500

# 백업된 출고 데이터 조회
@app.route("/backup-outbound-status", methods=["GET"])
def get_backup_outbound_status():
    search_text = request.args.get("searchText", "").strip()
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        query = """
        SELECT 
        id, company_name, product_name, contact_phone, inbound_quantity, 
        warehouse_location, warehouse_type, outbound_status, outbound_date, last_outbound_date,
        address, pallet_size, pallet_num, width_size, length_size, height_size, barcode_num
        FROM BackupTable
        """
        df = pd.read_sql(query, connection)

        if search_text:
            df = df[
                df["company_name"].str.contains(search_text, na=False, case=False)
                | df["warehouse_location"].str.contains(search_text, na=False, case=False)
                | df["outbound_status"].str.contains(search_text, na=False, case=False)
            ]

        connection.close()

        return jsonify(df.to_dict(orient="records"))
    except Exception as e:
        return jsonify({"error": f"Failed to fetch backup data: {str(e)}"}), 500


# 데이터 새로고침 API
@app.route("/refresh-outbound-status", methods=["POST"])
def refresh_outbound_status():
    """
    데이터베이스에서 데이터를 다시 로드
    """
    try:
        data_df = load_data_from_db()
        return jsonify({"message": "outbound status data refreshed successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to refresh outbound status data: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5004, debug=True)