import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../components/Auth.css";
import axios from "axios";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  const [loginData, setLoginData] = useState({ email: "", password: "" });
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

  const [errorMessage, setErrorMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  // 🔐 로그인
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("http://34.64.211.3:5080/login", loginData);
      const { token, role, email } = response.data || {};

      if (token && email) {
        localStorage.setItem("token", token);
        localStorage.setItem("email", email);
        localStorage.setItem("role", role);

        if (role === "admin") {
          window.location.href = "http://34.64.211.3:3000/admin/Mainpage";
        } else {
          window.location.href = "http://34.64.211.3:4000/user/CustomerInquiries";
        }
      } else {
        alert("로그인 실패: 토큰이 없습니다.");
      }
    } catch (error) {
      console.error("Login failed:", error.response?.data || error.message);
      alert("로그인 실패: " + (error.response?.data?.message || "서버 오류"));
    }
  };

  // ✅ 회원가입 제출
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (signupData.password !== signupData.confirmPassword) {
      setErrorMessage("비밀번호가 일치하지 않습니다.");
      return;
    }
    setShowPopup(true);
  };

  // ✅ 개인정보 동의 후 회원가입 처리 + JWT 저장
  const handlePopupSubmit = async () => {
    if (!signupData.agreement) {
      setErrorMessage("개인정보 보호 정책에 동의해야 합니다.");
      return;
    }

    const userData = { ...signupData };
    delete userData.confirmPassword;

    try {
      const response = await axios.post("http://34.64.211.3:5080/signup", userData);
      const { token, email, role } = response.data;

      if (token && email) {
        localStorage.setItem("token", token);
        localStorage.setItem("email", email);
        localStorage.setItem("role", role);

        alert("회원가입이 완료되었습니다.");

        if (role === "admin") {
          window.location.href = "http://34.64.211.3:3000/admin/Mainpage";
        } else {
          window.location.href = "http://34.64.211.3:4000/user/CustomerInquiries";
        }
      } else {
        setErrorMessage("회원가입 실패: 토큰이 없습니다.");
      }
    } catch (error) {
      setErrorMessage("회원가입에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setShowPopup(false);
    }
  };

  // 🔄 입력값 변경 핸들러
  const handleInputChange = (e, type) => {
    const { name, value, type: inputType, checked } = e.target;
    if (type === "login") {
      setLoginData({ ...loginData, [name]: value });
    } else {
      setSignupData({
        ...signupData,
        [name]: inputType === "checkbox" ? checked : value,
      });
    }
  };

  return (
    <div className="auth-page">
      <video autoPlay muted loop className="video-background">
        <source src="/background.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      <div className={`auth-container ${isLogin ? "login" : "signup"}`}>
        {/* 로그인 폼 */}
        <div className="form-container login">
          <form onSubmit={handleLoginSubmit}>
            <h1>Login</h1>
            <input
              type="email"
              placeholder="Email"
              name="email"
              value={loginData.email}
              onChange={(e) => handleInputChange(e, "login")}
              required
            />
            <input
              type="password"
              placeholder="Password"
              name="password"
              value={loginData.password}
              onChange={(e) => handleInputChange(e, "login")}
              required
            />
            <button type="submit">Login</button>
          </form>
        </div>

        {/* 회원가입 폼 */}
        <div className="form-container signup">
          <form onSubmit={handleSignupSubmit}>
            <h1>Create Account</h1>
            <input
              type="text"
              placeholder="이름 또는 업체명"
              name="username"
              value={signupData.username}
              onChange={(e) => handleInputChange(e, "signup")}
              required
            />
            <input
              type="email"
              placeholder="Email"
              name="email"
              value={signupData.email}
              onChange={(e) => handleInputChange(e, "signup")}
              required
            />
            <input
              type="password"
              placeholder="비밀번호"
              name="password"
              value={signupData.password}
              onChange={(e) => handleInputChange(e, "signup")}
              required
            />
            <input
              type="password"
              placeholder="비밀번호 확인"
              name="confirmPassword"
              value={signupData.confirmPassword}
              onChange={(e) => handleInputChange(e, "signup")}
              required
            />
            <input
              type="text"
              placeholder="연락처"
              name="phone_number"
              value={signupData.phone_number}
              onChange={(e) => handleInputChange(e, "signup")}
              required
            />
            <input
              type="text"
              placeholder="주소"
              name="address"
              value={signupData.address}
              onChange={(e) => handleInputChange(e, "signup")}
              required
            />
            <input
              type="text"
              placeholder="상세 주소"
              name="details"
              value={signupData.details}
              onChange={(e) => handleInputChange(e, "signup")}
              required
            />
            {errorMessage && <p style={{ color: "red", fontSize: "12px" }}>{errorMessage}</p>}
            <button type="submit">SIGN UP</button>
          </form>
        </div>

        {/* 개인정보 동의 팝업 */}
        {showPopup && (
          <div className="popup">
            <div className="popup-content">
              <h2>개인정보 보호 정책 동의</h2>
              <p>개인정보 보호 정책에 동의해야 회원가입이 완료됩니다.</p>
              <input
                type="checkbox"
                id="agreement"
                name="agreement"
                checked={signupData.agreement}
                onChange={(e) => handleInputChange(e, "signup")}
              />
              <label htmlFor="agreement">개인정보 보호 정책에 동의합니다.</label>
              <button onClick={handlePopupSubmit}>확인</button>
              <button onClick={() => setShowPopup(false)}>취소</button>
            </div>
          </div>
        )}

        {/* 좌우 전환 오버레이 */}
        <div className="overlay">
          <div className={`overlay-panel ${isLogin ? "left" : "right"}`}>
            <h1>{isLogin ? "Welcome Back!" : "Hello, Friend!"}</h1>
            <p>
              {isLogin
                ? "Email과 Password 입력해주세요"
                : "회원가입을 하시려면 모든 정보를 입력해주세요"}
            </p>
            <button onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "SIGN UP" : "LOGIN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
