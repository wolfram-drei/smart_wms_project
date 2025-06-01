// src/pages/mypage/PasswordChangeForm.js
import React from "react";

const PasswordChangeForm = ({ passwordForm, onChange, onSubmit, onCancel }) => (
    <>
      <div className="info-block">
        <label>현재 비밀번호: </label>
        <input
            type="password"
            name="currentPassword"
            value={passwordForm.currentPassword}
            onChange={onChange}
        />
      </div>
      <div className="info-block">
        <label>새 비밀번호: </label>
        <input
            type="password"
            name="newPassword"
            value={passwordForm.newPassword}
            onChange={onChange}
        />
      </div>
      <div className="info-block">
        <label>새 비밀번호 확인: </label>
        <input
            type="password"
            name="confirmPassword"
            value={passwordForm.confirmPassword}
            onChange={onChange}
        />
      </div>
      <button onClick={onSubmit}>변경하기</button>
      <button onClick={onCancel}>취소</button>
    </>
);

export default PasswordChangeForm;
