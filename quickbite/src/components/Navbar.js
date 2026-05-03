'use client';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

const Icons = {
    Home: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
        </svg>
    ),
    Orders: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path d="M9 12h6M9 16h4"/>
        </svg>
    ),
    Budget: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 6v2m0 8v2M9.5 9.5A2.5 2.5 0 0 1 12 8c1.38 0 2.5.9 2.5 2s-1.12 2-2.5 2-2.5.9-2.5 2 1.12 2 2.5 2a2.5 2.5 0 0 0 2.5-1.5"/>
        </svg>
    ),
    Profile: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
    ),
    Bell: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
    ),
    Cart: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
    ),
    Dashboard: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
    ),
};

export default function Navbar({ currentPage, navigate }) {
    const { cartCount, unreadCount } = useApp();
    const { role } = useAuth();

    return (
        <nav className="navbar">
            <div className="navbar-brand" onClick={() => navigate('home')}>
                <div className="navbar-brand-icon" style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.3px', lineHeight: 1 }}>
    GNG
</div>
                Grab N Go
            </div>

            <div className="navbar-center">
                {role === 'vendor' ? (
                    <button className="nav-link active">
                        <Icons.Dashboard /> Dashboard
                    </button>
                ) : (
                    <>
                        <button className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}>
                            <Icons.Home /> Home
                        </button>
                        <button className={`nav-link ${currentPage === 'orders' ? 'active' : ''}`} onClick={() => navigate('orders')}>
                            <Icons.Orders /> My Orders
                        </button>
                        <button className={`nav-link ${currentPage === 'budget' ? 'active' : ''}`} onClick={() => navigate('budget')}>
                            <Icons.Budget /> Budget
                        </button>
                        <button className={`nav-link ${currentPage === 'profile' ? 'active' : ''}`} onClick={() => navigate('profile')}>
                            <Icons.Profile /> Profile
                        </button>
                    </>
                )}
            </div>

            <div className="navbar-actions">
                {role !== 'vendor' && (
                    <>
                        <button className="icon-btn" onClick={() => navigate('notifications')} title="Notifications">
                            <Icons.Bell />
                            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                        </button>
                        <button className="icon-btn" onClick={() => navigate('cart')} title="Cart">
                            <Icons.Cart />
                            {cartCount > 0 && <span className="badge">{cartCount}</span>}
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
}