const {test}=require('node:test');const assert=require('node:assert/strict');const {calculatePayroll,salaryUpdate}=require('../src/lib/payrollCalculation');
test('salary proration pays four Sundays, avoids overlap, honours effective salary and reasoned paid leave',()=>{
 let employee=salaryUpdate({id:'EMP',employeeId:'E1'},31000,'2026-10','ADMIN');
 employee=salaryUpdate(employee,62000,'2026-11','ADMIN');
 const records=[{userId:'EMP',date:'2026-10-04',checkInTime:'2026-10-04T03:00:00Z'},{userId:'EMP',date:'2026-10-05',checkInTime:'2026-10-05T03:00:00Z'},{userId:'EMP',date:'2026-10-05',checkInTime:'2026-10-05T07:00:00Z'}];
 const calculation=calculatePayroll(employee,'2026-10',records,[{userId:'EMP',date:'2026-10-06',status:'paid_leave',reason:'Approved leave'},{userId:'EMP',date:'2026-10-07',status:'unpaid_leave',reason:'Unpaid leave'}]);
 assert.equal(calculation.monthlySalary,31000);assert.equal(calculation.weeklyOffDays,4);assert.equal(calculation.presentDays,1);assert.equal(calculation.paidLeaveDays,1);assert.equal(calculation.paidDays,6);assert.equal(calculation.earnedSalary,6000);assert.equal(calculation.lossOfPay,25000);assert.equal(calculation.details.find(d=>d.date==='2026-10-06').reason,'Approved leave');
 const november=calculatePayroll(employee,'2026-11',[],[]);assert.equal(november.weeklyOffDays,4);assert.equal(november.details.find(d=>d.date==='2026-11-29').status,'absent_or_pending');assert.equal(november.monthlySalary,62000);
 assert.throws(()=>calculatePayroll(employee,'2026-09',[],[]),/Set the employee/);
});
