import React, { useState } from "react";
import "./ProductIntroduction.css";

function ProductIntroductionPage() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");

  const handleChatSubmit = async () => {
    const res = await fetch("http://<YOUR_VM_IP>:5050/api/admin/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    setAnswer(data.answer);
  };

  return (
    <div>
      <h1>제품 소개 페이지</h1>

    </div>
  );
}

export default ProductIntroductionPage;
