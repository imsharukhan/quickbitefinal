'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ORDER_STATUS } from '@/data/mockData';

export default function VendorDashboard({ showToast }) {
    const { orders, updateOrderStatus } = useApp();
    const [filterStatus, setFilterStatus] = useState('all');

    const activeOrders = orders.filter(o => o.status !== ORDER_STATUS.PICKED_UP && o.status !== ORDER_STATUS.CANCELLED);
    const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);

    const stats = {
        total: orders.length,
        active: activeOrders.length,
        preparing: orders.filter(o => o.status === ORDER_STATUS.PREPARING).length,
        completed: orders.filter(o => o.status === ORDER_STATUS.PICKED_UP).length,
        revenue: orders.filter(o => o.status !== ORDER_STATUS.CANCELLED).reduce((s, o) => s + o.total, 0),
    };

    const getNextAction = (status) => {
        switch (status) {
            case ORDER_STATUS.PLACED: return { label: 'Accept', newStatus: ORDER_STATUS.CONFIRMED, className: 'btn-accept' };
            case ORDER_STATUS.CONFIRMED: return { label: 'Start Preparing', newStatus: ORDER_STATUS.PREPARING, className: 'btn-prepare' };
            case ORDER_STATUS.PREPARING: return { label: 'Mark Ready', newStatus: ORDER_STATUS.READY, className: 'btn-ready' };
            case ORDER_STATUS.READY: return { label: 'Complete', newStatus: ORDER_STATUS.PICKED_UP, className: 'btn-complete' };
            default: return null;
        }
    };

    const handleAction = (orderId, newStatus) => { updateOrderStatus(orderId, newStatus); showToast(`Order updated`); };
    const handleCancel = (orderId) => { updateOrderStatus(orderId, ORDER_STATUS.CANCELLED); showToast('Order cancelled', 'error'); };

    const statusFilters = [
        { label: 'All', value: 'all' },
        { label: 'New', value: ORDER_STATUS.PLACED },
        { label: 'Confirmed', value: ORDER_STATUS.CONFIRMED },
        { label: 'Preparing', value: ORDER_STATUS.PREPARING },
        { label: 'Ready', value: ORDER_STATUS.READY },
        { label: 'Completed', value: ORDER_STATUS.PICKED_UP },
    ];

    const getStatusClass = (status) => {
        const m = { [ORDER_STATUS.PLACED]: 'placed', [ORDER_STATUS.CONFIRMED]: 'confirmed', [ORDER_STATUS.PREPARING]: 'preparing', [ORDER_STATUS.READY]: 'ready', [ORDER_STATUS.PICKED_UP]: 'picked_up', [ORDER_STATUS.CANCELLED]: 'cancelled' };
        return m[status] || 'placed';
    };

    return (
        <div className="page-container vendor-dashboard">
            <div className="menu-header" style={{ marginBottom: '20px' }}>
                <div className="menu-header-info">
                    <h1>Dashboard</h1>
                    <p>Manage incoming orders</p>
                </div>
            </div>

            <div className="vendor-stats">
                <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total</div></div>
                <div className="stat-card"><div className="stat-value">{stats.active}</div><div className="stat-label">Active</div></div>
                <div className="stat-card"><div className="stat-value">{stats.preparing}</div><div className="stat-label">Preparing</div></div>
                <div className="stat-card"><div className="stat-value">{stats.completed}</div><div className="stat-label">Done</div></div>
                <div className="stat-card"><div className="stat-value">₹{stats.revenue}</div><div className="stat-label">Revenue</div></div>
            </div>

            <div className="filter-tabs">
                {statusFilters.map(f => (
                    <button key={f.value} className={`filter-tab ${filterStatus === f.value ? 'active' : ''}`} onClick={() => setFilterStatus(f.value)}>
                        {f.label}
                    </button>
                ))}
            </div>

            {filteredOrders.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No orders yet</h3>
                    <p>Switch to Student mode and place a test order to see it here.</p>
                </div>
            ) : (
                <div>
                    {filteredOrders.map(order => {
                        const action = getNextAction(order.status);
                        return (
                            <div key={order.id} className="vendor-order-card" id={`vendor-order-${order.id}`}>
                                <div className="vendor-order-header">
                                    <div className="student-info">
                                        <div className="student-avatar">{order.studentName ? order.studentName.charAt(0) : 'S'}</div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{order.id}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.studentName || 'Student'} · {order.studentId || ''}</div>
                                        </div>
                                    </div>
                                    <span className={`order-status-badge ${getStatusClass(order.status)}`}>{order.status}</span>
                                </div>

                                <div className="order-items-list">
                                    {order.items.map(item => (
                                        <div key={item.id} className="order-item-row">
                                            <span>{item.veg ? '●' : '●'} {item.name} × {item.quantity}</span>
                                            <span>₹{item.price * item.quantity}</span>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Pickup: {order.pickupTime} · {order.paymentMethod}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 700 }}>₹{order.total}</span>
                                        <div className="vendor-order-actions">
                                            {action && (
                                                <button className={action.className} onClick={() => handleAction(order.id, action.newStatus)} id={`action-${order.id}`}>
                                                    {action.label}
                                                </button>
                                            )}
                                            {order.status !== ORDER_STATUS.PICKED_UP && order.status !== ORDER_STATUS.CANCELLED && (
                                                <button
                                                    style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', fontWeight: 600 }}
                                                    onClick={() => handleCancel(order.id)}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
