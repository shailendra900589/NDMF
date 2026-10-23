import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createServer } from 'vite';

test('developer approval submits explicit limits and shows the one-time secret', async () => {
  const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]}});
  let tree;
  try {
    const {developerApi}=await server.ssrLoadModule('/src/api/api.js');
    const {default:Page}=await server.ssrLoadModule('/src/pages/DeveloperAccess.jsx');
    const data={applications:[{id:'APP_TEST',organization:'Test developer',email:'dev@example.test',name:'Dev',purpose:'Reports',scopes:['customers:read'],requestedDays:30,status:'pending',createdAt:new Date().toISOString()}],companies:[{id:'CO_TEST',name:'Test company',isActive:true}],grants:[],scopes:['customers:read','attendance:read']};
    developerApi.overview=async()=>({data});
    let submitted;
    developerApi.action=async(path,body)=>{submitted={path,body};return {message:'Copy the secret now',data:{token:'ndfa_one_time_test_secret'}};};
    await act(async()=>{tree=create(React.createElement(Page));});
    const selects=()=>tree.root.findAllByType('select');
    await act(async()=>selects()[0].props.onChange({target:{value:'APP_TEST'}}));
    await act(async()=>selects()[1].props.onChange({target:{value:'CO_TEST'}}));
    await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
    assert.deepEqual(submitted,{path:'applications/APP_TEST/approve',body:{companyId:'CO_TEST',days:30,requestsPerMinute:60,scopes:['customers:read']}});
    assert.match(JSON.stringify(tree.toJSON()),/ndfa_one_time_test_secret/);
    const dismiss=tree.root.findAllByType('button').find(b=>b.children.includes('Dismiss secret'));
    await act(async()=>dismiss.props.onClick());
    assert.doesNotMatch(JSON.stringify(tree.toJSON()),/ndfa_one_time_test_secret/);
    developerApi.action=async()=>{throw {response:{data:{message:'Company suspended'}}};};
    await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
    assert.match(JSON.stringify(tree.toJSON()),/Company suspended/);
    developerApi.action=async(path,body)=>{submitted={path,body};return {data:{token:'ndfa_direct_test_secret'}};};
    await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('Create directly')).props.onClick());
    await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('Fill test account details')).props.onClick());
    await act(async()=>selects()[0].props.onChange({target:{value:'CO_TEST'}}));
    await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
    assert.deepEqual(submitted,{path:'grants',body:{name:'Test developer',email:'developer@example.test',organization:'API test integration',purpose:'Verify scoped API access with dummy company data',companyId:'CO_TEST',days:1,requestsPerMinute:10,scopes:['locations:read']}});
    assert.match(JSON.stringify(tree.toJSON()),/ndfa_direct_test_secret/);
  } finally { if(tree) await act(async()=>tree.unmount());await server.close(); }
});
