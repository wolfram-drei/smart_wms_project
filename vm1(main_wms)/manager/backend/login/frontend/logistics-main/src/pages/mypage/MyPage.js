import React, { useEffect, useState } from "react";
import API from "../../api/axiosInstance";
import HeaderNav from "../../components/HeaderNav";
import UserInfoForm from "./UserInfoForm";
import PasswordChangeForm from "./PasswordChangeForm";
import "./MyPage.css";

const MyPage = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [mode, setMode] = useState("info");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const fetchUserInfo = async () => {
    try {
      const res = await API.get("/mypage");  // ✅ 변경됨
      setUserInfo(res.data);
      setFormData(res.data);
    } catch (err) {
      alert("사용자 정보를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async () => {
    try {
      await API.put("/mypage", formData);  // ✅ 변경됨
      alert("정보가 수정되었습니다.");
      setEditing(false);
      fetchUserInfo();
    } catch (err) {
      alert("정보 수정 실패");
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handlePasswordSubmit = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      await API.put("/mypage/password", passwordForm);  // ✅ 변경됨
      alert("비밀번호가 변경되었습니다.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMode("info");
    } catch (err) {
      alert("비밀번호 변경 실패");
    }
  };

  if (!userInfo) return <div>로딩 중...</div>;

  return (
      <>
        <HeaderNav />
        <div className="mypage-container">
          <h2>마이페이지</h2>
          {mode === "info" ? (
              <UserInfoForm
                  userInfo={userInfo}
                  formData={formData}
                  editing={editing}
                  onChange={handleChange}
                  onEdit={() => setEditing(true)}
                  onSubmit={handleSubmit}
                  onPasswordMode={() => setMode("password")}
              />
          ) : (
              <PasswordChangeForm
                  passwordForm={passwordForm}
                  onChange={handlePasswordChange}
                  onSubmit={handlePasswordSubmit}
                  onCancel={() => setMode("info")}
              />
          )}
        </div>
      </>
  );
};

export default MyPage;
