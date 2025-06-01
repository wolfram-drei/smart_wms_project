import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "../components/BarcodeCapturePage.css";

const API_BASE_URL = "http://34.64.211.3:5030"; // Flask 서버 주소

const BarcodeCapturePage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [barcodes, setBarcodes] = useState([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resultImage, setResultImage] = useState("");


  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("카메라로 사진을 찍은 뒤 업로드하세요.");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      setUploading(true);

      const response = await axios.post(`${API_BASE_URL}/barcode-upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Upload response:", response.data);

      if (response.data.result_image) {
        setResultImage(response.data.result_image);
      }

      if (response.status === 200) {
        if (response.data.barcodes && response.data.barcodes.length > 0) {
          alert(response.data.message || "업로드 성공");
          console.log("Barcodes received:", response.data.barcodes);
          console.log("Result image:", response.data.result_image);

          // 중복된 barcode_num은 추가 X
          setBarcodes((prevBarcodes) => {
            const newBarcodes = response.data.barcodes.filter(
              (newBarcode) =>
                !prevBarcodes.some(
                  (existingBarcode) => existingBarcode.barcode_num === newBarcode.barcode_num
                )
            );
            return [...prevBarcodes, ...newBarcodes];
          });
        } else if (response.data.message) {
          alert(response.data.message);
        } else {
          alert("업로드 성공(바코드 없음)");
        }
      } else {
        alert("서버 응답 오류");
      }
    } catch (error) {
      console.error("업로드 실패:", error);
      alert("업로드 도중 에러가 발생했습니다.");
    } finally {
      setUploading(false);
      //setSelectedFile(null); -> 업로드 중 오류나면 미리보기 이미지
    }
  };

  const openDetailModal = (data) => {
    setSelectedRowData(data);
    setIsDetailOpen(true);
  };

  const closeDetailModal = () => {
    setSelectedRowData(null);
    setIsDetailOpen(false);
  };

  const handleInboundComplete = async (barcodeNum) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/update-inbound-status`, {
        barcode_num: barcodeNum,
        inbound_status: "입고 완료",
      });
      if (response.status === 200) {
        alert("입고가 완료되었습니다.");
        // 목록에서 제거
        setBarcodes((prevBarcodes) =>
          prevBarcodes.filter((barcode) => barcode.barcode_num !== barcodeNum)
        );
        closeDetailModal();
      }
    } catch (error) {
      alert("입고 상태 업데이트 중 오류 발생");
      console.error(error);
    }
  };

  /**
   * (옵션) 서버에서 이미 노란/파란 박스를 그린 상태지만,
   * 프론트에서 canvas로 추가 표시를 원하면 아래 로직 사용.
   */

  return (
    <div className="barcode-capture-container">
      <h2 className="barcode-capture-title">스마트폰 카메라 촬영 & 바코드 자동 업로드</h2>

      <div className="barcode-capture-input-group">
        <label htmlFor="cameraInput" className="barcode-capture-label">
          사진 찍기
        </label>
        <input
          type="file"
          accept="image/*"
          capture="camera"
          id="cameraInput"
          onChange={handleFileChange}
          className="barcode-capture-file-input"
        />
      </div>

      <button
        className="barcode-capture-upload-button"
        onClick={handleUpload}
        disabled={uploading}
      >
        {uploading ? "업로드 중..." : "업로드"}
      </button>

      {selectedFile && !resultImage && (
        <div className="result-image-container">
          <h3>미리보기</h3>
          <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
            <img
              src={URL.createObjectURL(selectedFile)}
              alt="업로드 미리보기"
              style={{
                width: "100%",
                maxHeight: "calc(100vh - 150px)",
                objectFit: "contain",
                border: "1px solid #ddd",
                borderRadius: "8px",
              }}
            />
          </div>
        </div>
      )}

      {resultImage && (
        <div className="result-image-container" style={{ marginTop: "20px" }}>
          <h3>결과 이미지 (서버에서 노란/파란 박스가 그려진 상태)</h3>
          <div
            style={{
              position: "relative",
              display: "inline-block",
              maxWidth: "100%",
              textAlign: "center",
            }}
          >
            <img
              src={`${API_BASE_URL}/uploads/${resultImage}`}
              alt="결과 이미지"
              style={{
                width: "100%",
                maxHeight: "calc(100vh - 150px)",
                objectFit: "contain",
                border: "1px solid #ddd",
                borderRadius: "8px",
              }}
              onLoad={() => console.log("결과 이미지 로드 성공")}
              onError={(e) => console.error("결과 이미지 로드 실패:", e)}
            />

          </div>
        </div>
      )}

      {barcodes.length > 0 ? (
        <div className="barcode-details-container">
          <h3>인식된 바코드 목록</h3>
          <p>상세정보를 확인하려면 아래 버튼을 클릭하세요.</p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              justifyContent: "center",
              marginTop: "20px",
            }}
          >
            {barcodes.map((barcodeData, index) => (
              <button
                key={
                  barcodeData.id
                    ? `barcode-${barcodeData.id}`
                    : `barcode-${barcodeData.barcode_num}-${index}`
                }
                onClick={() => openDetailModal(barcodeData)}
                style={{
                  padding: "10px 15px",
                  background: "#17a2b8",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                {barcodeData.barcode_num || `바코드 ${index + 1}`}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginTop: "30px", color: "#555" }}>
          인식된 바코드가 없습니다.
        </div>
      )}

      {isDetailOpen && selectedRowData && (
        <InboundDetail
          selectedRowData={selectedRowData}
          onClose={closeDetailModal}
          onInboundComplete={handleInboundComplete}
        />
      )}
    </div>
  );
};

