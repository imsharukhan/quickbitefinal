'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage({ navigate }) {
  const { registerUser, verifyOTP, resendOTP } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [otp, setOtp] = useState(['','','','','','']);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    let interval = null;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const isValidRegNo = /^[0-9]{8,16}$/.test(regNo);
  const isValidEmail = email && email.includes('@') && email.includes('.');
  const passwordsMatch = password === confirmPassword && password.length >= 6;
  const isFormValid = name && isValidRegNo && isValidEmail && passwordsMatch;

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await registerUser(name, regNo, email, password);
      if (res.requires_otp) {
        setStep(2);
        setTimer(60);
      } else {
        setSuccess('Account created! Redirecting to login...');
        setTimeout(() => navigate('login'), 2000);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail[0]?.msg || 'Registration failed');
      } else {
        setError(detail || err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    
    setLoading(true);
    setError('');
    try {
      await verifyOTP(regNo, code);
      setSuccess('Email verified! Redirecting to login...');
      setTimeout(() => navigate('login'), 2000);
    }  catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail[0]?.msg || 'Invalid OTP');
      } else {
        setError(detail || 'Invalid OTP');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await resendOTP(regNo);
      setTimer(60);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail[0]?.msg : detail || 'Failed to resend');
    }
  };

  const handleOtpChange = (index, value) => {
    if (/[^0-9]/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    if (value && index < 5) {
      otpRefs[index + 1].current.focus();
    }
    if (newOtp.join('').length === 6) {
      setTimeout(() => handleVerify(), 100);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current.focus();
    }
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
    
    if (focusIndex < 5) {
        otpRefs[focusIndex + 1].current.focus();
    } else {
        otpRefs[5].current.blur();
        setTimeout(() => handleVerify(), 100);
    }
  };

  const getStrength = (pass) => {
    if (pass.length === 0) return { width: '0%', color: 'transparent', label: '' };
    if (pass.length < 6) return { width: '33%', color: 'var(--red)', label: 'Weak' };
    if (pass.length <= 10) return { width: '66%', color: '#f59e0b', label: 'Medium' };
    return { width: '100%', color: 'var(--green)', label: 'Strong' };
  };

  const strength = getStrength(password);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{ background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>Q</div>
          <span>QuickBite</span>
        </div>

        {step === 1 ? (
          <>
            <h2 className="auth-title">Create an Account</h2>
            <p className="auth-subtitle">Join us to pre-order food easily</p>
            
            {error && <div className="error-box">{error}</div>}
            {success && <div className="success-box">{success}</div>}

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required disabled={loading} />
              </div>

              <div className="form-group">
                <label className="form-label">Register Number</label>
                <input type="text" className={`form-input ${(regNo && !isValidRegNo) ? 'error' : ''}`} placeholder="8-16 digits" value={regNo} onChange={e => setRegNo(e.target.value.replace(/\D/g, ''))} required disabled={loading} />
                {regNo && !isValidRegNo && <div className="field-error">Register number must be 8 to 16 digits</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className={`form-input ${(email && !isValidEmail) ? 'error' : ''}`} placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
                {email && !isValidEmail && (
                  <div className="field-hint" style={{color: 'var(--red)'}}>Please enter a valid email address</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
                <div className="password-strength" style={{ width: strength.width, backgroundColor: strength.color }}></div>
                {strength.label && <div className="field-hint" style={{ color: strength.color, fontWeight: 'bold' }}>{strength.label}</div>}
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Confirm Password</label>
                <input type="password" className={`form-input ${(confirmPassword && !passwordsMatch) ? 'error' : ''}`} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={loading} />
                {(confirmPassword && password !== confirmPassword) && <div className="field-error">Passwords do not match</div>}
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={!isFormValid || loading} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                {loading ? <div className="spinner"></div> : 'Create Account'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="auth-title">Check your inbox!</h2>
            <p className="auth-subtitle">We sent a 6-digit code to <strong>{email}</strong></p>
            
            {error && <div className="error-box">{error}</div>}
            {success && <div className="success-box">{success}</div>}

            <div className="otp-inputs" onPaste={handleOtpPaste}>
              {otp.map((d, i) => (
                <input key={i} ref={otpRefs[i]} type="text" maxLength={1} className="otp-input" value={d} onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)} disabled={loading} />
              ))}
            </div>

            <button type="button" className="btn btn-primary btn-block" onClick={handleVerify} disabled={otp.join('').length !== 6 || loading} style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              {loading ? <div className="spinner"></div> : 'Verify OTP'}
            </button>

            <div className="auth-divider">
              {timer > 0 ? (
                <span className="text-muted">Resend in {timer}s</span>
              ) : (
                <button type="button" className="auth-link" onClick={handleResend} disabled={loading}>Resend OTP</button>
              )}
            </div>
          </>
        )}

        <div className="auth-divider">
          Already have account? <button type="button" className="auth-link" onClick={() => navigate('login')}>Log in</button>
        </div>
      </div>
    </div>
  );
}
