'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import * as orderService from '@/services/orderService';
import { Clock, RefreshCw } from 'lucide-react';

const PLATFORM_FEE = 7;

export default function OrdersPage({ navigate, showToast }) {
  const { orders, loadOrders, isOrdersLoading } = useApp();
  const [ratingState, setRatingState] = useState({ id: null, stars: 5, review: '' });
  const [cancelingId, setCancelingId] = useState(null);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders(), 60000);
    return () => clearInterval(interval);
  }, []);

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
          // Show total with platform fee
          const displayTotal = (order.total || 0) + PLATFORM_FEE;

          return (
            <div key={order.id} className="order-card" style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>

              {/* Token banner for active orders */}
              {['Placed', 'Preparing', 'Ready for Pickup'].includes(order.status) ? (
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
                    background: order.payment_status === 'PAID' ? '#E8F5E9' : '#FFF8E1',
                    color: order.payment_status === 'PAID' ? '#2E7D32' : '#F57F17', fontWeight: 700
                  }}>
                    {order.payment_status === 'PAID' ? 'Paid ✓' : 'Payment Pending'}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Item total</span>
                  <span>₹{order.total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span>Platform fee</span>
                  <span>₹{PLATFORM_FEE}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Total Amount</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>₹{displayTotal}</span>
                </div>
              </div>

              {canCancel && (
                <button
                  onClick={() => handleCancel(order.id)}
                  disabled={cancelingId === order.id}
                  style={{ width: '100%', marginTop: '16px', padding: '10px', background: '#ffebee', color: '#d84315', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
                >
                  {cancelingId === order.id ? 'Canceling...' : 'Cancel Order'}
                </button>
              )}

              {canRate && ratingState.id !== order.id && (
                <button
                  onClick={() => setRatingState({ id: order.id, stars: 5, review: '' })}
                  className="btn btn-outline" style={{ width: '100%', marginTop: '16px' }}
                >
                  Rate Order
                </button>
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