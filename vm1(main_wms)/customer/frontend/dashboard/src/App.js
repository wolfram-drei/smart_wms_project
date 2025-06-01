import React from "react";
import {Routes, Route } from "react-router-dom";
import Base from "./components/Base";
import CustomerMainPage from "./pages/CustomerMainPage";
import ChatbotWrapper from "./pages/ChatbotWrapper";

const App = () => {
  return (
    <Base>
      <Routes>
        {/* 입고 현황 페이지 */}
        <Route path="/user/CustomerMainPage" element={<CustomerMainPage />} />
      </Routes>
      {<ChatbotWrapper />}
    </Base>
  );
};

export default App;
