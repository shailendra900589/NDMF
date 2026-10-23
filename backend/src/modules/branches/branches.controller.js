const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert, removeById, flush } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { isAdmin, sameBranch } = require('../../lib/rbac');
const { cleanCoord, cleanRadius, MIN_RADIUS_M, MAX_RADIUS_M } = require('../../lib/officeGeofence');

/** Reads office GPS + radius from the body. Returns an error message or the fields to set. */
function officeFields(body) {
  const out = {};
  const touchesLocation = body.officeLat !== undefined || body.officeLng !== undefined;
  if (touchesLocation) {
    const lat = cleanCoord(body.officeLat, 90);
    const lng = cleanCoord(body.officeLng, 180);
    if (lat === undefined || lng === undefined) return { error: 'Office latitude/longitude is not valid' };
    if ((lat === null) !== (lng === null)) return { error: 'Give both office latitude and longitude' };
    out.officeLat = lat;
    out.officeLng = lng;
  }
  if (body.attendanceRadiusM !== undefined) {
    const r = cleanRadius(body.attendanceRadiusM);
    if (r === undefined) return { error: `Radius must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M} metres` };
    out.attendanceRadiusM = r;
  }
  return { fields: out, touchesLocation };
}

exports.getAll = (req, res) => {
  let branches = getCollection('branches');
  if (!isAdmin(req.user)) {
    branches = branches.filter((b) => sameBranch(req.user, b.name));
  }
  branches.sort((a, b) => a.name.localeCompare(b.name));
  return success(res, branches);
};

exports.create = async (req, res) => {
  const { name, code, address, city, state } = req.body;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 160) return error(res, 'Branch name required (maximum 160 characters)');
  const branches = getCollection('branches');
  if (branches.some((b) => b.name.toLowerCase() === name.trim().toLowerCase())) {
    return error(res, 'Branch already exists');
  }
  const office = officeFields(req.body);
  if (office.error) return error(res, office.error);
  const branch = {
    id: `BR_${uuid().slice(0, 8)}`,
    name: name.trim(),
    code: (code || name.slice(0, 6)).toUpperCase().replace(/\s/g, '_'),
    address: address || '',
    city: city || '',
    state: state || '',
    isActive: true,
    officeLat: null,
    officeLng: null,
    attendanceRadiusM: null,
    ...office.fields,
    createdAt: new Date().toISOString(),
  };
  upsert('branches', branch);
  await flush();
  return success(res, branch, 'Branch created', 201);
};

const LINKED_COLLECTIONS=['users','customers','customerListings','attendance','tracking','liveLocations','callLogs','leads','loans','collections','payslips'];
const linkedTo=(record,branch)=>record.branchId===branch.id || (typeof record.branch==='string' && record.branch.trim()===branch.name.trim());

exports.update = async (req, res) => {
  const branch = findById('branches', req.params.id);
  if (!branch) return error(res, 'Branch not found', 404);
  const { name, address, city, state, isActive } = req.body;
  const office = officeFields(req.body);
  if (office.error) return error(res, office.error);
  if (name !== undefined && (typeof name!=='string' || !name.trim() || name.trim().length>160)) return error(res,'Branch name required (maximum 160 characters)');
  const nextName=name===undefined ? branch.name : name.trim();
  if(getCollection('branches').some(b=>b.id!==branch.id && b.name.trim().toLowerCase()===nextName.toLowerCase()))return error(res,'Branch already exists',409);
  if (nextName !== branch.name) {
    for(const collection of LINKED_COLLECTIONS)for(const record of getCollection(collection).filter(r=>linkedTo(r,branch))){
      upsert(collection,{...record,branch:nextName},{single:true});
    }
    branch.name=nextName;
  }
  if (address !== undefined) branch.address = address;
  if (city !== undefined) branch.city = city;
  if (state !== undefined) branch.state = state;
  if (typeof isActive === 'boolean') branch.isActive = isActive;
  Object.assign(branch, office.fields);
  if (office.touchesLocation) {
    branch.officeLocationUpdatedAt = new Date().toISOString();
    branch.officeLocationUpdatedBy = req.user.id;
  }
  upsert('branches', branch);
  await flush();
  return success(res, branch, 'Branch updated');
};

exports.remove = async (req,res) => {
  const branch=findById('branches',req.params.id);
  if(!branch)return error(res,'Branch not found',404);
  const links=LINKED_COLLECTIONS.filter(collection=>getCollection(collection).some(r=>linkedTo(r,branch)));
  if(links.length)return error(res,'Cannot delete this branch because it has linked employees, customers or operational records. Existing records must be preserved.',409);
  removeById('branches',branch.id);await flush();
  return success(res,{id:branch.id},'Branch deleted');
};
