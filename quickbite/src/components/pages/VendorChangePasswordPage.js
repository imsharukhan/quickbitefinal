'use client';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as authService from '../../services/authService';

export default function VendorChangePasswordPage() {
  const { completedPasswordChange } = useAuth();
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword || newPassword.length < 6) return;
    
    setLoading(true);
    setError('');
    
    try {
      await authService.changePassword(newPassword);
      setSuccess('Password updated! Loading dashboard...');
      setTimeout(() => {
        completedPasswordChange();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const getStrength = (pass) => {
    if (pass.length === 0) return { width: '0%', color: 'transparent', label: '' };
    if (pass.length < 6) return { width: '33%', color: 'var(--red)', label: 'Weak' };
    if (pass.length <= 10) return { width: '66%', color: '#f59e0b', label: 'Medium' };
    return { width: '100%', color: 'var(--green)', label: 'Strong' };
  };
  const strength = getStrength(newPassword);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{ background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>Q</div>
          <span>Grab N Go</span>
        </div>
        
        <h2 className="auth-title">Welcome! Set Your Password 👋</h2>
        <p className="auth-subtitle">Your account requires you to set your own secure password to continue.</p>
        
        {error && <div className="error-box">{error}</div>}
        {success && <div className="success-box">{success}</div>}
        
        <form onSubmit={handleSubmit}>
          
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div className="input-wrapper">
              <input 
                type={showNew ? "text" : "password"} 
                className="form-input" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button type="button" className="input-eye" onClick={() => setShowNew(!showNew)}>
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="password-strength" style={{ width: strength.width, backgroundColor: strength.color }}></div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input 
              type="password" 
              className={`form-input ${(confirmPassword && newPassword !== confirmPassword) ? 'error' : ''}`} 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
            {(confirmPassword && newPassword !== confirmPassword) && <div className="field-error">Passwords do not match</div>}
          </div>
          
          <button type="submit" className="btn btn-primary btn-block" disabled={newPassword !== confirmPassword || newPassword.length < 6 || loading} style={{ width: '100%', marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            {loading ? <div className="spinner"></div> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
