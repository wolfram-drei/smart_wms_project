import React from "react";

const Min_estimate_detailView = ({ selectedRowData, onClose }) => {
  // selectedRowData가 없을 경우 아무것도 렌더링하지 않음



  if (!selectedRowData) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        width:"50%",
        height: '600px',
        transform: "translate(-50%, -50%)",
        background: "white",
        borderRadius: "10px",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
        zIndex: 1000,
        width: "400px",
        overflowY: "hidden", // 스크롤 바 제거
      }}
    >
        <div
          style={{
            overflowY: "scroll", // 내부 스크롤 활성화
            height: "100%", // 스크롤 영역 설정
            msOverflowStyle: "none", // IE와 Edge 스크롤바 숨김
            scrollbarWidth: "none", // Firefox 스크롤바 숨김
          }}
        >
          <h3 style={{ marginBottom: "20px" }}>상세보기</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {/* 상세보기 데이터 표시 */}
            <div>
              <strong>업체명:</strong>
              <div
                style={{
                  padding: "10px",
                  background: "#f9f9f9",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                {selectedRowData.company_name || "N/A"}
              </div>
            </div>
            <div>
              <strong>상품명:</strong>
              <div
                style={{
                  padding: "10px",
                  background: "#f9f9f9",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                {selectedRowData.product_name || "N/A"}
              </div>
            </div>
            <div>
              <strong>제품 번호:</strong>
              <div
                style={{
                  padding: "10px",
                  background: "#f9f9f9",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                {selectedRowData.warehouse_num || "N/A"}
              </div>
            </div>
            <div>
              <strong>입고 수량:</strong>
              <div
                style={{
                  padding: "10px",
                  background: "#f9f9f9",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                {selectedRowData.inbound_quantity || "N/A"}
              </div>
            </div>
            <div>
              <strong>창고 타입:</strong>
              <div
                style={{
                  padding: "10px",
                  background: "#f9f9f9",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                {selectedRowData.warehouse_type || "N/A"}
              </div>
            </div>
            <div>
              <strong>창고 위치:</strong>
              <div
                style={{
                  padding: "10px",
                  background: "#f9f9f9",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                {selectedRowData.warehouse_location || "N/A"}
              </div>
            </div>
            <div>
              <strong>팔레트 사이즈:</strong>
              <div
                style={{
                  padding: "10px",
                  background: "#f9f9f9",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                {selectedRowData.pallet_size || "N/A"}
              </div>
            </div>
            <div>
              <strong>팔레트 수량:</strong>
              <div
                style={{
                  padding: "10px",
                  background: "#f9f9f9",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                {selectedRowData.pallet_num || "N/A"}
              </div>
            </div>
            <div>
              <strong>바코드 넘버:</strong>
              <div
                style={{
                  padding: "10px",
                  background: "#f9f9f9",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                {selectedRowData.barcode_num || "N/A"}
              </div>
            </div>
            <div>
              <strong>바코드:</strong>
              {selectedRowData.barcode ? (
                <img
                  src={`http://34.64.211.3:5002/barcode-images/${selectedRowData.barcode.split('/').pop()}`}
                  alt="바코드"
                  style={{
                    width: "100%",
                    maxHeight: "150px",
                    objectFit: "contain",
                    marginTop: "10px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: "10px",
                    background: "#f9f9f9",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                  }}
                >
                  N/A
                </div>
              )}
        </div>
      </div>

      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        style={{
          marginTop: "20px",
          padding: "10px",
          background: "#ccc",
          color: "black",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          width: "100%",
        }}
      >
        닫기
      </button>
    </div>
    </div>

  );
};

export default Min_estimate_detailView;
