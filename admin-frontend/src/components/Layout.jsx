/**
 * App shell — sidebar, topbar, outlet
 */
import ThemeToggle from './ThemeToggle';
import { Component, useEffect, useState } from 'react';
import { useSession } from '../auth/Session';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { authApi } from '../api/api';
import { filterNavByPermissions } from '../utils/permissions';
import { displayLocation, displayRole, displayPersonName } from '../utils/displayLabels';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, permission: 'dashboard', icon: 'dashboard' },
  { to: '/customer-listings', label: 'Customer Listing', permission: 'customerListings', icon: 'listing' },
  { to: '/customers', label: 'Customers', permission: 'customers', icon: 'customers' },
  { to: '/attendance', label: 'Attendance', permission: 'attendance', icon: 'attendance' },
  { to: '/tracking', label: 'Tracking', permission: 'tracking', icon: 'tracking' },
  { to: '/call-logs', label: 'Call Logs', permission: 'callLogs', icon: 'calls' },
  { to: '/users', label: 'Users & Permissions', permission: 'users', icon: 'users' },
  { to: '/branches', label: 'Locations', permission: 'branches', adminOnly: true, icon: 'branches' },
  { to: '/payslips', label: 'Pay Slips', permission: 'payslips', adminOnly: true, icon: 'payslips' },
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
    case 'payslips':
      return <svg {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></svg>;
    case 'profile':
      return <svg {...props}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case 'logout':
      return <svg {...props}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
    default:
      return null;
  }
}

function roleLabel(role) {
  return displayRole(role);
}

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ padding: 28, maxWidth: 560 }}>
          <h2 style={{ marginTop: 0 }}>This page could not open</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            The menu is still available. Open another page, or try this one again.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  const { user } = useSession();
  const isSuperAdmin = user.role === 'superAdmin';
  const isAdmin = user.role === 'admin';

  let navItems = isSuperAdmin ? [{ to:'/super-admin', label:'Companies & Access', icon:'branches', end:true }, { to:'/super-admin/api', label:'Developer API access', icon:'branches' }] : filterNavByPermissions(NAV_ITEMS, user);
  navItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('ndfa_token');
    localStorage.removeItem('ndfa_user');
    navigate('/login');
  };

  const scopeLabel = isSuperAdmin ? 'All companies' : isAdmin ? (user.company?.name || 'All locations') : displayLocation(user.branch);
  const initials = (user.name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const onProfile = location.pathname === '/profile';
  const groups = isSuperAdmin ? [['Platform', navItems]] : [
    ['Overview', navItems.filter(i => i.to === '/')],
    ['Customers & applications', navItems.filter(i => ['/customer-listings', '/customers'].includes(i.to))],
    ['Team operations', navItems.filter(i => ['/attendance', '/tracking', '/call-logs'].includes(i.to))],
    ['Administration', navItems.filter(i => ['/users', '/branches', '/payslips'].includes(i.to))],
  ];
  const currentPage = onProfile ? 'My Profile' : location.pathname.startsWith('/tracking/employee') ? 'Employee route history' : navItems.find(i => i.to === location.pathname)?.label || 'Workspace';

  return (
    <div className={`layout${menuOpen ? ' layout--menu-open' : ''}`}>
      {menuOpen && <button className="mobile-menu-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className="sidebar" id="operations-navigation">
        <div className="sidebar__brand">
          <img className="sidebar__brand-icon" src="/smartstaff-plus-icon.svg" width="40" height="40" alt="" />
          <div>
            <div className="sidebar__title">Smartstaff <span>plus</span></div>
            <div className="sidebar__subtitle">{isSuperAdmin ? 'Platform administration' : user.company?.name || 'Operations workspace'}</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          {groups.filter(([, items]) => items.length).map(([title, items]) => <div className="sidebar__group" key={title}>
          <span className="sidebar__section">{title}</span>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
            >
              <span className="nav-link__icon"><NavIcon name={item.icon} /></span>
              <span className="nav-link__label">{item.label}</span>
            </NavLink>
          ))}
          </div>)}
        </nav>

        <div className="sidebar__footer">
          <Link to="/profile" className={`nav-link nav-link--footer${onProfile ? ' nav-link--active' : ''}`}>
            <span className="nav-link__icon"><NavIcon name="profile" /></span>
            <span className="nav-link__label">My Profile</span>
          </Link>
          <button type="button" className="sidebar-logout-btn" onClick={logout}>
            <span className="nav-link__icon"><NavIcon name="logout" /></span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="btn btn-outline mobile-nav-toggle" aria-controls="operations-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? 'Close' : 'Menu'}</button>
          <div className="topbar__left">
            <span className="topbar__eyebrow">{isSuperAdmin ? 'Platform administration' : 'Operations console'}</span>
            <span className="topbar__page">{currentPage}</span>
          </div>
          <div className="topbar__right">
            <ThemeToggle />
            <div className="user-chip">
              <div className="user-chip__avatar">{initials}</div>
              <div className="user-chip__meta">
                <strong>{displayPersonName(user.name) || 'User'}</strong>
                <span>{roleLabel(user.role)} · {scopeLabel}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="content">
          <PageErrorBoundary resetKey={location.pathname}>
            <Outlet key={JSON.stringify([user.id, user.role, user.companyId, user.permissions, user.actions])} />
          </PageErrorBoundary>
        </main>
      </div>
    </div>
  );
}
