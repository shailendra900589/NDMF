import SearchableSelect from '../components/SearchableSelect';
import { canPerformStored } from '../utils/permissions';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersApi, branchesApi } from '../api/api';
import { PERMISSION_LABELS } from '../utils/permissions';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import { displayLocation, displayRole } from '../utils/displayLabels';

function attendanceLabel(u) {
  if (u.role === 'admin') return '—';
  if (u.workType !== 'office') return 'Field';
  return u.attendanceRadiusM ? `Office · ${u.attendanceRadiusM} m` : 'Office · office radius';
}

const ROLE_LABELS = {
  fieldOfficer: 'Employee',
  branchManager: 'Manager',
  admin: 'Admin',
};

export default function Users() {
  let me = {};
  try {
    const parsed = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
    me = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    me = {};
  }
  const isAdmin = me.role === 'admin';

  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [schema, setSchema] = useState({ keys: [], roleDefaults: {}, canCreateRoles: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [u, s] = await Promise.all([usersApi.getAll(), usersApi.getPermissionSchema()]);
      setUsers(u.data || []);
      setSchema(s.data || { keys: [], roleDefaults: {}, canCreateRoles: ['fieldOfficer'] });
      try {
        const b = await branchesApi.getAll();
        const list = b.data || [];
        setBranches(isAdmin || list.length ? list : me.branch ? [{ name: me.branch }] : []);
      } catch {
        setBranches(me.branch ? [{ name: me.branch }] : []);
      }
    } catch (e) {
      setLoadError(e.message || 'Could not load users');
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

  const roleOptionsForForm = form
    ? [...new Set([form.role, ...creatableRoles].filter(Boolean))]
    : creatableRoles;

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
      workType: 'field',
      attendanceRadiusM: '',
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
      permissions: { ...(user.permissions || {}) },
      isActive: user.isActive !== false,
      faceEnrollmentComplete: !!user.faceEnrollmentComplete,
      workType: user.workType === 'office' ? 'office' : 'field',
      attendanceRadiusM: user.attendanceRadiusM ?? '',
    });
  };

  const attendancePayload = () => {
    const radius = form.attendanceRadiusM === '' || form.attendanceRadiusM == null ? null : Number(form.attendanceRadiusM);
    return { workType: form.workType, attendanceRadiusM: form.workType === 'office' ? radius : null };
  };

  const resetFace = async () => {
    if (!window.confirm('Reset this employee’s registered face? They must capture 3 new selfies before attendance.')) return;
    try {
      await usersApi.resetFace(editId);
      setForm((f) => ({ ...f, faceEnrollmentComplete: false }));
      load();
    } catch (err) {
      alert(err.message || 'Reset failed');
    }
  };

  const save = async () => {
    try {
      if (editId) {
        await usersApi.update(editId, {
          name: form.name,
          role: form.role,
          ...(isAdmin ? { branch: form.branch } : {}),
          permissions: form.permissions,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
          ...attendancePayload(),
        });
      } else {
        const { faceEnrollmentComplete, ...rest } = form;
        await usersApi.create({ ...rest, ...attendancePayload() });
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
            ? 'Manage company employees, roles and attendance settings. Super Admin controls page and function access.'
            : `Employees in ${displayLocation(me.branch)} only. Update your account in My Profile.`
        }
      >
        <button hidden={!canPerformStored('users', 'create')} type="button" className="btn btn-primary" onClick={openCreate}>
          + Create user &amp; assign role
        </button>
      </PageHeader>

      {loadError && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <p style={{ margin: '0 0 12px', color: '#b91c1c' }}>{loadError}</p>
          <button type="button" className="btn btn-outline" onClick={load}>Retry</button>
        </div>
      )}
      {isAdmin && !loadError && !branches.length && <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <p>Create a company location before adding managers or employees.</p>
        {canPerformStored('branches', 'create') && <Link to="/branches" className="btn btn-outline">Create location</Link>}
      </div>}

      <div className="card">
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Role</th>
              <th>Location</th>
              <th>Attendance</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 24, color: 'var(--color-text-muted)' }}>
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
                <td>{attendanceLabel(u)}</td>
                <td>{u.isActive === false ? 'Disabled' : 'Active'}</td>
                <td>
                  <button hidden={!canPerformStored('users', 'update')} type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>
                    Assign role / access
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
            <h3>{editId ? 'Assign role & permissions' : 'Create user & assign role'}</h3>
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {!editId && (
              <>
                <div className="form-group">
                  <label>Mobile number</label>
                  <input value={form.mobile} maxLength={10} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div className="form-group">
                  <label>Employee ID (Login ID)</label>
                  <input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <SearchableSelect
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
                    {roleOptionsForForm.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div className="form-group">
                  <label>Initial password</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </>
            )}
            {editId && (
              <>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  Mobile: {form.mobile} • ID {form.employeeId}
                </p>
                <div className="form-group">
                  <label>Assign role</label>
                  <SearchableSelect
                    value={form.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      setForm({
                        ...form,
                        role,
                        permissions: { ...(schema.roleDefaults?.[role] || form.permissions) },
                      });
                    }}
                  >
                    {roleOptionsForForm.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div className="form-group">
                  <label>Attendance face</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: form.faceEnrollmentComplete ? '#047857' : '#6b7280' }}>
                      {form.faceEnrollmentComplete ? 'Registered' : 'Not registered'}
                    </span>
                    {form.faceEnrollmentComplete && (
                      <button hidden={!canPerformStored('users', 'delete')} type="button" className="btn btn-outline btn-sm" onClick={resetFace}>
                        Reset face
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="form-group">
              <label>Location</label>
              <SearchableSelect
                value={form.branch || ''}
                disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              >
                <option value="">{form.role === 'admin' ? 'All company locations' : 'Choose a location'}</option>
                {branches.map((b) => (
                  <option key={b.id || b.name} value={b.name}>{b.name}</option>
                ))}
              </SearchableSelect>
            </div>
            {form.role !== 'admin' && (
              <div className="form-group">
                <label>Attendance type</label>
                <div className="choice-row">
                  <label>
                    <input
                      type="radio"
                      name="workType"
                      checked={form.workType === 'office'}
                      onChange={() => setForm({ ...form, workType: 'office' })}
                    />
                    Office — check-in only inside office radius
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="workType"
                      checked={form.workType !== 'office'}
                      onChange={() => setForm({ ...form, workType: 'field' })}
                    />
                    Field — check-in from anywhere
                  </label>
                </div>
                {form.workType === 'office' && (() => {
                  const office = branches.find((b) => b.name === form.branch);
                  const hasGps = office?.officeLat != null && office?.officeLng != null;
                  return (
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="number"
                        min={20}
                        max={5000}
                        step={10}
                        placeholder={`Office default (${office?.attendanceRadiusM || 100} m)`}
                        value={form.attendanceRadiusM}
                        onChange={(e) => setForm({ ...form, attendanceRadiusM: e.target.value })}
                      />
                      <p style={{ fontSize: 12, margin: '4px 0 0', color: hasGps ? '#64748b' : '#b45309' }}>
                        {hasGps
                          ? 'Allowed radius in metres for this employee. Leave empty to use the office default.'
                          : `Office GPS for ${form.branch || 'this location'} is not set yet — this employee cannot check in until admin sets it under Locations.`}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
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
            <h4 style={{ marginTop: 12 }}>Page & function access</h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Access policies are managed centrally by Super Admin.</p>
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
