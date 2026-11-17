import test from 'node:test';
import assert from 'node:assert/strict';
import {annualStatistics,prepareStatisticsHistory,rankArticles} from '../inventory-statistics.js';
import {planOperation} from '../inventory-core.js';
import {createInventoryStore} from '../inventory-store.js';
const articles=[{id:'a',name:'Compresses',category:'soins',unit:'boîte',active:true},{id:'b',name:'Gants',category:'soins',unit:'boîte',active:true},{id:'c',name:'Article sans activité',category:'divers',unit:'pièce',active:true}];
const event=(id,type,fields={})=>({id,articleId:'a',articleName:'Compresses',date:'2026-03-01T12:00:00Z',type,...fields});
const compute=events=>annualStatistics(prepareStatisticsHistory(events),articles,2026,2026);

test('orders, receipts, outputs, returns and stock corrections remain distinct and historical input is untouched',()=>{
 const events=[event('1','order',{oldOrderQuantity:0,newOrderQuantity:20}),event('2','receive',{receivedQuantity:8,remainingOrderQuantity:12,oldStock:1,newStock:9}),event('3','move',{oldStock:9,newStock:6,action:'-3'}),event('4','move',{oldStock:6,newStock:7}),event('5','count',{oldStock:7,newStock:30}),event('6','count',{oldStock:30,newStock:25}),event('7','create',{oldStock:0,newStock:100}),event('8','expiry'),event('9','lot',{action:'Répartition en lot : A (10)'}),event('10','lot',{oldStock:25,newStock:29})];
 const original=structuredClone(events),row=compute(events).rows.find(r=>r.id==='a');
 assert.deepEqual([row.ordered,row.received,row.entries,row.consumed,row.correctionAdded,row.correctionRemoved],[20,12,1,3,23,5]);
 assert.deepEqual(events,original);
});

test('legacy order balances are differenced, never summed; receptions and cancellation do not create new orders',()=>{
 const events=[event('1','order',{date:'2025-12-01T12:00:00Z',action:'Commande en cours : 10'}),event('2','receive',{date:'2026-01-03T12:00:00Z',receivedQuantity:4,remainingOrderQuantity:6}),event('3','order',{date:'2026-01-04T12:00:00Z',action:'Commande en cours : 11'}),event('4','order',{date:'2026-01-05T12:00:00Z',action:'Commande en cours : 8'}),event('5','order',{date:'2026-01-06T12:00:00Z',action:'Commande clôturée'}),event('6','order',{date:'2026-01-07T12:00:00Z',action:'Commande en cours : 3'})];
 const row=compute(events).rows.find(r=>r.id==='a');
 assert.deepEqual([row.ordered,row.cancelled,row.received,row.uncertainOrders],[8,11,4,0]);
});

test('a first historical order without baseline is explicitly uncertain, then later changes are usable',()=>{
 const result=compute([event('1','order',{date:'2026-01-01T12:00:00Z',action:'Commande en cours : 30'}),event('2','order',{date:'2026-01-02T12:00:00Z',action:'Commande en cours : 35'})]);
 assert.equal(result.uncertainOrders,1);assert.equal(result.rows.find(r=>r.id==='a').ordered,5);
});

test('same-timestamp legacy changes without an explicit baseline do not invent an order chronology',()=>{
 const result=compute([event('1','order',{action:'Commande en cours : 10'}),event('2','order',{action:'Commande en cours : 15'})]);
 assert.equal(result.uncertainOrders,2);assert.equal(result.rows.find(r=>r.id==='a').ordered,0);
});

test('calendar years use Brussels rather than UTC, support Firestore dates and exclude invalid dates/duplicate IDs',()=>{
 const events=[event('a','move',{date:{seconds:Date.parse('2025-12-31T23:30:00Z')/1000},oldStock:10,newStock:9}),event('b','move',{date:'2026-12-31T23:30:00Z',oldStock:9,newStock:5}),event('missing','move',{date:null,action:'-99'}),event('a','move',{date:'2026-01-01T12:00:00Z',action:'-99'})];
 const prepared=prepareStatisticsHistory(events),result=annualStatistics(prepared,articles,2026,2026);
 assert.equal(result.rows.find(r=>r.id==='a').consumed,1);assert.equal(prepared.undated,1);assert.equal(prepared.duplicates,1);assert.deepEqual(prepared.years,[2027,2026]);
});

test('legacy +/- entries work without guessing consumption from arbitrary stock totals',()=>{
 const result=compute([event('1','',{action:'-3',newStock:7}),event('2','',{action:'+8',newStock:15}),event('3','',{action:'Stock modifié',newStock:2})]);
 const row=result.rows.find(r=>r.id==='a');assert.equal(row.consumed,3);assert.equal(row.entries,8);assert.equal(result.unknown,1);assert.equal(result.legacyMoves,2);
});

test('archived/deleted/renamed articles retain annual movements; zero articles are separate from least-positive ranking',()=>{
 const products=[{...articles[0],name:'Nouveau nom',active:false,deleted:true},...articles.slice(1)];
 const prepared=prepareStatisticsHistory([event('1','move',{oldStock:20,newStock:10}),event('2','move',{articleId:'b',oldStock:10,newStock:8})]);
 const result=annualStatistics(prepared,products,2026,2026);
 assert.equal(result.rows.find(r=>r.id==='a').name,'Nouveau nom');assert.equal(result.rows.find(r=>r.id==='a').deleted,true);
 assert.equal(result.rows.find(r=>r.id==='c').consumed,0);
 assert.deepEqual(rankArticles(result.rows,'consumed','asc').map(r=>r.id),['b','a']);
 assert.deepEqual(rankArticles(result.rows,'consumed','desc').map(r=>r.id),['a','b']);
});

