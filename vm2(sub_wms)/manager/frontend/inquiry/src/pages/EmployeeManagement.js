import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../components/EmployeeManagement.css';

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]); // 사원 목록 상태
  const [selectedEmployee, setSelectedEmployee] = useState(null); // 선택된 사원 상태
  const [isModalOpen, setIsModalOpen] = useState(false); // 모달 열림/닫힘 상태
  const [isEditing, setIsEditing] = useState(false); // 수정 모드 상태
  const [editForm, setEditForm] = useState({}); // 수정할 사원 정보 상태

  const API_URL = process.env.REACT_APP_API_URL || 'http://34.47.73.162:5002'; // API URL 설정

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/employees`);
        console.log('API 응답:', response.data);

        const formattedEmployees = response.data.map(employee => ({
          id: employee[0],
          username: employee[1],
          email: employee[2],
          employee_id: employee[3] || "N/A",
          phone_number: employee[4],
          address: employee[5],
          created_at: new Date(employee[6]).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }),
          department: employee[7] || "N/A",
          position: employee[8] || "N/A",
          salary: employee[9] || "N/A",
        }));

        setEmployees(formattedEmployees);
      } catch (error) {
        console.error('직원 데이터를 가져오는 데 실패했습니다:', error);
      }
    };

    fetchEmployees();
  }, [API_URL]);

  const handleEmployeeClick = (id) => {
    if (selectedEmployee && selectedEmployee.id === id) {
      setIsModalOpen(!isModalOpen);
    } else {
      const employee = employees.find((emp) => emp.id === id);
      setSelectedEmployee(employee);
      setIsModalOpen(true);
      setIsEditing(false); // 수정 모드 해제
    }
  };

  const handleDelete = async (employeeId) => {
  // 사용자에게 삭제 확인 메시지 출력
  const confirmDelete = window.confirm("정말로 삭제하시겠습니까?");
  
  if (!confirmDelete) {
    return; // 사용자가 취소를 누른 경우 함수 종료
  }

  try {
    // 삭제 요청 전송
    await axios.delete(`${API_URL}/api/employees/${employeeId}`);
    setEmployees(employees.filter(emp => emp.id !== employeeId));
    setIsModalOpen(false); // 모달 닫기
  } catch (error) {
    console.error('직원을 삭제하는 데 실패했습니다:', error);
  }
};


  const handleEditClick = () => {
    setIsEditing(true);
    setEditForm({ ...selectedEmployee });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveEdit = async () => {
    try {
      await axios.put(`${API_URL}/api/employees/${editForm.id}`, editForm);
      setEmployees((prev) => prev.map((emp) => (emp.id === editForm.id ? editForm : emp)));
      setSelectedEmployee(editForm);
      setIsEditing(false);
    } catch (error) {
      console.error('직원 수정에 실패했습니다:', error);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
  };

  const handleOutsideClick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal();
    }
  };

  return (
    <div className="main-container">
      <div className="employee-list-container">
        <h2>사원 목록</h2>
        <table>
          <thead>
            <tr>
              <th>순서</th>
              <th>이름</th>
              <th>이메일</th>
              <th>전화번호</th>
              <th>입사일</th>
              <th>부서</th>
              <th>직책</th>
              <th>연봉</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, index) => (
              <tr key={employee.id} onClick={() => handleEmployeeClick(employee.id)}>
                <td>{index + 1}</td>
                <td>{employee.username}</td>
                <td>{employee.email}</td>
                <td>{employee.phone_number}</td>
                <td>{employee.created_at}</td>
                <td>{employee.department}</td>
                <td>{employee.position}</td>
                <td>{employee.salary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedEmployee && (
        <div className="modal-overlay" onClick={handleOutsideClick}>
          <div className="employee-detail-container" onClick={(e) => e.stopPropagation()}>
            {isEditing ? (
              <>
                <h2>사원 수정</h2>
                <form>
                  <div>
                    <label>이름:</label>
                    <input
                      type="text"
                      name="username"
                      value={editForm.username}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div>
                    <label>이메일:</label>
                    <input
                      type="email"
                      name="email"
                      value={editForm.email}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div>
                    <label>사원번호:</label>
                    <input
                      type="text"
                      name="employee_id"
                      value={editForm.employee_id}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div>
                    <label>전화번호:</label>
                    <input
                      type="text"
                      name="phone_number"
                      value={editForm.phone_number}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div>
                    <label>주소:</label>
                    <input
                      type="text"
                      name="address"
                      value={editForm.address}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div>
                    <label>부서:</label>
                    <input
                      type="text"
                      name="department"
                      value={editForm.department}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div>
                    <label>직책:</label>
                    <input
                      type="text"
                      name="position"
                      value={editForm.position}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div>
                    <label>연봉:</label>
                    <input
                      type="text"
                      name="salary"
                      value={editForm.salary}
                      onChange={handleEditChange}
                    />
                  </div>
                  <div className="button-container">
                    <button className="add-button" onClick={handleSaveEdit}>저장</button>
                    <button className="delete-button" onClick={() => setIsEditing(false)}>취소</button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2>사원 상세정보</h2>
                <p><label>이름:</label> {selectedEmployee.username}</p>
                <p><label>이메일:</label> {selectedEmployee.email}</p>
                <p><label>사원번호:</label> {selectedEmployee.employee_id || "N/A"}</p>
                <p><label>전화번호:</label> {selectedEmployee.phone_number}</p>
                <p><label>주소:</label> {selectedEmployee.address || "N/A"}</p>
                <p><label>부서:</label> {selectedEmployee.department}</p>
                <p><label>직책:</label> {selectedEmployee.position}</p>
                <p><label>연봉:</label> {selectedEmployee.salary || "N/A"}</p>

                <div className="button-container">
                  <button className="add-button" onClick={handleEditClick}>수정하기</button>
                  <button className="delete-button" onClick={() => handleDelete(selectedEmployee.id)}>삭제하기</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
