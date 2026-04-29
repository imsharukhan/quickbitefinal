'use client';
import api from './api';

const menuCache = {};

export const getMenuByOutlet = async (outlet_id) => {
  if (menuCache[outlet_id] && menuCache[outlet_id].valid) {
    return menuCache[outlet_id].data;
  }
  const data = await api.get(`/api/menu/${outlet_id}`).then(res => res.data);
  menuCache[outlet_id] = { data, valid: true };
  // FIX: Reduced from 60s to 30s — sold-out status shows to student faster
  setTimeout(() => {
    if (menuCache[outlet_id]) menuCache[outlet_id].valid = false;
  }, 30000);
  return data;
};

export const invalidateMenuCache = (outlet_id) => {
  if (menuCache[outlet_id]) menuCache[outlet_id].valid = false;
};