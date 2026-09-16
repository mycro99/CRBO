// Camera lifecycle shared by the search scanner and article editor.
export class BarcodeCamera {
  constructor(elementId) { this.elementId=elementId; this.reader=null; this.starting=null; this.running=false; this.cancelled=false; this.locked=false; this.videoConstraints={}; this.adjustments={}; }
  async start(onCode) {
    if (this.running || this.starting) return;
    if (!globalThis.Html5Qrcode) throw new Error('Le scanner n’a pas pu être chargé. Vérifiez la connexion ou saisissez le code manuellement.');
    this.cancelled=false; this.locked=false; this.adjustments={};
    const f=globalThis.Html5QrcodeSupportedFormats;
    const createReader=()=>new globalThis.Html5Qrcode(this.elementId,{formatsToSupport:[f.CODE_128,f.CODE_39,f.CODE_93,f.EAN_13,f.EAN_8,f.UPC_A,f.UPC_E,f.ITF,f.DATA_MATRIX,f.RSS_14,f.RSS_EXPANDED,f.QR_CODE].filter(v=>v!==undefined),verbose:false});
    const decoded=raw=>{
      if(this.locked || this.cancelled)return;
      this.locked=true;
      onCode(raw);
    };
    // Ideal (not mandatory) HD settings allow lower-resolution cameras to work.
    // A taller reading area accommodates square QR/Data Matrix codes as well as bars.
    const scanConfig={fps:10,qrbox:(w,h)=>({width:Math.floor(w*.94),height:Math.floor(h*.86)})};
    this.videoConstraints={facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}};
    this.reader=createReader();
    this.starting=(async()=>{
      try { await this.reader.start({facingMode:'environment'},{...scanConfig,videoConstraints:this.videoConstraints},decoded,()=>{}); }
      catch(error) {
        // Retry only a constraint compatibility failure, never a denied permission.
        if(this.cancelled || !/Overconstrained|ConstraintNotSatisfied|constraint/i.test(String(error?.name||'')+' '+String(error?.message||error)))throw error;
        try { this.reader.clear(); } catch {}
        this.reader=createReader();this.videoConstraints={facingMode:{ideal:'environment'}};
        await this.reader.start({facingMode:'environment'},scanConfig,decoded,()=>{});
      }
      this.running=true;
      if(!this.cancelled)await this.optimize();
    })();
    try { await this.starting; }
    catch(error) { try { this.reader.clear(); } catch {} throw error; }
    finally { this.starting=null; }
    if(this.cancelled) await this.stop();
  }
  async optimize() {
    let capabilities;
    try { capabilities=this.reader.getRunningTrackCapabilities(); } catch { return; }
    for(const property of ['focusMode','exposureMode','whiteBalanceMode']) {
      if(!this.running || this.cancelled)return;
      if(capabilities?.[property]?.includes?.('continuous'))await this.adjust(property,'continuous');
    }
  }
  async adjust(property,value) {
    if(!this.running || this.cancelled)return false;
    const next={...this.adjustments,[property]:value};
    try {
      // Preserve the selected resolution and other accepted settings when toggling light.
      await this.reader.applyVideoConstraints({...this.videoConstraints,advanced:[next]});
      this.adjustments=next;return true;
    } catch { return false; }
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
      return await this.adjust('torch',enabled);
    } catch { return false; }
  }
}
export function cameraError(error) {
  const message=String(error?.message || error || '');
  if(/NotAllowed|Permission|denied/i.test(message))return 'Accès à la caméra refusé. Autorisez-la dans les réglages du navigateur, ou saisissez le code manuellement.';
  if(/NotFound|NotReadable|Overconstrained/i.test(message))return 'Caméra indisponible. Fermez les autres applications qui l’utilisent, puis réessayez.';
  return message || 'Impossible de démarrer la caméra. La saisie manuelle reste disponible.';
}
