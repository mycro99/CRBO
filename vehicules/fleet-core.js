export const CATEGORIES={amu:'Ambulance AMU / 112',transport:'Ambulance 105',tpmr:'TPMR',fit:'FIT',liaison:'Véhicule de liaison',other:'Autre'};
export const EVENT_KINDS={loan:'Prêt / emprunt',garage:'Garage / réparation',maintenance:'Entretien / contrôle',unavailable:'Autre indisponibilité'};
export const TYRES={winter:'Hiver',summer:'Été',allseason:'4 saisons',unknown:'À préciser'};
export const FIELD_LABELS={plate:'Plaque',category:'Catégorie',usage:'Utilisation / affectation',location:'Localisation habituelle',model:'Marque / modèle',km:'Kilométrage',inspectionDate:'Prochain contrôle technique',fuelDate:'Validité carte carburant',tyres:'Pneus',tyresDate:'Dernier changement de pneus',tablet:'Tablette',radio:'ISSI / radio',notes:'Remarques'};
const clean=(value,max,label)=>{const text=String(value??'').trim();if(text.length>max)throw new Error(`${label} : ${max} caractères maximum.`);return text;};
export function todayISO(now=new Date()) {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;
}
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
export function optionalDate(value,label){if(!value)return '';if(!validDate(value))throw new Error(`${label} : date invalide.`);return value;}
export function displayDate(value){return validDate(value)?value.split('-').reverse().join('/'):'—';}
export function plateKey(value){const text=String(value??'').trim().toUpperCase();if(!/^[A-Z0-9 -]{2,24}$/.test(text))throw new Error('Plaque : utilisez des lettres, chiffres, espaces et tirets (2 à 24 caractères).');const key=text.replace(/[ -]/g,'');if(key.length<2)throw new Error('Plaque invalide.');return key;}
export function validateVehicle(input){
 const key=plateKey(input.plate),plate=String(input.plate).trim().toUpperCase();
 if(!Object.hasOwn(CATEGORIES,input.category))throw new Error('Choisissez une catégorie de véhicule.');
 const km=input.km===''||input.km===null||input.km===undefined?null:Number(input.km);
 if(km!==null&&(!Number.isSafeInteger(km)||km<0||km>9999999))throw new Error('Kilométrage : nombre entier entre 0 et 9 999 999 attendu.');
 if(!Object.hasOwn(TYRES,input.tyres))throw new Error('Choisissez le type de pneus.');
 return {plate,plateKey:key,category:input.category,usage:clean(input.usage,100,'Affectation'),location:clean(input.location,160,'Localisation'),model:clean(input.model,120,'Marque / modèle'),km,
  inspectionDate:optionalDate(input.inspectionDate,'Contrôle technique'),fuelDate:optionalDate(input.fuelDate,'Carte carburant'),tyres:input.tyres,tyresDate:optionalDate(input.tyresDate,'Changement de pneus'),tablet:clean(input.tablet,100,'Tablette'),radio:clean(input.radio,100,'Radio / ISSI'),notes:clean(input.notes,2000,'Remarques')};
}
export function validateEvent(input){
 if(!Object.hasOwn(EVENT_KINDS,input.kind))throw new Error('Choisissez un type de suivi.');
 if(!validDate(input.startDate))throw new Error('Indiquez une date de début valide.');
 const endDate=optionalDate(input.endDate,'Fin prévue');if(endDate&&endDate<input.startDate)throw new Error('La fin prévue ne peut pas précéder le début.');
 const reason=clean(input.reason,300,'Motif');if(!reason)throw new Error('Indiquez le motif du prêt ou de l’indisponibilité.');
 return {kind:input.kind,startDate:input.startDate,endDate,reason,location:clean(input.location,160,'Lieu / bénéficiaire'),notes:clean(input.notes,2000,'Remarques')};
}
export function deadline(value,today=todayISO()) {
 if(!validDate(value))return {key:'unknown',label:'À renseigner',days:null};
 const days=Math.round((Date.parse(value+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
 return {days,key:days<0?'expired':days<=30?'soon':'ok',label:days<0?'Dépassé':days===0?'Aujourd’hui':days<=30?`Dans ${days} j`:displayDate(value)};
}
export function vehicleSituation(vehicle,events,today=todayISO()) {
 const open=events.filter(event=>event.vehicleId===vehicle.id&&event.open===true&&!event.cancelled);
 const current=open.filter(event=>event.startDate<=today),priority={garage:4,unavailable:3,maintenance:2,loan:1};
 current.sort((a,b)=>(priority[b.kind]||0)-(priority[a.kind]||0)||a.startDate.localeCompare(b.startDate));
 const main=current[0],late=current.some(event=>event.endDate&&event.endDate<today);
 return {key:main?.kind||'available',label:main?EVENT_KINDS[main.kind]||'Indisponible':'Disponible',location:main?.location||vehicle.location||'À préciser',current,late,
  upcoming:open.filter(event=>event.startDate>today).sort((a,b)=>a.startDate.localeCompare(b.startDate))};
}
export function overlaps(a,b){return a.startDate<=(b.endDate||'9999-12-31')&&b.startDate<=(a.endDate||'9999-12-31');}
export function planVehicle(raw,input,{id,expectedRevision=0,allowKmCorrection=false}={}) {
 const value=validateVehicle(input);
 if(value.plateKey!==id)throw new Error('Une plaque différente nécessite une nouvelle fiche. Archivez l’ancienne si nécessaire.');
 if(raw&&(!Number.isSafeInteger(raw.revision)||raw.revision<1))throw new Error('La version de cette fiche est invalide : aucune modification automatique autorisée.');
 if(raw&&raw.revision!==expectedRevision)throw new Error('La fiche a changé. Fermez puis rouvrez-la avant d’enregistrer.');
 if(raw&&raw.km!==null&&raw.km!==undefined&&value.km!==null&&value.km<raw.km&&!allowKmCorrection)throw new Error('Le kilométrage diminue : cochez la correction explicite si cette baisse est volontaire.');
 const changes=Object.keys(FIELD_LABELS).filter(key=>(raw?.[key]??'')!==(value[key]??'')).map(key=>({field:key,before:raw?.[key]??'',after:value[key]??''}));
 return {patch:{...value,revision:(raw?.revision||0)+1,...(!raw?{active:true,openEventCount:0}:{})},changes};
}
export function planEvent(raw,operation,today=todayISO()) {
 const type=operation.type;
 if(type==='create') {if(raw)throw new Error('Ce suivi existe déjà.');return {...validateEvent(operation.event),open:true,cancelled:false,revision:1};}
 if(!raw)throw new Error('Ce suivi n’existe plus.');
 if(!Number.isSafeInteger(raw.revision)||raw.revision<1)throw new Error('La version de ce suivi est invalide : aucune modification automatique autorisée.');
 if(raw.revision!==operation.expectedEventRevision)throw new Error('Le suivi a changé. Rouvrez-le avant de confirmer.');
 if(!raw.open)throw new Error('Ce suivi est déjà terminé ou annulé. Son historique reste conservé.');
 if(type==='edit')return {...validateEvent(operation.event),revision:raw.revision+1};
 if(type==='return') {
  if(!validDate(operation.returnDate)||operation.returnDate<raw.startDate||operation.returnDate>today)throw new Error('La date réelle doit être comprise entre le début et aujourd’hui.');
  return {open:false,returnDate:operation.returnDate,returnNotes:clean(operation.returnNotes,1000,'Remarque de clôture'),revision:raw.revision+1};
 }
 if(type==='cancel') {const reason=clean(operation.cancelReason,300,'Motif d’annulation');if(!reason)throw new Error('Indiquez pourquoi ce suivi est annulé.');return {open:false,cancelled:true,cancelReason:reason,revision:raw.revision+1};}
 throw new Error('Action de suivi inconnue.');
}
