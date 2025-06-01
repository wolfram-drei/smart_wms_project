import axios from 'axios';

const api = axios.create({
  baseURL: 'http://34.64.211.3:5001', // Flask 백엔드 주소
  withCredentials: true, // JWT 쿠키 포함
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

    // ✅ 조건 추가: 재발급 요청 자체는 무시
    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/reissue")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          'http://34.64.211.3:5080/api/reissue',
          {},
          { withCredentials: true }
        );

        isRefreshing = false;
        processQueue(null);

        console.log("✅ accessToken 자동 재발급 성공");
        return api(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr, null);

        console.warn("❌ accessToken 재발급 실패");
        alert("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = "http://34.64.211.3:3000/";
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
