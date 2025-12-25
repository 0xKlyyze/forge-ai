import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      console.log('[API] Attaching token:', token.substring(0, 15) + '...');
      config.headers.Authorization = `Bearer ${token.trim()}`;
    } else {
      console.warn('[API] No token found in localStorage for request:', config.url);
    }
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('[API] 401 Unauthorized - Token may be expired or invalid');
      // Optional: Clear token if it's definitely invalid
      // localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export default api;
