import React from "react";

const EquipmentDetail = ({ equipment }) => {
  const styles = {
    container: {
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      maxHeight: "400px",
      overflowY: "auto",
      paddingRight: "8px",
    },
    title: {
      fontSize: "1.6rem",
      fontWeight: "700",
      color: "#333",
      textAlign: "center",
      paddingBottom: "10px",
      marginBottom: "10px",
      borderBottom: "2px solid #eee",
    },
    card: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      backgroundColor: "#f9f9f9",
      borderRadius: "8px",
      border: "1px solid #e0e0e0",
    },
    label: {
      fontWeight: "600",
      color: "#555",
      flex: "0 0 140px",
    },
    value: {
      textAlign: "right",
      color: "#333",
      flex: "1",
      whiteSpace: "pre-line",
    },
    fallback: {
      padding: "20px",
      textAlign: "center",
      color: "#999",
    }
  };

  const renderCard = (label, value) => (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>
        {value !== undefined && value !== null && value !== '' ? value : "-"}
      </div>
    </div>
  );

  if (!equipment || typeof equipment !== "object") {
    return <div style={styles.fallback}>장비 정보가 올바르지 않습니다.</div>;
  }

  const sendSMS = async () => {
    if (!equipment?.phone_number) {
      alert("전화번호가 없습니다.");
      return;
    }

    try {
      const response = await fetch("http://34.47.73.162:5099/api/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: equipment.phone_number,
          message: `[점검 알림] ${equipment.equipment_name} 장비 점검 안내입니다.`,
        }),
      });

      const result = await response.json();
      console.log("문자 전송 응답:", result);

      if (result.groupId || result.status === "success") {
        alert("문자 전송 성공!");
      } else {
        const errorMsg =
          result?.message ||
          result?.errorMessage ||
          result?.result?.errorMessage ||
          "알 수 없는 오류";
        alert("문자 전송 실패: " + errorMsg);
      }
    } catch (error) {
      console.error("문자 전송 중 에러:", error);
      alert("문자 전송 중 오류가 발생했습니다.");
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>기자재 세부사항</h3>
      {renderCard("기자재명", equipment.equipment_name)}
      {renderCard("관리번호", equipment.equipment_no)}
      {renderCard("유형", equipment.type)}
      {renderCard("수량", equipment.quantity)}
      {renderCard("상태", equipment.status)}
      {renderCard("위치", equipment.location)}
      {renderCard("지역", equipment.region)}
      {renderCard("제조사", equipment.manufacturer)}
      {renderCard("모델", equipment.model)}
      {renderCard("구매일", equipment.purchase_date)}
      {renderCard("보증만료일", equipment.warranty_expiry)}
      {renderCard("최종점검일", equipment.last_maintenance_date)}
      {renderCard("다음점검일", equipment.next_maintenance_date)}
      {renderCard("담당자", equipment.assigned_to)}
      {renderCard("비고", equipment.remarks)}
      {renderCard("생성일", equipment.created_at)}
      {renderCard("담당자 전화번호", equipment.phone_number)}

      {/* 문자 전송 버튼 */}
      <button
        onClick={sendSMS}
        style={{
          marginTop: "20px",
          padding: "10px 16px",
          backgroundColor: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        문자 전송
      </button>

    </div>
  );
};

export default EquipmentDetail;
