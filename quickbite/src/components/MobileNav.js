'use client';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

export default function MobileNav({ currentPage, navigate }) {
    const { cartCount, unreadCount } = useApp();
    const { role } = useAuth();

    const studentItems = [
        { id: 'home', icon: '🏠', label: 'Home' },
        { id: 'orders', icon: '📋', label: 'Orders' },
        { id: 'cart', icon: '🛒', label: 'Cart', badge: cartCount },
        { id: 'notifications', icon: '🔔', label: 'Alerts', badge: unreadCount },
        { id: 'profile', icon: '👤', label: 'Profile' },
    ];

    const vendorItems = [
        { id: 'vendor', icon: '📊', label: 'Dashboard' },
    ];

    const items = role === 'vendor' ? vendorItems : studentItems;

    return (
        <div className="mobile-nav">
            {items.map(item => (
                <button
                    key={item.id}
                    className={`mobile-nav-item ${currentPage === item.id ? 'active' : ''}`}
                    onClick={() => navigate(item.id)}
                >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                    {item.badge > 0 && <span className="badge">{item.badge}</span>}
                </button>
            ))}
        </div>
    );
}