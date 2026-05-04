'use client';
import { useState, useEffect, useRef } from 'react';
import * as authService from '../services/authService';

export function useWebSocket(role, id) {
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const attemptRef = useRef(0);

    useEffect(() => {
        if (!id || !role) return;
        
        const connect = () => {
            if (attemptRef.current > 5) return;
            
            const token = localStorage.getItem('qb_token');
            const storedRole = localStorage.getItem('qb_role');
            const normalizedStored = storedRole === 'staff' ? 'student' : storedRole;
            
            // SECURITY: Prevent cross-role token network storms
            if (role !== normalizedStored) {
                return;
            }

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://quickbitefinal-production.up.railway.app';
            const baseUrl = apiUrl.replace(/^http/, 'ws');
            const wsUrl = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/api/orders/ws/${role}/${id}?token=${token}`;
            
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;
            
            ws.onopen = () => {
                setIsConnected(true);
                attemptRef.current = 0;
            };
            
            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    } else if (data.type === 'TOKEN_EXPIRING') {
                        const refreshToken = localStorage.getItem('qb_refresh');
                        if (refreshToken) {
                            try {
                                const res = await authService.refreshToken(refreshToken);
                                authService.saveAuthData({ ...authService.getAuthData(), access_token: res.data.access_token, refresh_token: refreshToken });
                            } catch (e) {
                                window.dispatchEvent(new Event('auth:logout'));
                            }
                        }
                    } else {
                        setLastMessage(data);
                    }
                } catch (e) {}
            };
            
            ws.onclose = (event) => {
                setIsConnected(false);
                // 4001 = auth failure — stop immediately, don't retry
                if (event.code === 4001) return;
                attemptRef.current += 1;
                // Cap at 5 retries (max ~10s delay), then reset to keep trying every 30s
                const retryCount = Math.min(attemptRef.current, 5);
                const jitter = Math.random() * 1000 - 500;
                const delay = retryCount < 5
                    ? (retryCount * 2000) + jitter
                    : 30000 + jitter; // settled into 30s heartbeat — won't hammer server
                setTimeout(connect, Math.max(0, delay));
            };
            
            ws.onerror = () => {
                ws.close();
            };
        };

        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.onopen = null;
                wsRef.current.onclose = null;
                wsRef.current.onmessage = null;
                wsRef.current.onerror = null;
                if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
                    wsRef.current.close();
                }
            }
        };
    }, [role, id]);

    return { lastMessage, isConnected };
}
