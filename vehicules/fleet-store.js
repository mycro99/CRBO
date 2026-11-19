import {planVehicle,planEvent} from './fleet-core.js?v=2';
export function createFleetStore(sdk,db,auth){
 const {collection,doc,onSnapshot,query,where,limit,getDocsFromServer,runTransaction,serverTimestamp}=sdk;
 let vehicles=new Map(),events=new Map(),vehicleReady=false,eventReady=false,vehicleOnline=false,eventOnline=false,generation=0;
 const listeners=new Set();
 const state=()=>({vehicles:[...vehicles].map(([id,data])=>({...data,id})),events:[...events].map(([id,data])=>({...data,id})),ready:vehicleReady&&eventReady,online:vehicleOnline&&eventOnline});
 const emit=()=>{for(const listener of listeners)listener(state());};
 function assertWrite(owner){if(!auth.currentUser||owner&&auth.currentUser.uid!==owner||!state().ready||!state().online||globalThis.navigator?.onLine===false)throw new Error('Connexion et synchronisation requises. Rien n’a été enregistré.');}
 function checkRevision(raw,revision){if(!raw)throw new Error('Le véhicule n’existe plus.');if(!Number.isSafeInteger(raw.revision)||raw.revision<1)throw new Error('Version de fiche invalide. Aucune modification automatique autorisée.');if(raw.revision!==revision)throw new Error('Le véhicule a changé depuis l’ouverture. Fermez puis rouvrez cette fenêtre.');}
 function start(onError){
  const token=++generation;vehicles=new Map();events=new Map();vehicleReady=eventReady=vehicleOnline=eventOnline=false;emit();
  const listen=(target,isVehicle)=>onSnapshot(target,{includeMetadataChanges:true},snapshot=>{
   if(token!==generation)return;
   const data=new Map(snapshot.docs.map(d=>[d.id,d.data()])),server=!snapshot.metadata.fromCache;
   if(isVehicle){vehicles=data;vehicleReady=vehicleReady||server;vehicleOnline=server;}else{events=data;eventReady=eventReady||server;eventOnline=server;}emit();
  },error=>{if(token!==generation)return;if(isVehicle)vehicleOnline=false;else eventOnline=false;emit();onError(error);});
  const unsubVehicles=listen(collection(db,'vehicles'),true),unsubEvents=listen(query(collection(db,'vehicleEvents'),where('open','==',true)),false);
  return ()=>{generation++;unsubVehicles();unsubEvents();};
 }
 async function saveVehicle(input,options,operationId){
  assertWrite();const owner=auth.currentUser.uid,user=auth.currentUser.email||owner;
  const id=options.id,ref=doc(db,'vehicles',id),auditRef=doc(db,'vehicleEvents','log-'+operationId);
  return runTransaction(db,async transaction=>{
   assertWrite(owner);const done=await transaction.get(auditRef);if(done.exists()){if(done.data().vehicleId!==id)throw new Error('Identifiant de validation déjà utilisé.');return {alreadyApplied:true};}
   const snapshot=await transaction.get(ref),raw=snapshot.exists()?snapshot.data():null;
   if(options.create&&raw)throw new Error('Cette plaque possède déjà une fiche. Consultez aussi les véhicules archivés.');
   if(!options.create&&!raw)throw new Error('Le véhicule n’existe plus.');
   const plan=planVehicle(raw,input,options),stamp=serverTimestamp();
   transaction.set(ref,{...plan.patch,updatedAt:stamp,updatedBy:user,...(!raw?{createdAt:stamp,createdBy:user}:{})},{merge:true});
   transaction.set(auditRef,{vehicleId:id,kind:'record',open:false,action:raw?'Fiche modifiée':'Véhicule ajouté',changes:plan.changes,createdAt:stamp,by:user});
   return {id};
  });
 }
 async function saveEvent(vehicleId,operation,operationId){
  assertWrite();const owner=auth.currentUser.uid,user=auth.currentUser.email||owner;
  const ref=doc(db,'vehicles',vehicleId),eventId=operation.id||'event-'+operationId,eventRef=doc(db,'vehicleEvents',eventId),auditRef=doc(db,'vehicleEvents','log-'+operationId);
  return runTransaction(db,async transaction=>{
   assertWrite(owner);const done=await transaction.get(auditRef);if(done.exists()){if(done.data().vehicleId!==vehicleId)throw new Error('Identifiant de validation déjà utilisé.');return {alreadyApplied:true};}
   const vehicle=await transaction.get(ref),event=await transaction.get(eventRef),raw=vehicle.exists()?vehicle.data():null;
   checkRevision(raw,operation.expectedVehicleRevision);
   if(raw.active===false)throw new Error('Réactivez le véhicule avant de modifier son suivi.');
   if(event.exists()&&event.data().vehicleId!==vehicleId)throw new Error('Ce suivi appartient à un autre véhicule.');
   const before=event.exists()?event.data():null,patch=planEvent(before,operation),stamp=serverTimestamp();
   const count=raw.openEventCount;
   if(!Number.isSafeInteger(count)||count<0)throw new Error('Compteur de suivis invalide. Aucune modification automatique autorisée.');
   transaction.set(ref,{revision:raw.revision+1,openEventCount:Math.max(0,count+(operation.type==='create'?1:before.open&&patch.open===false?-1:0)),updatedAt:stamp,updatedBy:user},{merge:true});
   transaction.set(eventRef,{...patch,vehicleId,updatedAt:stamp,updatedBy:user,...(!before?{createdAt:stamp,createdBy:user}:{}),...(patch.open===false?{closedAt:stamp}:{})},{merge:true});
   transaction.set(auditRef,{vehicleId,kind:'record',open:false,action:{create:'Suivi enregistré',edit:'Suivi modifié',return:'Retour / fin confirmé',cancel:'Suivi annulé'}[operation.type],episodeId:eventId,createdAt:stamp,by:user});
   return {id:eventId};
  });
 }
 async function setActive(id,active,revision,operationId){
  assertWrite();const owner=auth.currentUser.uid,user=auth.currentUser.email||owner,ref=doc(db,'vehicles',id),auditRef=doc(db,'vehicleEvents','log-'+operationId);
  return runTransaction(db,async transaction=>{
   assertWrite(owner);const done=await transaction.get(auditRef);if(done.exists()){if(done.data().vehicleId!==id)throw new Error('Identifiant de validation déjà utilisé.');return {alreadyApplied:true};}
   const snapshot=await transaction.get(ref),raw=snapshot.exists()?snapshot.data():null;checkRevision(raw,revision);
   if(!Number.isSafeInteger(raw.openEventCount)||raw.openEventCount<0)throw new Error('Compteur de suivis invalide. Aucune modification automatique autorisée.');
   if(!active&&raw.openEventCount>0)throw new Error('Clôturez ou annulez les suivis ouverts avant d’archiver ce véhicule.');
   const stamp=serverTimestamp();transaction.set(ref,{active,revision:raw.revision+1,updatedAt:stamp,updatedBy:user},{merge:true});
   transaction.set(auditRef,{vehicleId:id,kind:'record',open:false,action:active?'Véhicule réactivé':'Véhicule archivé',createdAt:stamp,by:user});return {id};
  });
 }
 async function deleteArchivedVehicle(id,revision,createdAt){
  assertWrite();
  const owner=auth.currentUser.uid,ref=doc(db,'vehicles',id);
  return runTransaction(db,async transaction=>{
   assertWrite(owner);
   const snapshot=await transaction.get(ref),raw=snapshot.exists()?snapshot.data():null;
   checkRevision(raw,revision);
   if(!raw.createdAt||!createdAt||raw.createdAt.seconds!==createdAt.seconds||
      raw.createdAt.nanoseconds!==createdAt.nanoseconds)throw new Error('La fiche a changé. Rouvrez-la avant de confirmer.');
   if(raw.active!==false)throw new Error('Seul un véhicule archivé peut être supprimé définitivement.');
   if(raw.openEventCount!==0)throw new Error('Clôturez les suivis ouverts avant la suppression.');
   // Every application write to the history also updates the vehicle read above.
   // A concurrent change therefore forces a retry instead of leaving orphan history.
   const history=await getDocsFromServer(query(collection(db,'vehicleEvents'),where('vehicleId','==',id),limit(500)));
   if(history.docs.length>=500)throw new Error('Historique trop volumineux pour une suppression en une fois. Aucune donnée supprimée.');
   if(history.docs.some(entry=>entry.data().open===true))throw new Error('Clôturez les suivis ouverts avant la suppression.');
   assertWrite(owner);
   for(const entry of history.docs)transaction.delete(doc(db,'vehicleEvents',entry.id));
   transaction.delete(ref);
  });
 }
 return {state,start,subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},saveVehicle,saveEvent,setActive,deleteArchivedVehicle,
  watchHistory:(id,next,error)=>onSnapshot(query(collection(db,'vehicleEvents'),where('vehicleId','==',id)),{includeMetadataChanges:true},snapshot=>next(snapshot.docs.map(d=>({...d.data(),id:d.id})),snapshot.metadata),error)};
}
