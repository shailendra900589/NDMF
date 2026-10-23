import ThemeToggle from '../components/ThemeToggle';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/api';

export default function Login() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const id = loginId.trim();
    if (id.length < 3) {
      setError('Enter email, Employee ID or mobile');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(id, password);
      localStorage.setItem('ndfa_token', res.data.token);
      localStorage.setItem('ndfa_user', JSON.stringify(res.data));
      navigate(res.data.role === 'superAdmin' ? '/super-admin' : '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <div className="login-page__glow login-page__glow--a" aria-hidden />
      <div className="login-page__glow login-page__glow--b" aria-hidden />
      <div className="login-page__grid" aria-hidden />

      <div className="login-shell">
        <header className="login-brand">
          <div className="login-brand__mark" aria-hidden>
            S
          </div>
          <h1 className="login-brand__name">Smartstaff plus</h1>
          <p className="login-brand__tag">Workforce operations console</p>
        </header>

        <form className="login-form" onSubmit={handleLogin} noValidate>
          <h2 className="login-form__title">Sign in</h2>
          <p className="login-form__lead">
            Email, Employee ID or mobile — sign in with your password
          </p>

          <div className="form-group">
            <label htmlFor="login-id">Login ID</label>
            <input
              id="login-id"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.trimStart())}
              autoComplete="username"
              placeholder="Email, Employee ID or mobile"
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
          Secure access for platform administrators and company teams
        </p>
        <p className="login-foot">
          <a href="/">Back to Smartstaff plus home</a>
        </p>
      </div>
    </div>
  );
}
