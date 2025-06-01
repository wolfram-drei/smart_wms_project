import React from 'react';
import '../components/Myinfo.css';

const Myinfo = () => {
  // 로그인한 사용자 정보를 서버에서 가져온다고 가정
  const userInfo = {
    name: '홍길동',
    id: '101',
    position: '팀장',
    department: '개발팀',
    contact: '010-1234-5678',
    address: '서울시 강남구',
    joiningDate: '2020-01-01',
    rank: '상무',
    salary: '5,000만원'
  };

  const handleEdit = () => {
    alert('수정 페이지로 이동합니다.');
    // 수정 페이지로 이동하도록 구현 (예: React Router 사용)
  };

  return (
    <div className="main-container">
      {/* 내 정보 컨테이너 */}
      <div className="my-info-container">
        <h2>내 정보</h2>
        <p>
          <label>이름:</label> {userInfo.name}
        </p>
        <p>
          <label>사원 ID:</label> {userInfo.id}
        </p>
        <p>
          <label>직책:</label> {userInfo.position}
        </p>
        <p>
          <label>부서:</label> {userInfo.department}
        </p>
        <p>
          <label>연락처:</label> {userInfo.contact}
        </p>
        <p>
          <label>주소:</label> {userInfo.address}
        </p>
        <p>
          <label>입사일:</label> {userInfo.joiningDate}
        </p>
        <p>
          <label>직급:</label> {userInfo.rank}
        </p>
        <p>
          <label>연봉:</label> {userInfo.salary}
        </p>
        <div className="button-container">
          <button className="edit-button" onClick={handleEdit}>
            수정하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default Myinfo;
