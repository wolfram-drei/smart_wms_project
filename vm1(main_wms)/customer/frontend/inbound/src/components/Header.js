import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Header = () => {
  // 로그인 상태
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // 사용자 정보: 회사명, 사용자 이름, 이미지
  const [companyName, setCompanyName] = useState("예제 회사");
  const [userName, setUserName] = useState("");
  const [userImage, setUserImage] = useState("https://via.placeholder.com/40");

  // 호버 상태
  const [isHovered, setIsHovered] = useState(false);

  // 헤더 검색(질문) 관련 상태
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    // body/html 기본 여백 제거
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    window.scrollTo(0, 0);

    // (1) 세션/스토리지에서 이메일 가져오기
    const email = sessionStorage.getItem("userEmail");
    if (email) {
      // (2) 백엔드에서 사용자 정보 가져오기 (회사명, 이미지 등)
      fetch(`/api/user/profile?email=${email}`)
        .then((response) => response.json())
        .then((data) => {
          if (data) {
            // 예: data.companyName, data.userName, data.imageUrl 등
            if (data.companyName) setCompanyName(data.companyName);
            if (data.userName) setUserName(data.userName);
            if (data.imageUrl) {
              setUserImage(data.imageUrl);
            }
          }
        })
        .catch((error) => {
          console.error("사용자 정보 로드 실패:", error);
        });
    } else {
      // 이메일이 없으면 (로그인 X)라고 가정
      setIsLoggedIn(false);
    }
  }, []);

  // "나의 정보" 페이지 이동
  const handleMyInfoClick = () => {
    navigate("/my-info");
  };

  /**
   * 헤더에서 검색(질문) 시
   * 1) Flask 서버로 POST /api/query
   * 2) 응답(JSON)을 팝업 창("http://34.22.94.64:3000/analysis-popup")에 postMessage로 전달
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert("검색어를 입력해주세요!");
      return;
    }

    try {
      // Flask 서버(34.22.94.64:5000)에 POST
      const response = await fetch("http://34.64.211.3:5000/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error("서버와의 통신에 실패했습니다.");
      }

      const result = await response.json();
      console.log("백엔드 응답 데이터:", result);

      // 팝업 열기
      const popupWidth = 1000;
      const popupHeight = 800;
      const left = (window.screen.width - popupWidth) / 2;
      const top = (window.screen.height - popupHeight) / 2;

      // 서버 B (34.22.94.64:3000)에 /analysis-popup 라우트가 있다고 가정
      const popupUrl = "http://34.64.211.3:3000/analysis-popup";
      const popup = window.open(
        popupUrl,
        "_blank",
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top}`
      );

      if (popup) {
        popup.onload = () => {
          // 팝업 창에 postMessage로 응답 데이터 전달
          popup.postMessage(result, "*");
        };
      }
    } catch (error) {
      console.error("에러 발생:", error);
      alert("데이터를 불러오는 데 실패했습니다.");
    }
  };

  return (
    <header style={styles.header}>
      {/* 검색창 */}
      <div style={styles.searchBarContainer}>
        <input
          type="text"
          placeholder="검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchBar}
        />
        <button onClick={handleSearch} style={styles.searchButton}>
          검색
        </button>
      </div>

      {/* 우측 프로필 영역 */}
      <div style={styles.rightSection}>
        {isLoggedIn ? (
          <div style={styles.profileContainer} onClick={handleMyInfoClick}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: "bold",
                color: isHovered ? "black" : "gray",
                transition: "color 0.3s ease",
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {companyName}
            </span>
            <img src={userImage} alt="사용자" style={styles.userImage} />
          </div>
        ) : (
          <div style={styles.profileContainer}>
            <span style={{ color: "gray" }}>로그인해주세요</span>
          </div>
        )}
      </div>
    </header>
  );
};

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "2px 10px",
    backgroundColor: "#ffffff",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    height: "45px",
  },
  searchBarContainer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    margin: "0 30px",
  },
  searchBar: {
    width: "40%",
    padding: "5px 12px",
    borderRadius: "10px",
    border: "1px solid #ccc",
    fontSize: "13px",
  },
  searchButton: {
    backgroundColor: "#6a1b9a",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    padding: "6px 12px",
    marginLeft: "10px",
    cursor: "pointer",
    fontSize: "13px",
  },
  rightSection: {
    display: "flex",
    justifyContent: "flex-end",
  },
  profileContainer: {
    width: "300px",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    cursor: "pointer",
    margin: "0 20px",
    backgroundColor: "#ffffff",
    padding: "5px 10px",
    gap: "10px",
  },
  userImage: {
    width: "35px",
    height: "35px",
    borderRadius: "10px",
    objectFit: "cover",
  },
};

export default Header;
