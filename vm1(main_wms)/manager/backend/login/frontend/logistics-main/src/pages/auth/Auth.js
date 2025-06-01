import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import axios from "axios";
import API from "../../api/axiosInstance";
import HeaderNav from "../../components/HeaderNav";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import PhoneVerification from "./PhoneVerification";

const API_URL = process.env.REACT_APP_API_URL;

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  const [signupData, setSignupData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    phone_number: "",
    address: "",
    details: "",
    agreement: false,
  });

  const [loginData, setLoginData] = useState({ email: "", password: "" });

  const [emailFormatError, setEmailFormatError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [emailCheckMessage, setEmailCheckMessage] = useState("");
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  const validateEmailFormat = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validatePassword = (password) => {
    const regex = /^(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    const hasKorean = /[\u3131-\uD79D]/ugi.test(password);
    const hasSpace = /\s/.test(password);
    if (hasKorean) return "비밀번호에 한글은 사용할 수 없습니다.";
    if (hasSpace) return "비밀번호에 공백은 사용할 수 없습니다.";
    if (!regex.test(password)) return "비밀번호는 8자 이상, 소문자, 숫자, 특수문자를 포함해야 합니다.";
    return "";
  };

  const checkEmailDuplication = async (email) => {
    if (!validateEmailFormat(email)) {
      setEmailCheckMessage("이메일 형식이 올바르지 않습니다.");
      setEmailAvailable(false);
      return;
    }
    try {
      const res = await axios.get(`${API_URL}/check-email`, { params: { email } });
      if (res.data.exists) {
        setEmailCheckMessage("이미 사용 중인 이메일입니다.");
        setEmailAvailable(false);
      } else {
        setEmailCheckMessage("사용 가능한 이메일입니다.");
        setEmailAvailable(true);
      }
    } catch {
      setEmailCheckMessage("이메일 확인 실패");
      setEmailAvailable(false);
    }
  };

  const handleInputChange = (e, type) => {
    const { name, value, type: inputType, checked } = e.target;
    if (type === "login") {
      setLoginData((prev) => ({ ...prev, [name]: value }));
    } else {
      setSignupData((prev) => ({ ...prev, [name]: inputType === "checkbox" ? checked : value }));
      if (name === "email") {
        const valid = validateEmailFormat(value);
        setEmailFormatError(valid ? "" : "이메일은 example@example.com 형식이어야 합니다.");
        if (valid) checkEmailDuplication(value);
      }
      if (name === "password") setPasswordError(validatePassword(value));
      if (name === "confirmPassword") setConfirmPasswordError(value !== signupData.password ? "비밀번호가 일치하지 않습니다." : "");
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    localStorage.clear();
    try {
      const res = await API.post("/login", loginData);
      const { email, role } = res.data;
      if (email && role) {
        localStorage.setItem("email", email);
        localStorage.setItem("role", role);
        navigate("/");
      } else alert("로그인 실패: 사용자 정보 없음");
    } catch {
      alert("로그인 실패");
    }
  };

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    const required = ["email", "username", "password", "confirmPassword", "phone_number", "address", "details"];
    for (let field of required) if (!signupData[field]) return setErrorMessage("모든 필수 항목을 입력해주세요.");
    if (passwordError || confirmPasswordError || emailFormatError || !emailAvailable /*|| !isPhoneVerified*/) // 핸드폰 인증 임시 비활성화
      return setErrorMessage("입력값을 다시 확인해주세요.");
    setErrorMessage("");
    setShowPopup(true);
  };

  const handlePopupSubmit = async () => {
    if (!signupData.agreement) return setErrorMessage("개인정보 보호 정책에 동의해야 합니다.");
    const userData = { ...signupData };
    delete userData.confirmPassword;
    try {
      const res = await axios.post(`${API_URL}/signup`, userData);
      const { email, role } = res.data;
      if (email && role) {
        localStorage.setItem("email", email);
        localStorage.setItem("role", role);
        navigate("/");
      } else {
        setErrorMessage("회원가입 실패: 사용자 정보 없음");
      }
    } catch {
      setErrorMessage("회원가입 실패");
    } finally {
      setShowPopup(false);
    }
  };

  const handleGoogleLoginSuccess = async (res) => {
    const decoded = jwtDecode(res.credential);
    try {
      const { data } = await axios.post(`${API_URL}/oauth/google`, { email: decoded.email, username: decoded.name }, { withCredentials: true });
      const { role } = data;
      if (decoded.email && role) {
        localStorage.setItem("email", decoded.email);
        localStorage.setItem("role", role);
        navigate("/");
      }
    } catch {
      alert("구글 로그인 실패");
    }
  };

  const renderError = (msg) => msg && <p style={{ color: "red", fontSize: "12px" }}>{msg}</p>;

  const isPhoneVerificationEnabled = false;

  // 회원가입 유효성 검사
  const isSignupReady =
      signupData.email &&
      signupData.username &&
      signupData.password &&
      signupData.confirmPassword &&
      signupData.phone_number &&
      signupData.address &&
      signupData.details &&
      !emailFormatError &&
      !passwordError &&
      !confirmPasswordError &&
      emailAvailable;

  return (
      <>
        <HeaderNav />
        <div className="auth-page">
          <video autoPlay muted loop className="video-background">
            <source src="/video/background.webm" type="video/webm" />
          </video>
          <div className={`auth-container ${isLogin ? "login" : "signup"}`}>
            <div className="form-container login">
              <form onSubmit={handleLoginSubmit}>
                <h1>Login</h1>
                <input type="email" name="email" placeholder="Email" value={loginData.email} onChange={(e) => handleInputChange(e, "login")} required />
                <input type="password" name="password" placeholder="Password" value={loginData.password} onChange={(e) => handleInputChange(e, "login")} required />
                <GoogleLogin onSuccess={handleGoogleLoginSuccess} onError={() => alert("구글 로그인 실패")} />
                <button type="submit" className="login-button">LOG IN</button>
              </form>
            </div>

            <div className="form-container signup">
              <form onSubmit={handleSignupSubmit}>
                <h1>Create Account</h1>
                <input name="username"
                       placeholder="이름 또는 업체명"
                       value={signupData.username}
                       onChange={(e) =>
                           handleInputChange(e, "signup")} required />
                <input name="email"
                       placeholder="Email"
                       value={signupData.email}
                       onChange={(e) =>
                           handleInputChange(e, "signup")} required />
                {renderError(emailFormatError)}
                {renderError(emailCheckMessage)}
                <input name="password"
                       placeholder="비밀번호"
                       type="password"
                       value={signupData.password}
                       onChange={(e) =>
                           handleInputChange(e, "signup")} required />
                {renderError(passwordError)}
                <input name="confirmPassword"
                       placeholder="비밀번호 확인"
                       type="password"
                       value={signupData.confirmPassword}
                       onChange={(e) =>
                           handleInputChange(e, "signup")}
                       required />
                {renderError(confirmPasswordError)}
                <input name="phone_number"
                       placeholder="연락처"
                       value={signupData.phone_number}
                       onChange={(e) =>
                           handleInputChange(e, "signup")}
                       required />{isPhoneVerificationEnabled && (<PhoneVerification phoneNumber={signupData.phone_number}
                                     onVerifySuccess={() => setIsPhoneVerified(true)} />)}
                <input name="address"
                       placeholder="주소"
                       value={signupData.address}
                       onChange={(e) =>
                           handleInputChange(e, "signup")}
                       required />
                <input name="details"
                       placeholder="상세 주소"
                       value={signupData.details}
                       onChange={(e) =>
                           handleInputChange(e, "signup")}
                       required />
                {renderError(errorMessage)}
                <button
                    type="submit"
                    disabled={!isSignupReady}
                    className={`signup-button ${isSignupReady ? "active" : "disabled"}`}
                >
                  SIGN UP
                </button>
              </form>
            </div>

            {showPopup && (
                <div className="popup">
                  <div className="popup-content">
                    <h2>개인정보 보호 정책 동의</h2>
                    <p>개인정보 보호 정책에 동의해야 회원가입이 완료됩니다.</p>
                    <input type="checkbox" name="agreement" checked={signupData.agreement} onChange={(e) => handleInputChange(e, "signup")} />
                    <label htmlFor="agreement">개인정보 보호 정책에 동의합니다.</label>
                    <button onClick={handlePopupSubmit}>확인</button>
                    <button onClick={() => setShowPopup(false)}>취소</button>
                  </div>
                </div>
            )}

            <div className="overlay">
              <div className={`overlay-panel ${isLogin ? "left" : "right"}`}>
                <h1>{isLogin ? "Welcome Back!" : "Hello, Friend!"}</h1>
                <p>{isLogin ? "Email과 Password 입력해주세요" : "회원가입을 하시려면 모든 정보를 입력해주세요"}</p>
                <button onClick={() => setIsLogin(!isLogin)}>{isLogin ? "SIGN UP" : "LOGIN"}</button>
              </div>
            </div>
          </div>
        </div>
      </>
  );
};

export default Auth;
