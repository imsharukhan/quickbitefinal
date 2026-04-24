'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import * as outletService from '@/services/outletService';
import * as menuService from '@/services/menuService';
import * as paymentService from '@/services/paymentService';
import { loadRazorpayScript, openRazorpayCheckout } from '@/utils/razorpay';

const RAZORPAY_RATE = 0.0236;

export default function CartPage({ navigate, showToast }) {
  const { cart, removeFromCart, updateCartQuantity, cartTotal, grandTotal, placeOrder, clearCart, isSubmittingRef, refreshAfterPayment, processingFee } = useApp();

  const getCategoryImg = (catName) => {
    if (!catName) return null;
    const clean = catName.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
    const valid = ['breakfast', 'rice_meals', 'breads_rotis', 'snacks_starters', 'desserts_sweets', 'drinks_beverages'];
    return valid.includes(clean) ? `/categories/${clean}.png` : '/categories/other.png';
  };
  const { user } = useAuth();

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [outletClosed, setOutletClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
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
    setPaymentLoading(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        showToast('Failed to load payment gateway. Please try again.', 'error');
        setLoading(false);
        setPaymentLoading(false);
        return;
      }

      const totalWithFee = grandTotal;
      const createdOrder = await placeOrder(selectedSlot, totalWithFee);
      const orderId = createdOrder?.id;

      if (!orderId) {
        showToast('Order creation failed. Please try again.', 'error');
        setLoading(false);
        setPaymentLoading(false);
        return;
      }

      const rzpData = await paymentService.createPaymentOrder(orderId);
      setLoading(false);

      openRazorpayCheckout({
        rzpData,
        orderId,
        userName: user?.student_profile?.name || user?.name || '',
        userEmail: user?.email || '',

        onSuccess: (razorpayResponse) => {
          setTimeout(async () => {
          try {
            showToast('Verifying payment...', 'info');
            await paymentService.verifyPayment({
              razorpay_order_id: razorpayResponse.razorpay_order_id,
              razorpay_payment_id: razorpayResponse.razorpay_payment_id,
              razorpay_signature: razorpayResponse.razorpay_signature,
              order_id: orderId,
            });
            clearCart();
            showToast('Payment successful! 🎉', 'success');
            await refreshAfterPayment();
            setPaymentLoading(false);
            navigate('orders');
          } catch (err) {
            // Verify failed but Razorpay confirmed — webhook will mark it COMPLETED
            clearCart();
            showToast('Payment received! Your order will appear in Orders shortly.', 'info');
            setPaymentLoading(false);
            navigate('orders');
          }
          }, 400); // wait for Razorpay modal to fully close on mobile
        },

        onDismiss: async () => {
          // On mobile (especially GPay), payment may have succeeded even if dismissed
          // Silently check order status before showing "cancelled"
          try {
            const { getOrderById } = await import('@/services/orderService');
            const latestOrder = await getOrderById(orderId);
            if (latestOrder?.payment_status === 'COMPLETED') {
              clearCart();
              showToast('Payment successful! 🎉', 'success');
              await refreshAfterPayment();
              setPaymentLoading(false);
              navigate('orders');
              return;
            }
          } catch (_) {}
          setLoading(false);
          setPaymentLoading(false);
          showToast('Payment cancelled. Tap "Place Order" to try again.', 'info');
        },
      });

    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to place order', 'error');
      setLoading(false);
      setPaymentLoading(false);
    }
  };

  /* ─── EMPTY CART ─── */
  if (cart.length === 0) {
    if (paymentLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: '16px' }}>
          <div className="qb-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(0,0,0,0.08)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600 }}>Processing your payment...</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Please don't close this page</p>
        </div>
      );
    }
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

  const istTimeString = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  const [istHours, istMinutes] = istTimeString.split(':').map(Number);
  const currentMinutes = istHours * 60 + istMinutes;

  const parseTimeToMinutes = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (hours === 12) hours = modifier === 'PM' ? 12 : 0;
    else if (modifier === 'PM') hours += 12;
    return hours * 60 + minutes;
  };

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
            <div className="qb-item-img">
              {item.image_url
                ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                : getCategoryImg(item.category)
                  ? <img src={getCategoryImg(item.category)} alt={item.category} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }} />
                  : <span>{item.is_veg ? '🥗' : '🍗'}</span>
              }
            </div>
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
          <p className="qb-no-slots">Ordering is Closed. Available only between 11:00 AM – 3:00 PM.</p>
        ) : (
          <div className="qb-slots-grid">
            {slots.map(slot => {
              const slotMinutes = parseTimeToMinutes(slot.time);
              const isPast = slotMinutes < currentMinutes;

              return (
                <button
                  key={slot.time}
                  className={`qb-slot-btn ${selectedSlot === slot.time ? 'selected' : ''} ${isPast ? 'disabled' : ''}`}
                  onClick={() => { if (!isPast) setSelectedSlot(slot.time); }}
                  disabled={isPast}
                >
                  <span className="qb-slot-time">{slot.time}</span>
                </button>
              );
            })}
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
        <div className="qb-bill-row">
          <span>Processing fee (2.36%)</span>
          <span>₹{processingFee}</span>
        </div>
        <div className="qb-bill-divider" />
        <div className="qb-bill-row total"><span>Total</span><span>₹{grandTotal}</span></div>
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
            <>Place Order • ₹{grandTotal}</>
          )}
        </button>
        {showClearConfirm ? (
          <div className="qb-clear-confirm">
            <span>Remove all items?</span>
            <button className="qb-clear-yes" onClick={() => { cart.forEach(i => removeFromCart(i.id)); navigate('home'); }}>Yes, clear</button>
            <button className="qb-clear-no" onClick={() => setShowClearConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <button className="qb-clear-btn" onClick={() => setShowClearConfirm(true)}>
            Clear cart
          </button>
        )}
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
  overflow: hidden;
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
.qb-slot-btn.disabled { opacity: 0.4; cursor: not-allowed; background: var(--bg); border-color: var(--border-light); color: var(--text-muted); }
.qb-slot-btn.disabled:hover { background: var(--bg); border-color: var(--border-light); color: var(--text-muted); }
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
.qb-clear-confirm {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.82rem; color: var(--text-secondary);
}
.qb-clear-yes {
  background: var(--red); color: white;
  border: none; border-radius: 6px;
  padding: 5px 12px; font-size: 0.78rem; font-weight: 600; cursor: pointer;
}
.qb-clear-no {
  background: none; border: 1px solid var(--border);
  border-radius: 6px; padding: 5px 12px;
  font-size: 0.78rem; font-weight: 600; cursor: pointer; color: var(--text-secondary);
}
`;