import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateVehicle,validateEvent,plateKey,deadline,todayISO,vehicleSituation,planVehicle,planEvent,overlaps} from '../fleet-core.js';
import {createFleetStore} from '../fleet-store.js';
const input={plate:'TEST-001',category:'amu',usage:'Réserve',location:'Centre',model:'Modèle de test',km:50000,inspectionDate:'2027-01-15',fuelDate:'2028-01-01',tyres:'winter',tyresDate:'2026-10-01',tablet:'TABLET-TEST',radio:'RADIO-TEST',notes:'Données fictives'};
const loan={kind:'loan',startDate:'2026-11-10',endDate:'2026-11-12',reason:'Renfort de test',location:'Autre centre',notes:'Retour à confirmer'};
const vehicle={...input,plateKey:'TEST001',id:'TEST001',revision:1,active:true,openEventCount:0};
const event={...loan,id:'event-test',vehicleId:'TEST001',revision:1,open:true,cancelled:false};

test('plate identities normalize spaces and hyphens, dates and optional mileage remain explicit',()=>{
 assert.equal(plateKey(' test 001 '),plateKey('TEST-001'));
 assert.equal(validateVehicle({...input,km:''}).km,null);
 assert.throws(()=>validateVehicle({...input,km:-1}),/Kilométrage/);
 assert.throws(()=>validateVehicle({...input,inspectionDate:'2026-02-30'}),/date invalide/);
 assert.throws(()=>validateVehicle({...input,plate:'<script>'}),/Plaque/);
 assert.throws(()=>validateVehicle({...input,category:'constructor'}),/catégorie/);
});

test('vehicle updates preserve unrelated fields and require revision and explicit odometer correction',()=>{
 const raw={...vehicle,extraUnknown:{keep:true}};
 const plan=planVehicle(raw,{...input,km:50020},{id:'TEST001',expectedRevision:1});
 assert.equal(plan.patch.revision,2);assert.equal(plan.patch.km,50020);assert.equal(Object.hasOwn(plan.patch,'extraUnknown'),false);
 assert.throws(()=>planVehicle(raw,{...input,km:49999},{id:'TEST001',expectedRevision:1}),/correction/);
 assert.equal(planVehicle(raw,{...input,km:49999},{id:'TEST001',expectedRevision:1,allowKmCorrection:true}).patch.km,49999);
 assert.throws(()=>planVehicle(raw,input,{id:'TEST001',expectedRevision:0}),/changé/);
 assert.throws(()=>planVehicle(raw,{...input,plate:'OTHER-001'},{id:'TEST001',expectedRevision:1}),/nouvelle fiche/);
 assert.deepEqual(raw.extraUnknown,{keep:true});
});

test('planned end never implicitly makes an unreturned vehicle available',()=>{
 assert.equal(vehicleSituation(vehicle,[event],'2026-11-09').key,'available');
 assert.equal(vehicleSituation(vehicle,[event],'2026-11-09').upcoming.length,1);
 assert.equal(vehicleSituation(vehicle,[event],'2026-11-12').key,'loan');
 const late=vehicleSituation(vehicle,[event],'2026-11-13');assert.equal(late.late,true);assert.equal(late.location,'Autre centre');
 const returned=vehicleSituation(vehicle,[{...event,open:false,returnDate:'2026-11-13'}],'2026-11-13');assert.equal(returned.key,'available');assert.equal(returned.location,'Centre');
});

test('garage takes priority in overlapping periods and all simultaneous events remain visible',()=>{
 const result=vehicleSituation(vehicle,[event,{...event,id:'garage',kind:'garage',location:'Atelier'}],'2026-11-11');
 assert.equal(result.key,'garage');assert.equal(result.current.length,2);assert.equal(result.location,'Atelier');
 assert.equal(overlaps(loan,{startDate:'2026-11-12',endDate:'2026-11-20'}),true);
 assert.equal(overlaps(loan,{startDate:'2026-11-13',endDate:''}),false);
});

test('vehicle dates use Brussels and expiry badges distinguish upcoming and exceeded dates',()=>{
 assert.equal(todayISO(new Date('2026-12-31T23:30:00Z')),'2027-01-01');
 assert.equal(deadline('2026-11-16','2026-11-17').key,'expired');
 assert.equal(deadline('2026-12-17','2026-11-17').key,'soon');
 assert.equal(deadline('2026-12-18','2026-11-17').key,'ok');
 assert.equal(deadline('','2026-11-17').key,'unknown');
});

