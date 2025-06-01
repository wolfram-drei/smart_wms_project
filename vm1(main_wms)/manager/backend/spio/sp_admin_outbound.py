from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import mysql.connector
from decimal import Decimal
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # 모든 도메인에서의 요청 허용

# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

# 단일 /barcode-upload 엔드포인트 정의
@app.route("/barcode-upload", methods=["POST"])
def barcode_upload():
    """
    React Native에서 바코드 번호(barcode_num)를 문자열로 전송하면,
    Main
    """

    data = request.get_json()
    barcode_num = data.get("barcode_num")

    if not barcode_num:
        return jsonify({"error": "barcode_num is required"}), 400
    
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM OutboundRequestTable WHERE barcode_num = %s", (barcode_num,))
        row = cursor.fetchone()
        
        if not row:
            print(f"OutboundRequestTable에 존재하지 않는 바코드: {barcode_num}")
            return jsonify({"error": "해당 바코드가 OutboundRequestTable에 존재하지 않습니다."}), 404

        # Decimal, datetime 변환
        for key, value in row.items():
            if isinstance(value, Decimal):
                row[key] = float(value)
            elif isinstance(value, datetime):
                row[key] = value.isoformat()
            elif value is None:
                row[key] = ""

        return jsonify({
            "message": "success",
            "data": row
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()

               

@app.route("/outbound-status", methods=["GET"])
def get_outbound_status():
    """
    출고요청 상태이면서 last_outbound_date 오늘인 데이터만 반환
    """
    search_text = request.args.get("searchText", "").strip()
    try:
        # DB 연결
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        # 필터 조건 추가
        filtered_query = """
            SELECT 
                id,
                company_name,
                product_name,
                barcode_num,
                inbound_quantity,
                warehouse_location,
                warehouse_type,
                outbound_status,
                outbound_date,
                last_outbound_date
            FROM OutboundRequestTable
            WHERE outbound_status = '출고요청'
              AND DATE(last_outbound_date) = DATE(NOW())
        """
        cursor.execute(filtered_query)
        
        rows = cursor.fetchall()
        # 데이터 정리
        filtered_data = [
            {
                "id": row["id"],
                "company_name": row["company_name"],
                "product_name": row["product_name"],
                "barcode_num": row["barcode_num"],
                "inbound_quantity": row["inbound_quantity"],
                "warehouse_location": row["warehouse_location"],
                "warehouse_type": row["warehouse_type"],
                "outbound_status": row["outbound_status"],
                "outbound_date": row["outbound_date"].isoformat() if row["outbound_date"] else "",
                "last_outbound_date": row["last_outbound_date"].isoformat() if row["last_outbound_date"] else ""
            }
            for row in rows
        ]
        return jsonify(filtered_data)
    
    except Exception as e:
        print(f"Error in /outbound-status GET: {str(e)}")
        return jsonify({"error": f"Failed to fetch outbound status data: {str(e)}"}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


@app.route("/complete/<barcode_num>", methods=["POST"])
def complete_outbound(barcode_num):
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        today = datetime.today().date()

        # MainTable에서 해당 바코드 존재 여부 확인
        cursor.execute("SELECT * FROM OutboundRequestTable WHERE barcode_num = %s", (barcode_num,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "OutboundRequestTable에 해당 바코드가 없습니다."}), 404

        # 상태 업데이트
        cursor.execute("""
            UPDATE OutboundRequestTable 
            SET outbound_status = '출고완료', last_outbound_date = %s 
            WHERE barcode_num = %s
        """, (today, barcode_num))

        # MainTable에서 해당 barcode_num에 대한 모든 정보 가져오기
        cursor.execute("SELECT * FROM MainTable WHERE barcode_num = %s", (barcode_num,))
        main_row = cursor.fetchone()
        if not main_row:
            return jsonify({"error": "MainTable에 해당 바코드가 없습니다."}), 404
        
        # BackupTable에 삽입 (존재하지 않을 경우에만)
        cursor.execute("SELECT * FROM BackupTable WHERE barcode_num = %s", (barcode_num,))
        exists = cursor.fetchone()

        if not exists:
            # MainTable에서 데이터를 BackupTable로 삽입
            # BackupTable에 삽입할 컬럼을 모두 명시적으로 나열해야 합니다.
            insert_sql = """
                INSERT INTO BackupTable (
                    id, company_name, contact_person, contact_phone, address, product_name, 
                    product_number, product_description, category, weight, pallet_size, pallet_num, 
                    width_size, length_size, height_size, inbound_quantity, warehouse_location, 
                    warehouse_type, warehouse_num, inbound_status, outbound_status, contract_date, 
                    inbound_date, subscription_inbound_date, outbound_date, last_outbound_date, 
                    storage_duration, barcode, barcode_num, inbound_detail, outbound_details, 
                    estimate, estimate_description, img_inbound, img_pallet, total_cost, 
                    last_updated, cost_difference
                ) 
                VALUES (
                    %(id)s, %(company_name)s, %(contact_person)s, %(contact_phone)s, %(address)s, %(product_name)s,
                    %(product_number)s, %(product_description)s, %(category)s, %(weight)s, %(pallet_size)s, %(pallet_num)s,
                    %(width_size)s, %(length_size)s, %(height_size)s, %(inbound_quantity)s, %(warehouse_location)s,
                    %(warehouse_type)s, %(warehouse_num)s, %(inbound_status)s, '출고완료', %(contract_date)s,
                    %(inbound_date)s, %(subscription_inbound_date)s, %(outbound_date)s, %(last_outbound_date)s,
                    %(storage_duration)s, %(barcode)s, %(barcode_num)s, %(inbound_detail)s, %(outbound_details)s,
                    %(estimate)s, %(estimate_description)s, %(img_inbound)s, %(img_pallet)s, %(total_cost)s,
                    %(last_updated)s, %(cost_difference)s
                )
            """
            cursor.execute(insert_sql, {**main_row, "outbound_date": today, "last_outbound_date": today})

        # MainTable에서 해당 바코드를 삭제
        cursor.execute("DELETE FROM MainTable WHERE barcode_num = %s", (barcode_num,))

        # 커밋하여 트랜잭션 완료
        conn.commit()
        return jsonify({"message": f"{barcode_num} 출고 완료 처리됨."}), 200

    except Exception as e:
        print("Error in /complete/<barcode_num>:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

            
        
        

if __name__ == "__main__":
    # Flask 서버 실행
    app.run(host="0.0.0.0", port=5090, debug=True)
