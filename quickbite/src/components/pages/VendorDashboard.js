'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import * as outletManagementService from '@/services/outletManagementService';
import * as orderSvc from '@/services/orderService';
import * as menuMgmt from '@/services/menuManagementService';
import { useWebSocket } from '@/hooks/useWebSocket';
 
const MENU_CATEGORIES = [
  'Breakfast', 'Rice & Meals', 'Breads & Rotis',
  'Snacks & Starters', 'Desserts & Sweets', 'Drinks & Beverages', 'Other',
];
 
const CATEGORY_EMOJI = {
  'Breakfast': '🍳', 'Rice & Meals': '🍛', 'Breads & Rotis': '🫓',
  'Snacks & Starters': '🍟', 'Desserts & Sweets': '🍮',
  'Drinks & Beverages': '🥤', 'Other': '🍽️',
};
 
// ── Same map as MenuPage — keep in sync ─────────────────────────────
const CATEGORY_IMAGE = {
  'Breakfast':          '/categories/breakfast.jpg',
  'Rice & Meals':       '/categories/rice_meals.jpg',
  'Breads & Rotis':     '/categories/breads_rotis.jpg',
  'Snacks & Starters':  '/categories/snacks_starters.jpg',
  'Desserts & Sweets':  '/categories/desserts_sweets.jpg',
  'Drinks & Beverages': '/categories/drinks_beverages.jpg',
  'Other':              '/categories/other.png',
};
const FALLBACK_IMAGE = '/categories/other.png';
 
