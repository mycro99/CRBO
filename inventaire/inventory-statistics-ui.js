import {annualStatistics,prepareStatisticsHistory,rankArticles} from './inventory-statistics.js?v=1';
import {categoryLabel,fold,todayISO,formatDate} from './inventory-core.js?v=annual-1';
import {escapeHTML as e,friendlyError,csvText,downloadFile} from './inventory-ui.js';

export function setupInventoryStatistics({getStore,getArticles,getUser}) {
  const button=document.getElementById('statistics');
  if(!button) return {setUser(){}};
  const dialog=document.getElementById('statistics-dialog'), $=id=>document.getElementById(id);
  const labels={consumed:'Sorties de réserve',ordered:'Quantités commandées',received:'Réceptions',entries:'Autres entrées',correctionAdded:'Corrections en hausse',correctionRemoved:'Corrections en baisse'};
  const integer=new Intl.NumberFormat('fr-BE');
  let owner='',generation=0,controller,prepared=null,loadedAt='',model=null,visible=[];
  const currentYear=()=>Number(todayISO().slice(0,4));
  function invalidate() {
    generation++;controller?.abort();prepared=null;model=null;visible=[];loadedAt='';
    $('statistics-content').hidden=true;$('statistics-status').textContent='';
    for(const id of ['statistics-summary','statistics-coverage','statistics-rankings','statistics-results','statistics-body','statistics-year'])$(id).replaceChildren();
    $('statistics-search').value='';
    if(dialog.open)dialog.close();
  }
  function setUser(user) {
    if(owner!==(user?.uid||'')){invalidate();owner=user?.uid||'';}
  }
  function close(){controller?.abort();generation++;$('statistics-refresh').disabled=false;dialog.close();}
  $('statistics-close').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  button.addEventListener('click',()=>{
    if(!getUser())return;
    dialog.showModal();
    if(prepared)render();else load();
  });
  async function load() {
    controller?.abort();controller=new AbortController();
    const token=++generation,uid=getUser()?.uid;
    $('statistics-content').hidden=true;$('statistics-status').textContent='Lecture de l’historique conservé…';
    $('statistics-refresh').disabled=true;
    try {
      if(!uid)throw new Error('Connexion staff requise.');
      const history=await getStore().statisticsHistory({signal:controller.signal,onProgress:count=>{
        if(token===generation)$('statistics-status').textContent=`Lecture de l’historique : ${integer.format(count)} opérations…`;
      }});
      if(token!==generation || getUser()?.uid!==uid || !dialog.open)return;
      prepared=prepareStatisticsHistory(history);
      loadedAt=new Date().toLocaleString('fr-BE',{timeZone:'Europe/Brussels'});
      const selected=Number($('statistics-year').value)||currentYear();
      const years=[...new Set([currentYear(),...prepared.years])].sort((a,b)=>b-a);
      $('statistics-year').innerHTML=years.map(year=>`<option value="${year}">${year}</option>`).join('');
      $('statistics-year').value=years.includes(selected)?selected:currentYear();
      $('statistics-category').value='';$('statistics-unit').value='';
      render(true);
    } catch(error) {
      if(token===generation && error.name!=='AbortError'){
        $('statistics-status').textContent='Statistiques indisponibles : '+friendlyError(error);
        $('statistics-content').hidden=true;
      }
    } finally {if(token===generation)$('statistics-refresh').disabled=false;}
  }
  $('statistics-refresh').addEventListener('click',load);
  $('statistics-year').addEventListener('change',()=>render(true));
  for(const id of ['statistics-category','statistics-unit','statistics-search','statistics-metric','statistics-direction'])$(id).addEventListener(id==='statistics-search'?'input':'change',()=>render());
  function amount(row,metric) {
    const value=integer.format(row[metric]);
    return metric==='ordered' && row.uncertainOrders ? `${value} + ?` : value;
  }
  function ranking(title,metric,direction) {
    const rows=rankArticles(visible,metric,direction);
    return `<section class="statistics-ranking"><h3>${e(title)}</h3>${rows.length?`<ol>${rows.map(row=>`<li><span>${e(row.name)}</span><strong>${e(amount(row,metric))} <small>${e(row.unit)}</small></strong></li>`).join('')}</ol>`:'<p class="muted">Aucune quantité calculable dans cette sélection.</p>'}</section>`;
  }
  function render(resetFilters=false) {
    if(!prepared || !getUser() || !dialog.open)return;
    model=annualStatistics(prepared,getArticles(),Number($('statistics-year').value)||currentYear(),currentYear());
    if(resetFilters) {
      $('statistics-category').innerHTML='<option value="">Toutes les catégories</option>'+[...new Set(model.rows.map(row=>row.category))].sort((a,b)=>categoryLabel(a).localeCompare(categoryLabel(b),'fr')).map(value=>`<option value="${e(value)}">${e(categoryLabel(value))}</option>`).join('');
      $('statistics-unit').innerHTML='<option value="">Toutes les unités</option>'+[...new Set(model.rows.map(row=>row.unit))].sort((a,b)=>a.localeCompare(b,'fr')).map(value=>`<option value="${e(value)}">${e(value)}</option>`).join('');
    }
    const search=fold($('statistics-search').value.trim()),category=$('statistics-category').value,unit=$('statistics-unit').value;
    visible=model.rows.filter(row=>(!category || row.category===category)&&(!unit || row.unit===unit)&&(!search || fold(row.name+' '+categoryLabel(row.category)).includes(search)));
    const metric=Object.hasOwn(labels,$('statistics-metric').value)?$('statistics-metric').value:'consumed';
    const ascending=$('statistics-direction').value==='asc';
    visible.sort((a,b)=>(ascending?1:-1)*(a[metric]-b[metric]) || a.name.localeCompare(b.name,'fr'));
    $('statistics-status').textContent=`${integer.format(prepared.dated.length)} opérations datées chargées · actualisé le ${loadedAt}.`;
    $('statistics-content').hidden=false;
    $('statistics-summary').innerHTML=[
      ['Opérations de l’année',model.operations],['Articles avec une sortie',model.rows.filter(row=>row.consumed>0).length],
      ['Articles avec commande enregistrée',model.rows.filter(row=>row.orderEvents>0).length],['Articles sans opération enregistrée',model.rows.filter(row=>row.operations===0).length]
    ].map(([label,value])=>`<div><span>${e(label)}</span><strong>${integer.format(value)}</strong></div>`).join('');
    const warnings=[];
    if(model.firstDay)warnings.push(`Données datées de l’année : du ${formatDate(model.firstDay)} au ${formatDate(model.lastDay)}.`);
    else warnings.push(`Aucune opération datée conservée pour ${model.year}.`);
    warnings.push('Calcul sur l’historique conservé uniquement : les périodes supprimées auparavant ne peuvent pas être reconstituées.');
    if(model.uncertainOrders)warnings.push(`${integer.format(model.uncertainOrders)} ancien(s) solde(s) de commande sans quantité précédente : « + ? » indique une quantité commandée non reconstituable.`);
    if(model.unknown)warnings.push(`${integer.format(model.unknown)} opération(s) de l’année sans quantité exploitable : exclues des totaux.`);
    if(model.undated)warnings.push(`${integer.format(model.undated)} entrée(s) sans date valide : exclues des statistiques annuelles.`);
    if(model.rows.some(row=>row.unitChanged))warnings.push('Unité modifiée : les articles marqués † sont exclus des classements, car leurs anciennes quantités ne sont pas directement comparables.');
    $('statistics-coverage').textContent=warnings.join(' ');
    $('statistics-rankings').innerHTML=ranking('Les plus commandés','ordered','desc')+ranking('Les moins commandés · hors zéro','ordered','asc')+ranking('Les plus sortis','consumed','desc')+ranking('Les moins sortis · hors zéro','consumed','asc');
    $('statistics-results').textContent=`${integer.format(visible.length)} article(s) · tri : ${labels[metric]}, ${ascending?'croissant':'décroissant'}.`;
    $('statistics-body').innerHTML=visible.length?visible.map(row=>`<tr><th scope="row">${e(row.name)}${row.unitChanged?' †':''}<small>${e(categoryLabel(row.category))} · ${e(row.unit)}${row.deleted?' · Supprimé':!row.active?' · Archivé':''}${row.operations===0?' · Aucune opération enregistrée':''}</small></th><td>${e(amount(row,'ordered'))}</td><td>${e(amount(row,'cancelled'))}</td><td>${e(amount(row,'received'))}</td><td>${e(amount(row,'entries'))}</td><td><strong>${e(amount(row,'consumed'))}</strong></td><td>+${e(amount(row,'correctionAdded'))} / −${e(amount(row,'correctionRemoved'))}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">Aucun article dans cette sélection.</td></tr>';
  }
  $('statistics-csv').addEventListener('click',()=>{
    if(!model || !getUser())return;
    const rows=[['Année','Article','Catégorie','Unité actuelle','Commandé calculable','Commandes non reconstituables','Annulé','Reçu','Autres entrées','Sorties','Corrections +','Corrections -','Opérations','Unité modifiée'],...visible.map(row=>[model.year,row.name,categoryLabel(row.category),row.unit,row.ordered,row.uncertainOrders,row.cancelled,row.received,row.entries,row.consumed,row.correctionAdded,row.correctionRemoved,row.operations,row.unitChanged?'oui':'non'])];
    downloadFile(`statistiques-inventaire-${model.year}.csv`,csvText(rows),'text/csv;charset=utf-8');
  });
  return {setUser};
}
