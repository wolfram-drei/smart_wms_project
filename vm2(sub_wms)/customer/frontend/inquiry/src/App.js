import React from "react";
import {Routes, Route } from "react-router-dom";
import Base from "./components/Base";
import CustomerNotices from "./pages/CustomerNotices";
import Myinfo from "./pages/Myinfo";
import CustomerInquiries from "./pages/CustomerInquiries";



const App = () => {
  return (

      <Base>
        <Routes>
          {/* 입고 현황 페이지 */}
          <Route path="/user/CustomerNotices" element={<CustomerNotices />} />
          <Route path="/user/Myinfo" element={<Myinfo />} />
          <Route path="/user/CustomerInquiries" element={<CustomerInquiries />} />
        </Routes>
      </Base>

  );
};

export default App;
