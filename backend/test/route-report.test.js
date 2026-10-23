const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyzeShift}=require('../src/lib/routeAnalysis');
const {attendanceDay}=require('../src/lib/attendanceDay');
test('route report includes stop durations and both journey endpoints without inventing time after the last fix',()=>{
  const start=Date.parse('2026-10-21T19:00:00Z');
  const routePoints=[{latitude:26,longitude:83,timestamp:new Date(start).toISOString(),leftAt:new Date(start+10*60000).toISOString()},
    {latitude:26.02,longitude:83.02,timestamp:new Date(start+20*60000).toISOString(),leftAt:new Date(start+35*60000).toISOString()}];
  const report=analyzeShift({routePoints,totalKm:3,lastFixAt:start+35*60000},{checkInTime:new Date(start).toISOString()},{now:start+60*60000});
  assert.equal(attendanceDay(start),'2026-10-22');
  assert.deepEqual(report.stops.map(s=>s.minutes),[10,15]);
  const travel=report.timeline.find(e=>e.type==='travel');
  assert.deepEqual(travel.from,{lat:26,lng:83});assert.deepEqual(travel.to,{lat:26.02,lng:83.02});
  assert.equal(travel.minutes,10);
  assert.equal(report.stops[1].leftAt,new Date(start+35*60000).toISOString());
  assert.equal(report.summary.stoppedMinutes,25);
});
