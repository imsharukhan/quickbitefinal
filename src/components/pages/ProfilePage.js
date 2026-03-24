'use client';
import { useApp } from '@/context/AppContext';

export default function ProfilePage({ navigate }) {
    const { user, orders } = useApp();
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

    return (
        <div className="page-container profile-page">
            <div className="profile-header">
                <div className="profile-avatar">{user.name.charAt(0)}</div>
                <h2>{user.name}</h2>
                <p>{user.email}</p>
            </div>

            <div className="profile-card" style={{ textAlign: 'center' }}>
                <h3>Wallet</h3>
                <div className="wallet-balance">₹{user.walletBalance.toLocaleString()}</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                    <button className="btn btn-primary btn-sm" id="add-money-btn">Add Money</button>
                    <button className="btn btn-outline btn-sm" id="wallet-history-btn">History</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div className="stat-card">
                    <div className="stat-value">{totalOrders}</div>
                    <div className="stat-label">Orders</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">₹{totalSpent}</div>
                    <div className="stat-label">Spent</div>
                </div>
            </div>

            <div className="profile-card">
                <h3>Details</h3>
                <div className="profile-field"><span className="field-label">Name</span><span className="field-value">{user.name}</span></div>
                <div className="profile-field"><span className="field-label">Email</span><span className="field-value">{user.email}</span></div>
                <div className="profile-field"><span className="field-label">Student ID</span><span className="field-value">{user.studentId}</span></div>
                <div className="profile-field"><span className="field-label">Department</span><span className="field-value">CSE</span></div>
            </div>

            <div className="profile-card">
                <h3>Quick Links</h3>
                {[
                    { label: 'Order History', page: 'orders' },
                    { label: 'Budget Tracker', page: 'budget' },
                    { label: 'Notifications', page: 'notifications' },
                    { label: 'Help & Support', page: null },
                    { label: 'Privacy Policy', page: null },
                ].map((item, idx) => (
                    <div key={idx} className="profile-field" style={{ cursor: item.page ? 'pointer' : 'default' }} onClick={() => item.page && navigate(item.page)}>
                        <span className="field-label">{item.label}</span>
                        <span className="field-value" style={{ color: 'var(--text-muted)' }}>→</span>
                    </div>
                ))}
            </div>

            <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
                <button className="btn btn-danger btn-sm" id="logout-btn">Log Out</button>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '10px' }}>QuickBite v1.0</p>
            </div>
        </div>
    );
}
