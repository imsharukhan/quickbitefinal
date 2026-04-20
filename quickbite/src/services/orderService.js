'use client';
import api from './api';
export const placeOrder = (outlet_id, items, pickup_time, total_price) => api.post('/api/orders', { outlet_id, items, pickup_time, total_price }).then(res => res.data);
export const getMyOrders = () => api.get('/api/orders/my').then(res => res.data);
export const getOutletOrders = (outlet_id, status, date) => {
    let url = `/api/orders/outlet/${outlet_id}?`;
    if (status) url += `status=${status}&`;
    if (date) url += `date=${date}`;
    return api.get(url).then(res => res.data);
};
export const updateOrderStatus = (order_id, status) => api.patch(`/api/orders/${order_id}/status`, { status }).then(res => res.data);
export const confirmPayment = (order_id) => api.patch(`/api/orders/${order_id}/confirm-payment`, {}).then(res => res.data);
export const cancelOrder = (order_id, reason) => api.patch(`/api/orders/${order_id}/cancel`, { reason }).then(res => res.data);
export const cancelOrderVendor = (order_id, reason) => api.patch(`/api/orders/${order_id}/cancel-vendor`, { reason }).then(res => res.data);
export const rateOrder = (order_id, stars, review) => api.post(`/api/orders/${order_id}/rate`, { rating: stars, review }).then(res => res.data);
export const getOutletStats = (outlet_id) => api.get(`/api/orders/outlet/${outlet_id}/stats`).then(res => res.data);
export const getOutletHistory = (outlet_id) => api.get(`/api/orders/outlet/${outlet_id}/history`).then(res => res.data);