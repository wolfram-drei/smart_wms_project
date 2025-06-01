import React, { useState, useEffect } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "../components/InboundStatus.css";

import Min_estimate_detailView from "./Min_estimate_detailView";

const API_BASE_URL = "http://34.64.211.3:5002";

const Min_state = () => {
  const [searchText, setSearchText] = useState("");
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [activeTab, setActiveTab] = useState("입고 준비");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleButtonClick = () => {
    // 링크 이동 버튼
    window.location.href = "http://34.64.211.3:3001/admin/SmPhoneInbound";
  };

  // 데이터 로드
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
    const newFiltered = tableData.filter(
      (item) => item.inbound_status === activeTab
    );
    setFilteredData(newFiltered);
  }, [tableData, activeTab]);

  // 검색 기능
  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearchText(value);
    const searched = tableData.filter(
    (row) =>
      row.inbound_status === activeTab &&
      Object.values(row).some((field) =>
        field?.toString().toLowerCase().includes(value)
      )
  );
  setFilteredData(searched);
  };

  // 상태 업데이트 핸들러
  const handleStatusUpdate = async (newStatus) => {
    if (!selectedRowData) return;
    const updatedRow = { ...selectedRowData, inbound_status: newStatus };
    console.log("업데이트 대상 ID:", selectedRowData.id);
    console.log("업데이트 데이터:", updatedRow);
    try {
      await axios.put(`${API_BASE_URL}/inbound-status-detail/${selectedRowData.id}`, updatedRow);
      alert(`상태가 '${newStatus}'(으)로 변경되었습니다.`);
      fetchTableData(); 
      setIsModalOpen(false); // 모달 닫기
      setSelectedRowData(null); // 선택 초기화
    } catch (error) {
      console.error("상태 업데이트 실패:", error);
      alert("상태 업데이트에 실패했습니다.");
    }
  };

  // AG Grid 컬럼 정의
  const columnDefs = [
    { headerName: "ID", field: "id", sortable: true, filter: true, width : "80px" },
    { headerName: "입고 상태", field: "inbound_status", sortable: true, filter: true, flex: 1 },
    { headerName: "업체명", field: "company_name", sortable: true, filter: true, flex: 1 },
    { headerName: "상품명", field: "product_name", sortable: true, filter: true, flex: 1 },
    { headerName: "수량", field: "inbound_quantity", sortable: true, filter: true, flex: 1 },
    { headerName: "창고 위치", field: "warehouse_location", sortable: true, filter: true, flex: 1 },
    { headerName: "창고 타입", field: "warehouse_type", sortable: true, filter: true, flex: 1 },
    { headerName: "계약일", field: "contract_date", sortable: true, filter: true, flex: 1 },
    { headerName: "입고 날짜", field: "subscription_inbound_date", sortable: true, filter: true, flex: 1 },
];

  // 현재 행의 상태 판별
  const currentStatus = selectedRowData?.inbound_status;
  const isReady = currentStatus === "입고 준비";   // 기본 상태
  const isProgress = currentStatus === "입고 중";
  const isDone = currentStatus === "입고 완료";

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h2 style={styles.sectionTitle}>입고 현황</h2>

        {/* 검색 + 상태변경 버튼들 */}
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="검색..."
            value={searchText}
            onChange={handleSearch}
            style={styles.inputField}
          />
          {/* 스마트폰 입고 링크 */}
          <button
            onClick={handleButtonClick}
            style={styles.buttonPrimary}
          >
            스마트폰 입고
          </button>
        </div>

        <div style={styles.tabContainer}>
          {["입고 준비", "입고 대기", "입고 중", "입고 완료"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tabButton,
                ...(activeTab === tab ? styles.tabButtonActive : {}),
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* AG Grid */}
        <div className="ag-theme-alpine" style={styles.tableContainer}>
          <AgGridReact
            rowData={filteredData}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              suppressMovable: true
            }}
            onRowClicked={(event) => {
              setSelectedRowData(event.data);
              setIsModalOpen(true);  // ✅ 모달 열기
            }}
            pagination={true}
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 20, 50, 100]}
            domLayout="autoHeight"
            gridOptions={{
              headerHeight: 50,
              rowHeight: 40,
              suppressHorizontalScroll: true,
            }}
          />
        </div>
      </div>

      {isModalOpen && selectedRowData && (
      <div style={styles.modalOverlay}>
        <div style={styles.modalBox}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>
            {selectedRowData.company_name} - {selectedRowData.product_name}
          </h3>
          <button style={styles.modalCloseTop} onClick={() => setIsModalOpen(false)}>
            ×
          </button>
        </div>
          <table style={styles.modalTable}>
            <tbody>
              <tr>
                <td style={styles.modalCellHeader}>업체명</td>
                <td style={styles.modalCellBody}>{selectedRowData.company_name}</td>
              </tr>
              <tr>
                <td style={styles.modalCellHeader}>상품명</td>
                <td style={styles.modalCellBody}>{selectedRowData.product_name}</td>
              </tr>
              <tr>
                <td style={styles.modalCellHeader}>수량</td>
                <td style={styles.modalCellBody}>{selectedRowData.inbound_quantity}</td>
              </tr>
              <tr>
                <td style={styles.modalCellHeader}>창고 위치</td>
                <td style={styles.modalCellBody}>{selectedRowData.warehouse_location}</td>
              </tr>
              <tr>
                <td style={styles.modalCellHeader}>입고 상태</td>
                <td style={{ ...styles.modalCellBody, display: "flex", alignItems: "center", gap: "10px" }}>
                  <select
                    value={selectedRowData.inbound_status}
                    onChange={(e) =>
                      setSelectedRowData((prev) => ({
                        ...prev,
                        inbound_status: e.target.value,
                      }))
                    }
                    style={styles.selectBox}
                  >
                    {["입고 준비", "입고 대기", "입고 중", "입고 완료"].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button style={styles.modalSaveButton} onClick={() => handleStatusUpdate(selectedRowData.inbound_status)}>
                    변경
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )}
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
  },
  content: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "2px solid #6f47c5",
  },
  tabContainer: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
  },
  tabButton: {
    padding: "8px 16px",
    fontSize: "14px",
    fontWeight: "bold",
    border: "none",
    borderBottom: "2px solid transparent",
    backgroundColor: "transparent",
    cursor: "pointer",
  },
  tabButtonActive: {
    borderBottom: "2px solid #6f47c5",
    color: "#6f47c5",
  },
  searchContainer: {
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  inputField: {
    flex: "4",
    padding: "8px",
    borderRadius: "5px",
    border: "1px solid #ddd",
    fontSize: "14px",
  },
  buttonPrimary: {
    flex: "1",
    padding: "8px 12px",
    backgroundColor: "#6f47c5",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    textAlign: "center",
  },
  tableContainer: {
    height: "500px",
    width: "100%",
  },
  agGridHeader: {
    backgroundColor: "#e6e1f7",
    color: "#6f47c5",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: "14px",
  },
  agGridRow: {
    fontSize: "12px",
    textAlign: "center",
    borderBottom: "1px solid #ddd",
    '&:hover': {
      backgroundColor: "#f3eefc",
    },
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  modalBox: {
    backgroundColor: "white",
    padding: "24px",
    borderRadius: "10px",
    width: "520px",
    boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#6f47c5",
    marginBottom: "16px",
  },
  modalTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "16px",
  },
  modalCellHeader: {
    backgroundColor: "#f9f9f9",
    padding: "10px",
    fontWeight: "bold",
    width: "30%",
    border: "1px solid #ddd",
  },
  modalCellBody: {
    padding: "10px",
    border: "1px solid #ddd",
  },
  selectBox: {
    width: "60%",
    padding: "6px",
    borderRadius: "4px",
    border: "1px solid #ccc",
  },
  modalButtonGroup: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  modalSaveButton: {
    padding: "7px 16px",
    backgroundColor: "#6f47c5",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  modalCloseTop: {
    fontSize: "22px",
    background: "transparent",
    border: "none",
    color: "#999",
    cursor: "pointer",
    fontWeight: "bold",
    lineHeight: "1",
  }
};

export default Min_state;
