import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createServer } from 'vite';

test('attendance policy editor sends enabled IST timings and displays validation errors', async () => {
  const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]}});
  let tree;
  try {
    const {default:api}=await server.ssrLoadModule('/src/api/api.js');
    const {default:Editor}=await server.ssrLoadModule('/src/components/AttendanceTiming.jsx');
    const policy={enabled:false,opensAt:'06:00',startsAt:'09:00',closesAt:'12:00',endsAt:'18:00',graceMinutes:15,timeZone:'Asia/Kolkata'};
    api.get=async()=>({data:{attendanceTiming:policy}});
    let submitted;
    api.put=async(path,body)=>{submitted={path,body};return{data:{}};};
    await act(async()=>{tree=create(React.createElement(Editor));});
    await act(async()=>tree.root.findAllByType('input').find(i=>i.props.type==='checkbox').props.onChange({target:{checked:true}}));
    await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
    assert.equal(submitted.path,'/settings/attendance-timing');
    assert.deepEqual(submitted.body,{...policy,enabled:true});
    api.put=async()=>{throw new Error('Use a same-day shift');};
    await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
    assert.match(JSON.stringify(tree.toJSON()),/Use a same-day shift/);
  } finally {if(tree)await act(async()=>tree.unmount());await server.close();}
});
