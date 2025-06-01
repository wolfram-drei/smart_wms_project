import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainPage from "./pages/main/MainPage";
import LoginPage from "./pages/auth/Auth";
import HeaderNav from "./components/HeaderNav";
import AdminPage from "./pages/admin/AdminPage";
import MyPage from "./pages/mypage/MyPage";
import { GoogleOAuthProvider } from "@react-oauth/google";
import ProductIntroductionPage from "./pages/chatbot/ProductIntroductionPage";
import ChatBotFloating from "./components/ChatBotFloating";

const clientId = "965956228643-qoo4lgt9fm0c3lcp4frp4vncr0b2ukc7.apps.googleusercontent.com";

function App() {
    return (
        <GoogleOAuthProvider clientId={clientId}>
            <Router>
                <HeaderNav />
                <Routes>
                    <Route path="/" element={<MainPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/mypage" element={<MyPage />} />
                    <Route path="/about" element={<ProductIntroductionPage />} />
                </Routes>
                <ChatBotFloating />
            </Router>
        </GoogleOAuthProvider>
    );
}

export default App;
