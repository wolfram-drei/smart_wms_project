import React from "react";
import "./Sidebar.css";

// 아이콘
import logo from "./logo.svg";
import icon1 from "./icon1.svg";
import icon2 from "./icon2.svg";
import icon3 from "./icon3.svg";
import icon4 from "./icon4.svg";

// 메뉴 데이터
const menuItems = [
  {
    label: "HOME",
    children: [
      { label: "메인페이지", icon: icon1, url: "http://34.64.211.3:4000/user/CustomerMainPage" },
    ],
  },
  {
    label: "입고 및 계약",
    children: [
      {
        label: "견적서 작성",
        icon: icon1,
        url: "http://34.64.211.3:4001/user/Customerestimate",
      },
      {
        label: "계약 현황",
        icon: icon1,
        url: "http://34.64.211.3:4001/user/CustomerContract",
      },
      {
        label: "입고 현황",
        icon: icon1,
        url: "http://34.64.211.3:4001/user/CustomerInbound",
      },
    ],
  },
  {
    label: "출고",
    children: [
      {
        label: "출고 요청",
        icon: icon2,
        url: "http://34.64.211.3:4002/user/Customeroutboundrequest",
      },
      {
        label: "출고 현황",
        icon: icon2,
        url: "http://34.64.211.3:4002/user/Customeroutbound",
      },
    ],
  },
  {
    label: "시스템",
    children: [
      {
        label: "공지사항",
        icon: icon3,
        url: "http://34.47.73.162:4000/user/Notices",
      },
      {
        label: "문의사항",
        icon: icon4,
        url: "http://34.47.73.162:4000/user/Inquiries",
      },
      {
        label: "나의정보",
        icon: icon4,
        url: "http://34.47.73.162:4000/user/Employees",
      },
    ],
  },
];

// Sidebar 컴포넌트
const Sidebar = () => {
  return (
    <div className="sidebar">
      {/* 상단 제목 */}
      <div className="sidebar-header">
        <img src={logo} alt="Logo" className="sidebar-logo" />
        Smart WMS
      </div>

      {/* 메뉴 렌더링 */}
      {menuItems.map((menu, index) => (
        <div key={index} className="menu-group">
          {/* 상위 메뉴 */}
          <div className="menu-label">{menu.label}</div>

          {/* 하위 메뉴 */}
          <div className="menu-children">
            {menu.children.map((child, childIndex) => (
              <a
                key={childIndex}
                href={child.url} // HTTP 주소와 포트를 유지
                className="sidebar-item"
                target="_self" // 현재 탭에서 열리도록 설정
              >
                {child.icon && (
                  <img
                    className="sidebar-icon"
                    src={child.icon}
                    alt={child.label}
                  />
                )}
                <span>{child.label}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Sidebar;
