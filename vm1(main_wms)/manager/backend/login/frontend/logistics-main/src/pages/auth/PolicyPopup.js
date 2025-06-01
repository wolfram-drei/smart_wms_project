import React from "react";

const PolicyPopup = ({ onConfirm, onCancel, agreement, onChange }) => {
  return (
      <div className="popup">
        <div className="popup-content">
          <h2>개인정보 보호 정책 동의</h2>
          <p>개인정보 보호 정책에 동의해야 회원가입이 완료됩니다.</p>
          <input
              type="checkbox"
              name="agreement"
              checked={agreement}
              onChange={onChange}
          />
          <label htmlFor="agreement">개인정보 보호 정책에 동의합니다.</label>
          <button onClick={onConfirm}>확인</button>
          <button onClick={onCancel}>취소</button>
        </div>
      </div>
  );
};

export default PolicyPopup;
