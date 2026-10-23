import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createServer } from 'vite';

test('searchable dropdown commits only selected options and preserves numeric values', async () => {
  const server = await createServer({ssr:{noExternal:['react-dom']},configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]},
    plugins:[{name:'renderer-portal',enforce:'pre',resolveId(id){if(id==='react-dom')return '\0renderer-portal';},load(id){if(id==='\0renderer-portal')return 'export function createPortal(children) { return children; }';}}]});
  const previous = {window:globalThis.window,document:globalThis.document};
  let tree;
  try {
    const listeners={};
    globalThis.window={innerWidth:1000,innerHeight:800,addEventListener(type,handler){listeners[type]=handler;},removeEventListener(type){delete listeners[type];}};
    globalThis.document={body:{},addEventListener(){},removeEventListener(){},getElementById(){return {scrollIntoView(){}};}};
    const {default:Select}=await server.ssrLoadModule('/src/components/SearchableSelect.jsx');
    const changes=[];
    const options=[React.createElement('option',{value:2,key:2},'2 minutes'),React.createElement('option',{value:5,key:5,disabled:true},'5 minutes'),React.createElement('optgroup',{label:'Long stops',key:'g'},React.createElement('option',{value:10},'10 minutes'))];
    await act(async()=>{tree=create(React.createElement(Select,{defaultValue:2,onChange:e=>changes.push(e.target.value)},options),{createNodeMock(element){return {value:'2',getBoundingClientRect:()=>({left:20,top:100,bottom:144,width:300}),contains:target=>{if(!target?.nodeType)throw new TypeError('Expected DOM Node');return false;},closest:()=>null};}});});
    const input=()=>tree.root.findByProps({role:'combobox'});
    const press=key=>act(async()=>input().props.onKeyDown({key,preventDefault(){}}));
    await act(async()=>input().props.onFocus({}));
    await act(async()=>listeners.resize({target:globalThis.window}));
    await act(async()=>input().props.onChange({target:{value:'long 10'}}));
    assert.equal(tree.root.findAllByProps({role:'option'}).length,1,'search includes group labels and multiple tokens');
    assert.deepEqual(changes,[],'typing must not change the selected value');
    await press('Enter');
    assert.deepEqual(changes,['10']);
    assert.equal(input().props.value,'10 minutes');
    await act(async()=>input().props.onFocus({}));await press('Enter');
    assert.deepEqual(changes,['10'],'reopening must highlight the existing selection');
    await act(async()=>input().props.onFocus({}));
    await act(async()=>input().props.onChange({target:{value:'missing'}}));
    await press('Enter');
    assert.deepEqual(changes,['10'],'no results cannot submit an arbitrary value');
    await press('Escape');
    assert.equal(input().props.value,'10 minutes','Escape restores the existing selection');
    await act(async()=>input().props.onFocus({}));
    await press('Home');await press('ArrowDown');await press('Enter');
    assert.deepEqual(changes,['10'],'keyboard skips disabled 5-minute option and keeps 10');
    await act(async()=>tree.update(React.createElement(Select,{value:0,disabled:true},React.createElement('option',{value:0},'Zero'))));
    assert.equal(input().props.value,'Zero');assert.equal(input().props.disabled,true);
  } finally {
    if(tree)await act(async()=>tree.unmount());await server.close();
    globalThis.window=previous.window;globalThis.document=previous.document;
  }
});