test('loan validation and return retain the planned dates and reject impossible or stale confirmations',()=>{
 assert.throws(()=>validateEvent({...loan,endDate:'2026-11-09'}),/précéder/);
 assert.throws(()=>validateEvent({...loan,reason:''}),/motif/);
 const closed=planEvent(event,{type:'return',returnDate:'2026-11-13',returnNotes:'Reçu',expectedEventRevision:1},'2026-11-17');
 assert.equal(closed.open,false);assert.equal(closed.revision,2);assert.equal(Object.hasOwn(closed,'endDate'),false);
 for(const date of ['2026-11-09','2026-11-18'])assert.throws(()=>planEvent(event,{type:'return',returnDate:date,expectedEventRevision:1},'2026-11-17'),/date réelle/);
 assert.throws(()=>planEvent(event,{type:'return',returnDate:'2026-11-13',expectedEventRevision:0},'2026-11-17'),/changé/);
 assert.throws(()=>planEvent({...event,open:false},{type:'edit',expectedEventRevision:1,event:loan}),/déjà terminé/);
});

function mockStore(){
 const database=new Map([['inventory/untouched',{stock:123,keep:'inventory'}]]),auth={currentUser:{uid:'staff-test',email:'staff@example.invalid'}};
 let subscriptions=[],writes=0,denied=false,cached=false,chain=Promise.resolve();
 const clone=value=>structuredClone(value);
 const snapshot=target=>({metadata:{fromCache:cached},docs:[...database].filter(([path,data])=>path.startsWith(target.path+'/')&&(!target.where||data[target.where.field]===target.where.value)).map(([path,data])=>({id:path.split('/').at(-1),data:()=>clone(data)}))});
 const sdk={collection:(_,path)=>({path}),doc:(_,collection,id)=>collection+'/'+id,query:(target,condition,max)=>({...target,where:condition,max}),limit:n=>n,getDocsFromServer:async target=>({docs:snapshot(target).docs.slice(0,target.max)}),where:(field,op,value)=>({field,value}),serverTimestamp:()=>({seconds:1794916800}),
  onSnapshot:(target,options,next,error)=>{const subscription={target,next,error};subscriptions.push(subscription);next(snapshot(target));return ()=>{subscriptions=subscriptions.filter(s=>s!==subscription);};},
  runTransaction:async(_,callback)=>{
   const run=chain.then(async()=>{
    const pending=[];
    const result=await callback({get:async path=>({exists:()=>database.has(path),data:()=>clone(database.get(path))}),set:(path,data,options)=>pending.push({path,data,options}),delete:path=>pending.push({path,remove:true})});
    if(denied)throw Object.assign(new Error('denied'),{code:'permission-denied'});
    for(const p of pending){writes++;if(p.remove){database.delete(p.path);continue;}database.set(p.path,p.options?.merge?{...database.get(p.path),...clone(p.data)}:clone(p.data));}
    for(const s of [...subscriptions])s.next(snapshot(s.target));return result;
   });chain=run.catch(()=>{});return run;
  }};
 const store=createFleetStore(sdk,{},auth);store.start(()=>{});
 return {store,database,auth,writes:()=>writes,deny:()=>{denied=true;},offline:()=>{cached=true;for(const s of subscriptions)s.next(snapshot(s.target));}};
}
const create=mock=>mock.store.saveVehicle(input,{id:'TEST001',create:true,expectedRevision:0},'create-test');

test('opening the vehicle page is read-only; duplicate plates are blocked without inventory writes',async()=>{
 const m=mockStore();assert.equal(m.writes(),0);assert.equal(m.store.state().ready,true);
 await create(m);assert.equal(m.database.get('vehicles/TEST001').revision,1);assert.equal(m.writes(),2);
 assert.equal((await create(m)).alreadyApplied,true);assert.equal(m.writes(),2);
 await assert.rejects(m.store.saveVehicle({...input,plate:'test 001'},{id:'TEST001',create:true},'another-operation'),/déjà une fiche/);
 assert.deepEqual(m.database.get('inventory/untouched'),{stock:123,keep:'inventory'});
});

