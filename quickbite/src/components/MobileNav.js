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
        <>
            <style>{`
                .qb-mobile-nav {
                    position: fixed !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    background: var(--bg-white, #fff);
                    border-top: 1px solid var(--border-light, #eee);
                    z-index: 9999;
                    /* Prevent ANY movement on scroll */
                    transform: translateZ(0);
                    -webkit-transform: translateZ(0);
                    will-change: transform;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                    /* Prevent iOS rubber-band scroll from moving it */
                    -webkit-overflow-scrolling: touch;
                }
                .qb-mobile-nav-item {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 2px;
                    padding: 6px 0;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-muted, #999);
                    font-size: 0.6rem;
                    font-weight: 500;
                    position: relative;
                    transition: color 0.15s;
                    -webkit-tap-highlight-color: transparent;
                }
                .qb-mobile-nav-item.active {
                    color: var(--primary, #FC8019);
                }
                .qb-mobile-nav-item.active .qb-nav-icon {
                    transform: scale(1.15);
                }
                .qb-nav-icon {
                    font-size: 1.25rem;
                    line-height: 1;
                    transition: transform 0.15s;
                    display: block;
                }
                .qb-nav-badge {
                    position: absolute;
                    top: 4px;
                    right: calc(50% - 18px);
                    background: var(--primary, #FC8019);
                    color: white;
                    font-size: 0.55rem;
                    font-weight: 800;
                    min-width: 16px;
                    height: 16px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                    border: 2px solid var(--bg-white, #fff);
                }
                /* Push page content above nav */
                body { padding-bottom: env(safe-area-inset-bottom, 0px); }
            `}</style>
            <nav className="qb-mobile-nav">
                {items.map(item => (
                    <button
                        key={item.id}
                        className={`qb-mobile-nav-item ${currentPage === item.id ? 'active' : ''}`}
                        onClick={() => navigate(item.id)}
                    >
                        <span className="qb-nav-icon">{item.icon}</span>
                        {item.label}
                        {item.badge > 0 && (
                            <span className="qb-nav-badge">
                                {item.badge > 99 ? '99+' : item.badge}
                            </span>
                        )}
                    </button>
                ))}
            </nav>
        </>
    );
}