import React from "react";
import { Routes, Route } from "react-router-dom";
import EquipmentList from "./pages/EquipmentList";
import Base from "./components/Base"


const App = () => {
  return (

      <Base>
        <Routes>
          {/* 기자재 페이지 */}
          <Route path="/admin/EquipmentList" element={<EquipmentList />} />
        </Routes>
      </Base>

  );
};

export default App;
