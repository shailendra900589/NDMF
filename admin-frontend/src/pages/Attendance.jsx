import { useEffect, useState } from 'react';
import { attendanceApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';

export default function Attendance() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi.getHistory()
      .then((res) => setHistory(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader label="Loading attendance..." />;

  return (
    <div>
      <PageHeader title="Attendance" description="GPS check-in and check-out for your branch team." />
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>Date</th><th>Check In</th><th>Check Out</th><th>Distance from Branch</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((a) => (
              <tr key={a.id}>
                <td>{a.employeeId}</td>
                <td>{new Date(a.date).toLocaleDateString('en-IN')}</td>
                <td>{a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString('en-IN') : '-'}</td>
                <td>{a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString('en-IN') : '-'}</td>
                <td>{a.distanceFromBranch ? `${a.distanceFromBranch}m` : '-'}</td>
                <td>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!history.length && <div className="empty-state"><p>No attendance records</p></div>}
      </div>
    </div>
  );
}
