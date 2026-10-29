const {test}=require('node:test'),assert=require('node:assert/strict'),jwt=require('jsonwebtoken');
const rows=new Map([['users:ROOT',{collection:'users',id:'ROOT',data:{id:'ROOT',role:'superAdmin',isActive:true}}]]);
async function query(sql,args){if(/SELECT collection/.test(sql))return {rows:[...rows.values()].map(r=>structuredClone(r))};if(/INSERT INTO ndfa_docs/.test(sql))rows.set(`${args[0]}:${args[1]}`,{collection:args[0],id:args[1],data:JSON.parse(args[2])});return {rows:[]};}
require.cache[require.resolve('../src/lib/pg')]={exports:{query,getPool:()=>({connect:async()=>({query,release(){}})})}};
const db=require('../src/lib/db'),{quote,endDate}=require('../src/lib/packages'),{allModules,allActions}=require('../src/lib/companyPolicy');
test('packages publish safely, price extra staff and enforce assigned functions',async t=>{
 await db.initDb();const starter=db.findById('packages','PKG_STARTER');
 assert.equal(quote(starter,5).monthlyTotal,1000);assert.equal(quote(starter,6).monthlyTotal,1200);assert.equal(quote(starter,8).monthlyTotal,1600);
 for(const [id,base,extra,months] of [['QUARTERLY',2500,180,3],['HALF_YEARLY',4500,150,6],['ANNUAL',8000,150,12]]){const plan=db.findById('packages','PKG_'+id);assert.equal(quote(plan,5).periodTotal,base);assert.equal(quote(plan,6).periodTotal,base+extra*months);assert.equal(quote(plan,8).periodTotal,base+3*extra*months);}
 assert.equal(endDate('2026-01-31',1),'2026-02-28');assert.throws(()=>quote(starter,-1));assert.throws(()=>quote(starter,5.5));
 db.upsert('companies',{id:'C',name:'Test company',isActive:true,modules:allModules(),actions:allActions()});
 db.upsert('users',{id:'ADMIN',name:'Admin',role:'admin',companyId:'C',isActive:true});
 for(let i=0;i<5;i++)db.upsert('users',{id:`E${i}`,role:'fieldOfficer',companyId:'C',isActive:true});
 db.upsert('users',{id:'MANAGER',role:'branchManager',companyId:'C',isActive:true});
 db.upsert('users',{id:'DISABLED',role:'fieldOfficer',companyId:'C',isActive:false});
 db.upsert('users',{id:'DELETED',role:'fieldOfficer',companyId:'C',isActive:true,isDeleted:true});
 const server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 async function call(path,method='GET',body,actor='ROOT'){
   const r=await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:`Bearer ${jwt.sign({userId:actor},require('../src/config/env').jwtSecret)}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:r.status,...await r.json()};
 }
 await t.test('public catalog excludes drafts and private records; only root can manage',async()=>{
   const p=(await call('/packages','GET',undefined,null)).data;assert.equal(p.length,4);assert.equal(p[0].monthlyPrice,1000);assert.ok(!('actions'in p[0]));
   assert.equal((await call('/super-admin/packages','GET',undefined,'ADMIN')).status,403);
   assert.equal((await call('/super-admin/packages','POST',starter,'ADMIN')).status,403);
   const draft=await call('/super-admin/packages','POST',{...starter,name:'Private draft',published:false});assert.equal(draft.status,201);
   assert.equal((await call('/packages','GET',undefined,null)).data.length,4);
   assert.equal((await call('/super-admin/packages','POST',{...starter,monthlyPrice:-1})).status,400);
 });
 await t.test('assigning a plan caps existing sessions and calculates the actual staff charge',async()=>{
   assert.equal((await call('/auth/me','GET',undefined,'ADMIN')).data.permissions.customers,true);
   const r=await call('/super-admin/packages/assign/C','POST',{packageId:starter.id});assert.equal(r.status,200);assert.equal(r.data.quote.employees,6);assert.equal(r.data.quote.monthlyTotal,1200);
   const user=(await call('/auth/me','GET',undefined,'ADMIN')).data;assert.equal(user.permissions.customers,false);assert.equal(user.permissions.attendance,true);
   assert.equal((await call('/customers','GET',undefined,'ADMIN')).status,403);
   db.upsert('users',{id:'EXTRA',role:'fieldOfficer',companyId:'C',isActive:true});
   const c=(await call('/super-admin/packages')).data.companies[0];assert.equal(c.employees,7);assert.equal(c.quote.monthlyTotal,1400);
 });
 await t.test('published edits are live but do not rewrite purchased company terms',async()=>{
   const p={...starter,monthlyPrice:2000,modules:{...starter.modules,users:false}};
   assert.equal((await call(`/super-admin/packages/${starter.id}`,'PUT',p)).status,200);
   assert.equal((await call('/packages','GET',undefined,null)).data[0].monthlyPrice,2000);
   assert.equal((await call('/super-admin/packages')).data.companies[0].quote.monthlyTotal,1400);
   assert.equal((await call('/auth/me','GET',undefined,'ADMIN')).data.permissions.users,true);
   await db.initDb();assert.equal(db.findById('packages',starter.id).monthlyPrice,2000,'startup seed never overwrites an edited package');
 });
 await t.test('enquiry pricing is server calculated and contacts are private',async()=>{
   const request=await call('/packages/requests','POST',{packageId:starter.id,name:'Test person',company:'Buyer company',email:'qa@example.com',mobile:'9000000000',employees:6,monthlyTotal:1},null);
   assert.equal(request.status,201);assert.deepEqual(Object.keys(request.data),['id']);
   const row=(await call('/super-admin/packages')).data.requests[0];assert.equal(row.estimate.monthlyTotal,2200);
   assert.equal((await call(`/super-admin/packages/requests/${row.id}/status`,'PUT',{status:'contacted'})).status,200);
   assert.equal((await call('/super-admin/packages','GET',undefined,'ADMIN')).status,403);
   const catalog=JSON.stringify((await call('/packages','GET',undefined,null)).data);assert.ok(!catalog.includes('qa@example.com'));
 });
 await t.test('archived plans leave the website; expired subscriptions remove feature access',async()=>{
   const p=db.findById('packages',starter.id);await call(`/super-admin/packages/${p.id}`,'PUT',{...p,isArchived:true,published:true});
   assert.equal((await call('/packages','GET',undefined,null)).data.length,3);
   assert.equal((await call('/super-admin/packages/assign/C','POST',{packageId:p.id})).status,400);
   const c=db.findById('companies','C');db.upsert('companies',{...c,packageSubscription:{...c.packageSubscription,endsOn:'2000-01-01'}});
   assert.equal((await call('/auth/me','GET',undefined,'ADMIN')).data.permissions.attendance,false);
 });
});
