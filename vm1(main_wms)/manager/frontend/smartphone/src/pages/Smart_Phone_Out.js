import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "../components/BarcodeCapturePage.css"; // 디자인 CSS 임포트

const API_BASE_URL = "http://34.64.211.3:5031"; // Flask 서버 주소

const BarcodeCapturePage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [barcodes, setBarcodes] = useState([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [uploading, setUploading] = useState(false); // 업로드 상태 추가
  const [resultImage, setResultImage] = useState(""); // 결과 이미지 상태 추가
  const canvasRef = useRef(null); // Canvas 참조 추가

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Removed previewUrl logic
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
      setUploading(true); // 업로드 시작

      const response = await axios.post(`${API_BASE_URL}/outbound-upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Upload response:", response.data); // 디버깅용 로그

      // Always set resultImage if available, regardless of success or failure
      if (response.data.result_image) {
        setResultImage(response.data.result_image);
      }

      if (response.status === 200) {
        if (response.data.barcodes && response.data.barcodes.length > 0) {
          alert(response.data.message || "업로드 성공");
          console.log("Barcodes received:", response.data.barcodes); // 추가 로그
          console.log("Result image:", response.data.result_image); // 결과 이미지 로그

          setBarcodes((prevBarcodes) => {
            // 중복된 barcode_num을 필터링하여 추가
            const newBarcodes = response.data.barcodes.filter(
              (newBarcode) =>
                !prevBarcodes.some(
                  (existingBarcode) =>
                    existingBarcode.barcode_num === newBarcode.barcode_num
                )
            );
            console.log("New barcodes to add:", newBarcodes); // 추가 로그
            return [...prevBarcodes, ...newBarcodes];
          });
        } else if (response.data.message) {
          // 중복 바코드인 경우 메시지 알림
          alert(response.data.message); // "이미 처리된 바코드 정보입니다."
        } else {
          alert("업로드 성공");
        }
      } else {
        alert("서버 응답 오류");
      }
    } catch (error) {
      console.error("업로드 실패:", error);
      alert("업로드 도중 에러가 발생했습니다.");

      // Attempt to set resultImage from error response if available
      if (error.response && error.response.data && error.response.data.result_image) {
        setResultImage(error.response.data.result_image);
      }
    } finally {
      setUploading(false); // 업로드 완료
      setSelectedFile(null); // Clear the selected file after upload
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

  const handleOutboundComplete = async (barcodeNum) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/complete-outbound`, {
        barcode_num: barcodeNum,
      });
      if (response.status === 200) {
        alert("출고가 완료되었습니다.");
        // 업데이트된 바코드를 목록에서 제거
        setBarcodes((prevBarcodes) =>
          prevBarcodes.filter((barcode) => barcode.barcode_num !== barcodeNum)
        );
        closeDetailModal();
      }
    } catch (error) {
      alert("출고 상태 업데이트 중 오류 발생");
      console.error(error);
    }
  };

  // 바운딩 박스 그리기
  useEffect(() => {
    if (resultImage && Array.isArray(barcodes) && barcodes.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.src = `${API_BASE_URL}/uploads/${resultImage}`;
      img.crossOrigin = "Anonymous"; // CORS 설정 추가

      img.onload = () => {
        // 이미지의 자연 크기
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;

        // 이미지의 표시 크기 (CSS에 의해 변경된 경우)
        const displayedWidth = img.width;
        const displayedHeight = img.height;

        // Canvas 크기 설정
        canvas.width = displayedWidth;
        canvas.height = displayedHeight;

        // Canvas에 이미지 그리기
        ctx.clearRect(0, 0, canvas.width, canvas.height); // 기존 그리기 내용 초기화
        ctx.drawImage(img, 0, 0, displayedWidth, displayedHeight);

        // 스케일 비율 계산
        const scaleX = displayedWidth / naturalWidth;
        const scaleY = displayedHeight / naturalHeight;

        // 바운딩 박스 그리기
        barcodes.forEach((barcode) => {
          if (Array.isArray(barcode.bounding_box) && barcode.bounding_box.length === 4) {
            const [x1, y1, x2, y2] = barcode.bounding_box;
            const confidence = barcode.confidence;

            // 스케일 적용
            const scaledX1 = x1 * scaleX;
            const scaledY1 = y1 * scaleY;
            const scaledX2 = x2 * scaleX;
            const scaledY2 = y2 * scaleY;

            // 출고는 파란색으로 설정
            const strokeColor = "blue";
            const textColor = "blue";

            ctx.lineWidth = 2;
            ctx.strokeStyle = strokeColor;
            ctx.font = "16px Arial";
            ctx.fillStyle = textColor;
            ctx.strokeRect(scaledX1, scaledY1, scaledX2 - scaledX1, scaledY2 - scaledY1);
            if (confidence !== null && confidence !== undefined) {
              ctx.fillText(`Conf: ${(confidence * 100).toFixed(2)}%`, scaledX1, scaledY1 - 10);
            }
          } else {
            console.warn("Invalid bounding_box format for barcode:", barcode);
          }
        });
      };

      img.onerror = (err) => {
        console.error("이미지 로드 오류:", err);
      };
    }
  }, [resultImage, barcodes]);

  return (
    <div className="barcode-capture-container">
      <h2 className="barcode-capture-title">스마트폰 카메라 촬영 & 바코드 자동 업로드 (출고)</h2>

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

      {/* 업로드 버튼 */}
      <button
        className="barcode-capture-upload-button"
        onClick={handleUpload}
        disabled={uploading} // 업로드 중 버튼 비활성화
      >
        {uploading ? "업로드 중..." : "업로드"}
      </button>

      {/* 선택된 파일 미리보기 */}
      {selectedFile && !resultImage && (
        <div className="result-image-container">
          <h3>미리보기</h3>
          <div 
            style={{ 
              position: "relative", 
              display: "inline-block", 
              maxWidth: "100%", 
              overflow: "hidden", 
              textAlign: "center" 
            }}
          >
            <img
              src={URL.createObjectURL(selectedFile)} // 사용자가 선택한 파일을 미리보기
              alt="업로드 미리보기"
              style={{ 
                width: "100%", 
                maxHeight: "calc(100vh - 150px)", 
                objectFit: "contain", 
                border: "1px solid #ddd",
                borderRadius: "8px"
              }}
            />
          </div>
        </div>
      )}

      {/* 결과 이미지 및 바운딩 박스 */}
      {resultImage && (
        <div className="result-image-container">
          <h3>결과 이미지</h3>
          <div 
            style={{ 
              position: "relative", 
              display: "inline-block", 
              maxWidth: "100%", 
              overflow: "hidden", 
              textAlign: "center" 
            }}
          >
            <img
              src={`${API_BASE_URL}/uploads/${resultImage}`} // 결과 이미지 표시
              alt="결과 이미지"
              style={{ 
                width: "100%", 
                maxHeight: "calc(100vh - 150px)", 
                objectFit: "contain", 
                border: "1px solid #ddd",
                borderRadius: "8px"
              }}
              onLoad={() => console.log("결과 이미지 로드 성공")}
              onError={(e) => console.error("결과 이미지 로드 실패:", e)}
            />
            <canvas
              ref={canvasRef}
              style={{ 
                position: "absolute", 
                top: 0, 
                left: 0, 
                width: "100%", 
                height: "100%" 
              }}
            />
          </div>
        </div>
      )}

      {/* 바코드 목록 */}
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
                  background: "blue",
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

      {/* 상세정보 모달 */}
      {isDetailOpen && selectedRowData && (
        <OutboundDetail
          selectedRowData={selectedRowData}
          onClose={closeDetailModal}
          onOutboundComplete={handleOutboundComplete}
        />
      )}
    </div>
  );
};

// 상세정보 모달 컴포넌트 (출고 전용)
const OutboundDetail = ({ selectedRowData, onClose, onOutboundComplete }) => {
  const handleComplete = () => {
    if (selectedRowData.barcode_num) {
      onOutboundComplete(selectedRowData.barcode_num);
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
                src={`${API_BASE_URL}/uploads/${selectedRowData.barcode_image}`}
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
          <button 
            className="btn-complete" 
            onClick={handleComplete}
            style={{ background: "#007bff" }} // 출고 완료 버튼은 파란색
          >
            출고완료
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
