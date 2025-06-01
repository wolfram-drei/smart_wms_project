import axios from 'axios';

const api = axios.create({
  baseURL: 'http://34.64.211.3:5080', // Spring Boot 백엔드 주소
  withCredentials: true, // 쿠키 포함 필수
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });

  failedQueue = [];
};

api.interceptors.response.use(
  res => res,
  async err => {
    const originalRequest = err.config;

    // accessToken 만료로 401 응답 받았고, 아직 재발급 시도 안 한 요청만
    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/reissue") // <-- 이 조건 추가
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(() => api(originalRequest))
        .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      console.log("accessToken 자동 재발급 성공");
      isRefreshing = true;

      try {
        const res = await axios.post(
          'http://34.64.211.3:5080/api/reissue',
          {},
          { withCredentials: true }
        );

        isRefreshing = false;
        processQueue(null);

        return api(originalRequest); // 원래 요청 재시도
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr, null);
        console.warn("accessToken 재발급 실패");
        alert("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = "http://34.64.211.3:3000/"; // 재발급 실패 → 로그인 페이지로
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
