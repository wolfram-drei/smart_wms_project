import React, { useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import Header from "../components/Header"; // 수정된 Header 컴포넌트 가져오기
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

const ManagerMainPage = () => {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const navigate = useNavigate();

  const [statistics, setStatistics] = useState({
    totalContracts: 0,
    totalProducts: 0,
    totalInquiries: 0,
    totalRevenue: "0"
  });

  const [gridData, setGridData] = useState([]);
  const [pieChartData, setPieChartData] = useState({
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
    }]
  });

  const [barChartData, setBarChartData] = useState({
    labels: [],
    datasets: [{
      label: '월별 계약 현황',
      data: [],
      backgroundColor: '#36A2EB'
    }]
  });
  const [barChartDataGPT, setBarChartDataGPT] = useState({
    labels: [],
    datasets: [
      {
        label: "입고 수량",
        data: [],
        backgroundColor: "#36A2EB",
      },
    ],
  });

  

  const [storageStatus, setStorageStatus] = useState({
    inboundComplete: 0,
    inboundReady: 0,
    outboundRequest: 0,
    outboundComplete: 0,
    contractWaiting: 0,
    contractComplete: 0
  });
  const [notices, setNotices] = useState([]);
  const [inquiries, setInquiries] = useState([]);

  const [gptQuery, setGptQuery] = useState(""); // 사용자 입력
  const [gptResponse, setGptResponse] = useState("검색 결과가 없습니다."); // GPT 응답
  const [loading, setLoading] = useState(false); // 로딩 상태
  


  const columnDefs = [
    { field: 'customerName', headerName: '고객명' },
    { field: 'productName', headerName: '제품명' },
    { field: 'status', headerName: '상태' },
    { field: 'contractDate', headerName: '계약일' },
    { field: 'inboundDate', headerName: '입고일' },
    { field: 'amount', headerName: '계약금액' }
  ];

  // 차트 옵션 추가
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  // Modal 관련 state 추가
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Modal 핸들러 추가
  const handleItemClick = (item, type) => {
    setSelectedItem({ ...item, type });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedItem(null);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log('데이터 조회 시작');

        const BASE_URL = 'http://34.64.211.3:5000';
        const NOTICES_URL = 'http://34.47.73.162:5000'; //시스템
        const INQUIRIES_URL = 'http://34.47.73.162:5088'; //시스템

        const statsResponse = await axios.get(`${BASE_URL}/api/manager/dashboard/statistics`);
        console.log('통계 데이터:', statsResponse.data);
        if (statsResponse.data.success) {
          setStatistics(statsResponse.data.data);
        }

        const statusResponse = await axios.get(`${BASE_URL}/api/manager/dashboard/status-distribution`);
        console.log('상태 분포 데이터:', statusResponse.data);
        if (statusResponse.data.success) {
          setPieChartData(statusResponse.data.data);
        }

        const monthlyResponse = await axios.get(`${BASE_URL}/api/manager/dashboard/monthly-contracts`);
        console.log('월별 계약 데이터:', monthlyResponse.data);
        if (monthlyResponse.data.success) {
          setBarChartData(monthlyResponse.data.data);
        }

        const contractsResponse = await axios.get(`${BASE_URL}/api/manager/dashboard/recent-contracts`);
        console.log('최근 계약 데이터:', contractsResponse.data);
        if (contractsResponse.data.success) {
          setGridData(contractsResponse.data.data);
        }

        // 창고 현황 통계 데이터 가져오기
        const storageResponse = await axios.get(`${BASE_URL}/api/manager/dashboard/storage-status`);
        if (storageResponse.data.success) {
          setStorageStatus(storageResponse.data.data);
        }

        // 공지사항과 문의사항 직접 QNA 서버에서 가져오기
        const noticesResponse = await axios.get(`${NOTICES_URL}/api/notices`);
        console.log('공지사항 응답:', noticesResponse);
        if (noticesResponse.data) {
          setNotices(noticesResponse.data);
        }

        const inquiriesResponse = await axios.get(`${INQUIRIES_URL}/api/inquiries`);
        console.log('문의사항 응답:', inquiriesResponse);
        if (Array.isArray(inquiriesResponse.data.inquiries)) {
          setInquiries(inquiriesResponse.data.inquiries);
        } else {
          setInquiries([]);
        }
        console.log('데이터 조회 완료');

      } catch (error) {
        console.error('데이터 조회 중 오류 발생:', error);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div style={styles.mainContainer}>
      <div style={styles.contentContainer}>
        {/* 통계 섹션 */}
        <div style={styles.statsSection}>
          <h2 style={styles.statsTitle}>창고관리</h2>
          <div style={styles.statsContainer}>
            <div 
              style={{...styles.statsCard, cursor: 'pointer'}} 
              onClick={() => window.location.href = 'http://34.64.211.3:3001/admin/contract-status'}
            >
              <div style={styles.statsCardTitle}>견적 내역</div>
              <div style={styles.statsValue}>{statistics.totalContracts}</div>
              <div style={styles.statsSubtitle}>총 견적 건수</div>
            </div>
            <div 
              style={{...styles.statsCard, cursor: 'pointer'}} 
              onClick={() => window.location.href = 'http://34.64.211.3:3001/admin/inbound-status-detail'}
            >
              <div style={styles.statsCardTitle}>입고 내역</div>
              <div style={styles.statsValue}>{statistics.totalProducts}</div>
              <div style={styles.statsSubtitle}>총 입고 완료 건수</div>
            </div>
            <div 
              style={{...styles.statsCard, cursor: 'pointer'}} 
              onClick={() => window.location.href = 'http://34.64.211.3:3002/admin/OutboundStatus'}
            >
              <div style={styles.statsCardTitle}>출고 내역</div>
              <div style={styles.statsValue}>{statistics.totalInquiries}</div>
              <div style={styles.statsSubtitle}>총 출고 완료 건수</div>
            </div>
            <div style={styles.statsCard}>
              <div style={styles.statsCardTitle}>총 계약 금액</div>
              <div style={styles.statsValue}>{statistics.totalRevenue}</div>
              <div style={styles.statsSubtitle}>전체 계약 금액 합계</div>
            </div>
          </div>
        </div>

        {/* 차트와 공지사항/문의사항 영역 */}
        <div style={{ display: "flex", gap: "30px", marginBottom: "20px" }}>
          {/* 차트 영역 */}
          <div style={styles.chartSection}>
            <div style={styles.chartTitle}>창고 현황 통계</div>
            <div style={styles.chartContainer}>
              <Bar 
                data={{
                  labels: ['입고 현황', '출고 현황', '계약 현황'],
                  datasets: [
                    {
                      label: '입고 완료',
                      data: [storageStatus.inboundComplete || 0, 0, 0],
                      backgroundColor: '#FF6384',
                    },
                    {
                      label: '입고 준비',
                      data: [storageStatus.inboundReady || 0, 0, 0],
                      backgroundColor: '#36A2EB',
                    },
                    {
                      label: '출고 요청',
                      data: [0, storageStatus.outboundRequest || 0, 0],
                      backgroundColor: '#4BC0C0',
                    },
                    {
                      label: '출고 완료',
                      data: [0, storageStatus.outboundComplete || 0, 0],
                      backgroundColor: '#FFCE56',
                    },
                    {
                      label: '계약 대기',
                      data: [0, 0, storageStatus.contractWaiting || 0],
                      backgroundColor: '#9966FF',
                    },
                    {
                      label: '계약 완료',
                      data: [0, 0, storageStatus.contractComplete || 0],
                      backgroundColor: '#FF9F40',
                    }
                  ]
                }}
                options={chartOptions}
              />
            </div>
          </div>

          {/* 공지사항/문의사항 영역 */}
          <div style={styles.noticeInquirySection}>
            <div style={styles.sideSection}>
              <div style={styles.sectionTitle}>공지사항</div>
              <ul style={styles.list}>
                {notices.slice(0, 3).map(notice => (
                  <li key={notice.id} style={styles.listItem}>
                    <span 
                      onClick={() => handleItemClick(notice, 'notice')}
                      style={styles.title}
                    >
                      {notice.title}
                    </span>
                    <span style={styles.date}>{notice.date}</span>
                  </li>
                ))}
              </ul>
              <button 
                style={styles.moreButton}
                onClick={() => window.location.href = 'http://34.47.73.162:3000/admin/Notices'}
              >
                더보기
              </button>
            </div>
            <div style={styles.sideSection}>
              <div style={styles.sectionTitle}>문의사항</div>
              <ul style={styles.list}>
                {Array.isArray(inquiries) && inquiries.slice(0, 3).map(inquiry => (
                  <li key={inquiry.id} style={styles.listItem}>
                    <span 
                      onClick={() => handleItemClick(inquiry, 'inquiry')}
                      style={styles.title}
                    >
                      {inquiry.title}
                    </span>
                    <span style={styles.date}>{inquiry.date}</span>
                  </li>
                ))}
              </ul>
              <button 
                style={styles.moreButton}
                onClick={() => window.location.href = 'http://34.47.73.162:3000/admin/Inquiries'}
              >
                더보기
              </button>
            </div>
          </div>
        </div>

        {/* Modal 추가 */}
        <Modal
          open={modalOpen}
          onClose={handleCloseModal}
          aria-labelledby="modal-title"
        >
          <Box sx={styles.modal}>
            <Typography id="modal-title" variant="h6" component="h2">
              {selectedItem?.title}
            </Typography>
            <Typography sx={{ mt: 2 }} color="text.secondary">
              {selectedItem?.type === 'notice' ? `작성자: ${selectedItem.author}` : 
               selectedItem?.type === 'inquiry' ? `작성자: ${selectedItem.author_email}` : ''}
            </Typography>
            <Typography sx={{ mt: 2 }}>
              {selectedItem?.content}
            </Typography>
            <Typography sx={{ mt: 2 }} color="text.secondary">
              작성일: {selectedItem?.date}
            </Typography>
          </Box>
        </Modal>

        {/* AG Grid 섹션 */}
        <div style={styles.gridContainer}>
          <h3>최근 계약 현황</h3>
          <div className="ag-theme-alpine" style={styles.grid}>
            <AgGridReact
              columnDefs={columnDefs}
              rowData={gridData}
              pagination={true}
              paginationPageSize={10}
            />
          </div>
        </div>
        

      </div>
    </div>
  );
};


