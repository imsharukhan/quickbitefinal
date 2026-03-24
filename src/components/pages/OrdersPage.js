'use client';
import { useApp } from '@/context/AppContext';
import { ORDER_STATUS } from '@/data/mockData';

const statusSteps = [
    ORDER_STATUS.PLACED,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PREPARING,
    ORDER_STATUS.READY,
    ORDER_STATUS.PICKED_UP,
];

const statusEmojis = {
    [ORDER_STATUS.PLACED]: '📝',
    [ORDER_STATUS.CONFIRMED]: '✅',
    [ORDER_STATUS.PREPARING]: '🍳',
    [ORDER_STATUS.READY]: '🎉',
    [ORDER_STATUS.PICKED_UP]: '✨',
    [ORDER_STATUS.CANCELLED]: '❌',
};

function getStatusClass(status) {
    const map = {
        [ORDER_STATUS.PLACED]: 'placed',
        [ORDER_STATUS.CONFIRMED]: 'confirmed',
        [ORDER_STATUS.PREPARING]: 'preparing',
        [ORDER_STATUS.READY]: 'ready',
        [ORDER_STATUS.PICKED_UP]: 'picked_up',
        [ORDER_STATUS.CANCELLED]: 'cancelled',
    };
    return map[status] || 'placed';
}

function formatTime(isoString) {
    try {
        const date = new Date(isoString);
        return date.toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

export default function OrdersPage({ navigate }) {
    const { orders } = useApp();

    if (orders.length === 0) {
        return (
            <div className="page-container orders-page">
                <div className="menu-header animate-fade-in">
                    <div className="menu-header-info">
                        <h1>My Orders</h1>
                        <p>Track your campus food orders</p>
                    </div>
                </div>
                <div className="empty-state animate-slide-up">
                    <div className="empty-icon">📋</div>
                    <h3>No orders yet</h3>
                    <p>Your order history will appear here once you place your first order.</p>
                    <button className="btn btn-primary" onClick={() => navigate('home')} style={{ marginTop: '16px' }} id="order-browse-btn">
                        Browse Outlets
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container orders-page">
            <div className="menu-header animate-fade-in">
                <div className="menu-header-info">
                    <h1>My Orders</h1>
                    <p>{orders.length} order{orders.length > 1 ? 's' : ''}</p>
                </div>
            </div>

            <div className="stagger-children" style={{ marginTop: '20px' }}>
                {orders.map(order => {
                    const currentStepIndex = statusSteps.indexOf(order.status);
                    const isCancelled = order.status === ORDER_STATUS.CANCELLED;

                    return (
                        <div key={order.id} className="order-card" id={`order-${order.id}`}>
                            <div className="order-card-header">
                                <div>
                                    <div className="order-id">{order.id}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {order.outletName}
                                    </div>
                                </div>
                                <span className={`order-status-badge ${getStatusClass(order.status)}`}>
                                    {statusEmojis[order.status]} {order.status}
                                </span>
                            </div>

                            {/* Timeline (only show if not cancelled) */}
                            {!isCancelled && (
                                <div className="order-timeline">
                                    {statusSteps.map((step, idx) => (
                                        <div key={step} className="timeline-step">
                                            <div className={`timeline-dot ${idx < currentStepIndex ? 'completed' : idx === currentStepIndex ? 'active' : ''}`}>
                                                {idx < currentStepIndex ? '✓' : idx === currentStepIndex ? statusEmojis[step] : ''}
                                            </div>
                                            <div className={`timeline-label ${idx === currentStepIndex ? 'active' : ''}`}>
                                                {step}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Order Items */}
                            <div className="order-items-list">
                                {order.items.map(item => (
                                    <div key={item.id} className="order-item-row">
                                        <span>{item.name} × {item.quantity}</span>
                                        <span>₹{item.price * item.quantity}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Meta */}
                            <div className="order-meta">
                                <span>🕐 Pickup: {order.pickupTime}</span>
                                <span>📅 {formatTime(order.placedAt)}</span>
                                <span>💳 {order.paymentMethod}</span>
                                <span className="order-total">₹{order.total}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
