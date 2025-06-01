# app.py
from flask import Flask
from flask_cors import CORS
from inbound_checklist import register_inbound_routes
from outbound_checklist import register_outbound_routes
from grp_out_in_status import register_summary_routes
from progress_status import register_progress_routes
from status_list import register_status_list_routes  # ✅ 추가
from inbound_unprocessed import register_inbound_unprocessed_routes
from outbound_unprocessed import register_outbound_unprocessed_routes

app = Flask(__name__)
CORS(app)

# ✅ 라우터 등록
register_inbound_routes(app)
register_outbound_routes(app)
register_summary_routes(app)
register_progress_routes(app)
register_status_list_routes(app)  # ✅ status-list 라우트 등록
register_inbound_unprocessed_routes(app)     # ✅ 변경된 등록 방식
register_outbound_unprocessed_routes(app)    # ✅ 변경된 등록 방식
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8060, debug=True)
