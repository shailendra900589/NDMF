/**
 * App shell — sidebar, topbar, outlet
 */
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { authApi } from '../api/api';
import { filterNavByPermissions } from '../utils/permissions';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, permission: 'dashboard', icon: 'dashboard' },
  { to: '/customer-listings', label: 'Customer Listing', permission: 'customerListings', icon: 'listing' },
  { to: '/customers', label: 'Customers', permission: 'customers', icon: 'customers' },
  { to: '/attendance', label: 'Attendance', permission: 'attendance', icon: 'attendance' },
  { to: '/tracking', label: 'Tracking', permission: 'tracking', icon: 'tracking' },
  { to: '/call-logs', label: 'Call Logs', permission: 'callLogs', icon: 'calls' },
  { to: '/users', label: 'Users & Permissions', permission: 'users', icon: 'users' },
  { to: '/branches', label: 'Branches', permission: 'branches', adminOnly: true, icon: 'branches' },
];

function NavIcon({ name }) {
  const props = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75 };
  switch (name) {
    case 'dashboard':
      return (
        <svg {...props}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
      );
    case 'listing':
      return <svg {...props}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
    case 'customers':
      return <svg {...props}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>;
    case 'attendance':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
    case 'tracking':
      return <svg {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>;
    case 'calls':
      return <svg {...props}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>;
    case 'users':
      return <svg {...props}><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></svg>;
    case 'branches':
      return <svg {...props}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>;
    case 'profile':
      return <svg {...props}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    default:
      return null;
  }
}

function roleLabel(role) {
  if (role === 'branchManager') return 'Branch Manager';
  if (role === 'fieldOfficer') return 'Employee';
  if (role === 'admin') return 'Administrator';
  return role;
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  const isAdmin = user.role === 'admin';

  let navItems = filterNavByPermissions(NAV_ITEMS, user);
  navItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('ndfa_token');
    localStorage.removeItem('ndfa_user');
    navigate('/login');
  };

  const scopeLabel = isAdmin ? 'All branches' : user.branch || '—';
  const initials = (user.name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const onProfile = location.pathname === '/profile';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo-mark">N</div>
          <div>
            <div className="sidebar__title">Nirmaldhara</div>
            <div className="sidebar__subtitle">Micro Foundation</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          <span className="sidebar__section">Main menu</span>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
            >
              <span className="nav-link__icon"><NavIcon name={item.icon} /></span>
              <span className="nav-link__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <Link to="/profile" className={`nav-link nav-link--footer${onProfile ? ' nav-link--active' : ''}`}>
            <span className="nav-link__icon"><NavIcon name="profile" /></span>
            <span className="nav-link__label">My Profile</span>
          </Link>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__left">
            <span className="topbar__eyebrow">Operations console</span>
          </div>
          <div className="topbar__right">
            <div className="user-chip">
              <div className="user-chip__avatar">{initials}</div>
              <div className="user-chip__meta">
                <strong>{user.name || 'User'}</strong>
                <span>{roleLabel(user.role)} · {scopeLabel}</span>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
