import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
//import "../components/Notices.css";

const API_BASE_URL = "http://34.47.73.162:5000/api/notices";

function NoticeBoard() {
  const [rowData, setRowData] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [formData, setFormData] = useState({ title: "", content: "", author: "", date: "" });
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [message, setMessage] = useState(null); // 알림 메시지
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

  // handleInputChange 함수
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // 현재 날짜와 시간 가져오기
  const getCurrentDateTime = () => {
    const now = new Date();
    return now.toISOString().slice(0, 19).replace("T", " ");
  };

  // 알림 메시지 표시
  const showMessage = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000); // 3초 후 메시지 자동 제거
  };

  // 공지사항 저장
  const handleSave = async () => {
    try {
      const updatedFormData = { ...formData, date: getCurrentDateTime() };
      if (showNewPage) {
        await axios.post(`${API_BASE_URL}`, updatedFormData);
        showMessage("공지사항 작성이 정상적으로 완료되었습니다.", "success");
      } else if (selectedNotice) {
        await axios.put(`${API_BASE_URL}/${selectedNotice.id}`, updatedFormData);
        showMessage("공지사항 수정이 정상적으로 완료되었습니다.", "success");
      }
      fetchNotices();
      closePanels();
    } catch (error) {
      console.error("Failed to save notice:", error);
      showMessage("작업에 실패했습니다. 잠시 후 다시 시도해주세요.", "error");
    }
  };

  // 공지사항 삭제
  const handleDelete = async () => {
    try {
      if (selectedNotice) {
        await axios.delete(`${API_BASE_URL}/${selectedNotice.id}`);
        showMessage("공지사항이 성공적으로 삭제되었습니다.", "success");
        fetchNotices();
        closePanels();
      }
    } catch (error) {
      console.error("Failed to delete notice:", error);
      showMessage("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.", "error");
    }
  };

  // 상세페이지 열기
  const onRowClicked = (event) => {
    setSelectedNotice(event.data);
    setFormData(event.data);
    setShowDetailPanel(true);
    setShowNewPage(false);
  };

  // 새로운 글쓰기 페이지 열기
  const openNewPage = () => {
    setFormData({ title: "", content: "", author: "", date: "" });
    setShowNewPage(true);
    setShowDetailPanel(false);
  };

  // 패널 닫기
  const closePanels = () => {
    setShowDetailPanel(false);
    setShowNewPage(false);
    setSelectedNotice(null);
    setFormData({ title: "", content: "", author: "", date: "" });
  };

  return (
    <div style={{

      width:"95%",
      height:"80%",
      padding:"10px",
      marginLeft:"20px",
      marginTop:"30px", 
      display:"flex",
      borderRadius:"10px",
      backgroundColor:"#FFFFFF",
      flexDirection:"column",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", // 쉐도우 추가
    background: "linear-gradient(135deg, #ffffff, #ffffff)", // 배경 그라데이션
    }}>
      <h3 style={{marginLeft:"5px"}}>공지사항</h3>
      <div style={{border:"1px solid #6f47c5",
        width:"97%",
        marginBottom:"15px",
        marginLeft:"5px"
        }}></div>
    <div style={{
      width:"100%",
      height:"100%",
      backgroundColor:"#ffffff",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", // 쉐도우 추가
    background: "linear-gradient(135deg, #ffffff, #ffffff)", // 배경 그라데이션
      }}>
      {/* 알림 메시지 */}
      {message && (
        <div className={`alert ${message.type}`}>
          {message.text}
        </div>
      )}
      <div style={{width:"100%",
         display:"flex",
         justifyContent:"center",
         alignItems:"center",
         }}>
      {/* 검색 바 */}
        <input
        style={{width:"80%",padding:"8px 12px", fontSize:"13px",borderRadius:"5px",border: "1px solid #ccc",}}
          type="text"
          placeholder="공지사항 검색..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        {/* 검색 버튼 */}
<button
  onClick={fetchNotices}
  style={{
    padding: "8px 15px",
    marginLeft:"10px",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
    transition: "background-color 0.3s ease, transform 0.2s ease",
  }}
  
>
  검색
</button>

      
    
      {/* 글쓰기 버튼 */}
<button
  onClick={openNewPage}
  style={{
    padding: "8px 15px",
    backgroundColor: "#007bff",
    marginLeft:"10px",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
    transition: "background-color 0.3s ease, transform 0.2s ease",
  }}
 
>
  글쓰기
</button>

      </div>
     {/* AG Grid 테이블 */}
{/* AG Grid 테이블 */}
<div
  className="ag-theme-alpine grid-container"
  style={{
    height: "400px", // 고정된 높이 설정
    width: "100%", // 테이블 너비는 컨테이너에 맞춤
    overflow: "hidden", // 높이를 넘지 않도록 설정
  }}
>
  <AgGridReact
    ref={gridRef}
    rowData={rowData}
    columnDefs={columnDefs}
    rowSelection="single"
    onRowClicked={onRowClicked}
    pagination={true} // 페이지 넘김 활성화
    paginationPageSize={10} // 한 페이지에 표시할 데이터 개수
    domLayout="normal" // 테이블 레이아웃 고정
    suppressPaginationPanel={false} // 페이지 번호 네비게이션 표시
  />
</div>


      </div>


 
     {/* 상세 정보 패널 */}
{(showDetailPanel || showNewPage) && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0, 0, 0, 0.5)", // 배경을 어둡게 설정
      zIndex: 1000, // 다른 요소 위에 위치
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
    onClick={closePanels}
  >
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "10px",
        padding: "20px",
        width: "50%",
        maxHeight: "80%",
        overflowY: "auto",
        position: "relative",
        zIndex: 1000, // 패널이 가장 위에 위치
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "none",
          border: "none",
          fontSize: "18px",
          cursor: "pointer",
          color: "#888",
        }}
        onClick={closePanels}
      >
        ✖
      </button>
      {showNewPage ? (
        <div>
          <h3 style={{ textAlign: "center", marginBottom: "20px" }}>새로운 글쓰기</h3>
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>제목</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="제목"
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "5px",
              border: "1px solid #ddd",
            }}
          />
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>내용</label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleInputChange}
            placeholder="내용을 입력하세요"
            style={{
              width: "100%",
              height: "100px",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ddd",
              marginBottom: "15px",
            }}
          />
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>작성자</label>
          <input
            type="text"
            name="author"
            value={formData.author}
            onChange={handleInputChange}
            placeholder="작성자"
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "5px",
              border: "1px solid #ddd",
            }}
          />
          <button
            onClick={handleSave}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginRight: "10px",
            }}
          >
            저장
          </button>
        </div>
      ) : (
        <div>
          <h3 style={{ textAlign: "center", marginBottom: "20px" }}>공지사항 상세</h3>
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>제목</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="제목"
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "5px",
              border: "1px solid #ddd",
            }}
          />
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>내용</label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleInputChange}
            placeholder="내용을 입력하세요"
            style={{
              width: "100%",
              height: "100px",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ddd",
              marginBottom: "15px",
            }}
          />
          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>작성자</label>
          <input
            type="text"
            name="author"
            value={formData.author}
            onChange={handleInputChange}
            placeholder="작성자"
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "5px",
              border: "1px solid #ddd",
            }}
          />
          <p>
            <strong>작성일:</strong> {formData.date}
          </p>
          <button
            onClick={handleSave}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginRight: "10px", 
            }}
          >
            저장
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: "10px 20px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  </div>
)}

    </div>
  );
}

export default NoticeBoard;
