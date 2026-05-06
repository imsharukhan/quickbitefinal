'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
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

import LoginPage from '@/components/pages/LoginPage';
import RegisterPage from '@/components/pages/RegisterPage';
import ForgotPasswordPage from '@/components/pages/ForgotPasswordPage';
import VendorForgotPage from '@/components/pages/VendorForgotPage';
import VendorChangePasswordPage from '@/components/pages/VendorChangePasswordPage';

// Pages where back should go to 'home'
const BACK_MAP = {
  menu:          'home',
  cart:          'home',
  orders:        'home',
  notifications: 'home',
  profile:       'home',
  budget:        'home',
};

export default function Page() {
  const { isLoggedIn, role, isLoading, mustChangePassword } = useAuth();
  const { liveNotif } = useApp();
  const [authPage, setAuthPage]           = useState('login');
  const [currentPage, setCurrentPage]     = useState('home');
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [toasts, setToasts]               = useState([]);
  const [timeoutReached, setTimeoutReached] = useState(false);

  // Internal nav stack — used to resolve back button
  const navStack = useRef(['home']);
  const isPopRef = useRef(false);
  const backPressedOnce = useRef(false);
  const backPressTimer = useRef(null);

  // ── Bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    // Seed exactly 2 entries: [root, guard]
    // Internal nav never touches browser history — only React state
    if (typeof window !== 'undefined') {
      window.history.replaceState({ appRoot: true }, '');
      window.history.pushState({ appGuard: true }, '');
    }

    const timeout = setTimeout(() => {
      if (isLoading && !timeoutReached) setTimeoutReached(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [isLoading]);

  const handlePop = () => {
      const stack = navStack.current;

      if (stack.length <= 1) {
        // Already at home — double-swipe-to-exit
        if (backPressedOnce.current) {
          // Second swipe within 2s — don't re-push guard
          // Browser stays at [root] → PWA minimizes/exits naturally on Android
          clearTimeout(backPressTimer.current);
          backPressedOnce.current = false;
          return; // do NOT re-push → exit happens
        }
        // First swipe — show toast, re-push guard so next swipe fires popstate again
        backPressedOnce.current = true;
        showToast('Swipe back again to exit', 'info');
        window.history.pushState({ appGuard: true }, '');
        backPressTimer.current = setTimeout(() => {
          backPressedOnce.current = false;
        }, 2000);
        return;
      }

      // Non-home page — navigate back in React state
      stack.pop();
      const prevPage = stack[stack.length - 1];
      isPopRef.current = true;
      setCurrentPage(prevPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Always re-push guard to keep browser history at exactly [root, guard]
      window.history.pushState({ appGuard: true }, '');
    };
        

  // ── Toast helper ──────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    if (!liveNotif) return;
    showToast(liveNotif.message, liveNotif.type || 'info');
  }, [liveNotif]);

  // ── Navigate ──────────────────────────────────────────────────────
  const navigate = (page, data) => {
    if (page === 'menu' && data) setSelectedOutlet(data);

    // Internal navigation = React state only, NEVER touch browser history
    // Browser history stays fixed at [root, guard] always
    if (!isPopRef.current) {
      navStack.current.push(page);
    }
    isPopRef.current = false;

    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Exit App ─────────────────────────────────────────────────────
  const exitApp = () => {
    const depth = navStack.current.length - 1;
    navStack.current = ['home'];
    setCurrentPage('home');
    // On desktop: close tab. On mobile: go home first, then double-back handles exit.
    if (depth > 0) {
      window.history.go(-depth);
      setTimeout(() => window.close(), 150);
    } else {
      window.close();
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (currentPage) {
      case 'home':          return <HomePage navigate={navigate} />;
      case 'menu':          return <MenuPage outlet={selectedOutlet} navigate={navigate} showToast={showToast} />;
      case 'cart':          return <CartPage navigate={navigate} showToast={showToast} />;
      case 'orders':        return <OrdersPage navigate={navigate} />;
      case 'notifications': return <NotificationsPage navigate={navigate} />;
      case 'profile':       return <ProfilePage navigate={navigate} />;
      case 'budget':        return <BudgetPage navigate={navigate} />;
      default:              return <HomePage navigate={navigate} />;
    }
  };

  if (isLoading && !timeoutReached) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff' }}>
        <div className="spinner" style={{ borderColor: 'rgba(252,128,25,0.2)', borderTopColor: '#FC8019', width: '40px', height: '40px', borderWidth: '4px' }}></div>
        <h2 style={{ color: '#FC8019', marginTop: '16px', fontWeight: 'bold' }}>Grab N Go</h2>
      </div>
    );
  }

  if (!isLoggedIn) {
    if (authPage === 'register')      return <RegisterPage navigate={setAuthPage} />;
    if (authPage === 'forgot')        return <ForgotPasswordPage navigate={setAuthPage} />;
    if (authPage === 'vendor-forgot') return <VendorForgotPage navigate={setAuthPage} />;
    return <LoginPage navigate={setAuthPage} />;
  }

  if (isLoggedIn && role !== 'student' && mustChangePassword) {
    return <VendorChangePasswordPage />;
  }

  if (isLoggedIn && role === 'vendor') {
    return <VendorDashboard showToast={showToast} />;
  }

  return (
    <>
      <Navbar currentPage={currentPage} navigate={navigate} exitApp={exitApp} />
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