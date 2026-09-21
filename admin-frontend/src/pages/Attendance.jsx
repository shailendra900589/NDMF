import { useEffect, useMemo, useState } from 'react';
import { attendanceApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';

function roleShort(role) {
  if (role === 'branchManager') return 'BM';
  if (role === 'fieldOfficer') return 'Emp';
  return role || '—';
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status) {
  switch (status) {
    case 'present':
      return 'Present';
    case 'partial':
      return 'Checked in';
    case 'absent':
      return 'Absent';
    case 'holiday':
      return 'Sunday';
    case 'today':
      return 'Today';
    default:
      return '—';
  }
}

export default function Attendance() {
  const me = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = (y, m) => {
    setLoading(true);
    setError('');
    attendanceApi
      .getMonthly({ year: y, month: m })
      .then((res) => {
        setReport(res.data);
        setSelectedId((prev) => {
          const ids = (res.data?.employees || []).map((e) => e.id);
          if (prev && ids.includes(prev)) return prev;
          return ids[0] || null;
        });
      })
      .catch((err) => setError(err.message || 'Failed to load attendance'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(year, month);
  }, [year, month]);

  const shiftMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  };

  const selected = useMemo(
    () => (report?.employees || []).find((e) => e.id === selectedId) || null,
    [report, selectedId]
  );

  const dayColumns = useMemo(() => {
    if (!report) return [];
    return Array.from({ length: report.daysInMonth }, (_, i) => i + 1);
  }, [report]);

  const calendarCells = useMemo(() => {
    if (!selected || !report) return [];
    const firstDow = new Date(report.year, report.month - 1, 1).getDay();
    const cells = [];
    for (let i = 0; i < firstDow; i += 1) cells.push(null);
    for (let d = 1; d <= report.daysInMonth; d += 1) {
      cells.push({ day: d, ...selected.days[d] });
    }
    return cells;
  }, [selected, report]);

  const avgPresent = useMemo(() => {
    const list = report?.employees || [];
    if (!list.length) return 0;
    const sum = list.reduce((acc, e) => acc + (e.presentDays || 0), 0);
    return Math.round(sum / list.length);
  }, [report]);

  if (loading && !report) return <PageLoader label="Loading monthly attendance..." />;

  return (
    <div className="att-page">
      <PageHeader
        title="Attendance"
        description="Monthly calendar & branch team report — present dates, employee list, and day-wise status."
      />

      <div className="att-toolbar">
        <div className="att-month-nav">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => shiftMonth(-1)}>
            ← Prev
          </button>
          <div className="att-month-nav__label">{report?.monthLabel || '—'}</div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => shiftMonth(1)}>
            Next →
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const n = new Date();
            setYear(n.getFullYear());
            setMonth(n.getMonth() + 1);
          }}
        >
          This month
        </button>
        <div className="att-toolbar__meta">
          {report?.scope === 'all_branches' ? 'All branches' : report?.branch || me.branch || 'Branch'}
          {report?.today ? ` · Today ${new Date(report.today).toLocaleDateString('en-IN')}` : ''}
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="stats-grid stats-grid--dashboard">
        <article className="stat-card stat-card--teal">
          <div className="stat-card__value">{report?.employeeCount ?? 0}</div>
          <div className="stat-card__label">Employees</div>
        </article>
        <article className="stat-card stat-card--amber">
          <div className="stat-card__value">{report?.presentToday ?? 0}</div>
          <div className="stat-card__label">Present today</div>
        </article>
        <article className="stat-card stat-card--blue">
          <div className="stat-card__value">{avgPresent}</div>
          <div className="stat-card__label">Avg present days</div>
        </article>
        <article className="stat-card stat-card--slate">
          <div className="stat-card__value">{report?.daysInMonth ?? 0}</div>
          <div className="stat-card__label">Days in month</div>
        </article>
      </div>

      <div className="att-layout">
        <aside className="att-roster card">
          <div className="att-roster__head">
            <h3>Branch team</h3>
            <span>{report?.employees?.length || 0}</span>
          </div>
          <ul className="att-roster__list">
            {(report?.employees || []).map((emp) => {
              const pct =
                emp.workingDaysSoFar > 0
                  ? Math.round((emp.presentDays / emp.workingDaysSoFar) * 100)
                  : 0;
              return (
                <li key={emp.id}>
                  <button
                    type="button"
                    className={`att-roster__item${selectedId === emp.id ? ' is-active' : ''}`}
                    onClick={() => setSelectedId(emp.id)}
                  >
                    <span className="att-roster__avatar">
                      {(emp.name || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="att-roster__meta">
                      <strong>{emp.name}</strong>
                      <small>
                        {roleShort(emp.role)} · {emp.employeeId}
                        {emp.branch ? ` · ${emp.branch}` : ''}
                      </small>
                    </span>
                    <span className="att-roster__stat">
                      <em>{emp.presentDays}</em>
                      <small>{pct}%</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!report?.employees?.length && (
            <div className="empty-state">
              <p>No employees in this branch</p>
            </div>
          )}
        </aside>

        <div className="att-main">
          {selected && (
            <section className="card att-calendar-card">
              <div className="att-calendar-card__head">
                <div>
                  <h3>{selected.name}</h3>
                  <p>
                    {selected.employeeId} · {selected.mobile} · Present {selected.presentDays} day
                    {selected.presentDays === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="att-legend">
                  <span className="att-dot att-dot--present" /> Present
                  <span className="att-dot att-dot--partial" /> In only
                  <span className="att-dot att-dot--absent" /> Absent
                  <span className="att-dot att-dot--holiday" /> Sunday
                </div>
              </div>

              <div className="att-cal-weekdays">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              <div className="att-cal-grid">
                {calendarCells.map((cell, idx) => {
                  if (!cell) return <div key={`e-${idx}`} className="att-cal-cell att-cal-cell--empty" />;
                  const isToday = cell.date === report.today;
                  return (
                    <div
                      key={cell.date}
                      className={`att-cal-cell att-cal-cell--${cell.status}${isToday ? ' is-today' : ''}`}
                      title={`${cell.date}: ${statusLabel(cell.status)}`}
                    >
                      <span className="att-cal-cell__day">{cell.day}</span>
                      <span className="att-cal-cell__mark">
                        {cell.status === 'present' && 'P'}
                        {cell.status === 'partial' && 'I'}
                        {cell.status === 'absent' && 'A'}
                        {cell.status === 'holiday' && 'S'}
                      </span>
                      {(cell.checkInTime || cell.checkOutTime) && (
                        <span className="att-cal-cell__times">
                          {fmtTime(cell.checkInTime)}
                          {cell.checkOutTime ? `–${fmtTime(cell.checkOutTime)}` : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="card att-matrix-card">
            <div className="att-matrix-card__head">
              <h3>Monthly report matrix</h3>
              <p>All employees × every date of {report?.monthLabel}</p>
            </div>
            <div className="table-wrap att-matrix-wrap">
              <table className="att-matrix">
                <thead>
                  <tr>
                    <th className="att-matrix__sticky">Employee</th>
                    {dayColumns.map((d) => (
                      <th
                        key={d}
                        className={
                          report?.today ===
                          `${report.year}-${String(report.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                            ? 'is-today-col'
                            : ''
                        }
                      >
                        {d}
                      </th>
                    ))}
                    <th>Present</th>
                  </tr>
                </thead>
                <tbody>
                  {(report?.employees || []).map((emp) => (
                    <tr
                      key={emp.id}
                      className={selectedId === emp.id ? 'is-selected-row' : ''}
                      onClick={() => setSelectedId(emp.id)}
                    >
                      <td className="att-matrix__sticky">
                        <strong>{emp.name}</strong>
                        <small>{emp.employeeId}</small>
                      </td>
                      {dayColumns.map((d) => {
                        const cell = emp.days[d];
                        return (
                          <td key={d} className={`att-matrix__cell att-matrix__cell--${cell?.status || 'none'}`}>
                            {cell?.status === 'present' && 'P'}
                            {cell?.status === 'partial' && 'I'}
                            {cell?.status === 'absent' && 'A'}
                            {cell?.status === 'holiday' && '·'}
                          </td>
                        );
                      })}
                      <td>
                        <strong>{emp.presentDays}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!report?.employees?.length && (
              <div className="empty-state">
                <p>No attendance data for this month</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