export default function VendorDashboard({ showToast }) {
    const { user, logout } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [outlets, setOutlets] = useState([]);
    const [selectedOutlet, setSelectedOutlet] = useState(null);
    const [orders, setOrders] = useState([]);
    const [menu, setMenu] = useState([]);
    const [stats, setStats] = useState({ orders_today: 0, active_orders: 0, preparing_orders: 0, revenue_today: 0 });
 
    const [activeTab, setActiveTab] = useState('orders');
    const [filterStatus, setFilterStatus] = useState('all');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [revenueVisible, setRevenueVisible] = useState(true);
 
    const [showAddItem, setShowAddItem] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: 'Breakfast', is_veg: true, is_bestseller: false });
    const [outletForm, setOutletForm] = useState({ upi_id: '', opening_time: '', closing_time: '', max_orders_per_slot: 10 });
 
    const { lastMessage } = useWebSocket('vendor', user?.id);
 
    useEffect(() => {
        if (!user) return;
        outletManagementService.getMyOutlets().then(data => {
            const myOutlets = data.filter(o => o.vendor_id === user.id);
            setOutlets(myOutlets);
            if (myOutlets.length > 0) setSelectedOutlet(myOutlets[0]);
            else setLoading(false);
        });
    }, [user]);
 
    const loadOutletData = async () => {
        if (!selectedOutlet) return;
        setLoading(true);
        try {
            const [oData, mData, sData] = await Promise.all([
                orderSvc.getOutletOrders(selectedOutlet.id),
                menuMgmt.getFullMenu(selectedOutlet.id),
                orderSvc.getOutletStats(selectedOutlet.id).catch(() => stats)
            ]);
            setOrders(oData || []);
            setMenu(mData || []);
            if (sData) setStats(sData);
            setOutletForm({
                upi_id: selectedOutlet.upi_id || '',
                opening_time: selectedOutlet.opening_time || '08:00',
                closing_time: selectedOutlet.closing_time || '20:00',
                max_orders_per_slot: selectedOutlet.max_orders_per_slot || 10,
            });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };
 
    useEffect(() => { loadOutletData(); }, [selectedOutlet]);
 
    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'NEW_ORDER') {
            try { new Audio('/notification.mp3').play().catch(() => {}); } catch (e) {}
            loadOutletData();
            showToast(`New order! Token #${lastMessage.order?.token_number || '—'}`, 'success');
        } else if (lastMessage.type === 'STATUS_UPDATE') {
            loadOutletData();
        }
    }, [lastMessage]);
 
    if (!loading && outlets.length === 0) {
        return (
            <div className="empty-state" style={{ height: '80vh' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏪</div>
                <h3>No outlet assigned</h3>
                <p>Contact admin to set up your outlet.</p>
            </div>
        );
    }
 
    const handleOrderAction = async (orderId, newStatus, currentStatus) => {
        setActionLoading(orderId);
        try {
            if (currentStatus === 'Placed') await orderSvc.confirmPayment(orderId);
            else await orderSvc.updateOrderStatus(orderId, newStatus);
            await loadOutletData();
            showToast('Order updated ✅');
        } catch (e) { showToast('Failed to update order', 'error'); }
        finally { setActionLoading(null); }
    };
 
    const handleCancelOrder = async (orderId) => {
        if (!window.confirm('Cancel this order?')) return;
        setActionLoading(orderId);
        try {
            await orderSvc.cancelOrderVendor(orderId, 'Vendor cancelled');
            await loadOutletData();
            showToast('Order cancelled');
        } catch (e) { showToast('Failed to cancel', 'error'); }
        finally { setActionLoading(null); }
    };
 
    const handleToggleMenu = async (itemId) => {
        try {
            await menuMgmt.toggleAvailability(itemId);
            setMenu(prev => prev.map(m => m.id === itemId ? { ...m, is_available: !m.is_available } : m));
            showToast('Updated ✅');
        } catch (e) { showToast('Failed', 'error'); }
    };
 
    const handleSaveNewItem = async () => {
        if (!newItem.name || !newItem.price || !newItem.category) {
            showToast('Fill all required fields', 'error'); return;
        }
        if (isSaving) return;
        setIsSaving(true);
        try {
            const added = await menuMgmt.addMenuItem(selectedOutlet.id, { ...newItem, price: parseFloat(newItem.price) });
            setMenu(prev => [...prev, added]);
            setShowAddItem(false);
            setNewItem({ name: '', description: '', price: '', category: 'Breakfast', is_veg: true, is_bestseller: false });
            showToast('Item added ✅');
        } catch (e) {
            showToast(e?.response?.data?.detail || 'Failed to add item', 'error');
        } finally {
            setIsSaving(false);
        }
    };
 
    const handleToggleOutlet = async () => {
        try {
            const updated = await outletManagementService.toggleOutletOpen(selectedOutlet.id);
            setSelectedOutlet(prev => ({ ...prev, is_open: updated.is_open }));
            showToast(`Outlet is now ${updated.is_open ? 'OPEN 🟢' : 'CLOSED 🔴'}`);
        } catch (e) { showToast('Failed', 'error'); }
    };
 
    const handleSaveOutlet = async () => {
        try {
            await outletManagementService.updateOutlet(selectedOutlet.id, outletForm);
            setSelectedOutlet(prev => ({ ...prev, ...outletForm }));
            showToast('Settings saved ✅');
        } catch (e) { showToast('Failed to save', 'error'); }
    };
 
    const handleDeleteItem = async (itemId, itemName) => {
        if (!window.confirm(`Delete "${itemName}"? This cannot be undone.`)) return;
        try {
            await menuMgmt.deleteMenuItem(itemId);
            setMenu(prev => prev.filter(m => m.id !== itemId));
            showToast('Item deleted');
        } catch (e) { showToast('Failed to delete', 'error'); }
    };
 
    const handleLogout = async () => {
        if (!window.confirm('Are you sure you want to logout?')) return;
        await logout();
    };
 
    const getNextAction = (status) => {
        if (status === 'Placed') return { label: '✅ Confirm Payment', newStatus: 'Preparing', bg: 'var(--green)', color: 'white' };
        if (status === 'Preparing') return { label: '🔔 Mark Ready', newStatus: 'Ready for Pickup', bg: 'var(--primary)', color: 'white' };
        if (status === 'Ready for Pickup') return { label: '✓ Complete', newStatus: 'Picked Up', bg: '#1b5e20', color: 'white' };
        return null;
    };
 
    const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);
 
    const menuByCategory = MENU_CATEGORIES.reduce((acc, cat) => {
        const items = menu.filter(m => m.category === cat);
        if (items.length > 0) acc[cat] = items;
        return acc;
    }, {});
 
    const totalMenuItems = menu.length;
    const availableItems = menu.filter(m => m.is_available).length;
 
    const inputStyle = {
        width: '100%', padding: '10px 12px',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        fontSize: '0.875rem', marginBottom: '10px',
        boxSizing: 'border-box', outline: 'none', background: 'var(--bg)',
        color: 'var(--text)',
    };
 
    // Current category image for preview in add-item form
    const previewImg = CATEGORY_IMAGE[newItem.category] || FALLBACK_IMAGE;
 
    return (
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: '70px 12px 40px' }}>
 
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                {outlets.length > 1 ? (
                    <select value={selectedOutlet?.id || ''}
                        onChange={e => setSelectedOutlet(outlets.find(o => o.id === e.target.value))}
                        style={{ padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '1rem', fontWeight: 700, flex: 1 }}>
                        {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                ) : (
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{selectedOutlet?.name || 'Dashboard'}</h1>
                )}
            </div>
 
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {[
                    { label: 'Today', value: stats.orders_today || 0, color: 'var(--primary)' },
                    { label: 'Active', value: stats.active_orders || 0, color: 'var(--blue)' },
                    { label: 'Preparing', value: stats.preparing_orders || 0, color: 'var(--yellow)' },
                    { label: 'Revenue', value: revenueVisible ? `₹${stats.revenue_today || 0}` : '₹***', color: 'var(--green)', toggle: true },
                ].map((s, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-white)', border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius)', padding: '14px 16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
                        </div>
                        {s.toggle && (
                            <button onClick={() => setRevenueVisible(!revenueVisible)}
                                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                {revenueVisible ? '🙈' : '👁️'}
                            </button>
                        )}
                    </div>
                ))}
            </div>
 
            {/* Tabs */}
            <div className="dashboard-tabs">
                {['orders', 'menu', 'outlet', 'profile'].map(tab => (
                    <div key={tab} className={`dashboard-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                        style={{ textTransform: 'capitalize', flex: 1, textAlign: 'center' }}>
                        {tab === 'orders' ? '📋' : tab === 'menu' ? '🍽️' : tab === 'outlet' ? '🏪' : '👤'}
                    </div>
                ))}
            </div>
 
            {loading ? (
                <div>
                    <div className="skeleton skeleton-card" />
                    <div className="skeleton skeleton-card" />
                </div>
            ) : activeTab === 'orders' ? (
                <>
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '12px', scrollbarWidth: 'none' }}>
                        {[{ l: 'All', v: 'all' }, { l: 'New', v: 'Placed' }, { l: 'Preparing', v: 'Preparing' }, { l: 'Ready', v: 'Ready for Pickup' }, { l: 'Done', v: 'Picked Up' }].map(f => (
                            <button key={f.v} onClick={() => setFilterStatus(f.v)}
                                style={{
                                    padding: '6px 14px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap',
                                    border: `1px solid ${filterStatus === f.v ? 'var(--primary)' : 'var(--border)'}`,
                                    background: filterStatus === f.v ? 'var(--primary-bg)' : 'var(--bg-white)',
                                    color: filterStatus === f.v ? 'var(--primary)' : 'var(--text-secondary)',
                                    fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                                }}>
                                {f.l}
                            </button>
                        ))}
                    </div>
 
                    {filteredOrders.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.4 }}>📦</div>
                            <h3>No orders</h3>
                            <p>Orders will appear here in real-time</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredOrders.map(order => {
                                const action = !['Cancelled', 'Picked Up'].includes(order.status) ? getNextAction(order.status) : null;
                                const isLoading = actionLoading === order.id;
                                const minsWaiting = order.status === 'Placed' ? Math.floor((new Date() - new Date(order.placed_at)) / 60000) : 0;
                                const isGhost = minsWaiting > 20;
                                return (
                                    <div key={order.id} style={{
                                        background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: 'var(--shadow)',
                                    }}>
                                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ background: 'var(--primary-bg)', border: '2px solid var(--primary)', borderRadius: 'var(--radius)', padding: '6px 10px', textAlign: 'center', minWidth: '60px', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '0.55rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>Token</div>
                                                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>#{order.token_number || '—'}</div>
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.student_name || 'Student'}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Reg: {order.student_register_number || '—'}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏰ {order.pickup_time || 'ASAP'}</div>
                                                </div>
                                            </div>
                                            <div style={{
                                                padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                                                background: order.status === 'Placed' ? 'var(--blue-bg)' : order.status === 'Preparing' ? 'var(--yellow-bg)' : order.status === 'Ready for Pickup' ? 'var(--green-bg)' : 'var(--bg)',
                                                color: order.status === 'Placed' ? 'var(--blue)' : order.status === 'Preparing' ? 'var(--yellow)' : order.status === 'Ready for Pickup' ? 'var(--green)' : 'var(--text-muted)',
                                            }}>{order.status}</div>
                                        </div>
                                        <div style={{ padding: '8px 16px', background: order.payment_status === 'PENDING' ? 'var(--yellow-bg)' : 'var(--green-bg)' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: order.payment_status === 'PENDING' ? 'var(--yellow)' : 'var(--green)' }}>
                                                {order.payment_status === 'PENDING' ? '⏳ Payment Pending' : '✅ Payment Confirmed'}
                                            </span>
                                        </div>
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                                            {order.items?.map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                                    <span>{item.quantity}x {item.name}</span>
                                                    <span style={{ fontWeight: 600 }}>₹{item.price * item.quantity}</span>
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.items?.length} item(s)</span>
                                                <span style={{ fontWeight: 800, fontSize: '1rem' }}>₹{order.total}</span>
                                            </div>
                                        </div>
                                        {isGhost && (
                                            <div style={{ padding: '6px 16px', background: 'var(--red-bg)', fontSize: '0.75rem', color: 'var(--red)', fontWeight: 600 }}>
                                                ⚠️ Waiting {minsWaiting} min — confirm or cancel
                                            </div>
                                        )}
                                        {(action || order.status === 'Placed') && (
                                            <div style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
                                                {order.status === 'Placed' && (
                                                    <button onClick={() => handleCancelOrder(order.id)} disabled={isLoading}
                                                        className={isGhost ? 'pulse-red' : ''}
                                                        style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                                                        ❌ Cancel
                                                    </button>
                                                )}
                                                {action && (
                                                    <button onClick={() => handleOrderAction(order.id, action.newStatus, order.status)} disabled={isLoading}
                                                        style={{ flex: 2, padding: '10px', borderRadius: 'var(--radius)', border: 'none', background: action.bg, color: action.color, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {isLoading ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : action.label}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : activeTab === 'menu' ? (
                <div>
                    <button onClick={() => setShowAddItem(!showAddItem)}
                        style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius)', border: 'none', background: showAddItem ? 'var(--bg)' : 'var(--primary)', color: showAddItem ? 'var(--text)' : 'white', fontWeight: 700, cursor: 'pointer', marginBottom: '16px', fontSize: '0.9rem' }}>
                        {showAddItem ? 'Cancel' : '+ Add New Item'}
                    </button>
 
                    {showAddItem && (
                        <div style={{ background: 'var(--bg-white)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: '20px' }}>
                            <h3 style={{ marginBottom: '14px', fontSize: '1rem' }}>New Menu Item</h3>
 
                            <input type="text" placeholder="Item Name *"
                                value={newItem.name}
                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                style={inputStyle}
                            />
 
                            {/* Category picker with live image preview */}
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                                    Category *
                                </label>
 
                                {/* Horizontal scrollable category selector */}
                                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'none' }}>
                                    {MENU_CATEGORIES.map(cat => {
                                        const isSelected = newItem.category === cat;
                                        const img = CATEGORY_IMAGE[cat] || FALLBACK_IMAGE;
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setNewItem({ ...newItem, category: cat })}
                                                style={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                    gap: '5px', flexShrink: 0, cursor: 'pointer',
                                                    background: 'none', border: 'none', padding: '4px 2px',
                                                }}
                                            >
                                                <div style={{
                                                    width: '54px', height: '54px', borderRadius: '50%',
                                                    overflow: 'hidden',
                                                    border: `2.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                                                    boxShadow: isSelected ? '0 0 0 1px var(--primary)' : 'none',
                                                    transition: 'border-color 0.15s, box-shadow 0.15s',
                                                }}>
                                                    <img
                                                        src={img}
                                                        alt={cat}
                                                        onError={e => { e.currentTarget.src = FALLBACK_IMAGE; }}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                    />
                                                </div>
                                                <span style={{
                                                    fontSize: '0.62rem', fontWeight: isSelected ? 700 : 500,
                                                    color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                                                    textAlign: 'center', maxWidth: '60px', lineHeight: 1.3,
                                                    transition: 'color 0.15s',
                                                }}>{cat}</span>
                                            </button>
                                        );
                                    })}
                                </div>
 
                                {/* Selected category confirmation pill */}
                                <div style={{
                                    marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    background: 'var(--primary-bg)', border: '1px solid var(--primary)',
                                    borderRadius: 'var(--radius-full)', padding: '4px 12px',
                                }}>
                                    <img
                                        src={previewImg}
                                        alt={newItem.category}
                                        onError={e => { e.currentTarget.src = FALLBACK_IMAGE; }}
                                        style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
                                        {newItem.category}
                                    </span>
                                </div>
                            </div>
 
                            <input type="number" placeholder="Price (₹) *"
                                value={newItem.price}
                                onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                                style={inputStyle}
                            />
                            <input type="text" placeholder="Description (optional)"
                                value={newItem.description}
                                onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                style={inputStyle}
                            />
 
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    <input type="checkbox" checked={newItem.is_veg} onChange={e => setNewItem({ ...newItem, is_veg: e.target.checked })} />
                                    🟢 Vegetarian
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    <input type="checkbox" checked={newItem.is_bestseller} onChange={e => setNewItem({ ...newItem, is_bestseller: e.target.checked })} />
                                    ★ Bestseller
                                </label>
                            </div>
 
                            <button onClick={handleSaveNewItem}
                                disabled={!newItem.name || !newItem.price || !newItem.category || isSaving}
                                style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: (!newItem.name || !newItem.price || !newItem.category || isSaving) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {isSaving ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Saving...</> : 'Save Item'}
                            </button>
                        </div>
                    )}
 
                    {/* Menu grouped by category — with image thumbnail */}
                    {Object.entries(menuByCategory).map(([category, items]) => (
                        <div key={category} style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <img
                                    src={CATEGORY_IMAGE[category] || FALLBACK_IMAGE}
                                    alt={category}
                                    onError={e => { e.currentTarget.src = FALLBACK_IMAGE; }}
                                    style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                />
                                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {category}
                                </h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {items.map(item => (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-white)', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)', gap: '10px' }}>
                                        {/* Category thumbnail */}
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                            <img
                                                src={CATEGORY_IMAGE[item.category] || FALLBACK_IMAGE}
                                                alt={item.category}
                                                onError={e => { e.currentTarget.src = FALLBACK_IMAGE; }}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.is_veg ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                                                <span style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                                {item.is_bestseller && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '1px 5px', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>★ BEST</span>}
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>₹{item.price}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: item.is_available ? 'var(--green)' : 'var(--text-muted)' }}>
                                                {item.is_available ? 'Available' : 'Sold Out'}
                                            </span>
                                            <div onClick={() => handleToggleMenu(item.id)}
                                                style={{ width: '40px', height: '22px', borderRadius: '11px', cursor: 'pointer', transition: 'background 0.2s', position: 'relative', background: item.is_available ? 'var(--primary)' : 'var(--border)' }}>
                                                <div style={{ position: 'absolute', top: '3px', left: item.is_available ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                                            </div>
                                            <button onClick={() => handleDeleteItem(item.id, item.name)}
                                                style={{ background: 'var(--red-bg)', border: 'none', color: 'var(--red)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
 
                    {menu.length === 0 && !showAddItem && (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.4 }}>🍽️</div>
                            <h3>No menu items yet</h3>
                            <p>Add your first item using the button above</p>
                        </div>
                    )}
                </div>
            ) : activeTab === 'outlet' ? (
                <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedOutlet?.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedOutlet?.cuisine} • ⭐ {selectedOutlet?.rating || '—'}</div>
                        </div>
                        <button onClick={handleToggleOutlet}
                            style={{ padding: '10px 20px', borderRadius: 'var(--radius)', border: 'none', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', background: selectedOutlet?.is_open ? 'var(--green-bg)' : 'var(--red-bg)', color: selectedOutlet?.is_open ? 'var(--green)' : 'var(--red)' }}>
                            {selectedOutlet?.is_open ? '🟢 OPEN' : '🔴 CLOSED'}
                        </button>
                    </div>
                    <div style={{ padding: '20px' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Outlet Settings</h3>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>UPI ID *</label>
                            <input type="text" placeholder="merchant@upi" value={outletForm.upi_id}
                                onChange={e => setOutletForm({ ...outletForm, upi_id: e.target.value })}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Opening</label>
                                <input type="time" value={outletForm.opening_time}
                                    onChange={e => setOutletForm({ ...outletForm, opening_time: e.target.value })}
                                    style={{ width: '100%', padding: '10px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Closing</label>
                                <input type="time" value={outletForm.closing_time}
                                    onChange={e => setOutletForm({ ...outletForm, closing_time: e.target.value })}
                                    style={{ width: '100%', padding: '10px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Max Orders Per Slot</label>
                            <input type="number" min="1" max="50" value={outletForm.max_orders_per_slot}
                                onChange={e => setOutletForm({ ...outletForm, max_orders_per_slot: parseInt(e.target.value) })}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
                        </div>
                        <button onClick={handleSaveOutlet}
                            style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                            Save Settings
                        </button>
                    </div>
                </div>
            ) : activeTab === 'profile' ? (
                <div>
                    <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', overflow: 'hidden', marginBottom: '16px' }}>
                        <div style={{ background: 'var(--primary)', padding: '28px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                                {user?.name?.charAt(0)?.toUpperCase() || 'V'}
                            </div>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>{user?.name || '—'}</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>Vendor Account</div>
                            </div>
                        </div>
                        <div style={{ padding: '20px' }}>
                            {[
                                { label: 'Outlet Name', value: selectedOutlet?.name || '—', icon: '🏪' },
                                { label: 'Cuisine', value: selectedOutlet?.cuisine || '—', icon: '🍽️' },
                                { label: 'UPI ID', value: selectedOutlet?.upi_id || 'Not set', icon: '💳' },
                                { label: 'Outlet Status', value: selectedOutlet?.is_open ? 'Open 🟢' : 'Closed 🔴', icon: '📍' },
                                { label: 'Hours', value: selectedOutlet ? `${selectedOutlet.opening_time} – ${selectedOutlet.closing_time}` : '—', icon: '🕐' },
                                { label: 'Rating', value: selectedOutlet?.rating ? `⭐ ${selectedOutlet.rating}` : 'No ratings yet', icon: '⭐' },
                                { label: 'Menu Items', value: `${availableItems} available / ${totalMenuItems} total`, icon: '📋' },
                            ].map((row, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '14px', marginBottom: '14px', borderBottom: i < 6 ? '1px solid var(--border-light)' : 'none' }}>
                                    <div style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center', flexShrink: 0 }}>{row.icon}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{row.label}</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginTop: '2px' }}>{row.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleLogout}
                        style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--red)', background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        🚪 Logout
                    </button>
                </div>
            ) : null}
        </div>
    );
}
 