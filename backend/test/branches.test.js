const {test}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const rows=new Map();
rows.set('users:SENTINEL',{collection:'users',id:'SENTINEL',data:{id:'SENTINEL',role:'superAdmin'}});
async function query(sql,args){if(/SELECT collection/.test(sql))return {rows:[...rows.values()]};if(/INSERT INTO ndfa_docs/.test(sql))rows.set(`${args[0]}:${args[1]}`,{collection:args[0],id:args[1],data:JSON.parse(args[2])});return {rows:[]};}
require.cache[require.resolve('../src/lib/pg')]={exports:{query,getPool:()=>({connect:async()=>({query,release(){}})})}};
const db=require('../src/lib/db');
test('branch rename follows company links; deletion protects linked records and enforces permissions',async t=>{
  await db.initDb();
  for(const id of ['ONE','TWO'])db.upsert('companies',{id,isActive:true});
  for(const [id,role,companyId] of [['ADMIN','admin','ONE'],['OTHER','admin','TWO'],['STAFF','fieldOfficer','ONE']])db.upsert('users',{id,role,companyId,isActive:true,branch:role==='fieldOfficer'?'Old branch':null});
  for(const [id,companyId,name] of [['B1','ONE','Old branch'],['B2','TWO','Old branch'],['EMPTY','ONE','Unused'],['DUP','ONE','Existing']])db.upsert('branches',{id,companyId,name,isActive:true});
  db.upsert('customers',{id:'C1',companyId:'ONE',branch:'Old branch'});db.upsert('customers',{id:'C2',companyId:'TWO',branch:'Old branch'});
  db.upsert('tracking',{id:'T1',companyId:'ONE',branch:'Old branch'});
  const server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const {jwtSecret}=require('../src/config/env');
  async function call(path,method,body,user='ADMIN'){
    const r=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/branches${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({userId:user},jwtSecret)}`},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,...await r.json()};
  }
  assert.equal((await call('/B1','PUT',{name:'Renamed'},'STAFF')).status,403);
  assert.equal((await call('/B1','PUT',{name:'Renamed'},'OTHER')).status,404);
  assert.equal((await call('/B1','PUT',{name:' existing '})).status,409);
  assert.equal((await call('/B1','PUT',{name:' '})).status,400);
  assert.equal((await call('/B1','PUT',{name:'Renamed'})).status,200);
  assert.equal(db.findById('users','STAFF').branch,'Renamed');assert.equal(db.findById('customers','C1').branch,'Renamed');assert.equal(db.findById('tracking','T1').branch,'Renamed');
  assert.equal(db.findById('customers','C2').branch,'Old branch');assert.equal(db.findById('branches','B2').name,'Old branch');
  assert.equal((await call('/B1','DELETE')).status,409);
  assert.equal((await call('/EMPTY','DELETE',undefined,'STAFF')).status,403);
  db.upsert('companies',{id:'ONE',isActive:true,actions:{branches:{delete:false}}});
  assert.equal((await call('/EMPTY','DELETE')).status,403);
  db.upsert('companies',{id:'ONE',isActive:true});
  assert.equal((await call('/EMPTY','DELETE')).status,200);assert.equal(db.findById('branches','EMPTY'),null);
  await db.flush();
});
