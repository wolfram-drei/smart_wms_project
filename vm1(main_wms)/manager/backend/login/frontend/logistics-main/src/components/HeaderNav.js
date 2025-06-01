import React from "react";
import { useNavigate } from "react-router-dom";
import "./HeaderNav.css";
import API from "../api/axiosInstance";


const HeaderNav = () => {
    const navigate = useNavigate();
    const role = localStorage.getItem("role");
    const isLoggedIn = !!localStorage.getItem("role");

    const handleLogout = async () => {
        try {
          await API.post("/logout");
        } catch (err) {
            console.error("로그아웃 실패:", err);
        } finally {
            localStorage.clear(); // accessToken, email, role 제거
            navigate("/"); // 메인 페이지로 이동
        }
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    const handleGoHome = () => {
        navigate("/");
    };

    return (
        <div className="header-nav">
            {/* 왼쪽 버튼 그룹 */}
            <div className="nav-left">
                <button onClick={handleGoBack}>←</button>
                <button onClick={handleGoHome}>홈</button>
            </div>

            {/* 오른쪽 메뉴 그룹 */}
            <div className="top-bar nav-right">
                {!isLoggedIn && (
                    <>
                        <button onClick={() => navigate("/about")}>제품 설명</button>
                        <button onClick={() => navigate("/contact")}>Contact</button>
                        <button onClick={() => navigate("/login")}>로그인/회원가입</button>
                    </>
                )}
                {isLoggedIn && role === "user" && (
                    <>
                        <button onClick={() => window.location.href = "http://34.64.211.3:4000/user/CustomerMainPage"}>WMS</button>
                        <button onClick={() => navigate("/about")}>제품 설명</button>
                        <button onClick={() => navigate("/contact")}>Contact</button>
                        <button onClick={() => navigate("/mypage")}>마이페이지</button>
                        <button onClick={handleLogout}>로그아웃</button>
                    </>
                )}
                {isLoggedIn && role === "admin" && (
                    <>
                        <button onClick={() => window.location.href = "http://34.64.211.3:3050/admin/Mainpage"}>WMS</button>
                        <button onClick={() => navigate("/about")}>제품 설명</button>
                        <button onClick={() => navigate("/mypage")}>마이페이지</button>
                        <button onClick={() => navigate("/admin")}>관리자 페이지</button>
                        <button onClick={handleLogout}>로그아웃</button>
                    </>
                )}
            </div>
        </div>
    );
};

export default HeaderNav;
