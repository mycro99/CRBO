import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../material-requests.js',import.meta.url),'utf8').replace(/^import[^\n]+/gm,'').replaceAll('import.meta.url',JSON.stringify('https://mycro99.github.io/CRBO/inventaire/material-requests.js')).replace('export function setupMaterialRequests','function setupMaterialRequests');
function harness(){
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,disabled:false,open:false,textContent:'',innerHTML:'',handlers:{},classList:{toggle(){}},addEventListener(event,handler){this.handlers[event]=handler;},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);};
 const document={getElementById:el,addEventListener(){},hidden:false};const window={addEventListener(){}};let allowed=false,calls=[];
 const fetch=async(url,options)=>{calls.push(options);return {ok:allowed,status:allowed?200:403,json:async()=>allowed?(options.method==='GET'?{requests:[{id:'request-1',name:'Collègue',material:'Gants <script>',urgency:'urgent',comment:'',created_at:Date.now()}],publicKey:''}:{ok:true}):{error:'Accès réservé'}};};
 const create=new Function('document','window','navigator','location','fetch','setInterval','clearInterval','REQUEST_API','URGENCY_LABELS','e',source+';return setupMaterialRequests;');
 const setup=create(document,window,{}, {search:''},fetch,()=>1,()=>{},'https://backend.test/api/requests',{urgent:'Urgent'},text=>String(text).replace(/</g,'&lt;'));
 const controller=setup({articles:()=>[],notify(){}});
 return {el,calls,controller,allow(){allowed=true;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('server controls visibility, counter and completion; visitors cannot manage requests',async()=>{
 const h=harness();const staff={uid:'staff',getIdToken:async()=> 'staff-token'};
 h.controller.setUser(staff);await settle();assert.equal(h.el('material-requests').hidden,true);
 h.allow();h.controller.setUser({uid:'owner',getIdToken:async()=> 'owner-token'});await settle();
 assert.equal(h.el('material-requests').hidden,false);assert.equal(h.el('material-requests').textContent,'Demandes (1)');assert.ok(h.el('requests-list').innerHTML.includes('Gants &lt;script>'));
 await h.el('requests-list').handlers.change({target:{dataset:{requestComplete:'request-1'}}});
 assert.equal(h.el('material-requests').textContent,'Demandes (0)');const patch=h.calls.find(c=>c.method==='PATCH');assert.deepEqual(JSON.parse(patch.body),{id:'request-1',completed:true});assert.equal(patch.headers.Authorization,'Bearer owner-token');
 h.controller.setUser(null);assert.equal(h.el('material-requests').hidden,true);assert.equal(h.el('requests-dialog').open,false);
});
