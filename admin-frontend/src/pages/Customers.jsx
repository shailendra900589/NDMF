import { useEffect, useState } from 'react';
import { customersApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    customersApi.getAll(search ? { search } : {})
      .then((res) => setCustomers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <PageLoader label="Loading customers..." />;

  return (
    <div>
      <PageHeader title="Customers" description="Listed customers after approval — scoped to your location." />
      <div className="search-bar">
        <input
          placeholder="Search by name or mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={load}>Search</button>
      </div>
      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Mobile</th><th>Address</th><th>Aadhaar</th><th>PAN</th><th>Location</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.mobile}</td>
                <td>{c.address}</td>
                <td>{c.aadhaar}</td>
                <td>{c.pan}</td>
                <td style={{ fontSize: 12 }}>
                  {c.latitude ? `${c.latitude.toFixed(4)}, ${c.longitude?.toFixed(4)}` : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!customers.length && <div className="empty-state"><p>No listed customers yet</p></div>}
      </div>
    </div>
  );
}
