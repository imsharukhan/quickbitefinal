'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { pickupTimeSlots } from '@/data/mockData';

export default function CartPage({ navigate, showToast }) {
    const { cart, updateCartQuantity, removeFromCart, clearCart, cartTotal, placeOrder } = useApp();
    const [pickupTime, setPickupTime] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [placedOrder, setPlacedOrder] = useState(null);

    const handlePlaceOrder = () => {
        if (!pickupTime) { showToast('Please pick a time slot', 'error'); return; }
        if (!paymentMethod) { showToast('Please select how you want to pay', 'error'); return; }
        const order = placeOrder(pickupTime, paymentMethod);
        setPlacedOrder(order);
        setShowConfirmation(true);
        showToast('Order placed!');
    };

    if (showConfirmation && placedOrder) {
        return (
            <div className="page-container">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <div className="modal-content" style={{ boxShadow: 'var(--shadow-lg)' }}>
                        <div className="modal-icon">🎉</div>
                        <h2>Order Placed!</h2>
                        <p>Your order <strong>{placedOrder.id}</strong> is confirmed.</p>
                        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '14px', marginBottom: '18px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Pickup</span>
                                <span style={{ fontWeight: 600 }}>{placedOrder.pickupTime}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Payment</span>
                                <span style={{ fontWeight: 600 }}>{placedOrder.paymentMethod}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Total</span>
                                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{placedOrder.total}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={() => navigate('orders')} id="view-orders-btn">View Orders</button>
                            <button className="btn btn-secondary" onClick={() => { setShowConfirmation(false); navigate('home'); }}>Back to Home</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (cart.length === 0) {
        return (
            <div className="page-container cart-page">
                <div className="cart-empty">
                    <div className="empty-icon">🛒</div>
                    <h2>Nothing here yet</h2>
                    <p>Browse outlets and add something delicious.</p>
                    <button className="btn btn-primary" onClick={() => navigate('home')} id="browse-outlets-btn" style={{ marginTop: '8px' }}>
                        Browse Outlets
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container cart-page">
            <div className="menu-header">
                <button className="back-btn" onClick={() => navigate('home')} id="cart-back-btn">←</button>
                <div className="menu-header-info">
                    <h1>Your cart</h1>
                    <p>{cart.length} item{cart.length > 1 ? 's' : ''} from {cart[0]?.outletName}</p>
                </div>
            </div>

            <div style={{ marginTop: '16px' }}>
                {cart.map(item => (
                    <div key={item.id} className="cart-item" id={`cart-item-${item.id}`}>
                        <div className="cart-item-icon">{item.veg ? '🥬' : '🍗'}</div>
                        <div className="cart-item-details">
                            <h4>{item.name}</h4>
                            <span className="outlet-label">{item.outletName}</span>
                            <div className="price">₹{item.price * item.quantity}</div>
                        </div>
                        <div className="quantity-control">
                            <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>−</button>
                            <span>{item.quantity}</span>
                            <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>+</button>
                        </div>
                        <button className="remove-btn" onClick={() => removeFromCart(item.id)} title="Remove">✕</button>
                    </div>
                ))}
            </div>

            <div className="checkout-section">
                <h3>Pick a time</h3>
                <div className="time-slot-grid">
                    {pickupTimeSlots.slice(0, 12).map(slot => (
                        <button
                            key={slot}
                            className={`time-slot ${pickupTime === slot ? 'selected' : ''}`}
                            onClick={() => setPickupTime(slot)}
                        >
                            {slot}
                        </button>
                    ))}
                </div>

                <h3>Payment method</h3>
                <div className="payment-options">
                    {[
                        { id: 'upi', icon: '📱', label: 'UPI', sublabel: 'Google Pay, PhonePe, Paytm' },
                        { id: 'wallet', icon: '👛', label: 'Campus Wallet', sublabel: 'Balance: ₹2,000' },
                        { id: 'card', icon: '💳', label: 'Card', sublabel: 'Debit or Credit' },
                    ].map(opt => (
                        <div key={opt.id} className={`payment-option ${paymentMethod === opt.id ? 'selected' : ''}`} onClick={() => setPaymentMethod(opt.id)} id={`pay-${opt.id}`}>
                            <div className="radio-circle"></div>
                            <span className="pay-icon">{opt.icon}</span>
                            <div>
                                <div className="pay-label">{opt.label}</div>
                                <div className="pay-sublabel">{opt.sublabel}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="order-summary">
                    <div className="summary-row total"><span>Total</span><span>₹{cartTotal}</span></div>
                </div>

                <button className="btn btn-primary btn-block" onClick={handlePlaceOrder} disabled={!pickupTime || !paymentMethod} id="place-order-btn">
                    Place Order · ₹{cartTotal}
                </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <button className="btn btn-danger btn-sm" onClick={() => { clearCart(); showToast('Cart cleared', 'info'); }} id="clear-cart-btn">
                    Clear cart
                </button>
            </div>
        </div>
    );
}
