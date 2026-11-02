import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../Code.gs',import.meta.url),'utf8');const ctx=vm.createContext({});vm.runInContext(code,ctx);
const hospitals=vm.runInContext('Object.keys(HOSPITALS)',ctx),outcomes=vm.runInContext('Object.keys(OUTCOMES)',ctx);
const parser=`import json,sys
from html.parser import HTMLParser
class Selects(HTMLParser):
 def __init__(self):super().__init__();self.current=None;self.values={}
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='select':self.current=d.get('id');self.values[self.current]=[]
  if tag=='option' and self.current:self.values[self.current].append(d.get('value',''))
 def handle_endtag(self,tag):
  if tag=='select':self.current=None
p=Selects();p.feed(sys.stdin.read());print(json.dumps(p.values))`;
for(const path of ['../../../feuille-route.html','../Form.html'])test(path+' exposes every server-supported choice as an actual HTML option',()=>{
 const html=fs.readFileSync(new URL(path,import.meta.url),'utf8');const selects=JSON.parse(execFileSync('python',['-c',parser],{input:html,encoding:'utf8'}));
 assert.deepEqual(selects.hospital,['',...Array.from(hospitals).sort()]);assert.deepEqual(selects.outcome,['',...Array.from(outcomes)]);
 assert.doesNotMatch(html,/<\/option\s+[^>]*>/i);
});
