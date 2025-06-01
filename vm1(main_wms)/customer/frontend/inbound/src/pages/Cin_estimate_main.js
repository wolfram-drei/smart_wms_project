import React, { useState, useEffect, useRef } from "react";
import { axios5010 } from '../api/axios';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import Cin_contract_state from './Cin_contract_detail';

const API_BASE_URL = "http://34.64.211.3:5011";
const API_DASHBOARD_BASE_URL = "http://34.64.211.3:5010";

// 견적서 작성 폼
const CustomerEstimateForm = () => {
  const [formData, setFormData] = useState({
    product_name: "",
    category: "",
    width_size: "",
    length_size: "",
    height_size: "",
    weight: "",
    inbound_quantity: "",
    warehouse_type: "상온",
    subscription_inbound_date: "",
    outbound_date: "",
  });

  const [quoteResult, setQuoteResult] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [gridReady, setGridReady] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [sortType, setSortType] = useState("latest"); // 기본은 최근순  

  const handleItemClick = (item) => {
    setFormData({
      product_name: item.product_name,
      category: item.category,
      width_size: item.width_size,
      length_size: item.length_size,
      height_size: item.height_size,
      weight: item.weight,
      inbound_quantity: item.inbound_quantity,
      warehouse_type: item.warehouse_type,
      subscription_inbound_date: item.subscription_inbound_date,
      outbound_date: item.outbound_date,
    });
    setSelectedContract(item);
    setIsModalOpen(true);
  };

  const EstimateInfo = {
    product_name: "상품명",
    category: "카테고리",
    width_size: "가로(mm)",
    length_size: "세로(mm)",
    height_size: "높이(mm)",
    weight: "무게(kg)",
    inbound_quantity: "입고 수량",
    warehouse_type: "보관 상태",
    subscription_inbound_date: "입고 신청일",
    outbound_date: "출고 예정일",
    inbound_size: "크기 분류",
    pallet_count: "팔레트 개수",
    total_weight: "총 무게(kg)",
    storage_duration: "보관 기간(일)",
    total_cost: "총 비용(원)",
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleQuoteCalculated = (result) => {
    setQuoteResult(result);
  };

  const handleRowSelection = (event) => {
    const selectedRow = event.api.getSelectedRows()[0];  // 선택된 첫 번째 행 가져오기
    if (selectedRow) {
      setFormData({
        product_name: selectedRow.product_name,
        category: selectedRow.category,
        width_size: selectedRow.width_size,
        length_size: selectedRow.length_size,
        height_size: selectedRow.height_size,
        weight: selectedRow.weight,
        inbound_quantity: selectedRow.inbound_quantity,
        warehouse_type: selectedRow.warehouse_type,
        subscription_inbound_date: selectedRow.subscription_inbound_date,
        outbound_date: selectedRow.outbound_date,
      });
    }
  };

  const fetchTableData = async () => {
    try {
      const timestamp = new Date().getTime(); // 현재 시각을 쿼리에 추가
      const response = await axios5010.get(`${API_DASHBOARD_BASE_URL}/dashboard/storage-items?ts=${timestamp}`, {
        withCredentials: true  // 쿠키 포함 요청
      });
      setTableData(response.data.all_items || []);
    } catch (error) {
      console.error("데이터 불러오기 중 오류:", error);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, []);

  const handleGridReady = (params) => {
    setGridReady(true);
  };

  useEffect(() => {
    if (gridReady && gridRef.current && gridRef.current.api && gridRef.current.columnApi) {
      setTimeout(() => {
        const allColumnIds = gridRef.current.columnApi.getAllColumns().map(col => col.getColId());
        gridRef.current.columnApi.autoSizeColumns(allColumnIds, false);
      }, 0);
    }
  }, [gridReady, tableData]);


  const handleSave = async () => {
    try {
      const processedData = {
        ...formData,
        width_size: Number(formData.width_size),
        length_size: Number(formData.length_size),
        height_size: Number(formData.height_size),
        weight: Number(formData.weight),
        inbound_quantity: Number(formData.inbound_quantity),
        subscription_inbound_date: formData.subscription_inbound_date
          ? new Date(formData.subscription_inbound_date).toISOString().split("T")[0]
          : null,
        outbound_date: formData.outbound_date
          ? new Date(formData.outbound_date).toISOString().split("T")[0]
          : null,
        warehouse_type: formData.warehouse_type || "상온",
         // 견적 계산 결과가 있다면 포함
        inbound_size: quoteResult?.inbound_size || null,
        pallet_count: quoteResult?.pallet_count || null,
        total_weight: quoteResult?.total_weight || null,
        storage_duration: quoteResult?.storage_duration || null,
        total_cost: quoteResult?.total_cost || null
      };
  
      const res = await axios5010.post(
        `${API_BASE_URL}/add_inbound_estimate`,
        processedData,
        { withCredentials: true }  // ✅ 쿠키 포함 (accessToken)
      );
      alert("데이터가 성공적으로 저장되었습니다.");
      setFormData({
        product_name: "",
        category: "",
        width_size: "",
        length_size: "",
        height_size: "",
        weight: "",
        inbound_quantity: "",
        warehouse_type: "상온",
        subscription_inbound_date: "",
        outbound_date: "",
      });
      setQuoteResult(null);
      await fetchTableData(); // ✅ 테이블 데이터 새로고침
    } catch (error) {
      console.error("데이터 저장 중 오류:", error);
      alert("데이터 저장에 실패했습니다.");
    }
  };

  const columnDefs = [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      width: 50,
    },
    { headerName: "상품명", field: "product_name", sortable: true, filter: true, resizable: true },
    { headerName: "카테고리", field: "category", sortable: true, filter: true, resizable: true },
    { headerName: "가로(mm)", field: "width_size", sortable: true, filter: true, resizable: true },
    { headerName: "세로(mm)", field: "length_size", sortable: true, filter: true, resizable: true },
    { headerName: "높이(mm)", field: "height_size", sortable: true, filter: true, resizable: true },
    { headerName: "무게(kg)", field: "weight", sortable: true, filter: true, resizable: true },
    { headerName: "수량", field: "inbound_quantity", sortable: true, filter: true, resizable: true },
    { headerName: "보관", field: "warehouse_type", sortable: true, filter: true, resizable: true },
    { headerName: "입고", field: "subscription_inbound_date", sortable: true, filter: true, resizable: true },
    { headerName: "출고", field: "outbound_date", sortable: true, filter: true, resizable: true },
  ];

  const getFilteredAndSortedData = () => {
    let filteredData = [...tableData];
  
    // 🔍 검색 적용
    if (searchText.trim() !== "") {
      const lowerSearch = searchText.toLowerCase();
      filteredData = filteredData.filter(item =>
        (item.product_name?.toLowerCase().includes(lowerSearch) ||
         item.category?.toLowerCase().includes(lowerSearch))
      );
    }
  
    // 🧹 정렬 적용
    if (sortType === "latest") {
      filteredData.sort((a, b) => new Date(a.id) - new Date(b.id));
    } else if (sortType === "oldest") {
      filteredData.sort((a, b) => new Date(b.id) - new Date(a.id));
    } else if (sortType === "name") {
      filteredData.sort((a, b) => a.product_name.localeCompare(b.product_name));
    }
  
    return filteredData;
  };


  const gridRef = useRef();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentItems = getFilteredAndSortedData().slice(startIdx, endIdx);
  const totalPages = Math.ceil(getFilteredAndSortedData().length / itemsPerPage);


  return (
    <div style={styles.container}>
      <div style={styles.contentRow}>
        <div style={styles.contentColumnSmall}>
          <h2 style={styles.sectionTitle}>견적서 작성</h2>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {Object.keys(formData).map((key) => (
              <div key={key} style={{ flex: "1 1 300px" }}>
                {key === "subscription_inbound_date" || key === "outbound_date" ? (
                <input
                  name={key}
                  value={formData[key] || ""}
                  onChange={handleChange}
                  style={styles.inputField}
                  type="date"
                />
              ) : key === "inbound_size" ? (
                <select
                  name={key}
                  value={formData[key] || ""}
                  onChange={handleChange}
                  style={styles.inputField}
                >
                  <option value="">선택하세요</option>
                  <option value="소">소</option>
                  <option value="중">중</option>
                  <option value="대">대</option>
                </select>
              ) : (
                <input
                  name={key}
                  value={formData[key] || ""}
                  onChange={handleChange}
                  placeholder={EstimateInfo[key] || key}
                  style={styles.inputField}
                  type="text"
                />
              )}
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            style={styles.buttonPrimary}
            onMouseEnter={(e) => (e.target.style.background = styles.buttonPrimaryHover.background)}
            onMouseLeave={(e) => (e.target.style.background = styles.buttonPrimary.background)}
          >
            견적서 보내기
          </button>
        </div>

        <div style={styles.contentColumnLarge}>
          <h2 style={styles.sectionTitle}>최근 견적 데이터</h2>

          {/* 🔽 정렬/필터 옵션 영역 */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="상품명, 카테고리 검색"
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
          {/* 테이블 영역 */}
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {columnDefs.map((col, idx) => (
                    <th key={idx} style={styles.th}>{col.headerName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
              {currentItems.map((item, index) => (
                <tr key={index} style={styles.row} onClick={() => handleItemClick(item)}>
                  {columnDefs.map((col, colIdx) => (
                    <td key={colIdx} style={styles.td}>
                      {typeof item[col.field] === 'object' && item[col.field] !== null
                        ? JSON.stringify(item[col.field])
                        : item[col.field]}
                    </td>
                  ))}
                </tr>
              ))}
              </tbody>
            </table>
          </div>
            
          {selectedContract && (
          <Cin_contract_state
            contract={selectedContract}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onContractUpdate={fetchTableData}  // 필요 시 갱신
          />
          )}
          <div style={styles.pagination}>
            <button
              style={styles.pageButton}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              ◀
            </button>
            <span>페이지 {currentPage} / {totalPages}</span>
            <button
              style={styles.pageButton}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerEstimateForm;

const styles = {
  container: {
    padding: "20px",
  },
  contentRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
  },
  contentColumnSmall: {
    flex: "2",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  contentColumnLarge: {
    flex: "8",
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
  inputField: {
    width: "90%",
    padding: "8px",
    marginBottom: "10px",
    borderRadius: "5px",
    border: "1px solid #ddd",
  },
  buttonPrimary: {
    padding: "10px 20px",
    width: "100%",
    background: "#6f47c5", // sectionTitle 색상과 맞춤
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: '30px',
    transition: "background 0.3s ease",
  },
  buttonPrimaryHover: {
    background: "#5a3aa8", // hover 시 더 어두운 색상
  },
  tableContainer: {
    height: "430px",
    marginTop: "20px",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    overflowX: "hidden",
    overflowY: "hidden",
  },
  table: {
    height: "",
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "10px",
  },
  th: {
    backgroundColor: "#f2ecff",
    color: "#6f47c5",
    padding: "10px",
    borderBottom: "2px solid #d3c2ff",
    fontSize: "14px",
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #eee",
    fontSize: "13px",
    textAlign: "center",
  },
  row: {
    cursor: "pointer",
    backgroundColor: "#fff",
    transition: "background 0.2s",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
    marginBottom: "5px",
  },
  pageButton: {
    all: "unset",    
    padding: "6px 12px",
    background: "none",                 // 배경 없음
    color: "#6f47c5",                   // 글자색 보라
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
    transition: "all 0.2s ease-in-out",
  },
  filterSortContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
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
    transition: "border-color 0.3s ease",
    marginRight: "10px",
  },
  sortSelect: {
    padding: "5px",
    borderRadius: "8px",
    border: "1px solid #c5b3f1",
    color: "#4a2e91",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background 0.3s ease",
  },
};

