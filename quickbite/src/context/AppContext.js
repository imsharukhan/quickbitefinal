'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as orderService from '../services/orderService';
import * as notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';


const AppContext = createContext();

const RAZORPAY_RATE = 0.0236; // 2% + 18% GST
const dedupeNotifications = (items = []) => {
    const byId = new Map();
    for (const item of items) {
        if (!item?.id) continue;
        const existing = byId.get(item.id);
        byId.set(item.id, existing ? { ...item, is_read: existing.is_read || item.is_read } : item);
    }
    return Array.from(byId.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export function AppProvider({ children }) {
    const { isLoggedIn, user } = useAuth();
 
    // ── Global WebSocket — runs on ALL pages so notifications and order
    // updates are instant regardless of which page student is on ────────
    const studentId = user?.id && localStorage.getItem('qb_role') !== 'vendor'
        ? user.id
        : null;
    const { lastMessage: wsMessage, isConnected: wsConnected } = useWebSocket('student', studentId);
 
    useEffect(() => {
        if (!wsMessage) return;
 
        if (wsMessage.type === 'STATUS_UPDATE') {
            if (wsMessage.order?.id) {
                setOrders(prev => [wsMessage.order, ...prev.filter(order => order.id !== wsMessage.order.id)]);
            } else {
                setOrders(prev => prev.map(order =>
                    order.id === wsMessage.order_id
                        ? {
                            ...order,
                            status: wsMessage.status,
                            payment_status: wsMessage.payment_status || order.payment_status,
                        }
                        : order
                ));
            }
            loadNotifications();
        }
 
        if (wsMessage.type === 'PAYMENT_CONFIRMED') {
            loadOrders();
            loadNotifications();
        }

        if (wsMessage.type === 'NEW_NOTIFICATION' && wsMessage.notification?.id) {
            setNotifications(prev => dedupeNotifications([wsMessage.notification, ...prev]));
        }
    }, [wsMessage]);

    const [cart, setCart] = useState([]);
    const [orders, setOrders] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [upiDeepLink, setUpiDeepLink] = useState('');
    const [lastPlacedOrder, setLastPlacedOrder] = useState(null);
    const [isOrdersLoading, setIsOrdersLoading] = useState(false);
    const [isNotifsLoading, setIsNotifsLoading] = useState(false);
    const isSubmittingRef = useRef(false);
    const hasInitialized = useRef(false);

    useEffect(() => {
        try {
            const savedCart = localStorage.getItem('qb_cart');
            if (savedCart) setCart(JSON.parse(savedCart));
        } catch (e) {}
    }, []);

    useEffect(() => { localStorage.setItem('qb_cart', JSON.stringify(cart)); }, [cart]);

    const loadOrders = useCallback(async () => {
        setIsOrdersLoading(true);
        try {
            const data = await orderService.getMyOrders();
            setOrders(data || []);
        } catch(e) {
            console.error(e);
            if (e?.response?.status === 401 || (e?.response && e.response.status === 401)) {
                if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:logout'));
            }
        } finally {
            setIsOrdersLoading(false);
        }
    }, []);

    const refreshAfterPayment = useCallback(async () => {
    // Called after Razorpay payment verify succeeds
    // Loads both orders and notifications so student sees confirmed order
        try {
            const [ordersData, notifsData] = await Promise.all([
                orderService.getMyOrders(),
                notificationService.getNotifications(),
            ]);
            setOrders(ordersData || []);
            setNotifications(prev => dedupeNotifications([...(notifsData?.notifications || []), ...prev]));
        } catch (e) {
            console.error('refresh after payment failed', e);
        }
    }, []);

    const refreshOrdersSilently = useCallback(async () => {
        try {
            const data = await orderService.getMyOrders();
            setOrders(data || []);
        } catch (e) {}
    }, []);

    const loadNotifications = useCallback(async () => {
        setIsNotifsLoading(true);
        try {
            const data = await notificationService.getNotifications();
            setNotifications(prev => dedupeNotifications([...(data.notifications || []), ...prev]));
        } catch(e) {
            console.error(e);
            if (e?.response?.status === 401 || (e?.response && e.response.status === 401)) {
                if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:logout'));
            }
        } finally {
            setIsNotifsLoading(false);
        }
    }, []);

    // On mount — load immediately from localStorage token without waiting for AuthContext
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('qb_token');
        const role = localStorage.getItem('qb_role');
        if (token && token !== 'null' && token !== 'undefined' && role !== 'vendor') {
            loadOrders();
            loadNotifications();
        }
    }, []); // runs once on mount — fixes refresh empty state

    useEffect(() => {
        if (isLoggedIn) {
            hasInitialized.current = true;
            const role = localStorage.getItem('qb_role');
            if (role !== 'vendor') {
                loadOrders();
                loadNotifications();
            }
        } else if (hasInitialized.current) {
            // Only clear on REAL logout — not on initial render flash
            setOrders([]);
            setNotifications([]);
            setCart([]);
            setUpiDeepLink('');
            setLastPlacedOrder(null);
            hasInitialized.current = false;
        }
    }, [isLoggedIn]);

    useEffect(() => {
        const hasActiveOrders = orders.some(order =>
            order.payment_status === 'COMPLETED' &&
            !['Picked Up', 'Cancelled'].includes(order.status)
        );
        if (!isLoggedIn || !studentId || (wsConnected && !hasActiveOrders)) return;
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            refreshOrdersSilently();
            loadNotifications();
        }, 3000);
        return () => clearInterval(interval);
    }, [isLoggedIn, studentId, wsConnected, orders, refreshOrdersSilently, loadNotifications]);

    const addToCart = useCallback((item, outletId, outletName) => {
        let conflict = false;
        let existingOutlet = '';
        
        setCart(prev => {
            if (prev.length > 0 && prev[0].outletId !== outletId) {
                conflict = true;
                existingOutlet = prev[0].outletName;
                return prev;
            }
            const existing = prev.find(ci => ci.id === item.id);
            if (existing) {
                return prev.map(ci => ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
            }
            return [...prev, { ...item, quantity: 1, outletId, outletName }];
        });
        
        if (conflict) return { conflict: true, existingOutlet };
        return { conflict: false };
    }, []);

    const removeFromCart = useCallback((itemId) => setCart(prev => prev.filter(ci => ci.id !== itemId)), []);
    
    const updateCartQuantity = useCallback((itemId, quantity) => {
        if (quantity <= 0) setCart(prev => prev.filter(ci => ci.id !== itemId));
        else setCart(prev => prev.map(ci => ci.id === itemId ? { ...ci, quantity } : ci));
    }, []);
    
    const clearCart = useCallback(() => setCart([]), []);

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const processingFee = Math.ceil(cartTotal / (1 - RAZORPAY_RATE)) - cartTotal;
    const grandTotal = cartTotal + processingFee;

    const placeOrder = async (pickup_time, total_price) => {
        if (isSubmittingRef.current) return;
        if (cart.length === 0) return;
        
        isSubmittingRef.current = true;
        try {
            const outlet_id = cart[0].outletId;
            const items = cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity }));
            
            // Send total_price explicitly to backend
            const response = await orderService.placeOrder(outlet_id, items, pickup_time, total_price);

            setLastPlacedOrder({ ...response, displayTotal: total_price });
            // Cart cleared only after payment succeeds — see CartPage onSuccess
            // Don't load orders here — payment hasn't happened yet
            // Orders will load after payment verify succeeds
            return response;
        } finally {
            isSubmittingRef.current = false;
        }
    };

    const markNotificationRead = async (id) => {
        try {
            const updated = await notificationService.markAsRead(id);
            setNotifications(prev => dedupeNotifications(prev.map(n => n.id === id ? updated : n)));
        } catch(e) {}
    };

    const markAllNotificationsRead = async () => {
        try {
            const data = await notificationService.markAllRead();
            setNotifications(dedupeNotifications(data?.notifications || []));
        } catch(e) {}
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <AppContext.Provider value={{
            cart, addToCart, removeFromCart, updateCartQuantity, clearCart,
            cartTotal, cartCount, grandTotal, processingFee,
            orders, setOrders, placeOrder, loadOrders, refreshAfterPayment, isOrdersLoading,
            upiDeepLink, setUpiDeepLink, lastPlacedOrder, setLastPlacedOrder,
            notifications, setNotifications, loadNotifications, markNotificationRead, markAllNotificationsRead,
            unreadCount, isNotifsLoading, isSubmittingRef
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
}
