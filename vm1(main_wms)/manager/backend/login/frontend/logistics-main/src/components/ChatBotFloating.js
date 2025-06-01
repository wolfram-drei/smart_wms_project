import React, { useState, useRef, useEffect } from "react";
import "./ChatBotFloating.css";
import axios from "axios";

const ChatBotFloating = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const clearOnClose = () => setMessages([]);
    window.addEventListener("beforeunload", clearOnClose);
    return () => window.removeEventListener("beforeunload", clearOnClose);
  }, []);

  const handleChatSubmit = async () => {
    if (!query.trim()) return;
    const newMessages = [...messages, { type: "question", text: query }];
    setMessages(newMessages);
    setQuery("");
  
    try {
      const res = await axios.post("http://34.64.211.3:5081/api/admin/rag", {
        query: query,
        history: newMessages, 
      });
      setMessages([...newMessages, { type: "answer", text: res.data.answer }]);
    } catch (err) {
      setMessages([...newMessages, { type: "answer", text: "❌ 서버 응답 실패: " + err.message }]);
    }
  };
  

  return (
    <div className="chatbot-floating-container">
      <button className="chatbot-floating-button" onClick={() => setIsOpen(!isOpen)}>
        💬
      </button>
      {isOpen && (
        <div className="chatbot-popup">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="질문을 입력하세요"
            className="chatbot-textarea"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); // 줄바꿈 방지
                handleChatSubmit(); // 전송
              }
            }}
          />
          <button onClick={handleChatSubmit} className="chatbot-submit">전송</button>
          <div className="chat-answer">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`chat-message ${msg.type}`}
                dangerouslySetInnerHTML={{ __html: msg.text }}
              />
            ))}
            <div ref={endRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBotFloating;
