const { v4: uuid } = require('uuid');
const { getCollection, upsert, findById } = require('../../lib/db');
const { success, error } = require('../../lib/response');

exports.getAll = (req, res) => {
  let items = getCollection('collections');
  const { status, date } = req.query;

  if (req.user.role === 'fieldOfficer') {
    items = items.filter((c) => c.employeeId === req.user.employeeId);
  } else if (req.user.role === 'branchManager') {
    items = items.filter((c) => c.branch === req.user.branch);
  }

  if (status) items = items.filter((c) => c.status === status);
  if (date) items = items.filter((c) => String(c.dueDate).startsWith(date));

  items.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
  return success(res, items);
};

exports.getDueToday = (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  let items = getCollection('collections').filter(
    (c) => c.status === 'due' && String(c.dueDate).startsWith(today)
  );

  if (req.user.role === 'fieldOfficer') {
    items = items.filter((c) => c.employeeId === req.user.employeeId);
  } else if (req.user.role === 'branchManager') {
    items = items.filter((c) => c.branch === req.user.branch);
  }

  return success(res, items);
};

exports.collect = (req, res) => {
  const { id, amount, mode, remarks } = req.body;
  if (!id || !amount) return error(res, 'Collection id and amount required');

  const item = findById('collections', id);
  if (!item) return error(res, 'Collection not found', 404);

  const collected = parseFloat(amount);
  if (collected <= 0) return error(res, 'Invalid amount');

  item.collectedAmount = (item.collectedAmount || 0) + collected;
  item.lastCollectedAt = new Date().toISOString();
  item.lastCollectedBy = req.user.employeeId;
  item.paymentMode = mode || 'cash';
  item.remarks = remarks || item.remarks || '';

  if (item.collectedAmount >= item.dueAmount) {
    item.status = 'collected';
  } else {
    item.status = 'partial';
  }

  upsert('collections', item);
  return success(res, item, 'Collection recorded');
};

exports.create = (req, res) => {
  const { customerName, mobile, loanId, dueAmount, dueDate, emiNumber } = req.body;
  if (!customerName || !mobile || !dueAmount) {
    return error(res, 'customerName, mobile, dueAmount required');
  }

  const item = {
    id: `COL_${uuid().slice(0, 8)}`,
    customerName,
    mobile,
    loanId: loanId || null,
    dueAmount: parseFloat(dueAmount),
    collectedAmount: 0,
    emiNumber: emiNumber || 1,
    dueDate: dueDate || new Date().toISOString().split('T')[0],
    status: 'due',
    branch: req.user.branch,
    employeeId: req.user.employeeId,
    createdAt: new Date().toISOString(),
  };

  upsert('collections', item);
  return success(res, item, 'Collection entry created', 201);
};
