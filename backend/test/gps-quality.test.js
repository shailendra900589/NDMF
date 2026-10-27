const {test}=require('node:test');const assert=require('node:assert/strict');
const {ingest,normalizePoint,reportPoints}=require('../src/lib/gpsTrack');
const base=Date.now()-600000;
const p=(meters,seconds,speed=0)=>({lat:26+meters/111195,lng:83,accuracy:8,speed,at:base+seconds*1000,mocked:false});
test('stationary GPS drift and a single excursion do not inflate distance',()=>{
 const report={};ingest(report,p(0,0));
 for(let i=1;i<=15;i++)ingest(report,p(i%2?90:-70,i*15));
 assert.equal(report.totalMeters,0);assert.equal(reportPoints(report).length,1);
 ingest(report,p(0,250));assert.equal(report.totalMeters,0);
});
test('sustained movement is confirmed; low quality and mock points never update live location',()=>{
 const report={};assert.equal(ingest(report,p(0,0)),'anchor');
 assert.equal(ingest(report,p(45,30,1.5)),'pending');
 assert.equal(ingest(report,p(75,50,1.5)),'moved');assert.ok(report.totalMeters>70 && report.totalMeters<80);
 const lat=report.lastLat;
 assert.equal(ingest(report,{...p(800,65),mocked:true}),'mocked');assert.equal(report.lastLat,lat);
 assert.equal(ingest(report,{...p(800,65),accuracy:100}),'inaccurate');assert.equal(report.lastLat,lat);
 assert.equal(normalizePoint({lat:26,lng:83,recordedAt:'invalid'}),null);
});
