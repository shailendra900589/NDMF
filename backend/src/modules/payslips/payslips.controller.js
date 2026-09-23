/**
 * PAY SLIPS — admin only
 * Individual slips per employee per month (YYYY-MM).
 */
const { getCollection, findById, upsert, removeById } = require('../../lib/db');
const { success, error } = require('../../lib/response');

const COMPANY_NAME = 'Nirmaldhara Micro Foundation';
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

function buildRecord(id, body, actorId, existing) {
  const v = validateBody(body);
  if (!v.ok) return { error: v.message };
  const { earnings, deductions, grossSalary, totalDeductions, netPay } = compute(
    body.earnings,
    body.deductions
  );
  return {
    record: {
      id,
      companyName: COMPANY_NAME,
      companyAddress: String(body.companyAddress ?? existing?.companyAddress ?? DEFAULT_ADDRESS).trim(),
      employeeName: v.employeeName,
      employeeNo: v.employeeNo,
      designation: String(body.designation || '').trim(),
      department: String(body.department || '').trim(),
      bankName: String(body.bankName || '').trim(),
      accountNo: String(body.accountNo || '').trim(),
      month: v.month,
      earnings,
      deductions,
      grossSalary,
      totalDeductions,
      netPay,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: existing?.createdBy || actorId,
      updatedBy: actorId,
    },
  };
}

exports.list = (req, res) => {
  const all = getCollection('payslips');
  const { employeeNo, month, search } = req.query;
  let list = [...all];
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
  return success(res, slip);
};

exports.create = (req, res) => {
  const id = `PS_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const built = buildRecord(id, req.body, req.user.id, null);
  if (built.error) return error(res, built.error);

  const dup = getCollection('payslips').find(
    (p) =>
      String(p.employeeNo).toLowerCase() === String(built.record.employeeNo).toLowerCase() &&
      p.month === built.record.month
  );
  if (dup) {
    return error(res, 'Pay slip already exists for this employee and month. Edit that slip or add next month.', 409);
  }

  upsert('payslips', built.record);
  return success(res, built.record, 'Pay slip created', 201);
};

exports.update = (req, res) => {
  const existing = findById('payslips', req.params.id);
  if (!existing) return error(res, 'Pay slip not found', 404);

  const built = buildRecord(existing.id, { ...existing, ...req.body }, req.user.id, existing);
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

  upsert('payslips', built.record);
  return success(res, built.record, 'Pay slip updated');
};

/** Copy employee details into the next month (or specified month). */
exports.addMonth = (req, res) => {
  const existing = findById('payslips', req.params.id);
  if (!existing) return error(res, 'Pay slip not found', 404);

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
      earnings: copyEarnings ? existing.earnings : {},
      deductions: copyEarnings ? existing.deductions : {},
      companyAddress: existing.companyAddress,
    },
    req.user.id,
    null
  );
  if (built.error) return error(res, built.error);

  upsert('payslips', built.record);
  return success(res, built.record, `Pay slip created for ${targetMonth}`, 201);
};

exports.remove = (req, res) => {
  const existing = findById('payslips', req.params.id);
  if (!existing) return error(res, 'Pay slip not found', 404);
  removeById('payslips', req.params.id);
  return success(res, null, 'Pay slip deleted');
};

/**
 * Bulk upsert many months for one employee.
 * Body: { employee..., months: [{ month, earnings, deductions }] }
 */
exports.bulkUpsert = (req, res) => {
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
    const id = existing?.id || `PS_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const built = buildRecord(
      id,
      {
        ...base,
        month,
        earnings: entry.earnings || {},
        deductions: entry.deductions || {},
      },
      req.user.id,
      existing || null
    );
    if (built.error) return error(res, built.error);
    upsert('payslips', built.record);
    saved.push(built.record);
  }

  saved.sort((a, b) => a.month.localeCompare(b.month));
  return success(res, saved, `${saved.length} pay slip(s) saved`);
};
