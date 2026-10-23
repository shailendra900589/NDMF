export const reportTime = value => value ? new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:false}) : '';
export function reportPlace(point, address = () => '') {
  if (point?.lat == null || point?.lng == null) return '';
  const coordinates=`${Number(point.lat).toFixed(5)}, ${Number(point.lng).toFixed(5)}`;
  const name=address(point.lat,point.lng);
  return name ? `${name} (${coordinates})` : coordinates;
}
export function routeReport(routes,address) {
  const rows=[];
  const totals=new Map();
  for(const route of routes){
    const key=`${route.userId}|${route.date}`;
    const total=totals.get(key) || {route,km:0,minutes:0,shifts:0,points:0};
    total.km+=Number(route.summary?.totalKm ?? route.totalKm ?? 0);total.minutes+=Number(route.summary?.dutyMinutes || 0);total.points+=Number(route.summary?.pointCount || 0);total.shifts++;
    totals.set(key,total);
  }
  for(const {route,km,minutes,shifts,points} of totals.values())rows.push([route.name,route.employeeId || route.userId,route.date,'','Daily total','','',minutes,Number(km.toFixed(2)),'','',`${shifts} recorded shift(s); ${points} GPS points${!points ? '; no GPS route recorded' : ''}`]);
  for (const route of routes) {
    const prefix=[route.name,route.employeeId || route.userId,route.date,route.attendanceId];
    const s=route.summary || {};
    rows.push([...prefix,'Shift summary',reportTime(route.checkInTime),reportTime(route.checkOutTime),s.dutyMinutes ?? '',s.totalKm ?? route.totalKm ?? '',
      reportPlace(route.points?.[0] || route.checkIn,address),reportPlace(route.points?.at(-1) || route.checkOut,address),
      `${s.pointCount || 0} GPS points; ${s.stopCount || 0} stops; ${s.stoppedMinutes || 0} stopped min; ${s.signalLostMinutes || 0} signal-gap min${!s.pointCount ? '; no GPS route recorded' : ''}`]);
    for (const e of route.timeline || []) rows.push([...prefix,e.type==='stop'?`Stop ${e.number}`:e.type,reportTime(e.at),reportTime(e.until),e.minutes ?? '',e.km ?? '',
      reportPlace(e.from || e,address),reportPlace(e.to,address),e.ongoing?'Observed through latest GPS fix; not proof of current presence':'']);
  }
  return {headers:['Employee','Employee ID','Business date (India)','Shift ID','Event','From time (IST)','To time (IST)','Minutes','KM','From / stop location','To location','Notes'],rows};
}
export function groupRouteDays(shifts,month) {
  const grouped=new Map();
  for (const shift of shifts.filter(s=>s.date.startsWith(`${month}-`))) {
    const day=grouped.get(shift.date) || {date:shift.date,totalKm:0,stopCount:0,dutyMinutes:0,pointCount:0,shifts:[]};
    for (const key of ['totalKm','stopCount','dutyMinutes','pointCount']) day[key]+=Number(shift[key] || 0);
    day.shifts.push(shift);grouped.set(shift.date,day);
  }
  return [...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
