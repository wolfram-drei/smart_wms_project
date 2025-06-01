import axios from 'axios';

const accessToken = localStorage.getItem("accessToken");

const axios5010 = axios.create({
  baseURL: 'http://34.64.211.3:5010',
  withCredentials: true,
});

const axios5080 = axios.create({
  baseURL: 'http://34.64.211.3:5080',
  withCredentials: true,
});

const axios5003 = axios.create({
  baseURL: 'http://34.64.211.3:5003',
  withCredentials: true,
});

// ✅ 요청마다 동적으로 accessToken 붙이기
const attachToken = (config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

axios5010.interceptors.request.use(attachToken);
axios5003.interceptors.request.use(attachToken);


// ✅ 토큰 만료 시 자동 재발급
axios5010.interceptors.response.use(
  res => res,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await axios5080.post('/api/reissue', {}, { withCredentials: true });
        return axios5010(originalRequest);
      } catch {
        window.location.href = 'http://34.64.211.3:3000/login';
      }
    }
    return Promise.reject(error);
  }
);

export { axios5010, axios5080, axios5003 };