import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackingApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import LiveTeamMap from '../components/LiveTeamMap';
import useLiveTeam, { STATUS_LABELS, timeAgo, useNow } from '../hooks/useLiveTeam';
import { displayLocation } from '../utils/displayLabels';

const ROUTE_REFRESH_MS = 15000;

export default function Tracking() {
  const live = useLiveTeam(15000);
  const now = useNow();
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [route, setRoute] = useState(null);

  useEffect(() => {
    trackingApi
      .getHistory()
      .then((res) => setHistory(res.data || []))
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, []);

  const loadRoute = useCallback((userId) => {
    if (!userId) return;
    trackingApi
      .getRoute({ userId })
      .then((res) => setRoute(res.data || null))
      .catch(() => setRoute(null));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setRoute(null);
      return undefined;
    }
    loadRoute(selectedId);
    const t = setInterval(() => {
      if (!document.hidden) loadRoute(selectedId);
    }, ROUTE_REFRESH_MS);
    return () => clearInterval(t);
  }, [selectedId, loadRoute]);

  const select = (userId) => setSelectedId((cur) => (cur === userId ? null : userId));

  if (live.loading && historyLoading) return <PageLoader label="Loading tracking..." />;

  const selected = live.team.find((e) => e.userId === selectedId);

  return (
    <div>
      <PageHeader
        title="Field tracking"
        description="Live position of everyone on duty, updated every 15 seconds from the mobile app. Click a person to see today’s route."
      >
        <Link to="/tracking/employee" className="btn btn-primary">Employee route history</Link>
      </PageHeader>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__header">
          <h2 className="card__title">Live map</h2>
          <span className="card__subtitle">
            {live.team.filter((e) => e.status === 'live').length} live ·{' '}
            {live.team.filter((e) => e.onDuty).length} on duty ·{' '}
            last refresh {live.updatedAt ? timeAgo(live.updatedAt.toISOString(), now) : '—'}
            {selected && route ? ` · ${selected.name}: ${Number(route.totalKm || 0).toFixed(2)} km, ${route.points.length} route points` : ''}
          </span>
        </div>
        {live.error ? (
          <div className="empty-state"><p>{live.error}</p></div>
        ) : (
          <LiveTeamMap team={live.team} selectedId={selectedId} onSelect={select} route={route} height={480} />
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px' }}>On duty today</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th><th>Location</th><th>Status</th><th>Last update</th><th>GPS accuracy</th><th>Speed</th><th>KM today</th><th>Checked in</th><th />
              </tr>
            </thead>
            <tbody>
              {live.team.map((e) => (
                <tr key={e.userId} style={e.userId === selectedId ? { background: '#f0fdfa' } : undefined}>
                  <td>
                    {e.name} ({e.employeeId})
                    {e.mocked && <div style={{ color: '#b91c1c', fontSize: 12, fontWeight: 600 }}>Fake GPS app detected</div>}
                  </td>
                  <td>{displayLocation(e.branch)}</td>
                  <td><span className={`live-dot live-dot--${e.status}`} style={{ display: 'inline-block', marginRight: 6 }} />{STATUS_LABELS[e.status]}</td>
                  <td>{timeAgo(e.lastSeenAt, now)}</td>
                  <td>{e.accuracy != null ? `±${Math.round(e.accuracy)} m` : '—'}</td>
                  <td>{e.speedKmh != null ? `${e.speedKmh} km/h` : '—'}</td>
                  <td><strong>{Number(e.totalKmToday || 0).toFixed(2)} km</strong></td>
                  <td>{e.checkInTime ? new Date(e.checkInTime).toLocaleTimeString('en-IN') : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => select(e.userId)}>
                        {e.userId === selectedId ? 'Hide route' : 'Show route'}
                      </button>
                      <Link to={`/tracking/employee?userId=${encodeURIComponent(e.userId)}`} className="btn btn-outline btn-sm">
                        Details
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!live.team.length && !live.error && (
          <div className="empty-state"><p>No one is on duty right now — staff appear after they check in on mobile.</p></div>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 12px' }}>Daily distance history</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th><th>Date</th><th>Total KM</th><th>Route points</th><th>Start</th><th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t.id}>
                  <td>{t.employeeName || t.employeeId}</td>
                  <td>{new Date(t.date).toLocaleDateString('en-IN')}</td>
                  <td><strong>{Number(t.totalKm || 0).toFixed(2)} km</strong></td>
                  <td>{t.routePointCount ?? 0}</td>
                  <td>{t.startTime ? new Date(t.startTime).toLocaleTimeString('en-IN') : '-'}</td>
                  <td>{t.endTime ? new Date(t.endTime).toLocaleTimeString('en-IN') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!historyLoading && !history.length && <div className="empty-state"><p>No tracking data yet</p></div>}
      </div>
    </div>
  );
}
