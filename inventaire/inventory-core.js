// Pure, side-effect-free inventory rules shared by the application, scanner and tests.
import { SEED_ARTICLES, SEED_CATEGORIES } from './catalog-seed.js';

export const seedById = new Map(SEED_ARTICLES.map(article => [article.id, article]));
export const categoryLabel = id => SEED_CATEGORIES.find(c => c.id === id)?.name || id || 'À classer';
export const text = value => typeof value === 'string' ? value : '';
export const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const normalizeBarcode = value => text(value).trim().replace(/[\s-]/g, '').toUpperCase();
export function splitBarcodes(value) {
  return [...new Set(text(value).split(/[,;\n]+/).map(v => v.trim()).filter(Boolean))];
}
export function barcodeMatches(articles, raw) {
  const code = normalizeBarcode(raw);
  if (!code) return [];
  // Exact matches always take precedence; do not strip lot/expiry information blindly.
  const exact = articles.filter(a => a.active && a.barcodes.some(b => normalizeBarcode(b) === code));
  if (exact.length) return exact;
  const gtin = code.match(/^\(01\)(\d{14})/)?.[1] || code.match(/^(?:\]C1|\]D2)?01(\d{14})(?=17|10|21|11|15)/)?.[1];
  return gtin ? articles.filter(a => a.active && a.barcodes.some(b => normalizeBarcode(b) === gtin || normalizeBarcode(b) === '01' + gtin)) : [];
}
export function quantity(value, label = 'Quantité') {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') throw new Error(`${label} : indiquez un nombre entier positif ou nul.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > 9999999) throw new Error(`${label} : nombre entier entre 0 et 9 999 999 attendu.`);
  return n;
}
export function validDate(value) {
  if (!value) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function expiryState(date, noExpiration = false, today = todayISO()) {
  if (noExpiration) return { key:'none', label:'Sans péremption', days:null };
  if (!date) return { key:'unknown', label:'Non renseignée', days:null };
  if (!validDate(date)) return { key:'unknown', label:'Date à vérifier', days:null };
  const days = Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000);
  if (days < 0) return { key:'expired', label:'Périmé', days };
  if (days < 30) return { key:'soon', label:days === 0 ? "Aujourd’hui" : `Dans ${days} j`, days };
  return { key:'ok', label:formatDate(date), days };
}
export function formatDate(date) {
  return validDate(date) && date ? date.split('-').reverse().join('/') : '—';
}
export function safeImage(value) {
  const v = text(value).trim();
  // Photos are optional; no upload service/billing is introduced.
  return /^images\/[a-zA-Z0-9_./ ()-]+\.(?:png|jpg|jpeg|webp|gif)$/i.test(v) && !v.includes('..') || /^https:\/\/[^\s<>"']+$/i.test(v) ? v : '';
}
export function articleFrom(id, data = {}) {
  const seed = seedById.get(id) || {};
  const catalog = data.catalog && typeof data.catalog === 'object' ? data.catalog : {};
  let stock = 0, stockValid = true;
  try { stock = quantity(data.stock ?? 0); } catch { stockValid = false; }
  const minStock = Number.isSafeInteger(catalog.minStock) ? catalog.minStock : seed.minStock || 0;
  let lots = Array.isArray(data.inventoryLots) ? data.inventoryLots : [];
  try {
    if(data.inventoryLots !== undefined && !Array.isArray(data.inventoryLots)) throw new Error('Malformed lots');
    if(lots.some(l=>!l || typeof l.id!=='string' || typeof l.label!=='string') || new Set(lots.map(l=>l.id)).size!==lots.length) throw new Error('Malformed lots');
    if(lots.reduce((sum,l)=>sum+quantity(l.quantity),0)>stock) throw new Error('Lots exceed stock');
  } catch { stockValid=false; lots=[]; }
  return {
    id, name:text(catalog.name) || text(data.name) || seed.name || `Article ${id}`,
    category:text(catalog.category) || seed.category || 'À classer',
    barcodes:Array.isArray(catalog.barcodes) ? catalog.barcodes.filter(b => typeof b === 'string') : [...(seed.barcodes || [])],
    image:text(catalog.image ?? seed.image), minStock,
    targetStock:Number.isSafeInteger(catalog.targetStock) ? Math.max(minStock,catalog.targetStock) : minStock,
    location:text(catalog.location), unit:text(catalog.unit) || 'unité', notes:text(catalog.notes),
    active:catalog.active !== false, order:seed.order ?? 10000,
    stock, stockValid, expirationDate:data.expirationDate || '', noExpiration:data.noExpiration === true,
    lots, catalogRevision:data.catalogRevision || 0, stockRevision:data.inventoryStockRevision || 0,
    orderQuantity:Number.isSafeInteger(data.inventoryOrder?.quantity) ? data.inventoryOrder.quantity : 0,
    raw:data
  };
}
export function mergeInventory(records) {
  const all = new Map(SEED_ARTICLES.map(a => [a.id,articleFrom(a.id)]));
  for (const [id, data] of records) all.set(id, articleFrom(id, data));
  return [...all.values()];
}
export function unallocatedStock(article) {
  return article.stock - article.lots.reduce((sum, lot) => sum + quantity(lot.quantity), 0);
}
export function expiries(article) {
  const results = article.lots.filter(l => Number(l.quantity) > 0).map(l => ({ ...expiryState(l.expirationDate, l.noExpiration), date:l.expirationDate || '', lot:l.label || 'Lot', quantity:l.quantity }));
  if (!article.lots.length || unallocatedStock(article) > 0) results.push({ ...expiryState(article.expirationDate, article.noExpiration), date:article.expirationDate, lot:article.lots.length ? 'Stock non réparti' : '', quantity:article.lots.length ? unallocatedStock(article) : article.stock });
  return results;
}
export function primaryExpiry(article) {
  const rank = {expired:0, soon:1, unknown:2, ok:3, none:4};
  return expiries(article).sort((a,b) => rank[a.key]-rank[b.key] || (a.days ?? Infinity)-(b.days ?? Infinity))[0] || expiryState('', true);
}
export function orderNeed(article) { return Math.max(0,article.targetStock - article.stock - article.orderQuantity); }
export function matchesFilter(article, filter) {
  if (filter === 'archived') return !article.active;
  if (!article.active) return false;
  if (filter === 'low') return article.stockValid && article.stock < article.minStock;
  if (filter === 'zero') return article.stockValid && article.stock === 0;
  if (filter === 'expiry') return expiries(article).some(e => ['expired','soon'].includes(e.key));
  if (filter === 'barcodes') return !article.barcodes.length;
  if (filter === 'ordered') return article.orderQuantity > 0;
  return true;
}
export function validateCatalog(input) {
  const name = text(input.name).trim(), category = text(input.category).trim();
  if (!name || name.length > 160) throw new Error('Indiquez un nom de 1 à 160 caractères.');
  if (!category || category.length > 80) throw new Error('Indiquez une catégorie de 1 à 80 caractères.');
  const barcodes = Array.isArray(input.barcodes) ? [...new Set(input.barcodes.map(b => text(b).trim()).filter(Boolean))] : splitBarcodes(input.barcodes);
  if (barcodes.length > 50 || barcodes.some(b => b.length > 160)) throw new Error('Maximum 50 codes-barres de 160 caractères par article.');
  const minStock = quantity(input.minStock, 'Stock minimum');
  const targetStock = quantity(input.targetStock, 'Stock souhaité');
  if (targetStock < minStock) throw new Error('Le stock souhaité doit être au moins égal au minimum.');
  const image = text(input.image).trim();
  if (image && (!safeImage(image) || image.length > 1500)) throw new Error('Photo : choisissez une image existante ou un lien HTTPS valide.');
  const result = {name,category,barcodes,minStock,targetStock,image,location:text(input.location).trim(),unit:text(input.unit).trim() || 'unité',notes:text(input.notes).trim()};
  if (result.location.length > 120 || result.unit.length > 30 || result.notes.length > 1000) throw new Error('Emplacement, unité ou notes trop longs.');
  return result;
}

// Returns ONLY the fields the manager explicitly changed. Never called on page load.
export function planOperation(id, raw, operation) {
  const data = raw || {}, article = articleFrom(id, data), patch = {};
  let action = '', type = operation.type, extra = {};
  const hasArticle = raw !== null || seedById.has(id);
  if (!hasArticle && type !== 'create') throw new Error('Cet article n’existe plus. Rechargez la page.');
  if (!article.active && !['archive','catalog'].includes(type)) throw new Error('Cet article est archivé. Réactivez-le d’abord.');
  const setStock = n => {
    patch.stock = quantity(n);
    patch.inventoryStockRevision = article.stockRevision + 1;
    extra.oldStock = article.stock;
    extra.newStock = patch.stock;
  };
  const requireStock = () => { if (!article.stockValid) throw new Error('Stock existant non reconnu : aucune modification automatique autorisée.'); };
  if (type === 'create') {
    if (hasArticle) throw new Error('Cet identifiant existe déjà.');
    patch.catalog = {...validateCatalog(operation.catalog), active:true};
    patch.catalogRevision = 1;
    setStock(operation.stock);
    if (!validDate(operation.expirationDate)) throw new Error('Date de péremption invalide.');
    patch.expirationDate = operation.expirationDate || null;
    patch.noExpiration = operation.noExpiration === true;
    action = 'Article créé';
  } else if (type === 'catalog' || type === 'archive') {
    if (operation.expectedRevision !== article.catalogRevision) throw new Error('La fiche a été modifiée par un collègue. Rouvrez-la avant d’enregistrer.');
    patch.catalog = type === 'catalog' ? validateCatalog(operation.catalog) : {active:operation.active === true};
    patch.catalogRevision = article.catalogRevision + 1;
    action = type === 'catalog' ? 'Fiche article modifiée' : operation.active ? 'Article réactivé' : 'Article archivé';
  } else if (type === 'expiry') {
    if ((data.expirationDate || '') !== operation.expectedDate || (data.noExpiration === true) !== operation.expectedNoExpiration) throw new Error('La péremption a changé. Rouvrez la fiche.');
    if (!validDate(operation.expirationDate)) throw new Error('Date de péremption invalide.');
    // Preserve the historical date even when "no expiry" is selected.
    patch.expirationDate = operation.expirationDate || null;
    patch.noExpiration = operation.noExpiration === true;
    action = 'Péremption modifiée';
    extra = {expirationDate:patch.expirationDate,noExpiration:patch.noExpiration};
  } else if (type === 'move' || type === 'count') {
    requireStock();
    const delta = type === 'count' ? quantity(operation.stock)-article.stock : Number(operation.delta);
    if (!Number.isSafeInteger(delta) || Math.abs(delta)>9999999) throw new Error('Mouvement invalide.');
    if (type === 'count' && (operation.expectedStock !== article.stock || operation.expectedRevision !== article.stockRevision)) throw new Error('Le stock a changé pendant le comptage. Vérifiez la quantité avant de recommencer.');
    if (article.stock + delta < 0) throw new Error('La sortie dépasse le stock disponible.');
    if (!delta) return null;
    if (operation.lotId) {
      const lots = article.lots.map(l => ({...l}));
      const lot = lots.find(l => l.id === operation.lotId);
      if (!lot || quantity(lot.quantity) + delta < 0) throw new Error('Quantité indisponible dans ce lot.');
      lot.quantity = quantity(lot.quantity) + delta;
      patch.inventoryLots = lots;
      extra.lot = lot.label;
    } else if (unallocatedStock(article) + delta < 0) {
      throw new Error('Cette sortie concerne du stock réparti en lots. Choisissez le lot dans « Mouvement ».');
    }
    setStock(article.stock + delta);
    action = type === 'count' ? `Comptage : ${delta>0?'+':''}${delta}` : `${delta>0?'+':''}${delta}`;
    extra.reason = text(operation.reason).slice(0,300);
  } else if (type === 'lot') {
    requireStock();
    if (article.lots.length >= 100) throw new Error('Maximum 100 lots par article.');
    if (!operation.lotId || article.lots.some(l => l.id === operation.lotId)) throw new Error('Ce lot existe déjà.');
    const amount = quantity(operation.quantity);
    if (!amount) throw new Error('La quantité du lot doit être supérieure à zéro.');
    if (!validDate(operation.expirationDate) || (!operation.expirationDate && !operation.noExpiration)) throw new Error('Indiquez une date ou « Sans péremption ».');
    if (!operation.receive && amount > unallocatedStock(article)) throw new Error('La quantité dépasse le stock non réparti.');
    const label = text(operation.label).trim();
    if (!label || label.length > 100) throw new Error('Indiquez un numéro ou nom de lot (100 caractères maximum).');
    patch.inventoryLots = [...article.lots, {id:operation.lotId,label,quantity:amount,expirationDate:operation.expirationDate || null,noExpiration:operation.noExpiration === true}];
    if (operation.receive) setStock(article.stock + amount);
    action = operation.receive ? `Réception du lot ${label} (+${amount})` : `Répartition en lot : ${label} (${amount})`;
    extra.lot = label;
  } else if (type === 'lotExpiry') {
    const lots = article.lots.map(l => ({...l})), lot = lots.find(l => l.id === operation.lotId);
    if (!lot || (lot.expirationDate || '') !== operation.expectedDate || (lot.noExpiration === true) !== operation.expectedNoExpiration) throw new Error('Le lot a changé. Rouvrez la fiche.');
    if (!validDate(operation.expirationDate)) throw new Error('Date de péremption invalide.');
    lot.expirationDate = operation.expirationDate || null;
    lot.noExpiration = operation.noExpiration === true;
    patch.inventoryLots = lots;
    action = `Péremption du lot ${lot.label} modifiée`;
  } else if (type === 'order') {
    const amount = quantity(operation.quantity);
    if (article.orderQuantity !== operation.expectedQuantity) throw new Error('La commande a changé. Rouvrez-la.');
    patch.inventoryOrder = {quantity:amount};
    action = amount ? `Commande en cours : ${amount}` : 'Commande clôturée';
  } else if (type === 'receive') {
    requireStock();
    const amount = quantity(operation.quantity);
    if (!amount || amount > article.orderQuantity) throw new Error('Quantité supérieure à la commande restante ou nulle.');
    patch.inventoryOrder = {quantity:article.orderQuantity - amount};
    setStock(article.stock + amount);
    action = `Commande reçue : +${amount}`;
  } else throw new Error('Opération non reconnue.');
  return {patch, history:{type,articleId:id,articleName:patch.catalog?.name || article.name,action,...extra}};
}
