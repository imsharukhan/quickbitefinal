'use client';
import api from './api';

export const createPaymentOrder = (order_id) =>
  api.post('/api/payments/create-order', { order_id }).then(res => res.data);

export const verifyPayment = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id }) =>
  api.post('/api/payments/verify', {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    order_id,
  }).then(res => res.data);