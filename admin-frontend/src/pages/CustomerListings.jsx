import SearchableSelect from '../components/SearchableSelect';
import { canPerformStored } from '../utils/permissions';
import { useEffect, useMemo, useState } from 'react';
import { callLogsApi, listingsApi, uploadMedia } from '../api/api';
import StatusBadge from '../components/StatusBadge';
import VerificationDetails from '../components/VerificationDetails';

import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import { displayLocation } from '../utils/displayLabels';
import { downloadExcel } from '../utils/exportExcel';
import { LISTING_STATUS } from '../utils/constants';

const PHOTO_FIELDS = [
  ['customerPhoto', 'Customer photo'],
  ['aadhaarFront', 'Aadhaar front'],
  ['aadhaarBack', 'Aadhaar back'],
  ['panFront', 'PAN front'],
  ['shopPhoto1', 'Shop live photo 1'],
  ['shopPhoto2', 'Shop live photo 2'],
  ['shopPhoto3', 'Shop live photo 3'],
  ['shopPhoto4', 'Shop live photo 4'],
];

const EMPTY_NEIGHBORS = () => [
  { shopName: '', remarks: '', voice: null },
  { shopName: '', remarks: '', voice: null },
  { shopName: '', remarks: '', voice: null },
];

const EMPTY_FORM = {
  name: '',
  mobile: '',
  aadhaar: '',
  pan: '',
  shopFullAddress: '',
  shopLatitude: '',
  shopLongitude: '',
  photos: Object.fromEntries(PHOTO_FIELDS.map(([key]) => [key, null])),
  neighbors: EMPTY_NEIGHBORS(),
};

