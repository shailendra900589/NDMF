/**
 * PAY SLIPS — admin only
 * Individual slips per employee per month (YYYY-MM).
 */
const { getCollection, findById, upsert, removeById, flush } = require('../../lib/db');
const { success, error } = require('../../lib/response');

const { companyFor, actionAllowed } = require('../../lib/companyPolicy');
const {calculatePayroll}=require('../../lib/payrollCalculation');
function employeeFor(employeeNo){
 return getCollection('users').find(u=>String(u.employeeId || '').toLowerCase()===String(employeeNo || '').trim().toLowerCase() && u.role!=='superAdmin');
}
function canManageEmployee(actor, employee){
 return actor?.role==='admin' || (actor?.role==='branchManager' && employee?.role==='fieldOfficer' && actor.branch===employee.branch);
}
function canAccessSlip(actor, slip){
 return actor?.role==='admin' || (actor?.role==='branchManager' && slip?.branch===actor.branch);
}
function automaticCalculation(employeeNo,month,actor){
 const employee=employeeFor(employeeNo);
 if(!employee)throw new Error('Employee ID not found in this company');
 if(actor && !canManageEmployee(actor,employee))throw new Error('You can only manage payroll for employees in your branch');
 return {employee,calculation:calculatePayroll(employee,month,getCollection('attendance'),getCollection('attendanceAdjustments'))};
}
exports.calculation=(req,res)=>{
 try{const {employee,calculation}=automaticCalculation(req.query.employeeNo,req.query.month,req.user);return success(res,{employeeName:employee.name,employeeNo:employee.employeeId,calculation});}
 catch(e){return error(res,e.message);}
};
const DEFAULT_ADDRESS = '';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function compute(earnings = {}, deductions = {}) {
  const e = {
    basic: num(earnings.basic),
    hra: num(earnings.hra),
    conveyance: num(earnings.conveyance),
    medical: num(earnings.medical),
    special: num(earnings.special),
  };
  const d = {
    epf: num(deductions.epf),
    healthInsurance: num(deductions.healthInsurance),
    professionalTax: num(deductions.professionalTax),
    tds: num(deductions.tds),
  };
  const grossSalary = e.basic + e.hra + e.conveyance + e.medical + e.special;
  const totalDeductions = d.epf + d.healthInsurance + d.professionalTax + d.tds;
  const netPay = grossSalary - totalDeductions;
  return { earnings: e, deductions: d, grossSalary, totalDeductions, netPay };
}

