import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../../../course-number.js',import.meta.url),'utf8'),ctx);const {format,bind}=ctx.CRBOCourseNumber;
function field(){const events={},input={value:'',selectionStart:0,selectionEnd:0,addEventListener:(type,fn)=>events[type]=fn,setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},setRangeText(value,start,end){this.value=this.value.slice(0,start)+value+this.value.slice(end);this.setSelectionRange(start+value.length,start+value.length);}};bind(input);return {input,events};}
test('eleven uninterrupted keystrokes insert separators and keep the cursor ready for the next digit',()=>{
 const {input,events}=field();for(const digit of '60262950259'){input.setRangeText(digit,input.selectionStart,input.selectionEnd);events.input();assert.equal(input.selectionStart,input.value.length);}assert.equal(input.value,'60/26/295/0259');
});
test('paste with or without separators works, leading zeros stay and extra characters are bounded',()=>{
 assert.equal(format('60262950259'),'60/26/295/0259');assert.equal(format('60/26/295/0259'),'60/26/295/0259');assert.equal(format('00260000001'),'00/26/000/0001');assert.equal(format('60262950259123'),'60/26/295/0259');assert.equal(format(''),'');
});
test('backspace and delete next to slash do not trap editing on the separator',()=>{
 for(const [key,pos,expected] of [['Backspace',3,'62/62/950/259'],['Delete',2,'60/62/950/259']]){const {input,events}=field();input.value='60/26/295/0259';input.setSelectionRange(pos,pos);let prevented=false;events.keydown({key,preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(input.value,expected);}
});
