import axios from 'axios';

const BASE_URL = 'http://34.47.73.162:5001/api';

const inquiryServer = {

  // 문의사항 상세 조회
  getInquiries: async (searchText = "") => {
    try {
      const response = await axios.get(`${BASE_URL}/inquiries`, {
        params: { search: searchText },
      });
      return response.data;
    } catch (error) {
      console.error('문의사항 조회 실패:', error);
      throw error;
    }
  },

  // 문의사항 답변 등록
  updateInquiryAnswer: async (id, answerData) => {
    try {
      const response = await axios.put(`${BASE_URL}/inquiries/${id}/answer`, answerData);
      return response.data;
    } catch (error) {
      console.error('문의사항 답변 등록 실패:', error);
      throw error;
    }
  },

  // 📌 문의사항 작성 추가
  createInquiry: async (data) => {
    try {
      const response = await axios.post(`${BASE_URL}/inquiries`, data);
      return response.data;
    } catch (error) {
      console.error('문의사항 등록 실패:', error);
      throw error;
    }
  },

  // 📌 문의사항 삭제 추가
  deleteInquiry: async (id) => {
    try {
      const response = await axios.delete(`${BASE_URL}/inquiries/${id}`);
      return response.data;
    } catch (error) {
      console.error('문의사항 삭제 실패:', error);
      throw error;
    }
  },

  updateInquiry: async (id, data) => {
    try {
      const response = await axios.put(`${BASE_URL}/inquiries/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('문의사항 수정 실패:', error);
      throw error;
    }
  },
};

export default inquiryServer;
