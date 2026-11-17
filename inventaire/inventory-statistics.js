// Annual statistics are derived in memory. Historical records are never rewritten.
const number = value => typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
const nonNegative = value => number(value) !== null && value >= 0 ? value : null;
const normalized = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const calendar = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'});
export function historyTime(value) {
  try {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && typeof value.toDate === 'function') return value.toDate().getTime();
    if (value && Number.isFinite(value.seconds ?? value._seconds)) return Number(value.seconds ?? value._seconds)*1000 + Number(value.nanoseconds ?? value._nanoseconds ?? 0)/1e6;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return Date.parse(value);
    return NaN;
  } catch { return NaN; }
}
export function historyDay(time) {
  if (!Number.isFinite(time)) return '';
  const date=new Date(time);
  if(!Number.isFinite(date.getTime()))return '';
  const parts=Object.fromEntries(calendar.formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function signedAction(action) {
  return /^[+-]\d+$/.test(String(action).trim()) ? number(Number(String(action).trim())) : null;
}
function stockDelta(h) {
  const old=nonNegative(h.oldStock), next=nonNegative(h.newStock);
  return old!==null && next!==null ? next-old : signedAction(h.action);
}
function orderBalance(h) {
  const structured=nonNegative(h.newOrderQuantity);
  if (structured!==null) return structured;
  const match=String(h.action ?? '').match(/^Commande en cours\s*:\s*(\d+)$/i);
  if (match) return nonNegative(Number(match[1]));
  return /^Commande cl[oô]tur[eé]e$/i.test(String(h.action ?? '').trim()) ? 0 : null;
}
export function prepareStatisticsHistory(entries) {
  const ids=new Set(), dated=[];
  let undated=0, duplicates=0;
  for (const entry of entries) {
    if (!entry || typeof entry!=='object') { undated++; continue; }
    if (entry.id && ids.has(entry.id)) { duplicates++; continue; }
    if (entry.id) ids.add(entry.id);
    const time=historyTime(entry.date), day=historyDay(time);
    if (!day) { undated++; continue; }
    dated.push({entry,time,day,year:Number(day.slice(0,4))});
  }
  dated.sort((a,b)=>a.time-b.time || String(a.entry.id ?? '').localeCompare(String(b.entry.id ?? '')));
  return {dated,undated,duplicates,years:[...new Set(dated.map(d=>d.year))].sort((a,b)=>b-a),firstDay:dated[0]?.day || '',lastDay:dated.at(-1)?.day || ''};
}
export function annualStatistics(prepared, articles, year, currentYear=Number(historyDay(Date.now()).slice(0,4))) {
  if (!Number.isInteger(year) || year<1970 || year>9999) throw new Error('Année invalide.');
  const catalog=new Map(articles.map(a=>[a.id,a])), names=new Map(), rows=new Map(), balances=new Map();
  for(const a of articles) {
    const key=normalized(a.name), matches=names.get(key)||[]; matches.push(a); names.set(key,matches);
  }
  const rowFor=h=>{
    const matches=names.get(normalized(h.articleName))||[];
    const id=String(h.articleId || (matches.length===1 ? matches[0].id : h.articleName ? `ancien:${normalized(h.articleName)}` : `inconnu:${h.id || 'sans-identifiant'}`));
    if(!rows.has(id)) {
      const a=catalog.get(id);
      rows.set(id,{id,name:a?.name || h.articleName || h.articleId || 'Article non identifié',category:a?.category || h.articleCategory || 'À classer',unit:a?.unit || h.articleUnit || 'unité',active:a?.active !== false,deleted:a?.deleted===true,
        ordered:0,cancelled:0,received:0,entries:0,consumed:0,correctionAdded:0,correctionRemoved:0,operations:0,orderEvents:0,outputEvents:0,uncertainOrders:0,uncertainCancellations:0,unclassified:0,legacyMoves:0,unitChanged:false});
    }
    const row=rows.get(id);
    return row;
  };
  let operations=0,unknown=0,uncertainOrders=0,uncertainOrderChanges=0,legacyMoves=0;
  const dates=[];
  // Includes older years to reconstruct the balance BEFORE a selected year's first order.
  for(const item of prepared.dated) {
    if(item.year>year) break;
    const h=item.entry, inYear=item.year===year;
    const type=String(h.type || ''), action=String(h.action || '');
    const row=rowFor(h), previous=balances.get(row.id);
    if(inYear) { operations++; row.operations++; dates.push(item.day); if(h.articleUnit && normalized(h.articleUnit)!==normalized(row.unit))row.unitChanged=true; }
    if(type==='order') {
      const next=orderBalance(h), explicitPrevious=nonNegative(h.oldOrderQuantity);
      // Same timestamp and no explicit baseline: random document IDs are not a chronology.
      const old=explicitPrevious ?? (previous?.time!==item.time ? previous?.quantity : null);
      if(inYear) {
        row.orderEvents++;
        if(next!==null && old!==null && old!==undefined) {
          row.ordered+=Math.max(0,next-old); row.cancelled+=Math.max(0,old-next);
        } else {
          // Without the old balance even a closure can hide a cancellation.
          uncertainOrderChanges++; row.uncertainCancellations++;
          if(next!==0) { row.uncertainOrders++; uncertainOrders++; }
        }
      }
      if(next!==null) balances.set(row.id,{quantity:next,time:item.time}); else balances.delete(row.id);
    } else if(type==='receive') {
      const amount=nonNegative(h.receivedQuantity) ?? stockDelta(h);
      let remaining=nonNegative(h.newOrderQuantity) ?? nonNegative(h.remainingOrderQuantity);
      if(remaining===null && /Commande cl[oô]tur[eé]e/i.test(action)) remaining=0;
      if(remaining===null) {
        const match=action.match(/Reste [àa] recevoir\s*:\s*(\d+)/i);
        if(match) remaining=nonNegative(Number(match[1]));
      }
      if(remaining===null && previous && amount!==null && amount>0 && previous.quantity>=amount) remaining=previous.quantity-amount;
      if(remaining!==null) balances.set(row.id,{quantity:remaining,time:item.time}); else balances.delete(row.id);
      if(inYear) { if(amount!==null && amount>0) row.received+=amount; else { row.unclassified++; unknown++; } }
    } else if(inYear && type==='count') {
      const delta=stockDelta(h);
      if(delta!==null) { row.correctionAdded+=Math.max(0,delta); row.correctionRemoved+=Math.max(0,-delta); }
      else {row.unclassified++;unknown++;}
    } else if(inYear && type==='lot') {
      const old=nonNegative(h.oldStock), next=nonNegative(h.newStock);
      // An allocation into lots is NOT a delivery and does not change stock.
      if(old!==null && next!==null && next>old) row.received+=next-old;
      else if(old!==null && next!==null && old!==next) {row.unclassified++;unknown++;}
    } else if(inYear && (type==='move' || (!type && signedAction(action)!==null))) {
      const delta=stockDelta(h);
      if(delta!==null) {
        row.entries+=Math.max(0,delta);row.consumed+=Math.max(0,-delta);
        if(delta<0) row.outputEvents++;
        if(!type){row.legacyMoves++;legacyMoves++;}
      } else {row.unclassified++;unknown++;}
    } else if(inYear && !['create','catalog','archive','delete','expiry','lotExpiry','expiration'].includes(type)) {
      row.unclassified++;unknown++;
    }
    // Starting stock, catalogue edits, expiry edits and lot allocations never count as consumption/orders.
  }
  const result=[...rows.values()].filter(row=>row.operations>0);
  // Current active articles with no event are explicit "no recorded movement", not proof of no use.
  if(year===currentYear) for(const article of articles) if(article.active!==false && !article.deleted && !result.some(r=>r.id===article.id)) {
    result.push({...rowFor({articleId:article.id}),operations:0});
  }
  return {year,rows:result,operations,unknown,uncertainOrders,uncertainOrderChanges,legacyMoves,undated:prepared.undated,
    firstDay:dates[0] || '',lastDay:dates.at(-1) || '',historyFirstDay:prepared.firstDay,historyLastDay:prepared.lastDay,
    monthly:Array.from({length:12},(_,month)=>({month:month+1,operations:prepared.dated.filter(d=>d.year===year && Number(d.day.slice(5,7))===month+1).length}))};
}
export function rankArticles(rows,metric,direction='desc',count=5) {
  return rows.filter(row=>row[metric]>0 && !row.unitChanged).slice().sort((a,b)=>(direction==='asc'?1:-1)*(a[metric]-b[metric]) || a.name.localeCompare(b.name,'fr')).slice(0,count);
}
