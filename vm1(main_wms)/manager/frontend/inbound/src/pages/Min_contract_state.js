import React, { useState, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import Min_contract_state_detail from './Min_contract_state_detail';
import { useNavigate } from 'react-router-dom';

function Min_contract_state() {
  const [contracts, setContracts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contractForm, setContractForm] = useState({
    title: '',
    content: '',
    terms: '',
    signature: ''
  });
  
  const [selectedRowData, setSelectedRowData] = useState(null);
  const navigate = useNavigate();

  const gridRef = useRef(null);

  const API_BASE_URL = 'http://34.64.211.3:5001'; // 새로운 IP로 수정

  const [waitingContracts, setWaitingContracts] = useState([]);
  const [approvedContracts, setApprovedContracts] = useState([]);
  const [activeTab, setActiveTab] = useState('waiting');

  const columnDefs = [
    { field: 'id', headerName: '번호', width: 100 },
    { field: 'company_name', headerName: '회사명', width: 150 },
    { field: 'product_name', headerName: '상품명', width: 150 },
    { field: 'contract_date', headerName: '계약일', width: 150, valueFormatter: (params) => params.value || '계약 대기' },
    { field: 'warehouse_location', headerName: '창고위치', width: 150 },
    { field: 'warehouse_type', headerName: '보관창고', width: 150 },
    { field: 'inbound_quantity', headerName: '입고수량', width: 150 }
  ];

  const defaultColDef = {
    resizable: true,
    suppressMovable: true
  };

  // 계약 목록 데이터 패칭
  const fetchData = async () => {
    setLoading(true);
    try {
      const encodedSearch = encodeURIComponent(search);
      console.log("API 요청 시작:", `${API_BASE_URL}/contract-status?query=${encodedSearch}`);
      
      const response = await fetch(`${API_BASE_URL}/contract-status?query=${encodedSearch}`);
      console.log("응답 상태:", response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      let data = await response.json();
      console.log("서버에서 받은 원본 데이터:", data);
      
      // 데이터가 배열인지 확인
      if (!Array.isArray(data)) {
        console.error("서버 응답이 배열 형식이 아님:", data);
        return;
      }
      
      // contract_date가 null이면 "계약 대기"로 변환
      data = data.map(item => ({
        ...item,
        contract_date: item.contract_date ? item.contract_date : '계약 대기'
      }));
      console.log("변환된 데이터:", data);
      
      setContracts(data);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 초기 데이터 로드
    fetchData();

    // 30초마다 데이터 갱신
    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    // 컴포넌트 언마운트 시 인터벌 정리
    return () => clearInterval(interval);
  }, [search]);

  const handleContractUpdate = () => {
    fetchData(); // 데이터 재조회
  };

  // 특정 계약 상세 정보 가져오기
  const fetchContractDetail = async (contractId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/contract-status/${contractId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch contract detail for ID ${contractId}`);
      }
      const data = await response.json();
      setSelectedRow(data);
      setContractForm({          // 계약서 작성용
        title: data.title || '',
        content: data.content || '',
        terms: data.terms || '',
        signature: data.signature || ''
      });
      setSelectedRowData(data);  // 견적 계산기용
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching contract detail:', error);
    }
  };

  const onRowClicked = (event) => {
    console.log("선택된 행:", event.data); // 디버깅용 로그 추가
    setSelectedRow(event.data);
    setIsModalOpen(true); 
  };

  // 계약 취소 버튼 클릭 핸들러
  const handleCancelContract = async () => {
    // 선택된 행 정보 가져오기
    const selectedNodes = gridRef.current.api.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alert("취소할 계약을 선택하세요.");
      return;
    }

    const selectedData = selectedNodes[0].data;
    const contractId = selectedData.id;

    if (!contractId) {
      alert("유효한 계약이 아닙니다.");
      return;
    }

    // 계약 취소 API 호출
    try {
      const response = await fetch(`${API_BASE_URL}/contract-cancel/${contractId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const err = await response.json();
        alert(err.error || "계약 취소 중 오류 발생");
      } else {
        const result = await response.json();
        alert(result.message);
        
        // 그리드 데이터 갱신
        fetchData();
        
        // 모달이 열려있다면 계약일 상태도 업데이트
        if (selectedRow && selectedRow.id === contractId) {
          setSelectedRow({
            ...selectedRow,
            contract_date: '계약 대기'
          });
        }
      }
    } catch (error) {
      console.error("계약 취소 실패:", error);
      alert("계약 취소 중 오류 발생");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h2 style={styles.sectionTitle}>계약 현황</h2>
        
        {/* 🔍 검색 및 기능 버튼 영역 */}
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="검색어를 입력하세요"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.inputField}
          />
          
          <div style={styles.buttonGroup}>
            <button
              onClick={handleCancelContract}
              style={{ ...styles.buttonBase, ...styles.buttonDanger }}
            >
             계약 취소
            </button>
            <button
              onClick={() => navigate('/admin/storage-map')}
              style={{ ...styles.buttonBase, ...styles.buttonPrimary }}
            >
              창고 현황
            </button>
          </div>
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
          <div className="ag-theme-alpine" style={styles.tableContainer}>
            <AgGridReact
              ref={gridRef}
              rowData={contracts.filter(c => c.contract_date === '계약 대기')}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection='single'
              onRowClicked={onRowClicked}
              pagination={true}
              paginationPageSize={10}
            />
          </div>
        )}

        {activeTab === 'approved' && (
          <div className="ag-theme-alpine" style={styles.tableContainer}>
            <AgGridReact
              ref={gridRef}
              rowData={contracts.filter(c => c.contract_date !== '계약 대기')}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection='single'
              onRowClicked={onRowClicked}
              pagination={true}
              paginationPageSize={10}
            />
          </div>
        )}

        {/* Modal 컴포넌트 */}
        {selectedRow && isModalOpen && (
          <Min_contract_state_detail 
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
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    justifyContent: "space-between",
  },
  inputField: {
    flex: "1 1 250px",
    padding: "10px 15px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "14px",
    outline: "none",
    transition: "border 0.2s ease-in-out",
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
  },
  buttonBase: {
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "600",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background 0.2s ease-in-out, transform 0.2s ease",
    boxShadow: "0 2px 4px rgba(145, 142, 142, 0.1)",
  },
  buttonDanger: {
    backgroundColor: "#a5aaa3",
    color: "#fff",
  },
  buttonPrimary: {
    backgroundColor: "#6f47c5",
    color: "#fff",
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
  }
};

export default Min_contract_state;
