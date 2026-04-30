'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import * as outletManagementService from '@/services/outletManagementService';
import * as orderSvc from '@/services/orderService';
import * as menuMgmt from '@/services/menuManagementService';
import { invalidateMenuCache } from '@/services/menuService';
import { useWebSocket } from '@/hooks/useWebSocket';
import { updateClosedDates } from '@/services/outletManagementService';
 
const MENU_CATEGORIES = [
  'Breakfast', 'Rice & Meals', 'Breads & Rotis',
  'Snacks & Starters', 'Desserts & Sweets', 'Drinks & Beverages', 'Other',
];
 
const CATEGORY_EMOJI = {
  'Breakfast': '🍳', 'Rice & Meals': '🍛', 'Breads & Rotis': '🫓',
  'Snacks & Starters': '🍟', 'Desserts & Sweets': '🍮',
  'Drinks & Beverages': '🥤', 'Other': '🍽️',
};
 
const VALID_IMAGES = ['breakfast', 'rice_meals', 'breads_rotis', 'snacks_starters', 'desserts_sweets', 'drinks_beverages'];
const getCategoryImg = (catName) => {
  if (!catName || catName.toLowerCase() === 'all') return '/categories/other.png';
  const cleanName = catName.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
  return VALID_IMAGES.includes(cleanName) 
    ? `/categories/${cleanName}.png` 
    : '/categories/other.png';
};
const FALLBACK_IMAGE = '/categories/other.png';
// const PRINTING_ENABLED = false; // DISABLED
const STATUS_RANK = {
  Placed: 0,
  Preparing: 1,
  'Ready for Pickup': 2,
  'Picked Up': 3,
  Cancelled: 99,
};

const mergeOrderForward = (orders, incoming) => {
  if (!incoming?.id) return orders;
  return orders.map(order => {
    if (order.id !== incoming.id) return order;
    const currentRank = STATUS_RANK[order.status] ?? -1;
    const incomingRank = STATUS_RANK[incoming.status] ?? -1;
    return incomingRank >= currentRank ? incoming : order;
  });
};

