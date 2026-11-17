import test from 'node:test';
import assert from 'node:assert/strict';
import {rankingBars,monthlyActivity,monthlyChart} from '../inventory-statistics-charts.js';
const row=(name,value)=>({name,ordered:value,consumed:value,unit:'boîte',months:Array.from({length:12},()=>({ordered:0,consumed:0,received:0}))});

test('ranking chart keeps precise labels and quantities, scales bars, and escapes article content',()=>{
 const first=row('<img src=x onerror=alert(1)>',10),second=row('Compresses',5);second.uncertainOrders=1;
 const html=rankingBars('Commandes',[first,second],'ordered','desc');
 assert.match(html,/width:100\.00%/);assert.match(html,/width:50\.00%/);assert.match(html,/5 \+ \?/);
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/boîte/);
});
test('empty charts never invent a bar or divide by zero',()=>{
 const ranking=rankingBars('Sorties',[],'consumed','asc');assert.match(ranking,/Aucune quantité/);assert.doesNotMatch(ranking,/NaN|Infinity/);
 const monthly=monthlyChart([],2026);assert.match(monthly,/Aucune commande/);assert.doesNotMatch(monthly,/NaN|Infinity/);
 assert.equal((monthly.match(/<tr>/g)||[]).length,13,'12 months plus header remain accessible as a table');
});
test('monthly aggregation follows the passed article selection and exposes exact table values',()=>{
 const a=row('A',10),b=row('B',20);a.months[0]={ordered:2,consumed:4,received:1};b.months[0]={ordered:5,consumed:1,received:0};
 assert.deepEqual(monthlyActivity([a])[0],{label:'Jan.',ordered:2,consumed:4,received:1});
 assert.equal(monthlyActivity([a,b])[0].ordered,7);
 const html=monthlyChart([a],2026);assert.match(html,/Nombre d’opérations/);assert.match(html,/aria-hidden="true"/);assert.match(html,/<caption>/);assert.match(html,/<td>2<\/td><td>4<\/td><td>1<\/td>/);
});
