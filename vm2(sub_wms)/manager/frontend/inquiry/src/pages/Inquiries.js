import React, { useState, useEffect, useRef } from "react";
import inquiryServer from "../utils/inquiryServer"; // Axios 설정 파일에서 가져오기
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import CommentsPage from "./CommentSection"; // 댓글 페이지 import

function Inquiries() {
  const [rowData, setRowData] = useState([]);
  const [formData, setFormData] = useState({
    author_email: "",
    title: "",
    content: "",
    date: "",
  });
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showWritePanel, setShowWritePanel] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [showCommentPage, setShowCommentPage] = useState(false);
  const gridRef = useRef(null);

  const columnDefs = [
    { headerName: "ID", field: "id", width: 80, sortable: true },
    { headerName: "이름", field: "author_email", flex: 1, sortable: true, filter: true },
    { headerName: "제목", field: "title", flex: 1, sortable: true, filter: true },
    { headerName: "작성일", field: "date", width: 150, sortable: true, filter: true },
  ];

  useEffect(() => {
    if (inquiryId) {
      fetchComments(inquiryId);
    }
  }, [inquiryId]);

  const fetchInquiries = async () => {
    try {
      const data = await inquiryServer.getInquiries(searchText);
      setRowData(data.inquiries || []);
    } catch (error) {
      console.error("Failed to fetch inquiries:", error);
      alert("문의사항 조회에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const saveInquiry = async () => {
    try {
      if (showWritePanel) {
        // 새 글쓰기 모드일 때만 추가
        await inquiryServer.createInquiry(formData);
        alert("문의사항이 추가되었습니다.");
      } else if (selectedInquiry) {
        // 수정
        await inquiryServer.updateInquiry(selectedInquiry.id, formData);
        alert("문의사항이 수정되었습니다.");
      }
      fetchInquiries();
      closePanels();
    } catch (error) {
      console.error("Failed to save inquiry:", error);
      alert("문의사항 저장에 실패했습니다.");
    }
  };

  const openWritePanel = () => {
    setFormData({ title: "", content: "", author_email: "", date: "" });
    setSelectedInquiry(null); // 추가
    setShowWritePanel(true);
    setShowDetailPanel(false);
  };

  const deleteInquiry = async () => {
    try {
      if (selectedInquiry) {
        await inquiryServer.deleteInquiry(selectedInquiry.id);
        alert("문의사항이 삭제되었습니다.");
        fetchInquiries();
        closePanels();
      }
    } catch (error) {
      console.error("Failed to delete inquiry:", error);
      alert("문의사항 삭제에 실패했습니다.");
    }
  };

  const onRowClicked = (event) => {
    setSelectedInquiry(event.data);
    setFormData(event.data);
    setShowDetailPanel(true);
    setShowWritePanel(false);
  };

  const openCommentPage = (inquiry) => {
    setSelectedInquiry(inquiry);
    setShowCommentPage(true);
  };

  const closePanels = () => {
    setShowDetailPanel(false);
    setShowWritePanel(false);
    setShowCommentPage(false);
    setFormData({ author_email: "", title: "", content: "", date: "" });
  };

  if (showCommentPage) {
    return <CommentsPage inquiryId={selectedInquiry.id} onBack={closePanels} />;
  }

  return (
    <div
      style={{
        width: "95%",
        margin: "20px auto",
        padding: "10px",
        borderRadius: "10px",
        backgroundColor: "#FFFFFF",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <input
          style={{
            width: "80%",
            padding: "10px",
            fontSize: "14px",
            borderRadius: "5px",
            border: "1px solid #ccc",
          }}
          type="text"
          placeholder="문의사항 검색..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <button
          style={{
            padding: "8px 15px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
          onClick={fetchInquiries}
        >
          검색
        </button>

        <button
          style={{
            padding: "8px 15px",
            backgroundColor: "#ffc107",
            color: "white",
            border: "none",
            borderRadius: "6px",
            marginLeft: "10px",
          }}
          onClick={() => {
            setShowWritePanel(true);
            setShowDetailPanel(false);
            setFormData({ author_email: "", title: "", content: "", date: "" });
          }}
        >
          문의 작성
        </button>
      </div>



      <div
        className="ag-theme-alpine"
        style={{
          height: "400px",
          width: "100%",
          overflow: "hidden",
        }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          rowSelection="single"
          domLayout="autoHeight"
          onRowClicked={onRowClicked}
        />
      </div>

      {showDetailPanel && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
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
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>문의사항 상세</h3>
            <label>작성자</label>
            <input
              type="text"
              name="author_email"
              value={formData.author_email}
              onChange={handleInputChange}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "15px",
                borderRadius: "5px",
                border: "1px solid #ddd",
              }}
            />
            <label>제목</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "15px",
                borderRadius: "5px",
                border: "1px solid #ddd",
              }}
            />
            <label>내용</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "5px",
                border: "1px solid #ddd",
                marginBottom: "15px",
              }}
            ></textarea>
            <button
              style={{
                padding: "8px 15px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "6px",
                marginRight: "10px",
              }}
              onClick={saveInquiry}
            >
              수정
            </button>
            <button
              style={{
                padding: "8px 15px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "6px",
                marginRight: "10px",
              }}
              onClick={deleteInquiry}
            >
              삭제
            </button>
            <button
              style={{
                padding: "8px 15px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
              }}
              onClick={() => openCommentPage(selectedInquiry)}
            >
              댓글 관리
            </button>
          </div>
        </div>
      )}

{showWritePanel && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 1000,
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
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h3>문의사항 작성</h3>
      <label>작성자</label>
      <input
        type="text"
        name="author_email"
        value={formData.author_email}
        onChange={handleInputChange}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "15px",
          borderRadius: "5px",
          border: "1px solid #ddd",
        }}
      />
      <label>제목</label>
      <input
        type="text"
        name="title"
        value={formData.title}
        onChange={handleInputChange}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "15px",
          borderRadius: "5px",
          border: "1px solid #ddd",
        }}
      />
      <label>내용</label>
      <textarea
        name="content"
        value={formData.content}
        onChange={handleInputChange}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "5px",
          border: "1px solid #ddd",
          marginBottom: "15px",
        }}
      ></textarea>
      <button
        style={{
          padding: "8px 15px",
          backgroundColor: "#28a745",
          color: "white",
          border: "none",
          borderRadius: "6px",
          marginRight: "10px",
        }}
        onClick={saveInquiry}
      >
        등록
      </button>
    </div>
  </div>
)}
    </div>
  );
}

export default Inquiries;