test('a loan, return and retries are atomic and preserve permanent history',async()=>{
 const m=mockStore();await create(m);
 await m.store.saveEvent('TEST001',{type:'create',event:loan,expectedVehicleRevision:1},'loan-test');
 assert.equal(m.database.get('vehicles/TEST001').openEventCount,1);assert.equal(m.store.state().events.length,1);
 const returns={type:'return',id:'event-loan-test',expectedVehicleRevision:2,expectedEventRevision:1,returnDate:'2026-11-13',returnNotes:'Retour confirmé'};
 await m.store.saveEvent('TEST001',returns,'return-test');const count=m.writes();
 assert.equal((await m.store.saveEvent('TEST001',returns,'return-test')).alreadyApplied,true);assert.equal(m.writes(),count);
 const stored=m.database.get('vehicleEvents/event-loan-test');assert.equal(stored.open,false);assert.equal(stored.endDate,loan.endDate);assert.equal(stored.reason,loan.reason);assert.equal(stored.returnDate,'2026-11-13');
 assert.equal(m.database.get('vehicles/TEST001').openEventCount,0);assert.equal(m.store.state().events.length,0);
 assert.equal(m.database.has('vehicleEvents/log-loan-test'),true);assert.equal(m.database.has('vehicleEvents/log-return-test'),true);
});

test('denied writes never apply a partial vehicle, follow-up or audit change',async()=>{
 const m=mockStore();await create(m);const before=cloneMap(m.database);m.deny();
 await assert.rejects(m.store.saveEvent('TEST001',{type:'create',event:loan,expectedVehicleRevision:1},'denied-loan'),{code:'permission-denied'});
 assert.deepEqual([...m.database],[...before]);
});
const cloneMap=map=>new Map(structuredClone([...map]));

