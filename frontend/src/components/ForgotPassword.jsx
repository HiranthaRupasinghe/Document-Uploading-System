import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { AlertCircle, Lock, User, CheckCircle2, ArrowLeft, HelpCircle } from 'lucide-react';

export const ForgotPassword = ({ onNavigate }) => {
  const { resetPassword } = useAuth();
  const [step, setStep] = useState(1); // Step 1: Username, Step 2: Security Answer, Step 3: Password reset
  const [username, setUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const isLengthValid = newPassword.length >= 8 && newPassword.length <= 12;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordValid = isLengthValid && hasUppercase && hasDigit && hasSpecial;

  const handleVerifyUsername = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!username.trim()) {
      setError('Username is required.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/security-question/${username}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Username verification failed');
      }
      setSecurityQuestion(data.securityQuestion);
      setSuccess('Username successfully correct.');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Incorrect username.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswer = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-security-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, securityAnswer })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }
      setSuccess('Security answer successfully correct.');
      setStep(3);
    } catch (err) {
      setError(err.message || 'Incorrect security answer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isPasswordValid) {
      setError('Password requirements not met.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(username, securityAnswer, newPassword);
      setSuccess('Your password has been reset successfully! You can now log in.');
      setTimeout(() => {
        onNavigate('login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please verify the username and security answer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel" style={{ maxWidth: '460px' }}>
        <div className="auth-header">
          <h2>Reset Password</h2>
          <p>Set a new password for your account</p>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="success-message">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleVerifyUsername}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  id="username"
                  placeholder="enter your lowercase username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Username'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyAnswer}>
            <div className="form-group">
              <label htmlFor="username-display">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  id="username-display"
                  value={username}
                  disabled
                  style={{ paddingLeft: '40px', background: 'rgba(255, 255, 255, 0.02)', color: '#64748b' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Security Question</label>
              <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.9rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={16} />
                <span>{securityQuestion}</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="securityAnswer">Security Answer</label>
              <div style={{ position: 'relative' }}>
                <HelpCircle size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  id="securityAnswer"
                  placeholder="Enter your security answer"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Answer'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username-display-3">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  id="username-display-3"
                  value={username}
                  disabled
                  style={{ paddingLeft: '40px', background: 'rgba(255, 255, 255, 0.02)', color: '#64748b' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="password"
                  id="newPassword"
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: isLengthValid ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> Exactly 8 to 12 characters
                </span>
                <span style={{ fontSize: '0.75rem', color: hasUppercase ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> At least one uppercase letter
                </span>
                <span style={{ fontSize: '0.75rem', color: hasDigit ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> At least one numeric digit
                </span>
                <span style={{ fontSize: '0.75rem', color: hasSpecial ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> At least one special symbol
                </span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="password"
                  id="confirmPassword"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <button className="auth-link" onClick={() => onNavigate('login')} style={{ background: 'none', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={16} /> Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};
