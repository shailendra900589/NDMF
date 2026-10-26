import { useEffect, useState } from 'react';
import api from '../api/api';
export default function AttendanceTiming() {
  const [policy, setPolicy] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/settings/public').then(r => setPolicy(r.data.attendanceTiming)).catch(e => setMessage(e.message)); }, []);
  async function save(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { await api.put('/settings/attendance-timing', policy); setMessage('Timing policy saved. Applies to new check-ins.'); } catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <details className="card" style={{padding:20, marginBottom:20}}><summary>Attendance timing settings · India Standard Time</summary>
    {policy && <form onSubmit={save}><p>Configure a same-day shift. Late arrival and early departure are recorded; they do not automatically deduct salary. Checkout stays available so employees can end their duty safely.</p>
      <label><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/> Enable check-in window</label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:16,margin:'16px 0'}}>
        {Object.entries({opensAt:'Check-in opens',startsAt:'Shift starts',closesAt:'Last check-in',endsAt:'Shift ends'}).map(([key,label])=><label key={key}>{label}<input className="form-input" type="time" required value={policy[key]} onChange={e=>setPolicy({...policy,[key]:e.target.value})}/></label>)}
        <label>Late grace (minutes)<input className="form-input" type="number" min="0" max="120" required value={policy.graceMinutes} onChange={e=>setPolicy({...policy,graceMinutes:Number(e.target.value)})}/></label>
      </div><button className="btn btn-primary" disabled={busy}>Save timing policy</button></form>}
    {message && <p role="status">{message}</p>}
  </details>;
}
