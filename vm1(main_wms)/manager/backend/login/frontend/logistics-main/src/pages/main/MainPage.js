import React from "react";
import "./MainPage.css";
import HeaderNav from "../../components/HeaderNav";

function MainPage() {
    return (
        <div className="main-page">
            <video autoPlay muted loop id="bg-video">
                <source src="/video/background.webm" type="video/webm" />
            </video>

            <HeaderNav />

            <div className="content">
                <div className="block">
                    <h1>Welcome to the Main Page</h1>
                    <p>This is the description of the product or service.</p>
                </div>
            </div>
        </div>
    );
}

export default MainPage;