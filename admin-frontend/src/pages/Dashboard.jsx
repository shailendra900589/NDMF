import MetricIcon from '../components/MetricIcon';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/api';
import RecordingPlayer from '../components/RecordingPlayer';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import LiveTeamMap from '../components/LiveTeamMap';
import useLiveTeam from '../hooks/useLiveTeam';
import { displayLocation } from '../utils/displayLabels';
import { canAccess } from '../utils/permissions';
import { useSession } from '../auth/Session';

const STAT_META = {
  'Team members': { tone: 'teal', abbr: 'TM' },
  'Pending listings': { tone: 'amber', abbr: 'PL' },
  'Total customers': { tone: 'blue', abbr: 'CU' },
  'Calls today': { tone: 'violet', abbr: 'CL' },
  'Recorded calls': { tone: 'rose', abbr: 'RC' },
  'Distance (KM)': { tone: 'slate', abbr: 'KM' },
};

export default function Dashboard() {
  const { user } = useSession();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const showMap = canAccess(user, 'tracking');
  const live = useLiveTeam(15000, showMap);

  const load = () => {
    setLoading(true);
    setError('');
    dashboardApi
      .getStats()
      .then((dash) => setStats(dash.data))
      .catch(e => setError(e.message || 'Unable to load dashboard'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <PageLoader label="Loading dashboard..." />;
  if (error) return <div className="card" role="alert" style={{ padding: 24 }}>
    <h2>Dashboard could not load</h2><p>{error}</p>
    <button type="button" className="btn btn-primary" onClick={load}>Retry</button>
  </div>;

  const isAllBranches = stats?.scope === 'all_branches';

  const metrics = [
    { key: 'team', label: 'Team members', value: stats?.teamMembers ?? 0 },
    { key: 'listings', label: 'Pending listings', value: stats?.pendingCustomerListing ?? 0 },
    { key: 'customers', label: 'Total customers', value: stats?.totalCustomers ?? 0 },
    { key: 'calls', label: 'Calls today', value: stats?.totalCallsToday ?? 0 },
    { key: 'rec', label: 'Recorded calls', value: stats?.totalCallsWithRecording ?? 0 },
    { key: 'km', label: 'Distance (KM)', value: stats?.distanceCoveredToday ?? 0 },
  ];

  const recordings = stats?.recentCallRecordings || [];

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        description="Live overview of listings, customers, field activity, and call recordings."
      >
        <button type="button" className="btn btn-outline" onClick={load}>Refresh overview</button>
      </PageHeader>
      <section className="dashboard-welcome">
        <div className="dashboard-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
        <div><span className="section-kicker">{user.company?.name || 'YOUR WORKSPACE'}</span><p className="dashboard-greeting">YOUR WORKDAY, CONNECTED</p><h2>Good to see you, {user.name?.split(' ')[0] || 'there'}.</h2><p>Review applications, team attendance and field activity from one workspace.</p></div>
        <div className="dashboard-shortcuts">{[
          ['customerListings', '/customer-listings', 'Review applications'],
          ['attendance', '/attendance', 'Team attendance'],
          ['tracking', '/tracking', 'Track an employee'],
          ['users', '/users', 'Manage team'],
        ].filter(([permission]) => canAccess(user, permission)).map(([permission, to, label]) => <Link className="workspace-shortcut" to={to} key={permission}>{label}<span aria-hidden>↗</span></Link>)}</div>
      </section>

      <div className={`scope-banner scope-banner--compact${isAllBranches ? ' scope-banner--admin' : ''}`}>
        <div className="scope-banner__icon">{isAllBranches ? 'ALL' : 'LOC'}</div>
        <div>
          <div className="scope-banner__title">
            {isAllBranches ? 'Organization-wide view' : 'Location-scoped view'}
          </div>
          <div className="scope-banner__text">
            {isAllBranches
              ? `${stats?.branchCount ?? 0} active locations · all employee & customer data`
              : `${displayLocation(stats?.branch || user.branch)} · only this location’s data is shown`}
          </div>
        </div>
        <div className="scope-banner__badge">
          Attendance: <strong>{stats?.attendanceStatus ?? '—'}</strong>
        </div>
      </div>

      <div className="stats-grid stats-grid--dashboard stats-grid--compact">
        {metrics.map((m) => {
          const meta = STAT_META[m.label] || { tone: 'teal', abbr: '—' };
          return (
            <article key={m.key} className={`stat-card stat-card--compact stat-card--${meta.tone}`}>
              <span className="stat-card__icon" aria-hidden><MetricIcon type={m.key} /></span><span className="stat-card__context">{m.key === 'team' || m.key === 'customers' ? 'Workspace total' : m.key === 'listings' ? 'Awaiting review' : 'Activity overview'}</span>
              <div className="stat-card__value">{m.value}</div>
              <div className="stat-card__label">{m.label}</div>
            </article>
          );
        })}
      </div>

      {showMap && (
        <section className="card card--section card--compact">
          <div className="card__header">
            <h2 className="card__title">Live field map</h2>
            <span className="card__subtitle">
              Updates every 15s while staff are checked in ·{' '}
              {live.team.filter((e) => e.status === 'live').length} live now ·{' '}
              <Link to="/tracking">Open full tracking</Link>
            </span>
          </div>
          {live.error ? <p className="muted">{live.error}</p> : <LiveTeamMap team={live.team} height={340} />}
        </section>
      )}

      <section className="card card--section card--compact">
        <div className="card__header">
          <h2 className="card__title">Recent call recordings</h2>
          <span className="card__subtitle">Stream online — synced from mobile dialer</span>
        </div>
        {!recordings.length && (
          <div className="empty-state">
            <p>No recordings yet</p>
            <span>Calls from the mobile app will appear here with summary and audio.</span>
          </div>
        )}
        {recordings.map((r) => (
          <div key={r.id} className="recording-row">
            <div className="recording-row__meta">
              <div>
                <strong>{r.customerName || r.mobile}</strong>
                <span className="recording-row__mobile">{r.mobile}</span>
              </div>
              <span className="recording-row__info">
                {r.employeeName || r.employeeId} · {r.duration} · {r.time}
                {r.branch ? ` · ${displayLocation(r.branch)}` : ''}
              </span>
              {r.callSummary && (
                <p className="recording-row__summary">{r.callSummary}</p>
              )}
            </div>
            <RecordingPlayer url={r.recordingUrl} />
          </div>
        ))}
      </section>
    </div>
  );
}
