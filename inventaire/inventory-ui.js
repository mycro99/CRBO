export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid = () => crypto.randomUUID();
export function friendlyError(error) {
  if(error?.code === 'permission-denied') return 'Firebase refuse cette opération. Les droits actuels doivent être vérifiés ; aucune règle n’a été modifiée et aucune écriture partielle n’a été appliquée.';
  if(error?.code === 'unauthenticated') return 'Votre session a expiré. Reconnectez-vous depuis l’accueil.';
  if(error?.code === 'resource-exhausted') return 'Le quota Firebase est momentanément atteint. Réessayez plus tard ; vos saisies restent affichées.';
  if(['unavailable','deadline-exceeded','aborted'].includes(error?.code)) return 'La connexion n’a pas confirmé l’opération. Gardez cette fenêtre ouverte et réessayez : la même validation ne sera pas appliquée deux fois.';
  return error?.message || 'Opération impossible. Vos saisies sont conservées.';
}
export function downloadFile(name, content, type) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function csvText(rows) {
  // Protect spreadsheet users from formula injection in names, notes and barcodes.
  return '\uFEFF'+rows.map(row=>row.map(v=>{
    let value=String(v??'');
    if(/^[\s]*[=+@-]/.test(value))value="'"+value;
    return '"'+value.replaceAll('"','""')+'"';
  }).join(';')).join('\r\n');
}
export function pdfTable(title, headers, rows, filename) {
  if(!globalThis.jspdf?.jsPDF)throw new Error('Le module PDF n’est pas chargé. Réessayez ou utilisez l’export CSV.');
  const pdf=new globalThis.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const x0=12,width=273,colWidth=width/headers.length;
  let y=0,page=0;
  // Built-in PDF font supports French Latin text; normalize unsupported punctuation.
  const printable=v=>String(v??'').replace(/[’‘]/g,"'").replace(/[–—‑]/g,'-').replace(/→/g,'>').replace(/\u202f/g,' ');
  const begin=()=>{
    if(page++)pdf.addPage();
    pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.setTextColor(7,29,50);pdf.text(printable(title),x0,16);
    pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.text(new Date().toLocaleString('fr-BE',{timeZone:'Europe/Brussels'})+' | CS Oupeye',x0,23);
    y=29;pdf.setFillColor(7,29,50);pdf.rect(x0,y,width,10,'F');pdf.setTextColor(255);pdf.setFontSize(9);
    headers.forEach((v,i)=>pdf.text(printable(v),x0+i*colWidth+2,y+6));y+=10;pdf.setTextColor(25,40,55);
  };
  begin();
  rows.forEach((row,index)=>{
    const lines=row.map(v=>pdf.splitTextToSize(printable(v),colWidth-4));
    const height=Math.max(11,...lines.map(l=>l.length*4+5));
    if(y+height>192)begin();
    if(index%2===0){pdf.setFillColor(240,245,249);pdf.rect(x0,y,width,height,'F');}
    lines.forEach((l,i)=>pdf.text(l,x0+i*colWidth+2,y+5));y+=height;
  });
  const count=pdf.internal.getNumberOfPages();
  for(let p=1;p<=count;p++){pdf.setPage(p);pdf.setFontSize(8);pdf.setTextColor(90);pdf.text(`${p} / ${count}`,280,203,{align:'right'});}
  pdf.save(filename);
}
