import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';

test('theme controls persist a choice and remain usable with blocked storage',async()=>{
  const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]}});
  const previous={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage};let tree;
  try{
    const values=new Map([['smartstaff-theme','dark']]);
    globalThis.localStorage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
    globalThis.document={documentElement:{dataset:{theme:'dark'},style:{}}};
    const listeners=new Map();globalThis.window={addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
    const {default:ThemeToggle}=await server.ssrLoadModule('/src/components/ThemeToggle.jsx');
    await act(async()=>{tree=create(React.createElement(ThemeToggle));});
    assert.equal(tree.root.findByType('button').props['aria-label'],'Switch to light mode');
    await act(async()=>tree.root.findByType('button').props.onClick());
    assert.equal(values.get('smartstaff-theme'),'light');assert.equal(document.documentElement.dataset.theme,'light');assert.equal(document.documentElement.style.colorScheme,'light');
    globalThis.localStorage.setItem=()=>{throw new Error('Storage blocked');};
    await act(async()=>tree.root.findByType('button').props.onClick());
    assert.equal(document.documentElement.dataset.theme,'dark');
    assert.equal(tree.root.findByType('button').props['aria-pressed'],true);
    await act(async()=>listeners.get('storage')({key:'smartstaff-theme',newValue:'light'}));
    assert.equal(tree.root.findByType('button').props['aria-pressed'],false);
  }finally{if(tree)await act(async()=>tree.unmount());Object.assign(globalThis,previous);await server.close();}
  assert.equal(await readFile(new URL('../public/theme-init.js',import.meta.url),'utf8'),await readFile(new URL('../../public-site/brand/theme-init.js',import.meta.url),'utf8'));
});
