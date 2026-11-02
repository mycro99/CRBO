import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../Code.gs',import.meta.url),'utf8');
const sample={id:'11111111-1111-4111-8111-111111111111',identity:'Patient fictif',missionNumber:'60/26/295/0259',pickup:'domicile',destination:'hopital',hospital:'AR',photo:'',website:''};
function harness({quota=10,sendFails=false,buildFails=false,manifestFails=false,sentStateFails=false,deleteFails=false,shared=false}={}){
 const files=new Map(),events=[],mails=[],props=new Map();let next=1;
 function file(name,content){const id=String(next++),f={getId:()=>id,getName:()=>name,getBlob:()=>({getDataAsString:()=>content,getBytes:()=>[37,80,68,70,45]}),setContent:s=>{const state=JSON.parse(s);if(sentStateFails&&state.phase==='sent')throw Error('Interrupted after mail');content=s;events.push('state:'+state.phase);return f;}};files.set(id,f);return f;}
 function iterator(list){let i=0;return {hasNext:()=>i<list.length,next:()=>list[i++]};}
 const folder={getName:()=> '2026-11-01',getId:()=> 'folder',getSharingAccess:()=>shared?'ANYONE':'PRIVATE',getEditors:()=>[],getViewers:()=>[],getFiles:()=>iterator([...files.values()]),getFilesByName:n=>iterator([...files.values()].filter(f=>f.getName()===n)),createFile:(n,s)=>{if(n==='batch.json'&&manifestFails)throw Error('Manifest unavailable');events.push('create:'+n);return file(n,s);}};
 let lock=false;
 const ctx={console:{log(){},error(){}},Date,JSON,Math,Error,Object,String,Array,
  ContentService:{MimeType:{JSON:'json'},createTextOutput:value=>({setMimeType:()=>JSON.parse(value)})},HtmlService:{},MimeType:{PLAIN_TEXT:'text/plain',PDF:'application/pdf'},
  Session:{getEffectiveUser:()=>({getEmail:()=> 'contactoupeye@gmail.com'})},
  LockService:{getScriptLock:()=>({tryLock:()=>{lock=true;return true;},releaseLock:()=>{lock=false;}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),getProperties:()=>Object.fromEntries(props),deleteProperty:k=>props.delete(k)})},
  Utilities:{base64Decode:s=>[...Buffer.from(s,'base64')].map(b=>b>127?b-256:b),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>crypto.createHash('sha256').update(typeof s==='string'?s:Buffer.from(s)).digest(),formatDate:(d,zone,pattern)=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));if(pattern==='HH:mm:ss')return parts.hour+':'+parts.minute+':'+parts.second;if(pattern==='dd/MM/yyyy')return parts.day+'/'+parts.month+'/'+parts.year;return parts.year+'-'+parts.month+'-'+parts.day;}},
  DriveApp:{Access:{PRIVATE:'PRIVATE'},getFileById:id=>{if(!files.has(id))throw Error('Missing');return files.get(id);}},
  MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:mail=>{events.push('send');if(sendFails)throw Error('Unknown transport result');mails.push(mail);}},
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const realBuild=ctx.buildPdf_;
 ctx.buildPdf_=(f,day,records)=>{if(buildFails)throw Error('Conversion failed');events.push('pdf-saved');return file('feuille-route-'+day+'.pdf','%PDF');};
 ctx.removeFile_=id=>{if(deleteFails)throw Error('Delete failed');events.push('delete:'+id);files.delete(id);};
 ctx.root_=()=>({});ctx.dayFolder_=()=>folder;
 return {ctx,realBuild,folder,files,events,mails,props,file,add:course=>file('course-'+course.id+'.json',JSON.stringify({day:'2026-11-01',receivedAt:'2026-11-01T12:00:00Z',course})),state:()=>{const f=[...files.values()].find(f=>f.getName()==='batch.json');return f?JSON.parse(f.getBlob().getDataAsString()):null;},locked:()=>lock};
}
test('photo or written identity accepted; absent patient exempt; conditional fields validated server-side',()=>{
 const h=harness();assert.equal(h.ctx.validateCourse_(sample).identity,'Patient fictif');
 assert.equal(h.ctx.validateCourse_({...sample,identity:'',destination:'sans_prise_en_charge',hospital:'',outcome:'absent'}).identity,'');
 const jpeg=Buffer.from([255,216,255,0,255,217]).toString('base64');
 assert.equal(h.ctx.validateCourse_({...sample,identity:'',photo:jpeg}).photo,jpeg);
 for(const change of [{identity:''},{pickup:'autre',address:''},{destination:'hopital',hospital:'constructor'},{destination:'sans_prise_en_charge',outcome:'other'},{photo:'no jpeg'},{id:'bad'},{identity:'x'.repeat(301)},{website:'bot'},{address:'x'.repeat(241),pickup:'autre'}])assert.throws(()=>h.ctx.validateCourse_({...sample,...change}));
});
test('all requested hospitals and outcomes remain supported',()=>{
 const h=harness();for(const hospital of ['AR','NDH','CITA','MLE','CHU','NDB','CHBA','AZ','UMC'])assert.equal(h.ctx.validateCourse_({...sample,hospital}).hospital,hospital);
 for(const outcome of ['absent','refus','dcd','sur_place','autre_transport'])assert.equal(h.ctx.validateCourse_({...sample,destination:'sans_prise_en_charge',outcome}).outcome,outcome);
});
test('same retry saves once, response reveals no patient data, changed payload never overwrites',()=>{
 const h=harness();const a=h.ctx.enregistrerCourse(sample),b=h.ctx.enregistrerCourse(sample);assert.equal(a.receipt,b.receipt);assert.equal(h.files.size,1);assert.equal(h.locked(),false);
 assert.deepEqual(Object.keys(a).sort(),['day','ok','receipt']);assert.throws(()=>h.ctx.enregistrerCourse({...sample,identity:'Autre patient'}));assert.equal(h.files.size,1);
});
test('midnight Belgium determines the day, including daylight saving changes',()=>{
 const h=harness();assert.equal(h.ctx.routeDay_(new Date('2026-11-01T23:00:00Z')),'2026-11-02');assert.equal(h.ctx.routeDay_(new Date('2026-07-01T22:00:00Z')),'2026-07-02');assert.equal(h.ctx.routeDay_(new Date('2026-10-25T22:59:59Z')),'2026-10-25');
});
test('PDF then durable manifest precede source deletion, fixed recipient then sent state before PDF deletion',()=>{
 const h=harness();const raw=h.add(sample);h.ctx.processDay_(h.folder);const events=h.events;
 assert.ok(events.indexOf('pdf-saved')<events.indexOf('create:batch.json'));
 assert.ok(events.indexOf('create:batch.json')<events.indexOf('delete:'+raw.getId()));
 assert.ok(events.indexOf('delete:'+raw.getId())<events.indexOf('send'));
 assert.ok(events.indexOf('send')<events.indexOf('state:sent'));assert.equal(h.files.size,0);assert.equal(h.mails.length,1);assert.equal(h.mails[0].to,'logistique.cs.oupeye@croix-rouge.be');
});
test('PDF creation or manifest write failure keeps every source',()=>{
 for(const mode of [{buildFails:true},{manifestFails:true}]){const h=harness(mode),raw=h.add(sample);assert.throws(()=>h.ctx.processDay_(h.folder));assert.ok(h.files.has(raw.getId()));assert.equal(h.mails.length,0);}
});
test('exhausted quota retains prepared PDF, later retry sends same PDF',()=>{
 const h=harness({quota:0});h.add(sample);h.ctx.processDay_(h.folder);const state=h.state();assert.equal(state.phase,'prepared');assert.ok(h.files.has(state.pdfId));assert.equal(h.mails.length,0);
 h.ctx.MailApp.getRemainingDailyQuota=()=>10;h.ctx.processDay_(h.folder);assert.equal(h.mails.length,1);assert.equal(h.events.filter(e=>e==='pdf-saved').length,1);
});
test('mail exception retains PDF in review, no automatic duplicate or erasure',()=>{
 const h=harness({sendFails:true});h.add(sample);h.ctx.processDay_(h.folder);const state=h.state();assert.equal(state.phase,'review');assert.ok(h.files.has(state.pdfId));h.ctx.processDay_(h.folder);assert.equal(h.events.filter(e=>e==='send').length,1);assert.ok(h.files.has(state.pdfId));
});
test('interruption after mail but before sent marker retains PDF and never blindly resends',()=>{
 const h=harness({sentStateFails:true});h.add(sample);assert.throws(()=>h.ctx.processDay_(h.folder));assert.equal(h.mails.length,1);assert.equal(h.state().phase,'sending');h.ctx.processDay_(h.folder);assert.equal(h.state().phase,'review');assert.equal(h.mails.length,1);assert.ok(h.files.has(h.state().pdfId));
});
test('cleanup of durable sent state never sends mail again',()=>{
 const h=harness(),pdf=h.file('daily.pdf','pdf');h.file('batch.json',JSON.stringify({day:'2026-11-01',count:1,phase:'sent',pdfId:pdf.getId(),sourceIds:[]}));h.ctx.processDay_(h.folder);assert.equal(h.files.size,0);assert.equal(h.mails.length,0);
});
test('public script functions do not expose admin operations or a read API; form has no browser persistence',()=>{
 const publicNames=[...source.matchAll(/^function (\w+)\(/gm)].map(x=>x[1]).filter(x=>!x.endsWith('_'));assert.deepEqual(publicNames,['doGet','doPost','enregistrerCourse','installerFeuilleRoute']);
 const html=fs.readFileSync(new URL('../Form.html',import.meta.url),'utf8');assert.doesNotMatch(html,/localStorage|sessionStorage|indexedDB|serviceWorker|console\./);new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
test('pending receipt recovers an already persisted record after a lost acknowledgement',()=>{
 const h=harness();h.ctx.enregistrerCourse(sample);const key='RECEIPT_'+sample.id,receipt=JSON.parse(h.props.get(key));receipt.saved=false;h.props.set(key,JSON.stringify(receipt));
 const result=h.ctx.enregistrerCourse(sample);assert.equal(result.day,receipt.day);assert.equal(h.files.size,1);assert.equal(JSON.parse(h.props.get(key)).saved,true);
});
test('PDF creates one framed card per course, separate blocks, bold number and Belgian timestamp',()=>{
 const h=harness();h.ctx.buildPdf_=h.realBuild;let breaks=0,images=0,closed=false,removed=false,saved=false;
 const paragraphs=[],tables=[];
 const image={getWidth:()=>1800,getHeight:()=>900,setWidth(w){assert.ok(w<=407);return this;},setHeight(height){assert.ok(height<=280);return this;}};
 function paragraph(value){
  const style={text:value};paragraphs.push(style);
  const text={setFontFamily(v){style.font=v;return this;},setFontSize(v){style.size=v;return this;},setBold(v){style.bold=v;return this;},setForegroundColor(v){style.color=v;return this;}};
  const p={setSpacingBefore(){return this;},setSpacingAfter(){return this;},setLineSpacing(){return this;},setAlignment(v){style.align=v;return this;},editAsText:()=>text,appendInlineImage(){images++;return image;},asParagraph(){return this;}};return p;
 }
 function table(rows){
  const cells=rows.map(row=>{const first=paragraph(row[0]);return {setBackgroundColor(){return this;},setPaddingTop(){return this;},setPaddingBottom(){return this;},setPaddingLeft(){return this;},setPaddingRight(){return this;},getChild:()=>first,appendParagraph:paragraph};});
  const t={setColumnWidth(index,w){assert.equal(w,435);return this;},setBorderColor(){return this;},setBorderWidth(){return this;},getRow:i=>({getCell:()=>cells[i]})};tables.push(t);return t;
 }
 const body={clear(){},setPageWidth(){return this;},setPageHeight(){return this;},setMarginTop(){return this;},setMarginBottom(){return this;},setMarginLeft(v){assert.equal(v,80);return this;},setMarginRight(v){assert.equal(v,80);return this;},setAttributes(){},appendParagraph:paragraph,appendTable:table,appendPageBreak:()=>{breaks++;}};
 h.ctx.DocumentApp={Attribute:{FONT_FAMILY:'font',FONT_SIZE:'size'},HorizontalAlignment:{CENTER:'center',LEFT:'left'},create:()=>({getId:()=> 'doc',getBody:()=>body,saveAndClose:()=>{closed=true;}})};
 h.ctx.Utilities.newBlob=()=>({});
 h.ctx.DriveApp.getFileById=()=>({getId:()=> 'doc',moveTo(){},getAs:()=>{assert.equal(closed,true);return {setName(){return this;},getBytes:()=>[37,80,68,70,45]};}});
 h.ctx.removeFile_=()=>{removed=true;};
 const folder={getFilesByName:()=>({hasNext:()=>false}),createFile:()=>{saved=true;return {getId:()=> 'pdf'};}};
 const records=Array.from({length:20},()=>({receivedAt:'2026-11-01T12:00:00Z',course:{...sample,photo:Buffer.from([255,216,255,0,255,217]).toString('base64')}}));
 delete records[0].course.missionNumber;
 h.ctx.buildPdf_(folder,'2026-11-01',records);
 assert.ok(paragraphs.some(p=>p.text==='Non renseigné (ancienne fiche)'));
 assert.ok(paragraphs.some(p=>p.text==='60/26/295/0259'&&p.bold===true&&p.size===23&&p.align==='center'));
 assert.ok(paragraphs.some(p=>p.text==='Enregistrée le 01/11/2026 à 13:00:00'));
 for(const label of ['PATIENT','PRISE EN CHARGE','DESTINATION'])assert.equal(paragraphs.filter(p=>p.text===label&&p.bold).length,20);
 assert.equal(tables.length,20);assert.equal(breaks,19);assert.equal(images,20);assert.equal(saved,true);assert.equal(removed,true);
});
test('card presentation keeps address, outcome and the original receivedAt across summer/winter time',()=>{
 const h=harness();
 const record={receivedAt:'2026-07-01T22:05:06Z',course:{...sample,pickup:'autre',address:'Adresse fictive',destination:'sans_prise_en_charge',outcome:'refus',photo:''}};
 const card=h.ctx.routeCard_(record,0,1,'2026-07-02');const lines=card.rows.flatMap(r=>r.lines).map(l=>l.text);
 assert.ok(lines.includes('Enregistrée le 02/07/2026 à 00:05:06'));assert.ok(lines.includes('Adresse fictive'));assert.ok(lines.includes('Refus'));
 assert.ok(lines.includes('Journée du 02/07/2026 · Course 1 / 1'));assert.equal(card.rows[2].photo,'');
});
test('scheduler closes only prior Belgian dates and never the active day',()=>{
 const h=harness();h.ctx.routeDay_=()=> '2026-11-02';const folders=['2026-11-01','2026-11-02','2026-11-03','other'].map(name=>({getName:()=>name}));let i=0,processed=[];
 h.ctx.root_=()=>({getFolders:()=>({hasNext:()=>i<folders.length,next:()=>folders[i++]})});h.ctx.privateFolder_=f=>f;h.ctx.processDay_=f=>processed.push(f.getName());h.ctx.traiterJournees_();assert.deepEqual(processed,['2026-11-01']);
});

test('missing or modified backup never causes remaining sources to be erased',()=>{
 for(const mode of ['missing','modified']){
  const h=harness({quota:0});const raw=h.add(sample);h.ctx.removeFile_=id=>{};h.ctx.processDay_(h.folder);const state=h.state();
  if(mode==='missing')h.files.delete(state.pdfId);else h.files.get(state.pdfId).getBlob=()=>({getBytes:()=>[37,80,68,70,45,99]});
  h.ctx.removeFile_=id=>h.files.delete(id);assert.throws(()=>h.ctx.processDay_(h.folder));assert.ok(h.files.has(raw.getId()));assert.equal(h.mails.length,0);
 }
});

test('visible installer rejects anonymous and other active users even when deployed as owner',()=>{
 const h=harness();let installed=0;h.ctx.installerFeuilleRoute_=()=>{installed++;};
 for(const email of ['', 'other@example.com']){h.ctx.Session.getActiveUser=()=>({getEmail:()=>email});assert.throws(()=>h.ctx.installerFeuilleRoute());}
 assert.equal(installed,0);h.ctx.Session.getActiveUser=()=>({getEmail:()=> 'contactoupeye@gmail.com'});h.ctx.installerFeuilleRoute();assert.equal(installed,1);
});

test('anonymous POST plus technical receipt confirms storage without exposing patient content',()=>{
 const h=harness();assert.equal(h.ctx.doPost({postData:{contents:JSON.stringify(sample)}}).ok,true);
 const receipt=h.ctx.doGet({parameter:{receipt:sample.id}});assert.equal(receipt.stored,true);assert.equal(receipt.receipt,sample.id);assert.deepEqual(Object.keys(receipt).sort(),['day','ok','receipt','stored']);
 assert.equal(h.ctx.doGet({parameter:{receipt:'22222222-2222-4222-8222-222222222222'}}).stored,false);
 assert.equal(h.ctx.doPost({postData:{contents:'not json'}}).ok,false);assert.equal(h.ctx.doPost({postData:{contents:'x'.repeat(900001)}}).ok,false);
 assert.equal(h.ctx.doGet({parameter:{service:'route-api'}}).routeApi,2);
});

test('course number is mandatory and normalized on the server, preserving leading zeros',()=>{
 const h=harness();assert.equal(h.ctx.validateCourse_({...sample,missionNumber:'60262950259'}).missionNumber,'60/26/295/0259');
 assert.equal(h.ctx.validateCourse_({...sample,missionNumber:'00260000001'}).missionNumber,'00/26/000/0001');
 for(const missionNumber of ['', '123', '602629502590', 'AA60262950259'])assert.throws(()=>h.ctx.validateCourse_({...sample,missionNumber}));
 h.ctx.enregistrerCourse(sample);const stored=JSON.parse([...h.files.values()][0].getBlob().getDataAsString());assert.equal(stored.course.missionNumber,sample.missionNumber);
});
