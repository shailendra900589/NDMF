import {test} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {create,act} from 'react-test-renderer';import {createServer} from 'vite';
test('listing View fetches full application, shows identity and verification sections, and ignores stale replies',async()=>{
 const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]}});
 let tree;const previous=globalThis.localStorage;globalThis.localStorage={getItem:()=>JSON.stringify({role:'admin',permissions:{customerListings:true,callLogs:true}})};
 try{
 const {listingsApi,callLogsApi}=await server.ssrLoadModule('/src/api/api.js');const {default:Page}=await server.ssrLoadModule('/src/pages/CustomerListings.jsx');
 listingsApi.getAll=async()=>({data:[{id:'ONE',name:'First',mobile:'9000000000',status:'rejected'},{id:'TWO',name:'Second',mobile:'9000000001',status:'rejected'}]});let finishOld;
 listingsApi.getById=id=>id==='ONE'?new Promise(r=>{finishOld=r;}):Promise.resolve({data:{id:'TWO',name:'Complete second',mobile:'9000000001',status:'rejected',aadhaar:'123412341234',pan:'ABCDE1234F',shopFullAddress:'Full shop address',assignedToName:'Assigned employee name',neighbors:[{shopName:'Verified neighbor',remarks:'Visit notes'}]}});
 callLogsApi.getAll=async()=>({data:[]});await act(async()=>{tree=create(React.createElement(Page));});
 let view=tree.root.findAllByType('button').filter(b=>b.children.join('')==='View');await act(async()=>view[0].props.onClick());
 view=tree.root.findAllByType('button').filter(b=>b.children.join('')==='View');await act(async()=>view[1].props.onClick());await act(async()=>finishOld({data:{id:'ONE',name:'Stale full record'}}));
 const out=JSON.stringify(tree.toJSON());for(const value of ['123412341234','ABCDE1234F','Verified neighbor','Application & assignment','Photos & documents','Assigned employee name'])assert.ok(out.includes(value),value);assert.ok(!out.includes('Stale full record'));
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.localStorage=previous;await server.close();}
});
