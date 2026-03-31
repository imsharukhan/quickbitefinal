'use client';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

export default function Navbar({ currentPage, navigate }) {
    const { cartCount, unreadCount } = useApp();
    const { role } = useAuth();

    return (
        <nav className="navbar">
            <div className="navbar-brand" onClick={() => navigate('home')}>
                <div className="navbar-brand-icon">Q</div>
                QuickBite
            </div>

            <div className="navbar-center">
                {role === 'vendor' ? (
                    <button className="nav-link active">Dashboard</button>
                ) : (
                    <>
                        <button className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}>
                            Home
                        </button>
                        <button className={`nav-link ${currentPage === 'orders' ? 'active' : ''}`} onClick={() => navigate('orders')}>
                            My Orders
                        </button>
                        <button className={`nav-link ${currentPage === 'budget' ? 'active' : ''}`} onClick={() => navigate('budget')}>
                            Budget
                        </button>
                        <button className={`nav-link ${currentPage === 'profile' ? 'active' : ''}`} onClick={() => navigate('profile')}>
                            Profile
                        </button>
                    </>
                )}
            </div>

            <div className="navbar-actions">
                {role !== 'vendor' && (
                    <>
                        <button className="icon-btn" onClick={() => navigate('notifications')} title="Notifications">
                            🔔
                            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                        </button>
                        <button className="icon-btn" onClick={() => navigate('cart')} title="Cart">
                            🛒
                            {cartCount > 0 && <span className="badge">{cartCount}</span>}
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
}