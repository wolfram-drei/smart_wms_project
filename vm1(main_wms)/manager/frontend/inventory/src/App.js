import React from "react";
import { Routes, Route } from "react-router-dom";
import Base from "./components/Base";
import InventoryStatus from "./pages/InventoryStatus";
import ProtectedRoute from "./components/ProtectedRoute"; // ✅ 추가
import ChatbotWrapper from "./pages/ChatbotWrapper";

const App = () => {
  return (
    <Base>
      <Routes>
        <Route path="/admin/InventoryStatus" element={
          <ProtectedRoute>
            <InventoryStatus />
          </ProtectedRoute>
        } />
      </Routes>
      {<ChatbotWrapper />}
    </Base>
  );
};

export default App;
