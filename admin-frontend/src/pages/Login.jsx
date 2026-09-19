import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/api';
import {
  WEB_DEMO_ACCOUNTS,
  WEB_ROLES,
  DEMO_PASSWORD,
  DEMO_OTP,
  MOBILE_FIELD_OFFICERS,
  accountForMobile,
} from '../utils/demoLogins';

export default function Login() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('9000000001');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const applyDemo = (account) => {
    setMobile(account.mobile);
    setPassword(DEMO_PASSWORD);
    setRole(account.role);
    setError('');
  };

  const onMobileChange = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setMobile(digits);
    const match = accountForMobile(digits);
    if (match) setRole(match.role);
  };

  const onRoleChange = (newRole) => {
    setRole(newRole);
    const first = WEB_DEMO_ACCOUNTS.find((a) => a.role === newRole);
    if (first && newRole === 'admin') {
      setMobile('9000000001');
    } else if (newRole === 'branchManager' && role !== 'branchManager') {
      setMobile('9000000002');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (mobile.length < 10) {
      setError('Enter 10-digit mobile (Login ID)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(mobile, password, role);
      if (res.data?.role === 'fieldOfficer') {
        setError('Field Officer must use the Android mobile app.');
        return;
      }
      localStorage.setItem('ndfa_token', res.data.token);
      localStorage.setItem('ndfa_user', JSON.stringify(res.data));
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedKey = WEB_DEMO_ACCOUNTS.find((a) => a.mobile === mobile)?.key;

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>NDFA Admin Panel</h1>
        <p>Nirmaldhara Micro Foundation — Web login (Admin & Branch Manager)</p>

        <p className="login-section-label">Quick login — tap account</p>
        <div className="demo-login-cards">
          {WEB_DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`demo-login-card${selectedKey === a.key ? ' demo-login-card--active' : ''}`}
              onClick={() => applyDemo(a)}
            >
              <div className="demo-login-card__head">
                <strong>{a.title}</strong>
                <span className="demo-login-card__branch">{a.branch}</span>
              </div>
              <span className="demo-login-card__id">
                Login ID: <code>{a.mobile}</code>
              </span>
              <span className="demo-login-card__scope">{a.scope}</span>
            </button>
          ))}
        </div>

        <p className="login-section-label">Or enter manually</p>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Login as (web only)</label>
            <select value={role} onChange={(e) => onRoleChange(e.target.value)}>
              {WEB_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Mobile number (Login ID)</label>
            <input
              value={mobile}
              onChange={(e) => onMobileChange(e.target.value)}
              maxLength={10}
              inputMode="numeric"
              autoComplete="username"
              placeholder="10-digit mobile"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <span className="field-hint">Demo password for all users: {DEMO_PASSWORD}</span>
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login to dashboard'}
          </button>
        </form>

        <div className="login-mobile-note">
          <strong>Field Officer (Android app only)</strong>
          <ul>
            {MOBILE_FIELD_OFFICERS.map((fo) => (
              <li key={fo.mobile}>
                {fo.branch}: <code>{fo.mobile}</code> / {DEMO_PASSWORD} — OTP {DEMO_OTP}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
