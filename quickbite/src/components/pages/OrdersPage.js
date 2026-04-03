'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import * as orderService from '@/services/orderService';
import { Clock, RefreshCw } from 'lucide-react';

const PLATFORM_FEE = 7;

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
                <div style={{ marginTop: '16px', background: '#FFF3E0', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid #FFCC80' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚠️</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#E65100', fontWeight: 600, lineHeight: 1.4 }}>
                        Please pay ₹{order.total_price} to {order.outlet_upi_id || 'sharukhansharukhan926@oksbi'} to confirm your order.
                      </p>
                      
                      {isMobile ? (
                        <>
                          <button
                            onClick={() => {
                              window.location.href = generateUpiLink(order);
                              if (showToast) showToast('Once paid, please wait for the vendor to verify your transaction.', 'info');
                            }}
                            style={{
                              width: '100%', background: '#1A73E8', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px'
                            }}
                          >
                            <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.7-3.9 6.1v5h6.3c3.7-3.4 5.8-8.4 6.2-14.8z" fill="#4285F4"/>
                              <path d="M24 44c5.4 0 9.9-1.8 13.2-4.8l-6.3-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H6.1v5.2C9.4 39.9 16.2 44 24 44z" fill="#34A853"/>
                              <path d="M12.6 27.7c-.4-1.2-.7-2.4-.7-3.7s.2-2.5.7-3.7v-5.2H6.1C4.8 17.5 4 20.7 4 24s.8 6.5 2.1 8.9l6.5-5.2z" fill="#FBBC05"/>
                              <path d="M24 12c3 0 5.7 1 7.8 3l5.8-5.8C34 6 29.4 4 24 4 16.2 4 9.4 8.1 6.1 15.1l6.5 5.2C14.2 15.6 18.7 12 24 12z" fill="#EA4335"/>
                            </svg>
                            Pay Now via UPI
                          </button>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#E65100', opacity: 0.9 }}>
                            *Once paid, please wait for the vendor to verify your transaction.
                          </p>
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <code style={{ background: '#FFE0B2', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem', color: '#E65100', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                            {order.outlet_upi_id || 'sharukhansharukhan926@oksbi'}
                          </code>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(order.outlet_upi_id || 'sharukhansharukhan926@oksbi');
                              setCopiedId(order.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            style={{
                              background: '#E65100', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s'
                            }}
                          >
                            {copiedId === order.id ? 'Copied ✓' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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