import { useEffect, useState } from 'react';
import api, { usersApi, branchesApi, customersApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import SearchableSelect from '../components/SearchableSelect';
import { useSession } from '../auth/Session';
import { canPerformStored } from '../utils/permissions';

const blank = {title:'',description:'',branch:'',userId:'',important:true,location:'',scheduledAt:''};
export default function TeamWorkspace({kind}) {
  const {user}=useSession();
  const notices=kind==='notices';
  const canCreate=(notices ? user.role==='admin' : ['admin','branchManager'].includes(user.role)) && canPerformStored(kind,'create');
  const [records,setRecords]=useState([]),[people,setPeople]=useState([]),[branches,setBranches]=useState([]),[customers,setCustomers]=useState([]),[targetIds,setTargetIds]=useState([]),[customerSearch,setCustomerSearch]=useState('');
  const [form,setForm]=useState({...blank}),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const scopedCustomers=customers.filter(c=>!form.branch || c.branch===form.branch);
  const visibleCustomers=scopedCustomers.filter(c=>`${c.name||''} ${c.mobile||''} ${c.address||''} ${c.branch||''}`.toLowerCase().includes(customerSearch.toLowerCase().trim()));
  const selectedCustomers=customers.filter(c=>targetIds.includes(`customer:${c.id}`));
  const refresh=async()=>{const r=await api.get(`/workspace/${kind}`);setRecords(r.data || []);};
  useEffect(()=>{
    setRecords([]); setEditing(false); setForm({...blank}); setTargetIds([]); setCustomerSearch(''); setMessage('');
    refresh().catch(e=>setMessage(e.message));
    if(canCreate) {
      usersApi.getAll().then(r=>setPeople(r.data || [])).catch(e=>setMessage(e.message));
      branchesApi.getAll().then(r=>setBranches(r.data || [])).catch(e=>setMessage(e.message));
      if(!notices) customersApi.getAll().then(r=>setCustomers(r.data || [])).catch(()=>{});
    }
    const timer=setInterval(()=>refresh().catch(()=>{}),30000);return()=>clearInterval(timer);
  },[kind]);
  async function save(e) {
    e.preventDefault();setBusy(true);setMessage('');
    try {
      const payload={...form};
      if(!notices) payload.scheduledAt=new Date(`${form.scheduledAt}:00+05:30`).toISOString();
      if(!notices) { payload.customerIds=targetIds.map(id=>id.slice(9)); delete payload.title; delete payload.location; }
      const saved=await api.post(`/workspace/${kind}`,payload);setEditing(false);setForm({...blank});setTargetIds([]);await refresh();setMessage(notices?'Notice published to the selected employees.':`${Array.isArray(saved.data)?saved.data.length:1} visit schedule(s) created.`);
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  async function action(record,status) {
    let completionNote;
    if(!notices){completionNote=window.prompt('Enter a reason for cancelling this visit:');if(!completionNote)return;}
    setBusy(true);try {
      if(notices)await api.post(`/workspace/notices/${record.id}/acknowledge`);
      else await api.put(`/workspace/visits/${record.id}`,{status,completionNote});
      await refresh();
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  return <div className="team-workspace"><PageHeader title={notices?'Notice & Announcement':'Visit schedules'} description={notices?'Publish targeted team updates and track read acknowledgements.':'Plan staff and shop visits, record outcomes, and schedule repeat visits.'}>
    {canCreate && <button className="btn btn-primary" onClick={()=>{setForm({...blank});setTargetIds([]);setCustomerSearch('');setEditing(true);}}>{notices?'+ Publish notice':'+ Schedule visit'}</button>}
  </PageHeader>
  {message && <p role="status">{message}</p>}
  {editing && <form className="card team-workspace__form" onSubmit={save}>
    <div className="team-workspace__formhead"><div><span className="eyebrow">{notices?'New communication':'New planned visit'}</span><h2>{notices?'Publish a clear staff notice':'Schedule customer visits'}</h2><p>{notices?'Choose who receives it and whether an acknowledgement is needed.':'Assign one employee, choose customers and send GPS-enabled visit tasks directly to their app.'}</p></div>{!notices&&<span className="team-workspace__form-status">{targetIds.length ? `${targetIds.length} customer${targetIds.length===1?'':'s'} selected` : 'Draft visit plan'}</span>}</div>
    {!notices&&<ol className="visit-flow" aria-label="Visit scheduling steps"><li className="is-current"><span>1</span><div><strong>Assign</strong><small>Choose branch and employee</small></div></li><li className={targetIds.length?'is-current':''}><span>2</span><div><strong>Select customers</strong><small>One task is created per customer</small></div></li><li><span>3</span><div><strong>Review & send</strong><small>Employee gets visit GPS details</small></div></li></ol>}
    <div className="team-workspace__grid">
      {notices && <label>Title<input className="form-input" required maxLength={150} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>}
      <label>Branch<SearchableSelect value={form.branch} onChange={e=>setForm({...form,branch:e.target.value,userId:''})}><option value="">{user.role==='admin'?'All branches':'Your branch'}</option>{branches.map(b=><option key={b.id} value={b.name}>{b.name}</option>)}</SearchableSelect></label>
      <label>{notices?'Audience':'Assign employee'}<SearchableSelect required={!notices} value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})}><option value="">{notices?'All employees in selected branches':'Search all employees'}</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} · {p.employeeId} · {p.branch || 'No branch'}</option>)}</SearchableSelect></label>
      {!notices && <label>Scheduled time (IST)<input className="form-input" type="datetime-local" required value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label>}
    </div>
    <label className="team-workspace__details">Details<textarea className="form-input" rows={4} required maxLength={4000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    {!notices && <section className="team-workspace__targets" aria-label="Existing customers"><div className="team-workspace__target-head"><div><span className="team-workspace__step">Step 2</span><strong>Choose customers</strong><p>Search by name, mobile, address or branch. Saved address and GPS destination are sent to the employee’s app automatically.</p></div><div className="team-workspace__selection-actions"><span>{targetIds.length ? `${targetIds.length} selected` : 'None selected'}</span>{targetIds.length>0&&<button type="button" onClick={()=>setTargetIds([])}>Clear selection</button>}</div></div>
      <div className="team-workspace__search"><span aria-hidden="true">⌕</span><input className="form-input" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Search customer, mobile, address or branch…" aria-label="Search customers"/><small>{form.branch ? `${scopedCustomers.length} customers in ${form.branch}` : `${scopedCustomers.length} customers across all branches`}</small></div>
      {selectedCustomers.length>0&&<div className="team-workspace__selected" aria-label="Selected customers">{selectedCustomers.map(c=><span key={c.id}>{c.name}<button type="button" aria-label={`Remove ${c.name}`} onClick={()=>setTargetIds(ids=>ids.filter(id=>id!==`customer:${c.id}`))}>×</button></span>)}</div>}
      <div className="team-workspace__customer-list">{visibleCustomers.map(c=>{const id=`customer:${c.id}`,checked=targetIds.includes(id);return <label className={checked?'is-selected':''} key={id}><input type="checkbox" checked={checked} onChange={e=>setTargetIds(e.target.checked?[...targetIds,id]:targetIds.filter(x=>x!==id))}/><span className="team-workspace__customer-avatar">{(c.name||'?').trim().slice(0,1).toUpperCase()}</span><span><strong>{c.name}</strong><small>{c.mobile || 'Mobile not recorded'} · {c.branch || 'No branch'}</small><em>{c.address || 'Address not recorded'}</em></span><b>{checked?'Selected':'Select'}</b></label>})}{!scopedCustomers.length&&<div className="team-workspace__customer-empty"><strong>No customers available</strong><span>{form.branch?'No approved customer belongs to this branch yet.':'Add or approve customers first, then return here to schedule their visit.'}</span></div>}{!!scopedCustomers.length&&!visibleCustomers.length&&<div className="team-workspace__customer-empty"><strong>No customers match this search</strong><span>Try a different name, mobile number, address or branch.</span></div>}</div></section>}
    {notices && <label className="team-workspace__important"><input type="checkbox" checked={form.important} onChange={e=>setForm({...form,important:e.target.checked})}/><span><strong>Important notice</strong><small>Employees must acknowledge they have read it.</small></span></label>}
    <div className="row-actions team-workspace__actions"><div><strong>{notices?'Ready to publish':'Ready to create visit tasks'}</strong>{!notices&&<small>{targetIds.length ? `${targetIds.length} task${targetIds.length===1?'':'s'} will be sent to the selected employee.`:'Select at least one customer to continue.'}</small>}</div><span><button disabled={busy || (!notices&&!targetIds.length)} className="btn btn-primary">{busy?'Saving…':notices?'Publish notice':targetIds.length?`Create ${targetIds.length} visit task${targetIds.length===1?'':'s'}`:'Create visit tasks'}</button><button type="button" className="btn btn-outline" onClick={()=>setEditing(false)}>Cancel</button></span></div>
  </form>}
  {!records.length && <div className="card team-workspace__empty">No {notices?'announcements':'visits'} yet.</div>}
  {records.map(r=><article className="card team-workspace__record" key={r.id}>
    <small>{notices?(r.important?'Important · acknowledgement requested':'Team update'):r.status} · {new Date(r.scheduledAt || r.createdAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</small>
    <h3>{r.title}</h3><p style={{whiteSpace:'pre-wrap'}}>{r.description}</p>
    {!notices && <p><strong>{r.targetType==='customer'?'Customer':r.targetType==='lead'?'Lead':'Location'}:</strong> {r.targetName || r.location} {r.targetMobile?`· ${r.targetMobile}`:''} · {r.location} · {r.recipientNames?.join(', ')}<br/>{r.completionNote}</p>}
    {!notices && r.verification && <section className="visit-verification">
      <div><span className="eyebrow">Field evidence</span><h4>Verified visit report</h4><p>Planned {new Date(r.scheduledAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST · started {r.startedAt?new Date(r.startedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'—'} IST · completed {new Date(r.verification.completedAt || r.completedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p></div>
      <div className="visit-verification__grid"><div><small>Purpose</small><strong>{r.verification.purpose?.replaceAll('_',' ')}</strong></div><div><small>Result</small><strong>{r.verification.result?.replaceAll('_',' ')}</strong></div><div><small>Photo GPS</small><strong>{Number(r.verification.photoGps?.lat).toFixed(6)}, {Number(r.verification.photoGps?.lng).toFixed(6)}</strong></div><div><small>GPS accuracy</small><strong>{r.verification.photoGps?.accuracy == null ? 'Not reported' : `±${Math.round(r.verification.photoGps.accuracy)} m`}</strong></div><div><small>Visit-start GPS</small><strong>{r.startGps ? `${Number(r.startGps.lat).toFixed(6)}, ${Number(r.startGps.lng).toFixed(6)}` : 'Not recorded'}</strong></div><div><small>Follow-up</small><strong>{r.verification.nextFollowUpDate || 'Not required'}</strong></div></div>
      <p className="visit-verification__discussion"><strong>Discussion:</strong> {r.verification.discussion}</p>{r.verification.remarks&&<p><strong>Remarks:</strong> {r.verification.remarks}</p>}
      <p><small>Photo captured: {new Date(r.verification.photoGps.capturedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST · Server received: {new Date(r.verification.photoGps.receivedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</small></p>
      {r.verification.paymentAmount!==null&&r.verification.paymentAmount!==undefined&&<p><strong>Payment promise:</strong> ₹{r.verification.paymentAmount} {r.verification.paymentPromiseDate?`by ${r.verification.paymentPromiseDate}`:''}</p>}
      <div className="visit-verification__evidence">{r.verification.photo&&<a href={r.verification.photo} target="_blank" rel="noreferrer"><img src={r.verification.photo} alt={`GPS evidence for ${r.title}`}/><span>Open GPS-stamped visit photo</span></a>}{r.verification.photoGps&&<a className="btn btn-outline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${r.verification.photoGps.lat},${r.verification.photoGps.lng}`}>Open photo location</a>}{r.startGps&&<a className="btn btn-outline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${r.startGps.lat},${r.startGps.lng}`}>Open start location</a>}</div>
    </section>}
    {notices && r.recipientIds && <details><summary>Read acknowledgements: {Object.keys(r.acknowledgements || {}).length} / {r.recipientIds.length}</summary>{r.recipientIds.map((id,i)=><p key={id}>{r.recipientNames?.[i] || id}: {r.acknowledgements?.[id]?new Date(r.acknowledgements[id]).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST':'Pending'}</p>)}</details>}
    <div className="row-actions">
      {notices && (r.recipientIds?.includes(user.id) || !r.recipientIds) && <button className="btn btn-outline" disabled={busy || !!(r.acknowledgedAt || r.acknowledgements?.[user.id])} onClick={()=>action(r)}>{r.acknowledgedAt || r.acknowledgements?.[user.id]?'Acknowledged':'I have read this notice'}</button>}
      {!notices && ['scheduled','in_progress'].includes(r.status) && canPerformStored('visits','update') && canCreate && <button disabled={busy} className="btn btn-outline" onClick={()=>action(r,'cancelled')}>Cancel visit</button>}
    {!notices && canCreate && <button className="btn btn-outline" onClick={()=>{setForm({...blank,description:r.description,branch:r.branch,userId:r.recipientIds?.[0] || ''});setTargetIds(r.customerId?[`customer:${r.customerId}`]:[]);setCustomerSearch('');setEditing(true);window.scrollTo({top:0,behavior:'smooth'});}}>Schedule visit again</button>}
    </div>
  </article>)}
  </div>;
}
