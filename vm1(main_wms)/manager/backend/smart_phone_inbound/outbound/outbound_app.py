from flask import Flask
from outbound_req_list import bp_outbound  # ✅ 아까 만든 outbound_api.py에서 가져오기
from outbound_insert import bp_outbound_insert
from outbound_detail import bp_outbound_detail
from outbound_approve import bp_outbound_approve
from outbound_preparing_detail import bp_outbound_preparing_detail
from outbound_preparing_complete import bp_outbound_preparing_complete
from outbound_ready import bp_outbound_ready_list
from outbound_ready_detail import bp_outbound_ready_detail
from delivery_list import bp_delivery_list
from delivery_detail import bp_delivery_detail
from delivery_driver import bp_delivery_driver
from delivery_final_status import bp_delivery_final_status
from delivery_status_detail import bp_delivery_status_detail
from outbound_complted import bp_outbound_complete


app = Flask(__name__)

# ✅ Blueprint 등록
app.register_blueprint(bp_outbound)
app.register_blueprint(bp_outbound_insert)
app.register_blueprint(bp_outbound_detail)
app.register_blueprint(bp_outbound_approve)
app.register_blueprint(bp_outbound_preparing_detail)
app.register_blueprint(bp_outbound_preparing_complete)
app.register_blueprint(bp_outbound_ready_list)
app.register_blueprint(bp_outbound_ready_detail)
app.register_blueprint(bp_delivery_list)
app.register_blueprint(bp_delivery_detail)
app.register_blueprint(bp_delivery_driver)
app.register_blueprint(bp_delivery_final_status)
app.register_blueprint(bp_delivery_status_detail)
app.register_blueprint(bp_outbound_complete)

# ✅ 기본 라우트 (옵션: 서버 정상 동작 확인용)
@app.route("/")
def home():
    return "🚀 Outbound API Server Running!"

# ✅ 서버 실행
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8051, debug=True)
