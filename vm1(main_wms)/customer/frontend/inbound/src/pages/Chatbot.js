import React, { useState } from 'react';
import axios from 'axios';
import { axios5010 } from '../api/axios';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const API_BASE_URL = 'http://34.64.211.3:5098';

function Chatbot({ onClose }) {
  const [messages, setMessages] = useState([
    { type: 'bot', text: '안녕하세요! 무엇을 도와드릴까요?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = { type: 'user', text: inputText };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await axios5010.post(`${API_BASE_URL}/chat`, {
        message: userMessage.text
      });
      if (response.data.chart_type === 'bar') {
        setChartData({
          labels: response.data.labels,
          datasets: [
            {
              label: '출고 상태별 건수',
              data: response.data.data,
              backgroundColor: '#6f47c5'
            }
          ]
        });
        setMessages((prev) => [...prev, { type: 'bot', text: '<b>📊 차트가 아래에 표시됩니다.</b>' }]);
      } else {
        const botMessage = { type: 'bot', text: response.data.answer };
        setChartData(null);
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      const errorMessage = { type: 'bot', text: '오류가 발생했습니다. 다시 시도해주세요.' };
      setMessages((prev) => [...prev, errorMessage]);
      setChartData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div style={styles.chatbotContainer}>
      <div style={styles.header}>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>💬 WMS 챗봇</span>
        <button onClick={onClose} style={styles.closeButton}>✖</button>
      </div>
      <div style={styles.chatWindow}>
        {messages.map((msg, index) => (
          msg.type === 'bot' ? (
            <div
              key={index}
              style={{
                ...styles.message,
                alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.type === 'user' ? '#6f47c5' : '#e0e0e0',
                color: msg.type === 'user' ? 'white' : 'black'
              }}
              dangerouslySetInnerHTML={{ __html: msg.text }}
                />
              ) : (
              <div
                key={index}
                style={{
                  ...styles.message,
                  alignSelf: 'flex-end',
                  backgroundColor: '#6f47c5',
                  color: 'white'
                }}
              >
                {msg.text}
              </div>
            )
          ))}
        {loading && <div style={styles.loading}>답변 작성 중...</div>}
      </div>

      {chartData && (
        <div style={{ padding: '10px' }}>
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>
      )}

      <div style={styles.inputArea}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          style={styles.input}
          placeholder="메시지를 입력하세요..."
        />
        <button onClick={handleSend} style={styles.sendButton}>전송</button>
      </div>
    </div>
  );
}

const styles = {
  chatbotContainer: {
    width: '400px',
    height: '600px',
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0px 4px 8px rgba(0,0,0,0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    backgroundColor: '#6f47c5',
    color: 'white',
    borderBottom: '1px solid #ddd'
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer'
  },
  chatWindow: {
    flex: 1,
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflowY: 'auto'
  },
  message: {
    maxWidth: '70%',
    padding: '10px',
    borderRadius: '12px',
    fontSize: '14px'
  },
  inputArea: {
    display: 'flex',
    padding: '10px',
    borderTop: '1px solid #ddd'
  },
  input: {
    flex: 1,
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '8px'
  },
  sendButton: {
    marginLeft: '8px',
    padding: '8px 12px',
    backgroundColor: '#6f47c5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  loading: {
    fontSize: '12px',
    color: '#999',
    alignSelf: 'center'
  }
};

export default Chatbot;
