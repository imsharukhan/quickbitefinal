'use client';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

const NavIcons = {
    home: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
        </svg>
    ),
    orders: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path d="M9 12h6M9 16h4"/>
        </svg>
    ),
    cart: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
    ),
    notifications: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
    ),
    profile: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
    ),
    vendor: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
    ),
};

export default function MobileNav({ currentPage, navigate }) {
    const { cartCount, unreadCount } = useApp();
    const { role } = useAuth();

    const studentItems = [
        { id: 'home',          label: 'Home' },
        { id: 'orders',        label: 'Orders' },
        { id: 'cart',          label: 'Cart',   badge: cartCount },
        { id: 'notifications', label: 'Alerts', badge: unreadCount },
        { id: 'profile',       label: 'Profile' },
    ];

    const vendorItems = [
        { id: 'vendor', label: 'Dashboard' },
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
                    height: 62px;
                    display: flex;
                    align-items: center;
                    background: var(--bg-white, #fff);
                    border-top: 1px solid var(--border-light, #eee);
                    z-index: 9999;
                    transform: translateZ(0);
                    -webkit-transform: translateZ(0);
                    will-change: transform;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                    -webkit-overflow-scrolling: touch;
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                }
                .qb-mobile-nav-item {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 6px 0;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-muted, #bbb);
                    font-size: 0.58rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    position: relative;
                    transition: color 0.15s;
                    -webkit-tap-highlight-color: transparent;
                }
                .qb-mobile-nav-item.active {
                    color: var(--primary, #FC8019);
                }
                .qb-mobile-nav-item.active .qb-nav-icon {
                    transform: translateY(-1px) scale(1.1);
                }
                .qb-nav-icon {
                    line-height: 1;
                    transition: transform 0.15s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qb-mobile-nav-item.active .qb-nav-icon svg {
                    stroke: var(--primary, #FC8019);
                }
                .qb-nav-badge {
                    position: absolute;
                    top: 5px;
                    right: calc(50% - 20px);
                    background: var(--primary, #FC8019);
                    color: white;
                    font-size: 0.52rem;
                    font-weight: 800;
                    min-width: 15px;
                    height: 15px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 3px;
                    border: 2px solid var(--bg-white, #fff);
                }
            `}</style>
            <nav className="qb-mobile-nav">
                {items.map(item => {
                    const Icon = NavIcons[item.id];
                    return (
                        <button
                            key={item.id}
                            className={`qb-mobile-nav-item ${currentPage === item.id ? 'active' : ''}`}
                            onClick={() => navigate(item.id)}
                        >
                            <span className="qb-nav-icon">
                                {Icon && <Icon />}
                            </span>
                            {item.label}
                            {item.badge > 0 && (
                                <span className="qb-nav-badge">
                                    {item.badge > 99 ? '99+' : item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </>
    );
}