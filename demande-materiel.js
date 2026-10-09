import { REQUEST_API } from './material-request-config.js';
const form=document.getElementById('request-form'),status=document.getElementById('request-status'),send=document.getElementById('send-request'),success=document.getElementById('request-success');
let sending=false,id=crypto.randomUUID(),attempted=null;
form.addEventListener('submit',async event=>{
  event.preventDefault();if(sending)return;
  const data=Object.fromEntries(new FormData(form));
  // Retry the same submission with the same ID after a lost acknowledgement.
  const signature=JSON.stringify(data);if(attempted!==null&&signature!==attempted)id=crypto.randomUUID();attempted=signature;
  sending=true;send.disabled=true;status.className='';status.textContent='Envoi en cours… Gardez cette page ouverte.';
  const controls=[...form.elements];controls.forEach(el=>el.disabled=true);
  try{const response=await fetch(REQUEST_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,id}),signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'La demande n’a pas été confirmée. Réessayez.');form.hidden=true;success.hidden=false;success.focus();}
  catch(error){status.className='error';status.textContent=error.name==='TimeoutError'||error.name==='TypeError'?'La confirmation n’a pas été reçue. Vos réponses sont conservées : réessayez.':error.message;}
  finally{sending=false;controls.forEach(el=>el.disabled=false);send.disabled=false;}
});
document.getElementById('another-request').addEventListener('click',()=>{form.reset();id=crypto.randomUUID();attempted=null;status.textContent='';success.hidden=true;form.hidden=false;form.elements.name.focus();});
window.addEventListener('beforeunload',event=>{if(sending){event.preventDefault();event.returnValue='';}});
