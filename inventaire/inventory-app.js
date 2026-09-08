import { SEED_CATEGORIES, SEED_ARTICLES } from './catalog-seed.js';
import { CATALOG_IMAGES } from './catalog-images.js';
import { articleFrom, categoryLabel, fold, normalizeBarcode, barcodeMatches, quantity, validDate, todayISO, expiryState, formatDate, safeImage, isArticlePhoto, expiryAlert, unallocatedStock, expiries, primaryExpiry, orderNeed, matchesFilter, splitBarcodes } from './inventory-core.js?v=4';
import { prepareArticlePhoto } from './article-photo.js?v=4';
import { escapeHTML as e, uid, friendlyError, downloadFile, csvText, pdfTable } from './inventory-ui.js';
import { BarcodeCamera, cameraError } from './barcode-camera.js';

const $=id=>document.getElementById(id);
let store, state={articles:[],records:new Map(),ready:false,online:false}, busy=0, authUser=null;
let filter='all', search='', category='', countMode=false, highlighted='';
let submitHandler=null, formSaving=false, formDirty=false, photoProcessing=false, formOperationId='', toastTimer;
let countDraft=new Map(), unsubscribeInventory=()=>{}, unsubscribeLast=()=>{};
const expanded=new Set(['consommables']);
const stockDraft=new Map();
const camera=new BarcodeCamera('capture-reader');
const current=id=>state.articles.find(a=>a.id===id);
const writable=()=>Boolean(authUser && state.ready && state.online && navigator.onLine && !busy);
const actionButton=(action,id,label,extra='')=>`<button type="button" class="button small" data-action="${action}" data-id="${e(id)}" ${extra}>${e(label)}</button>`;
const badge=expiry=>`<span class="status ${e(expiry.key)}">${e(expiry.label)}</span>`;

