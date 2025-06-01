// CustomerMainPage.js
import { axios5010 } from '../api/axios';
import React, { useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import axios from 'axios';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const CustomerMainPage = () => {
  const [mainData, setMainData] = useState([]);
  const [statistics, setStatistics] = useState({
    totalItems: 0,
    totalCost: 0,
    statusCounts: {}
  });
  const [chartData, setChartData] = useState({
    inbound: { labels: [], data: [] },
    outbound: { labels: [], data: [] },
    contract: { labels: [], data: [] }
  });
  const [notices, setNotices] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const columnDefs = [
    { headerName: "번호", field: "id", width: 80, sortable: true, filter: true },
    { headerName: "상품명", field: "product_name", sortable: true, filter: true },
    { headerName: "상품번호", field: "product_number", sortable: true, filter: true },
    { headerName: "카테고리", field: "category", sortable: true, filter: true },
    { headerName: "보관 위치", field: "warehouse_location", sortable: true, filter: true },
    { headerName: "예상 비용", field: "total_cost", valueFormatter: params => params.value ? `${params.value.toLocaleString()}원` : '', sortable: true, filter: true },
    { headerName: "보관 타입", field: "warehouse_type", sortable: true, filter: true },
    { headerName: "입고 상태", field: "inbound_status", sortable: true, filter: true },
    { headerName: "입고일", field: "inbound_date", sortable: true, filter: true },
    { headerName: "출고 예정일", field: "outbound_date", sortable: true, filter: true },
    { headerName: "보관 기간", field: "storage_duration", valueFormatter: params => params.value ? `${params.value}일` : '', sortable: true, filter: true }
  ];

  // 공지사항과 문의사항을 가져오는 함수
  const fetchNoticesAndInquiries = async () => {
    try {
      const [noticesRes, inquiriesRes] = await Promise.all([
        axios.get('http://34.47.73.162:5000/api/notices'),
        axios.get('http://34.47.73.162:5088/api/inquiries')
      ]);

      console.log("📢 공지사항 응답:", noticesRes.data);
      console.log("📬 문의사항 응답:", inquiriesRes.data);
      
      setNotices(Array.isArray(noticesRes.data) ? noticesRes.data : []);
      setInquiries(Array.isArray(inquiriesRes.data?.inquiries) ? inquiriesRes.data.inquiries : []);
    } catch (error) {
      console.error('공지사항/문의사항 로딩 실패:', error);
    }
  };

  const processChartData = (items) => {
    // 입고 현황 데이터
    const inboundStatus = items.reduce((acc, item) => {
      const status = item.inbound_status || '미정';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // 출고 현황 데이터
    const outboundStatus = items.reduce((acc, item) => {
      const status = item.outbound_status || '출고 예정';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // 계약 현황 데이터 (계약일 기준으로 월별 집계)
    const contractStatus = items.reduce((acc, item) => {
      if (item.contract_date) {
        const month = new Date(item.contract_date).getMonth() + 1;
        const key = `${month}월`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});

    setChartData({
      inbound: {
        labels: Object.keys(inboundStatus),
        data: Object.values(inboundStatus)
      },
      outbound: {
        labels: Object.keys(outboundStatus),
        data: Object.values(outboundStatus)
      },
      contract: {
        labels: Object.keys(contractStatus),
        data: Object.values(contractStatus)
      }
    });
  };

  const fetchData = async () => {
    try {
      const response = await axios5010.get('http://34.64.211.3:5010/dashboard/storage-items', {
        withCredentials: true  // 쿠키 포함 요청
      });
      console.log('API 응답:', response.data);
      
      if (response.data && response.data.items) {
        setMainData(response.data.items);
        
        const stats = response.data.stats;
        setStatistics({
          totalItems: stats.total_items,
          totalCost: stats.total_cost || 0,
          statusCounts: stats.status_counts || {}
        });

        setChartData({
          inbound: {
            labels: ['입고 완료', '입고 준비'],
            data: [stats.status_counts.inbound_complete || 0, stats.status_counts.inbound_ready || 0]
          },
          outbound: {
            labels: ['출고 요청', '출고 완료'],
            data: [stats.status_counts.outbound_request || 0, stats.status_counts.outbound_complete || 0]
          },
          contract: {
            labels: ['계약 대기', '계약 완료'],
            data: [stats.status_counts.contract_waiting || 0, stats.status_counts.contract_complete || 0]
          }
        });
      }
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchNoticesAndInquiries();
  }, []); 
  

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        font: {
          size: 16
        }
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

  const handleItemClick = (item, type) => {
    setSelectedItem({ ...item, type });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", padding: "20px" }}>
      {/* 상단 통계 영역 */}
      <div style={{ backgroundColor: "#f5f5f5", marginBottom: "20px" }}>
        <div style={{
          backgroundColor: "#6f47c5",
          padding: "20px",
          borderRadius: "8px",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>창고 이용 현황</div>
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <div>보관중인 물품</div>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>{statistics.totalItems}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div>예상 정산금액</div>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                {statistics.totalCost.toLocaleString()}원
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 차트와 공지사항/문의사항 영역 */}
      <div style={{ display: "flex", gap: "30px", marginBottom: "20px" }}>
        {/* 차트 영역 */}
        <div style={styles.chartSection}>
          <div style={styles.sectionTitle}>창고 현황 통계</div>
          <div style={styles.chartContainer}>
            <Bar 
              data={{
                labels: ['입고 현황', '출고 현황', '계약 현황'],
                datasets: [
                  {
                    label: '입고 완료',
                    data: [statistics.statusCounts.inbound_complete || 0, 0, 0],
                    backgroundColor: '#FF6384',
                  },
                  {
                    label: '입고 준비',
                    data: [statistics.statusCounts.inbound_ready || 0, 0, 0],
                    backgroundColor: '#36A2EB',
                  },
                  {
                    label: '출고 요청',
                    data: [0, statistics.statusCounts.outbound_request || 0, 0],
                    backgroundColor: '#4BC0C0',
                  },
                  {
                    label: '출고 완료',
                    data: [0, statistics.statusCounts.outbound_complete || 0, 0],
                    backgroundColor: '#FFCE56',
                  },
                  {
                    label: '계약 대기',
                    data: [0, 0, statistics.statusCounts.contract_waiting || 0],
                    backgroundColor: '#9966FF',
                  },
                  {
                    label: '계약 완료',
                    data: [0, 0, statistics.statusCounts.contract_complete || 0],
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
          {/* 공지사항 */}
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
                onClick={() => window.location.href = 'http://34.47.73.162:4000/user/Notices'}
              >
                더보기
              </button>
          </div>

          {/* 문의사항 */}
          <div style={styles.sideSection}>
            <div style={styles.sectionTitle}>문의사항</div>
            <ul style={styles.list}>
              {inquiries.slice(0, 3).map(inquiry => (
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
                onClick={() => window.location.href = 'http://34.47.73.162:4000/user/CustomerInquiries'}
              >
                더보기
              </button>
          </div>
        </div>
      </div>

      {/* 모달 */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
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

      {/* 테이블 영역 */}
      <div style={{ flex: 1, minHeight: "400px", marginBottom: "20px" }}>
        <h2 style={{ marginBottom: "10px" }}>보관중인 물품들</h2>
        <div className="ag-theme-alpine" style={{ height: "calc(100% - 40px)", width: "100%" }}>
          <AgGridReact
            rowData={mainData}
            columnDefs={columnDefs}
            pagination={true}
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 20, 50, 100]} // 10 추가
          />
          
        </div>
      </div>
    </div>
  );
};

const styles = {
  chartSection: {
    flex: "2",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    padding: "20px",
    border: "1px solid #e0e0e0"
  },
  noticeInquirySection: {
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "15px",
    paddingBottom: "10px",
    borderBottom: "2px solid #6f47c5"
  },
  chartContainer: {
    padding: "10px",
    height: "100%"
  },
  sideSection: {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    border: "1px solid #e0e0e0",
    height: "calc(50% - 10px)",  // 공지사항과 문의사항 높이 동일하게
    display: "flex",
    flexDirection: "column"
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    overflowY: "auto",
    flex: 1  // 남은 공간 모두 사용
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
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    overflowY: 'auto',
    position: 'relative',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
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

export default CustomerMainPage;
