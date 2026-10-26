const router = require('express').Router();
const { randomUUID } = require('crypto');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { getCollection, findById, upsert, flush } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { isAdmin, sameBranch } = require('../../lib/rbac');
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res)).catch(next);
const manager = user => ['admin','branchManager'].includes(user.role);
const visible = (record,user) => isAdmin(user) || record.recipientIds.includes(user.id) || (user.role === 'branchManager' && record.branch === user.branch);
router.use(authMiddleware);
router.get('/:kind', (req,res) => {
  const kind = req.params.kind;
  if (!['notices','visits'].includes(kind)) return error(res,'Not found',404);
  const records = getCollection(kind).filter(r=>visible(r,req.user)).map(r=>manager(req.user) ? r : {...r,recipientIds:undefined,recipientNames:undefined,acknowledgements:undefined,acknowledgedAt:r.acknowledgements?.[req.user.id] || null});
  return success(res,records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
});
router.post('/:kind', wrap(async(req,res)=>{
  const kind=req.params.kind, body=req.body;
  if (!['notices','visits'].includes(kind)) return error(res,'Not found',404);
  if (!manager(req.user) || (kind==='notices' && !isAdmin(req.user))) return error(res,'Only administrators can publish notices; managers can schedule branch visits',403);
  const title=String(body.title || '').trim(), description=String(body.description || '').trim();
  if (!title || title.length>150 || !description || description.length>4000) return error(res,'Enter a title (up to 150 characters) and details (up to 4000 characters)');
  const branch=isAdmin(req.user) ? String(body.branch || '') : req.user.branch;
  let people=getCollection('users').filter(u=>u.isActive!==false && !u.isDeleted && u.role!=='superAdmin' && (!branch || u.branch===branch));
  if (body.userId) people=people.filter(u=>u.id===body.userId);
  if (!people.length) return error(res,'No active employees match this audience');
  const record={id:randomUUID(),title,description,branch,recipientIds:people.map(u=>u.id),recipientNames:people.map(u=>u.name),createdAt:new Date().toISOString(),createdBy:req.user.id};
  if (kind==='notices') { record.important=body.important===true; record.acknowledgements={}; }
  else {
    if (!body.userId || people.length!==1) return error(res,'Select one employee for a visit');
    record.branch=people[0].branch;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(body.scheduledAt || '') || !Number.isFinite(Date.parse(body.scheduledAt))) return error(res,'Choose a valid visit date and time');
    record.scheduledAt=new Date(body.scheduledAt).toISOString(); record.location=String(body.location || '').trim();
    if (!record.location || record.location.length>500) return error(res,'Enter visit location (up to 500 characters)');
    if (body.customerId) { const customer=findById('customers',body.customerId); if (!customer || !sameBranch(people[0],customer.branch)) return error(res,'Customer must belong to the employee branch'); record.customerId=customer.id; }
    record.status='scheduled'; record.completionNote='';
  }
  upsert(kind,record,{single:true}); await flush(); return success(res,record,kind==='notices'?'Notice published':'Visit scheduled',201);
}));
router.post('/notices/:id/acknowledge',wrap(async(req,res)=>{
  const notice=findById('notices',req.params.id);
  if (!notice || !notice.recipientIds.includes(req.user.id)) return error(res,'Notice not found',404);
  const acknowledgements={...notice.acknowledgements};
  acknowledgements[req.user.id] ||= new Date().toISOString();
  upsert('notices',{...notice,acknowledgements},{single:true}); await flush();
  return success(res,{acknowledgedAt:acknowledgements[req.user.id]},'Acknowledgement recorded');
}));
router.put('/visits/:id',wrap(async(req,res)=>{
  const visit=findById('visits',req.params.id);
  if (!visit || !visible(visit,req.user)) return error(res,'Visit not found',404);
  const {status,completionNote}=req.body;
  if (!['completed','cancelled'].includes(status) || (status==='cancelled' && !manager(req.user))) return error(res,'Invalid visit action',403);
  if (visit.status!=='scheduled') return error(res,'Visit already closed. Schedule a new visit to visit again.',409);
  if (typeof completionNote!=='string' || completionNote.trim().length<3 || completionNote.length>2000) return error(res,'Enter completion/cancellation notes (3–2000 characters)');
  const next={...visit,status,completionNote:completionNote.trim(),updatedAt:new Date().toISOString(),updatedBy:req.user.id};
  upsert('visits',next,{single:true}); await flush();return success(res,next,'Visit updated');
}));
module.exports=router;
