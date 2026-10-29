const {test}=require('node:test'),assert=require('node:assert/strict'),jwt=require('jsonwebtoken');
const rows=[{collection:'users',id:'ROOT',data:{id:'ROOT',role:'superAdmin'}}];
require.cache[require.resolve('../src/lib/pg')]={exports:{query:async sql=>({rows:/SELECT collection/.test(sql)?rows:[]}),getPool:()=>({connect:async()=>({query:async()=>({rows:[]}),release(){}})})}};
const {validateTiming,timingAt}=require('../src/lib/attendanceTiming');
const {calculatePayroll}=require('../src/lib/payrollCalculation');
const policy=validateTiming({enabled:true,opensAt:'10:00',startsAt:'10:00',closesAt:'14:00',endsAt:'18:00',graceMinutes:15,halfDayAfterMinutes:60});
test('arrival boundaries allow 30-minute early check-in, then late and half-day in India time',()=>{
 const at=time=>timingAt(policy,new Date(`2026-10-01T${time}+05:30`));
 assert.equal(at('09:29:00').allowed,false);assert.equal(at('09:30:00').allowed,true);
 assert.equal(at('09:30:00').opensAt,'09:30');assert.equal(at('10:15:00').attendanceStatus,'present');
 assert.equal(at('10:15:01').attendanceStatus,'late');
 assert.equal(at('10:16:00').attendanceStatus,'late');assert.equal(at('10:59:00').attendanceStatus,'late');
 assert.equal(at('11:00:00').attendanceStatus,'half_day');assert.equal(at('13:00:00').attendanceStatus,'half_day');
 assert.throws(()=>validateTiming({...policy,halfDayAfterMinutes:15}));
 const branch={...policy,startsAt:'11:00',opensAt:'11:00'};assert.equal(timingAt(branch,new Date('2026-10-01T10:30:00+05:30')).allowed,true);
});
test('half-day payroll is 50%, late is full pay, audited admin correction restores full pay',async t=>{
 const db=require('../src/lib/db');await db.initDb();db.upsert('companies',{id:'C',isActive:true});
 const employee={id:'E',employeeId:'E',name:'Employee',role:'fieldOfficer',companyId:'C',branch:'Office',isActive:true,monthlySalary:31000};
 db.upsert('users',employee);db.upsert('users',{id:'A',role:'admin',companyId:'C',isActive:true});
 const records=[['2026-10-01','11:00:00'],['2026-10-02','10:16:00']].map(([date,time])=>({id:date,companyId:'C',userId:'E',branch:'Office',date,checkInTime:`${date}T${time}+05:30`,attendanceTiming:policy}));
 records.forEach(r=>db.upsert('attendance',r));
 let calc=calculatePayroll(employee,'2026-10',records,[]);assert.equal(calc.halfDayDays,1);assert.equal(calc.lateDays,1);assert.equal(calc.paidDays,5.5);assert.equal(calc.earnedSalary,5500);
 const server=require('../src/app').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const call=async(path,method='GET',body,actor='A')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({userId:actor},require('../src/config/env').jwtSecret)}`},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};};
 const correction={userId:'E',date:'2026-10-01',status:'present',reason:'Approved full working day'};
 const monthly=(await call('/attendance/monthly?year=2026&month=10')).data.employees.find(e=>e.id==='E');
 assert.equal(monthly.days[1].status,'half_day');assert.equal(monthly.days[2].status,'late');assert.equal(monthly.presentDays,1.5);
 assert.equal((await call('/attendance/adjustment','PUT',correction,'E')).status,403);
 assert.equal((await call('/attendance/adjustment','PUT',correction)).status,200);
 calc=calculatePayroll(employee,'2026-10',records,db.getCollection('attendanceAdjustments'));assert.equal(calc.halfDayDays,0);assert.equal(calc.earnedSalary,6000);
 assert.equal((await call('/attendance/monthly?year=2026&month=10')).data.employees.find(e=>e.id==='E').days[1].status,'present');
 assert.equal(db.findById('attendance','2026-10-01').checkInTime,records[0].checkInTime);
 assert.ok(db.getCollection('platformAudit').some(a=>a.action==='attendance.corrected'));
});

