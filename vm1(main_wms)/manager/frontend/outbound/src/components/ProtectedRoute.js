import React, { useEffect, useState } from "react";

const ProtectedRoute = ({ children }) => {
  const [authorized, setAuthorized] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("http://34.64.211.3:5004/api/outbound/protected", {
          credentials: "include",
        });

        if (res.status === 401) {
          const reissue = await fetch("http://34.64.211.3:5080/api/reissue", {
            method: "POST",
            credentials: "include",
          });

          if (!reissue.ok) throw new Error("재발급 실패");

          const retry = await fetch("http://34.64.211.3:5004/api/outbound/protected", {
            credentials: "include",
          });

          if (!retry.ok) throw new Error("재시도 실패");
          const data = await retry.json();
          if (data.role !== "admin") throw new Error("권한 없음");

          setAuthorized(true);
        } else {
          const data = await res.json();
          if (data.role !== "admin") throw new Error("권한 없음");
          setAuthorized(true);
        }
      } catch (err) {
        alert("접근 권한이 없거나 인증이 만료되었습니다.");
        window.location.href = "http://34.64.211.3:3000/";
      }
    };

    checkAuth();
  }, []);

  if (authorized === null) return <div>로딩 중...</div>;
  return children;
};

export default ProtectedRoute;
