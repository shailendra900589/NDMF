import { useEffect, useState } from 'react';
import { listingsApi } from '../api/api';
import StatusBadge from '../components/StatusBadge';
import RecordingPlayer from '../components/RecordingPlayer';
import { mediaUrl } from '../utils/mediaUrl';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';

export default function CustomerListings() {
  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listingsApi.getAll()
      .then((res) => setListings(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader label="Loading listings..." />;

  const photos = selected ? [
    ['Customer', selected.customerPhoto],
    ['Aadhaar Front', selected.aadhaarFront],
    ['Aadhaar Back', selected.aadhaarBack],
    ['PAN', selected.panFront],
    ['Shop 1', selected.shopPhoto1],
    ['Shop 2', selected.shopPhoto2],
    ['Shop 3', selected.shopPhoto3],
    ['Shop 4', selected.shopPhoto4],
  ].filter(([, p]) => p) : [];

  return (
    <div>
      <PageHeader title="Customer listing" description="Submissions from field officers — photos, GPS, and approval status." />
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Mobile</th><th>Shop Address</th><th>GPS</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id}>
                <td><strong>{l.name}</strong></td>
                <td>{l.mobile}</td>
                <td>{l.shopFullAddress}</td>
                <td style={{ fontSize: 12 }}>{l.shopLatitude?.toFixed(4)}, {l.shopLongitude?.toFixed(4)}</td>
                <td><StatusBadge status={l.status} /></td>
                <td><button className="btn btn-primary btn-sm" onClick={() => setSelected(l)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!listings.length && <div className="empty-state"><p>No listings yet</p></div>}
      </div>

      {selected && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>{selected.name} — Details</h3>
            <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p><strong>Mobile:</strong> {selected.mobile}</p>
          <p><strong>Aadhaar:</strong> {selected.aadhaar} | <strong>PAN:</strong> {selected.pan}</p>
          <p><strong>Shop:</strong> {selected.shopFullAddress}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginTop: 12 }}>
            {photos.map(([label, p]) => (
              <div key={label}>
                <p style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>
                <img src={mediaUrl(p)} alt={label} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
              </div>
            ))}
          </div>
          {selected.neighbors?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Neighbor Verifications</h4>
              {selected.neighbors.filter((n) => n.shopName).map((n, i) => (
                <div key={i} className="recording-row">
                  <p><strong>{n.shopName}</strong> — {n.ownerName} ({n.mobile})</p>
                  {n.voiceRecordingPath && <RecordingPlayer url={n.voiceRecordingPath} compact />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
