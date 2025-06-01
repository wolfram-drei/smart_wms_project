import React from "react";
import { useNavigate } from "react-router-dom";
import '../components/Main.css'; // 스타일을 외부에서 관리한다면

const Main = () => {
  const navigate = useNavigate();

  return (
    <div className="main-container">
      <h1 className="main-title">관리 시스템</h1>
      <div className="button-container">
        <button
          className="custom-button inbound-button"
          onClick={() => navigate("/admin/Smart_Phone")}
        >
          계약 입고
        </button>
        <button
          className="custom-button outbound-button"
          onClick={() => navigate("/admin/Smart_Phone_Out")}
        >
          출고 요청
        </button>
      </div>
    </div>
  );
};

export default Main;
