import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatMissionNumber,treatmentYear} from '../request-format.js';
const source=readFileSync(new URL('../material-requests.js',import.meta.url),'utf8').replace(/^import[^\n]+/gm,'').replaceAll('import.meta.url',JSON.stringify('https://mycro99.github.io/CRBO/inventaire/material-requests.js')).replace('export function setupMaterialRequests','function setupMaterialRequests');
function harness(rows=[{id:'request-1',name:'Collègue',material:'Gants <script>',urgency:'urgent',comment:'',created_at:Date.now()}],initialHistory=[],search=''){
 let pending=rows.slice(),history=initialHistory.slice();
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,disabled:false,open:false,textContent:'',innerHTML:'',handlers:{},classList:{toggle(){}},setAttribute(){},addEventListener(event,handler){this.handlers[event]=handler;},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);};
 const document={getElementById:el,addEventListener(){},hidden:false};const window={addEventListener(){}};let allowed=false,calls=[],patchError=false;
 const fetch=async(url,options)=>{
  calls.push({...options,url});
  if(!allowed)return {ok:false,status:403,json:async()=>({error:'Accès réservé'})};
  if(options.method==='GET'){
   const year=Number(new URL(url).searchParams.get('deaYear'));
   const counts=new Map();for(const row of history){const y=treatmentYear(row.completed_at);counts.set(y,(counts.get(y)||0)+1);}
   return {ok:true,status:200,json:async()=>({requests:pending,deaHistory:history.filter(row=>treatmentYear(row.completed_at)===year),deaHistoryYear:year,deaHistoryYears:[...counts].map(([year,count])=>({year,count})),publicKey:''})};
  }
  if(options.method==='PATCH'){
   if(patchError){patchError=false;return {ok:false,status:503,json:async()=>({error:'Enregistrement impossible'})};}
   const data=JSON.parse(options.body);const row=pending.find(r=>r.id===data.id),completedAt=Date.now();
   if(data.completed){pending=pending.filter(r=>r.id!==data.id);if(row?.request_type==='dea')history.push({...row,completed_at:completedAt});}
   return {ok:true,status:200,json:async()=>({ok:true,completedAt,newlyCompleted:true})};
  }
  return {ok:true,status:200,json:async()=>({ok:true})};
 };
 const create=new Function('document','window','navigator','location','fetch','setInterval','clearInterval','REQUEST_API','URGENCY_LABELS','e','formatMissionNumber','treatmentYear',source+';return setupMaterialRequests;');
 const setup=create(document,window,{}, {search},fetch,()=>1,()=>{},'https://backend.test/api/requests',{urgent:'Urgent'},text=>String(text).replace(/</g,'&lt;'),formatMissionNumber,treatmentYear);
 const controller=setup({articles:()=>[],notify(){}});
 return {el,calls,controller,failNextPatch(){patchError=true;},allow(){allowed=true;}};
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

