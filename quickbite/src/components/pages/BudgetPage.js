'use client';
import { useApp } from '@/context/AppContext';
import { ORDER_STATUS } from '@/constants';

export default function BudgetPage({ navigate }) {
    const { orders } = useApp();

    const completedOrders = orders.filter(
        o => o.status !== ORDER_STATUS.CANCELLED && 
             (o.payment_status === 'PAID' || ['Preparing', 'Ready for Pickup', 'Picked Up'].includes(o.status))
    );

    const totalSpent = completedOrders.reduce(
        (sum, o) => sum + (o.total_price || 0), 0
    );

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekOrders = completedOrders.filter(
        o => new Date((o.placed_at || "").endsWith('Z') ? o.placed_at : o.placed_at + 'Z') >= oneWeekAgo
    );
    const weekSpent = weekOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);

    const today = new Date().toDateString();
    const todayOrders = completedOrders.filter(o => 
        new Date((o.placed_at || "").endsWith('Z') ? o.placed_at : o.placed_at + 'Z').toDateString() === today
    );
    const todaySpent = todayOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);

    const allItems = completedOrders.flatMap(o => o.items);

    const itemCount = {};
    allItems.forEach(i => {
        itemCount[i.name] = (itemCount[i.name] || 0) + i.quantity;
    });

    const mostOrderedArray = Object.entries(itemCount).sort((a, b) => b[1] - a[1]);
    const mostOrdered = mostOrderedArray.length > 0 ? mostOrderedArray[0] : null;

    const canteenSpend = {};
    completedOrders.forEach(o => {
        const outletName = o.outlet_name || o.outletName || 'Unknown Canteen';
        canteenSpend[outletName] =
            (canteenSpend[outletName] || 0) + (o.total_price || 0);
    });

    const avgOrder = completedOrders.length > 0
        ? Math.round(totalSpent / completedOrders.length)
        : 0;

    if (completedOrders.length === 0) {
        return (
            <div className="page-container">
                <div className="menu-header">
                    <button className="back-btn" onClick={() => navigate('home')}>←</button>
                    <div className="menu-header-info">
                        <h1>Smart Budget Tracker</h1>
                        <p>Track your eating habits</p>
                    </div>
                </div>
                <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>No spending data yet. Place your first order!</h3>
                    <button className="btn btn-primary" onClick={() => navigate('home')} style={{ marginTop: '16px' }}>Browse Canteens</button>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="menu-header">
                <button className="back-btn" onClick={() => navigate('home')}>←</button>
                <div className="menu-header-info">
                    <h1>Smart Budget Tracker</h1>
                    <p>Track your eating habits</p>
                </div>
            </div>

            {/* Stat Cards - 2 top + 1 featured */}
            <div style={{ marginBottom: '12px', marginTop: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div className="stat-card" style={{ padding: '14px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today</div>
                        <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: '700' }}>₹{todaySpent}</div>
                    </div>
                    <div className="stat-card" style={{ padding: '14px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Week</div>
                        <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: '700' }}>₹{weekSpent}</div>
                    </div>
                </div>
                <div style={{
                    background: 'linear-gradient(135deg, #FF8C00 0%, #FFA940 100%)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    textAlign: 'center',
                    boxShadow: '0 4px 15px rgba(255,140,0,0.25)'
                }}>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>All Time Spent</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fff' }}>₹{totalSpent}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', marginTop: '4px' }}>{completedOrders.length} order{completedOrders.length !== 1 ? 's' : ''} placed</div>
                </div>
            </div>

            <div className="profile-card">
                <h3 style={{ marginBottom: '12px' }}>📊 Insights</h3>
                <div className="profile-field" style={{ padding: '10px 0' }}>
                    <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🧾 Total Orders</span>
                    <span className="field-value" style={{ fontWeight: '700' }}>{completedOrders.length}</span>
                </div>
                <div className="profile-field" style={{ padding: '10px 0' }}>
                    <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>💰 Average Order</span>
                    <span className="field-value" style={{ fontWeight: '700' }}>₹{avgOrder}</span>
                </div>
                <div className="profile-field" style={{ padding: '10px 0', borderBottom: 'none' }}>
                    <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>⭐ Favourite Item</span>
                    <span className="field-value" style={{ fontWeight: '700', maxWidth: '55%', textAlign: 'right' }}>{mostOrdered ? mostOrdered[0] : 'No orders yet'}</span>
                </div>
            </div>

            <div className="profile-card" style={{ marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '14px' }}>🏪 Spent Per Canteen</h3>
                {(() => {
                    const maxSpend = Math.max(...Object.values(canteenSpend));
                    return Object.entries(canteenSpend)
                        .sort((a, b) => b[1] - a[1])
                        .map(([canteen, amount]) => (
                            <div key={canteen} style={{ marginBottom: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{canteen}</span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#FF8C00' }}>₹{amount}</span>
                                </div>
                                <div style={{ background: '#f0f0f0', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.round((amount / maxSpend) * 100)}%`,
                                        background: 'linear-gradient(90deg, #FF8C00, #FFA940)',
                                        height: '100%',
                                        borderRadius: '999px',
                                        transition: 'width 0.5s ease'
                                    }} />
                                </div>
                            </div>
                        ));
                })()}
            </div>
        </div>
    );
}