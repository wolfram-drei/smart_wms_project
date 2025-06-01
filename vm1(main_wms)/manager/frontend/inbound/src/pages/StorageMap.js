// src/StorageMap.js
import React, { useEffect, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import axios from "axios";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import customIconUrl from '../components/location.png';

import '../index.css'

// 서버 주소 설정
const API_BASE = "http://34.64.211.3:5002";

// 기본 마커 아이콘 설정
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const locations = [
  { id: 1, name: "보관소 A", lat: 37.5665, lng: 126.9780 },
  { id: 2, name: "보관소 B", lat: 37.5668, lng: 126.9782 },
  { id: 3, name: "보관소 C", lat: 37.5662, lng: 126.9778 },
  { id: 4, name: "보관소 D", lat: 37.5666, lng: 126.9785 },
  { id: 5, name: "보관소 E", lat: 37.5661, lng: 126.9783 },
  { id: 6, name: "보관소 F", lat: 37.5664, lng: 126.9775 },
  { id: 7, name: "보관소 G", lat: 37.5663, lng: 126.9787 },
  { id: 8, name: "보관소 H", lat: 37.5669, lng: 126.9779 },
  { id: 9, name: "보관소 I", lat: 37.5660, lng: 126.9781 }
];

// 슬롯 입체박스를 위한 컴포넌트 
const SlotBox = ({ position, slot, index, onClick }) => {
  const meshRef = useRef();

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={() => slot.available && onClick(index)}
        castShadow
      >
        <boxGeometry args={[1.8, 1.2, 1]} />
        <meshStandardMaterial
          color={slot.available ? "#f5e3ff" : "#c25afa"} // 밝은 색상으로 변경
          metalness={0.4}
          roughness={0.8}
        />
      </mesh>
      <Html position={[0, 0, 0.6]} transform occlude>
        <div style={{
          color: "white",
          fontSize: "10px",
          textAlign: "center",
          maxWidth: "120px",
          whiteSpace: "normal",
          overflowWrap: "break-word",
          wordBreak: "break-word",
          padding: "5px 8px",
          borderRadius: "6px",
          transform: "rotateY(0deg) rotateX(0deg)",
        }}>
          {slot.available ? "" : (
            <>
              <div style={{ fontWeight: 'bold' }}>{slot.company_name}</div>
              <div>{slot.product_name}</div>
              <div style={{ fontSize: '10px', opacity: 0.6 }}>{slot.slot_name}</div>
            </>
          )}
        </div>
      </Html>
    </group>
  );
};



