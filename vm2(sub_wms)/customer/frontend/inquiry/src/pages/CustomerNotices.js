import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "../components/Notices.css";

const API_BASE_URL = "http://34.47.73.162:5000/api/notices";

function CustomerNotices() {
  const [rowData, setRowData] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [searchText, setSearchText] = useState("");
  const gridRef = useRef(null);

  // 컬럼 정의
  const columnDefs = [
    { headerName: "ID", field: "id", width: 80, sortable: true },
    { headerName: "제목", field: "title", flex: 1, sortable: true, filter: true },
    { headerName: "작성자", field: "author", width: 150, sortable: true, filter: true },
    { headerName: "작성일", field: "date", width: 150, sortable: true, filter: true },
  ];

  // 공지사항 데이터 로드
  useEffect(() => {
    fetchNotices();
  }, [searchText]);

  const fetchNotices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}`, {
        params: { search: searchText },
      });
      setRowData(response.data);
    } catch (error) {
      console.error("Failed to fetch notices:", error);
    }
  };

  // 검색 입력 처리
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // 상세페이지 열기
  const onRowClicked = (event) => {
    setSelectedNotice(event.data);
    setShowDetailPanel(true);
  };

  // 패널 닫기
  const closePanels = () => {
    setShowDetailPanel(false);
    setSelectedNotice(null);
  };

  return (
    <div className="notice-board-container">
      {/* 검색 바 */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="공지사항 검색..."
          value={searchText}
          onChange={handleSearchChange}
        />
        <button onClick={fetchNotices}>검색</button>
      </div>

      {/* AG Grid 테이블 */}
      <div className={`ag-theme-alpine grid-container ${showDetailPanel ? "blur" : ""}`}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          rowSelection="single"
          onRowClicked={onRowClicked}
          domLayout="autoHeight"
        />
      </div>

      {/* 상세 정보 패널 */}
      {showDetailPanel && selectedNotice && (
        <div className="overlay" onClick={closePanels}>
          <div className="details-panel" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closePanels}>
              ✖
            </button>
            <div>
              <h3 style={{ textAlign: "center", marginBottom: "20px" }}>공지사항 상세</h3>
              <p><strong>제목:</strong> {selectedNotice.title}</p>
              <p><strong>내용:</strong> {selectedNotice.content}</p>
              <p><strong>작성자:</strong> {selectedNotice.author}</p>
              <p><strong>작성일:</strong> {selectedNotice.date}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerNotices;
