const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const rows = new Map([['users:sentinel', { collection:'users', id:'sentinel', data:{id:'sentinel',role:'superAdmin'} }]]);
let failWrite = false;
async function query(sql, args) {
  if (/SELECT collection/.test(sql)) return { rows: [...rows.values()].map(r=>structuredClone(r)) };
  if (/INSERT INTO ndfa_docs/.test(sql)) {
    if (failWrite && args[0] === 'users') { failWrite=false; throw new Error('Simulated storage failure'); }
    rows.set(`${args[0]}:${args[1]}`,{collection:args[0],id:args[1],data:JSON.parse(args[2])});
  }
  if (/DELETE FROM ndfa_docs/.test(sql)) for (const [key,r] of rows) if(r.collection===args[0]) rows.delete(key);
  return {rows:[]};
}
require.cache[require.resolve('../src/lib/pg')]={exports:{query,getPool:()=>({connect:async()=>({query,release(){}})})}};
const face = require('../src/lib/faceMatch');
const db = require('../src/lib/db');
const vector = value => Array(128).fill(value);
let beforeBuild = async()=>{}, beforeLive = async()=>{}, liveValue = 0, actionMetrics={mouth:0.7,eyes:0.08};
// Deterministic inference boundary; the real HTTP, authorization, persistence,
// enrollment normalization and descriptor cache are exercised below.
require.cache[require.resolve('../src/lib/faceMatch')].exports={...face,
  buildEnrollment:async()=>{await beforeBuild();return [vector(0),vector(0),vector(0)];},
  describeFace:async(buffer)=>{await beforeLive();return {descriptor:vector(liveValue),liveness:buffer.toString().includes('live-action')?actionMetrics:{mouth:0.05,eyes:0.30}};},
};

