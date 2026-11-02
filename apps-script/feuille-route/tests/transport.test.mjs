import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../../feuille-route-api.js',import.meta.url),'utf8');
const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const payload={id:'11111111-1111-4111-8111-111111111111',identity:'Patient fictif',photo:'PHOTO_TEST'};
async function withFetch(fake,run){const old=globalThis.fetch;globalThis.fetch=fake;try{await run();}finally{globalThis.fetch=old;}}
test('form is hosted on CRBO, has no Google navigation and does not persist patient data',()=>{
 const html=fs.readFileSync(new URL('../../../feuille-route.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/location\.(replace|assign)|google\.script\.run|localStorage|sessionStorage|indexedDB|serviceWorker/);
 assert.match(html,/checkRouteService/);assert.match(html,/id="send"[^>]*disabled/);
 new vm.Script(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/m,''));
});
test('capability request is anonymous and rejects old HTML deployments',async()=>{
 await withFetch(async(url,opt)=>{assert.equal(opt.credentials,'omit');assert.equal(new URL(url).searchParams.get('service'),'route-api');return {ok:true,json:async()=>({ok:true,routeApi:2})};},()=>api.checkRouteService());
 await withFetch(async()=>({ok:true,json:async()=>{throw Error('HTML');}}),()=>assert.rejects(api.checkRouteService()));
});
test('opaque POST is followed by a matching receipt; GET never includes patient fields',async()=>{
 const calls=[];await withFetch(async(url,opt)=>{calls.push({url,opt});assert.equal(opt.credentials,'omit');if(opt.method==='POST'){assert.equal(opt.mode,'no-cors');assert.equal(JSON.parse(opt.body).identity,payload.identity);return {type:'opaque'};}const u=new URL(url);assert.deepEqual([...u.searchParams.keys()],['receipt']);assert.equal(u.searchParams.get('receipt'),payload.id);return {ok:true,json:async()=>({ok:true,stored:true,receipt:payload.id,day:'2026-11-02'})};},async()=>{const r=await api.sendCourse(payload);assert.equal(r.stored,true);});assert.equal(calls.length,2);
});
test('network interruption after POST still recovers an authoritative stored receipt',async()=>{
 await withFetch(async(url,opt)=>{if(opt.method==='POST')throw Error('lost response');return {ok:true,json:async()=>({ok:true,stored:true,receipt:payload.id,day:'2026-11-02'})};},async()=>{assert.equal((await api.sendCourse(payload)).stored,true);});
});
test('opaque result or mismatched receipt never shows success',async()=>{
 await withFetch(async(url,opt)=>opt.method==='POST'?{type:'opaque'}:{ok:true,json:async()=>({ok:true,stored:true,receipt:'another-id'})},()=>assert.rejects(api.sendCourse(payload),/confirmation/));
});

test('an old server is rejected so it cannot silently discard the course number',async()=>{
 await withFetch(async()=>({ok:true,json:async()=>({ok:true,routeApi:1})}),()=>assert.rejects(api.checkRouteService()));
});
