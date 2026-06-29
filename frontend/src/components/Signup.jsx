import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Lock, User, CheckCircle2, HelpCircle } from 'lucide-react';

export const Signup = ({ onNavigate }) => {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState("What is your mother's maiden name?");
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Client side validation checks
  const isUsernameValid = /^[a-z]+$/.test(username);
  
  const isLengthValid = password.length >= 8 && password.length <= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = isLengthValid && hasUppercase && hasDigit && hasSpecial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isUsernameValid) {
      setError('Username must contain strictly lowercase letters only.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password requirements not met.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    if (!securityAnswer.trim()) {
      setError('Security answer is required.');
      return;
    }

    setLoading(true);
    try {
      await signup(name, username, password, securityQuestion, securityAnswer);
      if (onNavigate) onNavigate('dashboard');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel" style={{ maxWidth: '460px' }}>
        <div className="auth-header">
          <h2>Create Account</h2>
          <p>Get started with secure cloud storage</p>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                id="username"
                placeholder="lowercase letters only"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: isUsernameValid ? '#34d399' : '#94a3b8', marginTop: '6px' }}>
              Must contain strictly lowercase letters (a-z). No numbers/spaces.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="password"
                id="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <label htmlFor="confirmPassword">Confirm Password</label>
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

          <div className="form-group">
            <label htmlFor="securityQuestion">Security Question</label>
            <div style={{ position: 'relative' }}>
              <HelpCircle size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <select
                id="securityQuestion"
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                style={{
                  paddingLeft: '40px',
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: '#f8fafc',
                  outline: 'none'
                }}
                required
              >
                <option value="What is your mother's maiden name?">What is your mother's maiden name?</option>
                <option value="What was the name of your first pet?">What was the name of your first pet?</option>
                <option value="What was the name of your first school?">What was the name of your first school?</option>
                <option value="What is the city where you were born?">What is the city where you were born?</option>
              </select>
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
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?
            <button className="auth-link" onClick={() => onNavigate('login')} style={{ background: 'none', font: 'inherit' }}>
              Log In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
