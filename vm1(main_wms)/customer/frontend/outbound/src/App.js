import React from "react";
import { Routes, Route } from "react-router-dom";
import Base from "./components/Base";
import Cout_state from "./pages/Cout_state";
import Cout_request from "./pages/Cout_request";
import ChatbotWrapper from "./pages/ChatbotWrapper";



const App = () => {
  return (
   
      <Base>
        <Routes>
          {/* 출고 페이지 */}
          <Route path="/user/Customeroutbound" element={<Cout_state />} />
          <Route path="/user/Customeroutboundrequest" element={<Cout_request />} />
        </Routes>
        {<ChatbotWrapper />}
      </Base>
  );
};

export default App;
