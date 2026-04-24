'use client';
import api from './api';

const menuCache = {};

export const getMenuByOutlet = async (outlet_id) => {
  if (menuCache[outlet_id]) return menuCache[outlet_id];
  const data = await api.get(`/api/menu/${outlet_id}`).then(res => res.data);
  menuCache[outlet_id] = data;
  // Cache for 60 seconds — stale after that
  setTimeout(() => { delete menuCache[outlet_id]; }, 60000);
  return data;
};

export const invalidateMenuCache = (outlet_id) => {
  delete menuCache[outlet_id];
};