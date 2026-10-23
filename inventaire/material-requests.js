import { REQUEST_API, URGENCY_LABELS } from '../material-request-config.js';
import { escapeHTML as e } from './inventory-ui.js';
import { formatMissionNumber, treatmentYear } from './request-format.js';

export function setupMaterialRequests({articles,notify}){
  const button=document.getElementById('material-requests'),dialog=document.getElementById('requests-dialog'),list=document.getElementById('requests-list'),status=document.getElementById('requests-status'),pushButton=document.getElementById('requests-push');
  const deaButton=document.getElementById('dea-requests-button'),deaDialog=document.getElementById('dea-requests-dialog'),deaList=document.getElementById('dea-requests-list'),deaStatus=document.getElementById('dea-requests-status');
  const pendingTab=document.getElementById('dea-pending-tab'),historyTab=document.getElementById('dea-history-tab'),yearSelect=document.getElementById('dea-history-year'),historyList=document.getElementById('dea-history-list');
  let history=[],historyYears=[],historyYear=treatmentYear(Date.now()),deaTab='pending';
  const testPushButton=document.getElementById('requests-test-push');
  let user=null,authorized=false,rows=[],publicKey='',timer,loading=false,generation=0,busy=false,autoOpened=false;
  const isOwner=u=>Boolean(u&&u===user&&authorized);
  async function api(method='GET',body,as=user){
    if(!as)throw new Error('Connexion nécessaire.');
    const token=await as.getIdToken();const response=await fetch(method==='GET'?REQUEST_API+'?deaYear='+historyYear:REQUEST_API,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok){const error=new Error(data.error||'Demandes indisponibles.');error.status=response.status;throw error;}return data;
  }
  function render(){
    const materialRows=rows.filter(r=>r.request_type!=='dea'),deaRows=rows.filter(r=>r.request_type==='dea');
    deaButton.hidden=!authorized;deaButton.disabled=!authorized;deaButton.textContent=`DEA (${deaRows.length})`;
    pendingTab.textContent=`À traiter (${deaRows.length})`;historyTab.textContent=`Traitées (${historyYears.reduce((sum,row)=>sum+row.count,0)})`;
    pendingTab.setAttribute('aria-pressed',String(deaTab==='pending'));historyTab.setAttribute('aria-pressed',String(deaTab==='history'));
    document.getElementById('dea-pending-panel').hidden=deaTab!=='pending';document.getElementById('dea-history-panel').hidden=deaTab!=='history';
    const years=[...new Set([historyYear,treatmentYear(Date.now()),...historyYears.map(row=>row.year)])].sort((a,b)=>b-a);
    yearSelect.innerHTML=years.map(year=>`<option value="${year}" ${year===historyYear?'selected':''}>${year}</option>`).join('');yearSelect.value=String(historyYear);yearSelect.disabled=busy||loading;
    const count=historyYears.find(row=>row.year===historyYear)?.count||0;
    document.getElementById('dea-history-count').textContent=`${historyYear} : ${count} demande${count>1?'s':''} traitée${count>1?'s':''}`;
    historyList.innerHTML=history.length?history.map(r=>`<li>${e((r.intervention_date||'').split('-').reverse().join('/'))} / ${e(formatMissionNumber(r.mission_number))} / ${e(r.name)}</li>`).join(''):'<li class="empty">Aucune demande traitée pour cette année.</li>';
    deaList.innerHTML=deaRows.length?deaRows.map(r=>`<article class="material-request dea-request"><h3>Course 112 : ${e(formatMissionNumber(r.mission_number)||'—')}</h3><dl><dt>Date de l’intervention</dt><dd>${e((r.intervention_date||'').split('-').reverse().join('/'))}</dd><dt>Ambulanciers</dt><dd class="request-text">${e(r.name)}</dd></dl><time datetime="${new Date(r.created_at).toISOString()}">Demande reçue le ${e(new Date(r.created_at).toLocaleString('fr-BE',{timeZone:'Europe/Brussels'}))}</time><label class="checkbox-label"><input type="checkbox" data-request-complete="${e(r.id)}" ${busy||loading?'disabled':''}>Marquer comme traitée</label></article>`).join(''):'<p class="empty">Aucune demande de patchs DEA à traiter.</p>';
    button.textContent=`Demandes (${materialRows.length})`;button.classList.toggle('request-urgent',materialRows.some(r=>r.urgency==='urgent'));button.classList.toggle('request-important',!materialRows.some(r=>r.urgency==='urgent')&&materialRows.some(r=>r.urgency==='important'));
    const options=articles().filter(a=>a.active).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    list.innerHTML=materialRows.length?materialRows.map(r=>`<article class="material-request ${e(r.urgency)}"><div class="request-heading"><strong>${e(r.name)}</strong><span class="request-urgency">${e(URGENCY_LABELS[r.urgency]||r.urgency)}</span></div><time datetime="${new Date(r.created_at).toISOString()}">${e(new Date(r.created_at).toLocaleString('fr-BE',{timeZone:'Europe/Brussels'}))}</time><p class="request-text">${e(r.material)}</p>${r.comment?`<p class="request-comment">${e(r.comment)}</p>`:''}<label>Article de l’inventaire (facultatif)<select data-request-article="${e(r.id)}" ${busy||loading?'disabled':''}><option value="">Choisir un article…</option>${options.map(a=>`<option value="${e(a.id)}" ${r.article_id===a.id?'selected':''}>${e(a.name)}</option>`).join('')}</select></label>${r.article_id?`<a class="text-button" href="inventaire.html?article=${encodeURIComponent(r.article_id)}">Ouvrir la fiche de l’article</a>`:''}<label class="checkbox-label"><input type="checkbox" data-request-complete="${e(r.id)}" ${busy||loading?'disabled':''}>Réapprovisionné</label></article>`).join(''):'<p class="empty">Aucune demande à traiter.</p>';
  }
  async function refresh(){
    if(!user||loading||busy)return;loading=true;render();const g=generation;
    try{const data=await api();if(g!==generation)return;const first=!authorized;authorized=true;rows=data.requests;history=data.deaHistory||[];historyYears=data.deaHistoryYears||[];historyYear=data.deaHistoryYear||historyYear;publicKey=data.publicKey;button.hidden=false;button.disabled=false;status.textContent='';deaStatus.textContent='';render();if(first)pushState();if(!autoOpened){const target=new URLSearchParams(location.search).get('demandes');if(target==='1'){autoOpened=true;dialog.showModal();}else if(target==='dea'){autoOpened=true;deaTab='pending';render();deaDialog.showModal();}}}
    catch(error){if(g===generation){status.textContent=error.message;deaStatus.textContent=error.message;if(error.status===403){authorized=false;rows=[];history=[];historyYears=[];render();button.hidden=true;if(dialog.open)dialog.close();if(deaDialog.open)deaDialog.close();}else if(authorized){button.textContent='Demandes — indisponibles';button.disabled=false;}}}
    finally{if(g===generation){loading=false;render();}}
  }
  button.addEventListener('click',()=>{if(!isOwner(user))return;render();dialog.showModal();refresh();});
  document.getElementById('requests-close').addEventListener('click',()=>dialog.close());
  document.getElementById('requests-refresh').addEventListener('click',refresh);
  document.getElementById('dea-requests-refresh').addEventListener('click',refresh);
  deaButton.addEventListener('click',()=>{if(!isOwner(user))return;render();deaDialog.showModal();refresh();});
  document.getElementById('dea-requests-close').addEventListener('click',()=>deaDialog.close());
  pendingTab.addEventListener('click',()=>{deaTab='pending';render();});
  historyTab.addEventListener('click',()=>{deaTab='history';render();});
  yearSelect.addEventListener('change',()=>{if(loading||busy)return;historyYear=Number(yearSelect.value);history=[];render();refresh();});
  for(const requestList of [list,deaList])requestList.addEventListener('change',async event=>{
    if(!isOwner(user))return;
    const targetStatus=requestList===deaList?deaStatus:status;
    const target=event.target,id=target.dataset.requestComplete||target.dataset.requestArticle;if(!id||busy||loading)return;
    const completed=Boolean(target.dataset.requestComplete),dea=rows.some(r=>r.id===id&&r.request_type==='dea');
    let saved=false;busy=true;render();targetStatus.textContent='Enregistrement…';
    try{
      const result=await api('PATCH',completed?{id,completed:true}:{id,articleId:target.value});saved=true;
      if(completed){
        const row=rows.find(r=>r.id===id);
        if(dea&&row){
          const completedAt=result.completedAt||Date.now(),year=treatmentYear(completedAt);
          if(historyYear!==year){historyYear=year;history=[];}
          if(!history.some(r=>r.id===id))history=[{...row,completed_at:completedAt},...history];
          if(result.newlyCompleted!==false){const summary=historyYears.find(r=>r.year===year);historyYears=summary?historyYears.map(r=>r.year===year?{...r,count:r.count+1}:r):[...historyYears,{year,count:1}];}
        }
        rows=rows.filter(r=>r.id!==id);
      }else rows=rows.map(r=>r.id===id?{...r,article_id:target.value}:r);
      targetStatus.textContent='';notify(completed?(dea?'Demande ajoutée aux traitées.':'Réapprovisionnement confirmé.'):'Article associé.');
    }
    catch(error){targetStatus.textContent=error.message;}
    finally{busy=false;render();if(saved&&completed&&dea)refresh();}
  });
  async function registration(){return navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname});}
  async function pushState(){
    if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){pushButton.disabled=true;pushButton.textContent='Sur iPhone : ouvrez CRBO depuis l’écran d’accueil pour activer les notifications.';return;}
    try{const reg=await registration();await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();pushButton.textContent=sub?'Désactiver les notifications sur cet appareil':'Activer les notifications sur cet appareil';testPushButton.hidden=!sub;}catch{pushButton.textContent='Notifications indisponibles sur cet appareil';testPushButton.hidden=true;}
  }
  testPushButton.addEventListener('click',async()=>{
    if(!isOwner(user))return;testPushButton.disabled=true;status.textContent='Envoi de la notification de test…';
    try{const reg=await registration();await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(!sub)throw new Error('Activez les notifications sur cet appareil.');await api('POST',{action:'testPush',subscription:sub.toJSON()});status.textContent='Notification de test acceptée par le service de votre téléphone. Vérifiez son centre de notifications.';}
    catch(error){status.textContent=error.message;}finally{testPushButton.disabled=false;}
  });
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
    generation++;loading=false;clearInterval(timer);user=next;authorized=false;rows=[];history=[];historyYears=[];historyYear=treatmentYear(Date.now());deaTab='pending';publicKey='';button.hidden=true;button.disabled=true;if(dialog.open)dialog.close();if(deaDialog.open)deaDialog.close();deaStatus.textContent='';render();if(next){refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},60000);}else render();
  }};
}
