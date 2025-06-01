// src/utils/inquiryServer.js
import axios from "axios";

const inquiryServer = axios.create({
  baseURL: "http://34.47.73.162:5001", // ���ǻ��� ���� �ּ�
  headers: {
    "Content-Type": "application/json",
  },
});

inquiryServer.interceptors.request.use(
  (config) => {
    const session_id = localStorage.getItem("session_id");

    if (session_id) {
      config.headers.Authorization = `Bearer ${session_id}`;
    } else {
      console.warn("[WARNING] Session ID is missing. Proceeding as guest.");
      // Authorization ����� �߰����� �ʾƵ� �������� guest ���� ó��
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default inquiryServer;
