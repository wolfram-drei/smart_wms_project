// src/pages/mypage/UserInfoForm.js
import React from "react";

const UserInfoForm = ({ userInfo, formData, editing, onChange, onEdit, onSubmit, onPasswordMode }) => (
    <>
      <div className="info-block">
        <label>이메일: </label>
        <span>{userInfo.email}</span>
      </div>

      <div className="info-block">
        <label>이름: </label>
        {editing ? (
            <input name="username" value={formData.username} onChange={onChange} />
        ) : (
            <span>{userInfo.username}</span>
        )}
      </div>

      <div className="info-block">
        <label>연락처: </label>
        {editing ? (
            <input name="phone_number" value={formData.phone_number || ""} onChange={onChange} />
        ) : (
            <span>{userInfo.phone_number}</span>
        )}
      </div>

      <div className="info-block">
        <label>주소: </label>
        {editing ? (
            <input name="address" value={formData.address} onChange={onChange} />
        ) : (
            <span>{userInfo.address}</span>
        )}
      </div>

      <div className="info-block">
        <label>상세 주소: </label>
        {editing ? (
            <input name="details" value={formData.details} onChange={onChange} />
        ) : (
            <span>{userInfo.details}</span>
        )}
      </div>

      {editing ? (
          <button onClick={onSubmit}>수정 완료</button>
      ) : (
          <button onClick={onEdit}>정보 수정</button>
      )}

      <button onClick={onPasswordMode}>비밀번호 변경</button>
    </>
);

export default UserInfoForm;
