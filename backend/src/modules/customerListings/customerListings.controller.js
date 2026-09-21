const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { filterByBranch, sameBranch, isAdmin } = require('../../lib/rbac');

function resolveListingStatus(current, action) {
  if (action === 'reject' || action === 'finalReject') return 'rejected';
  if (action === 'rework') return 'draft';
  if (action === 'finalApprove') return 'listed';
  if (action === 'approve') return 'adminPending';
  return current;
}

function createCustomerFromListing(listing) {
  const customers = getCollection('customers');
  if (customers.some((c) => c.mobile === listing.mobile)) return;

  const photoPaths = [
    listing.customerPhoto,
    listing.aadhaarFront,
    listing.aadhaarBack,
    listing.panFront,
    listing.shopPhoto1,
    listing.shopPhoto2,
    listing.shopPhoto3,
    listing.shopPhoto4,
  ]
    .filter(Boolean)
    .map((p) => (typeof p === 'string' ? p : p.filePath));

  upsert('customers', {
    id: `C_${listing.id}`,
    name: listing.name,
    mobile: listing.mobile,
    address: listing.shopFullAddress,
    aadhaar: listing.aadhaar,
    pan: listing.pan,
    latitude: listing.shopLatitude,
    longitude: listing.shopLongitude,
    listingId: listing.id,
    branch: listing.branch,
    documentPaths: photoPaths,
    loanHistory: [],
    createdAt: new Date().toISOString(),
  });
}

exports.getAll = (req, res) => {
  let listings = getCollection('customerListings');
  listings = filterByBranch(listings, req.user, 'branch');
  const { status, search } = req.query;
  if (status) listings = listings.filter((l) => l.status === status);
  if (search) {
    const q = search.toLowerCase();
    listings = listings.filter(
      (l) =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.mobile || '').includes(q) ||
        (l.shopFullAddress || '').toLowerCase().includes(q)
    );
  }
  return success(res, listings);
};

exports.getById = (req, res) => {
  const listing = findById('customerListings', req.params.id);
  if (!listing) return error(res, 'Listing not found', 404);
  if (!isAdmin(req.user) && !sameBranch(req.user, listing.branch)) {
    return error(res, 'Forbidden', 403);
  }
  return success(res, listing);
};

exports.getForApproval = (req, res) => {
  let listings = getCollection('customerListings');
  listings = filterByBranch(listings, req.user, 'branch');
  const { status } = req.query;

  if (status) {
    listings = listings.filter((l) => l.status === status);
  } else {
    listings = listings.filter((l) => ['branchPending', 'adminPending'].includes(l.status));
  }

  if (req.user.role === 'branchManager') {
    listings = listings.filter((l) => l.status === 'branchPending');
  } else if (req.user.role === 'admin') {
    listings = listings.filter((l) => l.status === 'adminPending');
  }

  return success(res, listings);
};

exports.submit = (req, res) => {
  const body = req.body;
  const listing = {
    id: body.id || `CL_${uuid().slice(0, 8)}`,
    name: body.name || '',
    mobile: body.mobile || '',
    aadhaar: body.aadhaar || '',
    pan: body.pan || '',
    customerPhoto: body.customerPhoto || null,
    aadhaarFront: body.aadhaarFront || null,
    aadhaarBack: body.aadhaarBack || null,
    panFront: body.panFront || null,
    shopPhoto1: body.shopPhoto1 || null,
    shopPhoto2: body.shopPhoto2 || null,
    shopPhoto3: body.shopPhoto3 || null,
    shopPhoto4: body.shopPhoto4 || null,
    shopFullAddress: body.shopFullAddress || '',
    shopLatitude: body.shopLatitude || 0,
    shopLongitude: body.shopLongitude || 0,
    neighbors: body.neighbors || [],
    status: 'branchPending',
    branch: req.user.branch,
    createdAt: body.createdAt || new Date().toISOString(),
    listedAt: null,
    isSynced: true,
    createdBy: req.user.employeeId,
    userId: req.user.id,
  };
  upsert('customerListings', listing);
  return success(res, listing, 'Customer listing submitted for branch approval', 201);
};

exports.assignOfficer = (req, res) => {
  const listing = findById('customerListings', req.params.id);
  if (!listing) return error(res, 'Listing not found', 404);
  if (!isAdmin(req.user) && req.user.role !== 'branchManager') {
    return error(res, 'Only branch manager or admin can assign', 403);
  }
  if (!isAdmin(req.user) && !sameBranch(req.user, listing.branch)) {
    return error(res, 'Forbidden', 403);
  }

  const { employeeId, employeeName } = req.body;
  if (!employeeId || !employeeName) {
    return error(res, 'employeeId and employeeName required');
  }

  const users = getCollection('users');
  const officer = users.find(
    (u) =>
      u.employeeId === employeeId &&
      u.role === 'fieldOfficer' &&
      (isAdmin(req.user) || sameBranch(req.user, u.branch))
  );
  if (!officer) return error(res, 'Field officer not found in your branch', 404);

  listing.assignedToEmployeeId = employeeId;
  listing.assignedToName = employeeName.trim();
  listing.assignedAt = new Date().toISOString();
  upsert('customerListings', listing);
  return success(res, listing, 'Listing assigned to field officer');
};

exports.processApproval = (req, res) => {
  const { id, action } = req.body;
  const listing = findById('customerListings', id);
  if (!listing) return error(res, 'Listing not found', 404);
  if (!isAdmin(req.user) && !sameBranch(req.user, listing.branch)) {
    return error(res, 'Forbidden', 403);
  }

  listing.status = resolveListingStatus(listing.status, action);
  if (listing.status === 'listed') {
    listing.listedAt = new Date().toISOString();
    createCustomerFromListing(listing);
  }
  upsert('customerListings', listing);
  return success(res, listing, `Listing ${action} successful`);
};
