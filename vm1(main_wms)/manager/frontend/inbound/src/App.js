import React from "react";
import {Routes, Route } from "react-router-dom";
import Base from "./components/Base";
import Min_contract_state from "./pages/Min_contract_state";
import Min_estimate_main from "./pages/Min_estimate_main";
import Min_state from "./pages/Min_state";
import Min_state_sp from "./pages/Min_state_sp";
import { StorageMap, StorageDetail } from "./pages/StorageMap";
import "leaflet/dist/leaflet.css";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatbotWrapper from "./pages/ChatbotWrapper";

const App = () => {
  return (

      <Base>
        <Routes>
          {/* 입고 현황 페이지 */}
          <Route path="/admin/inbound-status" element={
            <ProtectedRoute>
              <Min_estimate_main />
            </ProtectedRoute>}/>
          {/* 입고 스마트폰 페이지 */}
          <Route path="/admin/SmPhoneInbound" element={
            <ProtectedRoute>
             <Min_state_sp />
            </ProtectedRoute>} />
          {/* 입고 디테일 페이지 */}
          <Route path="/admin/inbound-status-detail" element={
            <ProtectedRoute>
              <Min_state /> 
            </ProtectedRoute>} />
          {/* 계약 현황 페이지 */}
          <Route path="/admin/contract-status" element={
            <ProtectedRoute>
              <Min_contract_state />
            </ProtectedRoute>} />
          {/* 창고 위치 페이지 */}
          <Route path="/admin/storage-map" element={<StorageMap />} />
          {/* 창고 물품 보관 현황 페이지 */}
          <Route path="/admin/storage-map/detail/:id" element={
            <ProtectedRoute>
              <StorageDetail />
            </ProtectedRoute>} />
        </Routes>
        {<ChatbotWrapper />}
      </Base>
  
  );
};

export default App;
