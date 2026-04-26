'use client';
import api from './api';

const menuCache = {};

export const getMenuByOutlet = async (outlet_id) => {
  if (menuCache[outlet_id] && menuCache[outlet_id].valid) {
    return menuCache[outlet_id].data;
  }
  const data = await api.get(`/api/menu/${outlet_id}`).then(res => res.data);
  menuCache[outlet_id] = { data, valid: true };
  // Auto-expire after 60 seconds
  setTimeout(() => {
    if (menuCache[outlet_id]) menuCache[outlet_id].valid = false;
  }, 60000);
  return data;
};

export const invalidateMenuCache = (outlet_id) => {
  if (menuCache[outlet_id]) menuCache[outlet_id].valid = false;
};