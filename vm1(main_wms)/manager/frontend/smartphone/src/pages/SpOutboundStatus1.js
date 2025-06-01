import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = "http://34.64.211.3:5031"; // 실제 백엔드 주소

const SpOutboundStatus1 = () => {
  const [data, setData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showBackupData, setShowBackupData] = useState(false); // 출고완료 현황 표시 여부

  const [bulkModalVisible, setBulkModalVisible] = useState(false); // 바코드 다량 인식 모달 표시 여부
  const [bulkSelectedFile, setBulkSelectedFile] = useState(null);
  const [bulkPreviewUrl, setBulkPreviewUrl] = useState("");

  useEffect(() => {
    fetchTableData();
  }, [showBackupData]);

  const fetchTableData = async () => {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const todayStr = `${year}-${month}-${day}`;

      let response;
      if (showBackupData) {
        // BackupTable: 오늘 날짜 & 출고완료
        response = await axios.get(`${API_BASE_URL}/backup-outbound-status?date=${todayStr}`);
      } else {
        // MainTable: 오늘 날짜 & 출고요청
        response = await axios.get(`${API_BASE_URL}/outbound-status?date=${todayStr}`);
      }

      let fetchedData = response.data || [];

      // warehouse_location 기준 정렬
      fetchedData.sort((a, b) => {
        const locA = a.warehouse_location || "";
        const locB = b.warehouse_location || "";
        return locA.localeCompare(locB);
      });

      setData(fetchedData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
    setSelectedFile(null);
    setPreviewUrl("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);

      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadBarcodeImage = async () => {
    if (!selectedFile) {
      alert("이미지를 선택해주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/barcode-upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status === 200) {
        alert("바코드 디버깅 완료!");
        console.log(response.data);
        fetchTableData(); // 데이터 갱신
      } else {
        alert("바코드 디버깅 실패!");
      }
    } catch (error) {
      console.error("Barcode upload error:", error);
      alert("바코드 업로드 중 오류 발생!");
    }
  };

  // 바코드 다량 인식용 핸들러
  const openBulkModal = () => {
    setBulkModalVisible(true);
    setBulkSelectedFile(null);
    setBulkPreviewUrl("");
  };

  const closeBulkModal = () => {
    setBulkModalVisible(false);
    setBulkSelectedFile(null);
    setBulkPreviewUrl("");
  };

  const handleBulkFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBulkSelectedFile(file);

      const reader = new FileReader();
      reader.onload = () => setBulkPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadBulkBarcodeImage = async () => {
    if (!bulkSelectedFile) {
      alert("이미지를 선택해주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("image", bulkSelectedFile);

    try {
      // 동일한 /barcode-upload 사용 (이미 다중 바코드 처리 가능)
      const response = await axios.post(`${API_BASE_URL}/barcode-upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status === 200) {
        alert("다량 바코드 디버깅 완료!");
        console.log(response.data);
        fetchTableData(); // 데이터 갱신
        closeBulkModal();
      } else {
        alert("다량 바코드 디버깅 실패!");
      }
    } catch (error) {
      console.error("Bulk barcode upload error:", error);
      alert("다량 바코드 업로드 중 오류 발생!");
    }
  };


  const deleteRow = async (id) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/delete-row/${id}`);
      if (response.status === 200) {
        alert("행이 삭제되었습니다.");
        // 삭제된 데이터를 제거
        setData((prevData) => prevData.filter((row) => row.id !== id));
      } else {
        alert(response.data.message || "삭제 실패");
      }
    } catch (error) {
      console.error("Error deleting row:", error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };
  
  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
      <h1 style={styles.title}>오늘 출고 현황</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowBackupData((prev) => !prev)}
            style={styles.toggleButton}
          >
            {showBackupData ? "출고 요청 현황" : "출고 완료 현황"}
          </button>
          {!showBackupData && (
            <button onClick={openBulkModal} style={styles.toggleButton}>
              바코드 다량 인식하기
            </button>
          )}
        </div>
      </div>

      <div style={styles.listContainer}>
      {data.map((item) => (
          <div key={item.id} style={styles.listItem}>
            <div onClick={() => handleItemClick(item)} style={styles.itemContent}>
              <div style={styles.itemRow}>
                <span style={styles.label}>업체명:</span> {item.company_name}
              </div>
              <div style={styles.itemRow}>
                <span style={styles.label}>상품명:</span> {item.product_name}
              </div>
              <div style={styles.itemRow}>
                <span style={styles.label}>창고 위치:</span> {item.warehouse_location}
              </div>
              <div style={styles.itemRow}>
                <span style={styles.label}>출고 예정일:</span> {item.outbound_date}
              </div>
            </div>
            {/* 삭제 버튼 */}
            {!showBackupData && (
              <button
                onClick={() => deleteRow(item.id)}
                style={styles.deleteButton}
              >
                삭제
              </button>
            )}
          </div>
        ))}
      </div>

      {modalVisible && selectedItem && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>상세 정보</h2>
              <button style={styles.closeButton} onClick={closeModal}>닫기</button>
            </div>
            <div style={styles.modalContent}>
              <p><strong>업체명:</strong> {selectedItem.company_name}</p>
              <p><strong>상품명:</strong> {selectedItem.product_name}</p>
              <p><strong>창고 위치:</strong> {selectedItem.warehouse_location}</p>
              <p><strong>출고 예정일:</strong> {selectedItem.outbound_date}</p>
              {selectedItem.warehouse_type && (
                <p><strong>창고 타입:</strong> {selectedItem.warehouse_type}</p>
              )}
              {selectedItem.inbound_quantity && (
                <p><strong>출고 수량:</strong> {selectedItem.inbound_quantity}</p>
              )}

              {/* 출고완료 현황에서는 업로드 버튼 숨김 */}
              {!showBackupData && (
                <div style={{ marginTop: "20px" }}>
                  <label htmlFor="fileInput" style={styles.fileInputLabel}>
                    업로드할 바코드 이미지를 선택해주세요.
                  </label>
                  <input
                    type="file"
                    id="fileInput"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  {previewUrl && (
                    <div style={styles.previewContainer}>
                      <img src={previewUrl} alt="바코드 미리보기" style={styles.previewImage} />
                    </div>
                  )}
                  <button
                    onClick={uploadBarcodeImage}
                    style={styles.uploadButton}
                  >
                    바코드 이미지 업로드하기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    {bulkModalVisible && (
        <div style={styles.modalOverlay} onClick={closeBulkModal}>
          <div style={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>바코드 다량 인식</h2>
              <button style={styles.closeButton} onClick={closeBulkModal}>닫기</button>
            </div>
            <div style={styles.modalContent}>
              <label htmlFor="bulkFileInput" style={styles.fileInputLabel}>
                업로드할 바코드 이미지를 선택해주세요.
              </label>
              <input
                type="file"
                id="bulkFileInput"
                accept="image/*"
                onChange={handleBulkFileChange}
                style={{ display: "none" }}
              />
              {bulkPreviewUrl && (
                <div style={styles.previewContainer}>
                  <img src={bulkPreviewUrl} alt="바코드 미리보기" style={styles.previewImage} />
                </div>
              )}
              <button
                onClick={uploadBulkBarcodeImage}
                style={styles.uploadButton}
              >
                바코드 이미지 업로드하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpOutboundStatus1;

const styles = {
  container: {
    fontFamily: "sans-serif",
    backgroundColor: "#f8f9fa",
    minHeight: "100vh",
    padding: "20px",
    boxSizing: "border-box",
    position: "relative",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  title: {
    fontSize: "20px",
    fontWeight: "bold",
  },
  toggleButton: {
    padding: "10px 20px",
    background: "#17a2b8",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "14px",
  },
  listContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  listItem: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    padding: "15px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    cursor: "pointer",
    fontSize: "14px",
  },
  itemRow: {
    marginBottom: "5px",
    lineHeight: "1.4",
  },
  label: {
    fontWeight: "bold",
    marginRight: "5px",
  },
  modalOverlay: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: "20px",
    borderTopRightRadius: "20px",
    width: "100%",
    maxWidth: "600px",
    padding: "20px",
    boxSizing: "border-box",
    animation: "slideUp 0.3s ease",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  modalTitle: {
    fontSize: "18px",
    margin: 0,
  },
  closeButton: {
    background: "#6c757d",
    border: "none",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "14px",
  },
  modalContent: {
    fontSize: "14px",
    lineHeight: "1.5",
  },
  fileInputLabel: {
    display: "inline-block",
    padding: "10px",
    background: "#007bff",
    color: "white",
    borderRadius: "5px",
    cursor: "pointer",
    textAlign: "center",
    fontSize: "14px",
  },
  previewContainer: {
    marginTop: "10px",
    textAlign: "center",
  },
  previewImage: {
    maxWidth: "100%",
    maxHeight: "200px",
    borderRadius: "5px",
  },
  uploadButton: {
    padding: "10px",
    background: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: "10px",
    width: "100%",
    fontSize: "14px",
  },
};
