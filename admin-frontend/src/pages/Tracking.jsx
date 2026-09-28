import { useEffect, useState } from 'react';
import { trackingApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';

export default function Tracking() {
  const [history, setHistory] = useState([]);
  const [live, setLive] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([trackingApi.getHistory(), trackingApi.getLive()])
      .then(([h, l]) => {
        setHistory(h.data || []);
        setLive(l.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    const t = setInterval(() => {
      trackingApi.getLive().then((res) => setLive(res.data || [])).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <PageLoader label="Loading tracking..." />;

  return (
    <div>
      <PageHeader title="Field tracking" description="Live field positions (refreshes every 30s) and daily distance — raw GPS trail not stored." />
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px' }}>Live on map (today)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th><th>Branch</th><th>Lat</th><th>Lng</th><th>KM today</th><th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {live.map((e) => (
                <tr key={e.userId}>
                  <td>{e.name} ({e.employeeId})</td>
                  <td>{e.branch}</td>
                  <td>{e.lat?.toFixed?.(5) ?? e.lat}</td>
                  <td>{e.lng?.toFixed?.(5) ?? e.lng}</td>
                  <td><strong>{e.totalKmToday?.toFixed?.(2) ?? e.totalKmToday} KM</strong></td>
                  <td>{e.lastSeenAt ? new Date(e.lastSeenAt).toLocaleTimeString('en-IN') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!live.length && <div className="empty-state"><p>No live GPS — employees must check in on mobile</p></div>}
      </div>
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>Date</th><th>Total KM</th><th>Route Points</th><th>Start</th><th>End</th>
            </tr>
          </thead>
          <tbody>
            {history.map((t) => (
              <tr key={t.id}>
                <td>{t.employeeId}</td>
                <td>{new Date(t.date).toLocaleDateString('en-IN')}</td>
                <td><strong>{t.totalKm?.toFixed?.(2) ?? t.totalKm} KM</strong></td>
                <td>{t.routePoints?.length ?? 0}</td>
                <td>{t.startTime ? new Date(t.startTime).toLocaleTimeString('en-IN') : '-'}</td>
                <td>{t.endTime ? new Date(t.endTime).toLocaleTimeString('en-IN') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!history.length && <div className="empty-state"><p>No tracking data yet</p></div>}
      </div>
    </div>
  );
}
