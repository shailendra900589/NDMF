const {test}=require('node:test');const assert=require('node:assert/strict');const bcrypt=require('bcryptjs');const fs=require('node:fs/promises');const path=require('node:path');
const rows=new Map([['users:SENTINEL',{collection:'users',id:'SENTINEL',data:{id:'SENTINEL',role:'superAdmin'}}]]);
async function query(sql,args){if(/SELECT collection/.test(sql))return{rows:[...rows.values()]};if(/INSERT INTO ndfa_docs/.test(sql))rows.set(`${args[0]}:${args[1]}`,{collection:args[0],id:args[1],data:JSON.parse(args[2])});return{rows:[]};}
require.cache[require.resolve('../src/lib/pg')]={exports:{query,getPool:()=>({connect:async()=>({query,release(){}})})}};
const db=require('../src/lib/db');
test('Flutter API contract: authentication, uploads, listings, customers, attendance, GPS, team and calls',async t=>{
 await db.initDb();const companyId='CO_MOBILE_QA';
 db.upsert('companies',{id:companyId,name:'Isolated mobile test company',isActive:true});
 db.upsert('branches',{id:'BR_MOBILE',companyId,name:'Test office',isActive:true});
 for(const [id,role,mobile] of [['A','admin','9001000001'],['B','branchManager','9001000002'],['F','fieldOfficer','9001000003']])db.upsert('users',{id,companyId,employeeId:`MOBILE_${id}`,name:`Dummy ${role}`,mobile,role,branch:'Test office',isActive:true,permissions:{users:true,callLogs:true},password:bcrypt.hashSync('MobileTest432!',4)});
 const server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin=`http://127.0.0.1:${server.address().port}`;const uploaded=[];const tokens={};const covered=new Set();
 t.after(async()=>{await new Promise(r=>server.close(r));for(const file of uploaded){assert.ok(file.startsWith(`${companyId}_`));await fs.unlink(path.join(__dirname,'../uploads',file)).catch(()=>{});}await db.flush();});
 async function call(route,method='GET',body,actor='F',expected=200){covered.add(`${method} ${route.split('?')[0]}`);const r=await fetch(`${origin}/api/v1${route}`,{method,headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(tokens[actor]?{Authorization:`Bearer ${tokens[actor]}`}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});const json=await r.json();assert.equal(r.status,expected,`${method} ${route}: ${json.message}`);assert.equal(json.success,r.status<400);return json;}
 await call('/health');
 for(const id of ['A','B','F']){const auth=await call('/auth/login','POST',{loginId:`MOBILE_${id}`,password:'MobileTest432!'},id);tokens[id]=auth.data.token;assert.equal(auth.data.role,{A:'admin',B:'branchManager',F:'fieldOfficer'}[id]);}
 await call('/auth/me');await call('/dashboard/stats');await call('/settings/public');
 await call('/auth/otp/send','POST',{loginId:'MOBILE_F'},'F',403);await call('/auth/otp/verify','POST',{loginId:'MOBILE_F',otp:'000000'},'F',403);
 await call('/auth/change-password','PUT',{oldPassword:'MobileTest432!',newPassword:'MobileChanged432!'});
 await call('/auth/login','POST',{loginId:'MOBILE_F',password:'MobileChanged432!'});
 await call('/auth/profile','PUT',{name:'Updated dummy employee'});
 await call('/branches');await call('/users/permission-schema','GET',undefined,'B');await call('/users','GET',undefined,'B');
 const branch=await call('/branches','POST',{name:'Temporary mobile branch'},'A',201);await call(`/branches/${branch.data.id}`,'PUT',{name:'Renamed mobile branch'},'A');await call(`/branches/${branch.data.id}`,'DELETE',undefined,'A');
 const employee=await call('/users','POST',{name:'Team fixture',mobile:'9001000004',employeeId:'MOBILE_NEW',role:'fieldOfficer',branch:'Test office',password:'MobileTest432!',monthlySalary:18000,salaryEffectiveMonth:'2026-10',salaryReason:'Initial appointment salary'},'B',201);assert.equal(employee.data.monthlySalary,18000);await call(`/users/${employee.data.id}`,'PUT',{name:'Updated fixture',mobile:'9001000005'},'B');
 const form=new FormData();form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'fixture.png');form.append('type','photo');form.append('latitude','26.75');form.append('longitude','83.37');
 const upload=await call('/uploads/single','POST',form);uploaded.push(upload.data.fileName);assert.match(upload.data.fileUrl,/signature=/);const asset=await fetch(origin+upload.data.fileUrl);assert.equal(asset.status,200);assert.ok((await asset.arrayBuffer()).byteLength>0);
 await call('/users/me/face-enrollment');await call('/users/me/face-enrollment','PUT',{urls:[]},'F',400);await call('/users/me/face-enrollment','DELETE',undefined,'F');await call('/attendance/verify-face','POST',new FormData(),'F',400);
 await call('/settings/attendance-face','PUT',{faceAttendanceRequired:false},'B',403);await call('/settings/attendance-face','PUT',{faceAttendanceRequired:false},'A');
 await call('/attendance/check-in','POST',{lat:26.75,lng:83.37});
 await call('/tracking/live-ping','POST',{lat:26.75,lng:83.37,accuracy:10,recordedAt:new Date().toISOString()});
 await call('/tracking/route-points','POST',{routePoints:[{latitude:26.75,longitude:83.37,accuracy:10,timestamp:new Date().toISOString()}]});
 const today=await call('/tracking/today');assert.equal(typeof today.data.totalKm,'number');assert.ok(Array.isArray(today.data.routePoints));
 await call('/tracking/live','GET',undefined,'B');await call('/tracking/history');await call('/tracking/people','GET',undefined,'B');await call('/tracking/days?userId=F','GET',undefined,'B');await call('/tracking/route?userId=F','GET',undefined,'B');
 await call('/attendance/history');await call('/attendance/check-out','POST',{lat:26.75,lng:83.37},'F',403); // Checkout requires enrollment even when check-in face policy is off.
 const photo=upload.data.fileUrl;const listingBody={id:'MOBILE_LISTING',name:'Dummy customer',mobile:'9001000010',shopFullAddress:'Synthetic shop address',shopLatitude:26.75,shopLongitude:83.37,branch:'Test office',neighbors:[{shopName:'Dummy neighbor 1',remarks:'Fixture check'},{shopName:'Dummy neighbor 2',remarks:'Fixture check'}]};for(const key of ['customerPhoto','aadhaarFront','aadhaarBack','panFront','shopPhoto1','shopPhoto2','shopPhoto3','shopPhoto4'])listingBody[key]={filePath:photo,latitude:26.75,longitude:83.37,capturedAt:new Date().toISOString()};
 await call('/customer-listings','POST',listingBody,'F',201);await call('/customer-listings');await call('/customer-listings/MOBILE_LISTING');await call('/customer-listings/approval','GET',undefined,'B');
 await call('/customer-listings/MOBILE_LISTING/assign','PUT',{employeeId:'MOBILE_F',employeeName:'Updated dummy employee'},'B');await call('/customer-listings/approve','POST',{id:'MOBILE_LISTING',action:'approve'},'B');await call('/customer-listings/approve','POST',{id:'MOBILE_LISTING',action:'finalApprove'},'A');
 assert.equal((await call('/customer-listings')).data.length,0);const customers=await call('/customers');assert.equal(customers.data.length,1);const detail=await call(`/customers/${customers.data[0].id}`);assert.equal(detail.data.verification.photos.length,8);
 await call('/customers','POST',{name:'Manual fixture',mobile:'9001000011',branch:'Test office'},'A',201);
 await call('/call-logs','POST',{id:'MOBILE_CALL',mobile:'9001000010',customerName:'Dummy customer',durationSeconds:15,type:'outgoing'},'F',201);await call('/call-logs');await call('/call-logs/MOBILE_CALL','PUT',{callSummary:'Fixture summary'});
 await call('/payslips','GET',undefined,'F',403);await call('/payslips','GET',undefined,'A');const slip=await call('/payslips','POST',{employeeName:'Dummy',employeeNo:'MOBILE_F',month:'2026-10',earnings:{basic:1000},deductions:{}},'A',201);await call(`/payslips/${slip.data.id}`,'PUT',{department:'Mobile QA'},'A');await call(`/payslips/${slip.data.id}`,'DELETE',undefined,'A');
 await call('/auth/logout','POST');await db.flush();assert.ok(covered.size>=35);t.diagnostic(`Verified ${covered.size} distinct mobile HTTP method/path combinations; all fixtures isolated.`);
});
