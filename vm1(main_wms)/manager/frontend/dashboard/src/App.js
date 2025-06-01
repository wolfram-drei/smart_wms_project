import React from "react";
import {Routes, Route } from "react-router-dom";
import Base from "./components/Base";
import MainPage from "./pages/MainPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatbotWrapper from "./pages/ChatbotWrapper";

const App = () => {
  return (
    <Base>
      <Routes>
        {/* 입고 현황 페이지 */}
        <Route path="/admin/Mainpage" element={
          <ProtectedRoute>
            <MainPage />
          </ProtectedRoute>
          } />
      </Routes>
      {<ChatbotWrapper />}
    </Base>
  );
};

export default App;