function normalizeMonth(month) {
  const m = String(month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const [y, mo] = m.split('-').map(Number);
  if (mo < 1 || mo > 12) return null;
  return `${y}-${String(mo).padStart(2, '0')}`;
}

function nextMonthKey(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function validateBody(body) {
  const employeeName = String(body.employeeName || '').trim();
  const employeeNo = String(body.employeeNo || '').trim();
  const month = normalizeMonth(body.month);
  if (!employeeName) return { ok: false, message: 'Employee name required' };
  if (!employeeNo) return { ok: false, message: 'Employee number required' };
  if (!month) return { ok: false, message: 'Valid month required (YYYY-MM)' };
  return { ok: true, employeeName, employeeNo, month };
}

function buildRecord(id, body, actor, existing) {
  if (existing?.salaryReleasedAt || existing?.slipReleasedAt) return {error:'Released payroll is locked. Create a documented adjustment in a subsequent month.'};
  for (const section of ['earnings','deductions']) {
    for (const value of Object.values(body[section] || {})) {
      if (!Number.isFinite(Number(value)) || Number(value)<0) return {error:'Salary amounts and deductions must be valid non-negative numbers'};
    }
  }
  const v = validateBody(body);
  if (!v.ok) return { error: v.message };
  const employee=employeeFor(v.employeeNo);
  if(actor?.role==='branchManager' && (!employee || !canManageEmployee(actor,employee)))return {error:'You can only manage payroll for employees in your branch'};
  let payroll=null;
  if(body.autoPayroll){
    try{const result=automaticCalculation(v.employeeNo,v.month,actor);payroll=result.calculation;v.employeeName=result.employee.name;}catch(e){return {error:e.message};}
    body={...body,earnings:{basic:payroll.earnedSalary},attendance:{...payroll,note:payroll.policy}};
  }
  const attendance=body.attendance ?? existing?.attendance ?? null;
  let attendanceRecord=null;
  if(attendance){
    const totalDays=new Date(Number(v.month.slice(0,4)),Number(v.month.slice(5)),0).getDate();
    attendanceRecord={};
    for(const key of ['presentDays','paidLeaveDays','unpaidLeaveDays','weeklyOffDays','absentDays']){
      const value=Number(attendance[key] ?? 0);
      if(!Number.isFinite(value) || value<0 || value>totalDays || value*2!==Math.round(value*2))return {error:'Payroll days must be valid half/full days within the selected month'};
      attendanceRecord[key]=value;
    }
    if(Object.values(attendanceRecord).reduce((a,b)=>a+b,0)>totalDays)return {error:'Total payroll days exceed calendar days in this month'};
    attendanceRecord.calendarDays=totalDays;attendanceRecord.note=String(attendance.note || '').slice(0,500);
  }
  const { earnings, deductions, grossSalary, totalDeductions, netPay } = compute(
    body.earnings,
    body.deductions
  );
  if (netPay < 0) return {error:'Deductions cannot exceed earnings'};
  return {
    record: {
      id,
      companyName: companyFor(actor)?.name || 'Company',
      companyAddress: String(body.companyAddress ?? existing?.companyAddress ?? DEFAULT_ADDRESS).trim(),
      employeeName: v.employeeName,
      employeeNo: v.employeeNo,
      designation: String(body.designation || '').trim(),
      department: String(body.department || '').trim(),
      bankName: String(body.bankName || '').trim(),
      accountNo: String(body.accountNo || '').trim(),
      month: v.month,
      attendance:attendanceRecord,
      autoPayroll:!!body.autoPayroll,
      payroll,
      earnings,
      deductions,
      grossSalary,
      totalDeductions,
      netPay,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      branch: employee?.branch || existing?.branch || '',
      createdBy: existing?.createdBy || actor.id,
      updatedBy: actor.id,
    },
  };
}

exports.list = (req, res) => {
  const all = getCollection('payslips');
  const { employeeNo, month, search } = req.query;
  let list = req.user.role === 'branchManager' ? all.filter((p) => p.branch === req.user.branch) : [...all];
  if (employeeNo) {
    list = list.filter((p) => String(p.employeeNo).toLowerCase() === String(employeeNo).toLowerCase());
  }
  if (month) {
    const m = normalizeMonth(month);
    if (m) list = list.filter((p) => p.month === m);
  }
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      (p) =>
        String(p.employeeName || '').toLowerCase().includes(q) ||
        String(p.employeeNo || '').toLowerCase().includes(q) ||
        String(p.department || '').toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => {
    if (a.month !== b.month) return b.month.localeCompare(a.month);
    return String(a.employeeName).localeCompare(String(b.employeeName));
  });
  return success(res, list);
};

exports.getById = (req, res) => {
  const slip = findById('payslips', req.params.id);
  if (!slip) return error(res, 'Pay slip not found', 404);
  if (!canAccessSlip(req.user, slip)) return error(res, 'You can only access payroll in your branch', 403);
  return success(res, slip);
};

exports.create = async (req, res) => {
  const id = `PS_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const built = buildRecord(id, req.body, req.user, null);
  if (built.error) return error(res, built.error);

  const dup = getCollection('payslips').find(
    (p) =>
      String(p.employeeNo).toLowerCase() === String(built.record.employeeNo).toLowerCase() &&
      p.month === built.record.month
  );
  if (dup) {
    return error(res, 'Pay slip already exists for this employee and month. Edit that slip or add next month.', 409);
  }

  upsert('payslips', built.record); await flush();
  return success(res, built.record, 'Pay slip created', 201);
};

exports.update = async (req, res) => {
  const existing = findById('payslips', req.params.id);
  if (!existing) return error(res, 'Pay slip not found', 404);
  if (!canAccessSlip(req.user, existing)) return error(res, 'You can only manage payroll in your branch', 403);

  const built = buildRecord(existing.id, { ...existing, ...req.body }, req.user, existing);
  if (built.error) return error(res, built.error);

  const dup = getCollection('payslips').find(
    (p) =>
      p.id !== existing.id &&
      String(p.employeeNo).toLowerCase() === String(built.record.employeeNo).toLowerCase() &&
      p.month === built.record.month
  );
  if (dup) {
    return error(res, 'Another pay slip already exists for this employee and month', 409);
  }

  upsert('payslips', built.record); await flush();
  return success(res, built.record, 'Pay slip updated');
};

/** Copy employee details into the next month (or specified month). */
exports.addMonth = async (req, res) => {
  const existing = findById('payslips', req.params.id);
  if (!existing) return error(res, 'Pay slip not found', 404);
  if (!canAccessSlip(req.user, existing)) return error(res, 'You can only manage payroll in your branch', 403);

  const targetMonth = normalizeMonth(req.body.month) || nextMonthKey(existing.month);
  const all = getCollection('payslips');
  const dup = all.find(
    (p) =>
      String(p.employeeNo).toLowerCase() === String(existing.employeeNo).toLowerCase() &&
      p.month === targetMonth
  );
  if (dup) {
    return error(res, `Pay slip for ${targetMonth} already exists for this employee`, 409);
  }

  const id = `PS_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const copyEarnings = req.body.copyAmounts !== false;
  const built = buildRecord(
    id,
    {
      ...existing,
      month: targetMonth,
      attendance:null,
      earnings: copyEarnings ? existing.earnings : {},
      deductions: copyEarnings ? existing.deductions : {},
      companyAddress: existing.companyAddress,
    },
    req.user,
    null
  );
  if (built.error) return error(res, built.error);

  upsert('payslips', built.record); await flush();
  return success(res, built.record, `Pay slip created for ${targetMonth}`, 201);
};

exports.remove = async (req, res) => {
  const existing = findById('payslips', req.params.id);
  if (!existing) return error(res, 'Pay slip not found', 404);
  if (existing.salaryReleasedAt || existing.slipReleasedAt) return error(res,'Released payroll cannot be deleted',409);
  if (!canAccessSlip(req.user, existing)) return error(res, 'You can only manage payroll in your branch', 403);
  removeById('payslips', req.params.id); await flush();
  return success(res, null, 'Pay slip deleted');
};

exports.release = async(req,res)=>{
  const slip=findById('payslips',req.params.id);
  if (!slip) return error(res,'Pay slip not found',404);
  if (!canAccessSlip(req.user,slip)) return error(res,'Forbidden',403);
  const kind=req.body.kind;
  if (!['salary','slip'].includes(kind)) return error(res,'Choose salary or slip release');
  const field=kind==='salary'?'salaryReleasedAt':'slipReleasedAt';
  if (slip[field]) return success(res,slip,'Already released');
  const reference=String(req.body.reference || '').trim();
  if (reference.length<3 || reference.length>500) return error(res,'Enter a payment reference or release reason (3–500 characters)');
  if (!Number.isFinite(slip.netPay) || slip.netPay<0) return error(res,'Fix invalid payroll amounts before release');
  const next={...slip,[field]:new Date().toISOString(),[kind+'ReleaseReference']:reference,[kind+'ReleasedBy']:req.user.id};
  upsert('payslips',next,{single:true});
  upsert('platformAudit',{id:require('crypto').randomUUID(),companyId:req.user.companyId,actorId:req.user.id,action:`payroll.${kind}.released`,targetId:slip.id,amount:slip.netPay,reference,createdAt:next[field]},{single:true});
  await flush();return success(res,next,kind==='salary'?'Salary payment recorded (no bank transfer is initiated)':'Salary slip released');
};

/**
 * Issue attendance-based payroll for one employee, one branch, or the whole company.
 * Existing slips for the month are refreshed so payroll can be safely re-run after a correction.
 */
exports.runPayroll = async (req, res) => {
  const month = normalizeMonth(req.body.month);
  const scope = String(req.body.scope || 'employee');
  if (!month) return error(res, 'Select a valid payroll month');
  if (!['employee', 'branch', 'company'].includes(scope)) return error(res, 'Choose employee, branch or company payroll');

  const people = getCollection('users').filter((user) => user.isActive !== false && !user.isDeleted && user.role !== 'superAdmin' && user.role !== 'admin');
  let targets = people;
  if (scope === 'employee') targets = people.filter((user) => user.id === req.body.employeeId);
  if (scope === 'branch') targets = people.filter((user) => user.branch === String(req.body.branch || '').trim());
  if (!targets.length) return error(res, scope === 'employee' ? 'Select an active employee' : 'No active employees match this payroll selection');

  const all = getCollection('payslips');
  const issued = [];
  const skipped = [];
  for (const employee of targets) {
    const existing = all.find((slip) => String(slip.employeeNo).toLowerCase() === String(employee.employeeId).toLowerCase() && slip.month === month);
    if (!actionAllowed(req.user, 'payslips', existing ? 'update' : 'create')) {
      skipped.push({ employeeId: employee.id, employeeName: employee.name, reason: `No permission to ${existing ? 'refresh' : 'issue'} payroll` });
      continue;
    }
    const built = buildRecord(
      existing?.id || `PS_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      {
        employeeName: employee.name,
        employeeNo: employee.employeeId,
        designation: employee.role === 'branchManager' ? 'Branch Manager' : 'Employee',
        department: employee.branch || '',
        bankName: employee.bankName || '',
        accountNo: employee.accountNo || '',
        month,
        autoPayroll: true,
        deductions: existing?.deductions || {},
      },
      req.user,
      existing || null
    );
    if (built.error) {
      skipped.push({ employeeId: employee.id, employeeName: employee.name, reason: built.error });
      continue;
    }
    upsert('payslips', built.record);
    issued.push({ id: built.record.id, employeeId: employee.id, employeeName: employee.name, status: existing ? 'refreshed' : 'issued' });
  }
  await flush();
  return success(res, { month, scope, issued, skipped, total: targets.length }, `${issued.length} salary slip(s) issued`);
};

/**
 * Bulk upsert many months for one employee.
 * Body: { employee..., months: [{ month, earnings, deductions }] }
 */
exports.bulkUpsert = async (req, res) => {
  const months = Array.isArray(req.body.months) ? req.body.months : [];
  if (!months.length) return error(res, 'At least one month required');
  if (months.length > 36) return error(res, 'Maximum 36 months per batch');

  const base = {
    employeeName: req.body.employeeName,
    employeeNo: req.body.employeeNo,
    designation: req.body.designation,
    department: req.body.department,
    bankName: req.body.bankName,
    accountNo: req.body.accountNo,
    companyAddress: req.body.companyAddress,
  };

  const saved = [];
  const all = getCollection('payslips');
  const empNo = String(base.employeeNo || '').trim().toLowerCase();

  for (const entry of months) {
    const month = normalizeMonth(entry.month);
    if (!month) return error(res, `Invalid month: ${entry.month}`);

    const existing = all.find(
      (p) => String(p.employeeNo).toLowerCase() === empNo && p.month === month
    );
    if (!actionAllowed(req.user, 'payslips', existing ? 'update' : 'create')) {
      return error(res, `You cannot ${existing ? 'edit' : 'create'} pay slips`, 403);
    }
    const id = existing?.id || `PS_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const built = buildRecord(
      id,
      {
        ...base,
        month,
        earnings: entry.earnings || {},
        deductions: entry.deductions || {},
        attendance:entry.attendance ?? existing?.attendance ?? null,
        autoPayroll:entry.autoPayroll ?? existing?.autoPayroll ?? false,
      },
      req.user,
      existing || null
    );
    if (built.error) return error(res, built.error);
    saved.push(built.record);
  }

  for (const record of saved) upsert('payslips', record); await flush();
  saved.sort((a, b) => a.month.localeCompare(b.month));
  return success(res, saved, `${saved.length} pay slip(s) saved`);
};
