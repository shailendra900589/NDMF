const {test}=require('node:test');const assert=require('node:assert/strict');const jwt=require('jsonwebtoken');
const rows=new Map([['users:SENTINEL',{collection:'users',id:'SENTINEL',data:{id:'SENTINEL',role:'superAdmin'}}]]);
async function query(sql,args){if(/SELECT collection/.test(sql))return{rows:[...rows.values()]};if(/INSERT INTO ndfa_docs/.test(sql))rows.set(`${args[0]}:${args[1]}`,{collection:args[0],id:args[1],data:JSON.parse(args[2])});return{rows:[]};}
require.cache[require.resolve('../src/lib/pg')]={exports:{query,getPool:()=>({connect:async()=>({query,release(){}})})}};
const db=require('../src/lib/db');
test('approved listings leave the queue, retain documents and expose scoped customer verification',async t=>{
 await db.initDb();for(const id of ['ONE','TWO'])db.upsert('companies',{id,isActive:true});
 for(const [id,role,companyId,branch] of [['ADMIN','admin','ONE','Office'],['BM','branchManager','ONE','Other'],['OTHER','admin','TWO','Office']])db.upsert('users',{id,role,companyId,branch,isActive:true});
 db.upsert('customers',{id:'C_EXISTING',companyId:'ONE',name:'Existing',mobile:'9000000000',branch:'Office',documentPaths:[],loanHistory:[{id:'KEEP'}]});
 const listing={id:'L',companyId:'ONE',name:'Test customer',mobile:'9000000000',branch:'Office',status:'adminPending',shopFullAddress:'Dummy address',shopLatitude:26,shopLongitude:83,customerPhoto:{filePath:'/uploads/ONE_customer.jpg',latitude:26,longitude:83,capturedAt:'2026-10-22T10:00:00Z'},aadhaarFront:'/uploads/ONE_front.jpg',neighbors:[{shopName:'Dummy shop',remarks:'Verification note',voiceRecordingPath:'/uploads/ONE_voice.m4a'}]};
 db.upsert('customerListings',listing);db.upsert('customerListings',{...listing,id:'REJECT',status:'rejected',mobile:'9000000001'});
 const server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const {jwtSecret}=require('../src/config/env');
 async function call(path,method='GET',body,actor='ADMIN'){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({userId:actor},jwtSecret)}`},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,...await r.json()};}
 assert.equal((await call('/customer-listings/approve','POST',{id:'L',action:'finalApprove'})).status,200);
 assert.deepEqual((await call('/customer-listings')).data.map(l=>l.id),['REJECT']);assert.equal((await call('/customer-listings?status=listed')).data.length,0);
 const detail=await call('/customers/C_EXISTING');assert.equal(detail.status,200);assert.equal(detail.headers,undefined);assert.equal(detail.data.listingId,'L');assert.equal(detail.data.loanHistory[0].id,'KEEP');assert.equal(detail.data.verification.photos.length,2);assert.match(detail.data.verification.photos[0].media.filePath,/signature=/);assert.equal(detail.data.verification.neighbors[0].remarks,'Verification note');
 assert.equal((await call('/customers/C_EXISTING','GET',undefined,'BM')).status,403);assert.equal((await call('/customers/C_EXISTING','GET',undefined,'OTHER')).status,404);
 assert.equal(db.getCollection('customers').filter(c=>c.mobile==='9000000000').length,1);assert.ok(db.findById('customerListings','L'));
 await db.flush();
});
