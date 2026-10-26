import { useEffect, useState } from 'react';
import api, { usersApi, branchesApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import SearchableSelect from '../components/SearchableSelect';
import { useSession } from '../auth/Session';
import { canPerformStored } from '../utils/permissions';

const blank = {title:'',description:'',branch:'',userId:'',important:true,location:'',scheduledAt:''};
export default function TeamWorkspace({kind}) {
  const {user}=useSession();
  const notices=kind==='notices';
  const canCreate=(notices ? user.role==='admin' : ['admin','branchManager'].includes(user.role)) && canPerformStored(kind,'create');
  const [records,setRecords]=useState([]),[people,setPeople]=useState([]),[branches,setBranches]=useState([]);
  const [form,setForm]=useState({...blank}),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const refresh=async()=>{const r=await api.get(`/workspace/${kind}`);setRecords(r.data || []);};
  useEffect(()=>{
    setRecords([]); setEditing(false); setForm({...blank}); setMessage('');
    refresh().catch(e=>setMessage(e.message));
    if(canCreate) {
      usersApi.getAll().then(r=>setPeople(r.data || [])).catch(e=>setMessage(e.message));
      branchesApi.getAll().then(r=>setBranches(r.data || [])).catch(e=>setMessage(e.message));
    }
    const timer=setInterval(()=>refresh().catch(()=>{}),30000);return()=>clearInterval(timer);
  },[kind]);
  async function save(e) {
    e.preventDefault();setBusy(true);setMessage('');
    try {
      const payload={...form};
      if(!notices) payload.scheduledAt=new Date(`${form.scheduledAt}:00+05:30`).toISOString();
      await api.post(`/workspace/${kind}`,payload);setEditing(false);setForm({...blank});await refresh();setMessage(notices?'Notice published to the selected employees.':'Visit scheduled.');
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  async function action(record,status) {
    let completionNote;
    if(!notices){completionNote=window.prompt('Enter visit completion / cancellation notes:');if(!completionNote)return;}
    setBusy(true);try {
      if(notices)await api.post(`/workspace/notices/${record.id}/acknowledge`);
      else await api.put(`/workspace/visits/${record.id}`,{status,completionNote});
      await refresh();
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  return <div><PageHeader title={notices?'Notice & Announcement':'Visit schedules'} description={notices?'Publish team updates and track explicit read acknowledgements.':'Plan staff location and shop visits, record outcomes, and schedule repeat visits.'}>
    {canCreate && <button className="btn btn-primary" onClick={()=>{setForm({...blank});setEditing(true);}}>{notices?'+ Publish notice':'+ Schedule visit'}</button>}
  </PageHeader>
  {message && <p role="status">{message}</p>}
  {editing && <form className="card" onSubmit={save} style={{padding:24,marginBottom:24}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:20}}>
      <label>Title<input className="form-input" required maxLength={150} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label>Branch<SearchableSelect value={form.branch} onChange={e=>setForm({...form,branch:e.target.value,userId:''})}><option value="">{user.role==='admin'?'All branches':'Your branch'}</option>{branches.map(b=><option key={b.id} value={b.name}>{b.name}</option>)}</SearchableSelect></label>
      <label>{notices?'Audience':'Employee'}<SearchableSelect required={!notices} value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})}><option value="">{notices?'All employees in selected branches':'Select employee'}</option>{people.filter(p=>!form.branch || p.branch===form.branch).map(p=><option key={p.id} value={p.id}>{p.name} · {p.employeeId}</option>)}</SearchableSelect></label>
      {!notices && <><label>Scheduled time (IST)<input className="form-input" type="datetime-local" required value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label><label>Shop / staff location<input className="form-input" required maxLength={500} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label></>}
    </div>
    <label>Details<textarea className="form-input" rows={4} required maxLength={4000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    {notices && <label><input type="checkbox" checked={form.important} onChange={e=>setForm({...form,important:e.target.checked})}/> Important · request read acknowledgement</label>}
    <div className="row-actions" style={{marginTop:20}}><button disabled={busy} className="btn btn-primary">{notices?'Publish notice':'Save visit'}</button><button type="button" className="btn btn-outline" onClick={()=>setEditing(false)}>Cancel</button></div>
  </form>}
  {!records.length && <div className="card" style={{padding:24}}>No {notices?'announcements':'visits'} yet.</div>}
  {records.map(r=><article className="card" key={r.id} style={{padding:24,marginBottom:16}}>
    <small>{notices?(r.important?'Important · acknowledgement requested':'Team update'):r.status} · {new Date(r.scheduledAt || r.createdAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</small>
    <h3>{r.title}</h3><p style={{whiteSpace:'pre-wrap'}}>{r.description}</p>
    {!notices && <p><strong>Location:</strong> {r.location} · {r.recipientNames?.join(', ')}<br/>{r.completionNote}</p>}
    {notices && r.recipientIds && <details><summary>Read acknowledgements: {Object.keys(r.acknowledgements || {}).length} / {r.recipientIds.length}</summary>{r.recipientIds.map((id,i)=><p key={id}>{r.recipientNames?.[i] || id}: {r.acknowledgements?.[id]?new Date(r.acknowledgements[id]).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST':'Pending'}</p>)}</details>}
    <div className="row-actions">
      {notices && (r.recipientIds?.includes(user.id) || !r.recipientIds) && <button className="btn btn-outline" disabled={busy || !!(r.acknowledgedAt || r.acknowledgements?.[user.id])} onClick={()=>action(r)}>{r.acknowledgedAt || r.acknowledgements?.[user.id]?'Acknowledged':'I have read this notice'}</button>}
      {!notices && r.status==='scheduled' && canPerformStored('visits','update') && <><button disabled={busy} className="btn btn-primary" onClick={()=>action(r,'completed')}>Mark completed</button>{canCreate && <button disabled={busy} className="btn btn-outline" onClick={()=>action(r,'cancelled')}>Cancel visit</button>}</>}
      {!notices && canCreate && <button className="btn btn-outline" onClick={()=>{setForm({...blank,title:r.title,description:r.description,location:r.location,branch:r.branch,userId:r.recipientIds?.[0] || ''});setEditing(true);window.scrollTo({top:0,behavior:'smooth'});}}>Schedule visit again</button>}
    </div>
  </article>)}
  </div>;
}
