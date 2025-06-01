import React from "react";
import PhoneVerification from "./PhoneVerification";

const SignupForm = ({
  signupData,
  onChange,
  onSubmit,
  passwordError,
  confirmPasswordError,
  emailFormatError,
  emailCheckMessage,
  isPhoneVerified,
  errorMessage,
  agreement,
  onOpenPolicyPopup
}) => {
  const renderError = (msg) => msg && <p style={{ color: "red", fontSize: "12px" }}>{msg}</p>;

  return (
      <form onSubmit={onSubmit}>
        <h1>Create Account</h1>
        <input
            name="username"
            placeholder="이름 또는 업체명"
            value={signupData.username}
            onChange={(e) => onChange(e, "signup")}
            required
        />
        <input
            name="email"
            placeholder="Email"
            value={signupData.email}
            onChange={(e) => onChange(e, "signup")}
            required
        />
        {renderError(emailFormatError)}
        {renderError(emailCheckMessage)}
        <input
            name="password"
            placeholder="비밀번호"
            type="password"
            value={signupData.password}
            onChange={(e) => onChange(e, "signup")}
            required
        />
        {renderError(passwordError)}
        <input
            name="confirmPassword"
            placeholder="비밀번호 확인"
            type="password"
            value={signupData.confirmPassword}
            onChange={(e) => onChange(e, "signup")}
            required
        />
        {renderError(confirmPasswordError)}
        <input
            name="phone_number"
            placeholder="연락처"
            value={signupData.phone_number}
            onChange={(e) => onChange(e, "signup")}
            required
        />
        <PhoneVerification
            phoneNumber={signupData.phone_number}
            onVerifySuccess={() => {}}
        />
        <input
            name="address"
            placeholder="주소"
            value={signupData.address}
            onChange={(e) => onChange(e, "signup")}
            required
        />
        <input
            name="details"
            placeholder="상세 주소"
            value={signupData.details}
            onChange={(e) => onChange(e, "signup")}
            required
        />
        <div className="policy-check">
          <input
              type="checkbox"
              id="agreement"
              name="agreement"
              checked={agreement}
              onChange={(e) => {
                onChange(e, "signup");      // 상태 업데이트
                onOpenPolicyPopup();        // 팝업 열기
              }}
          />
          <label htmlFor="agreement" className="policy-label">
            개인정보 수집 및 이용에 동의합니다.
          </label>
          <span
              className="popup-link"
              onClick={(e) => {
                e.preventDefault();
                onOpenPolicyPopup();
              }}
          >
    [자세히 보기]
  </span>
        </div>


        {renderError(errorMessage)}
        <button
            type="submit"
            disabled={false} // 번호 인증 비활성화. !isPhoneVerified 이렇게 바꾸면 활성화 할 수 있음
            className={`signup-button ${isPhoneVerified ? "active" : "disabled"}`}
        >
          SIGN UP
        </button>
      </form>

  );
};

export default SignupForm;
