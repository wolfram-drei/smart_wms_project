import React, { useState, useEffect, useRef } from 'react';
import Min_estimate_calculator from './Min_estimate_calculator';
import { StorageMap } from './StorageMap'; // 가상의 StorageMap 컴포넌트

function Min_contract_state_detail({ contract, isOpen, onClose }) {
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const signatureRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [barcodeUrl, setBarcodeUrl] = useState('');
  const [contractForm, setContractForm] = useState({
    title: '',
    content: '',
    terms: '',
    signature: ''
  });
  const [isEditable, setIsEditable] = useState(true);
  const [isSaveEnabled, setIsSaveEnabled] = useState(true);

  const [selectedRowData, setSelectedRowData] = useState(null); // 선택된 행 데이터
  const [formData, setFormData] = useState({});                 // 실견적 계산용 form 상태
  const [activeFields, setActiveFields] = useState({});         // 수정 필드 추적용

  // 계약서 폼 데이터 가져오기
  const fetchContractForm = async (contractId) => {
    try {
      const response = await fetch(`http://34.64.211.3:5001/contract-status/${contractId}`);
      if (!response.ok) throw new Error('데이터 로드 실패');
      const data = await response.json();
      console.log("불러온 계약서 데이터:", data);
      
      if (data) {
        setContractForm({
          title: data.title || '',
          content: data.content || '',
          terms: data.terms || '',
          signature: data.signature || ''
        });
        // 👉 여기에 입고 관련 데이터도 state로 저장
        setSelectedRowData(data);  // 실견적 계산기 등에서 활용 
      }
    } catch (error) {
      console.error('계약서 폼 로드 실패:', error);
    }
  };

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (contract?.id) {
      setIsLoading(true);
      fetchContractForm(contract.id).finally(() => setIsLoading(false));
      setBarcodeUrl(`http://34.64.211.3:5001/barcode/${contract.id}.png`);
      console.log("계약데이터:", contract);
      setIsEditable(true);
      setIsSaveEnabled(true);
      }
  }, [contract]);

  const handleInputChange = (field, value) => {
    setContractForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const cid = contract.id;
  
    try {
      // 먼저 계약서 존재 여부 확인
      const checkRes = await fetch(`http://34.64.211.3:5001/contract-form/${cid}`, {
        credentials: "include",
      });
  
      let method = 'POST';
      if (checkRes.ok) {
        // 이미 존재하면 수정으로 간주
        method = 'POST'; // 이미 이 API는 update만 POST로 받는 구조라면 유지
      }
  
      const response = await fetch(`http://34.64.211.3:5001/contract-form/${cid}`, {
        credentials: "include",
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: contractForm.title,
          content: contractForm.content,
          terms: contractForm.terms,
          signature: contractForm.signature
        }),
      });
  
      if (!response.ok) {
        throw new Error('계약서 저장 실패');
      }
  
      alert('계약서가 저장되었습니다.');
      setIsEditable(false);
      setIsSaveEnabled(false);
  
    } catch (error) {
      console.error('계약서 저장 중 오류:', error);
      alert('계약서 저장 중 오류가 발생했습니다.');
    }
  };

  const handleClose = (e) => {
    if (e) e.preventDefault();
    onClose();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEdit = () => {
    setIsEditable(true);
    setIsSaveEnabled(true);
  };

  if (!isOpen) return null;

  // 스타일 정의
  const modalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const contentStyle = {
    backgroundColor: '#ffffff',
    padding: '30px',
    borderRadius: '12px',
    height: '80%',
    width: '90%', // 💡 기존 600px → 90% 로 확대
    maxWidth: '600px', // 💡 가운데 정렬 유지 + 반응형 지원
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    position: 'relative',
    textAlign: 'center',
  };


  const buttonStyle = {
    padding: '10px 20px',
    margin: '10px 5px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    color: 'white',
    fontSize: '14px',
  };

  const pageButtonStyle = {
    padding: '8px 16px',
    margin: '0 5px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: '#f0f0f0',
    color: '#333',
    fontSize: '14px',
    transition: 'all 0.3s ease'
  };

  const activePageStyle = {
    ...pageButtonStyle,
    backgroundColor: '#6f47c5',
    color: 'white'
  };

  const sectionTitleStyle = {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '20px',
    borderBottom: '2px solid #6f47c5',
    paddingBottom: '10px',
  };

  
  const cid = contract?.contract_id || contract?.id;

  return (
    <div style={modalStyle} onClick={handleClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <button 
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            border: 'none',
            borderRadius: '50%',
            background: '#b794ff',
            fontSize: '20px',
            cursor: 'pointer',
            color: 'white',
          }} 
          onClick={handleClose}
        >
          &times;
        </button>
        
        <div style={{ marginBottom: '10px', textAlign: 'center' }}>
          <button 
            style={currentPage === 1 ? activePageStyle : pageButtonStyle}
            onClick={() => setCurrentPage(1)}
          >
            실견적 계산기
          </button>
          <button 
            style={currentPage === 2 ? activePageStyle : pageButtonStyle}
            onClick={() => setCurrentPage(2)}
          >
            창고 현황
          </button>
          <button 
            style={currentPage === 3 ? activePageStyle : pageButtonStyle}
            onClick={() => setCurrentPage(3)}
          >
            계약서 작성
          </button>
          <button 
            style={currentPage === 4 ? activePageStyle : pageButtonStyle}
            onClick={() => setCurrentPage(4)}
          >
            계약 상세 정보
          </button>
        </div>

        {currentPage === 1 && (
          <div style={{ maxWidth: '1300px', height: 'calc(100vh - 200px)', margin: '0 auto', overflow: 'auto' }}>
          <h2 style={sectionTitleStyle}>실견적 계산하기</h2>
            <Min_estimate_calculator
            selectedRowData={selectedRowData}
            onUpdate={async (updated) => {
              try {
                const total = updated.total_cost ?? 0;  // ✅ 안전하게 총비용 가져오기
                const estimateText = `
                발행일: ${new Date().toLocaleDateString('ko-KR')}
                회사명: ${updated.company_name}
                상품명: ${updated.product_name}
                입고수량: ${updated.inbound_quantity} 개
                무게: ${updated.weight} kg
                제품번호: ${updated.product_number}
                창고위치: ${updated.warehouse_location}
                창고타입: ${updated.warehouse_type}
                입고일: ${updated.subscription_inbound_date}
                출고일: ${updated.outbound_date}
                보관기간: ${updated.storage_duration} 일
                팔레트크기: ${updated.pallet_size}
                팔레트개수: ${updated.pallet_num} 개
                총비용: ${updated.total} 원
                `;
                const dataToSend = {
                  ...updated,
                  estimate: estimateText,
                  total_cost: total,
                };

                await fetch(`http://34.64.211.3:5002/inbound-status/${contract.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(dataToSend),
                })

                setSelectedRowData((prev) => ({
                  ...prev,
                  ...updated,
                  total_cost: total,
                }));

                await fetchContractForm(contract.id);
          
                // 저장 성공 시, 계약서 상태도 업데이트
                setContractForm((prev) => ({
                  ...prev,
                  ...updated,
                  total_cost: total,
                }));
          
                alert("입고 정보 저장 성공!");
          
              } catch (err) {
                console.error("❌ 저장 실패:", err);
                alert("입고 정보 저장 중 오류가 발생했습니다.");
              }
            }}
            onClose={() => setCurrentPage(2)}
            />
          </div>
        )}

        {currentPage === 2 && (
          <div style={{ maxWidth: '1200px', height: 'calc(100vh - 300px)', margin: '0 auto', overflow: 'hidden' }}>
            <StorageMap />
          </div>
        )}

        {currentPage === 3 && (
          <form onSubmit={handleFormSubmit}>
          <div style={{ maxWidth: '1300px', height: 'calc(100vh - 200px)', margin: '0 auto', overflow: 'auto' }}>
          <h2 style={sectionTitleStyle}>견적확인 및 계약서 작성</h2>
          <div style={{ display: 'flex', gap: '40px', height: '550px', alignItems: 'flex-start', marginTop: '20px', justifyContent: 'center' }}>
            {/* 오른쪽: 견적서 미리보기 */}
            <div style={{ flex: 1, maxWidth: '300px', overflow: 'auto' }}>
              <h4 style={{ color: '#6f47c5', fontWeight: 'bold', marginBottom: '10px' }}>견적서 정보</h4>
              <table style={{  width: '100%', height: '70%', borderCollapse: 'collapse', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
                <tbody>
                  {[ 
                    ['발행일', new Date().toLocaleDateString('ko-KR')],
                    ['회사명', selectedRowData?.company_name],
                    ['상품명', selectedRowData?.product_name],
                    ['입고수량', `${selectedRowData?.inbound_quantity} 개`],
                    ['무게', `${selectedRowData?.weight} kg`],
                    ['제품번호', selectedRowData?.product_number],
                    ['창고위치', selectedRowData?.warehouse_location],
                    ['창고타입', selectedRowData?.warehouse_type],
                    ['입고일', selectedRowData?.subscription_inbound_date],
                    ['출고일', selectedRowData?.outbound_date],
                    ['보관기간', `${selectedRowData?.storage_duration} 일`],
                    ['팔레트 크기', selectedRowData?.pallet_size],
                    ['팔레트 수', `${selectedRowData?.pallet_num} 개`],
                    ['총 비용', `${selectedRowData?.total_cost} 원`]
                  ].map(([label, value], index) => (
                    <tr key={index}>
                      <td style={{ padding: '5px 10px', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#f4f1fb', width: '40%', textAlign: 'left', color: '#5a3ea1', }}>{label}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'left', fontSize: '12px' }}>{value || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 왼쪽: 계약 정보 입력 */}
            <div style={{ flex: 1, maxWidth: '300px', overflow: 'auto' }}>
            <h4 style={{ color: '#6f47c5', fontWeight: 'bold', marginBottom: '10px' }}>계약서 작성</h4>
            <table style={{...styles.table, height: '70%'}}>
              <tbody>
                <tr onClick={() => titleRef.current?.focus()} style={styles.clickableRow}>
                  <td colSpan={2}>
                    <input
                      ref={titleRef}
                      type="text"
                      value={contractForm.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="계약 제목을 입력하세요"
                      style={styles.fullWidthInput(isEditable)}
                      disabled={!isEditable}
                    />
                  </td>
                </tr>

                <tr onClick={() => contentRef.current?.focus()} style={styles.clickableRow}>
                  <td colSpan={2}>
                    <textarea
                      ref={contentRef}
                      value={contractForm.content}
                      onChange={(e) => handleInputChange('content', e.target.value)}
                      placeholder="계약 내용을 입력하세요"
                      style={styles.fullWidthTextarea(isEditable)}
                      disabled={!isEditable}
                    />
                  </td>
                </tr>

                <tr onClick={() => signatureRef.current?.focus()} style={styles.clickableRow}>
                  <td colSpan={2}>
                    <input
                      ref={signatureRef}
                      type="text"
                      value={contractForm.signature}
                      onChange={(e) => handleInputChange('signature', e.target.value)}
                      placeholder="서명자 이름을 입력하세요"
                      style={styles.fullWidthInput(isEditable)}
                      disabled={!isEditable}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>

            
            {/* 버튼 영역 */}
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '20px',
            }}>
              <button
                  type="submit"
                  style={{
                    ...buttonStyle,
                    backgroundColor: isSaveEnabled ? '#6f47c5' : '#cccccc',
                    cursor: isSaveEnabled ? 'pointer' : 'not-allowed'
                  }}
                  disabled={!isSaveEnabled}
                >
                  저장
              </button>
              <button
                type="button"
                onClick={handleEdit}
                style={{
                  ...buttonStyle,
                  backgroundColor: !isEditable ? '#6f47c5' : '#cccccc',
                  cursor: !isEditable ? 'pointer' : 'not-allowed'
                }}
                disabled={isEditable}
              >
                수정
              </button>
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#b794ff'
                }}
              >
                출력
              </button>
            </div>
            </div>
        </form>
        )}
        {currentPage === 4 && contract && (
          <>
          <div style={{ maxWidth: '1300px', height: 'calc(100vh - 220px)', margin: '0 auto', overflow: 'auto' }}>
            <h2 style={sectionTitleStyle}>계약 상세 정보</h2>
            <div style={{ display: 'flex', gap: '40px', height: '550px', alignItems: 'flex-start', marginTop: '20px', justifyContent: 'center' }}>
              {/* 왼쪽: 계약 정보 테이블 */}
              <div style={{ flex: 1, maxWidth: '300px', height: '100%', overflow: 'auto' }}>
              <h4 style={{ color: '#6f47c5', fontWeight: 'bold' }}>계약 정보</h4>
              <table style={{ width: '100%', height: '80%', borderCollapse: 'collapse', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
                <tbody>
                  <tr>
                    <td style={cellHeaderStyle}>계약 ID</td>
                    <td style={cellBodyStyle}>{contract?.id}</td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>회사명</td>
                    <td style={cellBodyStyle}>{contract?.company_name}</td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>계약 ID</td>
                    <td style={cellBodyStyle}>{contract?.id}</td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>상품명</td>
                    <td style={cellBodyStyle}>{contract?.product_name}</td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>수량</td>
                    <td style={cellBodyStyle}>{contract?.inbound_quantity}</td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>창고명</td>
                    <td style={cellBodyStyle}>{selectedRowData?.warehouse_location || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>보관창고</td>
                    <td style={cellBodyStyle}>{contract?.warehouse_type}</td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>창고위치</td>
                    <td style={cellBodyStyle}>{selectedRowData?.warehouse_num || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>입고예정일</td>
                    <td style={cellBodyStyle}>
                    {contract?.subscription_inbound_date
                      ? new Date(contract.subscription_inbound_date).toISOString().slice(0, 10)
                      : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>출고예정일</td>
                    <td style={cellBodyStyle}>
                    {contract?.outbound_date
                      ? new Date(contract.outbound_date).toISOString().slice(0, 10)
                      : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style={cellHeaderStyle}>계약 날짜</td>
                    <td style={cellBodyStyle}>{contract?.contract_date || '계약 대기'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ flex: 1, maxWidth: '300px',height: '100%', overflow: 'auto' }}>
            <h4 style={{ color: '#6f47c5', fontWeight: 'bold', marginBottom: '10px' }}>바코드</h4>
              {/* 오른쪽: 바코드 이미지 */}
              {barcodeUrl && (
                <div style={{
                  height: '73%',
                  textAlign: 'center',
                  border: '1px solid #eee',
                  padding: '20px',
                  marginTop: '20px',
                  backgroundColor: '#fafafa',
                }}>
                  <img 
                    src={barcodeUrl} 
                    alt="바코드" 
                    style={{ maxWidth: '200px' }}
                    onError={(e) => {
                      console.error('바코드 이미지 로드 실패');
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
          </div>
        </div>

        {/* 버튼 영역 */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '20px',
        }}>
          <button
            onClick={handlePrint}
            style={{
              ...buttonStyle,
              backgroundColor: '#b794ff'
            }}
          >
            출력
          </button>
        </div>
        </div>
        </>
      )}
    </div>
  </div>
  );
}

const cellHeaderStyle = {
  border: '1px solid #e0dff3',
  padding: '10px 14px',
  fontWeight: 600,
  backgroundColor: '#f4f1fb',
  color: '#5a3ea1',
  width: '35%',
  fontSize: '13px',
  textAlign: 'left',
};

const cellBodyStyle = {
  border: '1px solid #e0dff3',
  padding: '10px 14px',
  backgroundColor: '#ffffff',
  fontSize: '12px',
  color: '#333',
  textAlign: 'left',
};


export default Min_contract_state_detail;


// 🔽 컴포넌트 위쪽 또는 파일 맨 아래에 정의
const styles = {
  fullWidthInput: (isEditable) => ({
    width: '100%',
    padding: '16px',
    border: 'none',
    backgroundColor: isEditable ? '#fff' : '#f3f3f3',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    borderRadius: '6px',
    transition: 'all 0.2s ease-in-out',
    boxShadow: isEditable ? 'inset 0 0 0 1px #c1b2e0' : 'none'
  }),
  fullWidthTextarea: (isEditable) => ({
    width: '100%',
    height: '300px',
    padding: '16px',
    border: 'none',
    resize: 'none',
    backgroundColor: isEditable ? '#fff' : '#f3f3f3',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    borderRadius: '6px',
    transition: 'all 0.2s ease-in-out',
    boxShadow: isEditable ? 'inset 0 0 0 1px #c1b2e0' : 'none'
  }),
  table: {
    width: '100%',
    tableLayout: 'fixed', // ✅ 고정 레이아웃
    backgroundColor: '#fff',
    borderCollapse: 'collapse',
    wordBreak: 'break-word' // ✅ 긴 텍스트도 줄 바꿈됨
  },
  clickableRow: {
    cursor: 'pointer',
    borderBottom: '1px solid #eee'
  },
  wrapper: {
    flex: 1,
    width: '100%',
    overflowX: 'hidden' // ✅ X축 스크롤 제거
  }
};