test('registered phone attendance survives persistence, signed URLs and concurrent resets',async t=>{
  await db.initDb();
  db.upsert('companies',{id:'CO_TEST',name:'Test',isActive:true,modules:{attendance:true,users:true}});
  db.upsert('branches',{id:'B1',companyId:'CO_TEST',name:'Office',isActive:true});
  db.upsert('users',{id:'ADMIN',companyId:'CO_TEST',name:'Admin',role:'admin',isActive:true});
  db.upsert('users',{id:'EMP',companyId:'CO_TEST',name:'Employee',role:'fieldOfficer',branch:'Office',workType:'field',isActive:true});
  await db.flush();
  const server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  const secret=require('../src/config/env').jwtSecret;
  const employee=jwt.sign({userId:'EMP'},secret),admin=jwt.sign({userId:'ADMIN'},secret);
  async function call(path,method='GET',body,token=employee) {
    if (['/attendance/check-in','/attendance/check-out'].includes(path) && body) body={accuracy:8,gpsRecordedAt:new Date().toISOString(),mocked:false,...body};
    if (path==='/attendance/verify-face' && body instanceof FormData && body.has('file') && !body.has('challengeId')) {
      const c=await call('/attendance/face-challenge','POST',{purpose:body.get('purpose') || 'checkin',captureMode:'auto_single'},token);
      if(c.status===200) body.append('challengeId',c.data.id);
    }
    const isForm=body instanceof FormData;
    const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,...(!isForm?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:isForm?body:JSON.stringify(body)});
    return {status:r.status,...await r.json()};
  }
  function selfie(){const body=new FormData();body.append('file',new Blob(['test-photo'],{type:'image/jpeg'}),'live.jpg');return body;}
  const urls=[1,2,3].map(i=>`https://old.example/uploads/CO_TEST_photo${i}.jpg?expires=1&signature=expired`);
  assert.equal((await call('/health')).data.attendanceFaceMode,'single_photo_only_v2');
  await t.test('save confirms durable registration and normalizes signed paths',async()=>{
    assert.equal((await call('/users/me/face-enrollment','PUT',{urls:[urls[0],urls[0],urls[0]]})).status,400);
    const r=await call('/users/me/face-enrollment','PUT',{urls});assert.equal(r.status,200,r.message);assert.equal(r.data.faceEnrollmentComplete,true);
    assert.equal(rows.get('users:EMP').data.faceEnrollmentUrls[0],'/uploads/CO_TEST_photo1.jpg');
    assert.equal(r.data.faceDescriptors,undefined);
    assert.equal((await call('/users/me/face-enrollment','PUT',{urls})).status,200,'retrying same saved registration is safe');
    await db.initDb();
    assert.equal((await call('/users/me/face-enrollment')).data.complete,true);
    assert.equal((await call('/auth/me')).data.faceEnrollmentComplete,true);
  });
  await t.test('retired modes never issue eye or mouth instructions',async()=>{
    for(const mode of [undefined,'auto_blink','guided','close_eyes']){
      const response=await call('/attendance/face-challenge','POST',{purpose:'checkin',...(mode?{captureMode:mode}:{})});
      assert.equal(response.status,426);assert.match(response.message,/Update MyStaff Smart/);
      assert.equal(response.data,null);
    }
    assert.equal((await call('/attendance/face-capture-check','POST',selfie())).status,426);
  });
  await t.test('single-photo verification runs inference once without action metrics',async()=>{
    let calls=0;beforeLive=async()=>{calls++;};actionMetrics=null;
    try{const result=await call('/attendance/verify-face','POST',selfie());
      assert.equal(result.data.verified,true);assert.equal(result.data.livenessVerified,false);assert.equal(calls,1);
    }finally{beforeLive=async()=>{};actionMetrics={mouth:0.7,eyes:0.08};}
  });
  await t.test('single camera image authorizes both punches only after server identity match',async()=>{
    db.upsert('users',{id:'SINGLE_QA',companyId:'CO_TEST',name:'Single capture QA',role:'fieldOfficer',branch:'Office',workType:'field',isActive:true});
    const actor=jwt.sign({userId:'SINGLE_QA'},secret);
    assert.equal((await call('/users/me/face-enrollment','PUT',{urls},actor)).status,200);
    assert.equal((await call('/attendance/check-in','POST',{lat:26.7,lng:83.4,faceVerified:true},actor)).status,400);
    async function verify(purpose){
      const c=(await call('/attendance/face-challenge','POST',{purpose,captureMode:'auto_single'},actor)).data;
      assert.equal(c.action,null);assert.equal(c.captureMode,'auto_single');
      const f=selfie();f.append('challengeId',c.id);f.append('purpose',purpose);
      const r=await call('/attendance/verify-face','POST',f,actor);
      return {r,c};
    }
    const first=await verify('checkin');
    assert.equal(first.r.data.verified,true);assert.equal(first.r.data.identityVerified,true);
    assert.equal(first.r.data.livenessVerified,false,'single photo must never claim anti-spoof liveness');
    const checked=await call('/attendance/check-in','POST',{lat:26.7,lng:83.4},actor);
    assert.equal(checked.status,200);assert.equal(checked.data.faceCaptureMode,'auto_single');
    assert.equal(checked.data.faceLivenessVerified,false);
    assert.equal((await call('/attendance/check-out','POST',{lat:26.7,lng:83.4},actor)).status,400);
    const second=await verify('checkout');assert.equal(second.r.data.verified,true);
    const closed=await call('/attendance/check-out','POST',{lat:26.7,lng:83.4},actor);
    assert.equal(closed.status,200);assert.equal(closed.data.checkOutFaceVerified,true);
    assert.equal(closed.data.checkOutFaceLivenessVerified,false);
    const replay=selfie();replay.append('challengeId',second.c.id);replay.append('purpose','checkout');
    assert.equal((await call('/attendance/verify-face','POST',replay,actor)).status,409);
    liveValue=0.2;
    try { assert.equal((await verify('checkin')).r.data.verified,false,'wrong identity is rejected with a single photo'); }
    finally {liveValue=0;}
    const guided={id:'RETIRED_QA',purpose:'checkin',captureMode:'guided',expiresAt:new Date(Date.now()+60000).toISOString()};
    db.upsert('users',{...db.findById('users','SINGLE_QA'),faceChallenge:guided},{single:true});
    const forged=selfie();forged.append('challengeId',guided.id);forged.append('captureMode','auto_single');
    assert.equal((await call('/attendance/verify-face','POST',forged,actor)).status,426,'request body cannot revive a retired challenge mode');
  });
  await t.test('legacy photo objects and expiring signatures use the stored face cache',async()=>{
    const u=db.findById('users','EMP');
    db.upsert('users',{...u,faceEnrollmentUrls:urls.map(filePath=>({filePath})),faceDescriptorUrls:urls.join('|')},{single:true});
    assert.equal((await call('/users/me/face-enrollment')).data.complete,true);
    assert.equal((await call('/attendance/verify-face','POST',selfie())).data.verified,true);
    assert.equal((await call('/attendance/check-in','POST',{lat:91,lng:0})).status,400);
    const checked=await call('/attendance/check-in','POST',{lat:26.7,lng:83.4});assert.equal(checked.status,200,checked.message);assert.equal(checked.data.faceVerified,true);
    assert.equal((await call('/attendance/check-in','POST',{lat:26.7,lng:83.4})).status,400);
    assert.equal((await call('/attendance/check-out','POST',{lat:0,lng:'NaN'})).status,400);
    assert.equal((await call('/attendance/check-out','POST',{lat:26.7,lng:83.4})).status,400,'check-in verification cannot be reused for checkout');
    await call('/settings/attendance-face','PUT',{enabled:false},admin);
    const checkoutSelfie=selfie();checkoutSelfie.append('purpose','checkout');
    assert.equal((await call('/attendance/verify-face','POST',checkoutSelfie)).data.verified,true,'checkout still verifies a selfie when check-in policy is disabled');
    assert.equal((await call('/attendance/check-out','POST',{lat:26.7,lng:83.4})).status,200);
    await call('/settings/attendance-face','PUT',{enabled:true},admin);
    assert.equal((await call('/attendance/check-out','POST',{lat:26.7,lng:83.4})).status,400);
  });
  await t.test('bad live selfies never erase an existing valid registration',async()=>{
    beforeLive=async()=>{throw new face.FaceCheckError('No face found — use good light','no_face');};
    const empty=await call('/attendance/verify-face','POST',selfie());
    assert.equal(empty.data.verified,false);assert.equal(empty.data.reason,'no_face');
    assert.match(empty.data.message,/good light/);
    beforeLive=async()=>{};liveValue=0.2;
    const mismatch=await call('/attendance/verify-face','POST',selfie());
    assert.equal(mismatch.data.verified,false);assert.equal(mismatch.data.reason,'mismatch');
    assert.equal((await call('/users/me/face-enrollment')).data.complete,true);
    liveValue=0;
    assert.equal((await call('/attendance/verify-face','POST',selfie())).data.verified,true);
  });
  await t.test('purpose-bound single photo challenges expire and cannot be reused',async()=>{
    const challenge=(await call('/attendance/face-challenge','POST',{purpose:'checkin',captureMode:'auto_single'})).data;
    const make=(purpose='checkin')=>{const f=selfie();f.append('challengeId',challenge.id);f.append('purpose',purpose);return f;};
    assert.equal((await call('/attendance/verify-face','POST',make('checkout'))).status,409);
    assert.equal((await call('/attendance/verify-face','POST',make())).data.verified,true);
    assert.equal((await call('/attendance/verify-face','POST',make())).status,409);
    db.upsert('users',{...db.findById('users','EMP'),faceChallenge:{...challenge,expiresAt:new Date(0).toISOString()}},{single:true});
    assert.equal((await call('/attendance/verify-face','POST',make())).status,409);
  });
  await t.test('dummy manager login, own attendance and face-verified checkout stay separate from team history',async()=>{
    const bcrypt=require('bcryptjs');
    db.upsert('users',{id:'MANAGER_QA',companyId:'CO_TEST',employeeId:'MANAGER_QA',name:'Dummy manager',mobile:'9001000099',role:'branchManager',branch:'Office',workType:'field',isActive:true,password:bcrypt.hashSync('ManagerFixture432!',4)});
    const auth=await call('/auth/login','POST',{loginId:'MANAGER_QA',password:'ManagerFixture432!'});
    assert.equal(auth.status,200);const manager=auth.data.token;
    assert.equal((await call('/auth/me','GET',undefined,manager)).data.id,'MANAGER_QA');
    assert.ok((await call('/attendance/history','GET',undefined,manager)).data.some(a=>a.userId==='EMP'));
    assert.equal((await call('/attendance/history?scope=mine','GET',undefined,manager)).data.length,0);
    const notChecked=await call('/attendance/check-out','POST',{lat:26.7,lng:83.4},manager);
    assert.equal(notChecked.status,400);assert.equal(notChecked.message,'Check in first');
    assert.equal((await call('/users/me/face-enrollment','PUT',{urls},manager)).status,200);
    assert.equal((await call('/attendance/verify-face','POST',selfie(),manager)).data.verified,true);
    const own=await call('/attendance/check-in','POST',{lat:26.7,lng:83.4},manager);assert.equal(own.status,200);
    const mine=await call('/attendance/history?scope=mine','GET',undefined,manager);assert.equal(mine.data.length,1);assert.equal(mine.data[0].userId,'MANAGER_QA');
    assert.equal((await call('/attendance/verify-face','POST',selfie(),manager)).data.verified,true);
    assert.equal((await call('/attendance/check-out','POST',{lat:26.7,lng:83.4},manager)).status,400,'even an unused check-in selfie cannot authorize checkout');
    const checkout=selfie();checkout.append('purpose','checkout');
    assert.equal((await call('/attendance/verify-face','POST',checkout,manager)).data.verified,true);
    const closed=await call('/attendance/check-out','POST',{lat:26.7,lng:83.4},manager);assert.equal(closed.status,200);assert.equal(closed.data.checkOutFaceVerified,true);
    assert.ok((await call('/attendance/history?scope=mine','GET',undefined,manager)).data[0].checkOutTime);
  });
  await t.test('reset during live inference cannot restore deleted face data',async()=>{
    let started,finish;
    const entered=new Promise(r=>started=r),gate=new Promise(r=>finish=r);
    beforeLive=async()=>{started();await gate;};
    const pending=call('/attendance/verify-face','POST',selfie());await entered;
    assert.equal((await call('/users/EMP/face-enrollment','DELETE',undefined,admin)).status,200);
    finish();assert.equal((await pending).status,409);beforeLive=async()=>{};
    assert.equal((await call('/users/me/face-enrollment')).data.complete,false);
    assert.equal(db.findById('users','EMP').faceVerification,undefined);
  });
  await t.test('reset during registration prevents stale enrollment being committed',async()=>{
    let started,finish;const entered=new Promise(r=>started=r),gate=new Promise(r=>finish=r);
    beforeBuild=async()=>{started();await gate;};
    const pending=call('/users/me/face-enrollment','PUT',{urls});await entered;
    await call('/users/EMP/face-enrollment','DELETE',undefined,admin);
    finish();assert.equal((await pending).status,409);beforeBuild=async()=>{};
    assert.equal((await call('/users/me/face-enrollment')).data.complete,false);
  });
  await t.test('profile edits during inference are preserved and photo problems are explicit',async()=>{
    beforeBuild=async()=>{db.upsert('users',{...db.findById('users','EMP'),name:'Updated during inference'},{single:true});};
    assert.equal((await call('/users/me/face-enrollment','PUT',{urls})).status,200);
    assert.equal(db.findById('users','EMP').name,'Updated during inference');beforeBuild=async()=>{};
    db.upsert('users',{...db.findById('users','EMP'),faceEnrollmentValid:false,faceEnrollmentProblem:'Saved photo is missing'},{single:true});
    const status=(await call('/users/me/face-enrollment')).data;assert.equal(status.registered,true);assert.equal(status.reason,'enrollment_invalid');
    const verify=await call('/attendance/verify-face','POST',selfie());assert.equal(verify.status,403);assert.match(verify.message,/Saved photo is missing/);
  });
  await t.test('failed storage never returns registration success',async()=>{
    await call('/users/EMP/face-enrollment','DELETE',undefined,admin);failWrite=true;
    assert.equal((await call('/users/me/face-enrollment','PUT',{urls})).status,500);
  });
});

