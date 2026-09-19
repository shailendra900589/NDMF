/**
 * LOANS CONTROLLER
 * ----------------
 * Loan submit → verification → branch approval → admin approval
 *
 * Status flow:
 *   draft → verificationPending → branchPending → adminPending → approved/rejected
 */
const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');

const APPROVAL_MAP = {
  approve: { branchPending: 'adminPending', default: 'adminPending' },
  reject: { any: 'rejected' },
  rework: { any: 'verificationPending' },
  finalApprove: { any: 'approved' },
  finalReject: { any: 'rejected' },
};

function resolveStatus(current, action) {
  if (action === 'reject' || action === 'finalReject') return 'rejected';
  if (action === 'rework') return 'verificationPending';
  if (action === 'finalApprove') return 'approved';
  if (action === 'approve') {
    if (current === 'branchPending') return 'adminPending';
    return 'adminPending';
  }
  return current;
}

exports.getAll = (req, res) => {
  let loans = getCollection('loans');
  const { status, search } = req.query;
  if (status) loans = loans.filter((l) => l.status === status);
  if (search) {
    const q = search.toLowerCase();
    loans = loans.filter(
      (l) =>
        l.customer?.name?.toLowerCase().includes(q) ||
        l.customer?.mobile?.includes(q)
    );
  }
  return success(res, loans);
};

exports.getById = (req, res) => {
  const loan = findById('loans', req.params.id);
  if (!loan) return error(res, 'Loan not found', 404);
  return success(res, loan);
};

exports.getForApproval = (req, res) => {
  let loans = getCollection('loans');
  const { status } = req.query;

  if (status) {
    loans = loans.filter((l) => l.status === status);
  } else {
    loans = loans.filter((l) =>
      ['verificationPending', 'branchPending', 'adminPending'].includes(l.status)
    );
  }

  // Role-based filter
  if (req.user.role === 'branchManager') {
    loans = loans.filter((l) => l.status === 'branchPending');
  } else if (req.user.role === 'admin') {
    loans = loans.filter((l) => l.status === 'adminPending');
  }

  return success(res, loans);
};

exports.submit = (req, res) => {
  const body = req.body;
  const loan = {
    id: body.id || `LOAN_${uuid().slice(0, 8)}`,
    customer: body.customer || {},
    business: body.business || {},
    guarantor: body.guarantor || {},
    documents: body.documents || {},
    location: body.location || {},
    verification: body.verification || { status: 'pending', remarks: '', riskRating: 'Low', recommendedAmount: 0 },
    status: 'verificationPending',
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSynced: true,
    leadId: body.leadId || null,
    createdBy: req.user.employeeId,
  };
  upsert('loans', loan);
  return success(res, loan, 'Loan submitted for verification', 201);
};

exports.saveVerification = (req, res) => {
  const loan = findById('loans', req.params.id);
  if (!loan) return error(res, 'Loan not found', 404);

  const { verification, submit } = req.body;
  loan.verification = { ...loan.verification, ...verification };
  loan.status = submit ? 'branchPending' : 'verificationPending';
  loan.updatedAt = new Date().toISOString();
  upsert('loans', loan);
  return success(res, loan, submit ? 'Verification submitted' : 'Verification saved');
};

exports.processApproval = (req, res) => {
  const { loanId, action } = req.body;
  const loan = findById('loans', loanId);
  if (!loan) return error(res, 'Loan not found', 404);

  loan.status = resolveStatus(loan.status, action);
  loan.updatedAt = new Date().toISOString();
  upsert('loans', loan);
  return success(res, loan, `Loan ${action} successful`);
};

exports.disburse = (req, res) => {
  const loan = findById('loans', req.params.id);
  if (!loan) return error(res, 'Loan not found', 404);
  if (loan.status !== 'approved') return error(res, 'Only approved loans can be disbursed');

  loan.status = 'disbursed';
  loan.updatedAt = new Date().toISOString();
  upsert('loans', loan);
  return success(res, loan, 'Loan disbursed');
};
