'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import * as outletService from '@/services/outletService';
import * as menuService from '@/services/menuService';

const PLATFORM_FEE = 7;
const PLATFORM_UPI_ID = 'sharukhansharukhan926@oksbi';

export default function CartPage({ navigate, showToast }) {
  const { cart, removeFromCart, updateCartQuantity, cartTotal, placeOrder, upiDeepLink, lastPlacedOrder, isSubmittingRef } = useApp();
  const { user } = useAuth();

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [outletClosed, setOutletClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (cart.length === 0) return;
    const outlet_id = cart[0].outletId;
    setSlotsLoading(true);
    Promise.all([
      outletService.getOutletById(outlet_id),
      menuService.getMenuByOutlet(outlet_id),
      outletService.getAvailableSlots(outlet_id)
    ]).then(([outletData, menuData, slotsData]) => {
      if (!outletData.is_open) {
        setOutletClosed(true);
        setClosedMessage(`${cart[0].outletName} is currently closed.`);
      } else {
        let unavailableItem = null;
        for (let item of cart) {
          const apiItem = menuData.find(m => m.id === item.id);
          if (!apiItem || !apiItem.is_available) { unavailableItem = item.name; break; }
        }
        if (unavailableItem) {
          setOutletClosed(true);
          setClosedMessage(`"${unavailableItem}" is no longer available. Please remove it.`);
        }
      }
      setSlots(slotsData || []);
    }).catch(() => {
      setOutletClosed(true);
      setClosedMessage('Failed to verify outlet status. Please try again.');
    }).finally(() => setSlotsLoading(false));
  }, [cart]);

  const handlePlaceOrder = async () => {
    if (!selectedSlot) { showToast('Please select a pickup time', 'error'); return; }
    if (isSubmittingRef.current) return;
    setLoading(true);
    try {
      await placeOrder(selectedSlot);
      setShowOrderConfirmation(true);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to place order', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ─── ORDER CONFIRMATION SCREEN ─── */
  if (showOrderConfirmation && lastPlacedOrder) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    // Use displayTotal (items + platform fee) set in AppContext
    const displayTotal = lastPlacedOrder.displayTotal || (lastPlacedOrder.total + PLATFORM_FEE);
    // GPay deep link
    const gpayLink = `upi://pay?pa=${PLATFORM_UPI_ID}&pn=${encodeURIComponent('QuickBite')}&am=${displayTotal}&cu=INR&tn=QuickBite%20${lastPlacedOrder.id}%20Token%23${lastPlacedOrder.token_number}`;

    return (
      <div className="qb-cart-page">
        <style>{confirmStyles}</style>

        <div className="qb-confirm-wrap">
          {/* Token */}
          <div className="qb-token-card">
            <p className="qb-token-label">Your Token Number</p>
            <div className="qb-token-number">
              #{lastPlacedOrder?.token_number ?? lastPlacedOrder?.id?.toString().slice(-3) ?? '—'}
            </div>
            <p className="qb-token-hint">Show this at the counter to collect your order</p>
          </div>

          {/* Order summary */}
          <div className="qb-confirm-details">
            <div className="qb-confirm-row"><span>Order ID</span><strong>{lastPlacedOrder.id}</strong></div>
            <div className="qb-confirm-row"><span>Name</span><strong>{user?.name}</strong></div>
            <div className="qb-confirm-row"><span>Reg No.</span><strong>{user?.register_number || '—'}</strong></div>
            <div className="qb-confirm-row"><span>Outlet</span><strong>{lastPlacedOrder.outletName || 'Campus Outlet'}</strong></div>
            <div className="qb-confirm-row"><span>Pickup</span><strong>{lastPlacedOrder.pickup_time || lastPlacedOrder.pickupTime}</strong></div>
            <div className="qb-confirm-row"><span>Item Total</span><strong>₹{lastPlacedOrder.total}</strong></div>
            <div className="qb-confirm-row"><span>Platform Fee</span><strong>₹{PLATFORM_FEE}</strong></div>
            <div className="qb-confirm-row total-row"><span>Total</span><strong>₹{displayTotal}</strong></div>
          </div>

          {/* Payment */}
          <div className="qb-upi-section">
            <p className="qb-upi-label">Complete your payment</p>

            {isMobile ? (
              /* Mobile: GPay deep link button */
              <button
                className="qb-gpay-btn"
                onClick={() => { window.location.href = gpayLink; }}
              >
                <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.7-3.9 6.1v5h6.3c3.7-3.4 5.8-8.4 6.2-14.8z" fill="#4285F4"/>
                  <path d="M24 44c5.4 0 9.9-1.8 13.2-4.8l-6.3-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H6.1v5.2C9.4 39.9 16.2 44 24 44z" fill="#34A853"/>
                  <path d="M12.6 27.7c-.4-1.2-.7-2.4-.7-3.7s.2-2.5.7-3.7v-5.2H6.1C4.8 17.5 4 20.7 4 24s.8 6.5 2.1 8.9l6.5-5.2z" fill="#FBBC05"/>
                  <path d="M24 12c3 0 5.7 1 7.8 3l5.8-5.8C34 6 29.4 4 24 4 16.2 4 9.4 8.1 6.1 15.1l6.5 5.2C14.2 15.6 18.7 12 24 12z" fill="#EA4335"/>
                </svg>
                Pay ₹{displayTotal} via Google Pay
              </button>
            ) : (
              /* Desktop: show UPI ID + copy button */
              <div className="qb-upi-copy">
                <div className="qb-upi-id-wrap">
                  <span className="qb-upi-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  </span>
                  <span className="qb-upi-id-text">{PLATFORM_UPI_ID}</span>
                </div>
                <button
                  className="qb-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(PLATFORM_UPI_ID);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy UPI ID'}
                </button>
              </div>
            )}

            <p className="qb-upi-note">After payment, vendor will confirm and your order will start being prepared.</p>
          </div>

          <button className="qb-view-orders-btn" onClick={() => { setShowOrderConfirmation(false); navigate('orders'); }}>
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  /* ─── EMPTY CART ─── */
  if (cart.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Looks like you haven't added anything yet.</p>
        <button className="btn btn-primary" onClick={() => navigate('home')} style={{ marginTop: '16px' }}>Browse Food</button>
      </div>
    );
  }

  const canOrder = selectedSlot && !outletClosed;

  /* ─── MAIN CART ─── */
  return (
    <div className="qb-cart-page">
      <style>{cartStyles}</style>

      {/* Header */}
      <div className="qb-cart-header">
        <button className="qb-back-btn" onClick={() => navigate('menu', { id: cart[0].outletId, name: cart[0].outletName })}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 className="qb-cart-title">Your cart</h1>
          <p className="qb-cart-subtitle">{cart.length} item{cart.length !== 1 ? 's' : ''} from {cart[0].outletName}</p>
        </div>
      </div>

      {/* Outlet closed warning */}
      {outletClosed && (
        <div className="qb-warning-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {closedMessage}
        </div>
      )}

      {/* Cart items */}
      <div className="qb-items-card">
        {cart.map((item, idx) => (
          <div key={item.id} className={`qb-cart-item ${idx < cart.length - 1 ? 'qb-cart-item--bordered' : ''}`}>
            <div className={`qb-veg-dot ${item.is_veg ? 'veg' : 'nonveg'}`}><span></span></div>
            <div className="qb-item-img"><span>{item.is_veg ? '🥗' : '🍗'}</span></div>
            <div className="qb-item-info">
              <p className="qb-item-name">{item.name}</p>
              <p className="qb-item-price">₹{item.price}</p>
            </div>
            <div className="qb-item-actions">
              <div className="qb-qty-control">
                <button className="qb-qty-btn" onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>−</button>
                <span className="qb-qty-val">{item.quantity}</span>
                <button className="qb-qty-btn" onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>+</button>
              </div>
              <button className="qb-remove-btn" onClick={() => removeFromCart(item.id)} title="Remove">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Time slot picker */}
      <div className="qb-section-card">
        <h2 className="qb-section-title">Pick a time</h2>
        {slotsLoading ? (
          <div className="qb-slots-skeleton">
            {[1,2,3,4,5,6].map(i => <div key={i} className="qb-slot-skel skeleton" />)}
          </div>
        ) : slots.length === 0 ? (
          <p className="qb-no-slots">No pickup slots available. Ordering is open 11:00 AM – 2:30 PM only.</p>
        ) : (
          <div className="qb-slots-grid">
            {slots.map(slot => (
              <button
                key={slot.time}
                className={`qb-slot-btn ${selectedSlot === slot.time ? 'selected' : ''}`}
                onClick={() => setSelectedSlot(slot.time)}
              >
                <span className="qb-slot-time">{slot.time}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Payment method */}
      <div className="qb-section-card">
        <h2 className="qb-section-title">Payment method</h2>
        <div className="qb-payment-option selected">
          <div className="qb-radio-dot selected"></div>
          <div className="qb-payment-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <div className="qb-payment-label">
            <span className="qb-pay-name">Pay via any UPI</span>
            <span className="qb-pay-sub">Google Pay, PhonePe, Paytm &amp; more</span>
          </div>
        </div>
      </div>

      {/* Bill summary */}
      <div className="qb-section-card">
        <h2 className="qb-section-title">Bill details</h2>
        <div className="qb-bill-row"><span>Item total</span><span>₹{cartTotal}</span></div>
        <div className="qb-bill-row"><span>Platform fee</span><span>₹{PLATFORM_FEE}</span></div>
        <div className="qb-bill-divider" />
        <div className="qb-bill-row total"><span>Total</span><span>₹{cartTotal + PLATFORM_FEE}</span></div>
      </div>

      {/* Place order button */}
      <div className="qb-place-order-wrap">
        <button
          className={`qb-place-order-btn ${!canOrder || loading ? 'disabled' : ''}`}
          disabled={!canOrder || loading}
          onClick={handlePlaceOrder}
        >
          {loading ? (
            <span className="qb-spinner" />
          ) : (
            <>Place Order • ₹{cartTotal + PLATFORM_FEE}</>
          )}
        </button>
        <button className="qb-clear-btn" onClick={() => { if (window.confirm('Clear cart?')) { cart.forEach(i => removeFromCart(i.id)); navigate('home'); } }}>
          Clear cart
        </button>
      </div>
    </div>
  );
}

/* ─── STYLES ─── */
const cartStyles = `
.qb-cart-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px 16px 160px;
}
.qb-cart-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 0 20px;
}
.qb-back-btn {
  width: 38px; height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-white);
  color: var(--text);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.18s;
}
.qb-back-btn:hover { border-color: var(--primary); color: var(--primary); }
.qb-cart-title { font-size: 1.35rem; font-weight: 700; line-height: 1.2; }
.qb-cart-subtitle { font-size: 0.82rem; color: var(--text-muted); margin-top: 2px; }

.qb-warning-banner {
  display: flex; align-items: center; gap: 8px;
  background: #FFF3E0; color: #C75000;
  border-radius: 8px; padding: 11px 14px;
  font-size: 0.82rem; font-weight: 600; margin-bottom: 14px;
}

.qb-items-card {
  background: var(--bg-white);
  border: 1px solid var(--border-light);
  border-radius: 14px; overflow: hidden; margin-bottom: 12px;
}
.qb-cart-item {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
}
.qb-cart-item--bordered { border-bottom: 1px solid var(--border-light); }
.qb-veg-dot {
  width: 16px; height: 16px; border-radius: 3px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.qb-veg-dot.veg { border: 1.5px solid #2B8A3E; }
.qb-veg-dot.nonveg { border: 1.5px solid #D63031; }
.qb-veg-dot.veg span { width: 8px; height: 8px; border-radius: 50%; background: #2B8A3E; display: block; }
.qb-veg-dot.nonveg span {
  width: 0; height: 0;
  border-left: 4px solid transparent; border-right: 4px solid transparent;
  border-bottom: 7px solid #D63031; display: block;
}
.qb-item-img {
  width: 44px; height: 44px; border-radius: 10px;
  background: var(--bg); display: flex; align-items: center;
  justify-content: center; font-size: 1.3rem; flex-shrink: 0;
}
.qb-item-info { flex: 1; min-width: 0; }
.qb-item-name { font-size: 0.9rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qb-item-price { font-size: 0.85rem; color: var(--primary); font-weight: 600; margin-top: 2px; }
.qb-item-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.qb-qty-control {
  display: flex; align-items: center;
  border: 1.5px solid var(--primary); border-radius: 8px; overflow: hidden;
}
.qb-qty-btn {
  width: 30px; height: 30px; background: none; color: var(--primary);
  font-size: 1.1rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; transition: background 0.15s;
}
.qb-qty-btn:hover { background: var(--primary-bg); }
.qb-qty-val { min-width: 26px; text-align: center; font-size: 0.85rem; font-weight: 700; color: var(--primary); }
.qb-remove-btn {
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--red-bg); color: var(--red);
  display: flex; align-items: center; justify-content: center; transition: background 0.15s;
}
.qb-remove-btn:hover { background: var(--red); color: white; }

.qb-section-card {
  background: var(--bg-white); border: 1px solid var(--border-light);
  border-radius: 14px; padding: 18px; margin-bottom: 12px;
}
.qb-section-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 14px; color: var(--text); }

.qb-slots-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
@media (min-width: 400px) { .qb-slots-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 500px) { .qb-slots-grid { grid-template-columns: repeat(5, 1fr); } }

.qb-slot-btn {
  display: flex; flex-direction: column; align-items: center;
  padding: 10px 6px; border-radius: 10px;
  border: 1.5px solid var(--border); background: var(--bg-white);
  color: var(--text-secondary); cursor: pointer; transition: all 0.15s;
}
.qb-slot-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-bg); }
.qb-slot-btn.selected { border-color: var(--primary); background: var(--primary-bg); color: var(--primary); }
.qb-slot-time { font-size: 0.75rem; font-weight: 600; }
.qb-no-slots { font-size: 0.85rem; color: var(--text-muted); }
.qb-slots-skeleton { display: flex; gap: 8px; flex-wrap: wrap; }
.qb-slot-skel { width: 72px; height: 44px; border-radius: 10px; }

.qb-payment-option {
  display: flex; align-items: center; gap: 12px;
  padding: 14px; border-radius: 10px;
  border: 1.5px solid var(--primary); background: var(--primary-bg);
}
.qb-radio-dot {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--text-muted); flex-shrink: 0; position: relative; transition: border-color 0.15s;
}
.qb-radio-dot.selected { border-color: var(--primary); }
.qb-radio-dot.selected::after {
  content: ''; width: 9px; height: 9px; border-radius: 50%;
  background: var(--primary); position: absolute;
  top: 50%; left: 50%; transform: translate(-50%, -50%);
}
.qb-payment-icon { color: var(--primary); display: flex; align-items: center; }
.qb-payment-label { display: flex; flex-direction: column; }
.qb-pay-name { font-size: 0.9rem; font-weight: 600; color: var(--text); }
.qb-pay-sub { font-size: 0.72rem; color: var(--text-muted); margin-top: 1px; }

.qb-bill-row {
  display: flex; justify-content: space-between;
  font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;
}
.qb-bill-row.total {
  font-size: 1rem; font-weight: 700; color: var(--text); margin-bottom: 0; margin-top: 4px;
}
.qb-bill-divider { border-top: 1px dashed var(--border); margin: 10px 0; }

.qb-place-order-wrap {
  position: fixed; bottom: 60px; left: 0; right: 0;
  background: var(--bg-white); border-top: 1px solid var(--border-light);
  padding: 12px 16px; display: flex; flex-direction: column;
  align-items: center; gap: 8px; z-index: 50;
}
@media (min-width: 769px) {
  .qb-place-order-wrap { position: static; border-top: none; background: transparent; padding: 8px 0 40px; bottom: auto; }
}
.qb-place-order-btn {
  width: 100%; max-width: 520px; padding: 16px 24px;
  border-radius: 12px; background: var(--primary); color: white;
  font-size: 1rem; font-weight: 700; border: none; cursor: pointer;
  transition: background 0.18s, opacity 0.18s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.qb-place-order-btn:hover:not(.disabled) { background: var(--primary-dark); }
.qb-place-order-btn.disabled { opacity: 0.45; cursor: not-allowed; }
.qb-clear-btn {
  background: none; border: none; color: var(--red);
  font-size: 0.82rem; font-weight: 600; cursor: pointer; opacity: 0.8;
}
.qb-clear-btn:hover { opacity: 1; }
.qb-spinner {
  width: 20px; height: 20px;
  border: 2.5px solid rgba(255,255,255,0.35); border-top-color: white;
  border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
`;

const confirmStyles = `
.qb-cart-page {
  max-width: 480px; margin: 0 auto; padding: 24px 16px 40px;
}
.qb-confirm-wrap { display: flex; flex-direction: column; gap: 14px; }
.qb-token-card {
  background: var(--primary); color: white;
  border-radius: 18px; padding: 32px 24px; text-align: center;
}
.qb-token-label {
  font-size: 0.75rem; font-weight: 700; letter-spacing: 1.2px;
  text-transform: uppercase; opacity: 0.8; margin-bottom: 8px;
}
.qb-token-number {
  font-size: 5.5rem; font-weight: 900; line-height: 1;
  letter-spacing: -2px; margin-bottom: 10px;
}
.qb-token-hint { font-size: 0.8rem; opacity: 0.75; }
.qb-confirm-details {
  background: var(--bg-white); border: 1px solid var(--border-light);
  border-radius: 14px; padding: 16px;
}
.qb-confirm-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 9px 0; border-bottom: 1px solid var(--border-light); font-size: 0.85rem;
}
.qb-confirm-row:last-child { border-bottom: none; }
.qb-confirm-row span { color: var(--text-secondary); }
.qb-confirm-row strong { font-weight: 600; text-align: right; max-width: 65%; }
.qb-confirm-row.total-row strong { color: var(--primary); font-size: 1rem; }

.qb-upi-section {
  background: var(--bg-white); border: 1px solid var(--border-light);
  border-radius: 14px; padding: 18px;
}
.qb-upi-label {
  font-size: 0.78rem; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;
}
.qb-gpay-btn {
  width: 100%; padding: 15px; border-radius: 12px;
  background: #1A73E8; color: white;
  font-size: 1rem; font-weight: 700; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  transition: background 0.18s;
}
.qb-gpay-btn:hover { background: #1557B0; }
.qb-upi-copy {
  display: flex; align-items: center; gap: 10px;
  border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;
}
.qb-upi-id-wrap { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.qb-upi-icon { color: var(--text-muted); flex-shrink: 0; display: flex; }
.qb-upi-id-text {
  font-size: 0.9rem; font-weight: 600; font-family: monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.qb-copy-btn {
  padding: 7px 14px; border-radius: 8px;
  border: 1.5px solid var(--primary); background: var(--primary-bg);
  color: var(--primary); font-size: 0.78rem; font-weight: 700;
  cursor: pointer; flex-shrink: 0; transition: all 0.15s;
}
.qb-copy-btn:hover { background: var(--primary); color: white; }
.qb-upi-note { font-size: 0.75rem; color: var(--text-muted); margin-top: 12px; line-height: 1.5; }
.qb-view-orders-btn {
  width: 100%; padding: 14px; border-radius: 12px;
  border: 1.5px solid var(--border); background: var(--bg-white);
  color: var(--text); font-size: 0.9rem; font-weight: 600;
  cursor: pointer; transition: border-color 0.15s;
}
.qb-view-orders-btn:hover { border-color: var(--primary); color: var(--primary); }
`;