test('face cache accepts only complete finite 128-dimensional descriptors',async()=>{
  assert.equal(face.validDescriptors([vector(0),vector(0),vector(0)]),true);
  assert.equal(face.validDescriptors([[0],[0],[0]]),false);
  assert.equal(face.validDescriptors([vector(NaN),vector(0),vector(0)]),false);
  const user={faceEnrollmentUrls:['/uploads/a.jpg','/uploads/b.jpg','/uploads/c.jpg'],faceDescriptors:[[0],[0],[0]],faceDescriptorVersion:1,faceDescriptorUrls:'/uploads/a.jpg|/uploads/b.jpg|/uploads/c.jpg'};
  await assert.rejects(face.ensureEnrolledDescriptors(user,()=>{}),err=>err.code==='missing_photo');
  assert.equal(user.faceEnrollmentValid,false);
});

test('attendance calendar follows India midnight rather than UTC midnight',()=>{
  const {attendanceDay}=require('../src/lib/attendanceDay');
  assert.equal(attendanceDay('2026-10-23T18:29:59Z'),'2026-10-23');
  assert.equal(attendanceDay('2026-10-23T18:30:00Z'),'2026-10-24');
  assert.equal(attendanceDay('2026-10-31T19:00:00Z'),'2026-11-01');
  assert.equal(attendanceDay('invalid-date'),'');
});
