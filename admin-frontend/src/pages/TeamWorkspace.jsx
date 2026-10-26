import { useEffect, useState } from 'react';
import api, { usersApi, branchesApi, customersApi, leadsApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import SearchableSelect from '../components/SearchableSelect';
import { useSession } from '../auth/Session';
import { canPerformStored } from '../utils/permissions';

const blank = {title:'',description:'',branch:'',userId:'',important:true,location:'',scheduledAt:''};
export default function TeamWorkspace({kind}) {
  const {user}=useSession();
  const notices=kind==='notices';
  const canCreate=(notices ? user.role==='admin' : ['admin','branchManager'].includes(user.role)) && canPerformStored(kind,'create');
  const [records,setRecords]=useState([]),[people,setPeople]=useState([]),[branches,setBranches]=useState([]),[customers,setCustomers]=useState([]),[leads,setLeads]=useState([]),[targetIds,setTargetIds]=useState([]);
  const [form,setForm]=useState({...blank}),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const refresh=async()=>{const r=await api.get(`/workspace/${kind}`);setRecords(r.data || []);};
  useEffect(()=>{
    setRecords([]); setEditing(false); setForm({...blank}); setMessage('');
    refresh().catch(e=>setMessage(e.message));
    if(canCreate) {
      usersApi.getAll().then(r=>setPeople(r.data || [])).catch(e=>setMessage(e.message));
      branchesApi.getAll().then(r=>setBranches(r.data || [])).catch(e=>setMessage(e.message));
      if(!notices) { customersApi.getAll().then(r=>setCustomers(r.data || [])).catch(()=>{}); leadsApi.getAll().then(r=>setLeads(r.data || [])).catch(()=>{}); }
    }
    const timer=setInterval(()=>refresh().catch(()=>{}),30000);return()=>clearInterval(timer);
  },[kind]);
  async function save(e) {
    e.preventDefault();setBusy(true);setMessage('');
    try {
      const payload={...form};
      if(!notices) payload.scheduledAt=new Date(`${form.scheduledAt}:00+05:30`).toISOString();
      if(!notices) { payload.customerIds=targetIds.filter(id=>id.startsWith('customer:')).map(id=>id.slice(9)); payload.leadIds=targetIds.filter(id=>id.startsWith('lead:')).map(id=>id.slice(5)); }
      const saved=await api.post(`/workspace/${kind}`,payload);setEditing(false);setForm({...blank});setTargetIds([]);await refresh();setMessage(notices?'Notice published to the selected employees.':`${Array.isArray(saved.data)?saved.data.length:1} visit schedule(s) created.`);
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
  return <div className="team-workspace"><PageHeader title={notices?'Notice & Announcement':'Visit schedules'} description={notices?'Publish targeted team updates and track read acknowledgements.':'Plan staff and shop visits, record outcomes, and schedule repeat visits.'}>
    {canCreate && <button className="btn btn-primary" onClick={()=>{setForm({...blank});setTargetIds([]);setEditing(true);}}>{notices?'+ Publish notice':'+ Schedule visit'}</button>}
  </PageHeader>
  {message && <p role="status">{message}</p>}
  {editing && <form className="card team-workspace__form" onSubmit={save}>
    <div className="team-workspace__formhead"><div><span className="eyebrow">{notices?'New communication':'New planned visit'}</span><h2>{notices?'Publish a clear staff notice':'Schedule a field visit'}</h2><p>{notices?'Choose who receives it and whether an acknowledgement is needed.':'Assign one employee, capture the purpose, location and exact planned time.'}</p></div></div>
    <div className="team-workspace__grid">
      <label>Title<input className="form-input" required maxLength={150} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label>Branch<SearchableSelect value={form.branch} onChange={e=>setForm({...form,branch:e.target.value,userId:''})}><option value="">{user.role==='admin'?'All branches':'Your branch'}</option>{branches.map(b=><option key={b.id} value={b.name}>{b.name}</option>)}</SearchableSelect></label>
      <label>{notices?'Audience':'Employee'}<SearchableSelect required={!notices} value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})}><option value="">{notices?'All employees in selected branches':'Select employee'}</option>{people.filter(p=>!form.branch || p.branch===form.branch).map(p=><option key={p.id} value={p.id}>{p.name} · {p.employeeId}</option>)}</SearchableSelect></label>
      {!notices && <><label>Scheduled time (IST)<input className="form-input" type="datetime-local" required value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label><label>Shop / staff location<input className="form-input" required maxLength={500} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label></>}
    </div>
    <label className="team-workspace__details">Details<textarea className="form-input" rows={4} required maxLength={4000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    {!notices && <details className="team-workspace__targets"><summary>Assign multiple customers or leads <span>{targetIds.length ? `${targetIds.length} selected` : 'Optional'}</span></summary><p>One visit is created for each selected customer or lead, all assigned to the selected employee.</p><div>{customers.filter(c=>!form.branch || c.branch===form.branch).map(c=>{const id=`customer:${c.id}`;return <label key={id}><input type="checkbox" checked={targetIds.includes(id)} onChange={e=>setTargetIds(e.target.checked?[...targetIds,id]:targetIds.filter(x=>x!==id))}/><span>Customer · {c.name} · {c.mobile}</span></label>})}{leads.filter(l=>!form.branch || l.branch===form.branch).map(l=>{const id=`lead:${l.id}`;return <label key={id}><input type="checkbox" checked={targetIds.includes(id)} onChange={e=>setTargetIds(e.target.checked?[...targetIds,id]:targetIds.filter(x=>x!==id))}/><span>Lead · {l.name || l.mobile}</span></label>})}{!customers.length&&!leads.length&&<small>No customers or leads are currently available in this branch.</small>}</div></details>}
    {notices && <label className="team-workspace__important"><input type="checkbox" checked={form.important} onChange={e=>setForm({...form,important:e.target.checked})}/><span><strong>Important notice</strong><small>Employees must acknowledge they have read it.</small></span></label>}
    <div className="row-actions team-workspace__actions"><button disabled={busy} className="btn btn-primary">{notices?'Publish notice':'Save visit'}</button><button type="button" className="btn btn-outline" onClick={()=>setEditing(false)}>Cancel</button></div>
  </form>}
  {!records.length && <div className="card team-workspace__empty">No {notices?'announcements':'visits'} yet.</div>}
  {records.map(r=><article className="card team-workspace__record" key={r.id}>
    <small>{notices?(r.important?'Important · acknowledgement requested':'Team update'):r.status} · {new Date(r.scheduledAt || r.createdAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</small>
    <h3>{r.title}</h3><p style={{whiteSpace:'pre-wrap'}}>{r.description}</p>
    {!notices && <p><strong>{r.targetType==='customer'?'Customer':r.targetType==='lead'?'Lead':'Location'}:</strong> {r.targetName || r.location} · {r.location} · {r.recipientNames?.join(', ')}<br/>{r.completionNote}</p>}
    {notices && r.recipientIds && <details><summary>Read acknowledgements: {Object.keys(r.acknowledgements || {}).length} / {r.recipientIds.length}</summary>{r.recipientIds.map((id,i)=><p key={id}>{r.recipientNames?.[i] || id}: {r.acknowledgements?.[id]?new Date(r.acknowledgements[id]).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST':'Pending'}</p>)}</details>}
    <div className="row-actions">
      {notices && (r.recipientIds?.includes(user.id) || !r.recipientIds) && <button className="btn btn-outline" disabled={busy || !!(r.acknowledgedAt || r.acknowledgements?.[user.id])} onClick={()=>action(r)}>{r.acknowledgedAt || r.acknowledgements?.[user.id]?'Acknowledged':'I have read this notice'}</button>}
      {!notices && r.status==='scheduled' && canPerformStored('visits','update') && <><button disabled={busy} className="btn btn-primary" onClick={()=>action(r,'completed')}>Mark completed</button>{canCreate && <button disabled={busy} className="btn btn-outline" onClick={()=>action(r,'cancelled')}>Cancel visit</button>}</>}
      {!notices && canCreate && <button className="btn btn-outline" onClick={()=>{setForm({...blank,title:r.title,description:r.description,location:r.location,branch:r.branch,userId:r.recipientIds?.[0] || ''});setEditing(true);window.scrollTo({top:0,behavior:'smooth'});}}>Schedule visit again</button>}
    </div>
  </article>)}
  </div>;
}
