import { mergeInventory, planOperation } from './inventory-core.js?v=annual-1';

// The SDK is injected so data-safety tests run without contacting production.
export function createInventoryStore(sdk, db, auth) {
  const {collection,doc,onSnapshot,query,orderBy,limit,getDocs,getDocsFromServer,documentId,startAfter,runTransaction,serverTimestamp} = sdk;
  let records = new Map(), ready = false, online = false;
  const listeners = new Set();
  function state() { return {articles:mergeInventory(records),records:new Map(records),ready,online}; }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function start(onError) {
    records = new Map(); ready = false; online = false;
    for (const listener of listeners) listener(state());
    return onSnapshot(collection(db,'inventory'), {includeMetadataChanges:true}, snapshot => {
      records = new Map(snapshot.docs.map(d => [d.id,d.data()]));
      // An initial empty cache is not an empty inventory: wait for the server once.
      ready = ready || !snapshot.metadata.fromCache;
      online = !snapshot.metadata.fromCache;
      for (const listener of listeners) listener(state());
    }, error => {
      online = false;
      for (const listener of listeners) listener(state());
      onError(error);
    });
  }
  async function performMany(items, operationId) {
    if (!auth.currentUser || !ready || !online || globalThis.navigator?.onLine === false) throw new Error('Connexion requise. Attendez la synchronisation avant d’enregistrer.');
    if (!items.length || items.length > 100) throw new Error('Validez entre 1 et 100 articles à la fois.');
    if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Un article ne peut être modifié deux fois dans une même validation.');
    const userEmail = auth.currentUser.email || auth.currentUser.uid;
    const historyRefs = items.map((item,index) => doc(db,'history',`${operationId}-${index}`));
    const productRefs = items.map(item => doc(db,'inventory',item.id));
    return runTransaction(db, async transaction => {
      // A stable operation id also makes a retry after an uncertain response idempotent.
      const done = await transaction.get(historyRefs[0]);
      if (done.exists()) return {alreadyApplied:true};
      const snapshots = [];
      for (const ref of productRefs) snapshots.push(await transaction.get(ref));
      const plans = items.map((item,index) => planOperation(item.id,snapshots[index].exists() ? snapshots[index].data() : null,item.operation));
      let lastHistory = null;
      for (let index=0;index<plans.length;index++) {
        const plan = plans[index];
        if (!plan) continue;
        const stamp = serverTimestamp();
        transaction.set(productRefs[index], {...plan.patch,lastModifiedBy:userEmail,lastModifiedAt:stamp}, {merge:true});
        const history = {...plan.history,userEmail,date:stamp};
        transaction.set(historyRefs[index],history);
        lastHistory = history;
      }
      if (lastHistory) transaction.set(doc(db,'metadata','lastUpdate'),lastHistory);
      return {changed:plans.filter(Boolean).length};
    });
  }
  return {
    state, subscribe, start,
    perform:(id,operation,operationId) => performMany([{id,operation}],operationId),
    performMany,
    history:async () => {
      const snapshot = await getDocs(query(collection(db,'history'),orderBy('date','desc'),limit(100)));
      return snapshot.docs.map(d => ({id:d.id,...d.data()}));
    },
    statisticsHistory:async ({onProgress=()=>{},signal}={}) => {
      const owner=auth.currentUser?.uid;
      if(!owner) throw new Error('Connexion staff requise pour lire les statistiques.');
      const entries=[];
      let cursor;
      const assertSession=()=>{
        if(signal?.aborted) throw Object.assign(new Error('Chargement annulé.'),{name:'AbortError'});
        if(auth.currentUser?.uid!==owner) throw new Error('La session a changé. Rouvrez les statistiques après connexion.');
      };
      while(true) {
        assertSession();
        const constraints=[orderBy(documentId()),limit(500)];
        if(cursor) constraints.push(startAfter(cursor));
        const snapshot=await getDocsFromServer(query(collection(db,'history'),...constraints));
        assertSession();
        entries.push(...snapshot.docs.map(d=>({...d.data(),id:d.id})));
        onProgress(entries.length);
        if(snapshot.docs.length<500) return entries;
        cursor=snapshot.docs.at(-1);
      }
    },
    lastUpdate:(next,error) => onSnapshot(doc(db,'metadata','lastUpdate'),snap => next(snap.exists()?snap.data():null),error)
  };
}
