const {test}=require('node:test');
const assert=require('node:assert/strict');
const rows=new Map([
  ['users:SA',{collection:'users',id:'SA',data:{id:'SA',role:'superAdmin',email:'ajitndfa@ndclients.co.in'}}],
  ['companies:CO_NDFA',{collection:'companies',id:'CO_NDFA',data:{id:'CO_NDFA',name:'Nirmaldhara Micro Foundation',isActive:true}}],
  ['companies:OTHER',{collection:'companies',id:'OTHER',data:{id:'OTHER',name:'Other business',isActive:true}}],
  ['payslips:OLD',{collection:'payslips',id:'OLD',data:{id:'OLD',companyName:'Nirmaldhara Micro Foundation'}}],
  ['payslips:OTHER',{collection:'payslips',id:'OTHER',data:{id:'OTHER',companyId:'OTHER',companyName:'Other business'}}],
]);
async function query(sql,args){
  if(/SELECT collection/.test(sql))return {rows:[...rows.values()].map(r=>structuredClone(r))};
  if(/INSERT INTO ndfa_docs/.test(sql))rows.set(`${args[0]}:${args[1]}`,{collection:args[0],id:args[1],data:JSON.parse(args[2])});
  return {rows:[]};
}
require.cache[require.resolve('../src/lib/pg')]={exports:{query,getPool:()=>({connect:async()=>({query,release(){}})})}};
test('branding migration updates the original tenant and legacy payslips once',async()=>{
  const db=require('../src/lib/db');const {bootstrapPlatform}=require('../src/lib/platformBootstrap');
  await db.initDb();await bootstrapPlatform();
  assert.equal(db.findById('companies','CO_NDFA').name,'MyStaff Smart');
  assert.equal(db.findById('payslips','OLD').companyId,'CO_NDFA');
  assert.equal(db.findById('payslips','OLD').companyName,'MyStaff Smart');
  assert.equal(db.findById('companies','OTHER').name,'Other business');
  assert.equal(db.findById('payslips','OTHER').companyName,'Other business');
  const changed=db.findById('companies','CO_NDFA').updatedAt;await bootstrapPlatform();
  assert.equal(db.findById('companies','CO_NDFA').updatedAt,changed);
  db.upsert('companies',{...db.findById('companies','CO_NDFA'),name:'Custom tenant name'});
  await bootstrapPlatform();assert.equal(db.findById('companies','CO_NDFA').name,'Custom tenant name');
});
