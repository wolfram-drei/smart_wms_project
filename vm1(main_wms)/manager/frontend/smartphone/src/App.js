import React from "react";
import { Routes, Route } from "react-router-dom";
import SpOutboundStatus1 from "./pages/SpOutboundStatus1";
import Smart_Phone from "./pages/Smart_Phone";
import Smart_Phone1 from "./pages/Smart_Phone1";
import Main from "./pages/Main";


const App = () => {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/admin/Smart_Phone" element={<Smart_Phone />} />
        <Route path="/admin/Smart_Phone1" element={<Smart_Phone1 />} />
        <Route path="/admin/SpOutboundStatus1" element={<SpOutboundStatus1 />} />
      </Routes>
    </div>
  );
};


export default App;
