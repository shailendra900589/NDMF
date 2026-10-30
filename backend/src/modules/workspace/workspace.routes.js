const router = require('express').Router();
const { randomUUID } = require('crypto');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { getCollection, findById, upsert, flush } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { isAdmin, sameBranch } = require('../../lib/rbac');
const { ownsUpload } = require('../../lib/uploadOwnership');
const fs = require('node:fs');
const path = require('node:path');
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res)).catch(next);
const manager = user => ['admin','branchManager'].includes(user.role);
const visible = (record,user) => isAdmin(user) || record.recipientIds.includes(user.id) || (user.role === 'branchManager' && sameBranch(user, record.branch));
const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
const validPosition = value => value && typeof value.lat === 'number' && typeof value.lng === 'number' && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180 && (value.capturedAt === undefined || (Number.isFinite(Date.parse(value.capturedAt)) && Date.parse(value.capturedAt) <= Date.now()+300000));
const uploadPath = value => {
  const match = String(value || '').match(/^(?:https?:\/\/[^/]+)?\/uploads\/([a-zA-Z0-9_.-]+)(?:\?[^\s]*)?$/);
  return match ? match[1] : null;
};
const visitAssignee = (visit, user) => Array.isArray(visit.recipientIds) && visit.recipientIds.includes(user.id);
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
  // Notices have a human-written heading. Visits deliberately use the selected
  // customer's name as their heading so a field employee always sees a useful,
  // unambiguous destination rather than a free-text title.
  if ((kind==='notices' && (!title || title.length>150)) || !description || description.length>4000) return error(res,kind==='notices'?'Enter a title (up to 150 characters) and details (up to 4000 characters)':'Enter visit details (up to 4000 characters)');
  const branch=isAdmin(req.user) ? String(body.branch || '') : req.user.branch;
  let people=getCollection('users').filter(u=>u.isActive!==false && !u.isDeleted && u.role!=='superAdmin' && (!branch || sameBranch(u, branch)));
  if (body.userId) people=people.filter(u=>u.id===body.userId);
  if (!people.length) return error(res,'No active employees match this audience');
  const record={id:randomUUID(),title,description,branch,recipientIds:people.map(u=>u.id),recipientNames:people.map(u=>u.name),createdAt:new Date().toISOString(),createdBy:req.user.id};
  if (kind==='notices') { record.important=body.important===true; record.acknowledgements={}; }
  else {
    if (!body.userId || people.length!==1) return error(res,'Select one employee for a visit');
    record.branch=branch || people[0].branch;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(body.scheduledAt || '') || !Number.isFinite(Date.parse(body.scheduledAt))) return error(res,'Choose a valid visit date and time');
    record.scheduledAt=new Date(body.scheduledAt).toISOString(); record.location=String(body.location || '').trim();
    if (record.location.length>500) return error(res,'Visit location can contain up to 500 characters');
    const customerIds=[...new Set([body.customerId,...(Array.isArray(body.customerIds)?body.customerIds:[])].filter(Boolean))];
    const leadIds=[...new Set((Array.isArray(body.leadIds)?body.leadIds:[]).filter(Boolean))];
    const targets=[];
    for (const id of customerIds) {
      const customer=findById('customers',id);
      // A branch manager may only schedule their own branch. A company admin can
      // assign any active employee to a customer from any company branch.
      if (!customer || (!isAdmin(req.user) && !sameBranch(req.user,customer.branch))) return error(res,'A selected customer is unavailable in your branch');
      targets.push({customerId:customer.id,targetType:'customer',targetName:customer.name,branch:customer.branch,location:customer.address || record.location,destinationGps:Number(customer.latitude) && Number(customer.longitude) ? {lat:Number(customer.latitude),lng:Number(customer.longitude)} : null});
    }
    for (const id of leadIds) {
      const lead=findById('leads',id);
      if (!lead || (!isAdmin(req.user) && !sameBranch(req.user,lead.branch))) return error(res,'A selected lead is unavailable in your branch');
      targets.push({leadId:lead.id,targetType:'lead',targetName:lead.name || lead.mobile || 'Lead',branch:lead.branch,location:lead.address || record.location,destinationGps:Number(lead.latitude) && Number(lead.longitude) ? {lat:Number(lead.latitude),lng:Number(lead.longitude)} : null});
    }
    record.status='scheduled'; record.completionNote='';
    // Retain the older API form for integrations that already create a general
    // location visit. The staff console only creates customer-backed visits.
    if (!targets.length && record.location) targets.push({targetType:'general',targetName:title || 'General visit',location:record.location,branch:record.branch,destinationGps:null});
    if (!targets.length) return error(res,'Select at least one existing customer for this visit');
    const visits=targets.map(target=>({...record,...target,title:target.targetType==='general' ? target.targetName : `Visit · ${target.targetName}`,targetMobile:target.customerId?findById('customers',target.customerId)?.mobile || '':target.leadId?findById('leads',target.leadId)?.mobile || '':'',id:randomUUID(),location:target.location || record.location}));
    visits.forEach(visit=>upsert('visits',visit,{single:true})); await flush();
    return success(res,visits.length === 1 ? visits[0] : visits,`${visits.length} visit${visits.length===1?'':'s'} scheduled`,201);
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
router.post('/visits/:id/start',wrap(async(req,res)=>{
  const visit=findById('visits',req.params.id);
  if (!visit || !visible(visit,req.user)) return error(res,'Visit not found',404);
  if (!visitAssignee(visit,req.user)) return error(res,'Only the assigned employee can start this visit',403);
  if (visit.status==='completed') return success(res,visit,'Visit already submitted');
  if (!['scheduled','in_progress'].includes(visit.status)) return error(res,'This visit is already closed',409);
  const position=req.body?.position;
  if (!validPosition(position)) return error(res,'A live GPS location is required to start the visit');
  const now=new Date().toISOString();
  const next={...visit,status:'in_progress',startedAt:visit.startedAt || now,startedBy:req.user.id,startGps:visit.startGps || {lat:Number(position.lat),lng:Number(position.lng),accuracy:Number(position.accuracy) || null,capturedAt:position.capturedAt || now,receivedAt:now},updatedAt:now,updatedBy:req.user.id};
  upsert('visits',next,{single:true}); await flush();
  return success(res,next,visit.startedAt?'Visit remains in progress':'Visit started');
}));
router.post('/visits/:id/complete',wrap(async(req,res)=>{
  const visit=findById('visits',req.params.id), body=req.body || {};
  if (!visit || !visible(visit,req.user)) return error(res,'Visit not found',404);
  if (!visitAssignee(visit,req.user)) return error(res,'Only the assigned employee can complete this visit',403);
  if (visit.status==='completed' && visit.verification) return success(res,visit,'Visit already submitted');
  if (visit.status !== 'in_progress') return error(res,'Start the visit with live GPS before completing it',409);
  const discussion=String(body.discussion || '').trim(), remarks=String(body.remarks || '').trim();
  const purposes=['recovery','shop_verification','document_collection','customer_meeting','other'];
  const results=['completed','customer_unavailable','shop_closed','payment_promised','revisit_required'];
  if (discussion.length < 3 || discussion.length > 4000) return error(res,'Enter the visit discussion (3–4000 characters)');
  if (!purposes.includes(body.purpose) || !results.includes(body.result)) return error(res,'Choose a valid visit purpose and result');
  if (remarks.length > 2000) return error(res,'Remarks can contain up to 2000 characters');
  if ((body.paymentPromiseDate && !isoDate(body.paymentPromiseDate)) || (body.nextFollowUpDate && !isoDate(body.nextFollowUpDate))) return error(res,'Use valid dates for payment promise and follow-up');
  if (body.paymentAmount !== undefined && body.paymentAmount !== '' && (!Number.isFinite(Number(body.paymentAmount)) || Number(body.paymentAmount) < 0)) return error(res,'Payment amount must be zero or greater');
  const filename=uploadPath(body.photo);
  if (!filename || !ownsUpload(filename,req.user.companyId)) return error(res,'Capture and upload a new visit photo before completing the visit');
  const photoFile=path.join(__dirname,'../../../uploads',filename);
  if (!/\.(jpg|jpeg|png|webp)$/i.test(filename) || !fs.existsSync(photoFile)) return error(res,'The uploaded visit photo was not found');
  if (!validPosition(body.photoGps)) return error(res,'The visit photo must include a live GPS location');
  const now=new Date().toISOString();
  const verification={discussion,purpose:body.purpose,result:body.result,paymentPromiseDate:body.paymentPromiseDate || null,paymentAmount:body.paymentAmount === undefined || body.paymentAmount === '' ? null : Number(body.paymentAmount),nextFollowUpDate:body.nextFollowUpDate || null,remarks,photo:`/uploads/${filename}`,photoGps:{lat:Number(body.photoGps.lat),lng:Number(body.photoGps.lng),accuracy:Number(body.photoGps.accuracy) || null,capturedAt:body.photoGps.capturedAt || now,receivedAt:fs.statSync(photoFile).mtime.toISOString()},completedAt:now,completedBy:req.user.id};
  const next={...visit,status:'completed',completionNote:discussion,verification,completedAt:now,updatedAt:now,updatedBy:req.user.id};
  upsert('visits',next,{single:true}); await flush();
  return success(res,next,'Visit report submitted for verification');
}));
router.put('/visits/:id',wrap(async(req,res)=>{
  const visit=findById('visits',req.params.id);
  if (!visit || !visible(visit,req.user)) return error(res,'Visit not found',404);
  const {status,completionNote}=req.body;
  if (status!=='cancelled' || !manager(req.user)) return error(res,'Only a manager can cancel a visit. Employees must use the verified mobile completion flow.',403);
  if (!['scheduled','in_progress'].includes(visit.status)) return error(res,'Visit already closed. Schedule a new visit to visit again.',409);
  if (typeof completionNote!=='string' || completionNote.trim().length<3 || completionNote.length>2000) return error(res,'Enter cancellation notes (3–2000 characters)');
  const next={...visit,status,completionNote:completionNote.trim(),updatedAt:new Date().toISOString(),updatedBy:req.user.id};
  upsert('visits',next,{single:true}); await flush();return success(res,next,'Visit updated');
}));
module.exports=router;
