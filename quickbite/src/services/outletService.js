'use client';
import api from './api';

const slotsCache = {};
const outletsCache = { list: null, listTime: 0 };

export const getAllOutlets = async () => {
  const now = Date.now();
  if (outletsCache.list && now - outletsCache.listTime < 10000) return outletsCache.list;
  const data = await api.get('/api/outlets').then(res => res.data);
  outletsCache.list = data;
  outletsCache.listTime = now;
  return data;
};

export const getOutletById = (id) => api.get(`/api/outlets/${id}`).then(res => res.data);

export const getAvailableSlots = async (outlet_id, date) => {
  const key = `${outlet_id}_${date || 'today'}`;
  const now = Date.now();
  if (slotsCache[key] && now - slotsCache[key].time < 30000) return slotsCache[key].data;
  let url = `/api/outlets/${outlet_id}/slots`;
  if (date) url += `?date=${date}`;
  const data = await api.get(url).then(res => res.data);
  slotsCache[key] = { data, time: now };
  return data;
};