test('a changed historical unit is flagged and excluded from rankings without erasing its recorded quantities',()=>{
 const result=compute([event('1','move',{oldStock:10,newStock:2,articleUnit:'pièce'})]);
 assert.equal(result.rows.find(r=>r.id==='a').unitChanged,true);assert.equal(result.rows.find(r=>r.id==='a').consumed,8);
 assert.equal(rankArticles(result.rows,'consumed').length,0);
 const older=compute([event('1','move',{date:'2025-01-01T12:00:00Z',oldStock:10,newStock:2,articleUnit:'pièce'}),event('2','move',{oldStock:10,newStock:9,articleUnit:'boîte'})]);
 assert.equal(older.rows.find(r=>r.id==='a').unitChanged,false);
});

test('future order edits record exact baselines, while the stock/catalog patch remains unchanged',()=>{
 const raw={stock:5,inventoryOrder:{quantity:10},catalog:{name:'Test',category:'soins',unit:'boîte'},untouched:{keep:true}};
 const order=planOperation('a',raw,{type:'order',quantity:14,expectedQuantity:10});
 assert.deepEqual(order.patch,{inventoryOrder:{quantity:14}});
 assert.deepEqual([order.history.oldOrderQuantity,order.history.newOrderQuantity,order.history.orderedQuantity,order.history.cancelledOrderQuantity],[10,14,4,0]);
 assert.equal(order.history.articleUnit,'boîte');
 const receipt=planOperation('a',raw,{type:'receive',quantity:4,expectedQuantity:10});
 assert.deepEqual([receipt.history.oldOrderQuantity,receipt.history.newOrderQuantity,receipt.history.receivedQuantity],[10,6,4]);
 assert.equal(raw.stock,5);
});

function historyStore(count=1205,{failPage=0,changeUser=false}={}) {
 let calls=0,writes=0;
 const records=Array.from({length:count},(_,i)=>({id:String(i).padStart(6,'0'),data:()=>({articleId:'a',type:'move',action:'-1',date:'2026-01-01T12:00:00Z'})}));
 const auth={currentUser:{uid:'manager'}},queries=[];
 const sdk={collection:(_,name)=>name,query:(path,...conditions)=>({path,conditions}),documentId:()=> '__name__',orderBy:path=>({orderBy:path}),limit:n=>({limit:n}),startAfter:snapshot=>({after:snapshot.id}),
 getDocsFromServer:async query=>{calls++;queries.push(query);if(calls===failPage)throw Object.assign(new Error('denied'),{code:'permission-denied'});if(changeUser)auth.currentUser={uid:'someone-else'};
 const after=query.conditions.find(c=>c.after)?.after;const start=after===undefined?0:Number(after)+1;return {docs:records.slice(start,start+500)};},
 runTransaction:()=>{writes++;throw new Error('Unexpected write');}};
 const store=createInventoryStore(sdk,{},auth);return {store,auth,calls:()=>calls,writes:()=>writes,queries};
}

test('statistics read ALL history across pages, with stable cursors and zero writes',async()=>{
 const fixture=historyStore(),progress=[];const entries=await fixture.store.statisticsHistory({onProgress:n=>progress.push(n)});
 assert.equal(entries.length,1205);assert.equal(new Set(entries.map(e=>e.id)).size,1205);assert.deepEqual(progress,[500,1000,1205]);assert.equal(fixture.calls(),3);assert.equal(fixture.writes(),0);
 assert.equal(fixture.queries[0].path,'history');assert.deepEqual(fixture.queries[1].conditions.find(c=>c.after),{after:'000499'});
});

test('an error, aborted load or account change cannot return plausible partial annual statistics',async()=>{
 const denied=historyStore(1205,{failPage:2});await assert.rejects(denied.store.statisticsHistory(),{code:'permission-denied'});
 const changed=historyStore(1205,{changeUser:true});await assert.rejects(changed.store.statisticsHistory(),/session a changé/);
 const aborted=historyStore(),controller=new AbortController();controller.abort();await assert.rejects(aborted.store.statisticsHistory({signal:controller.signal}),{name:'AbortError'});assert.equal(aborted.calls(),0);
 const signedOut=historyStore();signedOut.auth.currentUser=null;await assert.rejects(signedOut.store.statisticsHistory(),/Connexion staff/);
});


test('an old closure without a prior balance flags unknown cancelled quantity instead of inventing zero',()=>{
 const result=compute([event('1','order',{action:'Commande clôturée'})]);
 const row=result.rows.find(r=>r.id==='a');
 assert.equal(row.ordered,0);assert.equal(row.uncertainOrders,0);assert.equal(row.uncertainCancellations,1);assert.equal(result.uncertainOrderChanges,1);
});

test('monthly charts count filtered order/output/receipt operations, not quantities or stock corrections',()=>{
 const result=compute([
  event('1','order',{oldOrderQuantity:0,newOrderQuantity:50}),
  event('2','receive',{receivedQuantity:10,remainingOrderQuantity:40}),
  event('3','move',{oldStock:10,newStock:6}),
  event('4','count',{oldStock:6,newStock:2}),
  event('5','lot',{oldStock:2,newStock:22}),
  event('6','lot',{action:'Répartition en lot'}),
  event('7','move',{articleId:'b',oldStock:50,newStock:1,date:'2026-04-01T12:00:00Z'})
 ]);
 const row=result.rows.find(r=>r.id==='a');
 assert.deepEqual(row.months[2],{ordered:1,consumed:1,received:2});
 assert.deepEqual(row.months[3],{ordered:0,consumed:0,received:0});
 assert.equal(result.rows.find(r=>r.id==='b').months[3].consumed,1);
});
