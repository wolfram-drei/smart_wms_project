import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { axios5010 } from '../api/axios';
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const API_BASE_URL = "http://34.64.211.3:5014";
const API_DASHBOARD_BASE_URL = "http://34.64.211.3:5010";

const Customeroutboundrequest = () => {
  const [outboundItems, setOutboundItems] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [sortType, setSortType] = useState('latest');
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [loading, setLoading] = useState(false);
  const detailRef = useRef(null); // 상세 내용 영역 참조

  const API_BASE_URL = 'http://34.64.211.3:5014';
  const API_DASHBOARD_BASE_URL = "http://34.64.211.3:5010";

  // 데이터 가져오기 함수
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios5010.get(`${API_DASHBOARD_BASE_URL}/dashboard/storage-items`);
      const allItems = response.data?.all_items || [];
      console.log("🔍 전체 아이템:", allItems);
      // ✅ 출고 상태 필터링
      const filtered = allItems.filter(item =>
        ['출고 준비중', '출고 준비 완료', '배차 완료', '출고완료'].includes(item.outbound_status)
      );
      // ✅ 날짜 형식 통일
      const formatDate = (date) =>
        date ? new Date(date).toISOString().split("T")[0] : null;

      const processed = filtered.map(item => ({
        ...item,
        contract_date: formatDate(item.contract_date),
        outbound_date: formatDate(item.outbound_date),
        last_outbound_date: formatDate(item.last_outbound_date),
      }));

      setOutboundItems(processed);
    } catch (error) {
      console.error("출고 요청 목록 불러오기 오류:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columnDefs = [
    { field: "product_name", headerName: "상품명" },
    { field: "product_number", headerName: "상품번호" },
    { field: "inbound_quantity", headerName: "수량" },
    { field: "warehouse_location", headerName: "창고위치" },
    { field: "warehouse_type", headerName: "창고타입" },
    { field: "outbound_status", headerName: "출고상태" },
    { field: "outbound_date", headerName: "출고일" },
    { field: "last_outbound_date", headerName: "최종출고일" },
  ];

  const handleRowClick = (event) => {
    console.log("📌 클릭된 행 데이터:", event.data);
    setSelectedRowData(event.data);
  };

  const [activeTab, setActiveTab] = useState('출고 준비중');
  const statusTabs = ['출고 준비중', '출고 준비 완료', '배차 완료', '출고완료'];
  const getFilteredAndSortedData = () => {
    let filtered = [...outboundItems];
    // 탭 필터링 (출고준비중/준비완료/배차완료/출고완료 )
    if (activeTab) {
      filtered = filtered.filter(item => item.outbound_status === activeTab);
    }
    // 검색 적용 (상품명, 상품번호)
    if (searchText.trim() !== "") {
      filtered = filtered.filter(item =>
        (item.product_name?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.product_number?.toLowerCase().includes(searchText.toLowerCase()))
      );
    }
    // 정렬 적용 (날짜순, 상품명순)
    if (sortType === "latest") {
      filtered.sort((a, b) => new Date(b.id || 0) - new Date(a.id || 0));
    } else if (sortType === "oldest") {
      filtered.sort((a, b) => new Date(a.id || 0) - new Date(b.id || 0));
    } else if (sortType === "product") {
      filtered.sort((a, b) => a.product_name.localeCompare(b.product_name));
    }
    return filtered;
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h2 style={styles.sectionTitle}>출고 현황</h2>
        {/* 🔎 검색 + 정렬 */}
        <div style={styles.searchFilterContainer}>
          <input
            type="text"
            placeholder="상품명 또는 상품번호 검색"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={styles.filterInput}
          />
          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value)}
            style={styles.sortSelect}
          >
            <option value="latest">최근 등록순</option>
            <option value="oldest">과거 등록순</option>
            <option value="name">상품명순</option>
          </select>
        </div>
        {/* 🔽 탭 버튼 UI */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {statusTabs.map(status => (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderBottom: activeTab === status ? '3px solid #6f47c5' : '3px solid transparent',
                background: 'transparent',
                color: activeTab === status ? '#6f47c5' : '#333',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* 🔽 상태별 테이블 */}
        <div 
          className="ag-theme-alpine" 
          style={{
            height: "calc(100vh - 300px)",
            width: "100%",
            minWidth: "800px",
            minHeight: "400px"
          }}
        >
          <AgGridReact
            rowData={getFilteredAndSortedData()}
            columnDefs={columnDefs}
            onRowClicked={handleRowClick}
            pagination={true}
            paginationPageSize={12}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              suppressMovable: true
            }}
            domLayout="normal"
            gridOptions={{
              headerHeight: 50,
              rowHeight: 40,
            }}
            onGridReady={(params) => {
              try {
                params.api.sizeColumnsToFit();
            
                // 👇 그래도 안 맞는 경우 강제 autosize fallback
                const allColumnIds = [];
                params.columnApi.getAllColumns().forEach(column => {
                  allColumnIds.push(column.getColId());
                });
                params.columnApi.autoSizeColumns(allColumnIds);
              } catch (e) {
                console.error("❌ 컬럼 사이즈 조절 실패:", e);
              }
            }}
          />
        </div>

        {/* 상세 정보 영역 */}
        {selectedRowData && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}>📦 출고 상세정보</span>
              <button onClick={() => setSelectedRowData(null)} style={styles.closeButton}>✕</button>
            </div>

            <table style={styles.infoTable}>
              <tbody>
                <tr><th style={styles.infoTableTh}>업체명</th><td style={styles.infoTableTd}>{selectedRowData.company_name}</td></tr>
                <tr><th style={styles.infoTableTh}>연락처</th><td style={styles.infoTableTd}>{selectedRowData.contact_phone || '-'}</td></tr>
                <tr><th style={styles.infoTableTh}>상품명</th><td style={styles.infoTableTd}>{selectedRowData.product_name}</td></tr>
                <tr><th style={styles.infoTableTh}>출고 수량</th><td style={styles.infoTableTd}>{selectedRowData.outbound_quantity || selectedRowData.inbound_quantity}</td></tr>
                <tr><th style={styles.infoTableTh}>창고 위치</th><td style={styles.infoTableTd}>{selectedRowData.warehouse_location}</td></tr>
                <tr><th style={styles.infoTableTh}>창고 타입</th><td style={styles.infoTableTd}>{selectedRowData.warehouse_type}</td></tr>
                <tr><th style={styles.infoTableTh}>계약일</th><td style={styles.infoTableTd}>{selectedRowData.contract_date}</td></tr>
                <tr><th style={styles.infoTableTh}>출고 상태</th><td style={styles.infoTableTd}>{selectedRowData.outbound_status}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Customeroutboundrequest;

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
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    textAlign: "center",
  },
  tableContainer: {
    width: "100%",
    height: "500px"
  },
  detailContainer: {
    marginTop: "20px",
    padding: "20px",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
    border: "1px solid #ddd",
    zIndex: 9999,
    position: "relative",
  },
  detailContent: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: "24px",
    borderRadius: "10px",
    width: "480px",
    maxWidth: "90%",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  modalTitle: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#6f47c5",
  },
  closeButton: {
    backgroundColor: "#999",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    fontSize: "14px",
    padding: "6px 12px",
    cursor: "pointer",
  },
  infoTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    marginBottom: "20px",
  },
  infoTableTh: {
    textAlign: "left",
    padding: "8px",
    backgroundColor: "#f2f2f2",
    width: "35%",
  },
  infoTableTd: {
    padding: "8px",
    backgroundColor: "#fafafa",
  },
  searchFilterContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
    gap: "10px",
  },
  filterInput: {
    flex: 1,
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #c5b3f1",
    color: "#4a2e91",
    fontSize: "14px",
    outline: "none",
  },
  sortSelect: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #c5b3f1",
    color: "#4a2e91",
    fontSize: "14px",
    cursor: "pointer",
  },
};

