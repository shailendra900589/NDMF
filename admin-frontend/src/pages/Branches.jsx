import { canPerformStored } from '../utils/permissions';
import { useEffect, useState } from 'react';
import { branchesApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import OfficeLocationPicker from '../components/OfficeLocationPicker';
import { displayLocation } from '../utils/displayLabels';

const DEFAULT_RADIUS = 100;

function toForm(b = {}) {
  return {
    id: b.id || null,
    name: b.name || '',
    city: b.city || '',
    state: b.state || '',
    address: b.address || '',
    officeLat: b.officeLat ?? null,
    officeLng: b.officeLng ?? null,
    attendanceRadiusM: b.attendanceRadiusM ?? DEFAULT_RADIUS,
  };
}

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[deleting,setDeleting]=useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    branchesApi
      .getAll()
      .then((res) => setBranches(res.data || []))
      .catch(err=>setError(err.response?.data?.message || err.message || 'Unable to load branches'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if(!form.name.trim()){setError('Branch name is required');return;}
    const radius = Number(form.attendanceRadiusM);
    if (!Number.isFinite(radius) || radius < 20 || radius > 5000) {
      setError('Radius must be between 20 and 5000 metres');
      return;
    }
    const payload = {
      name:form.name.trim(),
      city: form.city,
      state: form.state,
      address: form.address,
      officeLat: form.officeLat,
      officeLng: form.officeLng,
      attendanceRadiusM: radius,
    };
    setSaving(true);
    setError('');
    try {
      if (form.id) await branchesApi.update(form.id, payload);
      else await branchesApi.create({ ...payload, name: form.name });
      setForm(null);
      setMessage('Branch saved successfully.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to save branch');
    } finally {
      setSaving(false);
    }
  };

  async function removeBranch(){
    setSaving(true);setError('');
    try{await branchesApi.remove(deleting.id);setDeleting(null);setMessage('Branch deleted successfully.');load();}
    catch(err){setError(err.response?.data?.message || err.message || 'Unable to delete branch');}
    finally{setSaving(false);}
  }
  if (loading) return <PageLoader label="Loading branches..." />;

  const field = (key, label) => (
    <div className="form-group">
      <label htmlFor={`branch-${key}`}>{label}</label>
      <input id={`branch-${key}`} maxLength={key==='name'?160:undefined} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Branch Management"
        description="Offices and their attendance area. Office staff can check in only inside the radius; field staff are not limited."
      >
        <button hidden={!canPerformStored('branches', 'create')} type="button" className="btn btn-primary" onClick={() => setForm(toForm())}>
          + Add branch
        </button>
      </PageHeader>
      {message && <p role="status" className="success-msg">{message}</p>}
      {error && !form && !deleting && <p role="alert" className="error-msg">{error} <button type="button" className="btn btn-outline btn-sm" onClick={load}>Retry</button></p>}
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Actions</th>
              <th>Code</th>
              <th>City</th>
              <th>State</th>
              <th>Office GPS</th>
              <th>Attendance radius</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => {
              const hasGps = b.officeLat != null && b.officeLng != null;
              return (
                <tr key={b.id}>
                  <td>{displayLocation(b.name)}</td>
                  <td><div className="branch-actions">
                    <button hidden={!canPerformStored('branches', 'update')} type="button" className="btn btn-outline btn-sm" aria-label={`Edit ${b.name}`} onClick={()=>{setError('');setForm(toForm(b));}}>Edit branch</button>
                    <button hidden={!canPerformStored('branches', 'delete')} type="button" className="btn btn-outline btn-sm" aria-label={`Delete ${b.name}`} onClick={()=>{setError('');setDeleting(b);}}>Delete</button>
                  </div></td>
                  <td>{b.code}</td>
                  <td>{b.city}</td>
                  <td>{b.state}</td>
                  <td>
                    {hasGps ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${b.officeLat},${b.officeLng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {Number(b.officeLat).toFixed(5)}, {Number(b.officeLng).toFixed(5)}
                      </a>
                    ) : (
                      <span style={{ color: '#b45309', fontWeight: 600 }}>Not set</span>
                    )}
                  </td>
                  <td>{hasGps ? `${b.attendanceRadiusM || DEFAULT_RADIUS} m` : '—'}</td>
                  <td>{b.isActive === false ? 'Inactive' : 'Active'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!branches.length && !error && <p className="muted">No branches yet. Add your first branch to get started.</p>}
        </div>
      </div>
      {form && (
        <div className="modal-backdrop">
          <div className="card" role="dialog" aria-modal="true" aria-labelledby="branch-form-title" style={{ width: 'min(640px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 id="branch-form-title">{form.id ? 'Edit branch' : 'New branch'}</h3>
            {error && <p role="alert" className="error-msg">{error}</p>}
            {field('name', 'Branch name')}
            {form.id && <p className="muted">Renaming updates linked employees and records in this company. Branch code stays unchanged.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {field('city', 'City')}
              {field('state', 'State')}
            </div>
            {field('address', 'Address')}

            <h4 style={{ margin: '8px 0 4px' }}>Office attendance area</h4>
            <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>
              Employees marked as <strong>Office</strong> in Users can check in only inside this circle.
            </p>
            <OfficeLocationPicker
              lat={form.officeLat}
              lng={form.officeLng}
              radius={Number(form.attendanceRadiusM) || DEFAULT_RADIUS}
              onChange={({ lat, lng }) =>
                setForm((f) => ({ ...f, officeLat: Math.round(lat * 1e7) / 1e7, officeLng: Math.round(lng * 1e7) / 1e7 }))
              }
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
              <div className="form-group">
                <label>Latitude</label>
                <input
                  value={form.officeLat ?? ''}
                  onChange={(e) => setForm({ ...form, officeLat: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input
                  value={form.officeLng ?? ''}
                  onChange={(e) => setForm({ ...form, officeLng: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>Radius (metres)</label>
                <input
                  type="number"
                  min={20}
                  max={5000}
                  step={10}
                  value={form.attendanceRadiusM}
                  onChange={(e) => setForm({ ...form, attendanceRadiusM: e.target.value })}
                />
              </div>
            </div>
            {form.officeLat != null && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setForm({ ...form, officeLat: null, officeLng: null })}
              >
                Clear office GPS
              </button>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : form.id ? 'Save' : 'Create'}
              </button>
              <button type="button" className="btn btn-outline" disabled={saving} onClick={() => {setForm(null);setError('');}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {deleting && <div className="modal-backdrop"><div className="card" role="dialog" aria-modal="true" aria-labelledby="branch-delete-title" style={{width:'min(480px,94vw)'}}>
        <h3 id="branch-delete-title">Delete branch?</h3><p>Delete <strong>{deleting.name}</strong>? Only branches without linked employees or records can be deleted. This cannot be undone.</p>
        {error && <p role="alert" className="error-msg">{error}</p>}
        <div className="branch-actions"><button type="button" className="btn btn-primary" disabled={saving} onClick={removeBranch}>{saving?'Deleting…':'Delete branch'}</button><button type="button" className="btn btn-outline" disabled={saving} onClick={()=>{setDeleting(null);setError('');}}>Cancel</button></div>
      </div></div>}
    </div>
  );
}
