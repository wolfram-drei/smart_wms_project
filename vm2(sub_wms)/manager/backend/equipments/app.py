from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
from solapi_sms import send_sms
from datetime import datetime, timedelta
from config import DB_CONFIG
from memos import memo_bp 

app = Flask(__name__)
CORS(app)

app.register_blueprint(memo_bp)

# 날짜 포맷 iso로 변환------------------------

def format_dates(equipment):
    for key in ["purchase_date", "warranty_expiry", "last_maintenance_date", "next_maintenance_date"]:
        if equipment.get(key) and isinstance(equipment[key], datetime):
            equipment[key] = equipment[key].strftime("%Y-%m-%d")
    return equipment

#--------------------------------------------


# 데이터베이스 연결 정보
DB_CONFIG = {
    "host": "localhost",
    "user": "wms",
    "password": "1234",
    "database": "backend"
}

VM1_DB_CONFIG = {
    "host": "34.64.211.3",
    "user": "wms",
    "password": "1234",
    "database": "backend"
}


@app.route('/api/users')
def get_user_phone_numbers():
    name = request.args.get('name')
    print("🔍 이름으로 사용자 조회:", name)

    try:
        conn = mysql.connector.connect(**VM1_DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        query = "SELECT phone_number FROM users WHERE username = %s"
        cursor.execute(query, (name,))
        results = cursor.fetchall()

        # ✅ 프론트에서 기대하는 형태로 감싸기
        phone_numbers = [{"number": row["phone_number"]} for row in results]

        print("📦 반환할 전화번호 목록:", phone_numbers)
        return jsonify({"phone_numbers": phone_numbers})

    except mysql.connector.Error as err:
        print("❌ DB 오류:", err)
        return jsonify({"error": str(err)}), 500

    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()




# Solapi 인증 정보-----------------------------------------------------------
@app.route("/api/send-sms", methods=["POST"])
def send_sms_api():
    data = request.get_json()
    to = data.get("phone_number")
    message = data.get("message")
    
    result = send_sms(to, message, "01082649748")
    
    if result.get("statusCode") == "2000":
        return jsonify({"status": "success", "result": result})
    else:
        return jsonify({"status": "error", "result": result})
    
#----------------------------------------------------------------------#

@app.route("/api/send-maintenance-reminders", methods=["GET"])
def send_maintenance_reminders():
    try:
        # VM2 DB에서 장비 조회
        conn_vm2 = mysql.connector.connect(**DB_CONFIG)
        cursor_vm2 = conn_vm2.cursor(dictionary=True)

        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        cursor_vm2.execute("""
            SELECT equipment_name, next_maintenance_date, assigned_to
            FROM equipment
            WHERE DATE(next_maintenance_date) = %s
        """, (tomorrow,))
        equipments = cursor_vm2.fetchall()
        conn_vm2.close()

        # VM1 DB에서 사용자 전화번호 조회
        conn_vm1 = mysql.connector.connect(**VM1_DB_CONFIG)
        cursor_vm1 = conn_vm1.cursor(dictionary=True)

        success_list = []

        for eq in equipments:
            cursor_vm1.execute("SELECT phone_number FROM users WHERE username = %s", (eq["assigned_to"],))
            user = cursor_vm1.fetchone()
            if user and user["phone_number"]:
                cleaned_phone = user["phone_number"].replace("-", "")
                message = f"[정기점검 알림] '{eq['equipment_name']}' 장비의 점검일이 내일입니다."
                result = send_sms(cleaned_phone, message, "01082649748")
                if result.get("statusCode") == "2000":
                    success_list.append(eq["equipment_name"])


        conn_vm1.close()

        return jsonify({"status": "success", "sent_to": success_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


#--------------------------------------------------------
@app.route("/equipments", methods=["GET"])
def get_equipments():
    try:
        # VM2: 장비 DB 연결
        conn_vm2 = mysql.connector.connect(**DB_CONFIG)
        cursor_vm2 = conn_vm2.cursor(dictionary=True)

        # VM1: 사용자 DB 연결
        conn_vm1 = mysql.connector.connect(**VM1_DB_CONFIG)
        cursor_vm1 = conn_vm1.cursor(dictionary=True)

        # 검색 조건
        search = request.args.get("search", "")
        category = request.args.get("category", "")

        query = "SELECT * FROM equipment WHERE (equipment_name LIKE %s OR location LIKE %s)"
        params = [f"%{search}%", f"%{search}%"]

        if category and category != "전체":
            query += " AND category = %s"
            params.append(category)

        # 장비 조회 (VM2)
        cursor_vm2.execute(query, params)
        equipments = cursor_vm2.fetchall()

        # 사용자 정보 미리 가져오기 (VM1)
        cursor_vm1.execute("SELECT username, phone_number FROM users")
        users = cursor_vm1.fetchall()
        user_phone_map = {user['username']: user['phone_number'] for user in users}

        # 사용자 번호 병합
        for eq in equipments:
            assigned_to = eq.get("assigned_to")
            eq["phone_number"] = user_phone_map.get(assigned_to)

        # 날짜 포맷
        equipments = [format_dates(eq) for eq in equipments]

        # 연결 닫기
        conn_vm1.close()
        conn_vm2.close()

        return jsonify(equipments), 200

    except Exception as e:
        print("🔥 에러 발생:", str(e))
        return jsonify({"error": str(e)}), 500

# 기자재 추가
@app.route("/equipments", methods=["POST"])
def add_equipment():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        data = request.json
        query = """
            INSERT INTO equipment (
                equipment_name, equipment_no, type, category, quantity, status, location, region,
                manufacturer, model, purchase_date, warranty_expiry,
                last_maintenance_date, next_maintenance_date, assigned_to, assigned_to_phone, remarks
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            data["equipment_name"], data["equipment_no"], data["type"], data["category"],
            data["quantity"], data["status"], data["location"], data["region"],
            data["manufacturer"], data["model"], data["purchase_date"], data["warranty_expiry"],
            data["last_maintenance_date"], data["next_maintenance_date"],
            data["assigned_to"], data["assigned_to_phone"], data["remarks"]
        ))

        connection.commit()
        connection.close()
        return jsonify({"message": "equipment added successfully"}), 201
    except Exception as e:
        print("Error occurred:", e)  # 👈 로그 찍기 추가!!
        return jsonify({"error": str(e)}), 500

# 기자재 수정
@app.route("/equipments/<int:id>", methods=["PUT"])
def update_equipment(id):
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        data = request.json
        query = """
            UPDATE equipment
            SET equipment_name = %s, equipment_no = %s, quantity = %s,
                location = %s, type = %s, region = %s, status = %s,
                last_maintenance_date = %s, next_maintenance_date = %s,
                assigned_to = %s, assigned_to_phone = %s, remarks = %s
            WHERE id = %s
        """
        cursor.execute(query, (
            data["equipment_name"], data["equipment_no"], data["quantity"],
            data["location"], data["type"], data["region"], data["status"],
            data["last_maintenance_date"], data["next_maintenance_date"],
            data["assigned_to"], data["assigned_to_phone"], data["remarks"], id
        ))

        connection.commit()
        connection.close()
        return jsonify({"message": "equipment updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 기자재 삭제
@app.route("/equipments/<int:id>", methods=["DELETE"])
def delete_equipment(id):
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        query = "DELETE FROM equipment WHERE id = %s"
        cursor.execute(query, (id,))
        connection.commit()
        connection.close()
        return jsonify({"message": "equipment deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 기자재 단일 조회
@app.route("/equipments/<int:id>", methods=["GET"])
def get_equipment_by_id(id):
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)

        query = "SELECT * FROM equipment WHERE id = %s"
        cursor.execute(query, (id,))
        data = cursor.fetchone()

        connection.close()
        if data:
            return jsonify(data), 200
        else:
            return jsonify({"error": "equipment not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5099, debug=True)