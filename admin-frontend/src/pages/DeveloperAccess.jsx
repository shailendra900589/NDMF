import { useEffect, useState } from 'react';
import { developerApi } from '../api/api';
import SearchableSelect from '../components/SearchableSelect';
import './DeveloperAccess.css';

export default function DeveloperAccess() {
  const [data,setData]=useState(null), [message,setMessage]=useState(''), [secret,setSecret]=useState(''), [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState(''), [companyId,setCompany]=useState(''), [days,setDays]=useState(30), [rate,setRate]=useState(60), [scopes,setScopes]=useState([]);
  const [direct,setDirect]=useState(false), [contact,setContact]=useState({name:'',email:'',organization:'',purpose:''});
  const load=()=>developerApi.overview().then(r=>setData(r.data));
  useEffect(()=>{load().catch(e=>setMessage(e.response?.data?.message || 'Unable to load API access'));},[]);
  async function act(path,body) {
    setBusy(true);setMessage('');setSecret('');
    try {const r=await developerApi.action(path,body);setSecret(r.data?.token || '');setMessage(r.message || 'Updated');await load();}
    catch(e){setMessage(e.response?.data?.message || 'Unable to update API access');}finally{setBusy(false);}
  }
  const pending=data?.applications.filter(a=>a.status==='pending') || [];
  const application=pending.find(a=>a.id===selected);
  return <div className="developer-console">
    <header><p>PLATFORM / DEVELOPERS</p><h1>Developer API access</h1><p>Review onboarding, choose company data and issue time-limited access.</p><a href="/brand/developers.html" target="_blank" rel="noreferrer">Open developer documentation ↗</a></header>
    {message && <p role="status" className="api-notice">{message}</p>}
    {secret && <section className="api-secret"><h2>Copy this key now</h2><p>Share securely with the approved contact. Only its hash is stored; closing this view hides the key.</p><code>{secret}</code><button onClick={()=>setSecret('')}>Dismiss secret</button></section>}
    {!data ? <p>Loading requests…</p> : <>
      <section><h2>Create developer access</h2><p>Super Admin can create access directly, or approve a developer's public onboarding request. An API key provides only the selected company data; it is not a staff or Super Admin login.</p><div className="api-actions"><button type="button" disabled={busy} aria-pressed={direct} onClick={()=>{setDirect(true);setCompany('');setScopes([]);setSecret('');}}>Create directly</button><button type="button" disabled={busy} aria-pressed={!direct} onClick={()=>{setDirect(false);setScopes(application?.scopes || []);setSecret('');}}>Review requests ({pending.length})</button></div></section>
      <section><h2>{direct ? 'Direct developer account' : 'Approve an onboarding request'} {!direct && <small>({pending.length} pending)</small>}</h2>
        {!direct && <>
        <label htmlFor="api-request">Application</label><SearchableSelect id="api-request" value={selected} onChange={e=>{setSelected(e.target.value);setScopes(pending.find(a=>a.id===e.target.value)?.scopes || []);}}><option value="">Select a pending request</option>{pending.map(a=><option key={a.id} value={a.id}>{a.organization} · {a.email}</option>)}</SearchableSelect>
        {application && <div className="api-notice"><strong>{application.name} · {application.organization}</strong><p>{application.email}</p><p>{application.purpose}</p><p>Requested: {application.requestedDays} days · {application.scopes.join(', ')}</p><small>{application.id}</small></div>}</>}
        {(direct || application) && <form onSubmit={e=>{e.preventDefault();act(direct ? 'grants' : `applications/${selected}/approve`,{...(direct ? contact : {}),companyId,days:Number(days),requestsPerMinute:Number(rate),scopes});}}>
          {direct && <><p>No public application is required. Enter the authorized recipient and choose explicit access limits below.</p><div className="api-fields">{[['name','Developer name'],['email','Contact email'],['organization','Organization'],['purpose','Integration purpose']].map(([key,label])=><label key={key}>{label}<input required type={key==='email'?'email':'text'} minLength="2" maxLength={key==='name'?120:key==='email'?254:key==='organization'?160:2000} value={contact[key]} onChange={e=>setContact({...contact,[key]:e.target.value})}/></label>)}</div><button type="button" onClick={()=>{setContact({name:'Test developer',email:'developer@example.test',organization:'API test integration',purpose:'Verify scoped API access with dummy company data'});setDays(1);setRate(10);setScopes(['locations:read']);setCompany('');}}>Fill test account details</button><small>Test preset: 1 day, 10 requests/minute, locations only. Select a dummy company before issuing access.</small></>}
          <label htmlFor="api-company">Company boundary</label><SearchableSelect id="api-company" required value={companyId} onChange={e=>setCompany(e.target.value)}><option value="">Choose company</option>{data.companies.filter(c=>c.isActive).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</SearchableSelect>
          <div className="api-fields"><label>Access duration (days)<input type="number" min="1" max="365" required value={days} onChange={e=>setDays(e.target.value)}/></label><label>Requests per minute<input type="number" min="1" max="600" required value={rate} onChange={e=>setRate(e.target.value)}/></label></div>
          <fieldset><legend>Allowed data · read access</legend>{data.scopes.map(s=><label key={s}><input type="checkbox" checked={scopes.includes(s)} onChange={e=>setScopes(e.target.checked?[...scopes,s]:scopes.filter(v=>v!==s))}/>{s}</label>)}</fieldset>
          <div className="api-actions"><button disabled={busy || !scopes.length}>{busy ? 'Saving…' : direct ? 'Create access & generate key' : 'Approve & generate key'}</button>{!direct && <button type="button" disabled={busy} onClick={()=>act(`applications/${selected}/reject`)}>Reject request</button>}</div>
        </form>}
        {!direct && !pending.length && <p>No pending requests. Use Create directly above, or ask developers to apply from the public documentation page.</p>}
      </section>
      <section><h2>Issued access <small>({data.grants.length})</small></h2><div className="api-table"><table><thead><tr><th>Developer / company</th><th>Scope & usage</th><th>Validity</th><th>Controls</th></tr></thead><tbody>{data.grants.map(g=><tr key={g.id}><td><strong>{g.organization}</strong><br/>{g.email}<br/>{data.companies.find(c=>c.id===g.companyId)?.name}<br/><small>Key ending {g.keyHint}</small></td><td>{g.scopes.join(', ')}<br/>{g.requestsPerMinute}/min · {g.requestCount || 0} successful requests<br/><small>Last used: {g.lastUsedAt ? new Date(g.lastUsedAt).toLocaleString() : 'Never'}</small></td><td>{g.status==='active' && Date.parse(g.expiresAt)<=Date.now()?'expired':g.status}<br/>{new Date(g.expiresAt).toLocaleString()}</td><td>{g.status==='active' && <div className="api-actions"><button disabled={busy || Date.parse(g.expiresAt)<=Date.now()} onClick={()=>act(`grants/${g.id}/rotate`)}>Rotate key</button><button disabled={busy} onClick={()=>act(`grants/${g.id}/revoke`)}>Revoke access</button></div>}</td></tr>)}</tbody></table>{!data.grants.length && <p>No keys issued.</p>}</div></section>
      <section><h2>Application history</h2>{data.applications.map(a=><p key={a.id}><strong>{a.organization}</strong> · {a.email} · {a.status} · {new Date(a.createdAt).toLocaleDateString()}</p>)}</section>
    </>}
  </div>;
}
