import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, normalizeDashboard, moveDashboardWidget, appendNotification, markNotificationsRead } from '../client/src/utils/workspaceAppearance.js';
import { encodeBarcode, labelPages } from '../client/src/utils/barcodeLabels.js';

test('appearance validates theme and supported scaling choices',()=>{
  assert.deepEqual(normalizeAppearance({theme:'dark',font:120}),{theme:'dark',font:120});
  assert.deepEqual(normalizeAppearance({theme:'unsafe',font:500}),{theme:'light',font:100});
  assert.deepEqual(normalizeAppearance(null),{theme:'light',font:100});
});
test('dashboard order deduplicates, retains new widgets and never hides every panel',()=>{
  const initial=normalizeDashboard({order:['production','production','bad'],hidden:['metrics','activity','stock','production']});
  assert.deepEqual(initial.order,['production','metrics','activity','stock']);assert.deepEqual(initial.hidden,[]);
  assert.deepEqual(moveDashboardWidget(initial.order,'metrics',-1),['metrics','production','activity','stock']);
  assert.deepEqual(moveDashboardWidget(initial.order,'production',-1),initial.order);
  assert.deepEqual(normalizeDashboard({hidden:['stock','bad','stock']}).hidden,['stock']);
});
test('notification history preserves dismissed events, bounds retention and marks read immutably',()=>{
  let history=[];for(let id=1;id<=120;id++)history=appendNotification(history,{id,type:'info',message:'test'});
  assert.equal(history.length,100);assert.equal(history[0].id,120);assert.equal(history.at(-1).id,21);
  const marked=markNotificationsRead(history);assert.ok(marked.every(n=>n.read));assert.ok(history.every(n=>!n.read));
});
test('Code 128 B start, weighted checksum, stop, exact widths and quiet zones',()=>{
  const abc=encodeBarcode('ABC');assert.deepEqual(abc.symbols,[104,33,34,35,1,106]);
  assert.equal(abc.modules,88);assert.deepEqual(abc.bars[0],{x:10,width:2});
  const last=abc.bars.at(-1);assert.equal(last.x+last.width,abc.modules-10);
  for(const length of [1,26,27,60]) {const e=encodeBarcode('A'.repeat(length));assert.equal(e.modules,11*length+55);assert.ok(e.widthMm<(e.wide?186:91));assert.equal(e.wide,length>26);}
  assert.throws(()=>encodeBarcode(''));assert.throws(()=>encodeBarcode('ગુજરાતી'));assert.throws(()=>encodeBarcode('X'.repeat(61)));
});
test('label sheets paginate with bounded copy counts',()=>{
  assert.deepEqual(labelPages(17,false),[16,1]);assert.deepEqual(labelPages(17,true),[8,8,1]);assert.equal(labelPages(96,false).reduce((a,b)=>a+b),96);
  assert.throws(()=>labelPages(0,false));assert.throws(()=>labelPages(97,false));assert.throws(()=>labelPages(1.5,false));
});
