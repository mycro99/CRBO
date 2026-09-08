// Camera lifecycle shared by the search scanner and article editor.
export class BarcodeCamera {
  constructor(elementId) { this.elementId=elementId; this.reader=null; this.starting=null; this.running=false; this.cancelled=false; this.locked=false; }
  async start(onCode) {
    if (this.running || this.starting) return;
    if (!globalThis.Html5Qrcode) throw new Error('Le scanner n’a pas pu être chargé. Vérifiez la connexion ou saisissez le code manuellement.');
    this.cancelled=false; this.locked=false;
    const f=globalThis.Html5QrcodeSupportedFormats;
    this.reader=new globalThis.Html5Qrcode(this.elementId,{formatsToSupport:[f.CODE_128,f.CODE_39,f.CODE_93,f.EAN_13,f.EAN_8,f.UPC_A,f.UPC_E,f.ITF,f.DATA_MATRIX,f.RSS_14,f.RSS_EXPANDED,f.QR_CODE].filter(v=>v!==undefined),verbose:false});
    this.starting=this.reader.start({facingMode:'environment'},{fps:10,qrbox:(w,h)=>({width:Math.floor(Math.min(w*.9,520)),height:Math.floor(Math.min(h*.5,220))})},raw=>{
      if(this.locked || this.cancelled)return;
      this.locked=true;
      onCode(raw);
    },()=>{});
    try { await this.starting; this.running=true; }
    catch(error) { try { this.reader.clear(); } catch {} throw error; }
    finally { this.starting=null; }
    if(this.cancelled) await this.stop();
  }
  async stop() {
    this.cancelled=true;
    if(this.starting) { try { await this.starting; } catch {} }
    if(this.reader && this.running) {
      this.running=false;
      try { await this.reader.stop(); } catch {}
      try { this.reader.clear(); } catch {}
    }
  }
  async torch(enabled) {
    if(!this.running) return false;
    try {
      const capabilities=this.reader.getRunningTrackCapabilities();
      if(!capabilities?.torch)return false;
      await this.reader.applyVideoConstraints({advanced:[{torch:enabled}]});
      return true;
    } catch { return false; }
  }
}
export function cameraError(error) {
  const message=String(error?.message || error || '');
  if(/NotAllowed|Permission|denied/i.test(message))return 'Accès à la caméra refusé. Autorisez-la dans les réglages du navigateur, ou saisissez le code manuellement.';
  if(/NotFound|NotReadable|Overconstrained/i.test(message))return 'Caméra indisponible. Fermez les autres applications qui l’utilisent, puis réessayez.';
  return message || 'Impossible de démarrer la caméra. La saisie manuelle reste disponible.';
}