const InboundDetail = ({ selectedRowData, onClose, onInboundComplete }) => {
  const handleInboundComplete = () => {
    if (selectedRowData.barcode_num) {
      onInboundComplete(selectedRowData.barcode_num);
    } else {
      alert("해당 바코드 번호가 없습니다.");
    }
  };

  const fieldStyle = {
    padding: "10px",
    background: "#f9f9f9",
    borderRadius: "5px",
    border: "1px solid #ddd",
  };

  const DetailField = ({ label, value }) => (
    <div className="detail-field">
      <strong>{label}:</strong>
      <div style={fieldStyle}>{value || "N/A"}</div>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">상세보기</h3>
        <div className="modal-body">
          <DetailField label="업체명" value={selectedRowData.company_name} />
          <DetailField label="상품명" value={selectedRowData.product_name} />
          <DetailField label="제품 번호" value={selectedRowData.product_number} />
          <DetailField label="입고 수량" value={selectedRowData.inbound_quantity} />
          <DetailField label="창고 타입" value={selectedRowData.warehouse_type} />
          <DetailField label="창고 위치" value={selectedRowData.warehouse_location} />
          <DetailField label="팔레트 사이즈" value={selectedRowData.pallet_size} />
          <DetailField label="팔레트 수량" value={selectedRowData.pallet_num} />
          <DetailField label="바코드 넘버" value={selectedRowData.barcode_num} />

          <div>
            <strong>바코드 이미지:</strong>
            {selectedRowData.barcode_image ? (
              <img
                src={`${process.env.REACT_APP_API_BASE_URL}/uploads/${selectedRowData.barcode_image}`}
                alt="바코드"
                className="barcode-image"
              />
            ) : (
              <div style={fieldStyle}>N/A</div>
            )}
          </div>

          <DetailField
            label="정확도"
            value={
              selectedRowData.confidence
                ? `${(selectedRowData.confidence * 100).toFixed(2)}%`
                : "N/A"
            }
          />

          <DetailField
            label="바운딩 박스"
            value={
              selectedRowData.bounding_box
                ? `[${selectedRowData.bounding_box.join(", ")}]`
                : "N/A"
            }
          />
        </div>

        <div className="modal-footer">
          <button className="btn-complete" onClick={handleInboundComplete}>
            입고완료
          </button>
          <button className="btn-close" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeCapturePage;
