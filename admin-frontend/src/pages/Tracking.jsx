import { useEffect, useState } from 'react';
import { trackingApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';

export default function Tracking() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackingApi.getHistory()
      .then((res) => setHistory(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader label="Loading tracking..." />;

  return (
    <div>
      <PageHeader title="Field tracking" description="Daily route distance and GPS points from the mobile app." />
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
