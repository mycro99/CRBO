import {escapeHTML as e} from './inventory-ui.js';
const integer=new Intl.NumberFormat('fr-BE');
const months=['Jan.','Fév.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
const series=[{key:'ordered',label:'Commandes',className:'orders'},{key:'consumed',label:'Sorties',className:'outputs'},{key:'received',label:'Réceptions',className:'receipts'}];
export function rankingBars(title,rows,metric,direction) {
  const maximum=Math.max(0,...rows.map(row=>row[metric]));
  const className=metric==='ordered'?'orders':'outputs';
  return `<section class="statistics-ranking chart-card ${className}"><div class="chart-heading"><span class="chart-kicker">${direction==='asc'?'LES MOINS · HORS ZÉRO':'LES PLUS'}</span><h3>${e(title)}</h3></div>${rows.length?`<ol class="ranking-bars">${rows.map((row,index)=>{
    const quantity=integer.format(row[metric])+(metric==='ordered' && row.uncertainOrders?' + ?':'');
    const percentage=maximum>0?Math.max(0,Math.min(100,row[metric]/maximum*100)):0;
    return `<li><span class="chart-rank" aria-hidden="true">${index+1}</span><div class="ranking-detail"><div class="ranking-label"><span>${e(row.name)}</span><strong>${e(quantity)} <small>${e(row.unit)}</small></strong></div><div class="ranking-track" aria-hidden="true"><span style="width:${percentage.toFixed(2)}%"></span></div></div></li>`;
  }).join('')}</ol>`:'<div class="chart-empty"><span aria-hidden="true">—</span><p>Aucune quantité calculable dans cette sélection.</p></div>'}</section>`;
}
export function monthlyActivity(rows) {
  return months.map((label,index)=>({label,...Object.fromEntries(series.map(({key})=>[key,rows.reduce((sum,row)=>sum+(row.months?.[index]?.[key]||0),0)]))}));
}
export function monthlyChart(rows,year) {
  const data=monthlyActivity(rows),maximum=Math.max(0,...data.flatMap(month=>series.map(({key})=>month[key])));
  const total=data.reduce((sum,month)=>sum+series.reduce((n,{key})=>n+month[key],0),0);
  return `<section class="chart-card monthly-card" aria-labelledby="statistics-monthly-title"><div class="monthly-heading"><div><span class="chart-kicker">RYTHME DE LA RÉSERVE · ${e(year)}</span><h3 id="statistics-monthly-title">L’activité au fil des mois</h3><p class="muted">Nombre d’opérations calculables : une commande, une sortie ou une réception vaut 1, quelle que soit sa quantité.</p></div><div class="chart-legend">${series.map(s=>`<span><i class="${s.className}" aria-hidden="true"></i>${s.label}</span>`).join('')}</div></div>${total?`<div class="monthly-scroll"><div class="monthly-plot" aria-hidden="true"><div class="monthly-scale"><span>${integer.format(maximum)}</span><span>0</span></div>${data.map(month=>`<div class="monthly-column"><div class="monthly-bars">${series.map(s=>`<div class="monthly-bar ${s.className}" style="height:${(maximum?month[s.key]/maximum*100:0).toFixed(2)}%" title="${month.label} — ${s.label} : ${integer.format(month[s.key])}"></div>`).join('')}</div><span class="month-label">${month.label}</span></div>`).join('')}</div></div>`:'<p class="chart-no-activity">Aucune commande, sortie ou réception calculable pour cette sélection.</p>'}<details class="monthly-values"><summary>Voir les chiffres mois par mois</summary><div class="statistics-table-wrap"><table class="statistics-table monthly-table"><caption>Nombre d’opérations enregistrées par mois — ${e(year)}</caption><thead><tr><th scope="col">Mois</th>${series.map(s=>`<th scope="col">${s.label}</th>`).join('')}</tr></thead><tbody>${data.map(month=>`<tr><th scope="row">${month.label}</th>${series.map(s=>`<td>${integer.format(month[s.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></section>`;
}
