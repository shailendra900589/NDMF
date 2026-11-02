const express=require('express');
const {randomUUID}=require('node:crypto');
const {getCollection,findById,upsert,flush}=require('../../lib/db');
const {success,error}=require('../../lib/response');
const {authMiddleware,requireRole}=require('../../middleware/authMiddleware');
const {MODULES,ACTIONS,MODULE_ACTIONS}=require('../../lib/companyPolicy');
const {validatePackage,quote,staffCount,indiaToday,endDate,subscriptionSummary}=require('../../lib/packages');
const router=express.Router(),admin=express.Router();
const wrap=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
const now=()=>new Date().toISOString();
function audit(req,action,targetId,companyId){upsert('platformAudit',{id:randomUUID(),actorId:req.user.id,action,targetId,companyId,createdAt:now()},{single:true});}
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/',wrap(async(req,res)=>success(res,getCollection('packages').filter(p=>p.published && !p.isArchived).map(p=>({
  id:p.id,name:p.name,description:p.description,basePeriodPrice:p.basePeriodPrice??p.monthlyPrice*p.billingMonths,monthlyPrice:p.monthlyPrice,includedEmployees:p.includedEmployees,
  extraEmployeeMonthlyPrice:p.extraEmployeeMonthlyPrice,billingMonths:p.billingMonths,currency:'INR',
  features:Object.keys(MODULES).filter(k=>p.modules[k]).map(k=>MODULES[k])
})))));
const buckets=new Map();
router.post('/requests',wrap(async(req,res)=>{
  const at=Date.now(),bucket=buckets.get(req.ip);
  if(bucket && at<bucket.until && bucket.count>=5)return error(res,'Too many enquiries. Please try again in one hour.',429);
  if(buckets.size>10000)for(const [k,v]of buckets)if(v.until<=at)buckets.delete(k);
  buckets.set(req.ip,{until:bucket?.until>at?bucket.until:at+3600000,count:bucket?.until>at?bucket.count+1:1});
  const p=findById('packages',req.body.packageId);
  if(!p || !p.published || p.isArchived)return error(res,'Choose an available package.');
  const name=String(req.body.name||'').trim(),company=String(req.body.company||'').trim(),email=String(req.body.email||'').trim(),mobile=String(req.body.mobile||'').trim();
  if(name.length<2 || name.length>100 || company.length<2 || company.length>150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||!/^\+?[\d ()-]{7,20}$/.test(mobile))return error(res,'Enter your name, company, valid email and mobile number.');
  const estimate=quote(p,req.body.employees);
  const row={id:randomUUID(),packageId:p.id,packageName:p.name,name,company,email,mobile,estimate,status:'new',createdAt:now()};
  upsert('packageRequests',row,{single:true});await flush();return success(res,{id:row.id},'Your package enquiry has been received.',201);
}));
router.get('/subscription',authMiddleware,wrap(async(req,res)=>{
  if(req.user.role==='superAdmin')return error(res,'Company subscription is available from the company console.',403);
  const company=findById('companies',req.user.companyId);
  if(!company)return error(res,'Company not found',404);
  const subscription=company.packageSubscription||null;
  const summary=subscription?{...subscription,...subscriptionSummary(subscription)}:subscriptionSummary(null);
  // Strip package internals from the company billing view — only show what the console needs.
  const safe=subscription?{packageId:summary.packageId,name:summary.name,startsOn:summary.startsOn,endsOn:summary.endsOn,paymentStatus:summary.paymentStatus,billingMonths:subscription.billingMonths,includedEmployees:subscription.includedEmployees,extraEmployeeMonthlyPrice:subscription.extraEmployeeMonthlyPrice,basePeriodPrice:subscription.basePeriodPrice??subscription.monthlyPrice*subscription.billingMonths,status:summary.status,isActive:summary.isActive,label:summary.label,daysRemaining:summary.daysRemaining}:summary;
  const renewalRequest=getCollection('packageRenewalRequests').filter(r=>r.companyId===company.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]||null;
  return success(res,{company:{id:company.id,name:company.name},subscription:safe,quote:subscription?quote(subscription,staffCount(company.id)):null,renewalRequest});
}));
router.post('/renewal-requests',authMiddleware,wrap(async(req,res)=>{
  if(req.user.role!=='admin')return error(res,'Only a company administrator can request package renewal.',403);
  const company=findById('companies',req.user.companyId);
  if(!company?.packageSubscription)return error(res,'No package is assigned to this company yet.',409);
  const pending=getCollection('packageRenewalRequests').find(row=>row.companyId===company.id&&['requested','contacted'].includes(row.status));
  if(pending)return success(res,pending,'A renewal request is already being reviewed.');
  const summary=subscriptionSummary(company.packageSubscription);
  const row={id:randomUUID(),companyId:company.id,companyName:company.name,packageId:company.packageSubscription.packageId,packageName:company.packageSubscription.name,expiresOn:company.packageSubscription.endsOn,status:'requested',requestedBy:req.user.id,requestedByName:req.user.name,createdAt:now(),paymentProvider:'razorpay_not_configured'};
  upsert('packageRenewalRequests',row,{single:true});audit(req,'package.renewal.requested',row.id,company.id);await flush();
  return success(res,{...row,subscription:summary},'Renewal request sent to the Super Administrator. Razorpay checkout will be enabled when payment credentials are configured.',201);
}));
admin.use(authMiddleware,requireRole('superAdmin'));
admin.get('/',wrap(async(req,res)=>success(res,{
  packages:getCollection('packages'),modules:MODULES,actions:ACTIONS,moduleActions:MODULE_ACTIONS,
  requests:getCollection('packageRequests').slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),
  renewalRequests:getCollection('packageRenewalRequests').slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),
  companies:getCollection('companies').map(c=>({id:c.id,name:c.name,employees:staffCount(c.id),subscription:c.packageSubscription||null,
    subscriptionStatus:subscriptionSummary(c.packageSubscription),quote:c.packageSubscription?quote(c.packageSubscription,staffCount(c.id)):null}))
})));
admin.post('/',wrap(async(req,res)=>{
  const p={...validatePackage(req.body),id:randomUUID(),createdAt:now(),updatedAt:now()};
  upsert('packages',p,{single:true});audit(req,'package.created',p.id);await flush();return success(res,p,'Package created',201);
}));
admin.put('/:id',wrap(async(req,res)=>{
  const old=findById('packages',req.params.id);if(!old)return error(res,'Package not found',404);
  const p={...old,...validatePackage(req.body),updatedAt:now()};
  upsert('packages',p,{single:true});audit(req,'package.updated',p.id);await flush();return success(res,p,'Package updated');
}));
admin.post('/assign/:companyId',wrap(async(req,res)=>{
  const company=findById('companies',req.params.companyId),p=findById('packages',req.body.packageId);
  if(!company)return error(res,'Company not found',404);
  if(!p || p.isArchived)return error(res,'Choose an active package.');
  const startsOn=String(req.body.startsOn||indiaToday()),endsOn=endDate(startsOn,p.billingMonths);
  if(startsOn>indiaToday() || endsOn<=indiaToday())return error(res,'Choose a service period that includes today.');
  const paymentStatus=['paid','pending','waived'].includes(req.body.paymentStatus)?req.body.paymentStatus:null;
  if(!paymentStatus)return error(res,'Choose whether this package has been paid, is pending payment, or is waived.');
  const subscription={...structuredClone(p),packageId:p.id,startsOn,endsOn,paymentStatus,paymentRecordedAt:paymentStatus==='paid'?now():null,assignedAt:now(),assignedBy:req.user.id};
  delete subscription.published;delete subscription.isArchived;
  upsert('companies',{...company,packageSubscription:subscription},{single:true});audit(req,'package.assigned',p.id,company.id);
  await flush();return success(res,{subscription:{...subscription,...subscriptionSummary(subscription)},quote:quote(subscription,staffCount(company.id))},paymentStatus==='paid'?'Package activated':'Package saved as payment pending; service remains disabled until marked paid.');
}));
admin.put('/requests/:id/status',wrap(async(req,res)=>{
  const row=findById('packageRequests',req.params.id);
  if(!row)return error(res,'Enquiry not found',404);
  if(!['new','contacted','closed'].includes(req.body.status))return error(res,'Choose a valid enquiry status.');
  upsert('packageRequests',{...row,status:req.body.status},{single:true});await flush();return success(res,{id:row.id});
}));
admin.put('/renewal-requests/:id/status',wrap(async(req,res)=>{
  const row=findById('packageRenewalRequests',req.params.id);
  if(!row)return error(res,'Renewal request not found',404);
  if(!['requested','contacted','closed'].includes(req.body.status))return error(res,'Choose a valid renewal request status.');
  upsert('packageRenewalRequests',{...row,status:req.body.status,reviewedAt:now(),reviewedBy:req.user.id},{single:true});await flush();return success(res,{id:row.id,status:req.body.status});
}));
module.exports={publicRouter:router,adminRouter:admin};
