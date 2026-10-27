import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupRouteDays,routeReport} from '../src/utils/routeReport.js';
test('monthly summaries count all shifts while detailed export preserves each stop, endpoint and missing GPS status',()=>{
  const days=[{date:'2026-10-22',attendanceId:'A',totalKm:3,stopCount:2,pointCount:4,dutyMinutes:40},{date:'2026-10-22',attendanceId:'B',totalKm:5,stopCount:1,pointCount:3,dutyMinutes:60},{date:'2026-09-22',totalKm:99}];
  const grouped=groupRouteDays(days,'2026-10');
  assert.equal(grouped.length,1);assert.equal(grouped[0].totalKm,8);assert.equal(grouped[0].shifts.length,2);
  const output=routeReport([{name:'Dummy',userId:'U',date:'2026-10-22',attendanceId:'A',checkInTime:'2026-10-21T19:00:00Z',summary:{totalKm:3,pointCount:2},timeline:[{type:'travel',from:{lat:26,lng:83},to:{lat:27,lng:84},km:3,minutes:10},{type:'stop',number:1,lat:27,lng:84,minutes:15}]},
    {name:'Dummy',userId:'U',date:'2026-10-23',attendanceId:'B',summary:{pointCount:0},timeline:[]}],()=> 'Test place');
  assert.equal(output.rows.length,6);
  const travel=output.rows.find(r=>r[4]==='travel');
  assert.match(travel[9],/Test place.*26.00000/);assert.match(travel[10],/27.00000/);
  assert.equal(output.rows.find(r=>r[4]==='Stop 1')[7],15);assert.match(output.rows.at(-1)[11],/route points not received/);
  assert.match(output.rows.find(r=>r[4]==='Shift summary')[5],/00:30:00/);
  assert.equal(output.rows.find(r=>r[4]==='Daily total')[8],3);
});
