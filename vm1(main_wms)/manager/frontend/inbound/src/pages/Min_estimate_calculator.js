import React, { useState, useEffect } from "react";

const Min_estimate_calculator = ({ selectedRowData, onUpdate, onClose }) => {
  const [productNum, setProductNum] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [palletSize, setPalletSize] = useState("");
  const [palletCount, setPalletCount] = useState(0);
  const [storageType, setStorageType] = useState("");
  const [storageDays, setStorageDays] = useState(0);
  const [total, setTotalCost] = useState(0);
  const [formData, setFormData] = useState(selectedRowData || {});
  const [activeFields, setActiveFields] = useState({}); // 필드 활성화 상태
  const [isCostCalculated, setIsCostCalculated] = useState(false); // 비용 계산 여부

  const palletPrices = {
    S: 5000,
    M: 10000,
    L: 20000,
  };

  const storagePrices = {
    상온: 5000,
    냉장: 10000,
    냉동: 20000,
  };

  // 선택된 Row 데이터 반영
  useEffect(() => {
    setFormData(selectedRowData || {});
    console.log("선택된 데이터:", selectedRowData);
    setActiveFields({});
  }, [selectedRowData]);

  // 입력값 변경 핸들러
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 체크박스 상태 변경 핸들러
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setActiveFields((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // 총 비용 계산
  const calculateTotalCost = () => {
    const palletCost = palletPrices[palletSize] || 0;
    const storageCost = storagePrices[storageType] || 0;
    const total = (palletCost + storageCost) * palletCount * storageDays;
    setTotalCost(total);
    setIsCostCalculated(true); // 비용 계산 완료 상태로 변경
  };

  // 보관 일수 자동 계산
  useEffect(() => {
    if (formData.subscription_inbound_date && formData.outbound_date) {
      const inboundDate = new Date(formData.subscription_inbound_date);
      const outboundDate = new Date(formData.outbound_date);
      if (!isNaN(inboundDate) && !isNaN(outboundDate)) {
        const duration = Math.max(0, Math.ceil((outboundDate - inboundDate) / (1000 * 60 * 60 * 24)));
        setStorageDays(duration);
      } else {
        setStorageDays(0); // 날짜 변환 실패하면 0으로 초기화
      }
    }
  }, [formData.subscription_inbound_date, formData.outbound_date]);

  // 확인 버튼 핸들러
  const handleConfirm = () => {
    // 활성화된 필드만 업데이트
    const updatedData = Object.keys(activeFields).reduce((acc, key) => {
      if (activeFields[key]) {
        acc[key] = formData[key];
      }
      return acc;
    }, {});

    updatedData.total_cost = total; // 총 비용
    updatedData.storage_duration = storageDays; // 보관 일수 자동 계산

    onUpdate(updatedData); // 부모 컴포넌트로 데이터 전달
    onClose(); // 계산기 닫기
  };

  const formatDateForInput = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const locations = ['보관소 A', '보관소 B', '보관소 C', '보관소 D', '보관소 E', '보관소 F', '보관소 G', '보관소 H', '보관소 I']

  return (
    <div
      style={{
        width: "100%",
        height: "550px",
        background: "white",
        borderRadius: "10px",
        overflow: "hidden", // ✅ 스크롤 막기
        display: "flex",
        flexDirection: "column", // 위아래 정렬
      }}
    >
      <div style={{ display: 'flex', flex: 1, gap: '30px', overflow: 'hidden' }}>
        {/* 왼쪽: 고객 정보 */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", height: '400px' }}>
        <h4 style={{ color: '#6f47c5', fontWeight: 'bold', marginBottom: '10px' }}>견적서 정보</h4>
        <table style={{ ...styles.table, height: "50%" }}>
        <thead>
          <tr style={styles.tableHeaderRow}>
            <th style={{ ...styles.tableHeader, width: "25%" }}>항목</th>
            <th style={{ ...styles.tableHeader, width: "60%" }}>고객 입력값</th>
            <th style={{ ...styles.tableHeader, width: "15%" }}>수정</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "업체명", name: "company_name" },
            { label: "상품명", name: "product_name" },
            { label: "수량", name: "inbound_quantity" },
            { label: "무게", name: "weight" },
            { label: "상태", name: "warehouse_type" },
            { label: "입고일", name: "subscription_inbound_date", type: "date" },
            { label: "출고일", name: "outbound_date", type: "date" },
          ].map(({ label, name, type = "text" }) => (
            <tr key={name}>
              <td style={styles.tableCell}>{label}</td>
              <td style={styles.tableCell}>
                <input
                  type={type}
                  name={name}
                  value={
                    type === "date"
                      ? formatDateForInput(formData[name])
                      : formData[name] || ""
                  }
                  onChange={handleInputChange}
                  disabled={!activeFields[name]}
                  style={styles.input}
                />
              </td>
              <td style={styles.tableCell}>
                <input
                  type="checkbox"
                  name={name}
                  checked={!!activeFields[name]}
                  onChange={handleCheckboxChange}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* 오른쪽: 실견적 입력 */}
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", height: '400px' }}>
    <h4 style={{ color: '#6f47c5', fontWeight: 'bold', marginBottom: '10px' }}>견적서 정보</h4>
      <table style={{ ...styles.table, height: "70%" }}>
        <thead>
          <tr style={styles.tableHeaderRow}>
            <th style={{ ...styles.tableHeader, width: "40%" }}>항목</th>
            <th style={{ ...styles.tableHeader, width: "60%" }}>값을 입력해주세요</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "제품 번호", value: productNum, onChange: setProductNum, type: "text" },
            {
              label: "창고 위치",
              value: warehouseLocation,
              onChange: setWarehouseLocation,
              type: "select",
              options: ["선택", ...locations],
            },
            {
              label: "팔레트 종류",
              value: palletSize,
              onChange: setPalletSize,
              type: "select",
              options: ["선택", "S", "M", "L"],
            },
            { label: "팔레트 개수", value: palletCount, onChange: setPalletCount, type: "number" },
            {
              label: "보관 타입",
              value: storageType,
              onChange: setStorageType,
              type: "select",
              options: ["선택", "상온", "냉장", "냉동"],
            },
          ].map(({ label, value, onChange, type, options }, idx) => (
            <tr key={idx}>
              <td style={styles.tableCell}>{label}</td>
              <td style={styles.tableCell}>
                {type === "select" ? (
                  <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>
                    {options.map((opt, i) => (
                      <option key={i} value={opt === "선택해주세요" ? "" : opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={type}
                    value={type === "number" ? Number(value) : value}
                    onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
                    style={styles.input}
                  />
                )}
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        
      </div>
    </div>


    {/* 총 비용 및 버튼 */}
    <div style={styles.resultBox}>
      <div style={{ textAlign: "center" }}>
        보관 일수는 <strong style={{ color: "#6f47c5" }}>{storageDays}일</strong> 입니다.
      </div>
      <h4 style={styles.resultTitle}>총 예상 비용은 {total.toLocaleString()} 원입니다.</h4>
    </div>

    <div style={styles.buttonRow}>
      {/* 총 비용 계산 버튼 */}
      {!isCostCalculated && (
        <button style={styles.calculateButton} onClick={calculateTotalCost}>
          💰 총 비용 계산하기
        </button>
      )}
      <button
        style={styles.sendButton}
        onClick={() => {
          // 👉 견적서 보내기 누르기 전에 storageDays, totalCost 재계산
          // 1. storageDays 재계산
          let days = 0;
          if (formData.subscription_inbound_date && formData.outbound_date) {
            const inbound = new Date(formData.subscription_inbound_date);
            const outbound = new Date(formData.outbound_date);
            if (!isNaN(inbound) && !isNaN(outbound)) {
              days = Math.max(0, Math.ceil((outbound - inbound) / (1000 * 60 * 60 * 24)));
            }
          }
          // 2. totalCost 재계산
          const palletCost = palletPrices[palletSize] || 0;
          const storageCost = storagePrices[storageType] || 0;
          const total = (palletCost + storageCost) * palletCount * days;
          // 3. 최종 저장 데이터
          const updatedData = {
            ...formData,
            product_number: productNum,
            warehouse_location: warehouseLocation,
            pallet_size: palletSize,
            pallet_num: palletCount,
            warehouse_type: storageType,
            storage_duration: days,
            total_cost: Number(total.toFixed(2)),
          };
          onUpdate(updatedData);
          onClose();
        }}
      >
        📤 견적서 보내기
      </button>
    </div>
  </div>
  );
};

export default Min_estimate_calculator;

const styles = {
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "2px solid #6f47c5",
  },
  container: {
    overflowY: "auto",
    msOverflowStyle: "none", // IE and Edge
    scrollbarWidth: "none", // Firefox
  },
  buttonPurple: {
    padding: "12px",
    backgroundColor: "#6f47c5",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '30px',
    justifyContent: 'space-between',
  },
  table: {
    height:'400px',
    borderCollapse: "collapse",
    border: "1px solid #6f47c5",
    tableLayout: "fixed", // ✅ 열 너비 고정
    width: "100%", // ✅ 전체 채우기
  },
  tableHeaderRow: {
    backgroundColor: "#f5f1fa",
  },
  tableHeader: {
    border: "1px solid #6f47c5",
    padding: "5px", 
    textAlign: "center",
    fontWeight: "bold",
    color: "#6f47c5",
    fontSize: "14px",
    lineHeight: "1.0", // ⬅ 추가하면 높이 안정감
  },
  tableCell: {
    border: "1px solid #6f47c5",
    padding: "6px",
    fontSize: "13px",
    lineHeight: "1.2", // ⬅ 추가하면 높이 안정감
  },
  input: {
    width: "100%",
    padding: "4px 6px", // ↘ padding을 작게 유지
    borderRadius: "4px",
    fontSize: "13px",
    outline: "none",
    border: "none",
    boxSizing: "border-box",
  },
  calculateButton: {
    marginTop: "20px",
    padding: "8px 12px",
    background: "linear-gradient(to right,rgb(148, 128, 248), #6f47c5)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  },
  resultBox: {
    marginTop:'20px',
    backgroundColor: "#f9f7ff",
    padding: "10px",
    borderRadius: "10px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  resultTitle: {
    color: "#6f47c5",
    fontSize: "16px",
    marginBottom: "10px",
  },
  resultAmount: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#333",
  },
  sendButton: {
    marginTop: "20px",
    padding: "8px 12px",
    background: "linear-gradient(to right,rgb(129, 127, 133),rgb(84, 84, 85))",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
  },
  
  cancelButton: {
    padding: "10px 20px",
    background: "#eee",
    color: "#333",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
  },
}

