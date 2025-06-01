import React from "react";
import {Routes, Route } from "react-router-dom";
import Base from "./components/Base";

import Cin_estimate_main from "./pages/Cin_estimate_main";
import Cin_contract_state_main from "./pages/Cin_contract_state_main";
import Cin_state from "./pages/Cin_state";

import ChatbotWrapper from "./pages/ChatbotWrapper";

const App = () => {
  return (
      <Base>
        <Routes>
          {/* 입고 현황 페이지 */}
          <Route path="/user/Customerestimate" element={<Cin_estimate_main />} />
          <Route path="/user/CustomerContract" element={<Cin_contract_state_main />} />
          <Route path="/user/CustomerInbound" element={<Cin_state />} />
        </Routes>
        {<ChatbotWrapper />}
      </Base>
  
  );
};

export default App;
