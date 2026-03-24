'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ORDER_STATUS } from '@/data/mockData';

const AppContext = createContext();

export function AppProvider({ children }) {
    const [role, setRole] = useState('student'); // 'student' | 'vendor'
    const [cart, setCart] = useState([]);
    const [orders, setOrders] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [user, setUser] = useState({
        name: 'Sharukhan T',
        email: 'sharukhan@quick.edu',
        studentId: '11523040468',
        avatar: null,
        walletBalance: 2000,
    });

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const savedCart = localStorage.getItem('quickBite_cart');
            const savedOrders = localStorage.getItem('quickBite_orders');
            const savedNotifications = localStorage.getItem('quickBite_notifications');
            const savedRole = localStorage.getItem('quickBite_role');
            if (savedCart) setCart(JSON.parse(savedCart));
            if (savedOrders) setOrders(JSON.parse(savedOrders));
            if (savedNotifications) setNotifications(JSON.parse(savedNotifications));
            if (savedRole) setRole(savedRole);
        } catch (e) {
            console.error('Error loading from localStorage', e);
        }
    }, []);

    // Persist to localStorage
    useEffect(() => { localStorage.setItem('quickBite_cart', JSON.stringify(cart)); }, [cart]);
    useEffect(() => { localStorage.setItem('quickBite_orders', JSON.stringify(orders)); }, [orders]);
    useEffect(() => { localStorage.setItem('quickBite_notifications', JSON.stringify(notifications)); }, [notifications]);
    useEffect(() => { localStorage.setItem('quickBite_role', role); }, [role]);

    const addToCart = useCallback((item, outletId, outletName) => {
        setCart(prev => {
            const existing = prev.find(ci => ci.id === item.id);
            if (existing) {
                return prev.map(ci => ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
            }
            return [...prev, { ...item, quantity: 1, outletId, outletName }];
        });
    }, []);

    const removeFromCart = useCallback((itemId) => {
        setCart(prev => prev.filter(ci => ci.id !== itemId));
    }, []);

    const updateCartQuantity = useCallback((itemId, quantity) => {
        if (quantity <= 0) {
            setCart(prev => prev.filter(ci => ci.id !== itemId));
        } else {
            setCart(prev => prev.map(ci => ci.id === itemId ? { ...ci, quantity } : ci));
        }
    }, []);

    const clearCart = useCallback(() => setCart([]), []);

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const placeOrder = useCallback((pickupTime, paymentMethod) => {
        const order = {
            id: 'ORD-' + Date.now().toString(36).toUpperCase(),
            items: [...cart],
            total: cartTotal,
            pickupTime,
            paymentMethod,
            status: ORDER_STATUS.PLACED,
            placedAt: new Date().toISOString(),
            outletName: cart[0]?.outletName || 'Campus Outlet',
            outletId: cart[0]?.outletId || '',
            studentName: user.name,
            studentId: user.studentId,
        };
        setOrders(prev => [order, ...prev]);
        setCart([]);
        addNotification(`Order ${order.id} placed successfully! Pickup at ${pickupTime}`);
        return order;
    }, [cart, cartTotal, user]);

    const updateOrderStatus = useCallback((orderId, newStatus) => {
        setOrders(prev =>
            prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
        );
        const statusMessages = {
            [ORDER_STATUS.CONFIRMED]: `Order ${orderId} has been confirmed by the vendor!`,
            [ORDER_STATUS.PREPARING]: `Order ${orderId} is now being prepared 🍳`,
            [ORDER_STATUS.READY]: `Order ${orderId} is ready for pickup! 🎉`,
            [ORDER_STATUS.PICKED_UP]: `Order ${orderId} has been picked up. Enjoy your meal!`,
            [ORDER_STATUS.CANCELLED]: `Order ${orderId} has been cancelled.`,
        };
        if (statusMessages[newStatus]) {
            addNotification(statusMessages[newStatus]);
        }
    }, []);

    const addNotification = useCallback((message) => {
        const notif = {
            id: 'n-' + Date.now(),
            message,
            timestamp: new Date().toISOString(),
            read: false,
        };
        setNotifications(prev => [notif, ...prev]);
    }, []);

    const markNotificationRead = useCallback((notifId) => {
        setNotifications(prev =>
            prev.map(n => n.id === notifId ? { ...n, read: true } : n)
        );
    }, []);

    const markAllNotificationsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <AppContext.Provider value={{
            role, setRole,
            cart, addToCart, removeFromCart, updateCartQuantity, clearCart, cartTotal, cartCount,
            orders, placeOrder, updateOrderStatus,
            notifications, addNotification, markNotificationRead, markAllNotificationsRead, unreadCount,
            user, setUser,
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
