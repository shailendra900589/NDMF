import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { trackingApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import RouteMap from '../components/RouteMap';
import useAddress from '../hooks/useAddress';
import { displayLocation } from '../utils/displayLabels';
import { downloadExcel } from '../utils/exportExcel';

const STOP_FILTERS = [2, 5, 10, 15, 30];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function fmtDuration(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

function fmtDay(key) {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function StopPlace({ lat, lng }) {
  const name = useAddress(lat, lng);
  return <span className="rt-place">{name || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`}</span>;
}

/** Last 90 days as bars; height = km. */
function ActivityStrip({ days, selected, onPick, retentionDays }) {
  const byDate = useMemo(() => Object.fromEntries(days.map((d) => [d.date, d])), [days]);
  const cols = useMemo(() => {
    const out = [];
    const end = new Date(`${todayKey()}T12:00:00Z`);
    for (let i = retentionDays - 1; i >= 0; i -= 1) {
      const d = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
      out.push(d);
    }
    return out;
  }, [retentionDays]);
  const maxKm = Math.max(1, ...days.map((d) => d.totalKm || 0));
  return (
    <div className="rt-strip">
      <div className="rt-strip__bars">
        {cols.map((d) => {
          const info = byDate[d];
          const h = info ? Math.max(6, Math.round(((info.totalKm || 0) / maxKm) * 64)) : 3;
          const label = info
            ? `${fmtDay(d)} · ${Number(info.totalKm || 0).toFixed(2)} km · ${info.stopCount} stop(s) · on duty ${fmtDuration(info.dutyMinutes)}`
            : `${fmtDay(d)} · no duty`;
          return (
            <button
              type="button"
              key={d}
              title={label}
              disabled={!info}
              className={`rt-strip__bar${info ? ' rt-strip__bar--duty' : ''}${d === selected ? ' rt-strip__bar--sel' : ''}`}
              style={{ height: h }}
              onClick={() => info && onPick(d)}
            />
          );
        })}
      </div>
      <div className="rt-strip__axis">
        <span>{fmtDay(cols[0])}</span>
        <span>{retentionDays} days</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export default function EmployeeTracking({ embedded = false }) {
  const [params, setParams] = useSearchParams();
  const userId = params.get('userId') || '';
  const date = params.get('date') || todayKey();
  const [minStop, setMinStop] = useState(5);
  const [people, setPeople] = useState([]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [days, setDays] = useState([]);
  const [daysLoading, setDaysLoading] = useState(false);
  const [daysError, setDaysError] = useState('');
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState(null);
  const [replay, setReplay] = useState(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  const update = (next) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  };

  useEffect(() => {
    trackingApi
      .getPeople()
      .then((res) => {
        const list = res.data?.people || [];
        setPeople(list);
        setRetentionDays(res.data?.retentionDays || 90);
        if (!userId && list.length) {
          const recent = [...list].sort((a, b) => String(b.lastDutyAt || '').localeCompare(String(a.lastDutyAt || '')))[0];
          update({ userId: recent.userId });
        }
      })
      .catch((err) => setError(err.message || 'Could not load employees'));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setDays([]);
    setDaysLoading(true);
    setDaysError('');
    trackingApi.getDays({ userId, minStop })
      .then(res => active && setDays(res.data?.days || []))
      .catch(e => active && setDaysError(e.message || 'Unable to load duty history'))
      .finally(() => active && setDaysLoading(false));
    return () => { active = false; };
  }, [userId, minStop]);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    setRoute(null);
    setFocus(null);
    setError('');
    const load = (quiet) => {
      if (!quiet) setLoading(true);
      trackingApi
        .getRoute({ userId, date, minStop })
        .then((res) => {
          if (!alive) return;
          setRoute(res.data);
          setError('');
        })
        .catch((err) => { if (alive) { setRoute(null); setError(err.message || 'Could not load route'); } })
        .finally(() => alive && setLoading(false));
    };
    load(false);
    setReplay(null);
    setPlaying(false);
    const live = date === todayKey() ? setInterval(() => !document.hidden && load(true), 15000) : null;
    return () => {
      alive = false;
      if (live) clearInterval(live);
    };
  }, [userId, date, minStop]);

  useEffect(() => {
    if (!playing || !route?.points?.length) return undefined;
    timer.current = setInterval(() => {
      setReplay((i) => {
        const next = (i ?? -1) + 1;
        if (next >= route.points.length) {
          setPlaying(false);
          return route.points.length - 1;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(timer.current);
  }, [playing, route]);

  const person = people.find((p) => p.userId === userId) || (route ? { name: route.name, employeeId: route.employeeId, branch: route.branch, workType: route.workType } : null);
  const isField = (route?.workType || person?.workType) !== 'office';
  const s = route?.summary;
  const hasDuty = !!route?.checkInTime;
  const grouped = useMemo(() => {
    const map = {};
    people.forEach((p) => {
      const b = displayLocation(p.branch) || 'Other';
      (map[b] ||= []).push(p);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [people]);

  const timeline = (route?.timeline || []).filter((e) => isField || e.type !== 'stop');

  const exportDay = () => {
    if (!route) return;
    const rows = timeline.map((e) => [
      e.type === 'stop' ? `Stop ${e.number}` : e.type === 'travel' ? 'Travel' : e.type === 'gap' ? 'No GPS signal' : e.type === 'checkin' ? 'Check in' : 'Check out',
      fmtTime(e.at),
      e.until ? fmtTime(e.until) : '',
      e.minutes ?? '',
      e.km ?? '',
      e.lat != null ? `${e.lat}, ${e.lng}` : '',
    ]);
    downloadExcel(`route-${route.employeeId || route.userId}-${route.date}.xls`, {
      headers: ['Event', 'From', 'To', 'Minutes', 'KM', 'Location'],
      rows,
    });
  };

  const stats = s
    ? [
        { label: 'Distance', value: `${Number(s.totalKm || 0).toFixed(2)} km`, tone: 'teal' },
        { label: 'On duty', value: fmtDuration(s.dutyMinutes), tone: 'slate' },
        { label: 'Moving', value: fmtDuration(s.movingMinutes), tone: 'blue' },
        ...(isField
          ? [
              { label: `Stopped (≥${minStop} min)`, value: fmtDuration(s.stoppedMinutes), tone: 'amber' },
              { label: 'Stops', value: s.stopCount, tone: 'amber' },
              { label: 'Longest stop', value: s.longestStopMinutes ? fmtDuration(s.longestStopMinutes) : '—', tone: 'rose' },
            ]
          : []),
        { label: 'Avg speed', value: s.avgSpeedKmh ? `${s.avgSpeedKmh} km/h` : '—', tone: 'violet' },
        { label: 'No signal', value: s.signalLostMinutes ? fmtDuration(s.signalLostMinutes) : 'None', tone: 'slate' },
      ]
    : [];

  return (
    <div className="rt-page">
      {!embedded && <PageHeader
        title="Employee route history"
        description={`Complete GPS path, stops and travel for every employee — kept for ${retentionDays} days.`}
      >
        <Link to="/tracking" className="btn btn-outline">← Live map</Link>
      </PageHeader>}

      <div className="card rt-toolbar">
        {!embedded && <div className="form-group">
          <label htmlFor="route-employee">Employee</label>
          <select id="route-employee" value={userId} onChange={(e) => update({ userId: e.target.value, date: null })}>
            {!userId && <option value="">Select employee</option>}
            {grouped.map(([branch, list]) => (
              <optgroup key={branch} label={branch}>
                {list.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name} ({p.employeeId}) · {p.workType === 'office' ? 'Office' : 'Field'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>}
        <div className="form-group">
          <label htmlFor="route-date">Date</label>
          <input
            id="route-date"
            type="date"
            value={date}
            max={todayKey()}
            min={new Date(Date.now() - (retentionDays - 1) * 86400000).toISOString().slice(0, 10)}
            onChange={(e) => update({ date: e.target.value })}
          />
        </div>
        {isField && (
          <div className="form-group">
            <label htmlFor="route-stop">Count a stop after</label>
            <select id="route-stop" value={minStop} onChange={(e) => setMinStop(Number(e.target.value))}>
              {STOP_FILTERS.map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
        )}
        <div className="rt-toolbar__actions">
          <button type="button" className="btn btn-outline" onClick={exportDay} disabled={!hasDuty}>
            Download day report
          </button>
        </div>
      </div>

      {error && <div className="card"><p style={{ color: '#b91c1c', margin: 0 }}>{error}</p></div>}

      {person && (
        <div className="card rt-person">
          <div className="rt-person__avatar">{initials(person.name)}</div>
          <div className="rt-person__info">
            <h2>{person.name}</h2>
            <span>
              {person.employeeId} · {displayLocation(person.branch)} ·{' '}
              <span className={`rt-badge rt-badge--${isField ? 'field' : 'office'}`}>{isField ? 'Field staff' : 'Office staff'}</span>
            </span>
            <p className="employee-contact">{person.mobile || 'No mobile on file'}{person.email ? ` · ${person.email}` : ''} · {person.role === 'branchManager' ? 'Manager' : 'Employee'}</p>
          </div>
          <ActivityStrip days={days} selected={date} onPick={(d) => update({ date: d })} retentionDays={retentionDays} />
        </div>
      )}

      <details className="card duty-history">
        <summary>Duty history · {days.length} recorded shifts <span>View dates, attendance and distance</span></summary>
        {daysLoading ? <p role="status">Loading duty history…</p> : daysError ? <p className="error-msg" role="alert">{daysError}</p> : days.length ? <div className="table-wrap"><table>
          <thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th><th>Duty time</th><th>Distance</th><th>Stops</th><th>Details</th></tr></thead>
          <tbody>{days.map(d => <tr key={d.attendanceId || d.date} className={d.date === date ? 'is-selected' : ''}>
            <td>{fmtDay(d.date)}</td><td>{fmtTime(d.checkInTime)}</td><td>{d.checkOutTime ? fmtTime(d.checkOutTime) : 'Open shift'}</td>
            <td>{fmtDuration(d.dutyMinutes)}</td><td>{Number(d.totalKm || 0).toFixed(2)} km</td><td>{d.stopCount || 0}</td>
            <td><button type="button" className="btn btn-outline btn-sm" onClick={() => update({date:d.date})}>{d.date === date ? 'Selected day' : 'View day'}</button></td>
          </tr>)}</tbody></table></div> : <p className="muted">No recorded duty in this history period.</p>}
      </details>

      {loading && !route ? (
        <div className="card"><p className="muted">Loading route…</p></div>
      ) : route && !hasDuty ? (
        <div className="card empty-state">
          <p>No duty on {fmtDay(date)}</p>
          <span>Pick a highlighted day in the bar chart above.</span>
        </div>
      ) : route ? (
        <>
          <div className="rt-stats">
            {stats.map((x) => (
              <article key={x.label} className={`rt-stat rt-stat--${x.tone}`}>
                <span className="rt-stat__label">{x.label}</span>
                <strong className="rt-stat__value">{x.value}</strong>
              </article>
            ))}
          </div>

          {!isField && (
            <div className="rt-note">Office staff work from the office, so stops are not listed. The path is still recorded.</div>
          )}

          <div className="rt-main">
            <div className="card rt-map-card">
              <div className="card__header rt-map-card__head">
                <div>
                  <h2 className="card__title">{fmtDay(route.date)}</h2>
                  <span className="card__subtitle">
                    Check-in {fmtTime(route.checkInTime)} · {route.checkOutTime ? `check-out ${fmtTime(route.checkOutTime)}` : 'on duty now'} · {s?.pointCount || 0} GPS points
                  </span>
                </div>
              </div>
              <RouteMap route={route} showStops={isField} focus={focus} replayIndex={replay} />
              {route.points.length > 1 && (
                <div className="rt-replay">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => {
                    if (replay == null || replay >= route.points.length - 1) setReplay(0);
                    setPlaying((p) => !p);
                  }}>
                    {playing ? 'Pause' : 'Replay route'}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={route.points.length - 1}
                    value={replay ?? 0}
                    onChange={(e) => {
                      setPlaying(false);
                      setReplay(Number(e.target.value));
                    }}
                  />
                  <span className="rt-replay__time">{replay != null ? fmtTime(route.points[replay]?.at) : '—'}</span>
                </div>
              )}
            </div>

            <div className="card rt-timeline">
              <h3>Day timeline</h3>
              {!timeline.length && <p className="muted">No movement recorded yet.</p>}
              <ol>
                {timeline.map((e, i) => (
                  <li key={`${e.type}-${e.at}-${i}`} className={`rt-ev rt-ev--${e.type}${e.ongoing ? ' rt-ev--ongoing' : ''}`}>
                    <span className="rt-ev__dot">{e.type === 'stop' ? e.number : ''}</span>
                    <div className="rt-ev__body">
                      {e.type === 'checkin' && (
                        <>
                          <strong>Checked in</strong>
                          <span>{fmtTime(e.at)}</span>
                        </>
                      )}
                      {e.type === 'checkout' && (
                        <>
                          <strong>Checked out</strong>
                          <span>{fmtTime(e.at)}</span>
                        </>
                      )}
                      {e.type === 'travel' && (
                        <>
                          <strong>Travelled {Number(e.km).toFixed(2)} km</strong>
                          <span>{fmtTime(e.at)} – {fmtTime(e.until)} · {fmtDuration(e.minutes)}</span>
                        </>
                      )}
                      {e.type === 'gap' && (
                        <>
                          <strong>No GPS signal</strong>
                          <span>{fmtTime(e.at)} – {fmtTime(e.until)} · {fmtDuration(e.minutes)}</span>
                        </>
                      )}
                      {e.type === 'stop' && (
                        <>
                          <strong>
                            {e.ongoing ? 'Staying here now' : e.isStart ? 'Stayed at start' : 'Stopped'} · {fmtDuration(e.minutes)}
                          </strong>
                          <span>{fmtTime(e.at)} – {e.ongoing ? 'now' : fmtTime(e.until)}</span>
                          <StopPlace lat={e.lat} lng={e.lng} />
                          <span className="rt-ev__links">
                            <button type="button" className="rt-link" onClick={() => setFocus({ lat: e.lat, lng: e.lng, t: Date.now() })}>
                              Show on map
                            </button>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`} target="_blank" rel="noreferrer">
                              Google Maps
                            </a>
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
