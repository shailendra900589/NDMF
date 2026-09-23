import { useEffect, useMemo, useRef, useState } from 'react';
import { payslipsApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import PaySlipDocument from '../components/PaySlipDocument';
import {
  amountInWords,
  currentMonthKey,
  emptyAmounts,
  endMonthForCount,
  formatAmount,
  formatMonthLabel,
  monthsForCount,
  monthsInRange,
} from '../utils/payslip';

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computeAmounts(earningsIn = {}, deductionsIn = {}) {
  const earnings = {
    basic: toNum(earningsIn.basic),
    hra: toNum(earningsIn.hra),
    conveyance: toNum(earningsIn.conveyance),
    medical: toNum(earningsIn.medical),
    special: toNum(earningsIn.special),
  };
  const deductions = {
    epf: toNum(deductionsIn.epf),
    healthInsurance: toNum(deductionsIn.healthInsurance),
    professionalTax: toNum(deductionsIn.professionalTax),
    tds: toNum(deductionsIn.tds),
  };
  const grossSalary =
    earnings.basic + earnings.hra + earnings.conveyance + earnings.medical + earnings.special;
  const totalDeductions =
    deductions.epf + deductions.healthInsurance + deductions.professionalTax + deductions.tds;
  return {
    earnings,
    deductions,
    grossSalary,
    totalDeductions,
    netPay: grossSalary - totalDeductions,
  };
}

function blankProfile() {
  return {
    employeeName: '',
    employeeNo: '',
    designation: '',
    department: '',
    bankName: '',
    accountNo: '',
    companyAddress: '',
  };
}

function amountsFromSlip(slip) {
  return {
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

function buildMonthMap(keys, prevMap = {}, seedAmounts = null) {
  const next = {};
  keys.forEach((m, idx) => {
    if (prevMap[m]) {
      next[m] = prevMap[m];
    } else if (seedAmounts && idx > 0) {
      next[m] = {
        earnings: { ...seedAmounts.earnings },
        deductions: { ...seedAmounts.deductions },
      };
    } else if (seedAmounts && idx === 0) {
      next[m] = {
        earnings: { ...seedAmounts.earnings },
        deductions: { ...seedAmounts.deductions },
      };
    } else {
      next[m] = emptyAmounts();
    }
  });
  return next;
}

async function downloadMultiPagePdf(pageEls, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableW = pageW - margin * 2;

  for (let i = 0; i < pageEls.length; i += 1) {
    const canvas = await html2canvas(pageEls[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    const img = canvas.toDataURL('image/png');
    const imgH = (canvas.height * usableW) / canvas.width;
    if (i > 0) pdf.addPage();
    const y = Math.max(margin, (pageH - Math.min(imgH, pageH - margin * 2)) / 2);
    pdf.addImage(img, 'PNG', margin, y, usableW, Math.min(imgH, pageH - margin * 2));
  }
  pdf.save(filename);
}

export default function PaySlips() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('list');
  const [profile, setProfile] = useState(blankProfile());
  const [rangeMode, setRangeMode] = useState('1'); // 1 | 3 | 6 | custom
  const [startMonth, setStartMonth] = useState(currentMonthKey());
  const [endMonth, setEndMonth] = useState(currentMonthKey());
  const [monthMap, setMonthMap] = useState(() => ({ [currentMonthKey()]: emptyAmounts() }));
  const [activeMonth, setActiveMonth] = useState(currentMonthKey());
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfPagesRef = useRef(null);

  const monthKeys = useMemo(() => {
    if (rangeMode === 'custom') return monthsInRange(startMonth, endMonth);
    const count = Number(rangeMode) || 1;
    return monthsForCount(startMonth, count);
  }, [rangeMode, startMonth, endMonth]);

  // Keep monthMap aligned when range changes
  useEffect(() => {
    if (!monthKeys.length) return;
    setMonthMap((prev) => {
      const first = prev[monthKeys[0]] || prev[Object.keys(prev)[0]] || emptyAmounts();
      return buildMonthMap(monthKeys, prev, first);
    });
    setActiveMonth((am) => (monthKeys.includes(am) ? am : monthKeys[0]));
  }, [monthKeys.join(',')]);

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

  const activeAmounts = monthMap[activeMonth] || emptyAmounts();
  const activeComputed = useMemo(
    () => computeAmounts(activeAmounts.earnings, activeAmounts.deductions),
    [activeAmounts]
  );

  const previewSlips = useMemo(
    () =>
      monthKeys.map((m) => {
        const am = computeAmounts(monthMap[m]?.earnings, monthMap[m]?.deductions);
        return {
          ...profile,
          companyName: 'Nirmaldhara Micro Foundation',
          month: m,
          ...am,
        };
      }),
    [monthKeys, monthMap, profile]
  );

  const openCreate = () => {
    const m = currentMonthKey();
    setProfile(blankProfile());
    setRangeMode('1');
    setStartMonth(m);
    setEndMonth(m);
    setMonthMap({ [m]: emptyAmounts() });
    setActiveMonth(m);
    setMode('edit');
    setError('');
  };

  const openEdit = (slip) => {
    const empNo = slip.employeeNo;
    const related = list
      .filter((p) => String(p.employeeNo).toLowerCase() === String(empNo).toLowerCase())
      .sort((a, b) => a.month.localeCompare(b.month));
    const keys = related.length ? related.map((p) => p.month) : [slip.month];
    const map = {};
    related.forEach((p) => {
      map[p.month] = amountsFromSlip(p);
    });
    if (!map[slip.month]) map[slip.month] = amountsFromSlip(slip);

    setProfile({
      employeeName: slip.employeeName || '',
      employeeNo: slip.employeeNo || '',
      designation: slip.designation || '',
      department: slip.department || '',
      bankName: slip.bankName || '',
      accountNo: slip.accountNo || '',
      companyAddress: slip.companyAddress || '',
    });
    setStartMonth(keys[0]);
    setEndMonth(keys[keys.length - 1]);
    if (keys.length === 1) setRangeMode('1');
    else if (keys.length === 3) setRangeMode('3');
    else if (keys.length === 6) setRangeMode('6');
    else setRangeMode('custom');
    setMonthMap(map);
    setActiveMonth(slip.month);
    setMode('edit');
    setError('');
  };

  const setRangePreset = (preset) => {
    setRangeMode(preset);
    if (preset !== 'custom') {
      setEndMonth(endMonthForCount(startMonth, Number(preset)));
    }
  };

  const onStartMonthChange = (value) => {
    setStartMonth(value);
    if (rangeMode !== 'custom') {
      setEndMonth(endMonthForCount(value, Number(rangeMode) || 1));
    } else if (value > endMonth) {
      setEndMonth(value);
    }
  };

  const updateActiveEarn = (key, value) => {
    setMonthMap((prev) => ({
      ...prev,
      [activeMonth]: {
        ...prev[activeMonth],
        earnings: { ...prev[activeMonth].earnings, [key]: value },
      },
    }));
  };

  const updateActiveDed = (key, value) => {
    setMonthMap((prev) => ({
      ...prev,
      [activeMonth]: {
        ...prev[activeMonth],
        deductions: { ...prev[activeMonth].deductions, [key]: value },
      },
    }));
  };

  const copyActiveToAll = () => {
    const src = monthMap[activeMonth] || emptyAmounts();
    setMonthMap((prev) => {
      const next = { ...prev };
      monthKeys.forEach((m) => {
        next[m] = {
          earnings: { ...src.earnings },
          deductions: { ...src.deductions },
        };
      });
      return next;
    });
  };

  const saveAll = async (e) => {
    e.preventDefault();
    if (!profile.employeeName.trim() || !profile.employeeNo.trim()) {
      setError('Name and Emp. No are required');
      return;
    }
    if (!monthKeys.length) {
      setError('Select at least one month');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const months = monthKeys.map((m) => {
        const c = computeAmounts(monthMap[m]?.earnings, monthMap[m]?.deductions);
        return { month: m, earnings: c.earnings, deductions: c.deductions };
      });
      await payslipsApi.bulkUpsert({ ...profile, months });
      await load();
    } catch (err) {
      setError(err.message || 'Could not save pay slips');
    } finally {
      setSaving(false);
    }
  };

  const removeSlip = async (id) => {
    if (!window.confirm('Delete this pay slip?')) return;
    try {
      await payslipsApi.remove(id);
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const handleDownloadPdf = async () => {
    const root = pdfPagesRef.current;
    if (!root) return;
    const pages = [...root.querySelectorAll('.pslip-pdf-page')];
    if (!pages.length) {
      setError('Nothing to download');
      return;
    }
    setPdfBusy(true);
    setError('');
    try {
      const name = (profile.employeeName || 'employee').replace(/\s+/g, '_');
      const rangeLabel =
        monthKeys.length === 1
          ? monthKeys[0]
          : `${monthKeys[0]}_to_${monthKeys[monthKeys.length - 1]}`;
      await downloadMultiPagePdf(pages, `PaySlip_${name}_${rangeLabel}.pdf`);
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
        description="1 / 3 / 6 months or custom range · separate data per month · one combined PDF"
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
                          Edit range
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
          <form className="card payslips-form" onSubmit={saveAll}>
            <div className="card__header">
              <h3 className="card__title">Employee pay slips</h3>
              <p className="card__subtitle">
                Choose how many months, enter different amounts per month, then save &amp; download one PDF.
              </p>
            </div>

            <div className="pslip-range">
              <span className="pslip-range__label">Period</span>
              <div className="pslip-range__presets">
                {[
                  ['1', '1 month'],
                  ['3', '3 months'],
                  ['6', '6 months'],
                  ['custom', 'Custom'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`pslip-months__tab${rangeMode === id ? ' is-active' : ''}`}
                    onClick={() => setRangePreset(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="pslip-range__dates form-grid-2">
                <div className="form-group">
                  <label>{rangeMode === 'custom' ? 'From month' : 'Start month'}</label>
                  <input type="month" required value={startMonth} onChange={(e) => onStartMonthChange(e.target.value)} />
                </div>
                {rangeMode === 'custom' ? (
                  <div className="form-group">
                    <label>To month</label>
                    <input
                      type="month"
                      required
                      value={endMonth}
                      min={startMonth}
                      onChange={(e) => setEndMonth(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Through</label>
                    <input type="text" readOnly value={formatMonthLabel(monthKeys[monthKeys.length - 1] || startMonth)} />
                  </div>
                )}
              </div>
              <p className="pslip-range__hint">
                {monthKeys.length} month{monthKeys.length === 1 ? '' : 's'}:{' '}
                {monthKeys.map(formatMonthLabel).join(' · ')}
              </p>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Name</label>
                <input
                  required
                  value={profile.employeeName}
                  onChange={(e) => setProfile({ ...profile, employeeName: e.target.value })}
                  placeholder="Employee full name"
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  placeholder="e.g. Field Operations"
                />
              </div>
              <div className="form-group">
                <label>Emp. No</label>
                <input
                  required
                  value={profile.employeeNo}
                  onChange={(e) => setProfile({ ...profile, employeeNo: e.target.value })}
                  placeholder="FO001"
                />
              </div>
              <div className="form-group">
                <label>Bank Name</label>
                <input
                  value={profile.bankName}
                  onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Designation</label>
                <input
                  value={profile.designation}
                  onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                  placeholder="Field Officer"
                />
              </div>
              <div className="form-group">
                <label>A/c No.</label>
                <input
                  value={profile.accountNo}
                  onChange={(e) => setProfile({ ...profile, accountNo: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Company address (optional)</label>
                <input
                  value={profile.companyAddress}
                  onChange={(e) => setProfile({ ...profile, companyAddress: e.target.value })}
                  placeholder="Office address on slip"
                />
              </div>
            </div>

            <div className="pslip-months">
              <div className="pslip-months__head">
                <span className="pslip-months__label">Month pages — edit amounts for each</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={copyActiveToAll}>
                  Copy this month’s amounts to all
                </button>
              </div>
              <div className="pslip-months__tabs">
                {monthKeys.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`pslip-months__tab${m === activeMonth ? ' is-active' : ''}`}
                    onClick={() => setActiveMonth(m)}
                  >
                    {formatMonthLabel(m)}
                  </button>
                ))}
              </div>
            </div>

            <div className="payslips-amounts">
              <div>
                <h4 className="payslips-amounts__title">
                  Earnings · {formatMonthLabel(activeMonth)}
                </h4>
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
                      value={activeAmounts.earnings[k]}
                      onChange={(e) => updateActiveEarn(k, e.target.value)}
                    />
                  </div>
                ))}
                <p className="payslips-calc">
                  Gross: <strong>₹ {formatAmount(activeComputed.grossSalary) || '0'}</strong>
                </p>
              </div>
              <div>
                <h4 className="payslips-amounts__title">
                  Deductions · {formatMonthLabel(activeMonth)}
                </h4>
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
                      value={activeAmounts.deductions[k]}
                      onChange={(e) => updateActiveDed(k, e.target.value)}
                    />
                  </div>
                ))}
                <p className="payslips-calc">
                  Deductions: <strong>₹ {formatAmount(activeComputed.totalDeductions) || '0'}</strong>
                </p>
                <p className="payslips-calc payslips-calc--net">
                  Net Pay: <strong>₹ {formatAmount(activeComputed.netPay) || '0'}</strong>
                </p>
                <p className="payslips-words-hint">{amountInWords(activeComputed.netPay)}</p>
              </div>
            </div>

            <div className="payslips-form__actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : `Save all ${monthKeys.length} month(s)`}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleDownloadPdf} disabled={pdfBusy}>
                {pdfBusy
                  ? 'Preparing PDF…'
                  : `Download PDF (${monthKeys.length} page${monthKeys.length === 1 ? '' : 's'})`}
              </button>
            </div>
          </form>

          <div className="card payslips-preview-card">
            <div className="card__header">
              <h3 className="card__title">Live preview</h3>
              <p className="card__subtitle">
                Each month is a separate page in one PDF · showing all {monthKeys.length} slip(s)
              </p>
            </div>
            <div className="payslips-preview-wrap">
              <div ref={pdfPagesRef} className="pslip-pdf-stack">
                {previewSlips.map((slip) => (
                  <div key={slip.month} className="pslip-pdf-page">
                    <PaySlipDocument slip={slip} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
