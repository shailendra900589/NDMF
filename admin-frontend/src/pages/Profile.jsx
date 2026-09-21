import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/api';
import PageHeader from '../components/PageHeader';

function roleLabel(role) {
  if (role === 'branchManager') return 'Branch Manager';
  if (role === 'fieldOfficer') return 'Employee';
  if (role === 'admin') return 'Administrator';
  return role || '—';
}

export default function Profile() {
  const stored = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  const [name, setName] = useState(stored.name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await authApi.updateProfile({ name: name.trim() });
      localStorage.setItem('ndfa_user', JSON.stringify(res.data));
      setMessage('Profile saved successfully.');
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters');
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');
    try {
      await authApi.changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setMessage('Password updated successfully.');
    } catch (err) {
      setError(err.message || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <PageHeader
        title="My Profile"
        description="Update your display name and password. Manage branch employees under Users & Permissions."
      />

      <div className="profile-hero card">
        <div className="profile-hero__avatar">
          {(name || 'U').slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-hero__info">
          <h2>{name || stored.name}</h2>
          <div className="chip-row">
            <span className="chip">{roleLabel(stored.role)}</span>
            <span className="chip chip--muted">{stored.mobile}</span>
            <span className="chip chip--muted">{stored.branch || 'All branches'}</span>
          </div>
        </div>
        {stored.role === 'branchManager' && (
          <Link to="/users" className="btn btn-outline btn-sm">Manage employees</Link>
        )}
      </div>

      {(message || error) && (
        <div className={`alert${error ? ' alert--error' : ' alert--success'}`}>
          {error || message}
        </div>
      )}

      <div className="profile-grid">
        <section className="card">
          <h3 className="card__title">Account details</h3>
          <p className="card__subtitle">This name appears in the top bar and audit logs.</p>
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label htmlFor="displayName">Display name</label>
              <input id="displayName" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Save profile
            </button>
          </form>
        </section>

        <section className="card">
          <h3 className="card__title">Security</h3>
          <p className="card__subtitle">Use a strong password for web and mobile login.</p>
          <form onSubmit={changePassword}>
            <div className="form-group">
              <label htmlFor="oldPass">Current password</label>
              <input id="oldPass" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="form-group">
              <label htmlFor="newPass">New password</label>
              <input id="newPass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Update password
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
