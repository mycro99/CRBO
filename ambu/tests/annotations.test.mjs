import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../ambu.html',import.meta.url),'utf8');
const handler=html.match(/function addAnnotation\(event\) \{[\s\S]*?\n    \}/)[0];
function place(rect,x,y){
  const points=[];
  const context={document:{createElement:()=>({style:{}})},annotationLayer:{appendChild:p=>points.push(p)},event:{currentTarget:{getBoundingClientRect:()=>rect},clientX:rect.left+x*rect.width,clientY:rect.top+y*rect.height}};
  runInNewContext(handler+';addAnnotation(event);',context);
  return points;
}
test('phone annotations retain image-relative centres in the wider PDF clone and after rotation',()=>{
  for(const [width,height] of [[320,180],[390,219.375],[800,450]]){
    for(const [x,y] of [[0,0],[0.25,0.75],[0.5,0.5],[0.9,0.1],[1,1]]){
      const [point]=place({left:37,top:163,width,height},x,y);
      assert(point.style.left.endsWith('%'));assert(point.style.top.endsWith('%'));
      // cloneNode preserves these inline styles; CSS resolves them against the
      // image-sized container in both the live view and the export layout.
      for(const [targetWidth,targetHeight] of [[800,450],[640,360]]){
        assert(Math.abs(parseFloat(point.style.left)/100*targetWidth-x*targetWidth)<1e-8);
        assert(Math.abs(parseFloat(point.style.top)/100*targetHeight-y*targetHeight)<1e-8);
      }
    }
  }
});
test('an image without layout cannot create invalid annotation coordinates',()=>{
  assert.equal(place({left:0,top:0,width:0,height:0},0,0).length,0);
});
