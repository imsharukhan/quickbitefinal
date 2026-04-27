'use client';
import api from './api';
export const getMyOutlets = () => api.get('/api/outlets/me').then(res => res.data);
export const updateOutlet = (outlet_id, data) => api.patch(`/api/outlets/${outlet_id}`, data).then(res => res.data);
export const toggleOutletOpen = (outlet_id) => api.patch(`/api/outlets/${outlet_id}/toggle`).then(res => res.data);
export const updateClosedDates = (outlet_id, closed_dates) => api.patch(`/api/outlets/${outlet_id}`, { closed_dates }).then(res => res.data);
