import { useEffect, useMemo, useState } from 'react';
import { listingsApi } from '../api/api';
import StatusBadge from '../components/StatusBadge';
import RecordingPlayer from '../components/RecordingPlayer';
import { mediaUrl } from '../utils/mediaUrl';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import { displayLocation } from '../utils/displayLabels';
import { downloadExcel } from '../utils/exportExcel';
import { LISTING_STATUS } from '../utils/constants';

const EMPTY_FORM = {
  name: '',
  mobile: '',
  aadhaar: '',
  pan: '',
  shopFullAddress: '',
  shopLatitude: '',
  shopLongitude: '',
};

export default function CustomerListings() {
  const me = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  const canApprove = me.role === 'admin' || me.role === 'branchManager';

  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await listingsApi.getAll(params);
      setListings(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = listings;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          (l.name || '').toLowerCase().includes(q) ||
          (l.mobile || '').includes(q) ||
          (l.shopFullAddress || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((l) => l.status === statusFilter);
    }
    return list;
  }, [listings, search, statusFilter]);

  const saveListing = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await listingsApi.create({
        name: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, '').slice(0, 10),
        aadhaar: form.aadhaar,
        pan: form.pan,
        shopFullAddress: form.shopFullAddress,
        shopLatitude: Number(form.shopLatitude) || 0,
        shopLongitude: Number(form.shopLongitude) || 0,
        neighbors: [],
      });
      setForm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to add listing');
    } finally {
      setSaving(false);
    }
  };

  const runApproval = async (id, action) => {
    setActionLoading(true);
    setError('');
    try {
      await listingsApi.approve({ id, action });
      setSelected(null);
      await load();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const download = () => {
    downloadExcel('customer-listings.xls', {
      headers: ['Name', 'Mobile', 'Shop Address', 'Status', 'Location', 'GPS Lat', 'GPS Lng'],
      rows: filtered.map((l) => [
        l.name,
        l.mobile,
        l.shopFullAddress,
        LISTING_STATUS[l.status] || l.status,
        displayLocation(l.branch),
        l.shopLatitude || '',
        l.shopLongitude || '',
      ]),
    });
  };

  if (loading && !listings.length) return <PageLoader label="Loading listings..." />;

  const photos = selected
    ? [
        ['Customer', selected.customerPhoto],
        ['Aadhaar Front', selected.aadhaarFront],
        ['Aadhaar Back', selected.aadhaarBack],
        ['PAN', selected.panFront],
        ['Shop 1', selected.shopPhoto1],
        ['Shop 2', selected.shopPhoto2],
        ['Shop 3', selected.shopPhoto3],
        ['Shop 4', selected.shopPhoto4],
      ].filter(([, p]) => p)
    : [];

  return (
    <div>
      <PageHeader
        title="Customer listing"
        description="Field submissions — filter, add, approve, and export."
      >
        <button type="button" className="btn btn-outline btn-sm" onClick={download}>
          Download Excel
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY_FORM })}>
          + Add listing
        </button>
      </PageHeader>

      <div className="att-filters card">
        <div className="att-filters__grid">
          <div className="form-group">
            <label htmlFor="list-search">Search</label>
            <input
              id="list-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, mobile or address…"
            />
          </div>
          <div className="form-group">
            <label htmlFor="list-status">Status</label>
            <select
              id="list-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {Object.entries(LISTING_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>&nbsp;</label>
            <div className="field-hint">Showing {filtered.length} of {listings.length}</div>
          </div>
          <div className="att-filters__actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
            >
              Clear
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={load}>
              Refresh
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
                <th>Shop Address</th>
                <th>GPS</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.name}</strong>
                  </td>
                  <td>{l.mobile}</td>
                  <td>{l.shopFullAddress || '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    {l.shopLatitude != null
                      ? `${Number(l.shopLatitude).toFixed(4)}, ${Number(l.shopLongitude || 0).toFixed(4)}`
                      : '—'}
                  </td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setSelected(l)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <p>No listings match filters</p>
          </div>
        )}
      </div>

      {selected && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h3>{selected.name} — Details</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canApprove && selected.status === 'branchPending' && me.role === 'branchManager' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={actionLoading}
                    onClick={() => runApproval(selected.id, 'approve')}
                  >
                    Approve → Admin
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={actionLoading}
                    onClick={() => runApproval(selected.id, 'rework')}
                  >
                    Rework
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={actionLoading}
                    onClick={() => runApproval(selected.id, 'reject')}
                  >
                    Reject
                  </button>
                </>
              )}
              {canApprove && selected.status === 'adminPending' && me.role === 'admin' && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={actionLoading}
                    onClick={() => runApproval(selected.id, 'finalApprove')}
                  >
                    Final approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={actionLoading}
                    onClick={() => runApproval(selected.id, 'finalReject')}
                  >
                    Reject
                  </button>
                </>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
          <p>
            <strong>Mobile:</strong> {selected.mobile}
          </p>
          <p>
            <strong>Aadhaar:</strong> {selected.aadhaar || '—'} | <strong>PAN:</strong> {selected.pan || '—'}
          </p>
          <p>
            <strong>Shop:</strong> {selected.shopFullAddress || '—'}
          </p>
          <p>
            <strong>Location:</strong> {displayLocation(selected.branch)}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
              marginTop: 12,
            }}
          >
            {photos.map(([label, p]) => (
              <div key={label}>
                <p style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>
                <img
                  src={mediaUrl(p)}
                  alt={label}
                  style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                />
              </div>
            ))}
          </div>
          {selected.neighbors?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Neighbor Verifications</h4>
              {selected.neighbors
                .filter((n) => n.shopName)
                .map((n, i) => (
                  <div key={i} className="recording-row">
                    <p>
                      <strong>{n.shopName}</strong> — {n.ownerName} ({n.mobile})
                    </p>
                    {n.voiceRecordingPath && <RecordingPlayer url={n.voiceRecordingPath} compact />}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {form && (
        <div className="modal-backdrop">
          <div className="card modal-card">
            <h3>Add customer listing</h3>
            <form onSubmit={saveListing}>
              <div className="form-group">
                <label>Customer name</label>
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
              <div className="form-group">
                <label>Shop address</label>
                <input
                  value={form.shopFullAddress}
                  onChange={(e) => setForm({ ...form, shopFullAddress: e.target.value })}
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    value={form.shopLatitude}
                    onChange={(e) => setForm({ ...form, shopLatitude: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    value={form.shopLongitude}
                    onChange={(e) => setForm({ ...form, shopLongitude: e.target.value })}
                  />
                </div>
              </div>
              <p className="field-hint">Submitted for manager approval at your location.</p>
              {error && <div className="alert alert--error">{error}</div>}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit listing'}
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
