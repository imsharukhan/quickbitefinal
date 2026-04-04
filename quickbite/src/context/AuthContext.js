'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
  try {
    if (typeof window === 'undefined') {
      setIsLoading(false)
      return
    }
    
    const token = localStorage.getItem('qb_token')
    const role = localStorage.getItem('qb_role')
    const name = localStorage.getItem('qb_name')
    const user_id = localStorage.getItem('qb_user_id')
    const mustChange = localStorage.getItem('qb_must_change') === 'true'
    
    if (token && token !== 'null' && token !== 'undefined' && role) {
      setUser({ id: user_id, name: name, role: role })
      setRole(role)
      setIsLoggedIn(true)
      setMustChangePassword(mustChange)
      if (role !== 'vendor') {
        authService.getMe().then(res => {
          setUser(prev => ({ ...prev, ...res.data }))
        }).catch((e) => {
          if (e?.response?.status === 401 || (e?.response && e.response.status === 401)) {
            authService.clearAuthData();
            setUser(null);
            setRole(null);
            setIsLoggedIn(false);
            setMustChangePassword(false);
          }
        })
      }
    } else {
      // No valid token - clear everything and show login
      setUser(null)
      setRole(null)
      setIsLoggedIn(false)
      setMustChangePassword(false)
    }
  } catch (error) {
    // Any error - clear state and show login
    setUser(null)
    setRole(null)
    setIsLoggedIn(false)
    setMustChangePassword(false)
  } finally {
    // ALWAYS set loading to false no matter what
    setIsLoading(false)
  }

  const handleLogout = () => {
    setUser(null)
    setRole(null)
    setIsLoggedIn(false)
    setMustChangePassword(false)
    setIsLoading(false)
  }
  
  window.addEventListener('auth:logout', handleLogout)
  return () => window.removeEventListener('auth:logout', handleLogout)
}, [])

  const loginStudent = async (register_number, password) => {
    const res = await authService.login(register_number, password);
    authService.saveAuthData(res.data);
    setUser({ id: res.data.user_id, name: res.data.name, role: res.data.role });
    setRole(res.data.role);
    setIsLoggedIn(true);
    setMustChangePassword(res.data.must_change_password || false);
    authService.getMe().then(r => {
      setUser(prev => ({ ...prev, ...r.data }))
    }).catch(() => {});
    return res.data;
  };

  const loginVendor = async (phone, password) => {
    const res = await authService.vendorLogin(phone, password);
    authService.saveAuthData(res.data);
    setUser({ id: res.data.user_id, name: res.data.name, role: res.data.role });
    setRole(res.data.role);
    setIsLoggedIn(true);
    setMustChangePassword(res.data.must_change_password || false);
    return res.data;
  };

  const logout = async () => {
    try { await authService.logout(); } catch (e) {}
    authService.clearAuthData();
    setUser(null);
    setRole(null);
    setIsLoggedIn(false);
    setMustChangePassword(false);
    setIsLoading(false);
  };

  const registerUser = async (name, register_number, email, password) => {
    const res = await authService.register(name, register_number, email, password);
    return res.data;
  };

  const verifyOTP = async (register_number, otp) => {
    const res = await authService.verifyOTP(register_number, otp);
    return res.data;
  };

  const completedPasswordChange = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('qb_must_change', 'false');
    }
    setMustChangePassword(false);
  };

  return (
    <AuthContext.Provider value={{
      user, role, isLoggedIn, isLoading, mustChangePassword,
      loginStudent, loginVendor, logout, registerUser, verifyOTP, completedPasswordChange
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
