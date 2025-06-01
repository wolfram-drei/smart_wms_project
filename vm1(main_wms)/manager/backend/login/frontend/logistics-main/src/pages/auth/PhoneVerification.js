import React, { useState } from "react";
import axios from "axios";

const PhoneVerification = ({ phoneNumber, onVerifySuccess }) => {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);

  const sendCode = async () => {
    if (!phoneNumber) {
      alert("전화번호를 먼저 입력해주세요.");
      return;
    }

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/sms/send`, {
        phoneNumber
      });
      setSent(true);
      alert("인증번호를 전송했습니다.");
    } catch (err) {
      alert("인증번호 전송 실패");
    }
  };

  const verifyCode = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/sms/verify`, {
        phoneNumber,
        code,
      });

      if (res.data === "인증 성공") {
        setVerified(true);
        alert("인증 성공!");
        onVerifySuccess(); // 상위에서 회원가입 버튼 활성화
      } else {
        alert("인증 실패. 다시 시도해주세요.");
      }
    } catch (err) {
      alert("인증 실패: " + err.response?.data);
    }
  };

  return (
      <div className="phone-verification">
        {!verified && (
            <>
              {!sent ? (
                  <button onClick={sendCode}>번호 인증</button>
              ) : (
                  <div>
                    <input
                        type="text"
                        placeholder="인증번호 입력"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                    <button onClick={verifyCode}>확인</button>
                  </div>
              )}
            </>
        )}
        {verified && <span className="verified-text">인증 완료</span>}
      </div>
  );
};

export default PhoneVerification;
