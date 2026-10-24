const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { filterByBranch, sameBranch, isAdmin } = require('../../lib/rbac');
const PHOTO_FIELDS=[['customerPhoto','Customer photo'],['aadhaarFront','Aadhaar front'],['aadhaarBack','Aadhaar back'],['panFront','PAN front'],['shopPhoto1','Shop photo 1'],['shopPhoto2','Shop photo 2'],['shopPhoto3','Shop photo 3'],['shopPhoto4','Shop photo 4']];
function linkedListing(customer,actor){return getCollection('customerListings').filter(l=>l.status==='listed' && (l.id===customer.listingId || l.mobile===customer.mobile) && (isAdmin(actor) || sameBranch(actor,l.branch)))
 .sort((a,b)=>String(b.listedAt || b.createdAt || '').localeCompare(String(a.listedAt || a.createdAt || '')))[0];}

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
  const hasDocuments=c=>{if((c.documentPaths || []).length>0)return true;const listing=linkedListing(c,req.user);return PHOTO_FIELDS.some(([key])=>listing?.[key]);};
  if (hasDocs === 'yes') {
    customers = customers.filter(hasDocuments);
  } else if (hasDocs === 'no') {
    customers = customers.filter(c=>!hasDocuments(c));
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
  const listing=linkedListing(customer,req.user);
  const photos=listing ? PHOTO_FIELDS.filter(([key])=>listing[key]).map(([key,label])=>({key,label,media:listing[key]})) : [];
  const paths=new Set(photos.map(p=>typeof p.media==='string'?p.media:p.media?.filePath));
  (customer.documentPaths || []).forEach((media,index)=>{const path=typeof media==='string'?media:media?.filePath;if(path && !paths.has(path)){photos.push({key:`document-${index}`,label:`Additional document ${index+1}`,media});paths.add(path);}});
  res.set('Cache-Control','private, no-store');
  return success(res,{...customer,verification:{listingId:listing?.id || null,status:listing?'listed':'not_recorded',submittedAt:listing?.createdAt || null,listedAt:listing?.listedAt || null,submittedBy:listing?.createdBy || '',assignedToName:listing?.assignedToName || '',
    shopAddress:listing?.shopFullAddress || customer.address,latitude:listing?.shopLatitude ?? customer.latitude,longitude:listing?.shopLongitude ?? customer.longitude,photos,neighbors:listing?.neighbors || []}});
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
  } else if (!loc || !String(loc).trim()) {
    const userBranch = req.user.branch && String(req.user.branch).trim();
    const addr = address && String(address).trim();
    loc = userBranch || addr || 'All branches';
  }
  if (!loc || !String(loc).trim()) return error(res, 'Location required');

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
