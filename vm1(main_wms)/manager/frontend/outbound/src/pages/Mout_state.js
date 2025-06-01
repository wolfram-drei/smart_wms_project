import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "./Mout_state.css";

const API_BASE_URL = "http://34.64.211.3:5004";

const Mout_state = () => {
  const [searchText, setSearchText] = useState("");
  const [tableData, setTableData] = useState([]);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [showBackupData, setShowBackupData] = useState(false);
  const detailRef = useRef(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [vehicleList, setVehicleList] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoActionType, setVideoActionType] = useState(""); // "start" or "complete"
  const [videoSrc, setVideoSrc] = useState("");


  const handleOutsideClick = (event) => {
    if (detailRef.current && !detailRef.current.contains(event.target)) {
      setSelectedRowData(null);
    }
  };

  const fetchTableData = useCallback(async () => {
    try {
      const endpoint = showBackupData ? "backup-outbound-status" : "outbound-status";
      const response = await axios.get(`${API_BASE_URL}/${endpoint}`, {
        params: { searchText, status: selectedStatus },
      });
      const filtered = response.data.filter(item => item.id !== null);
      setTableData(filtered);
      setSelectedRowData(null);
    } catch (error) {
      console.error("Error fetching table data:", error);
    }
  }, [searchText, selectedStatus, showBackupData]);

  useEffect(() => {
    const syncAndFetch = async () => {
      try {
        await axios.post(`${API_BASE_URL}/refresh-outbound-request`);
        console.log("✅ 동기화 완료");
  
        fetchTableData();  // setTableData 포함됨
      } catch (err) {
        console.error("❌ 동기화 실패:", err);
      }
    };
  
    syncAndFetch();
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [fetchTableData]);

  const handleRowClick = (event) => {
    setSelectedRowData(event.data);
  };

  const handleSave = async () => {
    try {
      if (selectedRowData.outbound_status !== "출고요청") {
        alert("출고 요청 상태에서만 출고 완료로 변경할 수 있습니다.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/outbound-status/${selectedRowData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outbound_status: "출고완료" }),
      });

      if (response.ok) {
        alert("출고 상태가 성공적으로 업데이트되었습니다.");
        setShowBackupData(true);
      } else {
        const errorData = await response.json();
        alert(`출고 상태 업데이트에 실패했습니다: ${errorData.error || "알 수 없는 오류"}`);
      }
    } catch (error) {
      console.error("Error updating outbound status:", error);
      alert("출고 상태 업데이트 중 오류가 발생했습니다.");
    } finally {
      fetchTableData();
      setSelectedRowData(null);
    }
  };

  const dateFormatter = (params) => {
    if (!params.value) return "";
    const date = new Date(params.value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const gridRef = useRef(null);

  const handleRefresh = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/refresh-outbound-status`, { method: "POST" });
      if (response.ok) {
        alert("데이터가 새로고침 되었습니다.");
        fetchTableData();
      } else {
        const errorData = await response.json();
        alert(`새로고침 실패: ${errorData.error || "알 수 없는 오류"}`);
      }
    } catch (error) {
      console.error("Refresh error:", error);
      alert("새로고침 중 오류가 발생했습니다.");
    }
  };

  const handleStartPreparation = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/outbound-status/${selectedRowData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outbound_status: "출고 준비중",
        }),
      });
  
      if (response.ok) {
        alert("출고 상태가 '출고 준비중'으로 변경되었습니다.");
        fetchTableData();
        setSelectedRowData(null);
      } else {
        const errorData = await response.json();
        alert(`상태 변경 실패: ${errorData.error || "알 수 없는 오류"}`);
      }
    } catch (error) {
      console.error("출고 준비중 상태 변경 오류:", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    }
  };  

  const handleCompletePreparation = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/outbound-status/${selectedRowData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outbound_status: "출고 준비 완료",
        }),
      });
  
      if (response.ok) {
        alert("출고 상태가 '출고 준비 완료'로 변경되었습니다.");
        fetchTableData();
        setSelectedRowData(null);
      } else {
        const errorData = await response.json();
        alert(`상태 변경 실패: ${errorData.error || "알 수 없는 오류"}`);
      }
    } catch (error) {
      console.error("출고 준비 완료 상태 변경 오류:", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    }
  };

  const fetchVehicleList = async (mainTableId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/matching-vehicles`, {
        main_table_id: mainTableId
      });
      setVehicleList(response.data);
    } catch (error) {
      console.error("Error fetching vehicle list:", error);
    }
  };

  useEffect(() => {
    if (showModal && selectedRowData) {
      fetchVehicleList(selectedRowData.id);
      setSelectedVehicleId(null);
    }
  }, [showModal, selectedRowData]);

  const handleAssignVehicle = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/assign-vehicle`, {
        vehicle_id: selectedVehicleId,
        main_table_id: selectedRowData.id
      });
  
      if (response.data.message) {
        alert("배차가 완료되었습니다.");
        setShowModal(false);
        fetchTableData();  // 테이블 다시 불러오기
        setSelectedRowData(null);
      }
    } catch (error) {
      console.error("배차 처리 실패:", error);
      alert("배차 요청에 실패했습니다.");
    }
  }; 
  
  const handleVideoEnd = async () => {
    setShowVideoModal(false);
  
    try {
      const response = await fetch(`${API_BASE_URL}/video-end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          main_table_id: selectedRowData.id,
          video_type: videoActionType,  // "start" or "complete"
        }),
      });
  
      if (response.ok) {
        const data = await response.json();
        alert(data.message); // 예: "출고 상태가 '출고 준비 완료'로 변경되었습니다."
        fetchTableData();
        setSelectedRowData(null);
      } else {
        const errorData = await response.json();
        alert(`상태 변경 실패: ${errorData.error || "알 수 없는 오류"}`);
      }
    } catch (error) {
      console.error("상태 변경 오류:", error);
      alert("상태 변경 중 오류가 발생했습니다.");
    }
  };
  

  const [activeTab, setActiveTab] = useState('출고요청');
  const statusTabs = ['출고요청', '출고 준비중', '출고 준비 완료', '배차 완료', '출고완료'];
  const filteredData = tableData.filter(item => item.outbound_status === activeTab);

  return (
    <div className="container">
      <div className="content">
        <h2 className="sectionTitle">출고 현황</h2>

        <div className="searchContainer">
          <input
            type="text"
            placeholder="Search (회사 이름, 창고 위치, 출고 상태)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="inputField"
          />

          <button
            onClick={handleRefresh}
            className="buttonPrimary"
            style={{ backgroundColor: "#6f47c5" }}
          >
            새로고침
          </button>
        </div>

        {/* 🔽 탭 버튼 UI */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {statusTabs.map(status => (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderBottom: activeTab === status ? '3px solid #6f47c5' : '3px solid transparent',
                background: 'transparent',
                color: activeTab === status ? '#6f47c5' : '#333',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="ag-theme-alpine" style={{ height: "600px", width: "100%", minHeight: "400px" }}>
          <AgGridReact
            ref={gridRef}
            rowData={filteredData}
            domLayout="autoHeight"
            onGridReady={(params) => {
              params.api.sizeColumnsToFit(); // ✅ 화면 너비에 맞춤
            }}
            columnDefs={[
              { headerName: "업체", field: "company_name", sortable: true, filter: true },
              { headerName: "상품명", field: "product_name", sortable: true, filter: true },
              { headerName: "수량", field: "inbound_quantity", sortable: true, filter: true },
              { headerName: "창고위치", field: "warehouse_location", sortable: true, filter: true },
              { headerName: "창고타입", field: "warehouse_type", sortable: true, filter: true },
              { headerName: "출고상태", field: "outbound_status", sortable: true, filter: true },
              { headerName: "출고예정일", field: "outbound_date", sortable: true, filter: true, valueFormatter: dateFormatter },
              { headerName: "출고완료일", field: "last_outbound_date", sortable: true, filter: true, valueFormatter: dateFormatter },
            ]}
            onRowClicked={handleRowClick}
            pagination={true}
            paginationPageSize={10}
            defaultColDef={{ sortable: true, filter: true, resizable: true, suppressMovable: true }}
            gridOptions={{ headerHeight: 50, rowHeight: 40 }}
          />
        </div>

        {selectedRowData && selectedRowData.outbound_status !== "출고 준비 완료" && (
          <div className="modalOverlay">
            <div className="modalBox">
              <div className="modalHeader">
                <h3 style={{ margin: 0 }}>📦 출고 상세정보</h3>
                <button className="modalCloseBtn" onClick={() => setSelectedRowData(null)}>✕</button>
              </div>
              <table className="infoTable">
                <tbody>
                  <tr><th>업체명</th><td>{selectedRowData.company_name}</td></tr>
                  <tr><th>상품명</th><td>{selectedRowData.product_name}</td></tr>
                  <tr><th>출고 수량</th><td>{selectedRowData.inbound_quantity}</td></tr>
                  <tr><th>창고 위치</th><td>{selectedRowData.warehouse_location}</td></tr>
                  <tr><th>창고 타입</th><td>{selectedRowData.warehouse_type}</td></tr>
                  <tr><th>출고 상태</th><td>{selectedRowData.outbound_status}</td></tr>
                </tbody>
              </table>
              <div style={{
                    marginTop: "20px",
                    display: "flex",
                    justifyContent: "center", // 가운데 정렬
                    gap: "10px", // 버튼 사이 간격
                    flexWrap: "wrap",
                  }}
                >
                {selectedRowData.outbound_status === "출고요청" && (
                  <button
                    className="prep-button"
                    onClick={handleStartPreparation}
                  >
                    출고 준비 시작
                  </button>
                )}

                {selectedRowData.outbound_status === "출고 준비중" && (
                  <button
                    className="prep-button"
                    onClick={handleCompletePreparation}
                  >
                    출고 준비 완료
                  </button>
                )}

                <button
                  onClick={handleSave}
                  className="buttonPrimary"
                  style={{
                    cursor: selectedRowData.outbound_status === "출고요청" ? "pointer" : "not-allowed",
                    marginTop: "10px"
                  }}
                  disabled={selectedRowData.outbound_status !== "출고요청"}
                >
                  출고 완료
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedRowData && selectedRowData.outbound_status === "출고 준비 완료" && (
          <div className="modalOverlay">
            <div className="modalFlex">
              <div className="modalHeader">
                <span className="modalTitle">📦 출고 상세 및 배차</span>
                <button className="modalCloseBtn" onClick={() => setSelectedRowData(null)}>✕</button>
              </div>

              <div className="modalContentWrapper">
                {/* ◀ 왼쪽: 출고 상세 정보 */}
                <div className="modalLeft">
                  <table className="infoTable">
                    <tbody>
                      <tr><th>업체명</th><td>{selectedRowData.company_name}</td></tr>
                      <tr><th>상품명</th><td>{selectedRowData.product_name}</td></tr>
                      <tr><th>출고 수량</th><td>{selectedRowData.inbound_quantity}</td></tr>
                      <tr><th>창고 위치</th><td>{selectedRowData.warehouse_location}</td></tr>
                      <tr><th>창고 타입</th><td>{selectedRowData.warehouse_type}</td></tr>
                      <tr><th>출고 상태</th><td>{selectedRowData.outbound_status}</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* ▶ 오른쪽: 배차 UI */}
                <div className="modalRight">
                  <h3>🚚 배차할 차량 선택</h3>
                  {vehicleList.length === 0 ? (
                    <p>조건에 맞는 차량이 없습니다.</p>
                  ) : (
                    <ul>
                      {vehicleList.map((vehicle) => (
                        <li key={vehicle.id} style={{ marginBottom: "6px" }}>
                          <label>
                            <input
                              type="radio"
                              name="vehicle"
                              value={vehicle.id}
                              checked={selectedVehicleId === vehicle.id}
                              onChange={() => setSelectedVehicleId(vehicle.id)}
                            />
                            [{vehicle.truck_type}] {vehicle.driver_name} ({vehicle.driver_phone}) - {vehicle.current_location} → {vehicle.destination}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{ marginTop: "20px", textAlign: "center" }}>
                    <button
                      className="buttonPrimary"
                      disabled={!selectedVehicleId}
                      onClick={handleAssignVehicle}
                    >
                      배차 완료
                    </button>
                    
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};



export default Mout_state;
