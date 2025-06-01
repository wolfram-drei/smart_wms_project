import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import axios from "axios";

const MaintenanceCalendar = ({ equipmentList, onEventClick }) => {
  const [memoEvents, setMemoEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [memoText, setMemoText] = useState("");
  const [showMemoModal, setShowMemoModal] = useState(false);

  // ✅ 메모 불러오기 useEffect 추가
  useEffect(() => {
    axios.get("http://34.47.73.162:5099/memos")
      .then((res) => {
        console.log("서버에서 받은 메모:", res.data); // 👈 여기 먼저 확인
        const serverMemos = res.data.map((memo) => ({
          id: `memo-${memo.id}`,
          title: memo.title,
          start: new Date(memo.date).toISOString().slice(0, 10),  // ✅ 올바른 포맷
          color: "#6f47c5",
          extendedProps: { ...memo }
        }));
        console.log("FullCalendar용 메모 이벤트:", serverMemos); // 👈 이거도 로그 찍기
        setMemoEvents(serverMemos);
      })
      .catch((err) => {
        console.error("메모 불러오기 실패", err);
      });
  }, []);

  // 장비 일정 -> 이벤트로 변환
  const equipmentEvents = equipmentList
    .filter((item) => item.next_maintenance_date)
    .map((item) => ({
      id: item.id,
      title: item.equipment_name,
      start: new Date(item.next_maintenance_date).toISOString().slice(0, 10),
      color: "#f39c12",
      extendedProps: { ...item },
    }));

  // 📌 전체 이벤트 통합
  const allEvents = [...equipmentEvents, ...memoEvents];
  console.log("전체 FullCalendar 이벤트 목록:", allEvents); // ✅ 여기도

  // 📅 날짜 클릭
  const handleDateClick = (info) => {
    setSelectedDate(info.dateStr);
    setShowMemoModal(true);
  };

  // ✅ 메모 저장
  const handleSaveMemo = async () => {
    if (!memoText.trim()) return;
  
    try {
      const newMemoData = {
        title: memoText,
        date: selectedDate,
        content: "", // content가 비어 있더라도 넣어줘야 에러 안 남
        created_by: "unknown" // 필요한 경우 수정
      };
  
      const res = await axios.post("http://34.47.73.162:5099/memos", newMemoData);

      // 전체 다시 불러오기
      const getRes = await axios.get("http://34.47.73.162:5099/memos");
      const serverMemos = getRes.data.map((memo) => ({
        id: `memo-${memo.id}`,
        title: memo.title,
        start: new Date(memo.date).toISOString().split("T")[0],  // ✅ 제대로 Date 객체로
        color: "#6f47c5",
        extendedProps: { ...memo }
      }));
      setMemoEvents(serverMemos);
  
      // 상태 초기화
      setMemoText("");
      setSelectedDate(null);
      setShowMemoModal(false);
    } catch (error) {
      console.error("메모 저장 실패", error);
      alert("메모 저장에 실패했습니다.");
    }
  };
  

  const handleEventClick = async (info) => {
    const eventId = info.event.id;
  
    // 메모라면 삭제 확인
    if (eventId.startsWith("memo-")) {
      const confirmDelete = window.confirm("이 메모를 삭제하시겠습니까?");
      if (confirmDelete) {
        const memoId = eventId.replace("memo-", "");
        try {
          await axios.delete(`http://34.47.73.162:5099/memos/${memoId}`);
          setMemoEvents((prev) => prev.filter((e) => e.id !== eventId));
          alert("메모가 삭제되었습니다.");
        } catch (error) {
          console.error("메모 삭제 실패", error);
          alert("메모 삭제에 실패했습니다.");
        }
      }
      return;
    }
  
    // 장비 일정이면 기존 로직 실행
    const equipment = info.event.extendedProps;
    if (equipment?.equipment_name && onEventClick) {
      onEventClick(equipment);
    }
  };

  // 🛠 드래그로 일정 변경
  const handleEventDrop = async (info) => {
    const newDate = info.event.startStr;
    const id = info.event.id;

    // 메모는 서버 업데이트 필요 없음
    if (id.startsWith("memo-")) return;

    try {
      await axios.patch(`http://34.47.73.162:5099/equipments/${id}`, {
        next_maintenance_date: newDate,
      });
      alert("일정이 변경되었습니다!");
    } catch (error) {
      console.error("일정 변경 실패:", error);
      alert("일정 변경 중 오류 발생");
      info.revert(); // 실패 시 복구
    }
  };

  return (
    <div style={{ marginTop: "20px", position: "relative" }}>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={allEvents}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        editable={true}
        eventDrop={handleEventDrop}
        height={"auto"}
        locale={"ko"}
      />

      {/* 메모 입력 모달 */}
      {showMemoModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "10px",
              width: "300px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginBottom: "10px" }}>{selectedDate} 메모 추가</h3>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              rows={4}
              placeholder="메모를 입력하세요"
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #ccc",
                marginBottom: "10px",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setShowMemoModal(false)}
                style={{
                  padding: "6px 12px",
                  background: "#ccc",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleSaveMemo}
                style={{
                  padding: "6px 12px",
                  background: "#6f47c5",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceCalendar;
