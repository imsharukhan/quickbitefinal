'use client';
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('qb_token');
      if (token && token !== 'null' && token !== 'undefined') {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

export const clearAuthData = () => {
  if (typeof window === 'undefined') return;
  ['qb_token', 'qb_refresh', 'qb_role', 'qb_user_id', 'qb_name', 'qb_must_change'].forEach(key => localStorage.removeItem(key));
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;
    
    if (error.response && error.response.status === 401 && originalRequest) {
      if (originalRequest._retry) {
        return Promise.reject(error);
      }
      
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      return new Promise((resolve, reject) => {
        try {
          if (typeof window !== 'undefined') {
            const refreshToken = localStorage.getItem('qb_refresh');
            if (!refreshToken || refreshToken === 'null' || refreshToken === 'undefined') {
              clearAuthData();
              window.dispatchEvent(new Event('auth:logout'));
              return reject({ response: { status: 401 } });
            }
            
            axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
              refresh_token: refreshToken
            }).then(({ data }) => {
              localStorage.setItem('qb_token', data.access_token);
              processQueue(null, data.access_token);
              originalRequest.headers['Authorization'] = 'Bearer ' + data.access_token;
              resolve(api(originalRequest));
            }).catch((err) => {
              processQueue(err, null);
              clearAuthData();
              window.dispatchEvent(new Event('auth:logout'));
              reject(err);
            }).finally(() => {
              isRefreshing = false;
            });
          } else {
            reject(error);
            isRefreshing = false;
          }
        } catch (err) {
          processQueue(err, null);
          clearAuthData();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth:logout'));
          }
          isRefreshing = false;
          reject(err);
        }
      });
    }
    
    return Promise.reject(error);
  }
);

export default api;
