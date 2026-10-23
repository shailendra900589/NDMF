import SearchableSelect from '../components/SearchableSelect';
import { useEffect, useState } from 'react';
import { platformApi } from '../api/api';
import './SuperAdmin.css';

const emptyCompany = { name: '', code: '', email: '', adminName: '', adminEmail: '', adminPassword: '', adminMobile: '' };
const roleLabels = { admin: 'Company administrator', branchManager: 'Manager', fieldOfficer: 'Employee' };
function AccessMatrix({ modules, actions, moduleActions, value = {}, limits, onChange }) {
  return <div className="sa-matrix-wrap"><table className="sa-matrix"><thead><tr><th>Page / module</th><th>Access</th>{Object.entries(actions).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
    <tbody>{Object.entries(modules).map(([key, label]) => {
      const enabled = value.modules?.[key] !== false;
      const blocked = limits?.modules?.[key] === false;
      return <tr key={key}><td><strong>{label}</strong>{blocked && <small>Disabled for company</small>}</td>
        <td><input aria-label={`${label} page access`} type="checkbox" checked={enabled && !blocked} disabled={blocked} onChange={e => onChange({ ...value, modules: { ...value.modules, [key]: e.target.checked } })} /></td>
        {Object.keys(actions).map(a => <td key={a}>{moduleActions?.[key] && !moduleActions[key].includes(a) ? <span aria-label="Not applicable">—</span> : <input aria-label={`${label}: ${actions[a]}`} type="checkbox" disabled={!enabled || blocked || limits?.actions?.[key]?.[a] === false}
          checked={!blocked && enabled && limits?.actions?.[key]?.[a] !== false && value.actions?.[key]?.[a] !== false}
          onChange={e => onChange({ ...value, actions: { ...value.actions, [key]: { ...value.actions?.[key], [a]: e.target.checked } } })} />}</td>)}</tr>;
    })}</tbody></table></div>;
}
export default function SuperAdmin() {
  const [data, setData] = useState({ companies: [], modules: {}, actions: {}, audit: [], roleDefaults: {} });
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState({ users: [], branches: [] });
  const [draft, setDraft] = useState(null);
  const [create, setCreate] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [tab, setTab] = useState('access');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  async function load(id = selectedId) {
    const result = (await platformApi.overview()).data;
    setData(result);
    const selected = result.companies.find(c => c.id === id) || result.companies[0];
    if (selected) {
      setSelectedId(selected.id); setDraft(structuredClone(selected));
      setDetail((await platformApi.users(selected.id)).data);
    }
  }
  useEffect(() => { load().catch(e => setMessage({ error: true, text: e.message })).finally(() => setLoading(false)); }, []);
  async function choose(c) {
    if (busy) return;
    setSelectedId(c.id); setDraft(structuredClone(c)); setEmployee(null); setMessage(null); setDetail({ users: [], branches: [] });
    setBusy(true);
    try { setDetail((await platformApi.users(c.id)).data); } catch(e) { setMessage({ error: true, text: e.message }); } finally { setBusy(false); }
  }
  async function perform(action, text, after) {
    setBusy(true); setMessage(null);
    try { const result = await action(); await load(result?.data?.id?.startsWith('CO_') ? result.data.id : selectedId); after?.(); setMessage({ text }); }
    catch(e) { setMessage({ error: true, text: e.message || 'Unable to save changes' }); }
    finally { setBusy(false); }
  }
  const counts = { companies: data.companies.length, active: data.companies.filter(c => c.isActive).length,
    employees: data.companies.reduce((s,c) => s + c.employeeCount, 0), branches: data.companies.reduce((s,c) => s + c.branchCount, 0) };
  if (loading) return <div className="sa-loading">Loading your company portfolio…</div>;
  return <div className="sa">
    <header className="sa-hero"><div><span className="sa-eyebrow">PLATFORM CONTROL</span><h1>Your companies.<br /><span>One command centre.</span></h1><p>Manage organisations, people and access from a single secure workspace.</p></div>
      <button className="btn btn-primary" disabled={busy} onClick={() => { setCreate({ ...emptyCompany }); setMessage(null); }}>+ Add company</button></header>
    {message && <div role={message.error ? 'alert' : 'status'} className={`sa-notice ${message.error ? 'sa-notice--error' : ''}`}>{message.text}</div>}
    <div className="sa-stats">{[['Companies', counts.companies], ['Active companies', counts.active], ['Team members', counts.employees], ['Branches', counts.branches]].map(([label, number]) => <div key={label}><span>{label}</span><strong>{number}</strong></div>)}</div>
    <div className="sa-workspace"><aside className="sa-companies"><div className="sa-panel-heading"><h2>Company portfolio</h2><span>{counts.companies}</span></div>
      <input aria-label="Search companies" placeholder="Search name or code…" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="sa-company-list">{data.companies.filter(c => `${c.name} ${c.code}`.toLowerCase().includes(search.toLowerCase())).map(c => <button disabled={busy} className={`sa-company ${c.id === selectedId ? 'is-selected' : ''}`} key={c.id} onClick={() => choose(c)}>
        <div className="sa-company-monogram">{c.code.slice(0,2)}</div><div><strong>{c.name}</strong><small>{c.code} · {c.employeeCount} people</small><span className={`sa-status ${c.isActive ? '' : 'is-paused'}`}>{c.isActive ? 'Active' : 'Suspended'}</span></div></button>)}</div>
    </aside>
    {draft && <section className="sa-detail"><div className="sa-detail-title"><div><span className="sa-eyebrow">{draft.code}</span><h2>{draft.name}</h2><p>Access changes apply to existing sessions on their next API request.</p></div><span className={`sa-status ${draft.isActive ? '' : 'is-paused'}`}>{draft.isActive ? 'Active company' : 'Suspended company'}</span></div>
      <div className="sa-tabs">{[['access','Pages & functions'],['people','People'],['settings','Company settings'],['activity','Activity']].map(([id,label]) => <button disabled={busy} key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
      {tab === 'access' && <><div className="sa-section-intro"><h3>Company access policy</h3><p>Choose available pages and actions. These limits apply to every administrator, manager and employee in this company.</p></div>
        <AccessMatrix modules={data.modules} actions={data.actions} moduleActions={data.moduleActions} value={draft} onChange={setDraft} />
        <div className="sa-save"><span>Employee access can be restricted further in People.</span><button disabled={busy} className="btn btn-primary" onClick={() => perform(() => platformApi.updateCompany(draft.id, { modules: draft.modules, actions: draft.actions }), 'Company access policy saved')}>{busy ? 'Saving…' : 'Save access policy'}</button></div></>}
      {tab === 'people' && <><div className="sa-section-intro sa-people-heading"><div><h3>Company people</h3><p>Control individual pages, functions and account status.</p></div><button disabled={busy} className="btn btn-primary" onClick={() => setEmployee({ name:'', employeeId:'', email:'', mobile:'', password:'', role:'admin', branch:'', isActive:true, permissions:data.roleDefaults.admin, actions:{} })}>+ Add user</button></div>
        <input aria-label="Search company users" className="sa-user-search" placeholder="Search people by name or login…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
        <div className="sa-matrix-wrap"><table className="sa-matrix"><thead><tr><th>Person</th><th>Role / location</th><th>Status</th><th>Access</th></tr></thead><tbody>{detail.users.filter(u => `${u.name} ${u.employeeId}`.toLowerCase().includes(userSearch.toLowerCase())).map(u => <tr key={u.id}><td><strong>{u.name}</strong><small>{u.email || u.employeeId}</small></td><td>{roleLabels[u.role]}<small>{u.branch || 'All company locations'}</small></td><td><span className={`sa-status ${u.isActive ? '' : 'is-paused'}`}>{u.isActive ? 'Active' : 'Disabled'}</span></td><td><button disabled={busy} className="btn btn-secondary" onClick={() => setEmployee({ ...structuredClone(u), password:'' })}>Manage</button></td></tr>)}</tbody></table></div>
        {!detail.users.length && <p className="sa-empty">No users in this company.</p>}</>}
      {tab === 'settings' && <form className="sa-settings" onSubmit={e => { e.preventDefault(); perform(() => platformApi.updateCompany(draft.id, { name:draft.name, email:draft.email, isActive:draft.isActive }), 'Company settings saved'); }}>
        <label>Company name<input required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name:e.target.value })} /></label><label>Contact email<input type="email" value={draft.email || ''} onChange={e => setDraft({ ...draft, email:e.target.value })} /></label>
        <div className="sa-suspend"><label><input type="checkbox" checked={draft.isActive} onChange={e => setDraft({ ...draft, isActive:e.target.checked })} /> Company is active</label><p>Suspending a company blocks sign-in and API access for all its users. Company data is retained.</p></div><button disabled={busy} className="btn btn-primary">{busy ? 'Saving…' : 'Save company settings'}</button></form>}
      {tab === 'activity' && <div className="sa-activity">{data.audit.filter(a => a.companyId === selectedId).map(a => <div key={a.id}><span className="sa-activity-dot" /><div><strong>{a.action}</strong><small>{a.actorName} · {new Date(a.createdAt).toLocaleString()}</small></div></div>)}{!data.audit.some(a => a.companyId === selectedId) && <p>No recent changes recorded.</p>}</div>}
    </section>}</div>
    {create && <div className="sa-modal-backdrop"><form role="dialog" aria-modal="true" aria-label="Add a company" className="sa-modal" onSubmit={e => { e.preventDefault(); perform(() => platformApi.createCompany(create), 'Company and administrator created. They can sign in from the same login page.', () => setCreate(null)); }}>
      <div className="sa-panel-heading"><div><span className="sa-eyebrow">NEW ORGANISATION</span><h2>Add a company</h2></div><button type="button" disabled={busy} onClick={() => setCreate(null)} aria-label="Close company form">×</button></div><p>Create its first administrator. Page and function access can be configured immediately afterwards.</p>
      <div className="sa-form-grid">{[['name','Company name','text'],['code','Company code','text'],['email','Company contact email','email'],['adminName','Administrator name','text'],['adminEmail','Administrator login email','email'],['adminMobile','Administrator mobile (optional)','tel'],['adminPassword','Initial administrator password','password']].map(([key,label,type]) => <label key={key}>{label}<input type={type} required={!['email','adminMobile'].includes(key)} minLength={key === 'adminPassword' ? 8 : undefined} autoComplete={key === 'adminPassword' ? 'new-password' : 'off'} value={create[key]} onChange={e => setCreate({ ...create, [key]:e.target.value })} /></label>)}</div>
      {message?.error && <p className="error-msg" role="alert">{message.text}</p>}<div className="sa-save"><span>All pages enabled initially.</span><button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create company'}</button></div></form></div>}
    {employee && <div className="sa-modal-backdrop"><form role="dialog" aria-modal="true" aria-label="Company user access" className="sa-modal sa-modal--wide" onSubmit={e => { e.preventDefault(); const payload = { ...employee, permissions:employee.permissions }; perform(() => employee.id ? platformApi.updateUser(selectedId, employee.id, payload) : platformApi.createUser(selectedId, payload), 'User access saved', () => setEmployee(null)); }}>
      <div className="sa-panel-heading"><div><span className="sa-eyebrow">{draft?.name}</span><h2>{employee.id ? 'Manage user access' : 'Add company user'}</h2></div><button type="button" disabled={busy} onClick={() => setEmployee(null)} aria-label="Close user form">×</button></div>
      <div className="sa-form-grid"><label>Full name<input required value={employee.name} onChange={e => setEmployee({ ...employee, name:e.target.value })} /></label><label>Login ID<input required disabled={!!employee.id} value={employee.employeeId} onChange={e => setEmployee({ ...employee, employeeId:e.target.value })} /></label>
        {!employee.id && <><label>Email (optional)<input type="email" value={employee.email} onChange={e => setEmployee({ ...employee, email:e.target.value })} /></label><label>Mobile (optional)<input value={employee.mobile} onChange={e => setEmployee({ ...employee, mobile:e.target.value })} /></label></>}
        <label>Role<SearchableSelect value={employee.role} onChange={e => setEmployee({ ...employee, role:e.target.value, permissions:data.roleDefaults[e.target.value] })}>{Object.entries(roleLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</SearchableSelect></label>
        <label>Location<SearchableSelect required={employee.role !== 'admin'} value={employee.branch || ''} onChange={e => setEmployee({ ...employee, branch:e.target.value })}><option value="">All locations (administrator)</option>{detail.branches.map(b => <option key={b.id}>{b.name}</option>)}</SearchableSelect></label>
        <label>{employee.id ? 'New password (leave blank to keep)' : 'Password'}<input type="password" required={!employee.id} minLength={8} autoComplete="new-password" value={employee.password} onChange={e => setEmployee({ ...employee, password:e.target.value })} /></label>
        <label className="sa-check"><input type="checkbox" checked={employee.isActive} onChange={e => setEmployee({ ...employee, isActive:e.target.checked })} /> Account is active</label></div>
      <p className="sa-muted">{employee.role !== 'admin' && !detail.branches.length ? 'Create a company location in the company administrator console before adding managers or employees. ' : ''}Company policy is the maximum available access. Disabled company functions cannot be enabled for an individual.</p>
      <AccessMatrix modules={data.modules} actions={data.actions} moduleActions={data.moduleActions} limits={data.companies.find(c => c.id === selectedId)} value={{ modules:employee.permissions, actions:employee.actions }} onChange={v => setEmployee({ ...employee, permissions:v.modules, actions:v.actions })} />
      {message?.error && <p className="error-msg" role="alert">{message.text}</p>}<div className="sa-save"><span>Role rules continue to apply to approvals and administration.</span><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save user'}</button></div></form></div>}
  </div>;
}
