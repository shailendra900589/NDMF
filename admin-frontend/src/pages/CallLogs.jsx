import { useEffect, useState } from 'react';
import { callLogsApi } from '../api/api';
import RecordingPlayer from '../components/RecordingPlayer';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';

function statusBadge(status, verified) {
  const label =
    status === 'connected'
      ? 'Connected'
      : status === 'missed'
        ? 'Missed'
        : status === 'not_answered'
          ? 'Not answered'
          : status || 'Unknown';
  const cls =
    status === 'connected' ? 'status-pill status-pill--ok' : status === 'missed' ? 'status-pill status-pill--miss' : 'status-pill status-pill--muted';
  return (
    <span className={cls}>
      {label}
      {verified ? ' ✓' : ''}
    </span>
  );
}

export default function CallLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    callLogsApi
      .getAll()
      .then((res) => setLogs(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, []);

  if (loading && !logs.length) return <PageLoader label="Loading call logs..." />;

  return (
    <div>
      <PageHeader
        title="Call history & recordings"
        description="Mobile dialer sync: verified talk time, summaries, and streamable audio. Auto-refresh every 45s."
      />
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Mobile</th>
              <th>Date</th>
              <th>Talk time</th>
              <th>Status</th>
              <th>Summary</th>
              <th>Employee</th>
              <th>Listen</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.customerName}</td>
                <td>{l.mobile}</td>
                <td>
                  {new Date(l.date).toLocaleDateString('en-IN')}
                  <br />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{l.time}</span>
                </td>
                <td>
                  {l.duration || '-'}
                  {l.durationSeconds != null && (
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{l.durationSeconds}s verified</div>
                  )}
                </td>
                <td>{statusBadge(l.callStatus, l.telephonyVerified)}</td>
                <td style={{ maxWidth: 280, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                  {l.callSummary || '—'}
                </td>
                <td>{l.employeeName || l.employeeId || '-'}</td>
                <td style={{ minWidth: 220 }}>
                  <RecordingPlayer url={l.recordingUrl} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!logs.length && <div className="empty-state"><p>No call logs yet</p></div>}
      </div>
    </div>
  );
}
