import React, { useState } from "react";
import axios from 'axios';

const formatPhoneNumber = (number) => {
  if (!number) return "";
  const cleaned = number.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  return number;
};


const AddEquipment = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    equipment_name: "",
    category: "",
    equipment_no: "",
    type: "",
    quantity: "",
    status: "",
    location: "",
    region: "",
    manufacturer: "",
    model: "",
    purchase_date: "",
    warranty_expiry: "",
    last_maintenance_date: "",
    next_maintenance_date: "",
    assigned_to: "",
    assigned_to_phone: "",  
    remarks: "",
  });



  const [phoneOptions, setPhoneOptions] = useState([]); // 동명이인 있을 때

  const handleAssignedToChange = async (e) => {
    const name = e.target.value;
    setFormData(prev => ({ ...prev, assigned_to: name }));
  
    if (name.trim() === "") {
      setPhoneOptions([]);
      setFormData(prev => ({ ...prev, assigned_to_phone: "" }));
      return;
    }
  
    try {
      const res = await axios.get(`http://34.47.73.162:5099/api/users?name=${encodeURIComponent(name)}`);
      const numbers = res.data.phone_numbers;
  
      if (numbers.length === 1) {
        setPhoneOptions([]);
        setFormData(prev => ({ ...prev, assigned_to_phone: numbers[0].number }));
      } else if (numbers.length > 1) {
        setPhoneOptions(numbers);
        setFormData(prev => ({ ...prev, assigned_to_phone: "" }));
      } else {
        setPhoneOptions([]);
        setFormData(prev => ({ ...prev, assigned_to_phone: "" }));
      }
    } catch (err) {
      console.error("전화번호 조회 실패:", err);
    }
  };
  

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://34.47.73.162:5099/equipments", formData);
      onAdd();   // 테이블 리프레시
      onClose(); // 모달 닫기
    } catch (error) {
      console.error("추가 실패:", error);
    }
  };
  

  const styles = {
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: "#fff",
      padding: "20px",
      borderRadius: "8px",
      width: "500px",
      height: "80vh",
      overflowY: "auto",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    },
    input: {
      width: "100%",
      padding: "8px",
      marginTop: "5px",
      marginBottom: "15px",
      border: "1px solid #ccc",
      borderRadius: "4px",
      boxSizing: "border-box",
    },
    label: {
      fontWeight: "600",
    },
    buttonContainer: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "15px",
      marginTop: "20px",
    },
    button: {
      height: "40px",
      padding: "0 20px",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "14px",
    },
    submitButton: {
      border: "2px solid #007bff",
      backgroundColor: "#007bff",
      color: "white",
    },
    cancelButton: {
      border: "2px solid #f44336",
      backgroundColor: "#ffffff",
      color: "black",
    },
  };

  const fields = [
    { name: "equipment_name", label: "기자재명" },
    { name: "equipment_no", label: "기자재 번호" },
    { name: "type", label: "형태" },
    { name: "quantity", label: "수량", type: "number" },
    { name: "status", label: "상태" },
    { name: "location", label: "현재 위치" },
    { name: "region", label: "지역" },
    { name: "manufacturer", label: "제조사" },
    { name: "model", label: "모델명" },
    { name: "purchase_date", label: "구매일", type: "date" },
    { name: "warranty_expiry", label: "보증 만료일", type: "date" },
    { name: "last_maintenance_date", label: "마지막 점검일", type: "date" },
    { name: "next_maintenance_date", label: "다음 점검 예정일", type: "date" },
    { name: "remarks", label: "비고" },
  ];

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h3 style={{ textAlign: "center", marginBottom: "20px" }}>기자재 추가</h3>
        <form onSubmit={handleAdd}>
          {/* 일반 필드 렌더링 */}
          {fields.map((field) => (
            
            <React.Fragment key={field.name}>
              
              <div>
                <label htmlFor={field.name} style={styles.label}>
                  {field.label}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type || "text"}
                  value={formData[field.name]}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </React.Fragment>
          ))}

          {/* 카테고리 select는 여전히 equipment_name 아래에만 보여줌 */}
          <div>
            <label htmlFor="category" style={styles.label}>카테고리</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">선택하세요</option>
              <option value="렌트">렌트</option>
              <option value="비품">비품</option>
              <option value="소모품">소모품</option>
            </select>
          </div>

          {/* 🟡 담당자 필드는 fields 바깥에 따로 작성 */}
          <div>
            <label htmlFor="assigned_to" style={styles.label}>담당자</label>
            <input
              id="assigned_to"
              name="assigned_to"
              type="text"
              value={formData.assigned_to}
              onChange={handleAssignedToChange}
              style={styles.input}
            />
          </div>

          <div>
          <label htmlFor="assigned_to_phone" style={styles.label}>전화번호</label>
            {phoneOptions.length <= 1 ? (
              <input
                id="assigned_to_phone"
                name="assigned_to_phone"
                type="text"
                value={formatPhoneNumber(formData.assigned_to_phone)}
                readOnly
                style={styles.input}
              />
            ) : (
              <select
                id="assigned_to_phone"
                name="assigned_to_phone"
                value={formData.assigned_to_phone}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    assigned_to_phone: e.target.value,
                  }))
                }
                style={styles.input}
              >
                <option value="">전화번호 선택</option>
                {phoneOptions.map((item) => (
                  <option key={item.id} value={item.number}>
                    {item.username} {formatPhoneNumber(item.number)}
                  </option>
                ))}
              </select>
            )}


          </div>

          {/* 버튼 영역 */}
          <div style={styles.buttonContainer}>
            <button type="submit" style={{ ...styles.button, ...styles.submitButton }}>
              추가
            </button>
            <button type="button" onClick={onClose} style={{ ...styles.button, ...styles.cancelButton }}>
              취소
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default AddEquipment;
