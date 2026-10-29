const {test}=require('node:test');const assert=require('node:assert/strict');const jwt=require('jsonwebtoken');
const rows=new Map([['users:S',{collection:'users',id:'S',data:{id:'S',role:'superAdmin'}}]]);
async function query(sql,args){if(/SELECT collection/.test(sql))return {rows:[...rows.values()]};if(/INSERT INTO ndfa_docs/.test(sql))rows.set(`${args[0]}:${args[1]}`,{collection:args[0],id:args[1],data:JSON.parse(args[2])});return {rows:[]};}
require.cache[require.resolve('../src/lib/pg')]={exports:{query,getPool:()=>({connect:async()=>({query,release(){}})})}};
const db=require('../src/lib/db');
test('GPS stream and independent device heartbeat update live status in real HTTP requests',async t=>{
 await db.initDb();db.upsert('companies',{id:'TRACK_QA',isActive:true});
 for(const [id,role] of [['A','admin'],['E','fieldOfficer']])db.upsert('users',{id,companyId:'TRACK_QA',role,name:id,branch:'QA',isActive:true});
 const start=new Date(Date.now()-3600000).toISOString();db.upsert('attendance',{id:'QA_SHIFT',companyId:'TRACK_QA',userId:'E',branch:'QA',date:start,checkInTime:start,checkInLat:26.7,checkInLng:83.3});
 const server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 async function call(path,body,actor='E'){const response=await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({userId:actor},require('../src/config/env').jwtSecret)}`},body:body?JSON.stringify(body):undefined});assert.equal(response.status,200);return (await response.json()).data;}
 let live=(await call('/tracking/live',null,'A'))[0];assert.equal(live.status,'offline');
 const before=live.lastSeenAt;
 const at=new Date().toISOString();await call('/tracking/live-ping',{lat:26.7,lng:83.3,accuracy:95,recordedAt:at});
 live=(await call('/tracking/live',null,'A'))[0];assert.equal(live.status,'weak_gps');assert.notEqual(live.lastSeenAt,before);assert.equal(live.totalKmToday,0);
 await call('/tracking/heartbeat',{locationEnabled:false,permission:'granted',trackingActive:true,appVersion:'1.6.3',batteryPercent:46,charging:false,powerSaveMode:true,batteryOptimizationExempt:false,trackingEngine:'android_native'});
 live=(await call('/tracking/live',null,'A'))[0];assert.equal(live.status,'location_off');assert.equal(live.deviceOnline,true);assert.ok(live.appLastSeenAt);
 assert.equal(live.batteryPercent,46);assert.equal(live.powerSaveMode,true);assert.equal(live.trackingEngine,'android_native');assert.ok(live.locationOffAt);assert.equal(live.locationEvents.at(-1).enabled,false);
 await call('/tracking/heartbeat',{locationEnabled:true,permission:'granted',trackingActive:true,backgroundAllowed:true,appVersion:'1.6.3',batteryPercent:47,charging:true,trackingEngine:'android_native'});
 await call('/tracking/live-ping',{lat:26.7001,lng:83.3001,accuracy:8,recordedAt:new Date().toISOString()});
 live=(await call('/tracking/live',null,'A'))[0];assert.equal(live.status,'live');assert.equal(live.appVersion,'1.6.3');assert.equal(live.accuracy,8);assert.equal(live.batteryPercent,47);assert.equal(live.charging,true);assert.equal(live.locationEvents.at(-1).enabled,true);
 const stored=db.getCollection('liveLocations').find(r=>r.userId==='E');assert.equal(live.lastSeenAt,stored.at);
});
