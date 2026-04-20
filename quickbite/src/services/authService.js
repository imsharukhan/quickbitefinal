'use client';
import api from './api';

export const saveAuthData = (data) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('qb_token', data.access_token);
  localStorage.setItem('qb_refresh', data.refresh_token);
  localStorage.setItem('qb_role', data.role);
  localStorage.setItem('qb_user_id', data.user_id);
  localStorage.setItem('qb_name', data.name);
  localStorage.setItem('qb_must_change', String(data.must_change_password || false));
};

export const getAuthData = () => {
  if (typeof window === 'undefined') return {};
  return {
    token: localStorage.getItem('qb_token'),
    refresh: localStorage.getItem('qb_refresh'),
    role: localStorage.getItem('qb_role'),
    user_id: localStorage.getItem('qb_user_id'),
    name: localStorage.getItem('qb_name'),
    mustChange: localStorage.getItem('qb_must_change') === 'true'
  };
};

export const clearAuthData = () => {
  if (typeof window === 'undefined') return;
  ['qb_token', 'qb_refresh', 'qb_role', 'qb_user_id', 'qb_name',
   'qb_must_change', 'qb_email', 'qb_register_number']
  .forEach(key => localStorage.removeItem(key));
};

export const isLoggedIn = () => {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('qb_token');
  return !!token && token !== 'null' && token !== 'undefined';
};

export const login = (register_number, password) => {
  return api.post('/api/auth/login', { register_number, password });
};

export const register = (name, register_number, email, password) => {
  return api.post('/api/auth/register', { name, register_number, email, password, role: 'student' });
};

export const verifyOTP = (register_number, otp) => {
  return api.post('/api/auth/verify-otp', { register_number, otp });
};

export const resendOTP = (register_number) => {
  return api.post('/api/auth/resend-otp', { register_number });
};

export const forgotPassword = (email) => {
  return api.post('/api/auth/forgot-password', { email });
};

export const resetPassword = (register_number, otp, new_password) => {
  return api.post('/api/auth/reset-password', { register_number, otp, new_password });
};

// CHANGED: was vendorForgotPassword(phone) → now vendorForgotPassword(email)
export const vendorForgotPassword = (email) => {
  return api.post('/api/auth/vendor/forgot-password', { email });
};

// CHANGED: was vendorResetPassword(phone, ...) → now vendorResetPassword(email, ...)
export const vendorResetPassword = (email, otp, new_password) => {
  return api.post('/api/auth/vendor/reset-password', { email, otp, new_password });
};

export const vendorLogin = (phone, password) => {
  return api.post('/api/auth/vendor/login', { phone, password });
};

export const vendorChangePassword = (old_password, new_password) => {
  return api.post('/api/auth/vendor/change-password', { old_password, new_password });
};

export const changePassword = (new_password) => {
  return api.post('/api/auth/change-password', { new_password });
};

export const logout = async () => {
  try {
    await api.post('/api/auth/logout');
  } catch (err) {
    // ignore backend logout fail
  } finally {
    clearAuthData();
  }
};

export const refreshToken = (refresh_token) => {
  return api.post('/api/auth/refresh', { refresh_token });
};

export const getMe = () => {
  return api.get('/api/users/me');
};