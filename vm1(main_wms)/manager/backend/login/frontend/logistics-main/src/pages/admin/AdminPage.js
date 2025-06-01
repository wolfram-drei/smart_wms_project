import React, { useState, useEffect } from "react";
import API from "../../api/axiosInstance";
import "./AdminPage.css"; // 스크롤, 박스 스타일 포함

const AdminPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterRole, setFilterRole] = useState("all");

    const [selectedEmails, setSelectedEmails] = useState([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await API.get("/admin/users");
            setUsers(response.data);
        } catch (error) {
            setError("사용자 목록을 가져오는 데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = (email, newRole) => {
        API.put(`/admin/users/${email}`, { role: newRole })
        .then(() => {
            setUsers((prev) =>
                prev.map((user) =>
                    user.email === email ? { ...user, role: newRole } : user
                )
            );
        })
        .catch(() => {
            setError("권한 변경에 실패했습니다.");
        });
    };

    const handleDeleteUser = (email) => {
        if (window.confirm("정말 이 사용자를 삭제하시겠습니까?")) {
            API.delete(`/admin/users/${email}`)
            .then(() => {
                setUsers((prev) => prev.filter((user) => user.email !== email));
            })
            .catch(() => {
                setError("사용자 삭제에 실패했습니다.");
            });
        }
    };

    const handleSearchInputChange = (e) => {
        setSearchInput(e.target.value);
    };

    const handleSearchClick = () => {
        setSearchTerm(searchInput);
    };

    const handleFilterChange = (e) => {
        setFilterRole(e.target.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearchClick();    // ✅ 함수명 수정
        }
    };

    const handleCheckboxChange = (email) => {
        setSelectedEmails((prev) =>
            prev.includes(email)
                ? prev.filter((e) => e !== email)
                : [...prev, email]
        );
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedEmails(filteredUsers.map((user) => user.email));
        } else {
            setSelectedEmails([]);
        }
    };

    const handleDownloadCSV = () => {
        const selectedData = users.filter((user) =>
            selectedEmails.includes(user.email)
        );

        const headers = [
            "이메일", "이름", "연락처", "주소", "상세주소", "역할", "가입일", "상태"
        ];
        const rows = selectedData.map((user) => [
            user.email,
            user.username,
            user.phoneNumber,
            user.address,
            user.details,
            user.role,
            user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-",
            user.status,
        ]);

        const csvContent = [headers, ...rows]
        .map((row) => row.join(","))
        .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "selected_users.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredUsers = users.filter((user) => {
        const matchesSearch =
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.username.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRole =
            filterRole === "all" || user.role === filterRole;

        return matchesSearch && matchesRole;
    });

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div>
            <h1>관리자 페이지</h1>

            <div className="search-filter-box">
                <input
                    type="text"
                    placeholder="이름, 이메일, 연락처 검색"
                    value={searchInput}
                    onChange={handleSearchInputChange}
                    onKeyDown={handleKeyDown}
                />
                <button onClick={handleSearchClick}>검색</button>

                <select value={filterRole} onChange={handleFilterChange}>
                    <option value="all">전체</option>
                    <option value="user">일반 사용자</option>
                    <option value="admin">관리자</option>
                </select>
            </div>

            <div className="user-table-wrapper">
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                    <button
                        onClick={handleDownloadCSV}
                        disabled={selectedEmails.length === 0}
                    >
                        선택된 사용자 CSV 다운로드
                    </button>
                </div>
                <table>
                    <thead>
                    <tr>
                        <th>
                            <input
                                type="checkbox"
                                onChange={handleSelectAll}
                                checked={selectedEmails.length === filteredUsers.length}
                            />
                        </th>
                        <th>이메일</th>
                        <th>이름</th>
                        <th>연락처</th>
                        <th>주소</th>
                        <th>상세주소</th>
                        <th>역할</th>
                        <th>가입일</th>
                        <th>상태</th>
                        <th>권한 변경</th>
                        <th>삭제</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredUsers.map((user) => (
                        <tr key={user.email}>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={selectedEmails.includes(user.email)}
                                    onChange={() => handleCheckboxChange(user.email)}
                                />
                            </td>
                            <td>{user.email}</td>
                            <td>{user.username}</td>
                            <td>{user.phoneNumber}</td>
                            <td>{user.address}</td>
                            <td>{user.details}</td>
                            <td>{user.role}</td>
                            <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</td>
                            <td>{user.status}</td>
                            <td>
                                <select
                                    value={user.role}
                                    onChange={(e) => handleRoleChange(user.email, e.target.value)}
                                >
                                    <option value="user">일반 사용자</option>
                                    <option value="admin">관리자</option>
                                </select>
                            </td>
                            <td>
                                <button onClick={() => handleDeleteUser(user.email)} style={{ color: "red" }}>
                                    삭제
                                </button>

                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminPage;
