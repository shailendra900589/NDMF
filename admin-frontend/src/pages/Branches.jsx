import { useEffect, useState } from 'react';
import { branchesApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import { displayLocation } from '../utils/displayLabels';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

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
    try {
      await branchesApi.create(form);
      setForm(null);
      load();
    } catch (err) {
      alert(err.message || 'Failed');
    }
  };

  if (loading) return <PageLoader label="Loading locations..." />;

  return (
    <div>
      <PageHeader title="Locations" description="Organization locations — admin can add and manage offices.">
        <button type="button" className="btn btn-primary" onClick={() => setForm({ name: '', city: '', state: '', address: '' })}>
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
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td>{displayLocation(b.name)}</td>
                <td>{b.code}</td>
                <td>{b.city}</td>
                <td>{b.state}</td>
                <td>{b.isActive === false ? 'Inactive' : 'Active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      {form && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: 400 }}>
            <h3>New location</h3>
            {['name', 'city', 'state', 'address'].map((field) => (
              <div key={field} className="form-group">
                <label>{field}</label>
                <input value={form[field] || ''} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}
            <button type="button" className="btn btn-primary" onClick={save}>Create</button>
            <button type="button" className="btn btn-outline" style={{ marginLeft: 8 }} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
