// src/pages/auth/LoginForm.js

import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import naverLogo from "../../assets/naver-login.png";

const LoginForm = ({ loginData, onChange, onSubmit, onGoogleSuccess }) => {
  return (
      <form onSubmit={onSubmit}>
        <h1>Login</h1>
        <input
            type="email"
            name="email"
            placeholder="Email"
            value={loginData.email}
            onChange={(e) => onChange(e, "login")}
            required
        />
        <input
            type="password"
            name="password"
            placeholder="Password"
            value={loginData.password}
            onChange={(e) => onChange(e, "login")}
            required
        />
        <GoogleLogin
            onSuccess={onGoogleSuccess}
            onError={() => alert("구글 로그인 실패")}
        />
        <a
            href={`https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.REACT_APP_NAVER_CLIENT_ID}&redirect_uri=${process.env.REACT_APP_NAVER_REDIRECT_URI}&state=naver`}
        >
          <img src={naverLogo} alt="네이버 로그인" style={{ width: "200px", marginTop: "10px" }} />
        </a>
        <button type="submit" className="login-button">LOG IN</button>
      </form>
  );
};

export default LoginForm;
