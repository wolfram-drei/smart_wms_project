import React, { useState, useEffect } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "../components/InboundStatus.css";

import Min_estimate_detailView from "./Min_estimate_detailView";

// 서버 API base URL
const API_BASE_URL = "http://34.64.211.3:5008";

const SmPhoneInbound = () => {
  const [searchText, setSearchText] = useState("");
  const [tableData, setTableData] = useState([]);       // Sm_Phone_Inbound 테이블 조회 결과
  const [filteredData, setFilteredData] = useState([]);  // 검색 필터 결과
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);

  // (1) Sm_Phone_Inbound 테이블 데이터 로드
  const fetchTableData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/inbound-status`);
      console.log("응답 데이터:", response.data);

      // '계약대기' 상태 제외
      const filtered = response.data.filter((item) => item.contract_date !== "계약대기");
      setTableData(filtered);
    } catch (error) {
      console.error("Error fetching table data:", error);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, []);

  useEffect(() => {
    setFilteredData(tableData);
  }, [tableData]);

  // (2) MainTable → Sm_Phone_Inbound 로 업로드
  // 바코드 스캔/인식된 목록(barcodes)은 이미 다른 페이지에서 획득했다고 가정.
  // 이 함수를 통해 서버로 요청을 보내, MainTable의 해당 데이터를 읽어 Sm_Phone_Inbound에 INSERT 시킨다고 예시를 듭니다.
  const handleBulkUpload = async () => {
    try {
      // 예: 이미 다른 페이지에서 가져온 바코드 리스트
      const barcodes = ["CONTRACT002", "CONTRACT007", "CONTRACT008"];

      // 서버에서 MainTable 조회 후 Sm_Phone_Inbound로 bulk insert하는 API
      // body로 barcodes를 넘겨줌
      const response = await axios.post(`${API_BASE_URL}/bulk-upload`, { barcodes });
      
      // 업로드 성공 시 테이블 재조회
      if (response.status === 200) {
        alert("MainTable에서 Sm_Phone_Inbound로 데이터 업로드 성공!");
        fetchTableData(); 
      }
    } catch (error) {
      console.error("Bulk upload error:", error);
      alert("업로드에 실패했습니다.");
    }
  };

  // 검색 기능
  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearchText(value);

    const newFilteredData = tableData.filter((row) =>
      Object.values(row).some((field) => field?.toString().toLowerCase().includes(value))
    );
    setFilteredData(newFilteredData);
  };

  // 상태 변경
  const handleStatusChange = async (newStatus) => {
    if (!selectedRowData) {
      alert("행을 먼저 선택해주세요.");
      return;
    }
    try {
      const updatedRow = { ...selectedRowData, inbound_status: newStatus };
      // 1) Sm_Phone_Inbound 테이블 상태 업데이트
      await axios.put(`${API_BASE_URL}/inbound-status-detail/${selectedRowData.id}`, updatedRow);

      // 2) 만약 상태가 '입고 완료'면 MainTable도 업데이트
      if (newStatus === "입고 완료") {
        // 백엔드 로직에서 MainTable까지 동시에 업데이트하는 방법(한 개의 API에서 처리) 
        // 또는 별도의 엔드포인트를 호출해서 MainTable을 업데이트하는 방법(아래 예시) 둘 중 택1

        // 예) 별도 엔드포인트로 MainTable 업데이트
        await axios.put(`${API_BASE_URL}/update-main-table`, {
          // 필요한 필드들: 바코드 번호 or unique key, inbound_status, inbound_date 등
          id: selectedRowData.id,           // 어떤 조건으로 MainTable을 찾아 업데이트할지
          inbound_status: newStatus,
          inbound_date: new Date().toISOString().split("T")[0], // yyyy-mm-dd 형태
        });
      }

      alert(`상태가 '${newStatus}'(으)로 변경되었습니다.`);
      fetchTableData(); 
      setSelectedRowData(null);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("상태 업데이트 실패");
    }
  };

  // 상태 변경 취소(입고 완료 → 입고 준비로)
  const handleCancelStatus = () => {
    handleStatusChange("입고 준비");
  };

  // AG Grid 컬럼 정의
  const columnDefs = [
    { headerName: "ID", field: "id", sortable: true, filter: true },
    { headerName: "입고 상태", field: "inbound_status", sortable: true, filter: true },
    { headerName: "업체명", field: "company_name", sortable: true, filter: true },
    { headerName: "상품명", field: "product_name", sortable: true, filter: true },
    { headerName: "수량", field: "inbound_quantity", sortable: true, filter: true },
    { headerName: "창고 위치", field: "warehouse_location", sortable: true, filter: true },
    { headerName: "창고 타입", field: "warehouse_type", sortable: true, filter: true },
    { headerName: "계약일", field: "contract_date", sortable: true, filter: true },
    { headerName: "입고 날짜", field: "inbound_date", sortable: true, filter: true },
  ];

  // 현재 행의 상태 판별
  const currentStatus = selectedRowData?.inbound_status;
  const isReady = currentStatus === "입고 준비";  // 기본 상태
  const isProgress = currentStatus === "입고 중";
  const isDone = currentStatus === "입고 완료";

  return (
    <div style={{
    backgroundColor:"#FFFFFF", 
    width:"96%",
    marginLeft:"20px",
    marginTop:"30px",
    borderRadius:"10px"}}>
    <div style={{ display: "flex", 
      height: "100vh", 
      padding: "10px", 
      background: "#FFFFFF",
      borderRadius:"10px" }}>
      {/* 왼쪽: 검색, 버튼, AG Grid */}
      <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "20px" }}>
        <h3 style={{fontSize:"18px", marginLeft:"5px"}}>스마트폰 입고 조회</h3>
        <div style={{width:"98.5%",backgroundColor:"#6f47c5", 
        border:"1px solid #6f47c5",
        marginBottom:"10px"}}></div>
        {/* 검색 + 상태변경 버튼들 나란히 */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="검색..."
            value={searchText}
            onChange={handleSearch}
            style={{
              flex: "1",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ddd",
            }}
          />
          <button
            onClick={fetchTableData}
            style={{
              padding: "8px 12px",
              background: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            검색
          </button>

          

          {/* '상태변경 취소' 버튼: 입고 완료일 때만 활성화 (→입고 준비로) */}
          <button
            onClick={handleCancelStatus}
            style={{
              padding: "8px 12px",
              background: isDone ? "#fbc549" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: isDone ? "pointer" : "not-allowed",
            }}
            disabled={!isDone}
          >
            상태변경 취소
          </button>
           
          {/* 상세보기 열기 */}
          <button
            onClick={() => {
              if (!selectedRowData) {
                alert("행을 먼저 선택해주세요.");
                return;
              }
              setIsDetailViewOpen(true);
            }}
            style={{
              padding: "8px 12px",
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
        <div className="ag-theme-alpine" style={{ flex: 1, borderRadius: "10px" }}>
          <AgGridReact
            rowData={filteredData}
            columnDefs={columnDefs}
            onRowClicked={(event) => setSelectedRowData(event.data)}
            pagination={true}
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 20, 50, 100]}
          />
        </div>
      </div>

      {/* 팝업 오버레이 */}
      {isDetailViewOpen && (
        <div
          className="overlay"
          onClick={() => {
            setIsDetailViewOpen(false);
          }}
        />
      )}

      {/* 상세보기 */}
      {isDetailViewOpen && selectedRowData && (
        <div className="popup-container">
          <Min_estimate_detailView
            selectedRowData={selectedRowData}
            onClose={() => setIsDetailViewOpen(false)}
          />
        </div>
      )}
    </div>
    </div>
  );
};

export default SmPhoneInbound;
