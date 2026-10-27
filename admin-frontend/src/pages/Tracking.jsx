import SearchableSelect from '../components/SearchableSelect';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
const EmployeeTracking = lazy(() => import('./EmployeeTracking'));
import { trackingApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import LiveTeamMap from '../components/LiveTeamMap';
import useLiveTeam, { STATUS_LABELS, timeAgo, useNow } from '../hooks/useLiveTeam';
import { displayLocation } from '../utils/displayLabels';


export default function Tracking() {
  const live = useLiveTeam(15000);
  const now = useNow();
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('userId') || '';
  const [people, setPeople] = useState([]);
  const [peopleError, setPeopleError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setPeopleError('');
    trackingApi.getPeople().then(res => { if (active) setPeople(res.data?.people || []); })
      .catch(e => active && setPeopleError(e.message || 'Unable to load employees'));
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryError('');
    trackingApi
      .getHistory()
      .then((res) => active && setHistory(res.data || []))
      .catch(e => active && setHistoryError(e.message || 'Unable to load tracking history'))
      .finally(() => active && setHistoryLoading(false));
    return () => { active = false; };
  }, [attempt]);

  const select = userId => setParams(userId ? { userId } : {}, { replace: true });

  if (live.loading && historyLoading) return <PageLoader label="Loading tracking..." />;


  return (
    <div>
      <PageHeader
        title="Field tracking"
        description="Monitor the team or select an employee to review their profile, duty history and complete daily route."
      >
        <button type="button" className="btn btn-outline" onClick={() => { setAttempt(n => n + 1); live.refresh(); }}>Refresh team</button>
        <Link to="/tracking/employee" className="btn btn-primary">Employee route history</Link>
      </PageHeader>

      <section className="workspace-toolbar card">
        <div><label htmlFor="tracking-employee">Employee workspace</label>
          <SearchableSelect id="tracking-employee" value={selectedId} onChange={e => select(e.target.value)}>
            <option value="">All employees · live overview</option>
            {people.map(p => <option key={p.userId} value={p.userId}>{p.name} · {p.employeeId} · {displayLocation(p.branch)}</option>)}
          </SearchableSelect>
          <small>Includes employees who are currently off duty. History is available for the configured retention period.</small>
        </div>
        <div className="workspace-status"><strong>{live.team.filter(e => e.onDuty).length}</strong><span>On duty</span></div>
        <div className="workspace-status"><strong>{people.length}</strong><span>Employees</span></div>
      </section>
      {peopleError && <p className="error-msg" role="alert">{peopleError}</p>}
      {selectedId ? <Suspense fallback={<PageLoader label="Loading employee workspace…" />}><EmployeeTracking key={`${selectedId}-${attempt}`} embedded /></Suspense> : <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__header">
          <h2 className="card__title">Live map</h2>
          <span className="card__subtitle">
            {live.team.filter((e) => e.status === 'live').length} live ·{' '}
            {live.team.filter((e) => e.onDuty).length} on duty ·{' '}
            last refresh {live.updatedAt ? timeAgo(live.updatedAt.toISOString(), now) : '—'}
          </span>
        </div>
        {live.error ? (
          <div className="empty-state"><p>{live.error}</p></div>
        ) : (
          <LiveTeamMap team={live.team} selectedId={selectedId} onSelect={select} height={480} />
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
                  <td title={e.statusReason}><span className={`live-dot live-dot--${e.status}`} style={{ display: 'inline-block', marginRight: 6 }} />{STATUS_LABELS[e.status]}<small style={{display:'block',maxWidth:250,color:'var(--color-text-muted)',fontSize:11,marginTop:5}}>{e.statusReason}</small></td>
                  <td>GPS: {timeAgo(e.lastSeenAt, now)}<small style={{display:'block',fontSize:11,marginTop:5}}>App: {e.appLastSeenAt?timeAgo(e.appLastSeenAt,now):'No heartbeat yet'} · {e.appVersion || 'Update app'}</small>{e.backgroundAllowed===false&&<small style={{display:'block',fontSize:11,color:'#b45309'}}>Allow background location on phone</small>}</td>
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
        {historyError && <p className="error-msg" role="alert">{historyError}</p>}
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
      </>}
    </div>
  );
}
