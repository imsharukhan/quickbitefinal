'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import * as orderService from '@/services/orderService';
import { Clock, RefreshCw } from 'lucide-react';

const PLATFORM_FEE = 7;

function RetryPaymentSection({ order, user, showToast, navigate }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetryPayment = async () => {
    setRetrying(true);
    try {
      const { loadRazorpayScript, openRazorpayCheckout } = await import('@/utils/razorpay');
      const paymentService = await import('@/services/paymentService');

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) { showToast('Payment gateway failed to load', 'error'); return; }

      const rzpData = await paymentService.createPaymentOrder(order.id);

      openRazorpayCheckout({
        rzpData,
        orderId: order.id,
        userName: user?.name,
        userEmail: user?.email,
        onSuccess: async (response) => {
          try {
            await paymentService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: order.id,
            });
            showToast('Payment confirmed! 🎉', 'success');
            navigate('orders');
          } catch {
            showToast('Payment done! Token will appear shortly.', 'info');
          }
        },
        onDismiss: () => showToast('Payment cancelled.', 'info'),
      });
    } catch (err) {
      showToast('Failed to open payment. Try again.', 'error');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div style={{ marginTop: '16px', background: '#FFF3E0', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid #FFCC80' }}>
      <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#E65100', fontWeight: 600 }}>
        ⚠️ Payment pending — complete payment to confirm your order.
      </p>
      <button
        onClick={handleRetryPayment}
        disabled={retrying}
        style={{
          width: '100%', background: '#FC8019', color: 'white',
          border: 'none', borderRadius: '8px', padding: '12px',
          fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
          opacity: retrying ? 0.6 : 1
        }}
      >
        {retrying ? 'Opening payment...' : '💳 Complete Payment'}
      </button>
    </div>
  );
}

export default function OrdersPage({ navigate, showToast }) {
  const { orders, setOrders, loadOrders, isOrdersLoading } = useApp();
  const [ratingState, setRatingState] = useState({ id: null, stars: 5, review: '' });
  const [cancelingId, setCancelingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

  const { user } = useAuth();
  const { lastMessage } = useWebSocket('student', user?.id);

  useEffect(() => {
    if (lastMessage?.type === 'STATUS_UPDATE') {
      setOrders(prev => prev.map(order => 
        order.id === lastMessage.order_id 
          ? { ...order, status: lastMessage.status, payment_status: lastMessage.payment_status || order.payment_status } 
          : order
      ));
      if (showToast) showToast(lastMessage.message || `Order status updated to ${lastMessage.status}!`, 'success');
    }
  }, [lastMessage]); // Removed unstable dependencies to prevent network storms

  const generateUpiLink = (order) => {
    const upiId = order.outlet_upi_id || 'sharukhansharukhan926@oksbi';
    const name = encodeURIComponent(order.outlet_name || 'QuickBite');
    return `upi://pay?pa=${upiId}&pn=${name}&am=${order.total_price}&cu=INR`;
  };

  useEffect(() => {
    loadOrders();
    // Removed legacy interval polling; WebSocket handles real-time sync instantly!
  }, []); // Empty dependency array permanently kills infinite fetch loops

  const handleCancel = async (id) => {
    if (window.confirm("Cancel this order?")) {
      setCancelingId(id);
      try {
        await orderService.cancelOrder(id, "User requested cancellation");
        await loadOrders();
        if (showToast) showToast('Order cancelled', 'success');
      } catch(e) {
        if (showToast) showToast('Failed to cancel', 'error');
      } finally {
        setCancelingId(null);
      }
    }
  };

  const submitRating = async (id) => {
    try {
      await orderService.rateOrder(id, ratingState.stars, ratingState.review);
      setRatingState({ id: null, stars: 5, review: '' });
      await loadOrders();
      if (showToast) showToast('Thank you for rating!', 'success');
    } catch(e) {
      if (showToast) showToast('Failed to submit rating', 'error');
    }
  };

  if (isOrdersLoading && orders.length === 0) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', borderColor: 'var(--primary-light)', borderTopColor: 'var(--primary)' }}></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🧾</div>
        <h3>No orders yet</h3>
        <p>You haven't placed any orders.</p>
        <button className="btn btn-primary" onClick={() => navigate('home')} style={{ marginTop: '16px' }}>Start Ordering</button>
      </div>
    );
  }

  return (
    <div className="orders-page pb-section">
      <div className="menu-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Your Orders</h1>
        <button onClick={loadOrders} disabled={isOrdersLoading} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
          <RefreshCw size={20} className={isOrdersLoading ? 'pulse-red' : ''} />
        </button>
      </div>

      <div className="orders-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {orders.map(order => {
          const isPlaced = order.status === 'Placed';
          const canCancel = isPlaced && order.payment_status === 'PENDING';
          const canRate = order.status === 'Picked Up' && !order.rating;

          return (
            <div key={order.id} className="order-card" style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>

              {/* Token banner for active orders */}
              {['Placed', 'Preparing', 'Ready for Pickup'].includes(order.status) ? (
                order.token_valid_today ? (
                  <div style={{ background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>YOUR TOKEN</div>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>
                        #{order.token_number || order.id?.toString().slice(-3) || '---'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', opacity: 0.85 }}>
                      Show this at<br />the counter
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#FFF3E0', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem' }}>⏰</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#E65100' }}>Token Expired</div>
                      <div style={{ fontSize: '0.75rem', color: '#BF360C', marginTop: '2px' }}>This token was for a previous day and is no longer valid</div>
                    </div>
                  </div>
                )
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px' }}>
                  Token #{order.token_number || order.id?.toString().slice(-3) || '---'}
                </span>
              )}

              {/* Order header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>{order.outlet_name || order.outletName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <Clock size={14} /> Pickup: {order.pickup_time || order.pickupTime || 'ASAP'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span className={`order-status-badge ${order.status.replace(/\s+/g, '_').toLowerCase()}`} style={{ fontWeight: 700 }}>{order.status}</span>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px',
                    background: (order.payment_status === 'PAID' || ['Preparing', 'Ready for Pickup', 'Picked Up'].includes(order.status)) ? '#E8F5E9' : (order.status === 'Cancelled' ? '#ffebee' : '#FFF8E1'),
                    color: (order.payment_status === 'PAID' || ['Preparing', 'Ready for Pickup', 'Picked Up'].includes(order.status)) ? '#2E7D32' : (order.status === 'Cancelled' ? '#d84315' : '#F57F17'), fontWeight: 700
                  }}>
                    {(order.payment_status === 'PAID' || ['Preparing', 'Ready for Pickup', 'Picked Up'].includes(order.status)) ? 'Paid ✓' : (order.status === 'Cancelled' ? 'Cancelled' : 'Payment Pending')}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: '16px' }}>
                {order.items?.map(i => (
                  <div key={i.id || Math.random()} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                    <span>{i.quantity} x {i.name}</span>
                    <span style={{ fontWeight: 600 }}>₹{(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Bill breakdown */}
              <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Total Paid</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>₹{order.total_price}</span>
                </div>
              </div>

              {order.payment_status === 'PENDING' && order.status === 'Placed' && (
                <RetryPaymentSection
                  order={order}
                  user={user}
                  showToast={showToast}
                  navigate={navigate}
                />
              )}

              {ratingState.id === order.id && (
                <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                    {[1,2,3,4,5].map(s => (
                      <span key={s} onClick={() => setRatingState(prev => ({ ...prev, stars: s }))} style={{ cursor: 'pointer', fontSize: '1.8rem', color: ratingState.stars >= s ? '#FC8019' : '#ddd' }}>★</span>
                    ))}
                  </div>
                  <textarea
                    placeholder="How was your experience?"
                    value={ratingState.review}
                    onChange={e => setRatingState(prev => ({ ...prev, review: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '12px', resize: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setRatingState({ id: null, stars: 5, review: '' })} style={{ flex: 1, padding: '10px', background: '#eee', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Cancel</button>
                    <button onClick={() => submitRating(order.id)} className="btn btn-primary" style={{ flex: 2, padding: '10px' }}>Submit</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}