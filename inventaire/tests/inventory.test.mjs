import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractLegacy} from './extract-legacy.mjs';
import {SEED_ARTICLES,SEED_CATEGORIES} from '../catalog-seed.js';
import {articleFrom,mergeInventory,planOperation,barcodeMatches,normalizeBarcode,expiryState,expiries,quantity,validDate,orderNeed,validateCatalog,safeImage,unallocatedStock} from '../inventory-core.js';
import {createInventoryStore} from '../inventory-store.js';
import {expiryAlert,MAX_PHOTO_LENGTH,isArticlePhoto} from '../inventory-core.js';
import {prepareArticlePhoto} from '../article-photo.js';
import {csvText,escapeHTML} from '../inventory-ui.js';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sourceRef='bc4669a1c457606374be29995901c4d5244ab764';
const id='consommables-1';
const original={stock:17,expirationDate:'2027-05-19',noExpiration:false,lastModifiedBy:'original-user',lastModifiedAt:{seconds:123,nanoseconds:0},extraUnknown:{keep:'untouched'}};
const catalog={name:'Accu-check modifié',category:'consommables',minStock:2,targetStock:5,unit:'boîte',barcodes:['4015630006038','DIFFERENT-CODE'],location:'Armoire 2',notes:'Test',image:''};
function merge(base,patch){const out=structuredClone(base||{});for(const [key,value] of Object.entries(patch)){out[key]=value && typeof value==='object'&&!Array.isArray(value)&&!value.__timestamp?merge(out[key],value):structuredClone(value);}return out;}

