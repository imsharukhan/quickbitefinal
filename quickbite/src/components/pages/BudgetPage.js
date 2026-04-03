'use client';
import { useApp } from '@/context/AppContext';
import { ORDER_STATUS } from '@/data/mockData';

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
    const vegSpent = allItems
        .filter(i => i.is_veg)
        .reduce((sum, i) => sum + i.price * i.quantity, 0);
    const nonVegSpent = allItems
        .filter(i => !i.is_veg)
        .reduce((sum, i) => sum + i.price * i.quantity, 0);

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

    const vegPercent = totalSpent > 0
        ? Math.round((vegSpent / totalSpent) * 100)
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px', marginTop: '12px' }}>
                <div className="stat-card">
                    <div className="stat-value">₹{todaySpent}</div>
                    <div className="stat-label">Today</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">₹{weekSpent}</div>
                    <div className="stat-label">This Week</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">₹{totalSpent}</div>
                    <div className="stat-label">All Time</div>
                </div>
            </div>

            <div className="profile-card">
                <h3>Insights</h3>
                <div className="profile-field">
                    <span className="field-label">Total Orders</span>
                    <span className="field-value">{completedOrders.length}</span>
                </div>
                <div className="profile-field">
                    <span className="field-label">Average Order</span>
                    <span className="field-value">₹{avgOrder}</span>
                </div>
                <div className="profile-field">
                    <span className="field-label">Favourite Item</span>
                    <span className="field-value">{mostOrdered ? mostOrdered[0] : 'No orders yet'}</span>
                </div>
            </div>

            <div className="profile-card">
                <h3>Veg vs Non-Veg</h3>
                <div style={{
                    background: '#f0f0f0',
                    borderRadius: '999px',
                    height: '12px',
                    overflow: 'hidden',
                    margin: '12px 0'
                }}>
                    <div style={{
                        width: vegPercent + '%',
                        background: '#2ECC99',
                        height: '100%',
                        borderRadius: '999px',
                        transition: 'width 0.5s ease'
                    }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>🥬 Veg: ₹{vegSpent} ({vegPercent}%)</span>
                    <span>🍗 Non-Veg: ₹{nonVegSpent} ({100 - vegPercent}%)</span>
                </div>
            </div>

            <div className="profile-card">
                <h3>Spent Per Canteen</h3>
                {Object.entries(canteenSpend).map(([canteen, amount]) => (
                    <div className="profile-field" key={canteen}>
                        <span className="field-label">{canteen}</span>
                        <span className="field-value">₹{amount}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
