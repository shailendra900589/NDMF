import {useEffect,useState} from 'react';
import {packageApi} from '../api/api';
import {AccessMatrix} from './SuperAdmin';
import SearchableSelect from '../components/SearchableSelect';
import './Packages.css';
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
export default function Packages(){
  const [data,setData]=useState(null),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [companyId,setCompanyId]=useState(''),[planId,setPlanId]=useState(''),[startsOn,setStartsOn]=useState(today);
  const load=async()=>{const r=await packageApi.overview();setData(r.data);};
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  const run=async(fn,success)=>{setBusy(true);setError('');setMessage('');try{await fn();await load();setMessage(success);}catch(e){setError(e.message);}finally{setBusy(false);}};
  if(!data)return <div className="sa sa-loading">{error||'Loading packages…'}{error&&<button onClick={()=>load().catch(e=>setError(e.message))}>Retry</button>}</div>;
  function create(){setDraft({name:'',description:'',monthlyPrice:1000,includedEmployees:5,extraEmployeeMonthlyPrice:200,billingMonths:1,published:false,isArchived:false,
    modules:Object.fromEntries(Object.keys(data.modules).map(k=>[k,false])),actions:Object.fromEntries(Object.keys(data.modules).map(k=>[k,Object.fromEntries(Object.keys(data.actions).map(a=>[a,true]))]))});setMessage('');}
  const set=(key,value)=>setDraft(d=>({...d,[key]:value}));
  const selected=data.packages.find(p=>p.id===planId),company=data.companies.find(c=>c.id===companyId);
  const estimate=selected&&company?selected.monthlyPrice+Math.max(0,company.employees-selected.includedEmployees)*selected.extraEmployeeMonthlyPrice:null;
  return <div className="sa packages-page">
    <header className="sa-hero"><div><p>PLATFORM / SUBSCRIPTIONS</p><h1>Packages & pricing</h1><p>Choose employee allowances and functions. Publish a package to display it automatically on the website.</p></div><button className="btn btn-primary" onClick={create} disabled={busy}>+ Create package</button></header>
    {error&&<p role="alert" className="package-error">{error}</p>}{message&&<p role="status" className="package-success">{message}</p>}
    <div className="package-cards">{data.packages.map(p=><article key={p.id} className="package-card"><span className="package-badge">{p.isArchived?'Archived':p.published?'Published on website':'Draft'}</span><h2>{p.name}</h2><p>{p.description}</p><strong className="package-price">{money(p.monthlyPrice)}<small> / month</small></strong><p>{p.includedEmployees} employees included · {money(p.extraEmployeeMonthlyPrice)}/extra employee/month</p><p>Billed every {p.billingMonths} month{p.billingMonths>1?'s':''} · {Object.values(p.modules).filter(Boolean).length} modules</p><button className="btn" disabled={busy} onClick={()=>setDraft(structuredClone(p))}>Edit package</button></article>)}</div>
    {draft&&<section className="package-card"><h2>{draft.id?'Edit package':'New package'}</h2><p>Published changes appear on the website. Existing company subscriptions retain their purchased rates and functions until renewed.</p>
      <form onSubmit={e=>{e.preventDefault();run(async()=>{const r=draft.id?await packageApi.update(draft.id,draft):await packageApi.create(draft);setDraft(r.data);},'Package saved. Website pricing is updated.');}}>
        <div className="package-form"><label>Package name<input required maxLength={80} value={draft.name} onChange={e=>set('name',e.target.value)}/></label><label>Description<textarea maxLength={500} value={draft.description} onChange={e=>set('description',e.target.value)}/></label>
          {[['monthlyPrice','Base price per month (₹)',0,10000000],['includedEmployees','Included employees',0,100000],['extraEmployeeMonthlyPrice','Extra employee per month (₹)',0,10000000],['billingMonths','Billing period (months)',1,12]].map(([key,label,min,max])=><label key={key}>{label}<input required type="number" min={min} max={max} step="1" value={draft[key]} onChange={e=>set(key,e.target.value===''?'':Number(e.target.value))}/></label>)}
        </div><AccessMatrix modules={data.modules} actions={data.actions} moduleActions={data.moduleActions} value={draft} onChange={setDraft}/>
        <div className="package-controls"><label><input type="checkbox" checked={draft.published} disabled={draft.isArchived} onChange={e=>set('published',e.target.checked)}/> Publish on website</label><label><input type="checkbox" checked={draft.isArchived} onChange={e=>setDraft(d=>({...d,isArchived:e.target.checked,published:e.target.checked?false:d.published}))}/> Archive package</label><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save package'}</button><button type="button" className="btn" disabled={busy} onClick={()=>setDraft(null)}>Close editor</button></div>
      </form></section>}
    <section className="package-card"><h2>Activate or replace a company package</h2><p>Active employees and branch managers count towards billing. Company administrators, disabled and deleted accounts do not. Extra employees increase the charge; they are not blocked at the included allowance. Activation replaces the current subscription with the selected service period.</p>
      <form onSubmit={e=>{e.preventDefault();run(()=>packageApi.assign(companyId,{packageId:planId,startsOn}),'Company package activated.');}}>
        <div className="package-form"><label>Company<SearchableSelect value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Choose company</option>{data.companies.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</SearchableSelect></label><label>Package<SearchableSelect value={planId} onChange={e=>setPlanId(e.target.value)}><option value="">Choose package</option>{data.packages.filter(p=>!p.isArchived).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</SearchableSelect></label><label>Starts on (India)<input required type="date" value={startsOn} onChange={e=>setStartsOn(e.target.value)}/></label></div>
        {estimate!==null&&<p role="status"><strong>{company.employees} billable employees · {money(estimate)}/month · {money(estimate*selected.billingMonths)} for {selected.billingMonths} month(s)</strong></p>}
        <button className="btn btn-primary" disabled={busy||!companyId||!planId}>Activate package</button>
      </form>
      <div className="package-table"><table><thead><tr><th>Company</th><th>Employees</th><th>Package / access period</th><th>Current monthly estimate</th></tr></thead><tbody>{data.companies.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.employees}</td><td>{c.subscription?<>{c.subscription.name}<small>{c.subscription.startsOn} to {c.subscription.endsOn} (exclusive)</small></>:'Not assigned'}</td><td>{c.quote?<>{money(c.quote.monthlyTotal)}<small>{c.quote.additionalEmployees} extra × {money(c.quote.extraEmployeeMonthlyPrice)}</small></>:'—'}</td></tr>)}</tbody></table></div>
    </section>
    <section className="package-card"><h2>Website enquiries</h2>{!data.requests.length?<p>No package enquiries yet.</p>:<div className="package-table"><table><thead><tr><th>Company / contact</th><th>Package</th><th>Estimate</th><th>Status</th></tr></thead><tbody>{data.requests.map(r=><tr key={r.id}><td>{r.company}<small>{r.name} · {r.email} · {r.mobile}</small></td><td>{r.packageName}<small>{r.estimate.employees} employees</small></td><td>{money(r.estimate.monthlyTotal)}/month</td><td><select aria-label={`Status for ${r.company}`} value={r.status} disabled={busy} onChange={e=>run(()=>packageApi.requestStatus(r.id,e.target.value),'Enquiry updated.')}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
