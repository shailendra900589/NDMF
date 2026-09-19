const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { isAdmin, sameBranch } = require('../../lib/rbac');

exports.getAll = (req, res) => {
  let branches = getCollection('branches');
  if (!isAdmin(req.user)) {
    branches = branches.filter((b) => sameBranch(req.user, b.name));
  }
  branches.sort((a, b) => a.name.localeCompare(b.name));
  return success(res, branches);
};

exports.create = (req, res) => {
  const { name, code, address, city, state } = req.body;
  if (!name?.trim()) return error(res, 'Branch name required');
  const branches = getCollection('branches');
  if (branches.some((b) => b.name.toLowerCase() === name.trim().toLowerCase())) {
    return error(res, 'Branch already exists');
  }
  const branch = {
    id: `BR_${uuid().slice(0, 8)}`,
    name: name.trim(),
    code: (code || name.slice(0, 6)).toUpperCase().replace(/\s/g, '_'),
    address: address || '',
    city: city || '',
    state: state || '',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  upsert('branches', branch);
  return success(res, branch, 'Branch created', 201);
};

exports.update = (req, res) => {
  const branch = findById('branches', req.params.id);
  if (!branch) return error(res, 'Branch not found', 404);
  const { name, address, city, state, isActive } = req.body;
  if (name) branch.name = name.trim();
  if (address !== undefined) branch.address = address;
  if (city !== undefined) branch.city = city;
  if (state !== undefined) branch.state = state;
  if (typeof isActive === 'boolean') branch.isActive = isActive;
  upsert('branches', branch);
  return success(res, branch, 'Branch updated');
};
