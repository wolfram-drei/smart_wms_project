import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // 페이지 이동을 위한 네비게이션

const Header = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(true); // 로그인 상태 (예시: true -> 로그인 상태)
  const [companyName, setCompanyName] = useState("예제 회사"); // 회사 이름
  const [userImage, setUserImage] = useState("https://via.placeholder.com/40"); // 사용자 이미지 (기본값)
  const navigate = useNavigate(); // 페이지 이동용 네비게이션
  const [isHovered, setIsHovered] = useState(false);

  //챗봇
  const [chatbotOpen, setChatbotOpen] = useState(false);

  const toggleChatbot = () => {
    setChatbotOpen(!chatbotOpen);
  };


  // body와 html의 기본 여백 제거
  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // 세션에서 이메일 가져오기 (예: localStorage나 쿠키를 사용)
    const email = sessionStorage.getItem("userEmail"); // 세션에서 이메일 가져오기

    if (email) {
      // 이메일을 기반으로 서버에서 이미지 URL 가져오기
      fetch(`/api/user/profile-image?email=${email}`)
        .then((response) => response.json())
        .then((data) => {
          if (data && data.imageUrl) {
            setUserImage(data.imageUrl); // 서버에서 받은 이미지 URL 설정
          } else {
            setUserImage("https://via.placeholder.com/40"); // 기본 이미지
          }
        })
        .catch((error) => {
          console.error("이미지 로드 실패:", error);
          setUserImage("https://via.placeholder.com/40"); // 기본 이미지
        });
    } else {
      setUserImage("https://via.placeholder.com/40"); // 기본 이미지
    }
  }, []);

  // "나의 정보" 페이지로 이동
  const handleMyInfoClick = () => {
    navigate("/my-info");
  };

  return (
    <>
      <header style={styles.header}>
        <div style={styles.searchBarContainer}>
          <input type="text" placeholder="검색..." style={styles.searchBar} />
        </div>

        <div style={styles.rightSection}>
          <button style={styles.chatbotButton} onClick={toggleChatbot}>
            챗봇
          </button>

          {isLoggedIn && (
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
              {userImage && (
                <img src={userImage} alt="사용자" style={styles.userImage} />
              )}
            </div>
          )}
        </div>
      </header>

      {/* 챗봇 iframe 창 */}
      {chatbotOpen && (
        <div style={styles.chatbotWrapper}>
          <iframe
            src="/chatbot"
            title="Chatbot"
            style={styles.chatbotIframe}
          />
        </div>
      )}
    </>
  );
};


const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "2px 10px",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    height: "45px",
  },
  searchBarContainer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    margin:"0 30px"
  },
  searchBar: {
    width: "40%",
    padding: "5px 12px",
    borderRadius: "10px",
    border: "1px solid #ccc",
    fontSize: "13px",
  },
  rightSection: {
    display: "flex",
    justifyContent: "flex-end", // 우측 정렬
  },
  profileContainer: {
    width:"300px",
    display: "flex",
    justifyContent: "flex-end", // 우측 정렬
    alignItems: "center", // 수직 정렬
    cursor: "pointer",
    margin: "0 20px",
    backgroundColor: "#FFFFF",
    padding: "5px 10px",
    gap:"10px",
    
  },
  userImage: {
    width: "35px",
    height: "35px",
    borderRadius: "10px",
    objectFit: "cover",
  },
  companyName: {
    marginRight: "30px", // 텍스트와 이미지 사이 간격
    fontSize: "13px",
    fontWeight: "bold",
    color: "gray",
    whiteSpace: "nowrap", // 텍스트 줄바꿈 방지
    overflow: "hidden", // 텍스트가 너무 길 경우 잘림
    textOverflow: "ellipsis", // 잘린 텍스트에 '...' 표시
  },
  
 
  
  
};

export default Header;