test('DEA requests have their own private counter, fields and completion without mixing material requests',async()=>{
 const rows=[{id:'material-1',name:'Collègue',material:'Gants',urgency:'urgent',comment:'',created_at:Date.now()},
 {id:'dea-1',request_type:'dea',name:'Kevin <script> et Marie',mission_number:'112/ABC <b>',intervention_date:'2026-10-23',urgency:'normal',created_at:Date.now()}];
 const h=harness(rows);h.allow();h.controller.setUser({uid:'owner',getIdToken:async()=> 'owner-token'});await settle();
 assert.equal(h.el('material-requests').textContent,'Demandes (1)');
 assert.equal(h.el('dea-requests-button').hidden,false);assert.equal(h.el('dea-requests-button').textContent,'DEA (1)');
 h.el('dea-requests-button').handlers.click();await settle();assert.equal(h.el('dea-requests-dialog').open,true);
 assert.ok(h.el('dea-requests-list').innerHTML.includes('23/10/2026'));
 assert.ok(h.el('dea-requests-list').innerHTML.includes('Kevin &lt;script>'));
 assert.ok(h.el('dea-requests-list').innerHTML.includes('112/ABC &lt;b>'));
 assert.ok(!h.el('requests-list').innerHTML.includes('112/ABC'));
 assert.ok(!h.el('dea-requests-list').innerHTML.includes('data-request-article'));
 await h.el('dea-requests-list').handlers.change({target:{dataset:{requestComplete:'dea-1'}}});
 await settle();assert.equal(h.el('dea-requests-button').textContent,'DEA (0)');
 h.el('dea-history-tab').handlers.click();assert.equal(h.el('dea-history-panel').hidden,false);assert.ok(h.el('dea-history-list').innerHTML.includes('112/ABC &lt;b>'));assert.equal(h.el('dea-history-tab').textContent,'Traitées (1)');assert.equal(h.el('material-requests').textContent,'Demandes (1)');
 const patch=h.calls.find(c=>c.method==='PATCH');assert.deepEqual(JSON.parse(patch.body),{id:'dea-1',completed:true});
 h.controller.setUser(null);assert.equal(h.el('dea-requests-button').hidden,true);assert.equal(h.el('dea-requests-dialog').open,false);assert.ok(!h.el('dea-requests-list').innerHTML.includes('Kevin'));
});

test('mission display groups 11 digits without changing free text or losing zeroes',()=>{
 for(const raw of ['60262950259','60/26/295/0259','60 26 295 0259'])assert.equal(formatMissionNumber(raw),'60/26/295/0259');
 assert.equal(formatMissionNumber('00260010001'),'00/26/001/0001');
 for(const raw of ['Libre - pas de course','6026295025','602629502590','112/ABC'])assert.equal(formatMissionNumber(raw),raw);
});
test('treated history survives reopening and changing the selected year',async()=>{
 const year=treatmentYear(Date.now());
 const old={id:'old-dea',request_type:'dea',name:'Ancien équipage',mission_number:'60262950259',intervention_date:'2025-12-31',completed_at:Date.UTC(year-1,5,1)};
 const h=harness([], [old]);h.allow();h.controller.setUser({uid:'owner',getIdToken:async()=> 'owner-token'});await settle();
 assert.equal(h.el('dea-history-tab').textContent,'Traitées (1)');
 h.el('dea-history-year').value=String(year-1);h.el('dea-history-year').handlers.change();await settle();
 assert.ok(h.el('dea-history-list').innerHTML.includes('31/12/2025 / 60/26/295/0259 / Ancien équipage'));
 assert.ok(h.el('dea-history-count').textContent.includes('1 demande traitée'));
 h.el('dea-requests-button').handlers.click();await settle();h.el('dea-requests-close').handlers.click();h.el('dea-requests-button').handlers.click();await settle();
 assert.ok(h.el('dea-history-list').innerHTML.includes('Ancien équipage'));
 h.controller.setUser(null);assert.ok(!h.el('dea-history-list').innerHTML.includes('Ancien équipage'));
});

test('opening a DEA notification opens the pending tab in its modal',async()=>{
 const h=harness([],[],'?demandes=dea');h.allow();h.controller.setUser({uid:'owner',getIdToken:async()=> 'owner-token'});await settle();
 assert.equal(h.el('dea-requests-dialog').open,true);assert.equal(h.el('requests-dialog').open,false);assert.equal(h.el('dea-pending-panel').hidden,false);
});

test('failed treatment remains pending and keeps its error visible',async()=>{
 const row={id:'dea-failed',request_type:'dea',name:'Équipage',mission_number:'60262950259',intervention_date:'2026-10-23',created_at:Date.now()};
 const h=harness([row]);h.allow();h.controller.setUser({uid:'owner',getIdToken:async()=> 'owner-token'});await settle();h.failNextPatch();
 await h.el('dea-requests-list').handlers.change({target:{dataset:{requestComplete:row.id}}});await settle();
 assert.equal(h.el('dea-requests-button').textContent,'DEA (1)');assert.equal(h.el('dea-history-tab').textContent,'Traitées (0)');assert.equal(h.el('dea-requests-status').textContent,'Enregistrement impossible');
});
