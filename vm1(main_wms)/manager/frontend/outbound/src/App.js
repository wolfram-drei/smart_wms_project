import React from "react";
import { Routes, Route } from "react-router-dom";
import Base from "./components/Base";
import Mout_state from "./pages/Mout_state";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatbotWrapper from "./pages/ChatbotWrapper";

const App = () => {
  return (
   
      <Base>
        <Routes>
          {/* 출고 현황 페이지 */}
          <Route path="/admin/OutboundStatus" element={
            <ProtectedRoute>
              <Mout_state />
            </ProtectedRoute>} />
        </Routes>
        {<ChatbotWrapper />}
      </Base>

  );
};

export default App;
