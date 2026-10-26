import { canPerformStored } from '../utils/permissions';
import { useEffect, useMemo, useRef, useState } from 'react';
import { payslipsApi, attendanceApi, usersApi } from '../api/api';
import PageHeader from '../components/PageHeader';
import PageLoader from '../components/PageLoader';
import PaySlipDocument from '../components/PaySlipDocument';
import SearchableSelect from '../components/SearchableSelect';
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
    autoPayroll:!!slip.autoPayroll,payroll:slip.payroll || null,
    attendance:slip.attendance || null,
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
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [payrollScope, setPayrollScope] = useState('employee');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [runBusy, setRunBusy] = useState(false);
  const [runSummary, setRunSummary] = useState(null);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryReason, setSalaryReason] = useState('Initial monthly salary');
  const [salarySaving, setSalarySaving] = useState(false);
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
      const [slips, roster] = await Promise.allSettled([
        payslipsApi.getAll(search.trim() ? { search: search.trim() } : {}),
        usersApi.getAll(),
      ]);
      if (slips.status === 'rejected') throw slips.reason;
      setList(slips.value.data || []);
      if (roster.status === 'fulfilled') {
        setEmployees((roster.value.data || []).filter((user) => !user.isDeleted && user.role !== 'superAdmin'));
      }
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
  const isAutomatic=activeAmounts.autoPayroll ?? true;
  const calculationScope=useRef('');calculationScope.current=`${profile.employeeNo}|${activeMonth}`;
  const payrollReady=monthKeys.every(m=>!(monthMap[m]?.autoPayroll ?? true) || (String(monthMap[m]?.payroll?.employeeNo || '').toLowerCase()===profile.employeeNo.trim().toLowerCase() && monthMap[m]?.payroll?.month===m));
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
          companyName: JSON.parse(localStorage.getItem('ndfa_user') || '{}').company?.name || 'MyStaff Smart',
          month: m,
          attendance:monthMap[m]?.attendance || null,
          payroll:monthMap[m]?.payroll || null,
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
    setSelectedEmployeeId('');
    setSalaryAmount('');
    setError('');
  };

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || null;
  const branches = useMemo(() => [...new Set(employees.map((employee) => employee.branch).filter(Boolean))].sort(), [employees]);

  const calculatePayroll = async (employeeNo = profile.employeeNo, month = activeMonth) => {
    const scope = `${employeeNo}|${month}`;
    try {
      const response = await payslipsApi.calculation({ employeeNo, month });
      const payroll = response.data.calculation;
      if (scope !== `${employeeNo}|${month}`) return false;
      setError('');
      setMonthMap((previous) => ({
        ...previous,
        [month]: {
          ...previous[month],
          autoPayroll: true,
          payroll,
          attendance: { ...payroll, note: payroll.policy },
          earnings: { ...emptyAmounts().earnings, basic: payroll.earnedSalary },
        },
      }));
      return true;
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not calculate payroll');
      return false;
    }
  };

  const preparePayroll = async () => {
    if (!selectedEmployee) {
      setError('Select an employee to start payroll.');
      return;
    }
    const month = startMonth;
    setProfile({
      employeeName: selectedEmployee.name || '',
      employeeNo: selectedEmployee.employeeId || '',
      designation: selectedEmployee.role === 'branchManager' ? 'Branch Manager' : selectedEmployee.role === 'admin' ? 'Administrator' : 'Employee',
      department: selectedEmployee.branch || '',
      bankName: selectedEmployee.bankName || '',
      accountNo: selectedEmployee.accountNo || '',
      companyAddress: '',
    });
    setRangeMode('1');
    setEndMonth(month);
    setActiveMonth(month);
    setMonthMap({ [month]: emptyAmounts() });
    setSalaryAmount(selectedEmployee.monthlySalary || '');
    setMode('edit');
    await calculatePayroll(selectedEmployee.employeeId, month);
  };

  const issueSelectedPayroll = async () => {
    if (payrollScope === 'employee' && !selectedEmployeeId) return setError('Select an employee for individual payroll.');
    if (payrollScope === 'branch' && !selectedBranch) return setError('Select a branch for branch-wise payroll.');
    setRunBusy(true);
    setError('');
    setRunSummary(null);
    try {
      const response = await payslipsApi.runPayroll({
        month: startMonth,
        scope: payrollScope,
        employeeId: payrollScope === 'employee' ? selectedEmployeeId : undefined,
        branch: payrollScope === 'branch' ? selectedBranch : undefined,
      });
      setRunSummary(response.data);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not issue payroll');
    } finally {
      setRunBusy(false);
    }
  };

  const saveSalaryAndCalculate = async () => {
    if (!selectedEmployee) return;
    if (!(Number(salaryAmount) > 0)) {
      setError('Enter a valid monthly salary before issuing payroll.');
      return;
    }
    if (salaryReason.trim().length < 3) {
      setError('Enter a salary reason with at least 3 characters.');
      return;
    }
    setSalarySaving(true);
    setError('');
    try {
      await attendanceApi.setSalary(selectedEmployee.id, { amount: Number(salaryAmount), month: activeMonth, reason: salaryReason.trim() });
      setEmployees((previous) => previous.map((employee) => employee.id === selectedEmployee.id ? { ...employee, monthlySalary: Number(salaryAmount) } : employee));
      await calculatePayroll(selectedEmployee.employeeId, activeMonth);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save monthly salary');
    } finally {
      setSalarySaving(false);
    }
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
          ...prev[m],
          earnings: (prev[m]?.autoPayroll ?? true) ? (prev[m]?.earnings || emptyAmounts().earnings) : { ...src.earnings },
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
        return { month: m, earnings: c.earnings, deductions: c.deductions,attendance:monthMap[m]?.attendance || null,autoPayroll:monthMap[m]?.autoPayroll ?? true };
      });
      const saved=await payslipsApi.bulkUpsert({ ...profile, months });
      setMonthMap(Object.fromEntries(saved.data.map(slip=>[slip.month,amountsFromSlip(slip)])));
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
    if(!payrollReady){setError('Calculate or save automatic payroll for every selected month before downloading.');return;}
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
        title="Payroll"
        description="Set monthly salary, calculate attendance-based pay, issue payroll and generate salary slips."
      >
        {mode === 'list' ? (
          <button hidden={!canPerformStored('payslips', 'create')} type="button" className="btn btn-primary" onClick={openCreate}>
            + Create manual salary slip
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
        <>
        <section className="card payroll-launch">
          <div>
            <span className="eyebrow">MONTHLY PAYROLL</span>
            <h3>Create payroll your way</h3>
            <p>Run a reviewed payroll for one employee, issue the entire branch at once, or create payroll for every eligible employee in the company. Existing slips for the month are refreshed after attendance changes.</p>
          </div>
          <div className="payroll-launch__controls">
            <div className="payroll-launch__scope" role="group" aria-label="Payroll scope">
              <button type="button" className={`btn btn-sm ${payrollScope === 'employee' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPayrollScope('employee')}>Single employee</button>
              <button type="button" className={`btn btn-sm ${payrollScope === 'branch' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPayrollScope('branch')}>Branch-wise</button>
              <button type="button" className={`btn btn-sm ${payrollScope === 'company' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPayrollScope('company')}>Overall company</button>
            </div>
            {payrollScope === 'employee' && <label>Employee
              <SearchableSelect value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} required>
                <option value="">Select employee</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.employeeId} · {employee.branch || 'No branch'}</option>)}
              </SearchableSelect>
            </label>}
            {payrollScope === 'branch' && <label>Branch
              <SearchableSelect value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} required>
                <option value="">Select branch</option>
                {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
              </SearchableSelect>
            </label>}
            {payrollScope === 'company' && <div className="payroll-launch__selection"><strong>All eligible employees</strong><span>Every active staff member with a saved salary</span></div>}
            <label>Payroll month<input type="month" value={startMonth} onChange={(event) => { setStartMonth(event.target.value); setEndMonth(event.target.value); }} /></label>
            {payrollScope === 'employee' ? <button type="button" className="btn btn-primary" onClick={preparePayroll}>Review & issue</button> : <button type="button" className="btn btn-primary" disabled={runBusy} onClick={issueSelectedPayroll}>{runBusy ? 'Issuing…' : payrollScope === 'branch' ? 'Issue branch payroll' : 'Issue company payroll'}</button>}
          </div>
        </section>
        {runSummary && <section className="card payroll-run-summary" aria-live="polite">
          <strong>{runSummary.issued?.length || 0} salary slip(s) {runSummary.issued?.some((item) => item.status === 'refreshed') ? 'issued or refreshed' : 'issued'} for {formatMonthLabel(runSummary.month)}.</strong>
          {!!runSummary.skipped?.length && <p>{runSummary.skipped.length} employee(s) skipped: {runSummary.skipped.slice(0, 3).map((item) => `${item.employeeName} (${item.reason})`).join(' · ')}{runSummary.skipped.length > 3 ? '…' : ''}</p>}
        </section>}
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
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No salary slips issued yet. Select an employee above to prepare the first payroll.
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
                        {canPerformStored('payslips','update') && ['salary','slip'].map(kind=><button key={kind} className="btn btn-sm btn-outline" type="button" disabled={!!p[kind==='salary'?'salaryReleasedAt':'slipReleasedAt']} onClick={async()=>{
                          const reference=window.prompt(kind==='salary'?'Record salary already paid. Enter payment reference (this does not transfer money). Released amounts will be locked.':'Release this salary slip. Enter reason / reference. Released amounts will be locked.');
                          if(!reference)return;
                          try{await payslipsApi.release(p.id,{kind,reference});await load();}catch(e){setError(e.message);}
                        }}>{p[kind==='salary'?'salaryReleasedAt':'slipReleasedAt']?(kind==='salary'?'Salary paid':'Slip released'):(kind==='salary'?'Record salary payment':'Release salary slip')}</button>)}
                        <button hidden={!canPerformStored('payslips', 'update')} type="button" className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>
                          View / edit
                        </button>
                        <button hidden={!canPerformStored('payslips', 'delete')} type="button" className="btn btn-sm btn-danger" onClick={() => removeSlip(p.id)}>
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
        </>
      )}

      {mode === 'edit' && (
        <div className="payslips-edit">
          <form className="card payslips-form" onSubmit={saveAll}>
            <div className="card__header">
              <h3 className="card__title">Payroll issue workspace</h3>
              <p className="card__subtitle">
                Choose how many months, enter different amounts per month, then save &amp; download one PDF.
              </p>
            </div>

            {selectedEmployee && <section className="card payroll-salary-setup">
              <div>
                <span className="eyebrow">SALARY SETUP</span>
                <h3>{selectedEmployee.name} · {formatMonthLabel(activeMonth)}</h3>
                <p className="muted">Set the base monthly salary here. Attendance remains managed separately; payroll applies the attendance policy when you calculate or issue the slip.</p>
              </div>
              <div className="form-grid-2">
                <label>Monthly salary (₹)<input type="number" min="0.01" max="10000000" step="0.01" value={salaryAmount} onChange={(event) => setSalaryAmount(event.target.value)} /></label>
                <label>Salary change reason<input minLength="3" maxLength="500" value={salaryReason} onChange={(event) => setSalaryReason(event.target.value)} /></label>
              </div>
              <button type="button" className="btn btn-outline" disabled={salarySaving} onClick={saveSalaryAndCalculate}>{salarySaving ? 'Saving salary…' : 'Save salary & refresh payroll'}</button>
            </section>}

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

            <section className="card payroll-attendance"><h3>Attendance-based payroll</h3><label><input type="checkbox" checked={isAutomatic} onChange={e=>setMonthMap(prev=>({...prev,[activeMonth]:{...prev[activeMonth],autoPayroll:e.target.checked,payroll:null}}))}/> Calculate salary automatically from attendance</label><p>Monthly salary ÷ calendar days × payable days. The first four Sundays are paid, with no double counting. Extra paid leave needs a reasoned attendance correction. Future or unrecorded days remain unpaid in provisional payroll.</p><button type="button" className="btn btn-primary" disabled={!isAutomatic} onClick={()=>calculatePayroll()}>Calculate / refresh payroll</button>{activeAmounts.payroll && <p>Base ₹{formatAmount(activeAmounts.payroll.monthlySalary)} · Payable {activeAmounts.payroll.paidDays}/{activeAmounts.payroll.calendarDays} days · Loss of pay ₹{formatAmount(activeAmounts.payroll.lossOfPay)} · Earned ₹{formatAmount(activeAmounts.payroll.earnedSalary)}. Issuing payroll saves this calculation and creates the salary slip.</p>}</section>
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
                      disabled={isAutomatic} value={activeAmounts.earnings[k] ?? ''}
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

            <section className="card payroll-attendance"><h3>Attendance & leave · {formatMonthLabel(activeMonth)}</h3><p className="muted">Review days for this month. Import uses the attendance calendar, including admin corrections. Automatic payroll applies four paid Sundays and approved paid leave. Manual day entries are for legacy/manual slips; automatic slips always recalculate from attendance when saved.</p><button type="button" className="btn btn-outline" onClick={async()=>{try{const r=await attendanceApi.getMonthly({year:Number(activeMonth.slice(0,4)),month:Number(activeMonth.slice(5))});const employee=r.data.employees.find(e=>String(e.employeeId).toLowerCase()===profile.employeeNo.trim().toLowerCase());if(!employee)throw new Error('Employee ID not found in the active attendance roster. Enter the matching employee number or fill reviewed days manually.');setMonthMap(prev=>({...prev,[activeMonth]:{...prev[activeMonth],attendance:{presentDays:employee.presentDays,paidLeaveDays:employee.paidLeaveDays || 0,unpaidLeaveDays:employee.unpaidLeaveDays || 0,weeklyOffDays:employee.holidayDays || 0,absentDays:employee.absentDays || 0,note:'Imported attendance; reviewed payroll amounts entered separately.'}}}));}catch(err){setError(err.response?.data?.message || err.message);}}} disabled={isAutomatic}>Import attendance summary</button><div className="form-grid-2">{[['presentDays','Present days'],['paidLeaveDays','Paid leave days'],['unpaidLeaveDays','Unpaid leave days'],['weeklyOffDays','Weekly off / holidays'],['absentDays','Absent days']].map(([key,label])=><label key={key}>{label}<input type="number" min="0" max="31" step="0.5" disabled={isAutomatic} value={activeAmounts.attendance?.[key] ?? ''} onChange={e=>setMonthMap(prev=>({...prev,[activeMonth]:{...prev[activeMonth],attendance:{...prev[activeMonth].attendance,[key]:e.target.value}}}))}/></label>)}</div><label>Leave / payroll policy note<input maxLength={500} disabled={isAutomatic} value={activeAmounts.attendance?.note || ''} onChange={e=>setMonthMap(prev=>({...prev,[activeMonth]:{...prev[activeMonth],attendance:{...prev[activeMonth].attendance,note:e.target.value}}}))}/></label></section>
            <div className="payslips-form__actions">
              <button hidden={!canPerformStored('payslips','export')} type="button" className="btn btn-outline" disabled={!payrollReady} onClick={()=>window.print()}>Print salary slips</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Issuing payroll…' : `Issue payroll & generate ${monthKeys.length} salary slip${monthKeys.length === 1 ? '' : 's'}`}
              </button>
              <button hidden={!canPerformStored('payslips', 'export')} type="button" className="btn btn-primary" onClick={handleDownloadPdf} disabled={pdfBusy || !payrollReady}>
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
