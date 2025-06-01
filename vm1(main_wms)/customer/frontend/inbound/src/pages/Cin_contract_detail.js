import React, { useEffect, useState } from 'react';

function CustomerDetail({ contract, isOpen, onClose, onContractUpdate }) {
  const [barcodeUrl, setBarcodeUrl] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [contractForm, setContractForm] = useState({
    title: '',
    content: '',
    terms: '',
    signature: ''
  });
  useEffect(() => {
    console.log('계약 정보:', contract);
    if (contract && (contract.contract_id || contract.id)) {
      const cid = contract.contract_id || contract.id; 
      setBarcodeUrl(`http://34.64.211.3:5012/barcode/${cid}.png`);
      fetchContractForm(cid);
    }
  }, [contract]);

  const fetchContractForm = async (cid) => {
    try {
      const response = await fetch(`http://34.64.211.3:5012/contract-form/${cid}`);
      if (response.ok) {
        const data = await response.json();
        console.log("받아온 계약서 데이터:", data); // 디버깅용
        
        // ContractForms 테이블의 데이터 설정
        setContractForm({
          title: data.title || '',
          content: data.content || '',
          terms: data.terms || '',
          signature: data.signature || ''
        });
      }
    } catch (error) {
      console.error('계약서 양식 로드 실패:', error);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const cid = contract.contract_id || contract.id;
    try {
      const response = await fetch(`http://34.64.211.3:5012/contract-form/${cid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contractForm),
      });
      if (response.ok) {
        const result = await response.json();
        alert('계약서가 저장되었습니다.');
        setBarcodeUrl(`http://34.64.211.3:5012/barcode/${cid}`);
  
        // 👇 저장 후, contract 최신 데이터 다시 불러오기
        if (onContractUpdate) {
          onContractUpdate();  // 부모 컴포넌트가 최신 contract 받아서 내려줌
        }
  
        setCurrentPage(2);
      }
    } catch (error) {
      console.error('계약서 저장 실패:', error);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`http://34.64.211.3:5012/approve-contract/${contract.id}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        alert(error.message || "계약 승인 중 오류가 발생했습니다.");
        return;
      }
      
      const result = await response.json();
      alert(result.message);
      
      // 부모 컴포넌트의 데이터 갱신을 위한 콜백
      if (onContractUpdate) {
        onContractUpdate();
      }
    } catch (error) {
      console.error("계약 승인 실패:", error);
      alert("계약 승인 중 오류가 발생했습니다.");
    }
  };

  const handleInputChange = (e) => {
    // 읽기전용이므로 더 이상 값 변경 X
    // 기존 코드 유지하지만 읽기전용이므로 실제 변화는 없음.
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClose();
  };

  if (!isOpen) return null;

  const cid = contract?.contract_id || contract?.id;

  return (
    <div style={styles.modal} onClick={handleClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button 
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            border: 'none',
            background: '#b794ff',
            borderRadius: '50%',
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
            style={currentPage === 1 ? styles.activePageButton : styles.pageButton}
            onClick={() => setCurrentPage(1)}
          >
            계약서
          </button>
          <button 
            style={currentPage === 2 ? styles.activePageButton : styles.pageButton}
            onClick={() => setCurrentPage(2)}
          >
            계약 상세정보
          </button>
        </div>

        {currentPage === 1 && (
        <form onSubmit={handleFormSubmit}>
          <div style={{ maxWidth: '1300px', height: 'calc(100vh - 200px)', margin: '0 auto', overflow: 'auto' }}>
            <h2 style={{...styles.sectionTitleStyle}}>견적확인 및 계약서 작성</h2>
            <div style={{ display: 'flex', gap: '40px', height: '550px', alignItems: 'flex-start', marginTop: '20px', justifyContent: 'center' }}>
              {/* 오른쪽: 견적서 미리보기 */}
              <div style={{ flex: 1, maxWidth: '300px', overflow: 'auto' }}>
                <h4 style={{ color: '#6f47c5', fontWeight: 'bold', marginBottom: '10px' }}>견적서 정보</h4>
                 <table style={{  width: '100%', height: '70%', borderCollapse: 'collapse', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
                  <tbody>
                    {[
                      ['발행일', new Date().toLocaleDateString('ko-KR')],
                      ['회사명', contract?.company_name],
                      ['상품명', contract?.product_name],
                      ['입고수량', `${contract?.inbound_quantity} 개`],
                      ['무게', `${contract?.weight} kg`],
                      ['제품번호', contract?.product_number],
                      ['창고위치', contract?.warehouse_location],
                      ['창고타입', contract?.warehouse_type],
                      ['입고일', contract?.subscription_inbound_date],
                      ['출고일', contract?.outbound_date],
                      ['보관기간', `${contract?.storage_duration} 일`],
                      ['팔레트 크기', contract?.pallet_size],
                      ['팔레트 수', `${contract?.pallet_num} 개`],
                      ['총 비용', `${contract?.total_cost} 원`]
                    ].map(([label, value], index) => (
                      <tr key={index}>
                      <td style={{ padding: '8px 14px', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#f4f1fb', width: '40%', textAlign: 'left', color: '#5a3ea1' }}>{label}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'left', fontSize: '12px' }}>{value || 'N/A'}</td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* 왼쪽: 계약서 입력 */}
              <div style={{ flex: 1, maxWidth: '300px', overflow: 'auto' }}>
              <h4 style={{ color: '#6f47c5', fontWeight: 'bold', marginBottom: '10px' }}>계약서 세부내용</h4>
              <table style={{...styles.table, height: '85%'}}>
                  <tbody>
                    <tr style={styles.clickableRow}>
                      <td colSpan={2}>
                        <input
                          type="text"
                          value={contractForm.title}
                          placeholder="계약 제목"
                          readOnly
                          onChange={(e) => setContractForm(prev => ({ ...prev, title: e.target.value }))}
                          style={styles.fullWidthInput(false)}
                        />
                      </td>
                    </tr>

                    <tr style={styles.clickableRow}>
                      <td colSpan={2}>
                        <textarea
                          value={contractForm.content}
                          placeholder="계약 내용"
                          readOnly
                          onChange={(e) => setContractForm(prev => ({ ...prev, content: e.target.value }))}
                          style={styles.fullWidthTextarea(false)}
                        />
                      </td>
                    </tr>

                    <tr style={styles.clickableRow}>
                      <td colSpan={2}>
                        <input
                          type="text"
                          value={contractForm.signature}
                          placeholder="서명자 이름"
                          readOnly
                          onChange={(e) => setContractForm(prev => ({ ...prev, signature: e.target.value }))}
                          style={styles.fullWidthInput(false)}
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
              gap: '10px'
            }}>
              <button type="button" onClick={handleApprove} style={{...styles.activePageButton, backgroundColor: '#6f47c5' }}>계약 승인</button>
              <button onClick={handlePrint} style={styles.pageButton}>출력</button>
            </div>
          </div>
          </form>
        )}

        {currentPage === 2 && (
            <>
            <div style={{ maxWidth: '1300px', height: 'calc(100vh - 220px)', margin: '0 auto', overflow: 'auto' }}>
              <h2 style={{...styles.sectionTitleStyle}}>계약 상세 정보</h2>
              <div style={{ display: 'flex', gap: '40px', height: '550px', alignItems: 'flex-start', marginTop: '20px', justifyContent: 'center' }}>
                {/* 왼쪽: 계약 정보 테이블 */}
                <div style={{ flex: 1, maxWidth: '300px', height: '100%', overflow: 'auto' }}>
                <h4 style={{ color: '#6f47c5', fontWeight: 'bold' }}>계약 정보</h4>
                <table style={{ width: '100%', height: '80%', borderCollapse: 'collapse', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={styles.cellHeaderStyle}>계약 ID</td>
                      <td style={styles.cellBodyStyle}>{contract?.id}</td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>회사</td>
                      <td style={styles.cellBodyStyle}>{contract?.company_name}</td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>담당자</td>
                      <td style={styles.cellBodyStyle}>{contract?.contact_person}</td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>연락처</td>
                      <td style={styles.cellBodyStyle}>{contract?.contact_phone}</td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>상품명</td>
                      <td style={styles.cellBodyStyle}>{contract?.product_name}</td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>수량</td>
                      <td style={styles.cellBodyStyle}>{contract?.inbound_quantity}</td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>창고명</td>
                      <td style={styles.cellBodyStyle}>{contract?.warehouse_location || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>보관창고</td>
                      <td style={styles.cellBodyStyle}>{contract?.warehouse_type}</td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>창고위치</td>
                      <td style={styles.cellBodyStyle}>{contract?.warehouse_num || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>입고예정일</td>
                      <td style={styles.cellBodyStyle}>
                      {contract?.subscription_inbound_date
                        ? new Date(contract.subscription_inbound_date).toISOString().slice(0, 10)
                        : ''}
                      </td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>출고예정일</td>
                      <td style={styles.cellBodyStyle}>
                      {contract?.outbound_date
                        ? new Date(contract.outbound_date).toISOString().slice(0, 10)
                        : ''}
                      </td>
                    </tr>
                    <tr>
                      <td style={styles.cellHeaderStyle}>계약 날짜</td>
                      <td style={styles.cellBodyStyle}>{contract?.contract_date || '계약 대기'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ flex: 1, maxWidth: '300px',height: '100%', overflow: 'auto' }}>
              <h4 style={{ color: '#6f47c5', fontWeight: 'bold', marginBottom: '10px' }}>바코드</h4>
              {/* 오른쪽: 바코드 이미지 */}
                {barcodeUrl && (
                  <div style={{
                    height: '80%',
                    textAlign: 'center',
                    border: '1px solid #eee',
                    padding: '20px',
                    marginTop: '20px',
                    backgroundColor: '#fafafa'
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
              gap: '10px'
            }}>
              <button
                onClick={handlePrint}
                style={{
                  ...styles.pageButton,
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


export default CustomerDetail;

const styles = {
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    padding: '30px',
    borderRadius: '12px',
    height: '90%',
    width: '600px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    position: 'relative',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    border: 'none',
    background: '#b794ff',
    borderRadius: '50%',
    fontSize: '20px',
    cursor: 'pointer',
    color: 'white',
  },
  pageButton: {
    padding: '10px 20px',
    margin: '20px 5px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    backgroundColor: '#f0f0f0',
    color: '#333',
    fontSize: '14px',
    transition: 'all 0.3s ease',
  },
  activePageButton: {
    padding: '10px 20px',
    margin: '20px 5px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    backgroundColor: '#6f47c5',
    color: 'white',
    fontSize: '14px',
    transition: 'all 0.3s ease',
  },
  tableRow: {
    cursor: 'pointer',
    borderBottom: '1px solid #eee',
  },
  cellHeaderStyle:{
    border: '1px solid #e0dff3',
    padding: '10px 14px',
    fontWeight: 600,
    backgroundColor: '#f4f1fb',
    color: '#5a3ea1',
    width: '35%',
    fontSize: '13px',
    textAlign: 'left',
    borderRadius: '8px 0 0 8px',
  },
  cellBodyStyle: {
    border: '1px solid #e0dff3',
    padding: '10px 14px',
    backgroundColor: '#ffffff',
    fontSize: '12px',
    color: '#333',
    textAlign: 'left',
    borderRadius: '0 8px 8px 0',
  },
  smallTableHeader: {
    padding: '5px 10px',
    fontWeight: 'bold',
    backgroundColor: '#f4f1fb',
    width: '40%',
    textAlign: 'left',
    color: '#5a3ea1',
  },
  smallTableBody: {
    padding: '5px 10px',
    textAlign: 'left',
  },
  button: {
    padding: '10px 20px',
    margin: '10px 5px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    color: 'white',
    fontSize: '14px',
  },
  approveButton: {
    padding: '10px 20px',
    backgroundColor: '#6f47c5',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  printButton: {
    padding: '10px 20px',
    backgroundColor: '#b794ff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '20px',
  },
  barcodeContainer: {
    height: '500px',
    width: '35%',
    textAlign: 'center',
    border: '1px solid #eee',
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
  },
  fullWidthInput: (isEditable) => ({
    width: '100%',
    padding: '16px',
    border: 'none',
    backgroundColor: isEditable ? '#fff' : '#f3f3f3',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease-in-out',
    boxShadow: isEditable ? 'inset 0 0 0 1px #c1b2e0' : 'none'
  }),
  fullWidthTextarea: (isEditable) => ({
    width: '100%',
    height: '380px',
    padding: '16px',
    border: 'none',
    resize: 'none',
    backgroundColor: isEditable ? '#fff' : '#f3f3f3',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease-in-out',
    boxShadow: isEditable ? 'inset 0 0 0 1px #c1b2e0' : 'none'
  }),
  table: {
    width: '100%',
    height: '470px',
    tableLayout: 'fixed', // ✅ 고정 레이아웃
    backgroundColor: '#fff',
    borderCollapse: 'collapse',
    wordBreak: 'break-word' // ✅ 긴 텍스트도 줄 바꿈됨
  },
  clickableRow: {
    cursor: 'pointer',
    borderBottom: '1px solid #eee'
  },
  sectionTitleStyle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '20px',
    borderBottom: '2px solid #6f47c5',
    paddingBottom: '10px',
  },
};