test('all 268 original identities, names, categories, barcodes, images and minimums survive extraction exactly',()=>{
  const html=execFileSync('git',['show',`${sourceRef}:inventaire/inventaire.html`],{cwd:repo,encoding:'utf8'});
  assert.deepEqual(extractLegacy(html),{articles:SEED_ARTICLES,categories:SEED_CATEGORIES});
  assert.equal(SEED_ARTICLES.length,268);
  assert(SEED_ARTICLES.every(a=>!Object.hasOwn(a,'stock')&&!Object.hasOwn(a,'expirationDate')));
});
test('rendering overlays live data without mutation or reinitialization',()=>{
  const copy=structuredClone(original),data=new Map([[id,copy],['not-in-html',{stock:29,expirationDate:'2030-01-01'}]]);
  const rows=mergeInventory(data);assert.equal(rows.length,269);
  const a=rows.find(a=>a.id===id);assert.equal(a.stock,17);assert.equal(a.expirationDate,'2027-05-19');assert.deepEqual(copy,original);
  assert.equal(rows.find(a=>a.id==='not-in-html').stock,29);
});
test('catalog edit never includes existing stock, expiry, lots or unknown fields in its patch',()=>{
  const result=planOperation(id,original,{type:'catalog',catalog,expectedRevision:0});
  assert.deepEqual(Object.keys(result.patch).sort(),['catalog','catalogRevision']);
  const resultData=merge(original,result.patch);
  for(const key of Object.keys(original))assert.deepEqual(resultData[key],original[key]);
});
test('archiving/reactivating never deletes a product or changes its quantities',()=>{
  const archived=merge(original,planOperation(id,original,{type:'archive',active:false,expectedRevision:0}).patch);
  assert.equal(articleFrom(id,archived).active,false);assert.equal(archived.stock,17);
  const restored=merge(archived,planOperation(id,archived,{type:'archive',active:true,expectedRevision:1}).patch);
  assert.equal(articleFrom(id,restored).active,true);assert.equal(restored.expirationDate,original.expirationDate);
});
test('archived articles reject stock changes',()=>assert.throws(()=>planOperation(id,{...original,catalog:{active:false}},{type:'move',delta:1}),/archivé/));
test('catalog conflicts fail, instead of overwriting another edit',()=>assert.throws(()=>planOperation(id,{...original,catalogRevision:4},{type:'catalog',catalog,expectedRevision:3}),/collègue/));
test('multiple distinct barcodes on one article find one shared stock',()=>{
  const article=articleFrom('new',{stock:7,catalog});
  assert.deepEqual(barcodeMatches([article],'4015630006038').map(a=>a.id),['new']);
  assert.deepEqual(barcodeMatches([article],'DIFFERENT-CODE').map(a=>a.id),['new']);
});
test('only the requested BP duplicate is removed; the other collision remains unchanged',()=>{
  const rows=mergeInventory(new Map());
  assert.deepEqual(barcodeMatches(rows,'4031815901417').map(a=>a.id),['consommables-8','consommables-8b']);
  assert.deepEqual(barcodeMatches(rows,'4002427000362'),[]);
  assert.deepEqual(barcodeMatches(rows,'4002427000386').map(a=>a.id),['consommables-94']);
});
test('BP correction preserves raw stock and dates and allows a later explicit rescan',()=>{
  for(const bpId of ['consommables-93','consommables-95']){
    const raw={...original,catalog:{...catalog,barcodes:['4002427000362','KEEP-ME']}};
    const copy=structuredClone(raw),view=articleFrom(bpId,raw);
    assert.deepEqual(view.barcodes,['KEEP-ME']);assert.deepEqual(raw,copy);
    const saved=planOperation(bpId,raw,{type:'catalog',catalog:{...view,barcodes:['4002427000362','KEEP-ME']},expectedRevision:0});
    assert.equal(saved.patch.catalog.barcodeReviewVersion,1);
    assert.deepEqual(articleFrom(bpId,merge(raw,saved.patch)).barcodes,['4002427000362','KEEP-ME']);
    assert(!Object.hasOwn(saved.patch,'stock'));assert(!Object.hasOwn(saved.patch,'expirationDate'));
  }
});
test('scanner normalization preserves meaningful letters and does not invent lot digits',()=>{
  assert.equal(normalizeBarcode(' aB-0123 '),'AB0123');
  assert.equal(barcodeMatches([articleFrom('new',{catalog})],'UNKNOWN').length,0);
});
test('scanner sees newly created Firestore-only articles, without changing a JS mapping',()=>{
  const created=planOperation('article-123',null,{type:'create',catalog,stock:7,expirationDate:'2029-02-01',noExpiration:false}).patch;
  const rows=mergeInventory(new Map([['article-123',created]]));
  assert.equal(barcodeMatches(rows,'DIFFERENT-CODE')[0].id,'article-123');
});
test('new creation never overwrites an existing document or historical identity',()=>{
  assert.throws(()=>planOperation(id,null,{type:'create',catalog,stock:0}),/existe déjà/);
  assert.throws(()=>planOperation('other',original,{type:'create',catalog,stock:0}),/existe déjà/);
});
test('stock moves use the current stored value, preserve unknown fields and prevent negative stock',()=>{
  const plan=planOperation(id,original,{type:'move',delta:3});assert.equal(plan.patch.stock,20);assert.equal(plan.history.oldStock,17);
  assert.equal(merge(original,plan.patch).expirationDate,original.expirationDate);
  assert.throws(()=>planOperation(id,original,{type:'move',delta:-18}),/dépasse/);
});
test('bad existing quantities are not silently reset',()=>{
  assert.equal(articleFrom(id,{stock:'not-a-number'}).stockValid,false);
  assert.throws(()=>planOperation(id,{stock:'not-a-number'},{type:'move',delta:1}),/non reconnu/);
});
test('malformed or overallocated lots remain untouched and disable stock writes',()=>{
  for(const inventoryLots of [[null],{quantity:3},[{id:'x',label:'X',quantity:20}]]){
    const raw={...original,inventoryLots};
    assert.equal(articleFrom(id,raw).stockValid,false);
    assert.throws(()=>planOperation(id,raw,{type:'move',delta:1}),/non reconnu/);
    assert.deepEqual(raw.inventoryLots,inventoryLots);
  }
});
test('counting detects both changed stock and a change-away-and-back revision',()=>{
  assert.throws(()=>planOperation(id,{...original,stock:18},{type:'count',stock:20,expectedStock:17,expectedRevision:0}),/pendant le comptage/);
  assert.throws(()=>planOperation(id,{...original,inventoryStockRevision:2},{type:'count',stock:20,expectedStock:17,expectedRevision:0}),/pendant le comptage/);
  assert.equal(planOperation(id,original,{type:'count',stock:17,expectedStock:17,expectedRevision:0}),null);
});
test('expiry changes do not clear the historic date just because no-expiry is selected',()=>{
  const plan=planOperation(id,original,{type:'expiry',expirationDate:original.expirationDate,noExpiration:true,expectedDate:original.expirationDate,expectedNoExpiration:false});
  assert.equal(plan.patch.expirationDate,original.expirationDate);assert.equal(plan.patch.noExpiration,true);assert(!Object.hasOwn(plan.patch,'stock'));
});
test('expiry conflict does not overwrite a colleague date',()=>assert.throws(()=>planOperation(id,original,{type:'expiry',expectedDate:'2000-01-01',expectedNoExpiration:false,expirationDate:'2030-01-01'}),/changé/));
test('lot allocation preserves total stock and original expiry',()=>{
  const plan=planOperation(id,original,{type:'lot',lotId:'lot1',label:'A',quantity:5,expirationDate:'2029-01-01',receive:false});
  assert(!Object.hasOwn(plan.patch,'stock'));assert(!Object.hasOwn(plan.patch,'expirationDate'));
  const updated=merge(original,plan.patch);assert.equal(unallocatedStock(articleFrom(id,updated)),12);assert.equal(updated.stock,17);
});
test('lot receipt adds the quantity once; allocation cannot exceed unassigned stock',()=>{
  const op={type:'lot',lotId:'lot1',label:'A',quantity:20,expirationDate:'2029-01-01',receive:true};
  assert.equal(planOperation(id,original,op).patch.stock,37);
  assert.throws(()=>planOperation(id,original,{...op,receive:false}),/dépasse/);
});
test('lot withdrawal changes both selected lot and stock, without touching other lots',()=>{
  const raw={...original,inventoryLots:[{id:'A',label:'A',quantity:10,expirationDate:'2027-02-01'},{id:'B',label:'B',quantity:3,expirationDate:'2028-01-01'}]};
  const plan=planOperation(id,raw,{type:'move',delta:-4,lotId:'A'});
  assert.equal(plan.patch.stock,13);assert.equal(plan.patch.inventoryLots[0].quantity,6);assert.deepEqual(plan.patch.inventoryLots[1],raw.inventoryLots[1]);
  assert.throws(()=>planOperation(id,raw,{type:'move',delta:-5}),/réparti en lots/);
  assert.throws(()=>planOperation(id,raw,{type:'move',delta:-11,lotId:'A'}),/indisponible/);
});
test('order tracking does not modify stock; partial receiving updates stock and remaining order',()=>{
  const planned=planOperation(id,original,{type:'order',quantity:10,expectedQuantity:0});assert(!Object.hasOwn(planned.patch,'stock'));
  const plan=planOperation(id,merge(original,planned.patch),{type:'receive',quantity:4});
  assert.equal(plan.patch.stock,21);assert.equal(plan.patch.inventoryOrder.quantity,6);
  assert.equal(orderNeed(articleFrom('new',{stock:3,catalog:{targetStock:15,minStock:5},inventoryOrder:{quantity:4}})),8);
});
test('date handling includes leap years, expiry day and 30 day boundary',()=>{
  assert(validDate('2028-02-29'));assert(!validDate('2027-02-29'));
  assert.equal(expiryState('2026-09-07',false,'2026-09-08').key,'expired');
  assert.equal(expiryState('2026-09-08',false,'2026-09-08').key,'soon');
  assert.equal(expiryState('2026-10-08',false,'2026-09-08').key,'ok');
  assert.equal(expiryState('2026-01-01',true,'2026-09-08').key,'none');
});
test('input validation rejects fractional, negative and unsafe quantities and images',()=>{
  for(const value of [-1,1.1,'',null,NaN,Infinity,true])assert.throws(()=>quantity(value));
  assert.equal(safeImage('javascript:alert(1)'),'');assert.equal(safeImage('images/../../secret.jpg'),'');
  assert.throws(()=>validateCatalog({...catalog,targetStock:1}),/souhaité/);
});
test('expiry dashboard prioritizes expired lots, then soon dates, excluding archived and exempt articles',()=>{
  const future='2999-01-01',past='2000-01-01';
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const soon=articleFrom(id,{stock:10,expirationDate:today});
  const expired=articleFrom('consommables-2',{stock:10,expirationDate:future,inventoryLots:[{id:'A',label:'A',quantity:2,expirationDate:past}]});
  assert.equal(expiryAlert([soon]),'soon');assert.equal(expiryAlert([soon,expired]),'expired');
  assert.equal(expiryAlert([{...expired,active:false},articleFrom(id,{expirationDate:past,noExpiration:true})]),'');
  assert.equal(expiryAlert([articleFrom(id,{stock:2,expirationDate:future,inventoryLots:[{id:'A',label:'A',quantity:0,expirationDate:past}]})]),'');
});
test('bounded JPEG photos survive catalog edits; unsupported data URLs and oversized payloads are rejected',()=>{
  const image='data:image/jpeg;base64,/9j/AAAA/9k=';
  assert(isArticlePhoto(image));assert.equal(safeImage(image),image);
  const raw={...original,catalog:{...catalog,image}};
  const patch=planOperation(id,raw,{type:'catalog',catalog:{...articleFrom(id,raw),name:'Avec photo'},expectedRevision:0}).patch;
  assert.equal(patch.catalog.image,image);assert.equal(merge(raw,patch).expirationDate,original.expirationDate);
  for(const bad of ['data:image/svg+xml;base64,AAAA','data:text/html;base64,AAAA','data:image/jpeg;base64,not jpeg',image+'A'.repeat(MAX_PHOTO_LENGTH)]){
    assert.equal(safeImage(bad),'');assert.throws(()=>validateCatalog({...catalog,image:bad}),/Photo/);
  }
});
test('phone photo preprocessing rejects oversized and non-photo input before decoding',async()=>{
  for(const file of [{size:0},{size:26*1024*1024,type:'image/jpeg'},{size:100,type:'application/pdf'}])await assert.rejects(prepareArticlePhoto(file));
});
test('escaping and CSV prevent executable content and spreadsheet formulas',()=>{
  assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
  assert(csvText([['=1+1','+CMD','@SUM','ok']]).includes('"\'=1+1"'));
});

