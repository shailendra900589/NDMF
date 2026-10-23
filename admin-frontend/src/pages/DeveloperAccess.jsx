import { useEffect, useState } from 'react';
import { developerApi } from '../api/api';
import SearchableSelect from '../components/SearchableSelect';
import './DeveloperAccess.css';

export default function DeveloperAccess() {
  const [data,setData]=useState(null), [message,setMessage]=useState(''), [secret,setSecret]=useState(''), [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState(''), [companyId,setCompany]=useState(''), [days,setDays]=useState(30), [rate,setRate]=useState(60), [scopes,setScopes]=useState([]);
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
      <section><h2>Approve an onboarding request <small>({pending.length} pending)</small></h2>
        <label htmlFor="api-request">Application</label><SearchableSelect id="api-request" value={selected} onChange={e=>{setSelected(e.target.value);setScopes(pending.find(a=>a.id===e.target.value)?.scopes || []);}}><option value="">Select a pending request</option>{pending.map(a=><option key={a.id} value={a.id}>{a.organization} · {a.email}</option>)}</SearchableSelect>
        {application && <><div className="api-notice"><strong>{application.name} · {application.organization}</strong><p>{application.email}</p><p>{application.purpose}</p><p>Requested: {application.requestedDays} days · {application.scopes.join(', ')}</p><small>{application.id}</small></div>
        <form onSubmit={e=>{e.preventDefault();act(`applications/${selected}/approve`,{companyId,days:Number(days),requestsPerMinute:Number(rate),scopes});}}>
          <label htmlFor="api-company">Company boundary</label><SearchableSelect id="api-company" required value={companyId} onChange={e=>setCompany(e.target.value)}><option value="">Choose company</option>{data.companies.filter(c=>c.isActive).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</SearchableSelect>
          <div className="api-fields"><label>Access duration (days)<input type="number" min="1" max="365" required value={days} onChange={e=>setDays(e.target.value)}/></label><label>Requests per minute<input type="number" min="1" max="600" required value={rate} onChange={e=>setRate(e.target.value)}/></label></div>
          <fieldset><legend>Allowed data · read access</legend>{data.scopes.map(s=><label key={s}><input type="checkbox" checked={scopes.includes(s)} onChange={e=>setScopes(e.target.checked?[...scopes,s]:scopes.filter(v=>v!==s))}/>{s}</label>)}</fieldset>
          <div className="api-actions"><button disabled={busy || !scopes.length}>Approve & generate key</button><button type="button" disabled={busy} onClick={()=>act(`applications/${selected}/reject`)}>Reject request</button></div>
        </form></>}
        {!pending.length && <p>No pending requests. Developers can apply from the public documentation page.</p>}
      </section>
      <section><h2>Issued access <small>({data.grants.length})</small></h2><div className="api-table"><table><thead><tr><th>Developer / company</th><th>Scope & usage</th><th>Validity</th><th>Controls</th></tr></thead><tbody>{data.grants.map(g=><tr key={g.id}><td><strong>{g.organization}</strong><br/>{g.email}<br/>{data.companies.find(c=>c.id===g.companyId)?.name}<br/><small>Key ending {g.keyHint}</small></td><td>{g.scopes.join(', ')}<br/>{g.requestsPerMinute}/min · {g.requestCount || 0} successful requests<br/><small>Last used: {g.lastUsedAt ? new Date(g.lastUsedAt).toLocaleString() : 'Never'}</small></td><td>{g.status==='active' && Date.parse(g.expiresAt)<=Date.now()?'expired':g.status}<br/>{new Date(g.expiresAt).toLocaleString()}</td><td>{g.status==='active' && <div className="api-actions"><button disabled={busy || Date.parse(g.expiresAt)<=Date.now()} onClick={()=>act(`grants/${g.id}/rotate`)}>Rotate key</button><button disabled={busy} onClick={()=>act(`grants/${g.id}/revoke`)}>Revoke access</button></div>}</td></tr>)}</tbody></table>{!data.grants.length && <p>No keys issued.</p>}</div></section>
      <section><h2>Application history</h2>{data.applications.map(a=><p key={a.id}><strong>{a.organization}</strong> · {a.email} · {a.status} · {new Date(a.createdAt).toLocaleDateString()}</p>)}</section>
    </>}
  </div>;
}
