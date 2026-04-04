'use client';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage({ navigate }) {
  const { loginStudent, loginVendor } = useAuth();
  const [tab, setTab] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [regNo, setRegNo] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (tab === 'student') {
        if (!regNo || !password) throw new Error('Fill all fields');
        await loginStudent(regNo, password);
      } else {
        if (!phone || !password) throw new Error('Fill all fields');
        await loginVendor(phone, password);
      }
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 400 || err.response.status === 403 || err.response.status === 422)) {
        setError(tab === 'student' ? 'Incorrect register number or password.' : 'Invalid Credentials');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{ background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>Q</div>
          <span>QuickBite</span>
        </div>
        
        <h2 className="auth-title">Welcome Back 👋</h2>
        <p className="auth-subtitle">Log in to your account to continue</p>
        
        <div className="role-switcher" style={{ marginBottom: '24px', display: 'flex', gap: '8px', background: 'var(--bg)', padding: '4px', borderRadius: 'var(--radius)' }}>
          <button 
            type="button"
            className={`role-btn ${tab === 'student' ? 'active' : ''}`}
            onClick={() => { setTab('student'); setError(''); }}
            style={{ flex: 1, padding: '8px', border: 'none', background: tab === 'student' ? 'white' : 'transparent', borderRadius: 'var(--radius-sm)', fontWeight: '600', cursor: 'pointer', boxShadow: tab === 'student' ? 'var(--shadow-sm)' : 'none' }}
          >
            Student / Staff
          </button>
          <button 
            type="button"
            className={`role-btn ${tab === 'vendor' ? 'active' : ''}`}
            onClick={() => { setTab('vendor'); setError(''); }}
            style={{ flex: 1, padding: '8px', border: 'none', background: tab === 'vendor' ? 'white' : 'transparent', borderRadius: 'var(--radius-sm)', fontWeight: '600', cursor: 'pointer', boxShadow: tab === 'vendor' ? 'var(--shadow-sm)' : 'none' }}
          >
            Vendor
          </button>
        </div>
        
        {error && <div className="error-box">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          {tab === 'student' ? (
            <div className="form-group">
              <label className="form-label">Register Number</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. 11523040468" 
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                disabled={loading}
              />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input 
                type="tel" 
                className="form-input" 
                placeholder="Enter phone number" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
          )}
          
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="form-label">Password</label>
              {tab === 'student' ? (
                <button type="button" className="auth-link" onClick={() => navigate('forgot')} style={{ fontSize: '0.8rem' }}>
                  Forgot Password?
                </button>
              ) : (
                <button type="button" className="auth-link" onClick={() => navigate('vendor-forgot')} style={{ fontSize: '0.8rem' }}>
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                className="form-input" 
                placeholder="Enter password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button type="button" className="input-eye" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ width: '100%', marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            {loading ? <div className="spinner"></div> : 'Log in'}
          </button>
        </form>
        
        <div className="auth-divider" style={{ marginTop: '24px' }}>
          {tab === 'student' ? (
            <>New here? <button type="button" className="auth-link" onClick={() => navigate('register')}>Create account →</button></>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vendor accounts are created by admin</span>
          )}
        </div>
      </div>
    </div>
  );
}