const styles = {
  mainContainer: {
    backgroundColor: '#f5f5f5',
    padding: '20px',
  },
  contentContainer: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '20px',
  },
  statsSection: {
    backgroundColor: '#6f47c5',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '20px',
  },
  statsTitle: {
    color: 'white',
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px'
  },
  statsContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  statsCardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '10px'
  },
  statsValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#6f47c5',
    marginBottom: '5px',
  },
  statsSubtitle: {
    fontSize: '12px',
    color: '#999',
  },
  chartsContainer: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
  },
  chartBox: {
    flex: 1,
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid rgba(0,0,0,0.1)',
    height: '600px',
  },
  gridContainer: {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid rgba(0,0,0,0.1)',
  },
  grid: {
    height: '500px',
    width: '100%',
  },
  noticeContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  noticeBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid rgba(0,0,0,0.1)',
  },
  list: {
    listStyleType: 'none',
    padding: 0,
  },
  listItem: {
    marginBottom: '10px',
  },
  title: {
    fontWeight: 'bold',
  },
  date: {
    color: '#999',
  },
  chartSection: {
    flex: "2",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    padding: "20px",
    border: "1px solid #e0e0e0",
  },
  chartContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    height: "100%",

  },
  chartTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "2px solid #6f47c5"
  },
  chartSubTitle: {
    fontSize: "16px",
    fontWeight: "500",
    color: "#666",
    marginBottom: "20px"
  },
  noticeInquirySection: {
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  sideSection: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    border: "1px solid #e0e0e0"
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "2px solid #6f47c5"
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    overflowY: "auto",
    flex: 1
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #eee",
    alignItems: "center",
    transition: "background-color 0.2s"
  },
  title: {
    cursor: "pointer",
    color: "#333",
    flex: 1,
    paddingRight: "15px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    transition: "color 0.2s",
    '&:hover': {
      color: "#6f47c5"
    }
  },
  date: {
    color: "#666",
    fontSize: "0.9em",
    whiteSpace: "nowrap"
  },
  modal: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
    borderRadius: '8px',
    maxHeight: '80vh',
    overflowY: 'auto'
  },
  gptSection: {
    marginTop: '20px',
  },
  gptInput: {
    width: '100%',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '5px',
    border: '1px solid #ddd',
  },
  gptButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    backgroundColor: '#6f47c5',
    color: 'white',
    cursor: 'pointer',
  },
  gptResponse: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#f9f9f9',
    borderRadius: '5px',
    border: '1px solid #ddd',
  },
  responseSection: {
    marginTop: "20px",
    padding: "20px",
    backgroundColor: "white",
    borderRadius: "10px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  moreButton: {
    alignSelf: "flex-end",
    marginTop: "10px",
    padding: "6px 14px",
    fontSize: "14px",
    fontWeight: "500",
    color: "white",
    backgroundColor: "#6f47c5",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    transition: "background-color 0.2s ease",
    display: "inline-block",
    width: "100%", // 박스 전체 너비
  },

};

export default ManagerMainPage;