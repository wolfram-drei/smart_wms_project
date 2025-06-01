import React from "react";
import {Routes, Route } from "react-router-dom";
import Base from "./components/Base";
import Min_contract_state from "./pages/Min_contract_state";
import Min_estimate_main from "./pages/Min_estimate_main";
import Min_state from "./pages/Min_state";
import Min_state_sp from "./pages/Min_state_sp";


const App = () => {
  return (

      <Base>
        <Routes>
          {/* 입고 현황 페이지 */}
          <Route path="/admin/inbound-status" element={<Min_estimate_main />} />
          {/* 입고 스마트폰 페이지 */}
          <Route path="/admin/SmPhoneInbound" element={<Min_state_sp />} />
          {/* 입고 디테일 페이지 */}
          <Route path="/admin/inbound-status-detail" element={<Min_state />} />
          {/* 계약 현황 페이지 */}
          <Route path="/admin/contract-status" element={<Min_contract_state />} />
        </Routes>
      </Base>
  
  );
};

export default App;
