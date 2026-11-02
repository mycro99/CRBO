(function (root) {
  'use strict';
  function format(value) {
    const digits=String(value||'').replace(/\D/g,'').slice(0,11);
    return [digits.slice(0,2),digits.slice(2,4),digits.slice(4,7),digits.slice(7,11)].filter(Boolean).join('/');
  }
  function apply(input) {
    const before=input.value.slice(0,input.selectionStart??input.value.length);
    const digits=Math.min(before.replace(/\D/g,'').length,11);
    input.value=format(input.value);
    let position=0,count=0;
    while(position<input.value.length&&count<digits){if(/\d/.test(input.value[position]))count++;position++;}
    if(input.value[position]==='/')position++;
    input.setSelectionRange(position,position);
  }
  function bind(input) {
    input.addEventListener('input',()=>apply(input));
    input.addEventListener('keydown',event=>{
      const start=input.selectionStart,end=input.selectionEnd;
      if(start!==end)return;
      if(event.key==='Backspace'&&start>0&&input.value[start-1]==='/'){
        event.preventDefault();input.setRangeText('',Math.max(0,start-2),start,'start');apply(input);
      }else if(event.key==='Delete'&&input.value[start]==='/'){
        event.preventDefault();input.setRangeText('',start,Math.min(start+2,input.value.length),'start');apply(input);
      }
    });
    input.value=format(input.value);
  }
  root.CRBOCourseNumber=Object.freeze({format,bind});
})(globalThis);
