const { getCollection, findById } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { filterByBranch, sameBranch, isAdmin } = require('../../lib/rbac');

exports.getAll = (req, res) => {
  let customers = getCollection('customers');
  customers = filterByBranch(customers, req.user, 'branch');
  const { search } = req.query;
  if (search) {
    const q = search.toLowerCase();
    customers = customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.mobile.includes(q)
    );
  }
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
