import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import AddEquipment from "./AddEquipment"; // AddEquipment 컴포넌트 import
import EquipmentDetail from "./EquipmentDetail"; // 상세 페이지 컴포넌트 import
import MaintenanceCalendar from "../components/MaintenanceCalendar";
const API_BASE_URL = "http://34.47.73.162:5099/equipments"; // 기존 API URL로 수정



const MainPage = () => {
  const [searchText, setSearchText] = useState("");
  const [tableData, setTableData] = useState([]);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false); // 추가 모달 제어 상태
  const detailRef = useRef(null); // 상세 내용 영역 참조

  const [categoryFilter, setCategoryFilter] = useState("전체");

  // 전화번호 포맷(010-0000-0000)
  const formatPhoneNumber = (number) => {
    if (!number) return "";
    const cleaned = number.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `${cleaned.slice(0,3)}-${cleaned.slice(3,7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `${cleaned.slice(0,3)}-${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    } else {
      return number;
    }
  };

  const columnDefs = [
    { headerName: "ID", field: "id", sortable: true, filter: true },
    { headerName: "카테고리", field: "category", sortable: true, filter: true },
    { headerName: "기자재명", field: "equipment_name", sortable: true, filter: true },
    { headerName: "기자재번호", field: "equipment_no", sortable: true, filter: true },
    { headerName: "종류", field: "type", sortable: true, filter: true },
    { headerName: "수량", field: "quantity", sortable: true, filter: true },
    { headerName: "상태", field: "status", sortable: true, filter: true },
    { headerName: "위치", field: "location", sortable: true, filter: true },
    { headerName: "지역", field: "region", sortable: true, filter: true },
    { headerName: "제조사", field: "manufacturer", sortable: true, filter: true },
    { headerName: "모델", field: "model", sortable: true, filter: true },
    { headerName: "구매일", field: "purchase_date", sortable: true, filter: true,
      valueFormatter: (params) => {
        if (!params.value) return "-";
        const date = new Date(params.value);
        return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
      } },
    { headerName: "보증 만료일", field: "warranty_expiry", sortable: true, filter: true,
      valueFormatter: (params) => {
        if (!params.value) return "-";
        const date = new Date(params.value);
        return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
      } },
    { headerName: "마지막 점검일", field: "last_maintenance_date", sortable: true, filter: true,
      valueFormatter: (params) => {
        if (!params.value) return "-";
        const date = new Date(params.value);
        return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
      } },
    { headerName: "다음 점검일", field: "next_maintenance_date", sortable: true, filter: true,
      valueFormatter: (params) => {
        if (!params.value) return "-";
        const date = new Date(params.value);
        return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
      } },
    { headerName: "담당자", field: "assigned_to", sortable: true, filter: true },
    { headerName: "담당자 전화번호", field: "assigned_to_phone",valueFormatter: ({ value }) => formatPhoneNumber(value), sortable: true, filter: true },
    { headerName: "비고", field: "remarks", sortable: true, filter: true },
    { headerName: "등록일", field: "created_at", sortable: true, filter: true,
      valueFormatter: (params) => {
        if (!params.value) return "-";
        const date = new Date(params.value);
        return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
      } }
  ];
