import { useEffect, useState } from 'react';
import { dashboardApi, trackingApi } from '../api/api';
import RecordingPlayer from '../components/RecordingPlayer';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import LiveTeamMap from '../components/LiveTeamMap';
import { displayLocation } from '../utils/displayLabels';

const STAT_META = {
  'Team members': { tone: 'teal', abbr: 'TM' },
  'Pending listings': { tone: 'amber', abbr: 'PL' },
  'Total customers': { tone: 'blue', abbr: 'CU' },
  'Calls today': { tone: 'violet', abbr: 'CL' },
  'Recorded calls': { tone: 'rose', abbr: 'RC' },
  'Distance (KM)': { tone: 'slate', abbr: 'KM' },
};

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  const [stats, setStats] = useState(null);
  const [liveTeam, setLiveTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([dashboardApi.getStats(), trackingApi.getLive()])
      .then(([dash, live]) => {
        setStats(dash.data);
        setLiveTeam(live.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    const t = setInterval(() => {
      trackingApi.getLive().then((res) => setLiveTeam(res.data || [])).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <PageLoader label="Loading dashboard..." />;

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
      />

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
              <span className="stat-card__icon" aria-hidden>{meta.abbr}</span>
              <div className="stat-card__value">{m.value}</div>
              <div className="stat-card__label">{m.label}</div>
            </article>
          );
        })}
      </div>

      <section className="card card--section card--compact">
        <div className="card__header">
          <h2 className="card__title">Live field map</h2>
          <span className="card__subtitle">Refreshes every 30s · from mobile GPS duty</span>
        </div>
        <LiveTeamMap team={liveTeam} />
      </section>

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
