'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as orderService from '../services/orderService';
import * as notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';

const AppContext = createContext();

const PLATFORM_FEE = 7;
const PLATFORM_UPI_ID = 'sharukhansharukhan926@oksbi';
const PLATFORM_UPI_NAME = 'QuickBite';

export function AppProvider({ children }) {
    const { isLoggedIn } = useAuth();
    
    const [cart, setCart] = useState([]);
    const [orders, setOrders] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [upiDeepLink, setUpiDeepLink] = useState('');
    const [lastPlacedOrder, setLastPlacedOrder] = useState(null);
    const [isOrdersLoading, setIsOrdersLoading] = useState(false);
    const [isNotifsLoading, setIsNotifsLoading] = useState(false);
    const isSubmittingRef = useRef(false);

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

    const loadNotifications = useCallback(async () => {
        setIsNotifsLoading(true);
        try {
            const data = await notificationService.getNotifications();
            setNotifications(data.notifications || []);
        } catch(e) {
            console.error(e);
            if (e?.response?.status === 401 || (e?.response && e.response.status === 401)) {
                if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:logout'));
            }
        } finally {
            setIsNotifsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            const role = localStorage.getItem('qb_role');
            if (role !== 'vendor') {
                loadOrders();
                loadNotifications();
            }
        } else {
            setOrders([]);
            setNotifications([]);
            setCart([]);
            setUpiDeepLink('');
            setLastPlacedOrder(null);
        }
    }, [isLoggedIn]);

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
    // Total including platform fee — used for payment
    const grandTotal = cartTotal + PLATFORM_FEE;

    const placeOrder = async (pickup_time, total_price) => {
        if (isSubmittingRef.current) return;
        if (cart.length === 0) return;
        
        isSubmittingRef.current = true;
        try {
            const outlet_id = cart[0].outletId;
            const items = cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity }));
            
            // Send total_price explicitly to backend
            const response = await orderService.placeOrder(outlet_id, items, pickup_time, total_price);

            // Build UPI deep link with platform UPI ID and grand total (items + platform fee)
            const deepLink = `upi://pay?pa=${PLATFORM_UPI_ID}&pn=${encodeURIComponent(PLATFORM_UPI_NAME)}&am=${total_price}&cu=INR&tn=QuickBite%20${response.id}%20Token%23${response.token_number}`;
            
            setUpiDeepLink(deepLink);
            // Store grandTotal on the order object for display
            setLastPlacedOrder({ ...response, displayTotal: total_price });
            clearCart();
            await loadOrders();
            return response;
        } finally {
            isSubmittingRef.current = false;
        }
    };

    const markNotificationRead = async (id) => {
        try {
            await notificationService.markAsRead(id);
            await loadNotifications();
        } catch(e) {}
    };

    const markAllNotificationsRead = async () => {
        try {
            await notificationService.markAllRead();
            await loadNotifications();
        } catch(e) {}
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <AppContext.Provider value={{
            cart, addToCart, removeFromCart, updateCartQuantity, clearCart,
            cartTotal, cartCount, grandTotal, platformFee: PLATFORM_FEE,
            orders, setOrders, placeOrder, loadOrders, isOrdersLoading,
            upiDeepLink, setUpiDeepLink, lastPlacedOrder, setLastPlacedOrder,
            notifications, markNotificationRead, markAllNotificationsRead,
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