const mergeOrderListForward = (currentOrders, incomingOrders = []) => {
  const currentById = new Map(currentOrders.map(order => [order.id, order]));
  return incomingOrders.map(incoming => {
    const current = currentById.get(incoming.id);
    if (!current) return incoming;
    const currentRank = STATUS_RANK[current.status] ?? -1;
    const incomingRank = STATUS_RANK[incoming.status] ?? -1;
    return incomingRank >= currentRank ? incoming : current;
  });
};
 
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
    const [tokenSearch, setTokenSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [revenueVisible, setRevenueVisible] = useState(true);
    const [showAddItem, setShowAddItem] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: 'Breakfast', is_veg: true, is_bestseller: false });
    const [outletForm, setOutletForm] = useState({ upi_id: '', opening_time: '', closing_time: '' });
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const historyCache = useRef({});
    const [closedDates, setClosedDates] = useState([]);
    const [newClosedDate, setNewClosedDate] = useState('');
    const [expandedDate, setExpandedDate] = useState(null);
    const [expandedOrders, setExpandedOrders] = useState([]);
    const [expandedLoading, setExpandedLoading] = useState(false);
    const { lastMessage, isConnected: wsConnected } = useWebSocket('vendor', user?.id);
 
    const loadOutlets = () => {
        outletManagementService.getMyOutlets().then(data => {
            const myOutlets = data;
            setOutlets(myOutlets);
            if (myOutlets.length === 0) { setLoading(false); return; }
            const savedId = typeof window !== 'undefined' ? localStorage.getItem('qb_selected_outlet') : null;
            const toSelect = savedId ? (myOutlets.find(o => o.id === savedId) || myOutlets[0]) : myOutlets[0];
            // Always update — refreshes outlet data (like is_open) from server
            setSelectedOutlet(prev => prev?.id === toSelect.id ? { ...prev, ...toSelect } : toSelect);
        });
    };
    
    useEffect(() => {
        if (!user) return;
        loadOutlets();
        // Silent background sync every 30s — does NOT trigger loading state
        // Needed because vendor WebSocket uses outlet_id key but connects via vendor_id
        const interval = setInterval(() => {
            loadOutletData(true); // fully silent background sync
        }, wsConnected ? 30000 : 5000);
        return () => clearInterval(interval);
    }, [user, selectedOutlet?.id, wsConnected]);
 
    const loadOutletData = async (silent = false) => {
        if (!selectedOutlet) return;
        if (!silent) setLoading(true);
        try {
            const [oData, mData, sData] = await Promise.all([
                orderSvc.getOutletOrders(selectedOutlet.id),
                menuMgmt.getFullMenu(selectedOutlet.id),
                orderSvc.getOutletStats(selectedOutlet.id).catch(() => stats)
            ]);
            setOrders(prev => mergeOrderListForward(prev, oData || []));
            setMenu(mData || []);
            if (sData) setStats(sData);
        } catch (e) { console.error(e); }
        finally { if (!silent) setLoading(false); }
    };
 
    useEffect(() => { 
        if (selectedOutlet?.id) {
            loadOutletData();
            if (typeof window !== 'undefined') {
                localStorage.setItem('qb_selected_outlet', selectedOutlet.id);
            }
            // Sync closed dates
            setClosedDates(selectedOutlet.closed_dates || []);
            // Sync form ONLY when outlet changes — not on every background refresh
            setOutletForm({
                upi_id: selectedOutlet.upi_id || '',
                opening_time: selectedOutlet.opening_time || '08:00',
                closing_time: selectedOutlet.closing_time || '20:00',
            });
        }
    }, [selectedOutlet?.id]);
 
    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'NEW_ORDER') {
            try { new Audio('/notification.mp3').play().catch(() => {}); } catch (e) {}
            loadOutletData(true); // silent — no loading flash
            showToast(`New order! Token #${lastMessage.order?.token_number || '—'}`, 'success');
        } else if (lastMessage.type === 'STATUS_UPDATE') {
            loadOutletData(true); // silent — no loading flash
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
 
    // Confetti logic seamlessly replaced with a clean UI toast below!

//   const printOrderBills = (order) => {
//   const win = window.open('', '_blank', 'width=420,height=600');
//   if (!win) {
//     showToast?.('Print window was blocked. Please allow pop-ups for this site.', 'error');
//     return;
//   }
//   const items = order.items || [];
//   const foodTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
//   // total_price is what student actually paid (food + platform fee)
//   const totalPaid = order.total_price || foodTotal;
//   const platformFee = parseFloat((totalPaid - foodTotal).toFixed(2));
 
//   const itemRows = items.map(i =>
//     `<tr>
//       <td style="padding:3px 0">${i.quantity}x ${i.name}</td>
//       <td style="text-align:right;padding:3px 0;font-weight:600">&#8377;${(i.price * i.quantity).toFixed(0)}</td>
//     </tr>`
//   ).join('');
 
//   const now = new Date().toLocaleString('en-IN', {
//     timeZone: 'Asia/Kolkata',
//     day: '2-digit', month: 'short', year: 'numeric',
//     hour: '2-digit', minute: '2-digit', hour12: true
//   });
 
//   win.document.write(`<!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8"/>
//   <title>QuickBite Bills — Token #${order.token_number}</title>
//   <style>
//     * { margin:0; padding:0; box-sizing:border-box; }
//     body { font-family: 'Courier New', monospace; background: white; }
 
//     .page { width: 76mm; padding: 6mm 4mm; }
 
//     /* Bill 1 and Bill 2 each on their own print page */
//     .bill1 { page-break-after: always; }
//     .bill2 { page-break-after: avoid; }
 
//     .center { text-align: center; }
//     .right   { text-align: right; }
//     .bold    { font-weight: 700; }
 
//     .shop-name {
//       font-size: 16px; font-weight: 900;
//       text-align: center; letter-spacing: 1px;
//       text-transform: uppercase; margin-bottom: 2px;
//     }
//     .shop-sub {
//       font-size: 10px; text-align: center;
//       color: #555; margin-bottom: 6px;
//     }
//     .dashed { border-top: 1px dashed #000; margin: 5px 0; }
//     .solid  { border-top: 2px solid #000; margin: 5px 0; }
 
//     .token-label { font-size: 10px; text-align: center; letter-spacing: 2px; text-transform: uppercase; color: #555; }
//     .token-num   { font-size: 42px; font-weight: 900; text-align: center; line-height: 1.1; }
 
//     table { width: 100%; border-collapse: collapse; font-size: 12px; }
//     .total-row td { font-size: 13px; font-weight: 700; padding-top: 5px; border-top: 1px dashed #000; }
//     .fee-row td   { font-size: 10px; color: #555; }
 
//     .paid-box {
//       border: 2px solid #000; border-radius: 4px;
//       text-align: center; padding: 4px 0; margin: 6px 0;
//       font-size: 13px; font-weight: 900; letter-spacing: 1px;
//     }
//     .footer { font-size: 9px; text-align: center; color: #888; margin-top: 6px; }
 
//     /* BILL 2 — kitchen slip */
//     .kitchen-token { font-size: 64px; font-weight: 900; text-align: center; line-height: 1; }
//     .kitchen-amt   { font-size: 28px; font-weight: 900; text-align: center; margin: 4px 0; }
 
//     @media print {
//       @page { margin: 0; size: 80mm auto; }
//       body  { margin: 0; }
//       .no-print { display: none !important; }
//     }
//   </style>
// </head>
// <body>
 
// <!-- ═══════════════════════════════════════════
//      BILL 1 — Customer Copy (full details)
// ═══════════════════════════════════════════ -->
// <div class="page bill1">
//   <div class="shop-name">QuickBite</div>
//   <div class="shop-sub">${order.outlet_name}</div>
//   <div class="dashed"></div>
 
//   <div class="token-label">TOKEN NUMBER</div>
//   <div class="token-num">#${order.token_number}</div>
 
//   <div class="dashed"></div>
 
//   <div style="font-size:11px; margin-bottom:3px">
//     <span class="bold">Student:</span> ${order.student_name || '—'}
//   </div>
//   <div style="font-size:11px; margin-bottom:3px">
//     <span class="bold">Pickup:</span> ${order.pickup_time || '—'}
//   </div>
//   <div style="font-size:10px; color:#666; margin-bottom:4px">${now}</div>
 
//   <div class="dashed"></div>
 
//   <table>
//     ${itemRows}
//   </table>
 
//   <table style="margin-top:6px">
//     <tr class="fee-row">
//       <td>Food subtotal</td>
//       <td class="right">&#8377;${foodTotal.toFixed(0)}</td>
//     </tr>
//     ${platformFee > 0 ? `<tr class="fee-row">
//       <td>Platform fee</td>
//       <td class="right">&#8377;${platformFee.toFixed(2)}</td>
//     </tr>` : ''}
//     <tr class="total-row">
//       <td>TOTAL PAID</td>
//       <td class="right">&#8377;${totalPaid.toFixed(0)}</td>
//     </tr>
//   </table>
 
//   <div class="paid-box">&#10003; PAID via UPI</div>
 
//   <div class="footer">
//     QuickBite — Campus Pre-Order &bull; Customer Copy
//   </div>
// </div>
 
 
// <!-- ═══════════════════════════════════════════
//      BILL 2 — Kitchen Slip (token + amount only)
// ═══════════════════════════════════════════ -->
// <div class="page bill2">
//   <div class="shop-name">${order.outlet_name}</div>
//   <div class="dashed"></div>
 
//   <div class="token-label">TOKEN</div>
//   <div class="kitchen-token">#${order.token_number}</div>
 
//   <div class="dashed"></div>
 
//   <div class="kitchen-amt">&#8377;${totalPaid.toFixed(0)}</div>
//   <div class="paid-box">&#10003; PAID</div>
 
//   <div style="font-size:11px; text-align:center; margin-top:4px">
//     Pickup: ${order.pickup_time || '—'}
//   </div>
//   <div class="footer" style="margin-top:6px">Kitchen Copy</div>
// </div>
 
// <!-- Print button — only visible on screen, not on paper -->
// <div class="no-print" style="padding:12px; text-align:center">
//   <button onclick="window.print()"
//     style="padding:10px 28px;background:#ff6b35;color:white;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer">
//     🖨️ Print Bills
//   </button>
//   <p style="font-size:11px;color:#888;margin-top:6px">
//     Tip: Set thermal printer as default &amp; enable "Skip print preview" in Chrome for one-click printing.
//   </p>
// </div>
 
// </body>
// </html>`);
 
//   win.document.close();
//   win.focus();
//   setTimeout(() => { win.print(); }, 350);
// };

const handleOrderAction = async (orderId, newStatus, currentStatus) => {
        if (actionLoading) return;
        setActionLoading(orderId);

        try {
            const updatedOrder = await orderSvc.updateOrderStatus(orderId, newStatus);
            setOrders(prev => mergeOrderForward(prev, updatedOrder));
            showToast('Order updated ✅');
            // Background stats refresh — non-blocking
            orderSvc.getOutletStats(selectedOutlet.id)
                .then(sData => { if (sData) setStats(sData); })
                .catch(() => {});
        } catch (e) {
            showToast('Failed to update order', 'error');
            loadOutletData();
        } finally {
            setActionLoading(null);
        }
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
        setMenu(prev => prev.map(m => m.id === itemId ? { ...m, is_available: !m.is_available } : m));
        invalidateMenuCache(selectedOutlet.id); // students see change immediately
        try {
            await menuMgmt.toggleAvailability(itemId);
            showToast('Updated ✅');
        } catch (e) {
            setMenu(prev => prev.map(m => m.id === itemId ? { ...m, is_available: !m.is_available } : m));
            invalidateMenuCache(selectedOutlet.id);
            showToast('Failed', 'error');
        }
    };
 
    const handleSaveNewItem = async () => {
        if (!newItem.name || !newItem.price || !newItem.category) {
            showToast('Fill all required fields', 'error'); return;
        }
        if (isSaving) return;
        setIsSaving(true);

        // Optimistic — add item instantly with temp ID
        const tempId = `temp_${Date.now()}`;
        const optimisticItem = {
            ...newItem,
            id: tempId,
            price: parseFloat(newItem.price),
            is_available: true,
            outlet_id: selectedOutlet.id,
        };
        setMenu(prev => [...prev, optimisticItem]);
        setShowAddItem(false);
        const savedItem = { ...newItem };
        setNewItem({ name: '', description: '', price: '', category: 'Breakfast', is_veg: true, is_bestseller: false });
        showToast('Item added ✅');

        try {
            const added = await menuMgmt.addMenuItem(selectedOutlet.id, { ...savedItem, price: parseFloat(savedItem.price) });
            setMenu(prev => prev.map(m => m.id === tempId ? added : m));
            invalidateMenuCache(selectedOutlet.id); // students see new item immediately
        } catch (e) {
            // Remove optimistic item on failure
            setMenu(prev => prev.filter(m => m.id !== tempId));
            setShowAddItem(true);
            setNewItem(savedItem);
            showToast(e?.response?.data?.detail || 'Failed to add item', 'error');
        } finally {
            setIsSaving(false);
        }
    };
 
    const handleToggleOutlet = async () => {
        // Optimistic — flip instantly
        const newIsOpen = !selectedOutlet.is_open;
        setSelectedOutlet(prev => ({ ...prev, is_open: newIsOpen }));
        showToast(`Outlet is now ${newIsOpen ? 'OPEN 🟢' : 'CLOSED 🔴'}`);
        try {
            await outletManagementService.toggleOutletOpen(selectedOutlet.id);
        } catch (e) {
            // Revert on failure
            setSelectedOutlet(prev => ({ ...prev, is_open: !newIsOpen }));
            showToast('Failed to update status', 'error');
        }
    };
 
    const handleSaveOutlet = async () => {
        // Optimistic — update locally first
        setSelectedOutlet(prev => ({ ...prev, ...outletForm }));
        showToast('Hours saved ✅');
        try {
            await outletManagementService.updateOutlet(selectedOutlet.id, outletForm);
        } catch (e) {
            showToast('Failed to save hours', 'error');
        }
    };
 
    const handleDeleteItem = async (itemId, itemName) => {
        if (!window.confirm(`Delete "${itemName}"? This cannot be undone.`)) return;
        // Optimistic — remove instantly
        const deletedItem = menu.find(m => m.id === itemId);
        setMenu(prev => prev.filter(m => m.id !== itemId));
        showToast('Item deleted');
        try {
            await menuMgmt.deleteMenuItem(itemId);
            invalidateMenuCache(selectedOutlet.id); // students see deletion immediately
        } catch (e) {
            if (deletedItem) setMenu(prev => [...prev, deletedItem]);
            showToast('Failed to delete', 'error');
        }
    };
 
    const handleLogout = async () => {
        if (!window.confirm('Are you sure you want to logout?')) return;
        await logout();
    };
 
    const getNextAction = (status, paymentStatus) => {
    if (status === 'Placed') {
        if (paymentStatus === 'PENDING') {
        // Payment not done yet — vendor can only cancel, not proceed
        return null;
        }
        // Payment confirmed by Razorpay — vendor starts preparing
        return { label: '🍳 Start Preparing', newStatus: 'Preparing', bg: 'var(--green)', color: 'white' };
    }
    if (status === 'Preparing') return { label: '🔔 Mark Ready', newStatus: 'Ready for Pickup', bg: 'var(--primary)', color: 'white' };
    if (status === 'Ready for Pickup') return { label: '✓ Complete', newStatus: 'Picked Up', bg: '#1b5e20', color: 'white' };
    return null;
    };
 
    const paidOrders = orders.filter(o => o.payment_status === 'COMPLETED');
    const statusFiltered = filterStatus === 'all' ? paidOrders : paidOrders.filter(o => o.status === filterStatus);
    const filteredOrders = tokenSearch.trim() === ''
        ? statusFiltered
        : [
            ...statusFiltered.filter(o => String(o.token_number) === tokenSearch.trim()),
            ...statusFiltered.filter(o => String(o.token_number) !== tokenSearch.trim()),
          ];
 
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
    const previewImg = getCategoryImg(newItem.category);
 
    return (
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: '70px 12px 40px', boxSizing: 'border-box', width: '100%', overflowX: 'hidden' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '20px' }}>
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
                {['orders', 'history', 'menu', 'profile'].map(tab => (
                    <div key={tab} className={`dashboard-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={async () => {
                            setActiveTab(tab);
                            if (tab === 'history' && selectedOutlet) {
                                // Show cached data instantly if available
                                const cacheKey = selectedOutlet.id;
                                const cached = historyCache.current[cacheKey];
                                if (cached && Date.now() - cached.time < 120000) {
                                    // Cache valid for 2 mins — instant display
                                    setHistoryData(cached.data);
                                } else {
                                    setHistoryData([]);
                                    setHistoryLoading(true);
                                    try {
                                        const data = await orderSvc.getOutletHistory(selectedOutlet.id);
                                        const result = Array.isArray(data) ? data : [];
                                        historyCache.current[cacheKey] = { data: result, time: Date.now() };
                                        setHistoryData(result);
                                    } catch (e) {
                                        console.error('History fetch failed:', e);
                                        setHistoryData(null);
                                    } finally { setHistoryLoading(false); }
                                }
                            }
                        }}
                        style={{ textTransform: 'capitalize', flex: 1, textAlign: 'center' }}>
                        {tab === 'orders' ? '📋' : tab === 'history' ? '📅' : tab === 'menu' ? '🍽️' : '👤'}
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
                    {/* Token search bar */}
                    <div style={{ position: 'relative', marginBottom: '12px', width: '100%', boxSizing: 'border-box' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
                        <input
                            type="number"
                            placeholder="Search by token number..."
                            value={tokenSearch}
                            onChange={e => setTokenSearch(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px 10px 38px',
                                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                                fontSize: '0.9rem', background: 'var(--bg-white)',
                                color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
                            }}
                        />
                        {tokenSearch && (
                            <button
                                onClick={() => setTokenSearch('')}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}
                            >✕</button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '12px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
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
                                const action = !['Cancelled', 'Picked Up'].includes(order.status) 
                                    ? getNextAction(order.status, order.payment_status) 
                                    : null;
                                const isLoading = actionLoading === order.id;
                                const placedAtUTC = order.placed_at ? (order.placed_at.endsWith('Z') ? order.placed_at : order.placed_at + 'Z') : new Date().toISOString();
                                const minsWaiting = order.status === 'Placed' ? Math.max(0, Math.floor((new Date() - new Date(placedAtUTC)) / 60000)) : 0;
                                const isGhost = minsWaiting > 20;
                                return (
                                    <div key={order.id} style={{
                                        background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: 'var(--shadow)',
                                        width: '100%', boxSizing: 'border-box',
                                    }}>
                                        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ background: 'var(--primary-bg)', border: '2px solid var(--primary)', borderRadius: 'var(--radius)', padding: '6px 10px', textAlign: 'center', minWidth: '60px', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '0.55rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>Token</div>
                                                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>#{order.token_number || '—'}</div>
                                                </div>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.student_name || 'Student'}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Reg: {order.student_register_number || '—'}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>⏰ {order.pickup_time || 'ASAP'}</div>
                                                </div>
                                            </div>
                                            <div style={{
                                                padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                                                background: order.status === 'Placed' ? 'var(--blue-bg)' : order.status === 'Preparing' ? 'var(--yellow-bg)' : order.status === 'Ready for Pickup' ? 'var(--green-bg)' : 'var(--bg)',
                                                color: order.status === 'Placed' ? 'var(--blue)' : order.status === 'Preparing' ? 'var(--yellow)' : order.status === 'Ready for Pickup' ? 'var(--green)' : 'var(--text-muted)',
                                            }}>{order.status}</div>
                                        </div>
                                        {order.payment_status === 'PENDING' && order.status === 'Placed' ? (
                                            <div style={{ padding: '8px 16px', background: '#FFF3E0' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#E65100' }}>
                                                    ⏳ Waiting for student payment...
                                                </span>
                                            </div>
                                        ) : order.status === 'Cancelled' ? (
                                            <div style={{ padding: '8px 16px', background: 'var(--red-bg)' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--red)' }}>❌ Cancelled</span>
                                            </div>
                                        ) : (
                                            <div style={{ padding: '8px 16px', background: 'var(--green-bg)' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)' }}>✅ Payment Confirmed</span>
                                            </div>
                                        )}
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                                            {order.items?.map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                                    <span>{item.quantity}x {item.name}</span>
                                                    <span style={{ fontWeight: 600 }}>₹{item.price * item.quantity}</span>
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.items?.length} item(s)</span>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>₹{order.total_price || order.items?.reduce((s, i) => s + i.price * i.quantity, 0) || 0}</div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>incl. fees</div>
                                                </div>
                                            </div>

                                        </div>
                                        {isGhost && (
                                            <div style={{ padding: '6px 16px', background: 'var(--red-bg)', fontSize: '0.75rem', color: 'var(--red)', fontWeight: 600 }}>
                                                ⚠️ Waiting {minsWaiting} min — confirm or cancel
                                            </div>
                                        )}
                                        {null /* bill printing removed */}
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
            ) : activeTab === 'history' ? (
                <div>
                    <div style={{ marginBottom: '16px', paddingLeft: '2px' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '4px' }}>Order History</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last 30 days — click any date to see orders</p>
                    </div>

                    {historyLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '64px', borderRadius: 'var(--radius)' }} />)}
                        </div>
                    ) : historyData === null ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
                            <h3>Failed to load history</h3>
                            <p>Check your connection and try again</p>
                            <button onClick={async () => {
                                setHistoryLoading(true);
                                try {
                                    const data = await orderSvc.getOutletHistory(selectedOutlet.id);
                                    setHistoryData(Array.isArray(data) ? data : []);
                                } catch { setHistoryData(null); }
                                finally { setHistoryLoading(false); }
                            }} style={{ marginTop: '14px', padding: '8px 20px', borderRadius: 'var(--radius)', border: '1px solid var(--primary)', background: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}>
                                Retry
                            </button>
                        </div>
                    ) : historyData.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.4 }}>📅</div>
                            <h3>No history yet</h3>
                            <p>Orders will appear here once placed</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {historyData.map((day, idx) => (
                                <div key={day.date} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', overflow: 'hidden', background: 'var(--bg-white)' }}>
                                    {/* Date row */}
                                    <div
                                        onClick={async () => {
                                            if (expandedDate === day.date) {
                                                setExpandedDate(null);
                                                setExpandedOrders([]);
                                                return;
                                            }
                                            setExpandedDate(day.date);
                                            setExpandedOrders([]);
                                            setExpandedLoading(true);
                                            try {
                                                const orders = await orderSvc.getOutletOrders(selectedOutlet.id, null, day.date);
                                                setExpandedOrders(orders);
                                            } catch { showToast('Failed to load orders', 'error'); }
                                            finally { setExpandedLoading(false); }
                                        }}
                                        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: 'var(--radius)',
                                                background: idx === 0 ? 'var(--primary-bg)' : 'var(--bg)',
                                                border: `1px solid ${idx === 0 ? 'var(--primary)' : 'var(--border)'}`,
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: idx === 0 ? 'var(--primary)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    {idx === 0 ? 'Today' : new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}
                                                </span>
                                                <span style={{ fontSize: '1rem', fontWeight: 900, color: idx === 0 ? 'var(--primary)' : 'var(--text)', lineHeight: 1 }}>
                                                    {new Date(day.date + 'T00:00:00').getDate()}
                                                </span>
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                                    {idx === 0 ? 'Today' : new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    {day.order_count === 0 ? 'No orders' : `${day.order_count} order${day.order_count !== 1 ? 's' : ''} • ${day.completed_count} completed`}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {day.order_count > 0 && (
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--green)' }}>₹{day.revenue.toFixed(0)}</div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>revenue</div>
                                                </div>
                                            )}
                                            <span style={{
                                                fontSize: '1rem', color: 'var(--text-muted)',
                                                transform: expandedDate === day.date ? 'rotate(90deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s', display: 'inline-block'
                                            }}>›</span>
                                        </div>
                                    </div>

                                    {/* Expanded orders */}
                                    {expandedDate === day.date && (
                                        <div style={{ borderTop: '1px solid var(--border-light)', background: 'var(--bg)' }}>
                                            {expandedLoading ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    Loading orders...
                                                </div>
                                            ) : expandedOrders.length === 0 ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    No orders on this day
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                    {expandedOrders.map(order => (
                                                        <div key={order.id} style={{ background: 'var(--bg-white)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            {/* Token badge */}
                                                            <div style={{
                                                                width: '44px', height: '44px', borderRadius: 'var(--radius)',
                                                                background: order.status === 'Picked Up' ? 'var(--green-bg)' : order.status === 'Cancelled' ? 'var(--red-bg)' : 'var(--primary-bg)',
                                                                border: `1.5px solid ${order.status === 'Picked Up' ? 'var(--green)' : order.status === 'Cancelled' ? 'var(--red)' : 'var(--primary)'}`,
                                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                            }}>
                                                                <div style={{ fontSize: '0.45rem', fontWeight: 700, textTransform: 'uppercase', color: order.status === 'Picked Up' ? 'var(--green)' : order.status === 'Cancelled' ? 'var(--red)' : 'var(--primary)' }}>Token</div>
                                                                <div style={{ fontSize: '1.2rem', fontWeight: 900, lineHeight: 1, color: order.status === 'Picked Up' ? 'var(--green)' : order.status === 'Cancelled' ? 'var(--red)' : 'var(--primary)' }}>
                                                                    #{order.token_number}
                                                                </div>
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {order.student_name}
                                                                </div>
                                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                    {order.items?.length} item(s) • ⏰ {order.pickup_time}
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>₹{order.total_price}</div>
                                                                <div style={{
                                                                    fontSize: '0.65rem', fontWeight: 700, marginTop: '2px',
                                                                    color: order.status === 'Picked Up' ? 'var(--green)' : order.status === 'Cancelled' ? 'var(--red)' : 'var(--text-muted)'
                                                                }}>
                                                                    {order.status === 'Picked Up' ? '✓ Done' : order.status === 'Cancelled' ? '✗ Cancelled' : order.status}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {/* Day summary footer */}
                                                    <div style={{ padding: '10px 16px', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                                        <span>{expandedOrders.length} total • {expandedOrders.filter(o => o.status === 'Picked Up').length} completed • {expandedOrders.filter(o => o.status === 'Cancelled').length} cancelled</span>
                                                        <span style={{ color: 'var(--green)' }}>₹{day.revenue.toFixed(0)} earned</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>    
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
                                        const img = getCategoryImg(cat);
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
                                    src={getCategoryImg(category)}
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
                                                src={getCategoryImg(item.category)}
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
            ) : activeTab === 'profile' ? (
                <div>
                    {/* Profile card */}
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

                            {/* Outlet Name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center', flexShrink: 0 }}>🏪</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Outlet Name</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedOutlet?.name || '—'}</div>
                                </div>
                            </div>

                            {/* UPI ID */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center', flexShrink: 0 }}>💳</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>UPI ID</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginTop: '2px', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{selectedOutlet?.upi_id || '—'}</div>
                                </div>
                            </div>

                            {/* Outlet Status — toggle button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center', flexShrink: 0 }}>📍</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Outlet Status</div>
                                    <div style={{ marginTop: '8px' }}>
                                        <button onClick={handleToggleOutlet} style={{
                                            padding: '8px 20px', borderRadius: 'var(--radius)', border: 'none',
                                            fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                                            background: selectedOutlet?.is_open ? 'var(--green-bg)' : 'var(--red-bg)',
                                            color: selectedOutlet?.is_open ? 'var(--green)' : 'var(--red)',
                                        }}>
                                            {selectedOutlet?.is_open ? '🟢 OPEN — tap to close' : '🔴 CLOSED — tap to open'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Hours — editable */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center', flexShrink: 0, marginTop: '2px' }}>🕐</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>Operating Hours</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '10px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Opening</label>
                                            <input type="time" value={outletForm.opening_time}
                                                onChange={e => setOutletForm({ ...outletForm, opening_time: e.target.value })}
                                                style={{ width: '100%', padding: '8px 4px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.78rem', boxSizing: 'border-box', outline: 'none', background: 'var(--bg)', color: 'var(--text)', minWidth: 0 }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Closing</label>
                                            <input type="time" value={outletForm.closing_time}
                                                onChange={e => setOutletForm({ ...outletForm, closing_time: e.target.value })}
                                                style={{ width: '100%', padding: '8px 4px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.78rem', boxSizing: 'border-box', outline: 'none', background: 'var(--bg)', color: 'var(--text)', minWidth: 0 }} />
                                        </div>
                                    </div>
                                    <button onClick={handleSaveOutlet} style={{
                                        padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
                                        background: 'var(--primary)', color: 'white', fontWeight: 700,
                                        fontSize: '0.82rem', cursor: 'pointer',
                                    }}>Save Hours</button>
                                </div>
                            </div>

                            {/* Holiday / Closed Dates */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center', flexShrink: 0, marginTop: '2px' }}>📅</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>Holiday / Closed Days</div>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        <input
                                            type="date"
                                            value={newClosedDate}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={e => setNewClosedDate(e.target.value)}
                                            style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none', background: 'var(--bg)', color: 'var(--text)', minWidth: 0 }}
                                        />
                                        <button onClick={async () => {
                                            if (!newClosedDate || closedDates.includes(newClosedDate)) return;
                                            const updated = [...closedDates, newClosedDate].sort();
                                            setClosedDates(updated);
                                            setNewClosedDate('');
                                            try {
                                                await updateClosedDates(selectedOutlet.id, updated);
                                                setSelectedOutlet(prev => ({ ...prev, closed_dates: updated }));
                                                showToast('Holiday date added ✅');
                                            } catch {
                                                setClosedDates(closedDates);
                                                showToast('Failed to save', 'error');
                                            }
                                        }} style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0 }}>
                                            Add
                                        </button>
                                    </div>
                                    {closedDates.length === 0 ? (
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No holidays set. Students can order on all days.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {closedDates.map(date => (
                                                <div key={date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--red-bg)', borderRadius: 'var(--radius)', padding: '6px 10px' }}>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--red)' }}>
                                                        🔴 {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    <button onClick={async () => {
                                                        const updated = closedDates.filter(d => d !== date);
                                                        setClosedDates(updated);
                                                        try {
                                                            await updateClosedDates(selectedOutlet.id, updated);
                                                            setSelectedOutlet(prev => ({ ...prev, closed_dates: updated }));
                                                            showToast('Date removed ✅');
                                                        } catch {
                                                            setClosedDates(closedDates);
                                                            showToast('Failed', 'error');
                                                        }
                                                    }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Menu Items */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center', flexShrink: 0 }}>📋</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Menu Items</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginTop: '2px' }}>{menu.length} items</div>
                                </div>
                            </div>

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
 