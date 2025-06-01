import React, { useState, useEffect } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import { useNavigate } from "react-router-dom";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "../components/InboundStatus.css";

// 분리된 컴포넌트 가져오기
import Min_estimate_calculator from "./Min_estimate_calculator";
import Min_estimate_detailView from "./Min_estimate_detailView";

const API_BASE_URL = "http://34.64.211.3:5002";

const Min_estimate_main = () => {
  const [searchText, setSearchText] = useState("");
  const [tableData, setTableData] = useState([]);       // 전체(원본) 테이블 데이터
  const [filteredData, setFilteredData] = useState([]);  // 검색된(필터링된) 데이터
  const [selectedRowData, setSelectedRowData] = useState(null); // 선택된 행 데이터
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false); // 계산기 열기 상태
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false); // 상세보기 열기 상태
  const navigate = useNavigate();

  // 데이터 가져오기
  const fetchTableData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/inbound-status`);
      console.log("응답 데이터:", response.data);
      setTableData(response.data); // 테이블 데이터 설정
    } catch (error) {
      console.error("Error fetching table data:", error);
    }
  };

  // 컴포넌트가 마운트될 때 데이터 로드
  useEffect(() => {
    fetchTableData();
  }, []);

  // tableData가 바뀔 때마다 filteredData도 원본과 동일하게 초기화
  useEffect(() => {
    setFilteredData(tableData);
  }, [tableData]);

  // 검색 기능
  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearchText(value);

    const newFilteredData = tableData.filter((row) =>
      Object.values(row).some((field) =>
        field?.toString().toLowerCase().includes(value)
      )
    );

    setFilteredData(newFilteredData);
  };

  // 계산기 업데이트
  const handleCalculatorUpdate = async (updatedData) => {
    try {
      if (!selectedRowData || !selectedRowData.id) {
        alert("선택된 행의 ID가 없습니다.");
        return;
      }
  
      console.log("📡 요청 URL:", `${API_BASE_URL}/inbound-status/${selectedRowData.id}`);
      
      await axios.put(
        `${API_BASE_URL}/inbound-status/${Number(selectedRowData.id)}`, // 👈 숫자 강제 변환
        updatedData
      );
      if (!selectedRowData || !selectedRowData.id) {
        alert("선택된 행의 ID가 없습니다.");
        return;
      }
      alert("견적이 성공적으로 업데이트되었습니다!");
      fetchTableData(); // 데이터 새로고침
      setIsCalculatorOpen(false); // 계산기 닫기
      setSelectedRowData(null); // 선택된 행 초기화
    } catch (error) {
      console.error("Failed to update calculator data:", error);
      alert("업데이트 실패");
    }
  };

   // 스타일 정의
   const pageButtonStyle = {
    padding: "10px 20px",
    margin: "10px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    backgroundColor: "#f0f0f0",
    color: "#333",
    fontSize: "14px",
    transition: "all 0.3s ease",
  };

  const contentStyle = {
    backgroundColor: '#ffffff',
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  };

  const sectionTitleStyle = {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "2px solid #6f47c5",
  };

  return (
    <div style={styles.container}>
      <div style={{
          ...contentStyle,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          padding: "20px",
          background: "#f8f9fa",
        }}
      >
        <h3 style={sectionTitleStyle}>입고 상태 관리</h3>
        {/* 검색바 */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search"
            value={searchText}
            onChange={handleSearch}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ddd",
            }}
          />
          <button
            onClick={fetchTableData}
            style={{
              padding: "10px 20px",
              background: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            검색
          </button>
          <button
            onClick={() => navigate('/admin/contract-status')}
            style={styles.buttonPrimary}
          >
            계약 현황
          </button>
          <button
            onClick={() => {
              if (!selectedRowData) {
                alert("행을 먼저 선택해주세요.");
                return;
              }
              setIsCalculatorOpen(true);
            }}
            style={{
              padding: "10px 20px",
              background:
                selectedRowData &&
                (selectedRowData.contract_date === null ||
                  selectedRowData.contract_date === "non" ||
                  selectedRowData.contract_date === "계약대기")
                  ? "#E74C3C"
                  : "#ccc", // 비활성화 시 색상 변경
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor:
                selectedRowData &&
                (selectedRowData.contract_date === null ||
                  selectedRowData.contract_date === "non" ||
                  selectedRowData.contract_date === "계약대기")
                  ? "pointer"
                  : "not-allowed", // 비활성화 시 커서 변경
            }}
            disabled={
              !(
                selectedRowData &&
                (selectedRowData.contract_date === null ||
                  selectedRowData.contract_date === "non" ||
                  selectedRowData.contract_date === "계약대기")
              )
            } // 조건에 따라 버튼 비활성화
          >
            실 견적작성
          </button>
          <button
            onClick={() => {
              if (!selectedRowData) {
                alert("행을 먼저 선택해주세요.");
                return;
              }
              setIsDetailViewOpen(true);
            }}
            style={{
              padding: "10px 20px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            상세보기 열기
          </button>
        </div>

        {/* 테이블 */}
        <div className="ag-theme-alpine" style={{  flex: 1, marginTop: '20px',borderRadius: "10px" }}>
          <AgGridReact
            rowData={filteredData}  // 검색된 데이터를 넘김
            columnDefs={[
              { headerName: "ID", field: "id", sortable: true, filter: true },
              { headerName: "업체명", field: "company_name", sortable: true, filter: true },
              { headerName: "상품명", field: "product_name", sortable: true, filter: true },
              { headerName: "수량", field: "inbound_quantity", sortable: true, filter: true },
              { headerName: "창고 위치", field: "warehouse_location", sortable: true, filter: true },
              { headerName: "창고 타입", field: "warehouse_type", sortable: true, filter: true },
              { headerName: "무게", field: "weight", sortable: true, filter: true },
              { headerName: "입고 상태", field: "inbound_status", sortable: true, filter: true },
              { headerName: "계약일", field: "contract_date", sortable: true, filter: true },
              { headerName: "입고 날짜", field: "subscription_inbound_date", sortable: true, filter: true },
            ]}
            onRowClicked={(event) => setSelectedRowData(event.data)}
            pagination={true}
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 20, 50, 100]} // 10 포함
          />
        </div>
        </div>

      {/* 팝업 오버레이 */}
      {(isCalculatorOpen || isDetailViewOpen) && (
        <div
          className="overlay"
          onClick={() => {
            setIsCalculatorOpen(false);
            setIsDetailViewOpen(false);
          }}
        />
      )}

      {/* 계산기 */}
      {isCalculatorOpen && (
        <div className="popup-container">
          <Min_estimate_calculator
            selectedRowData={selectedRowData} // 선택된 행 데이터 전달
            onUpdate={handleCalculatorUpdate} // 업데이트 핸들러 전달
            onClose={() => setIsCalculatorOpen(false)} // 닫기 핸들러
          />
        </div>
      )}

      {/* 상세보기 */}
      {isDetailViewOpen && (
        <div className="popup-container">
          <Min_estimate_detailView
            selectedRowData={selectedRowData} // 선택된 행 데이터 전달
            onClose={() => setIsDetailViewOpen(false)} // 닫기 핸들러
          />
        </div>
      )}
    </div>
  );
};

export default Min_estimate_main;

const styles = {
  container: {
    padding: "20px",
  },
  buttonPrimary: {
      padding: "10px 20px",
      background: "#007bff",
      color: "white",
      border: "none",
      borderRadius: "5px",
      cursor: "pointer",
    }
}