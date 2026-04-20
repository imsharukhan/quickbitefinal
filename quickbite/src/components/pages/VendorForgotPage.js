'use client';
import { useState, useRef, useEffect } from 'react';
import * as authService from '../../services/authService';

export default function VendorForgotPage({ navigate }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // CHANGED: phone → email
  const [email, setEmail] = useState('');

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const [timer, setTimer] = useState(0);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let interval = null;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // CHANGED: validate email instead of phone
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!isValidEmail) return;
    setLoading(true);
    setError('');
    try {
      // CHANGED: pass email
      await authService.vendorForgotPassword(email);
      setSuccess('OTP sent to your registered email.');
      setTimeout(() => {
        setSuccess('');
        setStep(2);
        setTimer(60);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = (e) => {
    e.preventDefault();
    if (otp.join('').length !== 6) return;
    setStep(3);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword || newPassword.length < 6) return;
    setLoading(true);
    setError('');
    try {
      // CHANGED: pass email instead of phone
      await authService.vendorResetPassword(email, otp.join(''), newPassword);
      setSuccess('Password reset successfully!');
      setTimeout(() => navigate('login'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password. OTP may be expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await authService.vendorForgotPassword(email);
      setTimer(60);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend');
    }
  };

  const handleOtpChange = (index, value) => {
    if (/[^0-9]/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs[index + 1].current.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs[index - 1].current.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    let focusIndex = 0;
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
      focusIndex = i;
    }
    setOtp(newOtp);
    if (focusIndex < 5) otpRefs[focusIndex + 1].current.focus();
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
          <span>QuickBite</span>
        </div>

        {step === 1 && (
          <>
            <h2 className="auth-title">Vendor Recovery</h2>
            {/* CHANGED: subtitle now says email */}
            <p className="auth-subtitle">We'll send an OTP to your registered email</p>
            {error && <div className="error-box">{error}</div>}
            {success && <div className="success-box">{success}</div>}
            <form onSubmit={handleSendOTP}>
              {/* CHANGED: email input replaces phone input */}
              <div className="form-group">
                <label className="form-label">Registered Email</label>
                <input
                  type="email"
                  className={`form-input ${email && !isValidEmail ? 'error' : ''}`}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="your@email.com"
                />
                {email && !isValidEmail && (
                  <div className="field-error">Please enter a valid email address</div>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={!isValidEmail || loading}
                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              >
                {loading ? <div className="spinner"></div> : 'Send OTP'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="auth-title">Verify OTP</h2>
            <p className="auth-subtitle">Enter the 6-digit code sent to your email</p>
            {error && <div className="error-box">{error}</div>}
            <form onSubmit={handleVerifyOTP}>
              <div className="otp-inputs" onPaste={handleOtpPaste}>
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={otpRefs[i]}
                    type="text"
                    maxLength={1}
                    className="otp-input"
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    disabled={loading}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={otp.join('').length !== 6}
                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              >
                Verify OTP
              </button>
              <div className="auth-divider">
                {timer > 0
                  ? <span className="text-muted">Resend in {timer}s</span>
                  : <button type="button" className="auth-link" onClick={handleResend} disabled={loading}>Resend OTP</button>
                }
              </div>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="auth-title">New Password</h2>
            <p className="auth-subtitle">Create a secure password</p>
            {error && <div className="error-box">{error}</div>}
            {success && <div className="success-box">{success}</div>}
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <div className="password-strength" style={{ width: strength.width, backgroundColor: strength.color }}></div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className={`form-input ${confirmPassword && newPassword !== confirmPassword ? 'error' : ''}`}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={newPassword !== confirmPassword || newPassword.length < 6 || loading}
                style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
              >
                {loading ? <div className="spinner"></div> : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        <div className="auth-divider">
          <button type="button" className="auth-link" onClick={() => navigate('login')}>Back to Login</button>
        </div>
      </div>
    </div>
  );
}