async function stampPhoto(file, lat, lng) {
  const bitmap = await createImageBitmap(file);
  const bar = 72;
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height + bar;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, bitmap.height, canvas.width, bar);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Lat ${Number(lat).toFixed(6)}   Lng ${Number(lng).toFixed(6)}`, 12, bitmap.height + 28);
  ctx.fillText(new Date().toLocaleString(), 12, bitmap.height + 54);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

export default function CustomerListings() {
  const me = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  const canApprove = (me.role === 'admin' || me.role === 'branchManager') && canPerformStored('customerListings', 'approve');

  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [calls, setCalls] = useState([]);
  const [callsError,setCallsError]=useState('');
  const [detailLoading,setDetailLoading]=useState(false);
  const [detailError,setDetailError]=useState('');
  const [detailAttempt,setDetailAttempt]=useState(0);
  useEffect(()=>{
    if(!selected?.id)return;
    let active=true;setDetailLoading(true);setDetailError('');
    listingsApi.getById(selected.id).then(res=>{if(active)setSelected(res.data);}).catch(err=>{if(active)setDetailError(err.message || 'Unable to load full application');}).finally(()=>{if(active)setDetailLoading(false);});
    return()=>{active=false;};
  },[selected?.id,detailAttempt]);

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

  useEffect(() => {
    if (!selected?.mobile) {
      setCalls([]);
      return;
    }
    let active=true;setCalls([]);setCallsError('');
    const digits = String(selected.mobile).replace(/\D/g, '').slice(-10);
    callLogsApi
      .getAll()
      .then((res) => {
        const rows = (res.data || []).filter(
          (row) => String(row.mobile || '').replace(/\D/g, '').slice(-10) === digits
        );
        if(active)setCalls(rows);
      })
      .catch(() => {if(active)setCallsError('Call history could not load. Reopen the details to retry.');});
    return()=>{active=false;};
  }, [selected?.id,selected?.mobile]);

  const filtered = useMemo(() => {
    let list = listings.filter(l=>l.status!=='listed');
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

  const captureGps = () => {
    if (!navigator.geolocation) {
      setError('This browser cannot read live GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((current) =>
          current
            ? {
                ...current,
                shopLatitude: String(pos.coords.latitude),
                shopLongitude: String(pos.coords.longitude),
              }
            : current
        );
        setError('');
      },
      () => setError('Allow location so the shop GPS can be saved'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const saveListing = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const lat = Number(form.shopLatitude);
      const lng = Number(form.shopLongitude);
      if (!form.shopFullAddress.trim() || !lat || !lng) {
        throw new Error('Shop full address and live GPS are required');
      }
      const photos = {};
      const capturedAt = new Date().toISOString();
      for (const [key, label] of PHOTO_FIELDS) {
        const file = form.photos[key];
        if (!file) throw new Error(`${label} is required`);
        const stamped = await stampPhoto(file, lat, lng);
        const uploaded = await uploadMedia(stamped, {
          latitude: lat,
          longitude: lng,
          capturedAt,
          type: key,
        });
        photos[key] = {
          filePath: uploaded.fileUrl,
          latitude: lat,
          longitude: lng,
          capturedAt,
          address: form.shopFullAddress.trim(),
        };
      }
      const neighbors = [];
      for (const row of form.neighbors) {
        const shopName = row.shopName.trim();
        const remarks = row.remarks.trim();
        if (!shopName && !remarks && !row.voice) continue;
        let voiceRecordingPath = null;
        if (row.voice) {
          const uploaded = await uploadMedia(row.voice, { type: 'voice' });
          voiceRecordingPath = uploaded.fileUrl;
        }
        neighbors.push({ shopName, remarks, voiceRecordingPath });
      }
      if (neighbors.filter((n) => n.shopName && n.remarks).length < 2) {
        throw new Error('Add at least 2 neighboring shops and what they said');
      }
      await listingsApi.create({
        name: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, '').slice(0, 10),
        aadhaar: form.aadhaar,
        pan: form.pan,
        shopFullAddress: form.shopFullAddress.trim(),
        shopLatitude: lat,
        shopLongitude: lng,
        neighbors,
        ...photos,
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

  const download = async () => {
    await downloadExcel('customer-listings.xlsx', {
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
      title: 'Customer listing report',
      subtitle: `${filtered.length} listing${filtered.length === 1 ? '' : 's'} in the current view`,
      sheetName: 'Listings',
    });
  };

  if (loading && !listings.length) return <PageLoader label="Loading listings..." />;

  return (
    <div>
      <PageHeader
        title="Customer listing"
        description="Pending and rejected applications. Approved customers move to Customers, with photos and verification history retained."
      >
        <button hidden={!canPerformStored('customerListings', 'export')} type="button" className="btn btn-outline btn-sm" onClick={download}>
          Download Excel
        </button>
        <button hidden={!canPerformStored('customerListings', 'create')} type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY_FORM })}>
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
            <SearchableSelect
              id="list-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {Object.entries(LISTING_STATUS).filter(([value])=>value!=='listed').map(([value, label]) => (
                <option key={value} value={value}>
                  {value==='draft'?'Pending rework':label}
                </option>
              ))}
            </SearchableSelect>
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
        <div className="card listing-detail-card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h3>{selected.name} — Details</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canApprove && selected.status === 'branchPending' && (me.role === 'branchManager' || me.role === 'admin') && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={actionLoading}
                    onClick={() => runApproval(selected.id, 'approve')}
                  >
                    Branch approve → Admin
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
                    Admin approve → Listed
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
          {detailLoading ? <p role="status">Loading complete application...</p> : detailError ? <div role="alert"><p className="error-msg">{detailError}</p><button className="btn btn-outline btn-sm" onClick={()=>setDetailAttempt(a=>a+1)}>Retry details</button></div> : <VerificationDetails key={selected.id} data={selected} isListing calls={calls} callsError={callsError} refresh={()=>setDetailAttempt(a=>a+1)}/>}

        </div>
      )}

      {form && (
        <div className="modal-backdrop">
          <div className="card modal-card" style={{ width: 'min(760px, 100%)', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>New customer listing</h3>
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
                <label>Shop full address</label>
                <textarea
                  required
                  rows={3}
                  value={form.shopFullAddress}
                  onChange={(e) => setForm({ ...form, shopFullAddress: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Live shop GPS</label>
                <button type="button" className="btn btn-outline btn-sm" onClick={captureGps}>
                  Capture live location
                </button>
                <p className="field-hint">
                  {form.shopLatitude
                    ? `Saved ${Number(form.shopLatitude).toFixed(6)}, ${Number(form.shopLongitude).toFixed(6)}`
                    : 'Location is saved on the listing so directions open the shop later.'}
                </p>
              </div>
              {PHOTO_FIELDS.map(([key, label]) => (
                <div className="form-group" key={key}>
                  <label>{label}</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    required
                    onChange={(e) =>
                      setForm({
                        ...form,
                        photos: { ...form.photos, [key]: e.target.files?.[0] || null },
                      })
                    }
                  />
                </div>
              ))}
              <h4>Neighbor shops</h4>
              <p className="field-hint">At least two shops: name, what they said, and an optional voice note.</p>
              {form.neighbors.map((row, index) => (
                <div key={index} className="card" style={{ padding: 12, marginBottom: 12 }}>
                  <div className="form-group">
                    <label>Shop {index + 1} name</label>
                    <input
                      value={row.shopName}
                      onChange={(e) => {
                        const neighbors = form.neighbors.map((item, i) =>
                          i === index ? { ...item, shopName: e.target.value } : item
                        );
                        setForm({ ...form, neighbors });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>What they said about the customer</label>
                    <textarea
                      rows={2}
                      value={row.remarks}
                      onChange={(e) => {
                        const neighbors = form.neighbors.map((item, i) =>
                          i === index ? { ...item, remarks: e.target.value } : item
                        );
                        setForm({ ...form, neighbors });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Voice note</label>
                    <input
                      type="file"
                      accept="audio/*"
                      capture
                      onChange={(e) => {
                        const neighbors = form.neighbors.map((item, i) =>
                          i === index ? { ...item, voice: e.target.files?.[0] || null } : item
                        );
                        setForm({ ...form, neighbors });
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="field-hint">Submit stays in branch approval. Admin lists the customer only after that.</p>
              {error && <div className="alert alert--error">{error}</div>}
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit for branch approval'}
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
