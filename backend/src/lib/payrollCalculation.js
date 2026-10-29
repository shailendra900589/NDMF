const {attendanceDay}=require('./attendanceDay');
const round=value=>Math.round((value+Number.EPSILON)*100)/100;
function salaryUpdate(target,amount,month,actorId){
  const value=Number(amount);
  if(!Number.isFinite(value) || value<=0 || value>10000000 || round(value)!==value)throw new Error('Monthly salary must be positive with at most two decimal places');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || ''))throw new Error('Choose a valid salary effective month');
  const history=(target.salaryHistory || []).filter(item=>item.month!==month);
  history.push({month,amount:value,updatedBy:actorId,updatedAt:new Date().toISOString()});history.sort((a,b)=>a.month.localeCompare(b.month));
  return {...target,monthlySalary:history.filter(item=>item.month<=attendanceDay().slice(0,7)).at(-1)?.amount || value,salaryHistory:history};
}
function calculatePayroll(employee,month,records,adjustments){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || ''))throw new Error('Choose a valid payroll month');
  const salary=(employee.salaryHistory || []).filter(item=>item.month<=month).sort((a,b)=>a.month.localeCompare(b.month)).at(-1)?.amount ?? (!employee.salaryHistory?.length ? employee.monthlySalary : 0);
  if(!(salary>0))throw new Error('Set the employee monthly salary effective for this month first');
  const year=Number(month.slice(0,4)),m=Number(month.slice(5)),calendarDays=new Date(Date.UTC(year,m,0)).getUTCDate();
  let presentDays=0,halfDayDays=0,lateDays=0,paidLeaveDays=0,weeklyOffDays=0,unpaidLeaveDays=0,absentDays=0,paidDays=0;
  const details=[];let sundays=0;
  for(let day=1;day<=calendarDays;day++){
    const date=`${month}-${String(day).padStart(2,'0')}`;
    const isSunday=new Date(`${date}T12:00:00Z`).getUTCDay()===0;
    const paidSunday=isSunday && ++sundays<=4;
    const correction=adjustments.find(a=>a.userId===employee.id && a.date===date && a.status!=='automatic');
    const attended=records.filter(a=>a.userId===employee.id && a.checkInTime && attendanceDay(a.date || a.checkInTime)===date).sort((a,b)=>a.checkInTime.localeCompare(b.checkInTime))[0];
    const arrival=attended?require('./attendanceTiming').arrivalStatus(attended):null;
    let status;
    if(paidSunday){status='paid_sunday';weeklyOffDays++;paidDays++;}
    else if(correction?.status==='half_day'||(!correction&&arrival==='half_day')){status='half_day';halfDayDays++;presentDays+=0.5;paidDays+=0.5;}
    else if(correction?.status==='present' || (!correction && attended)){status=!correction&&arrival==='late'?'late':'present';if(status==='late')lateDays++;presentDays++;paidDays++;}
    else if(correction?.status==='paid_leave' || correction?.status==='holiday'){status='paid_leave';paidLeaveDays++;paidDays++;}
    else if(correction?.status==='unpaid_leave'){status='unpaid_leave';unpaidLeaveDays++;}
    else{status='absent_or_pending';absentDays++;}
    details.push({date,status,reason:correction?.reason || (paidSunday?'Automatic paid Sunday (first four Sundays)':'')});
  }
  const earnedSalary=round(Number(salary)*paidDays/calendarDays),lossOfPay=round(Number(salary)-earnedSalary);
  return {month,asOf:attendanceDay(),isProvisional:month>=attendanceDay().slice(0,7),userId:employee.id,employeeNo:employee.employeeId,calendarDays,monthlySalary:Number(salary),dailyRate:round(Number(salary)/calendarDays),paidDays,unpaidDays:calendarDays-paidDays,presentDays,halfDayDays,lateDays,paidLeaveDays,weeklyOffDays,unpaidLeaveDays,absentDays,earnedSalary,lossOfPay,details,calculatedAt:new Date().toISOString(),policy:'Calendar-day salary proration; half days pay 0.5 day, late arrivals pay a full day. Reasoned corrections override arrival status. First four Sundays paid without double counting. Unrecorded/future days remain unpaid/pending until reviewed.'};
}
module.exports={salaryUpdate,calculatePayroll};
