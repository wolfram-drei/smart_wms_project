import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { axios5010 } from '../api/axios';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

function Customeroutboundrequest() {
  const [outboundItems, setOutboundItems] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [sortType, setSortType] = useState('latest');
  const [selectedRow, setSelectedRow] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = 'http://34.64.211.3:5013';
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
        ['입고완료', '출고요청', '출고완료'].includes(item.outbound_status)
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
    { field: "contract_date", headerName: "계약일" },
    { field: "outbound_date", headerName: "출고예정일" },
    { field: "last_outbound_date", headerName: "최종출고일" },
  ];

  const handleRowClick = (params) => {
    setSelectedRow(params.data);
    setIsModalOpen(true);
  };

  const handleRequestSubmit = async (id) => {
    if (!selectedRow.subscription_inbound_date || !selectedRow.outbound_date || !selectedRow.total_cost) {
      alert("출고 요청에 필요한 데이터가 누락되었습니다. 관리자에게 문의해주세요.");
      console.log("👉 선택된 행의 데이터:", selectedRow);
      console.log("📦 subscription_inbound_date:", selectedRow.subscription_inbound_date);
      console.log("📦 outbound_date:", selectedRow.outbound_date);
      console.log("📦 total_cost:", selectedRow.total_cost);
      return;
    }
  
    try {
      const response = await fetch(`${API_BASE_URL}/create-outbound-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include", // <-- 쿠키 인증 방식이라면 꼭 필요
        body: JSON.stringify({ id }),
      });
  
      if (!response.ok) throw new Error('출고 요청 생성 실패');
  
      const responseData = await response.json();
      alert(`출고 요청 완료\n\n비용 차이: ${responseData.비용차이}원\n최종 청구 비용: ${responseData.최종청구비용}원\n설명: ${responseData.설명}`);
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('출고 요청 중 오류:', error);
      alert('출고 요청 중 오류가 발생했습니다.');
    }
  };

  const handlePrintRequest = () => {
    if (!selectedRow) return;
    
    // 프린트용 새 창 생성
    const printWindow = window.open('', '', 'width=600,height=600');
    const currentDate = new Date().toLocaleDateString();
    
    // 프린트할 HTML 내용
    const printContent = `
        <html>
            <head>
                <title>출고 요청서</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    h2 {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .content {
                        line-height: 1.8;
                    }
                    @media print {
                        @page {
                            size: A4;
                            margin: 2cm;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="content">
                    <h2>출고 요청서</h2>
                    <p>업체명: ${selectedRow.company_name}</p>
                    <p>상품명: ${selectedRow.product_name}</p>
                    <p>제품번호: ${selectedRow.product_number}</p>
                    <p>창고 위치: ${selectedRow.warehouse_location}</p>
                    <p>창고 타입: ${selectedRow.warehouse_type}</p>
                    <p>창고 번호: ${selectedRow.warehouse_num}</p>
                    <p>현재 재고: ${selectedRow.inbound_quantity}</p>
                    <p>출고 상태: ${selectedRow.outbound_status}</p>
                    <p>계약일: ${new Date(selectedRow.contract_date).toLocaleDateString()}</p>
                    <p>출력일: ${currentDate}</p>
                </div>
            </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };
  };

  const [activeTab, setActiveTab] = useState('입고완료');
  const statusTabs = ['입고완료', '출고요청'];

  const getFilteredAndSortedData = () => {
    let filtered = [...outboundItems];
    // 탭 필터링 (입고완료 / 출고요청)
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
        <h2 style={styles.sectionTitle}>출고 요청</h2>
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


        {/* 모달 부분은 기존 스타일 유지하면서 내용만 스타일 적용 */}
        {isModalOpen && selectedRow && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalBox}>
              <div style={styles.modalHeader}>
                <span style={styles.modalTitle}>📦 출고 요청서</span>
                <div style={styles.modalTopRight}>
                  <button onClick={handlePrintRequest} style={styles.iconButton}>출력</button>
                  <button onClick={() => setIsModalOpen(false)} style={styles.closeButton}>✕</button>
                </div>
              </div>

              <table style={styles.infoTable}>
                <tbody>
                  <tr><th>업체명</th><td>{selectedRow.company_name}</td></tr>
                  <tr><th>상품명</th><td>{selectedRow.product_name}</td></tr>
                  <tr><th>제품번호</th><td>{selectedRow.product_number}</td></tr>
                  <tr><th>창고 위치</th><td>{selectedRow.warehouse_location}</td></tr>
                  <tr><th>창고 타입</th><td>{selectedRow.warehouse_type}</td></tr>
                  <tr><th>창고 번호</th><td>{selectedRow.warehouse_num}</td></tr>
                  <tr><th>현재 재고</th><td>{selectedRow.inbound_quantity}</td></tr>
                  <tr><th>출고 상태</th><td>{selectedRow.outbound_status}</td></tr>
                  <tr><th>계약일</th><td>{new Date(selectedRow.contract_date).toLocaleDateString()}</td></tr>
                  <tr><th>출력일</th><td>{new Date().toLocaleDateString()}</td></tr>
                </tbody>
              </table>

              <div style={styles.modalBottom}>
                {selectedRow.outbound_status === '출고요청' ? (
                  <button disabled style={{ ...styles.submitButton, backgroundColor: '#ccc', cursor: 'default' }}>
                    출고 요청 완료
                  </button>
                ) : (
                  <button onClick={() => handleRequestSubmit(selectedRow.id)} style={styles.submitButton}>
                    출고 요청
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#5a3aa8",
  },
  modalTopRight: {
    display: "flex",
    gap: "10px",
  },
  iconButton: {
    backgroundColor: "#6f47c5",
    color: "white",
    padding: "6px 12px",
    borderRadius: "8px",
    border: "none",
    fontWeight: "bold",
    cursor: "pointer",
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
    marginTop: "10px",
  },
  modalBottom: {
    marginTop: "20px",
    textAlign: "center",
  },
  submitButton: {
    width: "100%",
    padding: "12px",
    fontSize: "15px",
    fontWeight: "bold",
    borderRadius: "12px",
    backgroundColor: "#5a3aa8",
    color: "white",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "24px",
    width: "480px",
    maxWidth: "90%",
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)"
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

// 🛠️ 테이블에 공통 스타일 적용 (추가 CSS or styled-component가 아니라면 아래 CSS도 <style>로 넣기)
const tableStyle = document.createElement("style");
tableStyle.innerHTML = `
  table th, table td {
    border: 1px solid #ddd;
    padding: 10px;
    font-size: 14px;
  }
  table th {
    background-color: #f2f2f2;
    text-align: left;
    width: 130px;
  }
`;
document.head.appendChild(tableStyle);