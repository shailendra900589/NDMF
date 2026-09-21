const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { filterByBranch, sameBranch, isAdmin } = require('../../lib/rbac');

exports.getAll = (req, res) => {
  let customers = getCollection('customers');
  customers = filterByBranch(customers, req.user, 'branch');

  const { search, branch, hasDocs } = req.query;
  if (branch) {
    customers = customers.filter(
      (c) => String(c.branch || '').toLowerCase() === String(branch).toLowerCase()
    );
  }
  if (search) {
    const q = search.toLowerCase();
    customers = customers.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.mobile || '').includes(q) ||
        (c.aadhaar || '').includes(q) ||
        (c.pan || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    );
  }
  if (hasDocs === 'yes') {
    customers = customers.filter((c) => (c.documentPaths || []).length > 0);
  } else if (hasDocs === 'no') {
    customers = customers.filter((c) => !(c.documentPaths || []).length);
  }

  customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return success(res, customers);
};

exports.getById = (req, res) => {
  const customer = findById('customers', req.params.id);
  if (!customer) return error(res, 'Customer not found', 404);
  if (!isAdmin(req.user) && !sameBranch(req.user, customer.branch)) {
    return error(res, 'Forbidden', 403);
  }
  return success(res, customer);
};

exports.create = (req, res) => {
  const { name, mobile, address, aadhaar, pan, latitude, longitude, branch } = req.body;
  if (!name || !String(name).trim()) return error(res, 'Name required');
  if (!mobile || String(mobile).replace(/\D/g, '').length < 10) {
    return error(res, 'Valid 10-digit mobile required');
  }

  const cleanMobile = String(mobile).replace(/\D/g, '').slice(0, 10);
  const customers = getCollection('customers');
  if (customers.some((c) => c.mobile === cleanMobile)) {
    return error(res, 'Customer with this mobile already exists', 409);
  }

  let loc = branch;
  if (!isAdmin(req.user)) {
    loc = req.user.branch;
  } else if (!loc) {
    loc = req.user.branch || '';
  }
  if (!loc) return error(res, 'Location required');

  const record = {
    id: `C_${uuid().slice(0, 8)}`,
    name: String(name).trim(),
    mobile: cleanMobile,
    address: address || '',
    aadhaar: aadhaar || '',
    pan: pan || '',
    latitude: Number(latitude) || 0,
    longitude: Number(longitude) || 0,
    listingId: null,
    branch: loc,
    documentPaths: [],
    loanHistory: [],
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
  };

  upsert('customers', record);
  return success(res, record, 'Customer created', 201);
};
