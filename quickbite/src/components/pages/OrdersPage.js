'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import * as orderService from '@/services/orderService';
import { Clock, RefreshCw } from 'lucide-react';


export default function OrdersPage({ navigate, showToast }) {
  const { orders, setOrders, loadOrders, isOrdersLoading, refreshAfterPayment } = useApp();
  const visibleOrders = orders.filter(o => o.payment_status !== 'PENDING');
  const [cancelingId, setCancelingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

  const { user } = useAuth();
  const { lastMessage } = useWebSocket('student', user?.id);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'STATUS_UPDATE') {
      // Instant optimistic update — token banner re-renders immediately
      setOrders(prev => prev.map(order =>
        order.id === lastMessage.order_id
          ? {
              ...order,
              status: lastMessage.status,
              payment_status: lastMessage.payment_status || order.payment_status,
            }
          : order
      ));
      if (showToast) showToast(lastMessage.message || `Order updated to ${lastMessage.status}!`, 'success');

      // Background reconcile — fetch fresh data silently so everything is accurate
      setTimeout(() => loadOrders(), 800);
    }

    if (lastMessage.type === 'PAYMENT_CONFIRMED') {
      // Payment just confirmed — refresh fully so token number appears
      setTimeout(() => loadOrders(), 500);
      if (showToast) showToast(lastMessage.message || 'Payment confirmed! 🎉', 'success');
    }
  }, [lastMessage]);

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
    <div className="orders-page pb-section" style={{ maxWidth: '560px', margin: '0 auto', padding: '0 16px' }}>
      <div className="menu-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Your Orders</h1>
        <button onClick={loadOrders} disabled={isOrdersLoading} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
          <RefreshCw size={20} className={isOrdersLoading ? 'pulse-red' : ''} />
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
  );
}