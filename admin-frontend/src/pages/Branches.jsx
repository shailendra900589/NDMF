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

  const load = () => {
    setLoading(true);
    branchesApi
      .getAll()
      .then((res) => setBranches(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const radius = Number(form.attendanceRadiusM);
    if (!Number.isFinite(radius) || radius < 20 || radius > 5000) {
      alert('Radius must be between 20 and 5000 metres');
      return;
    }
    const payload = {
      city: form.city,
      state: form.state,
      address: form.address,
      officeLat: form.officeLat,
      officeLng: form.officeLng,
      attendanceRadiusM: radius,
    };
    setSaving(true);
    try {
      if (form.id) await branchesApi.update(form.id, payload);
      else await branchesApi.create({ ...payload, name: form.name });
      setForm(null);
      load();
    } catch (err) {
      alert(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="Loading locations..." />;

  const field = (key, label) => (
    <div className="form-group">
      <label>{label}</label>
      <input value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Offices and their attendance area. Office staff can check in only inside the radius; field staff are not limited."
      >
        <button hidden={!canPerformStored('branches', 'create')} type="button" className="btn btn-primary" onClick={() => setForm(toForm())}>
          + Add location
        </button>
      </PageHeader>
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>City</th>
              <th>State</th>
              <th>Office GPS</th>
              <th>Attendance radius</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => {
              const hasGps = b.officeLat != null && b.officeLng != null;
              return (
                <tr key={b.id}>
                  <td>{displayLocation(b.name)}</td>
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
                  <td>
                    <button hidden={!canPerformStored('branches', 'update')} type="button" className="btn btn-outline btn-sm" onClick={() => setForm(toForm(b))}>
                      {hasGps ? 'Edit' : 'Set office GPS'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      {form && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: 'min(640px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3>{form.id ? `Edit ${form.name}` : 'New location'}</h3>
            {!form.id && field('name', 'Name')}
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
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
