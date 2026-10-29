import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {createServer} from 'vite';
test('package editor saves employee rates, functions and publication; assignment uses selected company',async()=>{
 const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]}});let tree;
 try{
  const {packageApi}=await server.ssrLoadModule('/src/api/api.js');const {default:Page}=await server.ssrLoadModule('/src/pages/Packages.jsx');
  const plan={id:'P',name:'Starter',description:'Essential tools',monthlyPrice:1000,includedEmployees:5,extraEmployeeMonthlyPrice:200,billingMonths:1,published:true,isArchived:false,modules:{dashboard:true,users:true},actions:{dashboard:{create:true},users:{create:true}}};
  const data={packages:[plan],modules:{dashboard:'Dashboard',users:'Employee & Permission'},actions:{create:'Create'},moduleActions:{dashboard:[],users:['create']},companies:[{id:'C',name:'Test company',employees:6}],requests:[]};
  packageApi.overview=async()=>({data});let saved,assigned;
  packageApi.create=async body=>{saved=structuredClone(body);return {data:{...body,id:'NEW'}};};
  packageApi.assign=async(id,body)=>{assigned={id,body};return {data:{}};};
  await act(async()=>{tree=create(React.createElement(Page));});
  await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('+ Create package')).props.onClick());
  await act(async()=>tree.root.findAllByType('input').find(n=>n.props.maxLength===80).props.onChange({target:{value:'Growth'}}));
  await act(async()=>tree.root.findAllByType('input').find(n=>n.props['aria-label']==='Dashboard page access').props.onChange({target:{checked:true}}));
  await act(async()=>tree.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));
  assert.equal(saved.monthlyPrice,1000);assert.equal(saved.includedEmployees,5);assert.equal(saved.extraEmployeeMonthlyPrice,200);assert.equal(saved.modules.dashboard,true);assert.equal(saved.published,false);
  await act(async()=>tree.root.findAllByType('select')[0].props.onChange({target:{value:'C'}}));
  await act(async()=>tree.root.findAllByType('select')[1].props.onChange({target:{value:'P'}}));
  assert.match(JSON.stringify(tree.toJSON()),/1,200/);
  await act(async()=>tree.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}}));
  assert.equal(assigned.id,'C');assert.equal(assigned.body.packageId,'P');assert.match(assigned.body.startsOn,/^\d{4}-\d{2}-\d{2}$/);
 }finally{if(tree)await act(async()=>tree.unmount());await server.close();}
});
