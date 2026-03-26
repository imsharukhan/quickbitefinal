'use client';
import { useApp } from '@/context/AppContext';

export default function MobileNav({ currentPage, navigate }) {
    const { cartCount, unreadCount } = useApp();

    const items = [
        { id: 'home', icon: '🏠', label: 'Home' },
        { id: 'orders', icon: '📋', label: 'Orders' },
        { id: 'cart', icon: '🛒', label: 'Cart', badge: cartCount },
        { id: 'notifications', icon: '🔔', label: 'Alerts', badge: unreadCount },
        { id: 'budget', icon: '📊', label: 'Budget' },
        { id: 'profile', icon: '👤', label: 'Profile' },
    ];

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
