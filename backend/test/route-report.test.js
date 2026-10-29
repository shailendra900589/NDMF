const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyzeShift}=require('../src/lib/routeAnalysis');
const {attendanceDay}=require('../src/lib/attendanceDay');
test('route report includes stop durations and both journey endpoints without inventing time after the last fix',()=>{
  const start=Date.parse('2026-10-21T19:00:00Z');
  const routePoints=[{latitude:26,longitude:83,timestamp:new Date(start).toISOString(),leftAt:new Date(start+10*60000).toISOString()},
    {latitude:26.004,longitude:83.004,timestamp:new Date(start+12*60000).toISOString()},
    {latitude:26.008,longitude:83.008,timestamp:new Date(start+14*60000).toISOString()},
    {latitude:26.012,longitude:83.012,timestamp:new Date(start+16*60000).toISOString()},
    {latitude:26.016,longitude:83.016,timestamp:new Date(start+18*60000).toISOString()},
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

test('a missing GPS interval is visible as a gap and is never joined by a synthetic route line',()=>{
  const start=Date.parse('2026-10-22T04:00:00Z');
  const routePoints=[
    {latitude:26,longitude:83,timestamp:new Date(start).toISOString()},
    {latitude:26.02,longitude:83.02,timestamp:new Date(start+6*60000).toISOString()},
  ];
  const report=analyzeShift({routePoints,totalKm:0,lastFixAt:start+6*60000},{checkInTime:new Date(start).toISOString()},{now:start+7*60000});
  assert.equal(report.points[1].breakBefore,true);
  assert.equal(report.summary.routeIncomplete,true);
  assert.equal(report.timeline.some(e=>e.type==='travel'),false);
  assert.equal(report.gaps.length,1);
  assert.equal(report.gaps[0].minutes,6);
});
