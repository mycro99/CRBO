import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../dialog-dismiss.js',import.meta.url),'utf8');
function fixture(onCancel) {
 const listeners=new Map();
 const dialog={tagName:'DIALOG',open:true,closed:0,cancels:0,
  getBoundingClientRect:()=>({left:100,top:100,right:400,bottom:400}),
  dispatchEvent(event){this.cancels++;onCancel?.(event,dialog);return !event.defaultPrevented;},
  close(){this.closed++;this.open=false;}};
 const context={Event,Math,document:{addEventListener:(type,fn)=>listeners.set(type,fn)}};
 vm.runInNewContext(source,context);
 const send=(type,overrides={})=>listeners.get(type)?.({target:dialog,clientX:20,clientY:20,button:0,isPrimary:true,pointerId:1,...overrides});
 const click=(start={},end=start)=>{send('pointerdown',start);send('pointerup',end);send('click',end);};
 return {dialog,send,click};
}
test('backdrop click or touch closes a native modal through its cancel event',()=>{
 for(const pointerType of ['mouse','touch']){const f=fixture();f.click({pointerType});assert.equal(f.dialog.cancels,1);assert.equal(f.dialog.closed,1);}
});
test('inside content, dialog padding and border do not close a popup',()=>{
 for(const point of [{clientX:200,clientY:200},{clientX:100,clientY:100},{target:{tagName:'BUTTON'}}]){
  const f=fixture();f.click(point);assert.equal(f.dialog.closed,0);
 }
});
test('selection drag from inside to outside, scrolling or canceled gestures do not dismiss',()=>{
 const f=fixture();f.click({clientX:200,clientY:200},{clientX:20,clientY:20});assert.equal(f.dialog.closed,0);
 f.click({clientX:20,clientY:20},{clientX:20,clientY:90});assert.equal(f.dialog.closed,0);
 f.send('pointerdown');f.send('pointercancel');f.send('click');assert.equal(f.dialog.closed,0);
});
test('dirty-form refusal and in-progress save guards remain authoritative',()=>{
 const f=fixture(event=>event.preventDefault());f.click();assert.equal(f.dialog.cancels,1);assert.equal(f.dialog.open,true);assert.equal(f.dialog.closed,0);
});
test('existing camera cleanup or statistics cancellation closes exactly once',()=>{
 let cleaned=0;const f=fixture((event,dialog)=>{event.preventDefault();cleaned++;dialog.close();});f.click();assert.equal(cleaned,1);assert.equal(f.dialog.closed,1);
});
test('unrelated clicks, non-primary gestures, right clicks and already-closed dialogs are ignored',()=>{
 const f=fixture();f.send('click');assert.equal(f.dialog.closed,0);
 f.click({button:2});f.click({isPrimary:false});assert.equal(f.dialog.closed,0);
 f.send('pointerdown');f.send('pointerup',{pointerId:2});f.send('click');assert.equal(f.dialog.closed,0);
 f.dialog.open=false;f.click();assert.equal(f.dialog.cancels,0);
});
