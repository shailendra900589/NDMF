import { useEffect, useMemo, useState } from 'react';
import { attendanceApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import { displayLocation, displayRole, displayRoleShort } from '../utils/displayLabels';
import { downloadExcel } from '../utils/exportExcel';

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
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

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

  const filteredEmployees = useMemo(() => {
    let list = report?.employees || [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          (e.name || '').toLowerCase().includes(q) ||
          (e.employeeId || '').toLowerCase().includes(q) ||
          (e.mobile || '').includes(q)
      );
    }
    if (filterEmployee !== 'all') {
      list = list.filter((e) => e.id === filterEmployee);
    }
    if (filterStatus === 'present_today') {
      const day = new Date(report?.today || Date.now()).getDate();
      const prefix = `${report?.year}-${String(report?.month).padStart(2, '0')}`;
      if (report?.today?.startsWith(prefix)) {
        list = list.filter((e) => {
          const d = e.days[day];
          return d && (d.status === 'present' || d.status === 'partial');
        });
      }
    } else if (filterStatus === 'has_absent') {
      list = list.filter((e) =>
        Object.values(e.days || {}).some((d) => d.status === 'absent')
      );
    } else if (filterStatus === 'full_present') {
      list = list.filter(
        (e) => e.workingDaysSoFar > 0 && e.presentDays === e.workingDaysSoFar
      );
    }
    return list;
  }, [report, search, filterEmployee, filterStatus]);

  useEffect(() => {
    if (!filteredEmployees.length) {
      setSelectedId(null);
      return;
    }
    if (!filteredEmployees.some((e) => e.id === selectedId)) {
      setSelectedId(filteredEmployees[0].id);
    }
  }, [filteredEmployees, selectedId]);

  const selected = useMemo(
    () => filteredEmployees.find((e) => e.id === selectedId) || null,
    [filteredEmployees, selectedId]
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
    if (!filteredEmployees.length) return 0;
    const sum = filteredEmployees.reduce((acc, e) => acc + (e.presentDays || 0), 0);
    return Math.round(sum / filteredEmployees.length);
  }, [filteredEmployees]);

  const presentTodayFiltered = useMemo(() => {
    if (!report?.today?.startsWith(`${report.year}-${String(report.month).padStart(2, '0')}`)) {
      return 0;
    }
    const day = new Date(report.today).getDate();
    return filteredEmployees.filter((e) => {
      const d = e.days[day];
      return d && (d.status === 'present' || d.status === 'partial');
    }).length;
  }, [filteredEmployees, report]);

  const downloadReport = () => {
    if (!report) return;
    const headers = [
      'Employee',
      'Employee ID',
      'Mobile',
      'Role',
      'Location',
      'Date',
      'Status',
      'Check In',
      'Check Out',
      'Distance (m)',
      'Present Days',
    ];
    const rows = [];
    filteredEmployees.forEach((emp) => {
      dayColumns.forEach((d) => {
        const cell = emp.days[d];
        if (!cell) return;
        if (filterStatus === 'has_absent' && cell.status !== 'absent') return;
        rows.push([
          emp.name,
          emp.employeeId,
          emp.mobile,
          displayRole(emp.role),
          displayLocation(emp.branch),
          cell.date,
          statusLabel(cell.status),
          cell.checkInTime ? new Date(cell.checkInTime).toLocaleString('en-IN') : '',
          cell.checkOutTime ? new Date(cell.checkOutTime).toLocaleString('en-IN') : '',
          cell.distanceFromBranch ?? '',
          emp.presentDays,
        ]);
      });
    });
    const stamp = `${report.year}-${String(report.month).padStart(2, '0')}`;
    downloadExcel(`attendance-report-${stamp}.xls`, { headers, rows });
  };

  if (loading && !report) return <PageLoader label="Loading monthly attendance..." />;

  const scopeText =
    report?.scope === 'all_branches'
      ? 'All locations'
      : displayLocation(report?.branch || me.branch);

  return (
    <div className="att-page">
      <PageHeader
        title="Attendance"
        description="Monthly calendar and team report — present dates, employee list, and day-wise status."
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
          {scopeText}
          {report?.today ? ` · Today ${new Date(report.today).toLocaleDateString('en-IN')}` : ''}
        </div>
      </div>

      <div className="att-filters card">
        <div className="att-filters__grid">
          <div className="form-group">
            <label htmlFor="att-search">Search</label>
            <input
              id="att-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, ID or mobile"
            />
          </div>
          <div className="form-group">
            <label htmlFor="att-emp">Employee</label>
            <select
              id="att-emp"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="all">All employees</option>
              {(report?.employees || []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeId})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="att-status">Status filter</label>
            <select
              id="att-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="present_today">Present today</option>
              <option value="has_absent">Has absent days</option>
              <option value="full_present">Full present (so far)</option>
            </select>
          </div>
          <div className="att-filters__actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearch('');
                setFilterEmployee('all');
                setFilterStatus('all');
              }}
            >
              Clear filters
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={downloadReport}>
              Download Excel
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="stats-grid stats-grid--dashboard">
        <article className="stat-card stat-card--teal">
          <div className="stat-card__value">{filteredEmployees.length}</div>
          <div className="stat-card__label">Employees</div>
        </article>
        <article className="stat-card stat-card--amber">
          <div className="stat-card__value">{presentTodayFiltered}</div>
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
            <h3>Team</h3>
            <span>{filteredEmployees.length}</span>
          </div>
          <ul className="att-roster__list">
            {filteredEmployees.map((emp) => {
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
                        {displayRoleShort(emp.role)} · {emp.employeeId}
                        {emp.branch ? ` · ${displayLocation(emp.branch)}` : ''}
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
          {!filteredEmployees.length && (
            <div className="empty-state">
              <p>No employees match filters</p>
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
                    {selected.employeeId} · {selected.mobile} · {displayRole(selected.role)} · Present{' '}
                    {selected.presentDays} day{selected.presentDays === 1 ? '' : 's'}
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
              <div>
                <h3>Monthly report matrix</h3>
                <p>
                  Filtered team × every date of {report?.monthLabel} · {filteredEmployees.length}{' '}
                  employee{filteredEmployees.length === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={downloadReport}>
                Download Excel
              </button>
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
                  {filteredEmployees.map((emp) => (
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
            {!filteredEmployees.length && (
              <div className="empty-state">
                <p>No attendance data for current filters</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
