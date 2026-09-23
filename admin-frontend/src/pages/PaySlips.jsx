import { useEffect, useMemo, useRef, useState } from 'react';
import { payslipsApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import PaySlipDocument from '../components/PaySlipDocument';
import {
  amountInWords,
  currentMonthKey,
  formatAmount,
  formatMonthLabel,
  nextMonthKey,
} from '../utils/payslip';

const EMPTY = () => ({
  employeeName: '',
  employeeNo: '',
  designation: '',
  department: '',
  bankName: '',
  accountNo: '',
  companyAddress: '',
  month: currentMonthKey(),
  earnings: { basic: '', hra: '', conveyance: '', medical: '', special: '' },
  deductions: { epf: '', healthInsurance: '', professionalTax: '', tds: '' },
});

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computePreview(form) {
  const earnings = {
    basic: toNum(form.earnings.basic),
    hra: toNum(form.earnings.hra),
    conveyance: toNum(form.earnings.conveyance),
    medical: toNum(form.earnings.medical),
    special: toNum(form.earnings.special),
  };
  const deductions = {
    epf: toNum(form.deductions.epf),
    healthInsurance: toNum(form.deductions.healthInsurance),
    professionalTax: toNum(form.deductions.professionalTax),
    tds: toNum(form.deductions.tds),
  };
  const grossSalary =
    earnings.basic + earnings.hra + earnings.conveyance + earnings.medical + earnings.special;
  const totalDeductions =
    deductions.epf + deductions.healthInsurance + deductions.professionalTax + deductions.tds;
  return {
    ...form,
    companyName: 'Nirmaldhara Micro Foundation',
    earnings,
    deductions,
    grossSalary,
    totalDeductions,
    netPay: grossSalary - totalDeductions,
  };
}

function slipToForm(slip) {
  return {
    employeeName: slip.employeeName || '',
    employeeNo: slip.employeeNo || '',
    designation: slip.designation || '',
    department: slip.department || '',
    bankName: slip.bankName || '',
    accountNo: slip.accountNo || '',
    companyAddress: slip.companyAddress || '',
    month: slip.month || currentMonthKey(),
    earnings: {
      basic: slip.earnings?.basic ?? '',
      hra: slip.earnings?.hra ?? '',
      conveyance: slip.earnings?.conveyance ?? '',
      medical: slip.earnings?.medical ?? '',
      special: slip.earnings?.special ?? '',
    },
    deductions: {
      epf: slip.deductions?.epf ?? '',
      healthInsurance: slip.deductions?.healthInsurance ?? '',
      professionalTax: slip.deductions?.professionalTax ?? '',
      tds: slip.deductions?.tds ?? '',
    },
  };
}

async function downloadPdfFromElement(el, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const usableW = pageW - margin * 2;
  const imgH = (canvas.height * usableW) / canvas.width;
  const y = Math.max(margin, (pageH - imgH) / 2);
  pdf.addImage(img, 'PNG', margin, y, usableW, Math.min(imgH, pageH - margin * 2));
  pdf.save(filename);
}

export default function PaySlips() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('list'); // list | edit
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY());
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await payslipsApi.getAll(search.trim() ? { search: search.trim() } : {});
      setList(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load pay slips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const preview = useMemo(() => computePreview(form), [form]);

  const monthsForEmployee = useMemo(() => {
    if (!form.employeeNo) return [];
    const no = String(form.employeeNo).toLowerCase();
    return list
      .filter((p) => String(p.employeeNo).toLowerCase() === no)
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [list, form.employeeNo]);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY());
    setMode('edit');
    setError('');
  };

  const openEdit = (slip) => {
    setEditId(slip.id);
    setForm(slipToForm(slip));
    setMode('edit');
    setError('');
  };

  const setEarn = (key, value) =>
    setForm((f) => ({ ...f, earnings: { ...f.earnings, [key]: value } }));
  const setDed = (key, value) =>
    setForm((f) => ({ ...f, deductions: { ...f.deductions, [key]: value } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        earnings: preview.earnings,
        deductions: preview.deductions,
      };
      let res;
      if (editId) {
        res = await payslipsApi.update(editId, payload);
      } else {
        res = await payslipsApi.create(payload);
      }
      const saved = res.data;
      setEditId(saved.id);
      setForm(slipToForm(saved));
      await load();
    } catch (err) {
      setError(err.message || 'Could not save pay slip');
    } finally {
      setSaving(false);
    }
  };

  const addNextMonth = async () => {
    if (!editId) {
      setError('Save this pay slip first, then add next month.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await payslipsApi.addMonth(editId, { copyAmounts: true });
      const created = res.data;
      setEditId(created.id);
      setForm(slipToForm(created));
      await load();
    } catch (err) {
      setError(err.message || 'Could not add next month');
    } finally {
      setSaving(false);
    }
  };

  const removeSlip = async (id) => {
    if (!window.confirm('Delete this pay slip?')) return;
    try {
      await payslipsApi.remove(id);
      if (editId === id) {
        setMode('list');
        setEditId(null);
      }
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const handleDownloadPdf = async () => {
    const el = printRef.current;
    if (!el) return;
    setPdfBusy(true);
    setError('');
    try {
      const name = (preview.employeeName || 'employee').replace(/\s+/g, '_');
      const file = `PaySlip_${name}_${preview.month || 'month'}.pdf`;
      await downloadPdfFromElement(el, file);
    } catch (err) {
      setError(err.message || 'PDF download failed');
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading && mode === 'list') return <PageLoader />;

  return (
    <div className="payslips-page">
      <PageHeader
        title="Pay Slips"
        description="Create professional employee pay slips · Admin only · Multi-month pages · PDF download"
      >
        {mode === 'list' ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + New pay slip
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setMode('list');
              setError('');
              load();
            }}
          >
            ← All slips
          </button>
        )}
      </PageHeader>

      {error && (
        <p className="error-msg" role="alert">
          {error}
        </p>
      )}

      {mode === 'list' && (
        <div className="card">
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <input
              className="input"
              placeholder="Search name / emp no / department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
            <button type="button" className="btn btn-outline" onClick={load}>
              Search
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Emp. No</th>
                  <th>Month</th>
                  <th>Department</th>
                  <th>Net Pay</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>
                      No pay slips yet. Create the first one.
                    </td>
                  </tr>
                )}
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>{p.employeeName}</td>
                    <td>{p.employeeNo}</td>
                    <td>{formatMonthLabel(p.month)}</td>
                    <td>{p.department || '—'}</td>
                    <td>₹ {formatAmount(p.netPay) || '0'}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSlip(p.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <div className="payslips-edit">
          <form className="card payslips-form" onSubmit={save}>
            <div className="card__header">
              <h3 className="card__title">{editId ? 'Edit pay slip' : 'New pay slip'}</h3>
              <p className="card__subtitle">
                Fill employee details &amp; amounts. Gross / Net calculate automatically.
              </p>
            </div>

            {monthsForEmployee.length > 0 && (
              <div className="pslip-months">
                <span className="pslip-months__label">Months for this employee</span>
                <div className="pslip-months__tabs">
                  {monthsForEmployee.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`pslip-months__tab${m.id === editId ? ' is-active' : ''}`}
                      onClick={() => openEdit(m)}
                    >
                      {formatMonthLabel(m.month)}
                    </button>
                  ))}
                  {editId && (
                    <button type="button" className="pslip-months__tab pslip-months__tab--add" onClick={addNextMonth}>
                      + {formatMonthLabel(nextMonthKey(form.month || currentMonthKey()))}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <label>Name</label>
                <input
                  required
                  value={form.employeeName}
                  onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
                  placeholder="Employee full name"
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Field Operations"
                />
              </div>
              <div className="form-group">
                <label>Emp. No</label>
                <input
                  required
                  value={form.employeeNo}
                  onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                  placeholder="FO001"
                />
              </div>
              <div className="form-group">
                <label>Bank Name</label>
                <input
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Designation</label>
                <input
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="Field Officer"
                />
              </div>
              <div className="form-group">
                <label>A/c No.</label>
                <input
                  value={form.accountNo}
                  onChange={(e) => setForm({ ...form, accountNo: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Month</label>
                <input
                  type="month"
                  required
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Company address (optional)</label>
                <input
                  value={form.companyAddress}
                  onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
                  placeholder="Office address on slip"
                />
              </div>
            </div>

            <div className="payslips-amounts">
              <div>
                <h4 className="payslips-amounts__title">Earnings</h4>
                {[
                  ['basic', 'Basic Salary'],
                  ['hra', 'House Rent Allowances'],
                  ['conveyance', 'Conveyance Allowances'],
                  ['medical', 'Medical Allowances'],
                  ['special', 'Special Allowances'],
                ].map(([k, label]) => (
                  <div className="form-group form-group--inline" key={k}>
                    <label>{label}</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.earnings[k]}
                      onChange={(e) => setEarn(k, e.target.value)}
                    />
                  </div>
                ))}
                <p className="payslips-calc">
                  Gross: <strong>₹ {formatAmount(preview.grossSalary) || '0'}</strong>
                </p>
              </div>
              <div>
                <h4 className="payslips-amounts__title">Deductions</h4>
                {[
                  ['epf', 'EPF'],
                  ['healthInsurance', 'Health Insurance'],
                  ['professionalTax', 'Professional Tax'],
                  ['tds', 'TDS'],
                ].map(([k, label]) => (
                  <div className="form-group form-group--inline" key={k}>
                    <label>{label}</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.deductions[k]}
                      onChange={(e) => setDed(k, e.target.value)}
                    />
                  </div>
                ))}
                <p className="payslips-calc">
                  Deductions: <strong>₹ {formatAmount(preview.totalDeductions) || '0'}</strong>
                </p>
                <p className="payslips-calc payslips-calc--net">
                  Net Pay: <strong>₹ {formatAmount(preview.netPay) || '0'}</strong>
                </p>
                <p className="payslips-words-hint">{amountInWords(preview.netPay)}</p>
              </div>
            </div>

            <div className="payslips-form__actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update pay slip' : 'Save pay slip'}
              </button>
              {editId && (
                <button type="button" className="btn btn-outline" onClick={addNextMonth} disabled={saving}>
                  + Add next month page
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={handleDownloadPdf} disabled={pdfBusy}>
                {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
              </button>
            </div>
          </form>

          <div className="card payslips-preview-card">
            <div className="card__header">
              <h3 className="card__title">Live preview</h3>
              <p className="card__subtitle">Exact layout used in the downloaded PDF</p>
            </div>
            <div className="payslips-preview-wrap">
              <div ref={printRef}>
                <PaySlipDocument slip={preview} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
