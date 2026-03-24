'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import Navbar from '@/components/Navbar';
import MobileNav from '@/components/MobileNav';
import HomePage from '@/components/pages/HomePage';
import MenuPage from '@/components/pages/MenuPage';
import CartPage from '@/components/pages/CartPage';
import OrdersPage from '@/components/pages/OrdersPage';
import NotificationsPage from '@/components/pages/NotificationsPage';
import ProfilePage from '@/components/pages/ProfilePage';
import VendorDashboard from '@/components/pages/VendorDashboard';
import BudgetPage from '@/components/pages/BudgetPage';
import Toast from '@/components/Toast';

export default function Page() {
  const { role } = useApp();
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const navigate = (page, data) => {
    if (page === 'menu' && data) {
      setSelectedOutlet(data);
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPage = () => {
    if (role === 'vendor') {
      return <VendorDashboard showToast={showToast} />;
    }

    switch (currentPage) {
      case 'home':
        return <HomePage navigate={navigate} />;
      case 'menu':
        return <MenuPage outlet={selectedOutlet} navigate={navigate} showToast={showToast} />;
      case 'cart':
        return <CartPage navigate={navigate} showToast={showToast} />;
      case 'orders':
        return <OrdersPage navigate={navigate} />;
      case 'notifications':
        return <NotificationsPage />;
      case 'profile':
        return <ProfilePage navigate={navigate} />;
      case 'budget':
        return <BudgetPage navigate={navigate} />;
      default:
        return <HomePage navigate={navigate} />;
    }
  };

  return (
    <>
      <Navbar currentPage={currentPage} navigate={navigate} />
      <main className="main-content">
        <div className="page-enter">
          {renderPage()}
        </div>
      </main>
      {role === 'student' && <MobileNav currentPage={currentPage} navigate={navigate} />}
      <Toast toasts={toasts} />
    </>
  );
}