//------------------//
  

  const handleCategoryClick = (category) => {
    setCategoryFilter(category);
  };

  const fetchTableData = async () => {
    try {
      const response = await axios.get(API_BASE_URL, {
        params: {
          search: searchText,
          category: categoryFilter !== "전체" ? categoryFilter : null
        }
      });
      let data = response.data;
  
      // 카테고리 필터 적용
      if (categoryFilter !== "전체") {
        data = data.filter(item => item.category === categoryFilter);
      }
  
      setTableData(data);  // 필터링된 데이터를 테이블에 설정
    } catch (error) {
      console.error("Error fetching table data:", error);
    }
  };

  useEffect(() => {
    fetchTableData(); // 컴포넌트가 처음 렌더링될 때 데이터 로드
  }, [searchText, categoryFilter]);

  const handleRowClick = (event) => {
    setSelectedRowData(event.data); // 행 클릭 시 상세 데이터 설정
  };

  // 배경 클릭 시 상세 내용 닫기
  const handleBackgroundClick = (event) => {
    // 상세 모달 외부 클릭 감지
    if (
      detailRef.current &&
      !detailRef.current.contains(event.target) &&
      !event.target.closest(".fc-event") // ← FullCalendar 이벤트 클릭은 무시
    ) {
      setSelectedRowData(null);
    }
  };

  // 배경 클릭 이벤트 리스너 추가
  useEffect(() => {
    document.addEventListener("click", handleBackgroundClick);
    return () => {
      document.removeEventListener("click", handleBackgroundClick); // 컴포넌트 언마운트 시 이벤트 리스너 제거
    };
  }, []);


  

  // 추가 버튼 클릭 시 모달 열기

  const toggleAddModal = () => setShowAddModal((prev) => !prev);

  // 문자 테스트 //
  const sendTestSMS = async () => {
    try {
      const response = await fetch("http://34.47.73.162:5099/api/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone_number: "01082649748",  // 수신자 번호
          message: "기자재 점검 알림 테스트입니다!"  // 문자 내용
        })
      });
  
      const result = await response.json();
      console.log("문자 전송 응답:", result);  // 디버깅용 콘솔 로그
  
      if (result.groupId || result.status === "success") {
        alert("문자 전송 성공!");
      } else {
        const errorMsg =
          result?.message ||
          result?.errorMessage ||
          result?.result?.errorMessage ||
          "알 수 없는 오류";
        alert("문자 전송 실패: " + errorMsg);
      }
    } catch (error) {
      console.error("문자 전송 중 에러:", error);
      alert("문자 전송 중 오류가 발생했습니다.");
    }
  };
  
  
  return (
    <div style={{ width: "96%", margin: "20px auto" }}>
      {/* 캘린더 박스 */}
      <div style={{
        marginBottom: "40px",
        padding: "20px",
        borderRadius: "10px",
        backgroundColor: "#ffffff",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      }}>
        <h3 style={{ marginBottom: "10px", fontSize: "20px" }}>장비 점검 캘린더</h3>
        <div style={{ border: "1px solid #6f47c5", width: "100%", backgroundColor: "#6f47c5", marginBottom: "20px" }}>
      </div>

        <MaintenanceCalendar
          equipmentList={tableData}
          onEventClick={(equipment) => {
            console.log("MainPage에서 받은 equipment", equipment);
            setSelectedRowData(equipment);
          }}
        />
      </div>
  
      {/* 기자재 현황 박스 */}
      <div style={{
        padding: "20px",
        borderRadius: "10px",
        backgroundColor: "#ffffff",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column"
        }}>
        <h3 style={{ marginBottom: "10px", marginTop: "10px", fontSize: "20px" }}>기자재 현황</h3>
        <div style={{ border: "1px solid #6f47c5", width: "100%", backgroundColor: "#6f47c5", marginBottom: "10px" }}>
      </div>
      
      {/* 카테고리 필터 버튼 */}
      <div style={{ marginBottom: "10px", display: "flex", gap: "10px" }}>
        {["전체", "렌트", "비품", "소모품"].map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            style={{
              padding: "6px 12px",
              backgroundColor: categoryFilter === category ? "#6f47c5" : "#e0e0e0",
              color: categoryFilter === category ? "#fff" : "#000",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            {category}
          </button>
        ))}
      </div>

<div style={{ flex: 4, display: "flex", flexDirection: "column", gap: "20px" }}>
  <div style={{ display: "flex", gap: "20px" }}>
    <input
      type="text"
      placeholder="Search"
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
      style={{
        flex: 4,
        padding: "8px",
        borderRadius: "5px",
        border: "1px solid #ddd",
        fontSize: "14px",
      }}
    />
    <button
      onClick={fetchTableData}
      style={{
        flex: 1,
        padding: "8px 12px",
        background: "#4caf50",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        fontSize: "14px",
      }}
    >
      검색
    </button>
    <button
      onClick={toggleAddModal}
      style={{
        flex: 1,
        padding: "8px 12px",
        background: "#007bff",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        fontSize: "14px",
      }}
    >
      추가
    </button>
  </div>

  <div style={{ display: "flex", flex: 1, gap: "20px" }}>
    <div className="ag-theme-alpine" style={{ flex: 3, borderRadius: "10px" }}>
      <AgGridReact
        rowData={tableData}
        columnDefs={columnDefs}
        onRowClicked={handleRowClick}
        pagination={true}
        paginationPageSize={10}
      />
    </div>
  </div>

  {selectedRowData && (
  <>
  {console.log("🔥 selectedRowData:", selectedRowData)}
    {console.log("모달 조건 충족! selectedRowData 있음")}
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", zIndex: 9998 }} />
    <div
      ref={detailRef}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "500px",
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        padding: "30px",
        zIndex: 9999
      }}
    >
      
      <EquipmentDetail equipment={selectedRowData} />
      <button
        onClick={() => setSelectedRowData(null)}
        style={{
          display: "block",
          marginLeft: "auto",
          marginTop: "20px",
          padding: "8px 20px",
          background: "#6f47c5",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          fontSize: "14px"
        }}
      >
        닫기
      </button>
    </div>
  </>
)}

</div>
  {showAddModal && (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "10px",
          padding: "20px",
          width: "400px",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
        }}
      >
        <AddEquipment onClose={toggleAddModal} onAdd={fetchTableData} />
      </div>
    </div>
  )}
  
</div>



    {/* 문자 테스트용 */}
    <button
      onClick={sendTestSMS}
      style={{
        marginTop: "10px",
        padding: "8px 12px",
        backgroundColor: "#28a745",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer"
      }}
    >
      문자 테스트 전송
    </button>

    </div>
  );
};

export default MainPage;