// ✅ 보관소 지도 페이지
export const StorageMap = () => {
  const [slotData, setSlotData] = useState([]);
  const [unassignedData, setUnassignedData] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchSlotInfo = async (locationId) => {
    try {
      const [slotsRes, unassignedRes] = await Promise.all([
        fetch(`http://34.64.211.3:5002/storage/slots/${locationId}`),
        fetch(`http://34.64.211.3:5002/storage/unassigned/${locationId}`)
      ]);
  
      const slots = await slotsRes.json();
      const unassigned = await unassignedRes.json();
  
      setSlotData(slots);
      setUnassignedData(unassigned);
    } catch (err) {
      console.error("📛 슬롯 정보 로드 실패:", err);
    }
  };

  const customIcon = new L.Icon({
    iconUrl: customIconUrl,
    iconSize: [30, 30],
    iconAnchor: [15, 42],
    popupAnchor: [0, -40],
  });

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h2 style={styles.sectionTitle}>창고 현황</h2>
  
        <MapContainer
          center={[37.5664, 126.9782]} // ✅ 새 중심 좌표
          zoom={30}
          scrollWheelZoom={true}
          style={{ 
            height: "600px",
            width: "100%",
            borderRadius: "12px",
            boxShadow: "0 6px 12px rgba(0,0,0,0.1)",
            overflow: "hidden" }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {locations.map(loc => (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={customIcon}
              eventHandlers={{ click: () => fetchSlotInfo(loc.id) }}
            >
              <Popup className="custom-popup">
                <div style={{
                  padding: "10px",
                  textAlign: "center",
                  width: "150px",
                }}>
                  <h4 style={{
                    marginBottom: "12px",
                    fontSize: "16px",
                    color: "#6f47c5",
                    fontWeight: "bold"
                  }}>
                    📦 {loc.name}
                  </h4>
  
                  <div style={{
                    backgroundColor: "#e3ddff",
                    padding: "8px",
                    borderRadius: "6px",
                    marginBottom: "8px",
                    fontSize: "13px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span>✅ 배정 슬롯</span>
                    <strong style={{ color: "#4a27c5" }}>
                      {slotData.filter(s => !s.available).length}개
                    </strong>
                  </div>

                  <div style={{
                    backgroundColor: "#e7f8ec",
                    padding: "8px",
                    borderRadius: "6px",
                    marginBottom: "10px",
                    fontSize: "13px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span>✅ 남은 슬롯</span>
                    <strong style={{ color: "#4a27c5" }}>
                      {slotData.filter(s => s.available).length}개
                    </strong>
                  </div>
  
                  <div style={{
                    backgroundColor: "#ffe3e3",
                    padding: "8px",
                    borderRadius: "6px",
                    marginBottom: "10px",
                    fontSize: "13px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span>⛔ 미배정</span>
                    <strong style={{ color: "#c54242" }}>
                      {unassignedData.length}건
                    </strong>
                  </div>
  
                  <button
                    onClick={() => {
                      setSelectedLocation(loc);
                      setIsModalOpen(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      backgroundColor: "#6f47c5",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      cursor: "pointer",
                      boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.15)"
                    }}
                  >
                    위치 지정
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
  
        {/* 모달은 MapContainer 밖에 있어야 함 */}
        {isModalOpen && selectedLocation && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={styles.modalContent}>
              {/* 상단 헤더 (제목 + 닫기 버튼) */}
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>📍 {selectedLocation.name}</h3>
                <button onClick={() => setIsModalOpen(false)} style={styles.closeButton}>
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <div style={{ backgroundColor: '#c25afa', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: 'white' }}>    </div> 이용중
                <div style={{ backgroundColor: '#f5e3ff', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: '#4f47c5' }}>   </div> 비어있음
                
              </div>

              <StorageDetail locationId={selectedLocation.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



// ✅ 물품 보관 현황 페이지
export const StorageDetail = ( { locationId }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [slots, setSlots] = useState([]);
  const [unassignedItems, setUnassignedItems] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/storage/slots/${locationId}`)
      .then((res) => setSlots(res.data))
      .catch((err) => console.error("슬롯 불러오기 실패:", err));
  }, [locationId]);

  const handleEmptySlotClick = async (slotIndex) => {
    setSelectedSlot(slotIndex);
    try {
      const res = await axios.get(`${API_BASE}/storage/unassigned/${locationId}`);
      setUnassignedItems(res.data);
      setShowModal(true);
    } catch (err) {
      console.error("할당 가능한 물품 불러오기 실패:", err);
    }
  };

  const handleAssign = async (product_name) => {
    try {
      const { x, y, z } = indexToXYZ(selectedSlot);
      const slotName = `SLOT-${x}-${y}-${z}`; // ✅ 좌표 기반으로 생성
      await axios.post(`${API_BASE}/storage/assign`, {
        warehouse_num: slotName,
        product_name,
        warehouse_location: `보관소 ${String.fromCharCode(64 + Number(locationId))}`
      });
      alert("슬롯 배정 완료");
      setShowModal(false);
      const refreshed = await axios.get(`${API_BASE}/storage/slots/${locationId}`);
      setSlots(refreshed.data);
    } catch (err) {
      alert("슬롯 저장 실패");
    }
  };

  const totalSlots = 45;
  const slotSpacing = 2;
  const xCount = 3;
  const yCount = 3;
  const zCount = 5;

  const indexToXYZ = (index) => {
    const x = index % xCount;
    const y = Math.floor(index / xCount) % yCount;
    const z = Math.floor(index / (xCount * yCount));
    return { x, y, z };
  };

  return (
    <>
      <div style={{ height: "600px", width: "100%", overflow: "hidden" }}>
        <Canvas camera={{ position: [10, 5, 10], fov: 45 }} shadows>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5,10,5]} intensity={1.2} castShadow />
          <OrbitControls 
            enableZoom={true}
            enableRotate={true}
            minPolarAngle={Math.PI / 3} // 약 60도
            maxPolarAngle={Math.PI / 2} // 상하 회전 45도 근처로 고정
          />
          {Array.from({ length: totalSlots }).map((_, idx) => {
            const { x, y, z } = indexToXYZ(idx);
            const position = [
              (x - 1) * slotSpacing,
              y * slotSpacing,
              (2 - z) * slotSpacing
            ];
            const slot = slots[idx] || { available: true, company_name: '', product_name: '' };

            return (
              <SlotBox
                key={idx}
                position={position}
                slot={{
                  ...slot,
                  coords: `(${x}, ${y}, ${z})` // 🔹 좌표 문자열 추가
                }}
                index={idx}
                onClick={handleEmptySlotClick}
              />
            );
          })}
        </Canvas>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: '#fff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '420px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(8px)',
            zIndex: 2100
          }}>
            <h3 style={{ fontSize: '18px', color: '#4f47c5', marginBottom: '16px' }}>💼 슬롯에 물품 할당</h3>
            <ul style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto', backgroundColor: '#fff' }}>
              {unassignedItems.map(item => (
                <li
                  key={item.id}
                  onClick={() => handleAssign(item.product_name)}
                  style={{
                    padding: '10px 14px', marginBottom: '8px',
                    borderRadius: '8px', backgroundColor: '#f4f2ff',
                    cursor: 'pointer', fontSize: '14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <span>{item.company_name}</span>
                  <strong>{item.product_name}</strong>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowModal(false)}
              style={{
                marginTop: '12px', width: '100%', padding: '10px',
                backgroundColor: '#6f47c5', color: '#fff', border: 'none',
                borderRadius: '8px', fontSize: '15px', cursor: 'pointer'
              }}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const styles = {
  container: {
    padding: "20px",
  },
  content: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "20px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "2px solid #6f47c5",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginTop: "20px",
    padding: "10px",
  },
  slot: {
    height: "140px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "20px",
    fontWeight: "600",
    fontSize: "14px",
    textAlign: "center",
    padding: "16px",
    whiteSpace: "pre-wrap",
    background: "linear-gradient(135deg, #6f8af7 0%, #4f5bd5 100%)",
    color: "#fff",
    boxShadow: "10px 20px 30px rgba(0,0,0,0.2)",
    transform: "rotateX(10deg) rotateY(-5deg)", // 입체 기울기
    transformStyle: "preserve-3d",
    perspective: "800px",
    transition: "transform 0.4s ease",
    userSelect: "none",
  },
  slotHover: {
    transform: "scale(1.05) rotateX(5deg) rotateY(5deg)",
    boxShadow: "0 12px 24px rgba(0, 0, 0, 0.25)",
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '10px',
    minWidth: '600px',
    position: 'relative',
    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalTitle: {
    color: '#6f47c5',
    fontSize: '18px',
    fontWeight: 'bold',
    margin: 0,
  },
  modalListItem: {
    cursor: "pointer",
    padding: "8px",
    borderBottom: "1px solid #eee",
    fontSize: "14px",
    transition: "background 0.2s ease",
  },
  closeButton: {
    border: 'none',
    backgroundColor: '#6f47c5',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    borderRadius: '50%',
    width: '30px',
    height: '30px',
    lineHeight: '30px',
    textAlign: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
  },
};