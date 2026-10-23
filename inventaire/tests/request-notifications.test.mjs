import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../../sw.js',import.meta.url),'utf8');
function harness(){
  const handlers={},shown=[],opened=[];
  const self={registration:{scope:'https://mycro99.github.io/CRBO/',showNotification:async(title,options)=>shown.push({title,...options})},
    addEventListener:(type,fn)=>handlers[type]=fn,clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
  vm.runInNewContext(source,{self,URL,Set});return {handlers,shown,opened};
}
test('DEA notification clicks open the dedicated inventory frame; material requests keep their inbox',async()=>{
  for(const kind of ['dea','1']){
    const h=harness();let pending;
    h.handlers.push({data:{json:()=>({title:kind==='dea'?'CRBO — Demande de patchs DEA':'CRBO — Demande de matériel',url:'https://mycro99.github.io/CRBO/inventaire/inventaire.html?demandes='+kind})},waitUntil:p=>pending=p});await pending;
    assert.ok(h.shown[0].data.url.endsWith('?demandes='+kind));
    h.handlers.notificationclick({notification:{data:h.shown[0].data,close(){}},waitUntil:p=>pending=p});await pending;
    assert.ok(h.opened[0].endsWith('?demandes='+kind));
  }
});
test('notifications cannot open arbitrary external links',async()=>{
  const h=harness();let pending;
  h.handlers.notificationclick({notification:{data:{url:'https://example.org/?demandes=dea'},close(){}},waitUntil:p=>pending=p});await pending;
  assert.equal(h.opened[0],'https://mycro99.github.io/CRBO/inventaire/inventaire.html?demandes=1');
});