function notify(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,error?10000:5000);}
function showError(error){$('global-error').textContent=friendlyError(error);$('global-error').hidden=false;}
function updateStatus(){
  const status=$('sync-status');
  status.textContent=busy?'Enregistrement en cours — gardez cette page ouverte':!authUser?'Connexion staff nécessaire':!state.ready?'Chargement des données enregistrées…':!state.online || !navigator.onLine?'Hors connexion — consultation uniquement':'Synchronisé avec la réserve';
  status.className=writable()?'saved':'pending';
  document.querySelectorAll('[data-write]').forEach(button=>button.disabled=!writable());
  document.querySelectorAll('[data-loaded]').forEach(button=>button.disabled=!state.ready);
  document.querySelectorAll('[data-close]').forEach(button=>button.disabled=formSaving);
  $('editor-submit').disabled=photoProcessing || Boolean(submitHandler) && !writable();
  document.querySelectorAll('[data-stock-id], [data-action="saveStock"]').forEach(el=>{const a=current(el.dataset.stockId||el.dataset.id);el.disabled=!writable()||!a?.active||!a?.stockValid;});
  document.querySelectorAll('[data-action="cancelStock"]').forEach(el=>el.disabled=Boolean(busy));
  $('validate-count').disabled=!writable() || !countDraft.size;
}
function categories(){return [...new Set([...SEED_CATEGORIES.map(c=>c.id),...state.articles.map(a=>a.category)])];}
function visibleArticles(){
  const needle=fold(search.trim()),code=normalizeBarcode(search);
  return state.articles.filter(a=>matchesFilter(a,filter) && (!category || a.category===category) && (!needle || fold([a.name,a.location,a.notes,categoryLabel(a.category),...a.barcodes].join(' ')).includes(needle) || a.barcodes.some(b=>code && normalizeBarcode(b).includes(code)))).sort((a,b)=>a.order-b.order || a.name.localeCompare(b.name,'fr'));
}
function render(){
  updateStatus();if(!state.ready)return;
  const categorySelect=$('category');
  categorySelect.innerHTML='<option value="">Toutes les catégories</option>'+categories().map(c=>`<option value="${e(c)}">${e(categoryLabel(c))}</option>`).join('');categorySelect.value=category;
  for(const key of ['all','low','expiry','ordered'])$('stat-'+key).textContent=state.articles.filter(a=>matchesFilter(a,key)).length;
  const alert=expiryAlert(state.articles);
  $('expiry-alert').classList.toggle('expiry-expired',alert==='expired');$('expiry-alert').classList.toggle('expiry-soon',alert==='soon');
  $('expiry-summary').textContent=alert==='expired'?'Date dépassée':alert==='soon'?'Moins de 30 jours':'Aucune alerte de date';
  document.querySelectorAll('#dashboard button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
  const visible=visibleArticles(),groups=new Map();
  for(const a of visible){if(!groups.has(a.category))groups.set(a.category,[]);groups.get(a.category).push(a);}
  const focused=document.activeElement?.dataset.countId;
  const focusedStock=document.activeElement?.dataset.stockId;
  $('inventory-body').innerHTML=[...groups].map(([cat,articles])=>{
    const open=expanded.has(cat)||Boolean(search)||Boolean(category)||filter!=='all';
    return `<tr class="category-row"><td colspan="5"><button type="button" class="category-button" data-category="${e(cat)}" aria-expanded="${open}"><span aria-hidden="true">${open?'−':'+'}</span>${e(categoryLabel(cat))}<span>${articles.length} article${articles.length>1?'s':''}</span></button></td></tr>`+(open?articles.map(row).join(''):'');
  }).join('');
  $('result-count').textContent=`${visible.length} article${visible.length>1?'s':''} • ${filter==='archived'?'archives conservées':'stock en temps réel'}`;
  $('empty-results').hidden=visible.length!==0;
  $('count-panel').hidden=!countMode;
  $('stock-help').hidden=countMode;
  $('count-progress').textContent=`${countDraft.size} saisie${countDraft.size>1?'s':''} (100 maximum par validation)`;
  if(focused)document.querySelector(`[data-count-id="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  updateStatus();
  if(focusedStock)document.querySelector(`[data-stock-id="${CSS.escape(focusedStock)}"]`)?.focus({preventScroll:true});
}
function row(a){
  const image=safeImage(a.image), expiry=primaryExpiry(a), draft=countDraft.get(a.id), direct=stockDraft.get(a.id);
  const disabled=writable()&&a.active&&a.stockValid?'':'disabled';
  const stockClass=a.stock===0?'stock-zero':a.stock<a.minStock?'stock-low':'';
  const stock=countMode&&a.active?`${a.lots.length?'<span class="muted">Comptage par lot</span>':`<input class="count-input" data-count-id="${e(a.id)}" type="number" min="0" max="9999999" step="1" inputmode="numeric" placeholder="Compté" value="${e(draft?.value??'')}" aria-label="Quantité comptée : ${e(a.name)}" ${a.stockValid?'':'disabled'}>`}<small class="article-meta">Enregistré : ${a.stockValid?a.stock:'À vérifier'}</small>`:
    `<div class="stock-controls"><button type="button" data-action="minus" data-id="${e(a.id)}" aria-label="Retirer une unité : ${e(a.name)}" ${disabled}>−</button><input class="stock-value stock-input ${stockClass}" data-stock-id="${e(a.id)}" type="number" min="0" max="9999999" step="1" inputmode="numeric" value="${e(direct?.value??(a.stockValid?a.stock:''))}" aria-label="Total en stock : ${e(a.name)}" aria-describedby="stock-help" ${disabled}><button type="button" data-action="plus" data-id="${e(a.id)}" aria-label="Ajouter une unité : ${e(a.name)}" ${disabled}>+</button><button type="button" class="stock-save" data-action="saveStock" data-id="${e(a.id)}" aria-label="Enregistrer le total : ${e(a.name)}" ${direct?.dirty?'':'hidden'} ${disabled}>✓</button><button type="button" data-action="cancelStock" data-id="${e(a.id)}" aria-label="Annuler la saisie : ${e(a.name)}" ${direct?.dirty?'':'hidden'} ${busy?'disabled':''}>↶</button></div><span class="article-meta">${e(a.unit)}<span data-stock-pending="${e(a.id)}">${direct?.dirty?' · À valider':''}</span></span>`;
  return `<tr class="article-row ${highlighted===a.id?'highlight':''}" data-row-id="${e(a.id)}"><td><div class="article-cell">${image?`<img class="article-photo" src="${e(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="photo-placeholder" aria-hidden="true">Photo</span>'}<div><button class="article-name" type="button" data-action="detail" data-id="${e(a.id)}">${e(a.name)}</button><span class="article-meta">${e(a.location||categoryLabel(a.category))}${a.orderQuantity?` · ${a.orderQuantity} en commande`:''}${!a.active?' · Archivé':''}</span></div></div></td><td data-label="Stock">${stock}</td><td data-label="Minimum / souhaité"><strong>${a.minStock}</strong> / ${a.targetStock}</td><td data-label="Péremption">${badge(expiry)}${expiry.date&&expiry.key!=='ok'?`<span class="article-meta">${e(formatDate(expiry.date))}</span>`:''}${a.lots.length?`<span class="article-meta">${a.lots.length} lot${a.lots.length>1?'s':''}</span>`:''}</td><td>${actionButton('detail',a.id,'Gérer')}</td></tr>`;
}
document.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement && img.classList.contains('article-photo')){const placeholder=document.createElement('span');placeholder.className='photo-placeholder';placeholder.textContent='Photo';placeholder.setAttribute('aria-hidden','true');img.replaceWith(placeholder);}},true);

