import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function run(fetcher){
  const html=await readFile(new URL('../../public-site/index.html',import.meta.url),'utf8');
  const source=await readFile(new URL('../../public-site/brand/site.js',import.meta.url),'utf8');
  const link={href:html.match(/href="(\/downloads\/mystaff-smart-[\d.]+\.apk)"/)[1],textContent:'Download Android app'};
  const element={addEventListener(){},querySelectorAll(){return [];},style:{},classList:{add(){}}};
  const document={querySelector:()=>element,querySelectorAll:selector=>selector==='a[href$=".apk"]'?[link]:[],addEventListener(){}};
  vm.runInNewContext(source,{document,window:{matchMedia:()=>({matches:false})},fetch:fetcher,encodeURIComponent,Date});
  await new Promise(resolve=>setImmediate(resolve));return link;
}
test('app download displays release version and a checksum cache key',async()=>{
  const link=await run(async()=>({ok:true,json:async()=>({version:'1.6.2',file:'mystaff-smart-1.6.2.apk',sha256:'abcdef1234567890'})}));
  assert.equal(link.href,'/downloads/mystaff-smart-1.6.2.apk?v=abcdef123456');
  assert.match(link.textContent,/1\.6\.2/);
});
test('manifest failure keeps the current APK fallback rather than an old app',async()=>{
  const link=await run(async()=>{throw Error('Network unavailable');});
  assert.equal(link.href,'/downloads/mystaff-smart-1.6.2.apk');
});
