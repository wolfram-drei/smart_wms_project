# src/apis/inbound_confirm.py
from flask import Blueprint, request, jsonify
import os
import mysql.connector
from werkzeug.utils import secure_filename

bp_confirm = Blueprint("inbound_confirm", __name__)

# DB 설정
db_config = {
    "host": "연결호스트",
    "user": "데이터베이스 사용자 이름", 
    "password": "데이터베이스 비밀번호",  
    "database": "데이터베이스 이름", 
}

# 이미지 저장 경로
BASE_IMAGE_DIR = "/home/wms/work/manager/backend/inventory/images"
INBOUND_DIR = os.path.join(BASE_IMAGE_DIR, "img_inbound")
PALLET_DIR = os.path.join(BASE_IMAGE_DIR, "img_pallet")

@bp_confirm.route("/api/inbound/complete", methods=["POST"])
def complete_inbound():
    try:
        # 클라이언트에서 받은 데이터
        barcode = request.form.get("barcode")
        slot = request.form.get("slot")
        img1 = request.files.get("photo1")
        img2 = request.files.get("photo2")

        if not barcode or not slot or not img1 or not img2:
            return jsonify({"error": "barcode, slot, photo1, photo2 are required"}), 400

        # 파일 저장 처리
        os.makedirs(INBOUND_DIR, exist_ok=True)
        os.makedirs(PALLET_DIR, exist_ok=True)

        filename1 = f"{barcode}_inbound.jpg"
        filename2 = f"{barcode}_pallet.jpg"

        path1 = os.path.join(INBOUND_DIR, secure_filename(filename1))
        path2 = os.path.join(PALLET_DIR, secure_filename(filename2))

        img1.save(path1)
        img2.save(path2)

        # URL 경로로 저장 (클라이언트가 불러올 수 있도록)
        img_inbound_url = f"/images/img_inbound/{filename1}"
        img_pallet_url = f"/images/img_pallet/{filename2}"

        # DB 업데이트
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()

        update_query = """
            UPDATE Smart_Phone_Inbound
            SET
                warehouse_num = %s,
                inbound_status = '입고 완료',
                img_inbound = %s,
                img_pallet = %s
            WHERE barcode_num = %s
        """
        cursor.execute(update_query, (slot, img_inbound_url, img_pallet_url, barcode))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "입고 완료 처리 완료"}), 200

    except Exception as e:
        print("❌ 입고 완료 처리 중 오류:", e)
        return jsonify({"error": str(e)}), 500