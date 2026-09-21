import { useEffect, useMemo, useState } from 'react';
import { customersApi, branchesApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import { displayLocation } from '../utils/displayLabels';
import { downloadExcel } from '../utils/exportExcel';

const EMPTY_FORM = {
  name: '',
  mobile: '',
  address: '',
  aadhaar: '',
  pan: '',
  branch: '',
};

export default function Customers() {
  const me = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  const isAdmin = me.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [docsFilter, setDocsFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (locationFilter !== 'all') params.branch = locationFilter;
      if (docsFilter !== 'all') params.hasDocs = docsFilter;
      const res = await customersApi.getAll(params);
      setCustomers(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (isAdmin) {
      branchesApi
        .getAll()
        .then((res) => setLocations(res.data || []))
        .catch(() => setLocations([]));
    } else if (me.branch) {
      setLocations([{ name: me.branch }]);
    }
  }, []);

  const locationOptions = useMemo(() => {
    const fromData = [...new Set(customers.map((c) => c.branch).filter(Boolean))];
    const fromApi = locations.map((l) => l.name).filter(Boolean);
    return [...new Set([...fromApi, ...fromData])].sort();
  }, [customers, locations]);

  const openAdd = () => {
    setForm({
      ...EMPTY_FORM,
      branch: isAdmin ? locations[0]?.name || me.branch || '' : me.branch || '',
    });
    setError('');
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await customersApi.create({
        ...form,
        mobile: form.mobile.replace(/\D/g, '').slice(0, 10),
        branch: isAdmin ? form.branch : me.branch,
      });
      setForm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    downloadExcel('customers.xls', {
      headers: ['Name', 'Mobile', 'Address', 'Aadhaar', 'PAN', 'Location', 'GPS Lat', 'GPS Lng'],
      rows: customers.map((c) => [
        c.name,
        c.mobile,
        c.address,
        c.aadhaar,
        c.pan,
        displayLocation(c.branch),
        c.latitude || '',
        c.longitude || '',
      ]),
    });
  };

  if (loading && !customers.length) return <PageLoader label="Loading customers..." />;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Approved / listed customers — filter, add, and export."
      >
        <button type="button" className="btn btn-outline btn-sm" onClick={download}>
          Download Excel
        </button>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          + Add customer
        </button>
      </PageHeader>

      <div className="att-filters card">
        <div className="att-filters__grid">
          <div className="form-group">
            <label htmlFor="cust-search">Search</label>
            <input
              id="cust-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, mobile, Aadhaar, PAN…"
            />
          </div>
          <div className="form-group">
            <label htmlFor="cust-loc">Location</label>
            <select
              id="cust-loc"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="all">All locations</option>
              {locationOptions.map((name) => (
                <option key={name} value={name}>
                  {displayLocation(name)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="cust-docs">Documents</label>
            <select
              id="cust-docs"
              value={docsFilter}
              onChange={(e) => setDocsFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="yes">With documents</option>
              <option value="no">Without documents</option>
            </select>
          </div>
          <div className="att-filters__actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearch('');
                setLocationFilter('all');
                setDocsFilter('all');
                setTimeout(() => load(), 0);
              }}
            >
              Clear
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={load}>
              Apply filters
            </button>
          </div>
        </div>
      </div>

      {error && !form && <div className="alert alert--error">{error}</div>}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Address</th>
                <th>Aadhaar</th>
                <th>PAN</th>
                <th>Location</th>
                <th>GPS</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.mobile}</td>
                  <td>{c.address || '—'}</td>
                  <td>{c.aadhaar || '—'}</td>
                  <td>{c.pan || '—'}</td>
                  <td>{displayLocation(c.branch)}</td>
                  <td style={{ fontSize: 12 }}>
                    {c.latitude ? `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude || 0).toFixed(4)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!customers.length && (
          <div className="empty-state">
            <p>No customers match filters</p>
          </div>
        )}
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="card modal-card">
            <h3>Add customer</h3>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Full name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Mobile</label>
                <input
                  required
                  inputMode="numeric"
                  maxLength={10}
                  value={form.mobile}
                  onChange={(e) =>
                    setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })
                  }
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Aadhaar</label>
                  <input
                    value={form.aadhaar}
                    onChange={(e) => setForm({ ...form, aadhaar: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>PAN</label>
                  <input
                    value={form.pan}
                    onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
              {isAdmin && (
                <div className="form-group">
                  <label>Location</label>
                  <select
                    required
                    value={form.branch}
                    onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  >
                    <option value="">Select location</option>
                    {locationOptions.map((name) => (
                      <option key={name} value={name}>
                        {displayLocation(name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!isAdmin && (
                <p className="field-hint">Location: {displayLocation(me.branch)}</p>
              )}
              {error && <div className="alert alert--error">{error}</div>}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save customer'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
