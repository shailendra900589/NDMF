import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/api';

export default function Login() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (mobile.length < 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(mobile, password);
      localStorage.setItem('ndfa_token', res.data.token);
      localStorage.setItem('ndfa_user', JSON.stringify(res.data));
      navigate('/');
    } catch (err) {
      setError(err.message || 'Unable to sign in. Check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--a" aria-hidden />
      <div className="login-page__glow login-page__glow--b" aria-hidden />
      <div className="login-page__grid" aria-hidden />

      <div className="login-shell">
        <header className="login-brand">
          <div className="login-brand__mark" aria-hidden>
            N
          </div>
          <h1 className="login-brand__name">Nirmaldhara</h1>
          <p className="login-brand__tag">Micro Foundation · Operations console</p>
        </header>

        <form className="login-form" onSubmit={handleLogin} noValidate>
          <h2 className="login-form__title">Sign in</h2>
          <p className="login-form__lead">
            Admin, managers &amp; employees
          </p>

          <div className="form-group">
            <label htmlFor="login-mobile">Mobile number</label>
            <input
              id="login-mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              inputMode="numeric"
              autoComplete="username"
              placeholder="10-digit mobile"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={loading}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p className="error-msg" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-foot">
          Admin sees all locations · others see their location only
        </p>
      </div>
    </div>
  );
}
