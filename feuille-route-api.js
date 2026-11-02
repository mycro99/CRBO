// Appels anonymes : Google conserve les données, CRBO affiche seulement le formulaire.
const ENDPOINT='https://script.google.com/macros/s/AKfycbyTKz-6nf540Fgd87UfD4bADYcy1Qk5gDYWDvE6pcytlPVgDGqe5A8RYjaeV19NRfSvSA/exec';
async function status(params){
  const url=new URL(ENDPOINT);for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  const response=await fetch(url.href,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Service indisponible.');
  return response.json();
}
export async function checkRouteService(){
  const result=await status({service:'route-api'});
  if(!result.ok||result.routeApi!==1)throw new Error('Service indisponible.');
}
export async function sendCourse(payload){
  if(!/^[a-f0-9-]{36}$/i.test(payload.id||''))throw new Error('Référence invalide.');
  try{
    // Réponse opaque : elle ne constitue JAMAIS une confirmation d’enregistrement.
    await fetch(ENDPOINT,{method:'POST',mode:'no-cors',credentials:'omit',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
  }catch{/* La requête peut avoir abouti malgré une coupure : vérifier le reçu. */}
  for(let attempt=0;attempt<3;attempt++){
    try{const result=await status({receipt:payload.id});if(result.ok&&result.stored===true&&result.receipt===payload.id)return result;}catch{}
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new Error('La confirmation n’a pas été reçue. Vos réponses restent sur cette page : réessayez.');
}
