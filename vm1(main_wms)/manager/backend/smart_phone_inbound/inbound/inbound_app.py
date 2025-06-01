from flask import Flask, send_from_directory  # send_from_directory 추가!
from contract          import bp_contract
from inbound           import bp_inbound
from inbound_completed import bp_done
from inbound_confirm import bp_confirm
from inbound_slot import bp_slot

app = Flask(__name__)
app.register_blueprint(bp_contract)
app.register_blueprint(bp_inbound)
app.register_blueprint(bp_done)
app.register_blueprint(bp_confirm)
app.register_blueprint(bp_slot, url_prefix="/api/inbound")

# ✅ 이미지파일로드
@app.route('/static/uploads/<path:filename>')
def serve_inventory_files(filename):
    inventory_path = '/home/wms/work/manager/backend/inventory'
    return send_from_directory(inventory_path, filename)

# ✅ 진짜 필요한 이미지 로드 경로
@app.route('/images/<path:filename>')
def serve_images(filename):
    return send_from_directory('/home/wms/work/manager/backend/inventory/images', filename)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8050, debug=True)

