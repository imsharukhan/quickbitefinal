'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Clock, RefreshCw } from 'lucide-react';
import * as orderService from '@/services/orderService';


export default function OrdersPage({ navigate, showToast }) {
  const { orders, setOrders, loadOrders, isOrdersLoading, refreshAfterPayment, loadNotifications } = useApp();
  const visibleOrders = orders.filter(o => o.payment_status !== 'PENDING');
  const [cancelingId, setCancelingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [feedbackOrder, setFeedbackOrder] = useState(null);
  const [feedbackStars, setFeedbackStars] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const prevStatusRef = useRef({});
  const isInitialLoadRef = useRef(true);

  const getShownFeedbacks = () => {
    try { return new Set(JSON.parse(localStorage.getItem('qb_fb_shown') || '[]')); }
    catch { return new Set(); }
  };
  const markFeedbackHandled = (orderId) => {
    try {
      const shown = getShownFeedbacks();
      shown.add(orderId);
      localStorage.setItem('qb_fb_shown', JSON.stringify([...shown]));
    } catch {}
  };
  // Persists prevStatusRef across remounts — survives in-app navigation
  const getSessionStatuses = () => {
    try { return JSON.parse(sessionStorage.getItem('qb_order_prev_statuses') || '{}'); }
    catch { return {}; }
  };
  const saveSessionStatuses = (statuses) => {
    try { sessionStorage.setItem('qb_order_prev_statuses', JSON.stringify(statuses)); }
    catch {}
  };
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

  const { user } = useAuth();
  
  const generateUpiLink = (order) => {
    const upiId = order.outlet_upi_id || 'sharukhansharukhan926@oksbi';
    const name = encodeURIComponent(order.outlet_name || 'Grab N Go');
    return `upi://pay?pa=${upiId}&pn=${name}&am=${order.total_price}&cu=INR`;
  };

  useEffect(() => {
    loadOrders();
    // Removed legacy interval polling; WebSocket handles real-time sync instantly!
  }, []);

  useEffect(() => {
    if (feedbackOrder || feedbackDone) return;

    if (isInitialLoadRef.current) {
      // On every mount — restore persisted statuses from sessionStorage first
      // This means remounts (in-app nav back to Orders) inherit what was last seen
      // Prevents re-triggering for orders already in "Picked Up" before this mount
      const persisted = getSessionStatuses();
      const merged = { ...persisted };
      // Current orders set the baseline — any order already "Picked Up" on mount
      // is treated as already-seen, never triggers the modal
      visibleOrders.forEach(o => { merged[o.id] = o.status; });
      prevStatusRef.current = merged;
      saveSessionStatuses(merged);
      isInitialLoadRef.current = false;
      return;
    }

    const shown = getShownFeedbacks();

    // Only trigger for orders that JUST transitioned to Picked Up in this live session
    const justPickedUp = visibleOrders.find(o => {
      const prev = prevStatusRef.current[o.id];
      return (
        o.status === 'Picked Up' &&
        prev !== 'Picked Up' &&
        (o.can_rate !== false) &&
        !shown.has(o.id)
      );
    });

    // Sync and persist for next comparison and next mount
    visibleOrders.forEach(o => { prevStatusRef.current[o.id] = o.status; });
    saveSessionStatuses(prevStatusRef.current);

    if (justPickedUp) setFeedbackOrder(justPickedUp);
  }, [visibleOrders]);

   
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const data = await orderService.getMyOrders();
      setOrders(data || []);
    } finally {
      setTimeout(() => setIsRefreshing(false), 250);
    }
  };

  const STAR_LABELS = ['', '😞 Poor', '😐 Okay', '🙂 Good', '😊 Great', '🤩 Amazing!'];

  const handleFeedbackSubmit = async () => {
    if (!feedbackStars || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      await orderService.submitFeedback(feedbackOrder.id, feedbackStars, feedbackText.trim() || null);
      markFeedbackHandled(feedbackOrder.id);
      setFeedbackDone(true);
      setTimeout(() => {
        setFeedbackOrder(null);
        setFeedbackDone(false);
        setFeedbackStars(0);
        setFeedbackText('');
      }, 2200);
    } catch (e) {
      if (showToast) showToast('Could not submit feedback. Try again.', 'error');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleFeedbackSkip = () => {
    markFeedbackHandled(feedbackOrder.id);
    setFeedbackOrder(null);
    setFeedbackStars(0);
    setFeedbackText('');
  };

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

  if (isOrdersLoading && visibleOrders.length === 0) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', borderColor: 'var(--primary-light)', borderTopColor: 'var(--primary)' }}></div>
      </div>
    );
  }

  if (visibleOrders.length === 0) {
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
  <>
    {/* ── Feedback Bottom Sheet ─────────────────────────── */}
    {feedbackOrder && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0',
      }}>
        <style>{`
          @keyframes qb-slide-up {
            from { transform: translateY(80px); opacity: 0; }
            to   { transform: translateY(0);   opacity: 1; }
          }
          .qb-star-btn { transition: transform 0.15s, filter 0.15s; }
          .qb-star-btn:hover { transform: scale(1.25) !important; }
        `}</style>

        <div style={{
          background: 'white', borderRadius: '28px 28px 0 0',
          padding: '32px 24px calc(env(safe-area-inset-bottom, 0px) + 80px)',
          width: '100%', maxWidth: '560px',
          animation: 'qb-slide-up 0.32s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}>
          {feedbackDone ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '12px' }}>🙏</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>Thanks for your feedback!</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>It helps us improve for everyone.</p>
            </div>
          ) : (
            <>
              {/* Handle bar */}
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--border)', margin: '0 auto 24px' }} />

              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '2.8rem', marginBottom: '10px' }}>🎉</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px' }}>Order Picked Up!</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {feedbackOrder.outlet_name}
                </p>
              </div>

              {/* Star Rating */}
              <p style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                How was your experience?
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    className="qb-star-btn"
                    onClick={() => setFeedbackStars(n)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                      fontSize: feedbackStars >= n ? '2.4rem' : '2rem',
                      filter: n <= feedbackStars ? 'none' : 'grayscale(1) opacity(0.35)',
                      transform: feedbackStars === n ? 'scale(1.3)' : 'scale(1)',
                    }}>
                    ⭐
                  </button>
                ))}
              </div>
              <div style={{
                textAlign: 'center', height: '22px', marginBottom: '20px',
                fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)',
                transition: 'opacity 0.2s', opacity: feedbackStars ? 1 : 0,
              }}>
                {STAR_LABELS[feedbackStars]}
              </div>

              {/* Text area */}
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <textarea
                  placeholder="Share details about your experience... (optional)"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  maxLength={300}
                  rows={3}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '14px',
                    border: `1.5px solid ${feedbackText ? 'var(--primary)' : 'var(--border)'}`,
                    fontSize: '0.9rem', resize: 'none', boxSizing: 'border-box',
                    outline: 'none', background: 'var(--bg)', color: 'var(--text)',
                    fontFamily: 'inherit', lineHeight: 1.5, transition: 'border-color 0.2s',
                  }}
                />
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                {feedbackText.length}/300
              </div>

              {/* Submit */}
              <button
                onClick={handleFeedbackSubmit}
                disabled={!feedbackStars || feedbackSubmitting}
                style={{
                  width: '100%', padding: '15px', borderRadius: '16px', border: 'none',
                  background: feedbackStars
                    ? 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)'
                    : 'var(--border)',
                  color: 'white', fontWeight: 800, fontSize: '1rem',
                  cursor: feedbackStars ? 'pointer' : 'default',
                  marginBottom: '12px', transition: 'all 0.2s',
                  boxShadow: feedbackStars ? '0 4px 16px rgba(var(--primary-rgb, 99,61,255),0.35)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}>
                {feedbackSubmitting
                  ? <><div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.4)', borderTopColor: 'white' }} /> Submitting...</>
                  : '🚀 Submit Feedback'}
              </button>
              <button
                onClick={handleFeedbackSkip}
                style={{ width: '100%', padding: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    )}

    {/* ── Main Page ─────────────────────────────────────── */}
    
    <div className="orders-page pb-section" style={{ maxWidth: '560px', margin: '0 auto', padding: '0 16px' }}>
      <div className="menu-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Your Orders</h1>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh orders"
          aria-label="Refresh orders"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-white)',
            color: 'var(--primary)',
            cursor: isRefreshing ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            transition: 'transform 0.15s, border-color 0.15s, background 0.15s',
            opacity: isRefreshing ? 0.75 : 1,
          }}
        >
          <RefreshCw
            size={18}
            style={{
              animation: isRefreshing ? 'spin 0.55s linear infinite' : 'none',
              color: 'var(--primary)',
            }}
          />
        </button>
      </div>

      <div className="orders-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>
        {visibleOrders.map(order => {
          const isPlaced = order.status === 'Placed';
          const placedDate2 = new Date(order.placed_at?.endsWith('Z') ? order.placed_at : order.placed_at + 'Z');
          const nowIST2 = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
          const placedIST2 = new Date(placedDate2.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
          const isTodayOrder = placedIST2.toDateString() === nowIST2.toDateString();
          const canCancel = isPlaced && order.payment_status === 'PENDING' && isTodayOrder;

          return (
            <div key={order.id} className="order-card" style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid var(--border-light)' }}>

              {/* Token banner for active orders */}
              {(() => {
                const placedDate = new Date(
                  order.placed_at?.endsWith('Z') ? order.placed_at : order.placed_at + 'Z'
                );
                const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
                const placedIST = new Date(placedDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
                const isExpiredDay = placedIST.toDateString() !== nowIST.toDateString();

                if (isExpiredDay) {
                  return (
                    <div style={{
                      background: '#F5F5F5', borderRadius: 'var(--radius)',
                      padding: '12px 16px', marginBottom: '12px',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      border: '1px solid #E0E0E0'
                    }}>
                      <span style={{ fontSize: '1.4rem', filter: 'grayscale(1)' }}>🎫</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#757575' }}>
                          Token #{order.token_number} — Expired
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#9E9E9E', marginTop: '2px' }}>
                          Expired at midnight IST • No longer valid
                        </div>
                      </div>
                    </div>
                  );
                }

                if (['Placed', 'Preparing', 'Ready for Pickup'].includes(order.status) && order.payment_status === 'COMPLETED') {
                  return (
                    <div style={{
                      background: 'var(--primary)', color: 'white',
                      borderRadius: 'var(--radius)', padding: '12px 16px',
                      marginBottom: '12px', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between'
                    }}>
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
                  );
                }

                return (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px' }}>
                    Token #{order.token_number || order.id?.toString().slice(-3) || '---'}
                  </span>
                );
              })()}

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
                    background: (order.payment_status === 'COMPLETED' || ['Preparing', 'Ready for Pickup', 'Picked Up'].includes(order.status)) ? '#E8F5E9' : (order.status === 'Cancelled' ? '#ffebee' : '#FFF8E1'),
                    color: (order.payment_status === 'COMPLETED' || ['Preparing', 'Ready for Pickup', 'Picked Up'].includes(order.status)) ? '#2E7D32' : (order.status === 'Cancelled' ? '#d84315' : '#F57F17'), fontWeight: 700
                  }}>
                    {(order.payment_status === 'COMPLETED' || ['Preparing', 'Ready for Pickup', 'Picked Up'].includes(order.status)) ? 'Paid ✓' : (order.status === 'Cancelled' ? 'Cancelled' : 'Payment Pending')}
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
            </div>
          );
        })}
      </div>
    </div>
  </>
);
}