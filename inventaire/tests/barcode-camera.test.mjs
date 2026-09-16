import test from 'node:test';
import assert from 'node:assert/strict';
import { BarcodeCamera } from '../barcode-camera.js';

function install(t,{capabilities={},failStart,failSetting,gate}={}) {
  const readers=[],starts=[],settings=[];
  const formats={QR_CODE:0,EAN_13:1,DATA_MATRIX:2,CODE_128:3};
  class Reader {
    constructor(id,config){this.id=id;this.config=config;this.stopped=0;this.cleared=0;readers.push(this);}
    async start(facing,config,decoded){this.decoded=decoded;starts.push({facing,config});if(failStart&&starts.length===1)throw failStart;if(gate)await gate;}
    getRunningTrackCapabilities(){return capabilities;}
    async applyVideoConstraints(config){settings.push(config);if(failSetting&&Object.hasOwn(config.advanced[0],failSetting))throw new Error('Unsupported setting');}
    async stop(){this.stopped++;}
    clear(){this.cleared++;}
  }
  const previous=[globalThis.Html5Qrcode,globalThis.Html5QrcodeSupportedFormats];
  globalThis.Html5Qrcode=Reader;globalThis.Html5QrcodeSupportedFormats=formats;
  t.after(()=>{[globalThis.Html5Qrcode,globalThis.Html5QrcodeSupportedFormats]=previous;});
  return {readers,starts,settings,formats};
}
test('QR and Data Matrix remain enabled, decoded content passes through unchanged once',async t=>{
  const mock=install(t),camera=new BarcodeCamera('reader'),received=[];
  await camera.start(raw=>received.push(raw));
  assert(mock.readers[0].config.formatsToSupport.includes(mock.formats.QR_CODE));
  assert(mock.readers[0].config.formatsToSupport.includes(mock.formats.DATA_MATRIX));
  mock.readers[0].decoded('https://example.org/article?id=123');mock.readers[0].decoded('duplicate');
  assert.deepEqual(received,['https://example.org/article?id=123']);await camera.stop();
});
test('HD is requested as a preference and portrait/landscape reading areas accommodate square codes',async t=>{
  const mock=install(t),camera=new BarcodeCamera('capture-reader');await camera.start(()=>{});
  const config=mock.starts[0].config;
  assert.deepEqual(config.videoConstraints,{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}});
  for(const [w,h] of [[320,180],[320,480],[900,506]]){
    const box=config.qrbox(w,h);assert(box.width<w&&box.height<h);assert(box.width>w*.9&&box.height>h*.8);
  }
  await camera.stop();
});
test('autofocus/exposure are capability checked and torch keeps accepted camera settings',async t=>{
  const mock=install(t,{capabilities:{focusMode:['continuous'],exposureMode:['continuous'],whiteBalanceMode:['manual'],torch:true}});
  const camera=new BarcodeCamera('reader');await camera.start(()=>{});
  assert.equal(mock.settings.length,2);assert.equal(await camera.torch(true),true);
  assert.deepEqual(mock.settings.at(-1).advanced,[{focusMode:'continuous',exposureMode:'continuous',torch:true}]);
  assert.equal(mock.settings.at(-1).width.ideal,1920);await camera.stop();
});
test('unsupported or rejected optional controls never stop scanning',async t=>{
  const mock=install(t,{capabilities:{focusMode:['continuous'],exposureMode:['continuous']},failSetting:'focusMode'});
  const camera=new BarcodeCamera('reader');await camera.start(()=>{});
  assert.equal(camera.running,true);assert.deepEqual(camera.adjustments,{exposureMode:'continuous'});
  assert.equal(await camera.torch(true),false);assert.equal(mock.settings.length,2);await camera.stop();
});
test('a camera constraint failure retries without HD and without losing QR support',async t=>{
  const mock=install(t,{failStart:Object.assign(new Error('unsupported width'),{name:'OverconstrainedError'})});
  const camera=new BarcodeCamera('reader');await camera.start(()=>{});
  assert.equal(mock.starts.length,2);assert.equal(mock.starts[1].config.videoConstraints,undefined);
  assert.equal(mock.readers[0].cleared,1);assert(mock.readers[1].config.formatsToSupport.includes(0));await camera.stop();
});
test('camera permission refusal is not retried',async t=>{
  const mock=install(t,{failStart:Object.assign(new Error('Permission denied'),{name:'NotAllowedError'})});
  const camera=new BarcodeCamera('reader');await assert.rejects(camera.start(()=>{}),/denied/);
  assert.equal(mock.starts.length,1);assert.equal(camera.running,false);
});
test('closing while camera starts stops its stream and suppresses delayed detections',async t=>{
  let release;const gate=new Promise(resolve=>release=resolve),mock=install(t,{gate});
  const camera=new BarcodeCamera('reader'),received=[];
  const starting=camera.start(raw=>received.push(raw)),stopping=camera.stop();
  release();await Promise.all([starting,stopping]);mock.readers[0].decoded('late');
  assert.equal(camera.running,false);assert.equal(mock.readers[0].stopped,1);assert.deepEqual(received,[]);
});
