'use client';
import api from './api';
export const getFullMenu = (outlet_id) => api.get(`/api/menu/vendor/${outlet_id}`).then(res => res.data);
export const addMenuItem = (outlet_id, data) => api.post(`/api/menu/${outlet_id}`, data).then(res => res.data);
export const updateMenuItem = (item_id, data) => api.patch(`/api/menu/item/${item_id}`, data).then(res => res.data);
export const toggleAvailability = (item_id) => api.patch(`/api/menu/item/${item_id}/toggle`).then(res => res.data);
export const deleteMenuItem = (item_id) => api.delete(`/api/menu/item/${item_id}`).then(res => res.data);
