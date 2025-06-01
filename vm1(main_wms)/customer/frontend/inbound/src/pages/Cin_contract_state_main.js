import React, { useState, useEffect } from 'react';
import { axios5010 } from '../api/axios';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import Cin_contract_state from './Cin_contract_detail';

function CustomerContract() {
  const [contracts, setContracts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = "http://34.64.211.3:5012";
  const API_DASHBOARD_BASE_URL = "http://34.64.211.3:5010";

  const [waitingContracts, setWaitingContracts] = useState([]);
  const [approvedContracts, setApprovedContracts] = useState([]);

  const [searchText, setSearchText] = useState("");
  const [sortType, setSortType] = useState("latest");

  // 데이터 가져오기 함수
  const fetchData = async () => {
    setLoading(true);
    try {
      /* const encodedSearch = encodeURIComponent(search); */
      const response = await axios5010.get(`${API_DASHBOARD_BASE_URL}/dashboard/storage-items`);
      const allItems = response.data.all_items || [];

      // 날짜 포맷 먼저
      const processed = allItems.map(item => ({
        ...item,
        contract_date: item.contract_date ? item.contract_date : null // 명확하게 null로 유지
      }));

      // 조건에 따라 분류
      const waiting = processed.filter(item => item.contract_date === null);
      const approved = processed.filter(item => item.contract_date !== null);

      setWaitingContracts(waiting);
      setApprovedContracts(approved);

      console.log("✅ 대기:", waiting);
      console.log("✅ 승인:", approved);
    } catch (error) {
      console.error("Error fetching contracts from 5010:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search]);

  const columnDefs = [
    { field: 'id', headerName: '번호', width: 100 },
    { field: 'company_name', headerName: '회사명', width: 150 },
    { field: 'product_name', headerName: '상품명', width: 150 },
    { field: 'contract_date', headerName: '계약일', width: 150,
      valueFormatter: (params) => {
        return params.value === null || params.value === undefined
        ? '계약 대기'
        : params.value;
          }
     },
    { field: 'warehouse_location', headerName: '창고위치', width: 150 },
    { field: 'warehouse_type', headerName: '보관창고', width: 150 },
    { field: 'inbound_quantity', headerName: '입고수량', width: 150 },
  ];

  const defaultColDef = {
    resizable: true,
    suppressMovable: true
  };

  const onRowClicked = (params) => {
    setSelectedRow(params.data);
    setIsModalOpen(true);
  };

  const handleContractUpdate = async () => {
    await fetchData(); 
    if (selectedRow) {
      try {
        const response = await axios.get(`${API_BASE_URL}/contracts/${selectedRow.id}`);
        setSelectedRow(response.data);
      } catch (error) {
        console.error("Error fetching updated selectedRow:", error);
      }
    }
  };
  const [activeTab, setActiveTab] = useState('waiting');

  const getFilteredAndSortedContracts = (contracts) => {
    let filtered = [...contracts];
  
    if (searchText.trim() !== "") {
      filtered = filtered.filter(item =>
        (item.product_name?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.company_name?.toLowerCase().includes(searchText.toLowerCase()))
      );
    }
  
    if (sortType === "latest") {
      filtered.sort((a, b) => new Date(b.id || 0) - new Date(a.id || 0));
    } else if (sortType === "oldest") {
      filtered.sort((a, b) => new Date(a.id || 0) - new Date(b.id || 0));
    } else if (sortType === "company") {
      filtered.sort((a, b) => a.company_name.localeCompare(b.company_name));
    }
  
    return filtered;
  };

  
  return (
    <div style={styles.container}>
      <div style={styles.content}>
      <h2 style={styles.sectionTitle}>계약 현황</h2>
      <div style={styles.searchFilterContainer}>
        <input
          type="text"
          placeholder="상품명, 회사명 검색"
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
          <option value="company">회사명순</option>
        </select>
      </div>
      {/* 🔼 탭 버튼 영역 */}
      <div style={styles.tabContainer}>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'waiting' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setActiveTab('waiting')}
        >
          계약 대기
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'approved' ? styles.tabButtonActive : {}),
          }}
          onClick={() => setActiveTab('approved')}
        >
          계약 승인
        </button>
      </div>
      {/* 🔽 테이블 영역 */}
      {activeTab === 'waiting' && (
        <div style={styles.halfBox}>
          <div className="ag-theme-alpine" style={styles.tableContainer}>
          <AgGridReact
            rowData={getFilteredAndSortedContracts(waitingContracts)}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onRowClicked={onRowClicked}
            pagination={true}
            paginationPageSize={10}
          />
          </div>
        </div>
      )}
      {activeTab === 'approved' && (
        <div style={styles.halfBox}>
          <div className="ag-theme-alpine" style={styles.tableContainer}>
            <AgGridReact
              rowData={getFilteredAndSortedContracts(approvedContracts)}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onRowClicked={onRowClicked}
              pagination={true}
              paginationPageSize={10}
            />
          </div>
        </div>
      )}
      {/* 공통 모달 */}
      {selectedRow && (
        <Cin_contract_state 
          contract={selectedRow}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onContractUpdate={handleContractUpdate}
        />
      )}
    </div>
  </div>

  );
}

export default CustomerContract;


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
  contentRow: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  searchContainer: {
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  inputField: {
    width: "100%",
    padding: "8px",
    borderRadius: "5px",
    border: "1px solid #ddd",
    fontSize: "14px",
  },
  tableContainer: {
    height: "520px",
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
  buttonPrimary: {
    padding: "10px 20px",
    background: "#6f47c5",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    transition: "background 0.3s ease",
  },
  buttonPrimaryHover: {
    background: "#5a3aa8",
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
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "20px",
    width: "400px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.2)",
    textAlign: "center",
  },
  tabContainer: {
    display: "flex",
    justifyContent: "left",
    marginBottom: "20px",
    gap: "20px",
  },
  tabButton: {
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "bold",
    border: "none",
    borderBottom: "3px solid transparent",
    backgroundColor: "transparent",
    cursor: "pointer",
  },
  tabButtonActive: {
    borderBottom: "3px solid #6f47c5",
    color: "#6f47c5",
  },
  searchFilterContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
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
    marginRight: "5px",
    transition: "border-color 0.3s ease",
  },
  sortSelect: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #c5b3f1",
    color: "#4a2e91",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background 0.3s ease",
  },
  
};