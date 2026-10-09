import { REQUEST_API, URGENCY_LABELS } from '../material-request-config.js';
import { escapeHTML as e } from './inventory-ui.js';

export function setupMaterialRequests({articles,notify}){
  const button=document.getElementById('material-requests'),dialog=document.getElementById('requests-dialog'),list=document.getElementById('requests-list'),status=document.getElementById('requests-status'),pushButton=document.getElementById('requests-push');
  let user=null,authorized=false,rows=[],publicKey='',timer,loading=false,generation=0,busy=false,autoOpened=false;
  const isOwner=u=>Boolean(u&&u===user&&authorized);
  async function api(method='GET',body,as=user){
    if(!as)throw new Error('Connexion nécessaire.');
    const token=await as.getIdToken();const response=await fetch(REQUEST_API,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok){const error=new Error(data.error||'Demandes indisponibles.');error.status=response.status;throw error;}return data;
  }
  function render(){
    button.textContent=`Demandes (${rows.length})`;button.classList.toggle('request-urgent',rows.some(r=>r.urgency==='urgent'));button.classList.toggle('request-important',!rows.some(r=>r.urgency==='urgent')&&rows.some(r=>r.urgency==='important'));
    const options=articles().filter(a=>a.active).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    list.innerHTML=rows.length?rows.map(r=>`<article class="material-request ${e(r.urgency)}"><div class="request-heading"><strong>${e(r.name)}</strong><span class="request-urgency">${e(URGENCY_LABELS[r.urgency]||r.urgency)}</span></div><time datetime="${new Date(r.created_at).toISOString()}">${e(new Date(r.created_at).toLocaleString('fr-BE',{timeZone:'Europe/Brussels'}))}</time><p class="request-text">${e(r.material)}</p>${r.comment?`<p class="request-comment">${e(r.comment)}</p>`:''}<label>Article de l’inventaire (facultatif)<select data-request-article="${e(r.id)}" ${busy?'disabled':''}><option value="">Choisir un article…</option>${options.map(a=>`<option value="${e(a.id)}" ${r.article_id===a.id?'selected':''}>${e(a.name)}</option>`).join('')}</select></label>${r.article_id?`<a class="text-button" href="inventaire.html?article=${encodeURIComponent(r.article_id)}">Ouvrir la fiche de l’article</a>`:''}<label class="checkbox-label"><input type="checkbox" data-request-complete="${e(r.id)}" ${busy?'disabled':''}>Réapprovisionné</label></article>`).join(''):'<p class="empty">Aucune demande à traiter.</p>';
  }
  async function refresh(){
    if(!user||loading)return;loading=true;const g=generation;
    try{const data=await api();if(g!==generation)return;const first=!authorized;authorized=true;rows=data.requests;publicKey=data.publicKey;button.hidden=false;button.disabled=false;status.textContent='';render();if(first)pushState();if(!autoOpened&&new URLSearchParams(location.search).get('demandes')==='1'){autoOpened=true;dialog.showModal();}}
    catch(error){if(g===generation){status.textContent=error.message;if(error.status===403){authorized=false;button.hidden=true;if(dialog.open)dialog.close();}else if(authorized){button.textContent='Demandes — indisponibles';button.disabled=false;}}}
    finally{if(g===generation)loading=false;}
  }
  button.addEventListener('click',()=>{if(!isOwner(user))return;render();dialog.showModal();refresh();});
  document.getElementById('requests-close').addEventListener('click',()=>dialog.close());
  document.getElementById('requests-refresh').addEventListener('click',refresh);
  list.addEventListener('change',async event=>{
    const target=event.target,id=target.dataset.requestComplete||target.dataset.requestArticle;if(!id||busy)return;
    const completed=Boolean(target.dataset.requestComplete);
    busy=true;render();status.textContent='Enregistrement…';
    try{await api('PATCH',completed?{id,completed:true}:{id,articleId:target.value});if(completed)rows=rows.filter(r=>r.id!==id);else rows=rows.map(r=>r.id===id?{...r,article_id:target.value}:r);status.textContent='';notify(completed?'Réapprovisionnement confirmé.':'Article associé.');}
    catch(error){status.textContent=error.message;}
    finally{busy=false;render();}
  });
  async function registration(){return navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname});}
  async function pushState(){
    if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){pushButton.disabled=true;pushButton.textContent='Sur iPhone : ouvrez CRBO depuis l’écran d’accueil pour activer les notifications.';return;}
    try{const reg=await registration();await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();pushButton.textContent=sub?'Désactiver les notifications sur cet appareil':'Activer les notifications sur cet appareil';}catch{pushButton.textContent='Notifications indisponibles sur cet appareil';}
  }
  pushButton.addEventListener('click',async()=>{
    if(!isOwner(user))return;pushButton.disabled=true;
    try{
      const reg=await registration();await navigator.serviceWorker.ready;const previous=await reg.pushManager.getSubscription();
      if(previous){await api('DELETE',{subscription:previous.toJSON()});await previous.unsubscribe();notify('Notifications désactivées sur cet appareil.');}
      else{
        if(!publicKey){await refresh();if(!publicKey)throw new Error('Notifications momentanément indisponibles.');}
        if(await Notification.requestPermission()!=='granted')throw new Error('Autorisez les notifications dans les réglages du navigateur. Sur iPhone, utilisez CRBO installé sur l’écran d’accueil.');
        const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-publicKey.length%4)%4)),c=>c.charCodeAt(0));
        const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
        try{await api('POST',{action:'subscribe',subscription:sub.toJSON()});}catch(error){await sub.unsubscribe();throw error;}
        notify('Notifications activées sur cet appareil.');
      }
    }catch(error){status.textContent=error.message;}
    finally{pushButton.disabled=false;await pushState();}
  });
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  return {setUser(next){
    const previous=user;
    if(isOwner(previous)&&previous?.uid!==next?.uid&&'serviceWorker'in navigator){
      registration().then(async reg=>{const sub=await reg.pushManager.getSubscription();if(sub){try{await api('DELETE',{subscription:sub.toJSON()},previous);}finally{await sub.unsubscribe();}}}).catch(()=>{});
    }
    generation++;loading=false;clearInterval(timer);user=next;authorized=false;rows=[];publicKey='';button.hidden=true;button.disabled=true;if(dialog.open)dialog.close();if(next){refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},60000);}else render();
  }};
}
