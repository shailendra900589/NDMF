import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createServer } from 'vite';

test('attendance policy editor sends enabled IST timings and displays validation errors', async () => {
  const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]}});
  let tree;
  try {
    const {attendanceApi}=await server.ssrLoadModule('/src/api/api.js');
    const {default:Editor}=await server.ssrLoadModule('/src/components/AttendanceTiming.jsx');
    const policy={enabled:false,opensAt:'06:00',startsAt:'09:00',closesAt:'12:00',endsAt:'18:00',graceMinutes:15,timeZone:'Asia/Kolkata'};
    attendanceApi.getOperations=async()=>({data:{defaultTiming:policy,users:[],branches:[],schedules:[],festivals:[]}});
    let submitted;
    attendanceApi.saveSchedule=async body=>{submitted=body;return{data:{}};};
    await act(async()=>{tree=create(React.createElement(Editor));});
    assert.ok(tree.root.findAllByType('input').some(i=>i.props.type==='number' && i.props.max==='480' && i.props.value===60));
    await act(async()=>tree.root.findAllByType('input').find(i=>i.props.type==='checkbox').props.onChange({target:{checked:true}}));
    await act(async()=>tree.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));
    assert.deepEqual(submitted,{scope:'default',branch:undefined,userId:undefined,name:'Default company shift',weekdays:[0,1,2,3,4,5,6],policy:{...policy,enabled:true}});
    attendanceApi.saveSchedule=async()=>{throw new Error('Use a same-day shift');};
    await act(async()=>tree.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));
    assert.match(JSON.stringify(tree.toJSON()),/Use a same-day shift/);
    await act(async()=>tree.unmount());
    attendanceApi.getOperations=async()=>{throw new Error('Attendance service unavailable');};
    await act(async()=>{tree=create(React.createElement(Editor));});
    assert.match(JSON.stringify(tree.root.findByProps({role:'alert'}).toJSON?.() || tree.toJSON()),/Attendance service unavailable/);
    attendanceApi.getOperations=async()=>({data:{defaultTiming:policy,users:[],branches:[],schedules:[],festivals:[]}});
    await act(async()=>tree.root.findByType('button').props.onClick());
    assert.equal(tree.root.findAllByType('form').length,2);
  } finally {if(tree)await act(async()=>tree.unmount());await server.close();}
});
