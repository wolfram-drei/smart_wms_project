import requests
import uuid
import hmac
import hashlib
import json
from datetime import datetime

API_KEY = "키입력(문자발송)"
API_SECRET = "키입력"

def send_sms(to, text, from_):
    url = "https://api.solapi.com/messages/v4/send"

    # ISO 8601 형식의 날짜
    date = datetime.utcnow().isoformat() + "Z"
    salt = str(uuid.uuid4())
    signature = hmac.new(
        API_SECRET.encode("utf-8"),
        (date + salt).encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"HMAC-SHA256 apiKey={API_KEY}, date={date}, salt={salt}, signature={signature}"
    }

    payload = {
        "message": {
            "to": to,
            "from": from_,
            "text": text
        }
    }

    try:
        print("보낼 데이터:", json.dumps(payload, indent=2, ensure_ascii=False))
        res = requests.post(url, headers=headers, json=payload)
        print("응답 상태코드:", res.status_code)
        print("응답 내용:", res.text)
        return res.json()
    except Exception as e:
        print("예외 발생:", str(e))
        return {"status": "error", "message": str(e)}
