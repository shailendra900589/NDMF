import {test} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {create,act} from 'react-test-renderer';import {createServer} from 'vite';
test('customer detail shows saved documents, enlarges photos and ignores stale responses',async()=>{
 const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]}});let tree;
 try{const {customersApi}=await server.ssrLoadModule('/src/api/api.js');const {default:Details}=await server.ssrLoadModule('/src/components/CustomerDetails.jsx');let finishOld;
 customersApi.getById=id=>id==='OLD'?new Promise(r=>{finishOld=r;}):Promise.resolve({data:{id:'NEW',name:'Test customer',mobile:'9000000000',verification:{status:'listed',photos:[{key:'photo',label:'Customer photo',media:{filePath:'/uploads/ONE_photo.jpg?signature=test'}},{key:'missing',label:'Missing document',media:'https://external.example/document.jpg'}],neighbors:[{shopName:'Neighbor',remarks:'Verified shop note'}]}}});
 await act(async()=>{tree=create(React.createElement(Details,{customerId:'OLD',onClose(){}}));});await act(async()=>tree.update(React.createElement(Details,{customerId:'NEW',onClose(){}})));
 await act(async()=>finishOld({data:{name:'Stale customer'}}));let output=JSON.stringify(tree.toJSON());assert.match(output,/Test customer/);assert.match(output,/Verified shop note/);assert.doesNotMatch(output,/Stale customer/);assert.match(output,/Document unavailable/);
 await act(async()=>tree.root.findAllByType('button').find(b=>b.props.className==='customer-photo-button').props.onClick());assert.equal(tree.root.findByProps({className:'customer-photo-large'}).props.src,'/uploads/ONE_photo.jpg?signature=test');
 }finally{if(tree)await act(async()=>tree.unmount());await server.close();}
});