function openDialog(title,body,onSubmit=null,submitLabel='Enregistrer'){
  if(formSaving)return;
  $('editor-title').textContent=title;$('editor-body').innerHTML=body;$('editor-error').textContent='';
  submitHandler=onSubmit;formOperationId=uid();formDirty=false;photoProcessing=false;
  $('editor-submit').textContent=submitLabel;$('editor-submit').hidden=!onSubmit;
  $('editor-submit').className='button primary';
  if(!$('editor').open)$('editor').showModal();
  $('editor').scrollTop=0;updateStatus();
}
function closeDialog(){if(formSaving)return;if(formDirty&&!confirm('Fermer sans enregistrer les modifications de cette fiche ?'))return;$('editor').close();submitHandler=null;formDirty=false;}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeDialog));
$('editor').addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
$('editor-form').addEventListener('input',()=>{formDirty=true;});
$('editor-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!submitHandler||formSaving||photoProcessing)return;
  if(!writable()){$('editor-error').textContent='Attendez la reconnexion avant d’enregistrer.';return;}
  const handler=submitHandler,formData=new FormData($('editor-form'));
  formSaving=true;busy++;updateStatus();
  const fields=[...$('editor-body').querySelectorAll('input,select,textarea,button')].map(el=>[el,el.disabled]);fields.forEach(([el])=>el.disabled=true);
  try{await handler(formData,formOperationId);formDirty=false;$('editor').close();submitHandler=null;notify('Enregistrement confirmé.');}
  catch(error){$('editor-error').textContent=friendlyError(error);}
  finally{fields.forEach(([el,disabled])=>el.disabled=disabled);formSaving=false;busy--;render();}
});
function input(name,label,value='',type='text',extra='') {return `<label>${e(label)}<input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;}
function check(name,label,checked=false){return `<label class="checkbox-label"><input type="checkbox" name="${name}" ${checked?'checked':''}>${e(label)}</label>`;}
function dateFields(a){return `<div class="form-grid">${input('expirationDate','Date de péremption',a.expirationDate,'date')}${check('noExpiration','Sans péremption',a.noExpiration)}</div>`;}
function resolveCategory(value){return categories().find(c=>fold(categoryLabel(c))===fold(value.trim()))||value.trim();}

function editArticle(a=null,barcode=''){
  const newId=a?.id||'article-'+uid();
  let photoDraft=isArticlePhoto(a?.image)?a.image:undefined;
  const photos=CATALOG_IMAGES;
  const body=`<p class="muted">${a?'La fiche ne modifie ni le stock ni les péremptions.':'L’article sera disponible dans l’inventaire et le scanner après enregistrement.'}</p><div class="form-grid">
    <label class="full">Nom de l’article<input name="name" value="${e(a?.name||'')}" maxlength="160" required autofocus></label>
    <label>Catégorie<select id="article-category" name="category" required><option value="">Choisir une catégorie</option>${categories().map(c=>`<option value="${e(c)}" ${c===(a?.category||category)?'selected':''}>${e(categoryLabel(c))}</option>`).join('')}<option value="__new_category__">+ Nouvelle catégorie…</option></select><small>Famille d’articles, par exemple Consommables.</small></label>${input('location','Emplacement (facultatif)',a?.location||'','text','maxlength="120" placeholder="Armoire 2, étagère du haut"')}
    <label id="new-category-field" class="full" hidden>Nom de la nouvelle catégorie<input id="new-category-name" name="newCategory" maxlength="80" disabled></label>
    ${input('minStock','Stock minimum',a?.minStock??0,'number','required min="0" max="9999999" step="1"')}${input('targetStock','Stock souhaité',a?.targetStock??0,'number','required min="0" max="9999999" step="1"')}
    <p class="full muted">Minimum : seuil d’alerte pour recommander. Souhaité : quantité à retrouver après réapprovisionnement.</p>
    ${input('unit','Unité de comptage (boîte, pièce…)',a?.unit||'unité','text','maxlength="30"')}${!a?input('stock','Stock initial',0,'number','required min="0" max="9999999" step="1"'):''}
    <label class="full">Codes-barres — un par ligne<textarea id="article-barcodes" name="barcodes" rows="3" maxlength="8000">${e(a?.barcodes.join('\n')||barcode)}</textarea><small>Plusieurs variantes peuvent partager le même stock.</small></label>
    <div class="full"><button type="button" id="capture-code" class="button small">Scanner et ajouter un code</button><p id="barcode-warning" class="notice warning" hidden></p></div>
    <label class="full">Choisir une photo existante<select id="photo-picker"><option value="">Conserver la photo actuelle / autre image</option><option value="none">Sans photo</option>${photos.map(p=>`<option value="${e(p.path)}">${e(p.label)}</option>`).join('')}</select></label>
    <div class="full photo-capture"><img id="photo-preview" class="photo-preview" alt="Aperçu de la photo de l’article" hidden referrerpolicy="no-referrer"><div><button type="button" id="take-photo" class="button small" aria-label="Prendre une photo de l’article"><span aria-hidden="true">📷</span> Prendre une photo</button><button type="button" id="choose-photo" class="text-button">Choisir sur l’appareil</button><input id="article-photo-camera" type="file" accept="image/*" capture="environment" hidden><input id="article-photo-file" type="file" accept="image/*" hidden><p id="photo-status" class="muted" role="status">La photo sera réduite et enregistrée avec la fiche.</p></div></div>
    <label class="full">Photo ou lien HTTPS (facultatif)<input id="article-image" name="image" value="${e(photoDraft?'':safeImage(a?.image))}" maxlength="1500" placeholder="Image existante ou lien https://…"><small>Sans photo, une vignette neutre est affichée.</small></label>
    <label class="full">Notes<textarea name="notes" rows="2" maxlength="1000">${e(a?.notes||'')}</textarea></label>
    </div>${!a?`<h3>Péremption du stock initial</h3>${dateFields({expirationDate:'',noExpiration:false})}`:''}`;
  openDialog(a?'Modifier — '+a.name:'Nouvel article',body,async(fd,opId)=>{
    const catalog=Object.fromEntries(fd);catalog.category=resolveCategory(catalog.category==='__new_category__'?catalog.newCategory:catalog.category);catalog.barcodes=splitBarcodes(catalog.barcodes);
    if(photoDraft!==undefined)catalog.image=photoDraft;
    // A missing legacy photo path is retained unless the manager actually edits it.
    if(a && !safeImage(a.image) && !catalog.image)delete catalog.image;
    const operation=a?{type:'catalog',catalog,expectedRevision:a.catalogRevision}:{type:'create',catalog,stock:fd.get('stock'),expirationDate:fd.get('expirationDate'),noExpiration:fd.has('noExpiration')};
    await store.perform(newId,operation,opId);
  },a?'Enregistrer la fiche':'Créer l’article');
  const warn=()=>{
    const others=state.articles.filter(b=>b.id!==a?.id);
    const collisions=splitBarcodes($('article-barcodes').value).flatMap(code=>barcodeMatches(others,code).map(b=>`${code} : ${b.name}`));
    $('barcode-warning').hidden=!collisions.length;$('barcode-warning').textContent=collisions.length?'Code déjà associé ailleurs (association conservée, choix proposé au scan) : '+collisions.join(' ; '):'';
  };
  $('article-barcodes').addEventListener('input',warn);warn();
  $('article-category').addEventListener('change',event=>{const isNew=event.target.value==='__new_category__';$('new-category-field').hidden=!isNew;$('new-category-name').disabled=!isNew;$('new-category-name').required=isNew;if(isNew)$('new-category-name').focus();});
  const preview=()=>{const src=safeImage(photoDraft??$('article-image').value);$('photo-preview').hidden=!src;if(src)$('photo-preview').src=src;else $('photo-preview').removeAttribute('src');};preview();
  $('photo-picker').addEventListener('change',event=>{if(event.target.value){photoDraft=undefined;$('article-image').value=event.target.value==='none'?'':event.target.value;formDirty=true;preview();}});
  $('article-image').addEventListener('input',()=>{photoDraft=undefined;preview();});
  $('take-photo').addEventListener('click',()=>$('article-photo-camera').click());
  $('choose-photo').addEventListener('click',()=>$('article-photo-file').click());
  const photoFormId=formOperationId;
  const loadPhoto=async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file||photoProcessing)return;
    photoProcessing=true;formDirty=true;updateStatus();$('photo-status').textContent='Préparation de la photo…';
    const controls=['take-photo','choose-photo','photo-picker','article-image'].map($);controls.forEach(el=>el.disabled=true);
    try{const result=await prepareArticlePhoto(file);if(photoFormId!==formOperationId||!$('editor').open)return;photoDraft=result;$('article-image').value='';$('photo-picker').value='';preview();$('photo-status').textContent='Photo prête. Enregistrez la fiche pour la conserver.';}
    catch(error){if(photoFormId===formOperationId&&$('editor').open)$('photo-status').textContent=error.message;}
    finally{if(photoFormId===formOperationId){photoProcessing=false;controls.forEach(el=>el.disabled=false);updateStatus();}}
  };
  $('article-photo-camera').addEventListener('change',loadPhoto);$('article-photo-file').addEventListener('change',loadPhoto);
  $('capture-code').addEventListener('click',()=>captureCode(code=>{$('article-barcodes').value=splitBarcodes($('article-barcodes').value+'\n'+code).join('\n');formDirty=true;warn();}));
}
async function captureCode(onCode){
  $('capture-status').textContent='Placez le code dans le cadre.';$('capture-dialog').showModal();
  try{await camera.start(async code=>{await camera.stop();$('capture-dialog').close();onCode(code);});}
  catch(error){$('capture-status').textContent=cameraError(error);}
}
async function closeCapture(){await camera.stop();$('capture-dialog').close();}
$('capture-close').addEventListener('click',closeCapture);
$('capture-dialog').addEventListener('cancel',event=>{event.preventDefault();closeCapture();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)camera.stop();});
window.addEventListener('pagehide',()=>camera.stop());

function showDetail(a){
  const expiry=primaryExpiry(a);
  openDialog(a.name,`<p class="muted">${e(categoryLabel(a.category))}${a.location?' · '+e(a.location):''}${!a.active?' · Article archivé':''}</p>
    <div class="detail-summary"><div>En stock<strong>${a.stockValid?a.stock:'À vérifier'} <small>${e(a.unit)}</small></strong></div><div>Minimum / souhaité<strong>${a.minStock} / ${a.targetStock}</strong></div><div>Péremption<strong>${badge(expiry)}</strong></div></div>
    ${a.notes?`<p class="detail-notes">${e(a.notes)}</p>`:''}
    <div class="action-row">${actionButton('edit',a.id,'Modifier la fiche','data-write')}${a.active?actionButton('move',a.id,'Mouvement','data-write')+actionButton('expiry',a.id,'Modifier la péremption','data-write')+actionButton('lot',a.id,'Ajouter un lot','data-write')+actionButton('order',a.id,'Commande','data-write'):''}${actionButton('archive',a.id,a.active?'Archiver':'Réactiver','data-write')}<button type="button" class="button small danger" data-action="delete" data-id="${e(a.id)}" data-write>Supprimer</button></div>
    <h3 style="margin-top:24px">Codes-barres</h3><p class="detail-notes muted">${a.barcodes.length?a.barcodes.map(e).join('<br>'):'Aucun code-barres. Ajoutez-en dans la fiche article.'}</p>
    ${a.lots.length?`<h3>Lots de péremption</h3><p class="muted">Stock non réparti : ${unallocatedStock(a)}. Les lots sont inclus dans le stock total.</p><ul class="list">${a.lots.map(l=>`<li><h3>${e(l.label)} — ${e(l.quantity)} ${e(a.unit)}</h3>${badge(expiryState(l.expirationDate,l.noExpiration))}<span class="article-meta">${e(formatDate(l.expirationDate))}</span>${a.active?`<div class="list-actions">${actionButton('lotExpiry',a.id,'Modifier la date',`data-lot-id="${e(l.id)}" data-write`)}</div>`:''}</li>`).join('')}</ul>`:''}`);
}
function editExpiry(a,lotId=''){
  const target=lotId?a.lots.find(l=>l.id===lotId):a;if(!target)return;
  openDialog('Péremption — '+(lotId?target.label:a.name),`<p class="muted">${lotId?'Date de ce lot uniquement.':a.lots.length?'Cette date concerne le stock non réparti. Les lots gardent leurs propres dates.':'Cette opération ne change pas le stock.'} Cocher « Sans péremption » conserve la date saisie, mais désactive son alerte.</p>${dateFields(target)}`,async(fd,opId)=>store.perform(a.id,{type:lotId?'lotExpiry':'expiry',lotId,expirationDate:fd.get('expirationDate'),noExpiration:fd.has('noExpiration'),expectedDate:target.expirationDate||'',expectedNoExpiration:target.noExpiration===true},opId));
}
function movement(a,initial=1){
  openDialog('Mouvement — '+a.name,`<p class="muted">Stock enregistré : ${a.stock} ${e(a.unit)}. Le stock ne change qu’après confirmation.</p><div class="form-grid"><label>Opération<select name="direction"><option value="1" ${initial>0?'selected':''}>Entrée en stock</option><option value="-1" ${initial<0?'selected':''}>Sortie de stock</option></select></label>${input('quantity','Quantité',Math.abs(initial),'number','required min="1" max="9999999" step="1"')}${a.lots.length?`<label class="full">Lot concerné<select name="lotId"><option value="">Stock non réparti (${unallocatedStock(a)})</option>${a.lots.map(l=>`<option value="${e(l.id)}">${e(l.label)} — ${e(l.quantity)} — ${e(formatDate(l.expirationDate))}</option>`).join('')}</select></label>`:''}<label class="full">Motif (facultatif)<input name="reason" maxlength="300" placeholder="Réapprovisionnement ambulance, réception…"></label></div>`,async(fd,opId)=>store.perform(a.id,{type:'move',delta:quantity(fd.get('quantity'))*Number(fd.get('direction')),lotId:fd.get('lotId')||'',reason:fd.get('reason')},opId),'Confirmer le mouvement');
}
function addLot(a){
  const lotId=uid();
  openDialog('Ajouter un lot — '+a.name,`<p class="notice">${unallocatedStock(a)} ${e(a.unit)} ne sont pas encore réparties en lots. Aucun lot existant n’est remplacé.</p><div class="form-grid"><label class="full">Origine du lot<select name="origin"><option value="allocate">Répartir une partie du stock existant (total inchangé)</option><option value="receive">Nouvelle livraison (ajouter au stock total)</option></select></label>${input('label','Numéro ou nom du lot','','text','required maxlength="100"')}${input('quantity','Quantité du lot',1,'number','required min="1" max="9999999" step="1"')}</div><h3 style="margin-top:20px">Péremption du lot</h3>${dateFields({expirationDate:'',noExpiration:false})}`,async(fd,opId)=>store.perform(a.id,{type:'lot',lotId,label:fd.get('label'),quantity:fd.get('quantity'),expirationDate:fd.get('expirationDate'),noExpiration:fd.has('noExpiration'),receive:fd.get('origin')==='receive'},opId),'Enregistrer le lot');
}
function archive(a){
  openDialog(a.active?'Archiver — '+a.name:'Réactiver — '+a.name,`<p>${a.active?'L’article sera retiré de la liste active et du scanner. Son stock, ses lots, ses codes-barres et son historique seront conservés. Il restera accessible dans le filtre « Articles archivés ».':'L’article retrouvera la liste active, avec toutes ses données conservées.'}</p>`,async(_,opId)=>store.perform(a.id,{type:'archive',active:!a.active,expectedRevision:a.catalogRevision},opId),a.active?'Archiver sans supprimer':'Réactiver');
}
function deleteArticle(a){
  openDialog('Supprimer — '+a.name,`<p>Supprimer <strong>${e(a.name)}</strong> de l’inventaire ? L’article disparaîtra du tableau, des archives, des recommandations et du scanner.</p><p class="notice warning">Stock enregistré : <strong>${a.stockValid?a.stock:'À vérifier'} ${e(a.unit)}</strong>${a.orderQuantity?` · Commande en cours : <strong>${a.orderQuantity}</strong>`:''}. Vérifiez qu’il s’agit bien de l’article à retirer.</p><p class="muted">Son historique et ses données restent conservés. Cette suppression ne déplace pas son stock vers un autre article.</p>`,async(_,opId)=>{
    await store.perform(a.id,{type:'delete',expectedRevision:a.catalogRevision,expectedStockRevision:a.stockRevision,expectedStock:a.stock,expectedOrderQuantity:a.orderQuantity},opId);
    stockDraft.delete(a.id);countDraft.delete(a.id);saveCountDraft();
  },'Supprimer cet article');
  $('editor-submit').className='button danger';
}
function order(a){
  openDialog('Commande — '+a.name,`<p>Stock : <strong>${a.stock}</strong> · Souhaité : <strong>${a.targetStock}</strong> · Déjà commandé : <strong>${a.orderQuantity}</strong></p><p class="muted">La quantité ci-dessous est le total restant à recevoir. Ce suivi n’envoie pas de commande au fournisseur.</p>${input('quantity','Quantité restant à recevoir',a.orderQuantity||Math.max(0,a.targetStock-a.stock),'number','required min="0" max="9999999" step="1"')}`,async(fd,opId)=>store.perform(a.id,{type:'order',quantity:fd.get('quantity'),expectedQuantity:a.orderQuantity},opId));
}
function receive(a){
  openDialog('Réception — '+a.name,`<p>Restant à recevoir : ${a.orderQuantity} ${e(a.unit)}. La quantité reçue sera ajoutée au stock et retirée de la commande.</p><p class="muted">Elle rejoint le stock non réparti. Vous pourrez ensuite la répartir en lot sans modifier le total.</p>${input('quantity','Quantité reçue',a.orderQuantity,'number',`required min="1" max="${a.orderQuantity}" step="1"`)}`,async(fd,opId)=>store.perform(a.id,{type:'receive',quantity:fd.get('quantity')},opId),'Confirmer la réception');
}
function showOrders(){
  const items=state.articles.filter(a=>a.active&&(a.stock<a.minStock||a.orderQuantity>0));
  openDialog('À recommander',`<p class="muted">Articles sous le minimum, ou déjà commandés. Quantité suggérée = stock souhaité − stock disponible − quantité déjà commandée.</p><div class="action-row"><button class="button small" type="button" id="orders-pdf">Télécharger le PDF</button></div><ul class="list" style="margin-top:20px">${items.length?items.map(a=>`<li><h3>${e(a.name)}</h3><p>Stock ${a.stock} · Minimum ${a.minStock} · Souhaité ${a.targetStock}<br>En commande : ${a.orderQuantity} · À commander : <strong>${orderNeed(a)}</strong></p><div class="list-actions">${actionButton('order',a.id,'Suivre la commande','data-write')}${a.orderQuantity?actionButton('receive',a.id,'Réceptionner','data-write'):''}</div></li>`).join(''):'<li>Aucun article à recommander.</li>'}</ul>`);
  $('orders-pdf').addEventListener('click',()=>exportPDF(true));
}
async function showHistory(){
  openDialog('Historique','<p>Chargement des 100 dernières opérations…</p>');
  const token=formOperationId;
  try{const entries=await store.history();if(token!==formOperationId||!$('editor').open)return;
    $('editor-body').innerHTML='<p class="muted">Les 100 dernières opérations. Les entrées antérieures restent conservées dans la base.</p><ul class="list">'+entries.map(h=>`<li><h3>${e(h.articleName||h.articleId||'Article')}</h3><p>${e(h.action||'Modification')}${h.newStock!==undefined?' · Stock : '+e(h.newStock):''}${h.expirationDate?' · Péremption : '+e(formatDate(h.expirationDate)):''}${h.reason?'<br>'+e(h.reason):''}</p><span class="history-date">${e(h.userEmail||'')} · ${e(h.date?.toDate?h.date.toDate().toLocaleString('fr-BE',{timeZone:'Europe/Brussels'}):'Date non disponible')}</span></li>`).join('')+(entries.length?'':'<li>Aucune opération enregistrée.</li>')+'</ul>';
  }catch(error){if(token===formOperationId)$('editor-error').textContent=friendlyError(error);}
}
async function quickMove(a,delta){
  if(!writable())return;
  if(a.lots.length){movement(a,delta);return;}
  busy++;updateStatus();
  try{await store.perform(a.id,{type:'move',delta},uid());notify(`${a.name} : ${delta>0?'+':''}${delta} confirmé.`);}
  catch(error){showError(error);notify(friendlyError(error),true);}
  finally{busy--;render();}
}
function beginStockDraft(id){
  const a=current(id);if(!a)return;
  if(!stockDraft.has(id))stockDraft.set(id,{value:String(a.stock),expectedStock:a.stock,expectedRevision:a.stockRevision,dirty:false,operationId:uid()});
  return stockDraft.get(id);
}
async function saveStock(a){
  const draft=stockDraft.get(a.id);if(!draft?.dirty||!writable())return;
  try{
    const stock=quantity(draft.value,'Stock total');busy++;updateStatus();
    try{await store.perform(a.id,{type:'count',stock,expectedStock:draft.expectedStock,expectedRevision:draft.expectedRevision,reason:'Saisie directe du stock total'},draft.operationId);stockDraft.delete(a.id);notify(`${a.name} : total de ${stock} enregistré.`);}
    finally{busy--;render();}
  }catch(error){notify(friendlyError(error)+' Pour annuler la saisie, utilisez ↶ ou Échap.',true);}
}
function cancelStock(a){stockDraft.delete(a.id);render();}
$('inventory-body').addEventListener('focusin',event=>{if(event.target.dataset.stockId)beginStockDraft(event.target.dataset.stockId);});
$('inventory-body').addEventListener('focusout',event=>{const id=event.target.dataset.stockId;if(id&&!stockDraft.get(id)?.dirty)stockDraft.delete(id);});
$('inventory-body').addEventListener('input',event=>{
  const id=event.target.dataset.stockId;if(!id)return;
  const draft=beginStockDraft(id);if(!draft)return;
  draft.value=event.target.value;draft.dirty=true;draft.operationId=uid();
  const row=event.target.closest('tr');row.querySelector('[data-action="saveStock"]').hidden=false;
  row.querySelector('[data-action="cancelStock"]').hidden=false;row.querySelector('[data-stock-pending]').textContent=' · À valider';
});
$('inventory-body').addEventListener('keydown',event=>{
  const id=event.target.dataset.stockId,a=current(id);if(!a)return;
  if(event.key==='Enter'){event.preventDefault();saveStock(a);}
  if(event.key==='Escape'){event.preventDefault();cancelStock(a);}
});
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-action]');if(!b||b.disabled)return;const a=current(b.dataset.id);if(!a)return;
  if(['plus','minus','move','receive'].includes(b.dataset.action)&&stockDraft.get(a.id)?.dirty){notify('Validez d’abord le total saisi avec ✓, ou annulez avec ↶.',true);return;}
  const actions={detail:()=>showDetail(a),edit:()=>editArticle(a),move:()=>movement(a),plus:()=>quickMove(a,1),minus:()=>quickMove(a,-1),saveStock:()=>saveStock(a),cancelStock:()=>cancelStock(a),expiry:()=>editExpiry(a),lotExpiry:()=>editExpiry(a,b.dataset.lotId),lot:()=>addLot(a),archive:()=>archive(a),delete:()=>deleteArticle(a),order:()=>order(a),receive:()=>receive(a)};
  actions[b.dataset.action]?.();
});

function saveCountDraft(){
  if(!authUser)return;
  try{sessionStorage.setItem('crbo-count-'+authUser.uid,JSON.stringify({active:countMode,items:[...countDraft]}));}catch{notify('Le brouillon ne peut pas être conservé sur cet appareil. Gardez la page ouverte.',true);}
}
function restoreCountDraft(){
  try{const saved=JSON.parse(sessionStorage.getItem('crbo-count-'+authUser.uid)||'null');if(saved && Array.isArray(saved.items)){countMode=saved.active===true;countDraft=new Map(saved.items.filter(([id,d])=>typeof id==='string'&&d&&typeof d.value==='string'));}}catch{}
}
$('inventory-body').addEventListener('input',event=>{
  const id=event.target.dataset.countId;if(!id)return;const a=current(id);if(!a)return;
  if(event.target.value==='')countDraft.delete(id);
  else{const existing=countDraft.get(id);countDraft.set(id,{value:event.target.value,expectedStock:existing?.expectedStock??a.stock,expectedRevision:existing?.expectedRevision??a.stockRevision});}
  saveCountDraft();$('count-progress').textContent=`${countDraft.size} saisie${countDraft.size>1?'s':''} (100 maximum par validation)`;updateStatus();
});
$('count-mode').addEventListener('click',()=>{if([...stockDraft.values()].some(d=>d.dirty)){notify('Validez ou annulez les totaux saisis avant de démarrer le comptage.',true);return;}countMode=true;filter='all';$('filter').value=filter;saveCountDraft();render();$('count-panel').scrollIntoView({behavior:'smooth',block:'center'});});
$('clear-count').addEventListener('click',()=>{if(countDraft.size&&!confirm('Terminer et abandonner les quantités non validées ?'))return;countMode=false;countDraft.clear();saveCountDraft();render();});
$('validate-count').addEventListener('click',()=>{
  try{
    const items=[...countDraft].map(([id,draft])=>({id,operation:{type:'count',stock:quantity(draft.value),expectedStock:draft.expectedStock,expectedRevision:draft.expectedRevision}}));
    if(!items.length)return;
    if(items.length>100)throw new Error('Pour garantir une validation complète, limitez une série à 100 articles. Retirez quelques saisies puis validez.');
    const changed=items.filter(item=>item.operation.stock!==item.operation.expectedStock);
    const stale=items.filter(item=>{const a=current(item.id);return !a || !a.active || item.operation.expectedStock!==a.stock || item.operation.expectedRevision!==a.stockRevision;});
    if(stale.length){
      openDialog('Stocks modifiés pendant le comptage',`<p>Ces articles ont changé depuis leur saisie. Rien n’a été enregistré. Effacez puis ressaisissez les quantités après vérification.</p><ul class="list">${stale.map(item=>`<li>${e(current(item.id)?.name||item.id)} — relevé initial : ${item.operation.expectedStock}, stock actuel : ${current(item.id)?.stock??'absent'}</li>`).join('')}</ul>`);return;
    }
    if(!changed.length){countDraft.clear();saveCountDraft();render();notify('Toutes les quantités correspondent déjà au stock. Aucune écriture nécessaire.');return;}
    openDialog('Valider le comptage',`<p>${changed.length} stock${changed.length>1?'s seront corrigés':' sera corrigé'}. La validation est complète ou annulée en entier en cas de conflit.</p><ul class="list">${changed.map(item=>`<li><strong>${e(current(item.id)?.name||item.id)}</strong> : ${item.operation.expectedStock} → ${item.operation.stock}</li>`).join('')}</ul>`,async(_,opId)=>{
      await store.performMany(changed,opId);for(const item of items)countDraft.delete(item.id);saveCountDraft();
    },'Confirmer les corrections');
  }catch(error){notify(friendlyError(error),true);}
});
function exportPDF(ordersOnly=false){
  try{
    const articles=ordersOnly?state.articles.filter(a=>a.active&&(a.stock<a.minStock||a.orderQuantity>0)):visibleArticles();
    pdfTable(ordersOnly?'Articles à recommander':'Inventaire de la réserve',ordersOnly?['Article','Stock','Minimum','Souhaité','Commandé','À commander']:['Article','Catégorie','Stock','Min. / souhaité','Péremption'],articles.map(a=>ordersOnly?[a.name,a.stock,a.minStock,a.targetStock,a.orderQuantity,orderNeed(a)]:[a.name,categoryLabel(a.category),a.stockValid?`${a.stock} ${a.unit}`:'À vérifier',`${a.minStock} / ${a.targetStock}`,expiries(a).map(p=>`${p.lot?p.lot+' : ':''}${p.key==='none'?'Sans péremption':formatDate(p.date)}${p.quantity?' ('+p.quantity+')':''}`).join('\n')]),`${ordersOnly?'articles-a-recommander':'inventaire'}-${todayISO()}.pdf`);
  }catch(error){notify(friendlyError(error),true);}
}
$('pdf').addEventListener('click',()=>exportPDF());
$('csv').addEventListener('click',()=>{
  const rows=[['Identifiant','Article','Catégorie','Stock','Unité','Minimum','Souhaité','À commander','Commandé','Péremption historique','Sans péremption','Codes-barres','Emplacement','Actif','Notes','Lots'],...visibleArticles().map(a=>[a.id,a.name,categoryLabel(a.category),a.stockValid?a.stock:'À vérifier',a.unit,a.minStock,a.targetStock,orderNeed(a),a.orderQuantity,a.expirationDate,a.noExpiration?'oui':'non',a.barcodes.join(' | '),a.location,a.active?'oui':'non',a.notes,JSON.stringify(a.lots)])];
  downloadFile(`inventaire-${todayISO()}.csv`,csvText(rows),'text/csv;charset=utf-8');
});
$('backup').addEventListener('click',()=>{
  const data={format:'crbo-inventory-backup-v2',exportedAt:new Date().toISOString(),source:'listing-44b2b/inventory',scope:'Articles et documents inventory uniquement. Historique conservé dans Firestore, non inclus dans cet export.',seed:SEED_ARTICLES,documents:[...state.records].map(([id,data])=>({id,data}))};
  downloadFile(`sauvegarde-articles-${todayISO()}.json`,JSON.stringify(data,null,2),'application/json');
  notify('Sauvegarde des articles téléchargée. L’historique reste dans la base.');
});
$('search').addEventListener('input',event=>{search=event.target.value;render();});
$('category').addEventListener('change',event=>{category=event.target.value;render();});
$('filter').addEventListener('change',event=>{filter=event.target.value;render();});
$('dashboard').addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(!button)return;filter=button.dataset.filter;$('filter').value=filter;render();});
$('expand').addEventListener('click',()=>{categories().forEach(c=>expanded.add(c));render();});
$('collapse').addEventListener('click',()=>{expanded.clear();search='';category='';filter='all';$('search').value='';$('category').value='';$('filter').value='all';render();});
$('inventory-body').addEventListener('click',event=>{const b=event.target.closest('[data-category]');if(!b)return;expanded.has(b.dataset.category)?expanded.delete(b.dataset.category):expanded.add(b.dataset.category);render();});
$('new-article').addEventListener('click',()=>editArticle());
$('orders').addEventListener('click',showOrders);$('history').addEventListener('click',showHistory);$('last-update').addEventListener('click',showHistory);
const exportMenu=document.querySelector('.export-menu');
function positionExportMenu(){
  if(!exportMenu.open)return;
  const popup=exportMenu.querySelector('div'),anchor=exportMenu.getBoundingClientRect();
  popup.style.right='auto';popup.style.left=`${Math.max(8,Math.min(anchor.left,window.innerWidth-popup.offsetWidth-8))-anchor.left}px`;
}
exportMenu.addEventListener('toggle',positionExportMenu);window.addEventListener('resize',positionExportMenu);
window.addEventListener('online',()=>render());window.addEventListener('offline',()=>render());
window.addEventListener('beforeunload',event=>{if(busy||formDirty||[...stockDraft.values()].some(d=>d.dirty)){event.preventDefault();event.returnValue='';}});
let initialNavigationDone=false;
function initialNavigation(){
  if(initialNavigationDone||!state.ready)return;initialNavigationDone=true;
  const params=new URLSearchParams(location.search),id=params.get('article'),barcode=params.get('barcode'),newBarcode=params.get('newBarcode');
  const reveal=a=>{filter=a.active?'all':'archived';category=a.category;expanded.add(a.category);highlighted=a.id;$('filter').value=filter;render();document.querySelector(`[data-row-id="${CSS.escape(a.id)}"]`)?.scrollIntoView({block:'center'});showDetail(a);};
  if(id&&current(id))reveal(current(id));
  else if(newBarcode){editArticle(null,newBarcode.slice(0,160));}
  else if(barcode){const matches=barcodeMatches(state.articles,barcode);if(matches.length===1)reveal(matches[0]);else if(matches.length>1)openDialog('Plusieurs articles pour ce code',`<p>Les associations existantes sont conservées. Choisissez l’article voulu.</p><ul class="list">${matches.map(a=>`<li>${actionButton('detail',a.id,a.name)}</li>`).join('')}</ul>`);else notify('Aucun article ne correspond à ce code.',true);}
  else if(params.get('category')){category=params.get('category');render();}
}

async function start(){
  try{
    const client=await import('./firebase-client.js?v=4');store=client.store;
    store.subscribe(next=>{state=next;render();initialNavigation();});
    client.watchAuth(user=>{
      unsubscribeInventory();unsubscribeLast();stockDraft.clear();authUser=user;
      if(!user){state={articles:[],records:new Map(),ready:false,online:false};countDraft.clear();$('inventory-body').innerHTML='<tr><td colspan="5" class="empty">Connectez-vous depuis l’accueil avec votre compte staff.</td></tr>';$('global-error').innerHTML='Session staff requise. <a href="../index.html">Revenir à l’accueil pour se connecter</a>';$('global-error').hidden=false;$('user-label').textContent='';if($('editor').open)$('editor').close();updateStatus();return;}
      $('user-label').textContent=user.email||'Session staff';$('global-error').hidden=true;countDraft.clear();countMode=false;restoreCountDraft();updateStatus();
      unsubscribeInventory=store.start(showError);
      unsubscribeLast=store.lastUpdate(data=>{$('last-update').textContent=data?`Dernière modification : ${data.articleName||data.articleId||'Article'} — ${data.action||'Modification'}${data.newStock!==undefined?' · Stock : '+data.newStock:''} · ${data.userEmail||''} · ${data.date?.toDate?data.date.toDate().toLocaleString('fr-BE',{timeZone:'Europe/Brussels'}):''}`:'Aucune modification enregistrée.';},error=>{$('last-update').textContent='Historique de dernière modification indisponible.';console.warn(error.code);});
    });
  }catch(error){showError(new Error('Impossible de charger la connexion Firebase. Vérifiez votre réseau, puis rechargez la page.'));console.error(error);}
}
start();