function mockStore(initial=new Map([[id,original]])){
  const database=new Map([...initial].map(([id,data])=>['inventory/'+id,structuredClone(data)]));
  let writes=0,listener,fail=false,queue=Promise.resolve();
  const snapshot=()=>({docs:[...database].filter(([key])=>key.startsWith('inventory/')).map(([key,data])=>({id:key.slice(10),data:()=>structuredClone(data)})),metadata:{fromCache:false}});
  const sdk={collection:(_,name)=>name,doc:(_,col,id)=>col+'/'+id,query:()=>{},orderBy:()=>{},limit:()=>{},getDocs:async()=>({docs:[]}),serverTimestamp:()=>({__timestamp:true,seconds:99}),
    onSnapshot:(_ref,_options,next)=>{listener=next;next(snapshot());return()=>{};},
    runTransaction:async(_db,callback)=>{
      const run=queue.then(async()=>{
        const pending=[];
        const result=await callback({get:async ref=>({exists:()=>database.has(ref),data:()=>structuredClone(database.get(ref))}),set:(ref,data,options)=>pending.push({ref,data,options})});
        if(fail)throw Object.assign(new Error('denied'),{code:'permission-denied'});
        for(const write of pending){writes++;database.set(write.ref,write.options?.merge?merge(database.get(write.ref),write.data):structuredClone(write.data));}
        listener(snapshot());return result;
      });queue=run.catch(()=>{});return run;
    }
  };
  const store=createInventoryStore(sdk,{}, {currentUser:{uid:'tester',email:'test@example.invalid'}});
  store.start(()=>{});
  return {store,database,writes:()=>writes,deny:()=>fail=true,cache:()=>listener({...snapshot(),metadata:{fromCache:true}})};
}
test('opening and rendering inventory performs ZERO writes',()=>{
  const mock=mockStore();assert.equal(mock.writes(),0);assert.equal(mock.store.state().articles.find(a=>a.id===id).stock,17);assert.deepEqual(mock.database.get('inventory/'+id),original);
});
test('concurrent stock changes are additive, history atomic, same operation id idempotent',async()=>{
  const mock=mockStore();
  await Promise.all([mock.store.perform(id,{type:'move',delta:1},'op1'),mock.store.perform(id,{type:'move',delta:1},'op2')]);
  assert.equal(mock.database.get('inventory/'+id).stock,19);assert.equal([...mock.database.keys()].filter(k=>k.startsWith('history/')).length,2);
  await mock.store.perform(id,{type:'move',delta:1},'op1');assert.equal(mock.database.get('inventory/'+id).stock,19);
  assert.equal(mock.database.get('metadata/lastUpdate').newStock,19);
});
test('direct total entry saves once and preserves lots, expiry and other fields',async()=>{
  const raw={...original,inventoryLots:[{id:'A',label:'A',quantity:10,expirationDate:'2028-01-01'}]};
  const mock=mockStore(new Map([[id,raw]]));
  const operation={type:'count',stock:500,expectedStock:17,expectedRevision:0,reason:'Saisie directe du stock total'};
  await mock.store.perform(id,operation,'direct');await mock.store.perform(id,operation,'direct');
  const saved=mock.database.get('inventory/'+id);
  assert.equal(saved.stock,500);assert.deepEqual(saved.inventoryLots,raw.inventoryLots);assert.equal(saved.expirationDate,raw.expirationDate);assert.deepEqual(saved.extraUnknown,raw.extraUnknown);
  assert.equal(mock.database.get('metadata/lastUpdate').newStock,500);
  assert.equal([...mock.database.keys()].filter(k=>k.startsWith('history/')).length,1);
  await assert.rejects(mock.store.perform(id,{type:'count',stock:5,expectedStock:500,expectedRevision:1},'bad-direct'),/réparti en lots/);
  assert.equal(mock.database.get('inventory/'+id).stock,500);
});
test('denied writes leave stock, history and metadata entirely unchanged',async()=>{
  const mock=mockStore();mock.deny();
  await assert.rejects(mock.store.perform(id,{type:'move',delta:1},'denied'));
  assert.equal(mock.writes(),0);assert.deepEqual(mock.database.get('inventory/'+id),original);assert.equal(mock.database.size,1);
});
test('a conflicting count aborts ALL changes in a multi-article validation',async()=>{
  const mock=mockStore(new Map([[id,original],['consommables-2',{stock:8}]]));
  await assert.rejects(mock.store.performMany([{id,operation:{type:'count',stock:22,expectedStock:17,expectedRevision:0}},{id:'consommables-2',operation:{type:'count',stock:10,expectedStock:7,expectedRevision:0}}],'count'));
  assert.equal(mock.writes(),0);assert.equal(mock.database.get('inventory/'+id).stock,17);
});
test('offline cached state cannot perform stock changes',async()=>{
  const mock=mockStore();mock.cache();await assert.rejects(mock.store.perform(id,{type:'move',delta:1},'offline'),/Connexion requise/);assert.equal(mock.writes(),0);
});
test('all local entrypoint scripts, styles and icons exist; old inline Firebase and scanner mappings are gone',()=>{
  for(const file of ['inventaire.html','scanner.html']){
    const html=readFileSync(resolve(repo,'inventaire',file),'utf8');
    for(const [,ref] of html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g))if(!ref.startsWith('http'))assert(existsSync(resolve(repo,'inventaire',ref)),`${file}: ${ref}`);
    assert(!html.includes('categoryMapping'));assert(!html.includes('cleanupHistoryLimit'));assert(!html.includes('onclick='));
  }
});
