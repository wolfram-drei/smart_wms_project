import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(null); // null = 로딩 중

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("http://34.64.211.3:5001/api/inbound/protected", {
          credentials: "include",
        });

        if (res.status === 401) {
          // accessToken 만료 → refreshToken으로 재발급 시도
          const reissue = await fetch("http://34.64.211.3:5080/api/reissue", {
            method: "POST",
            credentials: "include",
          });

          if (!reissue.ok) {
            throw new Error("재발급 실패");
          }

          // 재발급 성공 후 재요청
          const retry = await fetch("http://34.64.211.3:5001/api/inbound/protected", {
            credentials: "include",
          });

          const retryData = await retry.json();
          if (!retry.ok || retryData.role !== "admin") {
            throw new Error("권한 없음");
          }

          setAuthorized(true);
        } else {
          const data = await res.json();
          if (res.ok && data.role === "admin") {
            setAuthorized(true);
          } else {
            throw new Error("권한 없음");
          }
        }
      } catch (err) {
        console.warn("🔒 인증 실패:", err.message);
        alert("로그인 정보가 없거나 권한이 없습니다.");
        window.location.href = "http://34.64.211.3:3000/";
      }
    };

    checkAuth();
  }, [navigate]);

  if (authorized === null) return <div>로딩 중...</div>;
  return children;
};

export default ProtectedRoute;
