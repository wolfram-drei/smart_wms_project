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
      { label: "메인페이지", icon: icon1, url: "http://34.64.211.3:3050/admin/Mainpage" },
    ],
  },
  {
    label: "입고 및 계약",
    children: [
      {
        label: "계약 현황",
        icon: icon1,
        url: "http://34.64.211.3:3001/admin/contract-status",
      },
      {
        label: "입고 현황",
        icon: icon1,
        url: "http://34.64.211.3:3001/admin/inbound-status-detail",
      },
    ],
  },
  {
    label: "출고",
    children: [
      {
        label: "출고 현황",
        icon: icon2,
        url: "http://34.64.211.3:3002/admin/OutboundStatus",
      },
    ],
  },
  {
    label: "재고",
    children: [
      {
        label: "재고 현황",
        icon: icon2,
        url: "http://34.64.211.3:3003/admin/InventoryStatus",
      },
    ],
  },
  {
    label: "바코드",
    children: [
      {
        label: "바코드 인식",
        icon: icon2,
        url: "http://34.64.211.3:3001/admin/barcode-detection",
      },
    ],
  },
  {
    label: "창고관리",
    children: [
      {
        label: "기자재 관리",
        icon: icon2,
        url: "http://34.47.73.162:3010/admin/EquipmentList",
      },
    ],
  },
  {
    label: "시스템",
    children: [
      {
        label: "공지사항",
        icon: icon3,
        url: "http://34.47.73.162:3000/admin/Notices",
      },
      {
        label: "문의사항",
        icon: icon4,
        url: "http://34.47.73.162:3000/admin/Inquiries",
      },
      {
        label: "사원관리",
        icon: icon4,
        url: "http://34.47.73.162:3000/admin/Employees",
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
