const express = require('express');
const { randomUUID, randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { getCollection, findById, upsert, flush } = require('../../lib/db');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');
const { success, error } = require('../../lib/response');
const router = express.Router();
const admin = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
// An explicit output contract prevents credentials, biometric templates and private files leaking.
const catalog = {
  customers: { module: 'customers', collection: 'customers', fields: ['id','name','mobile','branch','status','createdAt'] },
  listings: { module: 'customerListings', collection: 'customerListings', fields: ['id','name','mobile','branch','status','createdAt'] },
  attendance: { module: 'attendance', collection: 'attendance', fields: ['id','userId','date','checkInTime','checkOutTime','status'] },
  employees: { module: 'users', collection: 'users', fields: ['id','name','employeeId','role','branch','isActive'] },
  locations: { module: 'branches', collection: 'branches', fields: ['id','name','code','isActive'] },
};
const buckets = new Map();
function limited(key, max, windowMs) {
  const time = Date.now();
  if (buckets.size > 10000) for (const [k, b] of buckets) if (b.until <= time) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.until <= time) { buckets.set(key, { count: 1, until: time + windowMs }); return false; }
  return ++b.count > max;
}
const safe = ({ tokenHash, ...record }) => record;
function audit(req, action, record) {
  upsert('platformAudit', { id: randomUUID(), actorId: req.user.id, actorName: req.user.name,
    action, companyId: record.companyId, targetId: record.id, createdAt: now() }, { single: true });
}
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/catalog', (_, res) => success(res, Object.fromEntries(Object.entries(catalog).map(([k,v]) => [k, { scope: `${k}:read`, fields: v.fields }]))));
router.post('/applications', wrap(async (req, res) => {
  if (limited(`apply:${req.ip}`, 5, 3600000)) { res.set('Retry-After','3600'); return error(res, 'Too many requests. Try again in one hour.',429); }
  const { name, email, organization, purpose, scopes, requestedDays, consent } = req.body;
  if (![name,email,organization,purpose].every(v => typeof v === 'string' && v.trim().length > 1 && v.length <= 2000)
    || name.length > 120 || email.length > 254 || organization.length > 160
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || consent !== true
    || !Array.isArray(scopes) || !scopes.length || scopes.length > 5 || scopes.some(s => !Object.keys(catalog).some(k => s === `${k}:read`))
    || !Number.isInteger(requestedDays) || requestedDays < 1 || requestedDays > 365) return error(res,'Enter valid contact details, purpose, scopes, duration (1–365 days) and consent.');
  const record = { id: `APP_${randomUUID()}`, name: name.trim(), email: email.trim().toLowerCase(), organization: organization.trim(),
    purpose: purpose.trim(), scopes: [...new Set(scopes)], requestedDays, status:'pending', consentAt:now(), createdAt:now() };
  upsert('apiApplications',record,{single:true}); await flush();
  return success(res,{ id:record.id, status:record.status },'Application submitted. Keep your reference; approval does not happen automatically.',201);
}));
admin.use(authMiddleware, requireRole('superAdmin'));
admin.get('/', (_,res) => success(res,{ applications: [...getCollection('apiApplications')].reverse(), grants: getCollection('apiGrants').map(safe).reverse(), companies:getCollection('companies').map(c => ({id:c.id,name:c.name,isActive:c.isActive})), scopes:Object.keys(catalog).map(k => `${k}:read`) }));
admin.post('/applications/:id/reject', wrap(async (req,res) => {
  const a = findById('apiApplications',req.params.id);
  if (!a || a.status !== 'pending') return error(res,'Pending application not found',404);
  const record = {...a,status:'rejected',reviewedAt:now(),reviewedBy:req.user.id};
  upsert('apiApplications',record,{single:true}); audit(req,'api.application.rejected',record); await flush(); return success(res,record);
}));
function issue(req, res, rotate = false, directSource = null) {
  return (async () => {
    const source = directSource || findById(rotate ? 'apiGrants' : 'apiApplications',req.params.id);
    if (!source || (!rotate && source.status !== 'pending')) return error(res,'Pending application or grant not found',404);
    if (rotate && (source.status !== 'active' || Date.parse(source.expiresAt) <= Date.now())) return error(res,'Expired or revoked grants cannot be rotated',409);
    const companyId = rotate ? source.companyId : req.body.companyId;
    const company = findById('companies',companyId);
    const { scopes, days, requestsPerMinute } = req.body;
    if (!company || !company.isActive) return error(res,'Select an active company');
    if (!rotate && (!Array.isArray(scopes) || !scopes.length || scopes.some(s => !Object.keys(catalog).some(k => s === `${k}:read`))
      || !Number.isInteger(days) || days < 1 || days > 365 || !Number.isInteger(requestsPerMinute) || requestsPerMinute < 1 || requestsPerMinute > 600)) return error(res,'Choose scopes, 1–365 days and 1–600 requests per minute');
    const id = rotate ? source.id : `KEY_${randomUUID()}`;
    const token = `ndfa_${randomBytes(32).toString('hex')}`;
    const grant = { ...(rotate ? source : {id,applicationId:source.id,companyId,organization:source.organization,email:source.email,
      name:source.name,source:directSource ? 'super_admin' : 'onboarding',scopes:[...new Set(scopes)],expiresAt:new Date(Date.now()+days*86400000).toISOString(),requestsPerMinute,createdAt:now(),createdBy:req.user.id}),
      status:'active',tokenHash:hash(token), keyHint:token.slice(-6), rotatedAt:rotate ? now() : null };
    upsert('apiGrants',grant,{single:true});
    if (!rotate) upsert('apiApplications',{...source,status:'approved',reviewedAt:now(),reviewedBy:req.user.id},{single:true});
    audit(req,rotate ? 'api.key.rotated' : directSource ? 'api.access.created' : 'api.application.approved',grant); await flush();
    return success(res,{grant:safe(grant),token},'Copy the secret now. It cannot be retrieved again.',201);
  })();
}
admin.post('/grants',wrap((req,res) => {
  const {name,email,organization,purpose}=req.body;
  if (![name,email,organization,purpose].every(v=>typeof v==='string' && v.trim().length>1)
    || name.length>120 || email.length>254 || organization.length>160 || purpose.length>2000
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error(res,'Enter valid developer contact, organization and purpose');
  return issue(req,res,false,{id:`APP_${randomUUID()}`,name:name.trim(),email:email.trim().toLowerCase(),organization:organization.trim(),purpose:purpose.trim(),
    scopes:req.body.scopes,requestedDays:req.body.days,status:'pending',source:'super_admin',createdBy:req.user.id,createdAt:now()});
}));
admin.post('/applications/:id/approve',wrap((req,res) => issue(req,res)));
admin.post('/grants/:id/rotate',wrap((req,res) => issue(req,res,true)));
admin.post('/grants/:id/revoke',wrap(async (req,res) => {
  const grant = findById('apiGrants',req.params.id); if (!grant) return error(res,'Grant not found',404);
  const record={...grant,status:'revoked',revokedAt:now()}; upsert('apiGrants',record,{single:true}); audit(req,'api.key.revoked',record); await flush(); return success(res,safe(record));
}));
router.use('/manage',admin);
router.get('/data/:resource',wrap(async (req,res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /,'');
  const digest = hash(token);
  const grant = token.startsWith('ndfa_') && getCollection('apiGrants').find(g => timingSafeEqual(Buffer.from(g.tokenHash,'hex'),Buffer.from(digest,'hex')));
  if (!grant || grant.status !== 'active' || Date.parse(grant.expiresAt) <= Date.now()) return error(res,'Invalid, expired or revoked API key',401);
  const company = findById('companies',grant.companyId);
  const spec = catalog[req.params.resource];
  if (!company?.isActive || !spec || !grant.scopes.includes(`${req.params.resource}:read`) || company.modules?.[spec.module] === false || company.actions?.[spec.module]?.export === false) return error(res,'Company or scope access is disabled',403);
  if (limited(`key:${grant.id}`,grant.requestsPerMinute,60000)) { res.set('Retry-After','60'); return error(res,'Request limit exceeded',429); }
  const page = Number(req.query.page || 1), limit = Number(req.query.limit || 50);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return error(res,'page must be positive; limit must be 1–100');
  const records=getCollection(spec.collection).filter(r => r.companyId === grant.companyId && r.role !== 'superAdmin');
  const items=records.slice((page-1)*limit,page*limit).map(r => Object.fromEntries(spec.fields.filter(f => r[f] !== undefined).map(f => [f,r[f]])));
  upsert('apiGrants',{...grant,lastUsedAt:now(),requestCount:(grant.requestCount || 0)+1},{single:true,deferMs:30000});
  return success(res,{items,page,limit,total:records.length},'Company data');
}));
module.exports = router;
