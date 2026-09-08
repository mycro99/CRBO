import { barcodeMatches, categoryLabel } from './inventory-core.js';
import { escapeHTML as e, friendlyError } from './inventory-ui.js';
import { BarcodeCamera, cameraError } from './barcode-camera.js';
const $=id=>document.getElementById(id), camera=new BarcodeCamera('reader');
let articles=[],ready=false,online=false,user=null,torch=false,busy=false,stopListening=()=>{};
function controls(){
  $('start').disabled=!ready||!user||busy||camera.running;
  $('search-code').disabled=!ready||!user||busy;
  $('stop').hidden=!camera.running&&!busy;
  $('torch').hidden=!camera.running;
}
async function stop(){await camera.stop();busy=false;torch=false;controls();}
async function lookup(raw){
  if(!ready||!user)return;
  await stop();$('manual-code').value=raw;
  const matches=barcodeMatches(articles,raw);$('results').hidden=false;
  if(matches.length===1){
    $('scan-status').textContent='Article trouvé. Ouverture de l’inventaire…';
    location.href='inventaire.html?article='+encodeURIComponent(matches[0].id);return;
  }
  if(matches.length>1){
    $('scan-status').textContent='Ce code est associé à plusieurs articles.';
    $('results').innerHTML='<h2>Quel article souhaitez-vous ouvrir ?</h2><p class="muted">Les associations existantes sont conservées. Aucun stock n’a été modifié.</p><ul class="list">'+matches.map(a=>`<li><h3>${e(a.name)}</h3><p>${e(categoryLabel(a.category))} · Stock : ${a.stockValid?a.stock:'à vérifier'}</p><a class="button" href="inventaire.html?article=${encodeURIComponent(a.id)}">Ouvrir cet article</a></li>`).join('')+'</ul>';
  }else{
    $('scan-status').textContent='Aucun article actif ne correspond à ce code.';
    $('results').innerHTML=`<h2>Code inconnu</h2><p class="detail-notes">${e(raw)}</p><p>Vous pouvez créer une fiche ou ajouter ce code à une fiche existante depuis l’inventaire.</p>${online&&navigator.onLine?`<a class="button primary" href="inventaire.html?newBarcode=${encodeURIComponent(raw.slice(0,160))}">Créer un article avec ce code</a>`:'<p class="notice warning">Reconnectez-vous avant de créer un article : le catalogue affiché peut ne pas être à jour.</p>'}<p style="margin-top:16px"><a href="inventaire.html">Chercher un article existant</a></p>`;
  }
}
$('start').addEventListener('click',async()=>{
  busy=true;controls();$('results').hidden=true;$('scan-status').textContent='Autorisez la caméra puis placez le code dans le cadre.';
  try{await camera.start(lookup);}
  catch(error){$('scan-status').textContent=cameraError(error);}
  finally{busy=false;controls();}
});
$('stop').addEventListener('click',async()=>{await stop();$('scan-status').textContent='Caméra arrêtée. Vous pouvez reprendre le scan ou saisir un code.';});
$('torch').addEventListener('click',async()=>{if(await camera.torch(!torch)){torch=!torch;$('torch').textContent=torch?'Éteindre la lampe':'Activer la lampe';}else $('scan-status').textContent='La lampe n’est pas disponible sur cette caméra ou ce navigateur.';});
$('manual-form').addEventListener('submit',event=>{event.preventDefault();const value=$('manual-code').value.trim();if(value)lookup(value);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
window.addEventListener('offline',()=>{$('catalog-status').textContent='Hors connexion — le catalogue peut ne pas être à jour.';});
async function start(){
  try{
    const client=await import('./firebase-client.js');
    client.store.subscribe(state=>{articles=state.articles;ready=state.ready;online=state.online;$('catalog-status').textContent=ready?`${articles.filter(a=>a.active).length} articles · ${online?'catalogue synchronisé':'consultation hors connexion'}`:'Chargement du catalogue…';controls();});
    client.watchAuth(next=>{stopListening();user=next;if(!user){ready=false;articles=[];stop();$('catalog-status').innerHTML='Connectez-vous avec votre compte staff. <a href="../index.html">Retour à l’accueil</a>';controls();return;}
      stopListening=client.store.start(error=>{online=false;$('catalog-status').textContent=friendlyError(error);controls();});
    });
  }catch(error){$('catalog-status').textContent='Impossible de charger le catalogue. Vérifiez la connexion et rechargez la page.';console.error(error);}
}
start();