test('simultaneous vehicle edits reject stale revisions instead of overwriting a colleague',async()=>{
 const m=mockStore();await create(m);const before=m.database.get('vehicles/TEST001');before.unknown={preserve:true};
 const results=await Promise.allSettled([m.store.saveVehicle({...input,km:50010},{id:'TEST001',expectedRevision:1},'edit-one'),m.store.saveVehicle({...input,km:50020},{id:'TEST001',expectedRevision:1},'edit-two')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(m.database.get('vehicles/TEST001').km,50010);assert.deepEqual(m.database.get('vehicles/TEST001').unknown,{preserve:true});
});

test('archiving requires closed follow-ups, preserves records and supports reactivation',async()=>{
 const m=mockStore();await create(m);await m.store.saveEvent('TEST001',{type:'create',event:loan,expectedVehicleRevision:1},'loan-test');
 await assert.rejects(m.store.setActive('TEST001',false,2,'archive-too-soon'),/Clôturez/);
 await m.store.saveEvent('TEST001',{type:'cancel',id:'event-loan-test',expectedVehicleRevision:2,expectedEventRevision:1,cancelReason:'Renfort annulé'},'cancel-test');
 await m.store.setActive('TEST001',false,3,'archive-test');assert.equal(m.database.get('vehicles/TEST001').active,false);assert.equal(m.database.get('vehicleEvents/event-loan-test').cancelled,true);
 await m.store.setActive('TEST001',true,4,'restore-test');assert.equal(m.database.get('vehicles/TEST001').active,true);assert.equal(m.database.has('vehicleEvents/event-loan-test'),true);
});

test('logged-out or offline sessions cannot modify fleet data',async()=>{
 const m=mockStore();m.offline();await assert.rejects(create(m),/Connexion et synchronisation/);assert.equal(m.writes(),0);
 const signedOut=mockStore();signedOut.auth.currentUser=null;await assert.rejects(create(signedOut),/Connexion et synchronisation/);
});

test('staff vehicle entry has no PIN while the inventory keeps its existing PIN gate',()=>{
 const staff=fs.readFileSync(new URL('../../staff.html',import.meta.url),'utf8');
 assert.match(staff,/<a[^>]*href="vehicules\/vehicules.html"[^>]*data-safe-nav/);
 assert.doesNotMatch(staff,/<a[^>]*href="vehicules\/vehicules.html"[^>]*data-pin-link/);
 assert.match(staff,/<a[^>]*href="inventaire\/inventaire.html"[^>]*data-pin-link/);
 const html=fs.readFileSync(new URL('../vehicules.html',import.meta.url),'utf8');assert.match(html,/dialog-dismiss.js/);assert.doesNotMatch(html,/firebaseSignIn|pinInput/);
});

test('malformed revisions or follow-up counters never get silently reset',async()=>{
 assert.throws(()=>planVehicle({...vehicle,revision:undefined},input,{id:'TEST001'}),/version/);
 assert.throws(()=>planEvent({...event,revision:undefined},{type:'return',returnDate:'2026-11-13'},'2026-11-17'),/version/);
 const m=mockStore();await create(m);m.database.get('vehicles/TEST001').openEventCount='invalid';const before=cloneMap(m.database);
 await assert.rejects(m.store.saveEvent('TEST001',{type:'create',event:loan,expectedVehicleRevision:1},'invalid-counter'),/Compteur/);
 assert.deepEqual([...m.database],[...before]);
});

test('vehicle page local script/style/navigation references resolve without any extra inventory PIN link',()=>{
 const html=fs.readFileSync(new URL('../vehicules.html',import.meta.url),'utf8');
 for(const [,value] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  if(/^https?:/.test(value))continue;
  assert.equal(fs.existsSync(new URL('../'+value.split('?')[0],import.meta.url)),true,value);
 }
 assert.doesNotMatch(html,/href="\.\.\/inventaire\/inventaire\.html"/);
});

test('principal vehicle assignment is valid and stays available, including alongside other statuses',()=>{
 const principal={...event,id:'principal',kind:'primary',reason:'Affectation principale',location:'Centre principal'};
 assert.equal(validateEvent(principal).kind,'primary');
 const available=vehicleSituation(vehicle,[principal],'2026-11-11');
 assert.equal(available.key,'primary');assert.equal(available.label,'Véhicule principal');assert.equal(available.current.length,0);assert.equal(available.assignment.id,'principal');
 assert.equal(available.location,'Centre principal');
 const borrowed=vehicleSituation(vehicle,[principal,event],'2026-11-11');
 assert.equal(borrowed.key,'loan');assert.equal(borrowed.current.length,1);assert.equal(borrowed.assignment.id,'principal');assert.equal(borrowed.location,'Autre centre');
 const future=vehicleSituation(vehicle,[principal],'2026-11-09');assert.equal(future.assignment,undefined);assert.equal(future.upcoming.length,1);
 const closed=vehicleSituation(vehicle,[{...principal,open:false}],'2026-11-11');assert.equal(closed.key,'available');
});

test('principal assignment is persisted and closed through the same atomic event history',async()=>{
 const m=mockStore();await create(m);
 await m.store.saveEvent('TEST001',{type:'create',event:{...loan,kind:'primary'},expectedVehicleRevision:1},'principal-test');
 assert.equal(m.database.get('vehicleEvents/event-principal-test').kind,'primary');
 assert.equal(vehicleSituation({...m.database.get('vehicles/TEST001'),id:'TEST001'},m.store.state().events,'2026-11-11').current.length,0);
 await m.store.saveEvent('TEST001',{type:'return',id:'event-principal-test',expectedVehicleRevision:2,expectedEventRevision:1,returnDate:'2026-11-13'},'end-principal');
 assert.equal(m.database.get('vehicleEvents/event-principal-test').open,false);assert.equal(m.database.has('vehicleEvents/log-end-principal'),true);
});


test('permanent deletion removes only the archived vehicle and all of its history',async()=>{
 const m=mockStore();await create(m);
 const createdAt=m.database.get('vehicles/TEST001').createdAt;
 await assert.rejects(m.store.deleteArchivedVehicle('TEST001',1,createdAt),/archivé/);
 await m.store.setActive('TEST001',false,1,'archive-test');
 m.database.set('vehicleEvents/other-history',{vehicleId:'OTHER001',open:false});
 await assert.rejects(m.store.deleteArchivedVehicle('TEST001',1,createdAt),/changé/);
 await assert.rejects(m.store.deleteArchivedVehicle('TEST001',2,{seconds:0}),/changé/);
 await m.store.deleteArchivedVehicle('TEST001',2,createdAt);
 assert.deepEqual([...m.database.keys()].sort(),['inventory/untouched','vehicleEvents/other-history']);
});

test('large histories and permission errors never cause partial deletion',async()=>{
 const m=mockStore();await create(m);await m.store.setActive('TEST001',false,1,'archive-test');
 const createdAt=m.database.get('vehicles/TEST001').createdAt,writes=m.writes();
 for(let i=0;i<498;i++)m.database.set('vehicleEvents/import-'+i,{vehicleId:'TEST001',open:false});
 await assert.rejects(m.store.deleteArchivedVehicle('TEST001',2,createdAt),/volumineux/);
 assert.equal(m.writes(),writes);
 m.database.delete('vehicleEvents/import-0');m.deny();
 await assert.rejects(m.store.deleteArchivedVehicle('TEST001',2,createdAt),{code:'permission-denied'});
 assert.equal(m.writes(),writes);
 assert.ok(m.database.has('vehicles/TEST001'));
 assert.ok(m.database.has('vehicleEvents/log-archive-test'));
});
