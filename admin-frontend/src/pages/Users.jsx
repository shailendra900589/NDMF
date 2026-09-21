import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersApi, branchesApi } from '../api/api';
import { PERMISSION_LABELS } from '../utils/permissions';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import { displayLocation, displayRole } from '../utils/displayLabels';

const ROLE_LABELS = {
  fieldOfficer: 'Employee',
  branchManager: 'Manager',
  admin: 'Admin',
};

export default function Users() {
  const me = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  const isAdmin = me.role === 'admin';

  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [schema, setSchema] = useState({ keys: [], roleDefaults: {}, canCreateRoles: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([usersApi.getAll(), usersApi.getPermissionSchema()]);
      setUsers(u.data || []);
      setSchema(s.data || { keys: [], roleDefaults: {}, canCreateRoles: ['fieldOfficer'] });
      if (isAdmin) {
        const b = await branchesApi.getAll();
        setBranches(b.data || []);
      } else {
        setBranches(me.branch ? [{ name: me.branch }] : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const creatableRoles = schema.canCreateRoles?.length
    ? schema.canCreateRoles
    : isAdmin
      ? ['fieldOfficer', 'branchManager', 'admin']
      : ['fieldOfficer'];

  const openCreate = () => {
    const role = creatableRoles[0] || 'fieldOfficer';
    setEditId(null);
    setForm({
      name: '',
      mobile: '',
      employeeId: '',
      role,
      branch: isAdmin ? branches[0]?.name || '' : me.branch,
      password: 'ndfa1234',
      permissions: { ...(schema.roleDefaults?.[role] || {}) },
      isActive: true,
    });
  };

  const openEdit = (user) => {
    setEditId(user.id);
    setForm({
      name: user.name,
      mobile: user.mobile,
      employeeId: user.employeeId,
      role: user.role,
      branch: user.branch,
      password: '',
      permissions: { ...user.permissions },
      isActive: user.isActive !== false,
    });
  };

  const save = async () => {
    try {
      if (editId) {
        await usersApi.update(editId, {
          name: form.name,
          ...(isAdmin ? { branch: form.branch } : {}),
          permissions: form.permissions,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await usersApi.create(form);
      }
      setForm(null);
      load();
    } catch (err) {
      alert(err.message || 'Save failed');
    }
  };

  const togglePerm = (key) => {
    setForm((f) => ({
      ...f,
      permissions: { ...f.permissions, [key]: !f.permissions[key] },
    }));
  };

  const permKeys = schema.keys || [];

  if (loading) return <PageLoader label="Loading users..." />;

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Users & Permissions' : 'Team employees'}
        description={
          isAdmin
            ? 'Manage all locations, roles, and module access.'
            : `Employees in ${displayLocation(me.branch)} only. Update your account in My Profile.`
        }
      >
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + {isAdmin ? 'Create user' : 'Add employee'}
        </button>
      </PageHeader>

      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Role</th>
              <th>Location</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, color: '#6b7280' }}>
                  No employees yet. Use &quot;Add employee&quot; to create an Employee.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.mobile}</td>
                <td>{ROLE_LABELS[u.role] || u.role}</td>
                <td>{displayLocation(u.branch)}</td>
                <td>{u.isActive === false ? 'Disabled' : 'Active'}</td>
                <td>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>
                    Edit / Permissions
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: 'min(520px, 94vw)' }}>
            <h3>{editId ? 'Edit employee' : isAdmin ? 'Create user' : 'Add Employee'}</h3>
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {!editId && (
              <>
                <div className="form-group">
                  <label>Mobile (login ID)</label>
                  <input value={form.mobile} maxLength={10} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div className="form-group">
                  <label>Employee ID</label>
                  <input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      setForm({
                        ...form,
                        role,
                        permissions: { ...(schema.roleDefaults?.[role] || {}) },
                      });
                    }}
                  >
                    {creatableRoles.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Initial password</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </>
            )}
            {editId && (
              <p style={{ fontSize: 13, color: '#6b7280' }}>
                Mobile: {form.mobile} • {ROLE_LABELS[form.role]} • ID {form.employeeId}
              </p>
            )}
            <div className="form-group">
              <label>Location</label>
              <select
                value={form.branch}
                disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              >
                {branches.map((b) => (
                  <option key={b.id || b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                {' '}Account active
              </label>
            </div>
            <div className="form-group">
              <label>{editId ? 'New password (optional)' : ''}</label>
              {editId && (
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              )}
            </div>
            <h4 style={{ marginTop: 12 }}>Module access (mobile app / panel)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {permKeys.map((key) => (
                <label key={key} style={{ fontSize: 13 }}>
                  <input type="checkbox" checked={!!form.permissions[key]} onChange={() => togglePerm(key)} />
                  {' '}{PERMISSION_LABELS[key] || key}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-primary" onClick={save}>Save</button>
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
