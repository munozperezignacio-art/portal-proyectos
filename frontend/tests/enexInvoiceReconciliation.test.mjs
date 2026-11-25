import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateInvoiceTotal,classifyInvoiceMovement,reconcileEnexInvoice,validateInvoiceRules} from '../src/utils/enexInvoiceReconciliation.js';

function fixture(liters=[100000,300000]) {
  return {
    invoice:{empresa:'TEST',portal:'transporte',document:'4161315',guides:['101','102'],liters_milli:400000,
      fuel_net:100000,shellcard_net:53158,net:153158,vat:29100,specific_tax:-10000,exempt:0,total:172258},
    movements:liters.map((liters_milli,i)=>({id:`m${i+1}`,empresa:'TEST',portal:'transporte',document:String(101+i),
      vehicle:`TEST-${i+1}`,liters_milli,assignment:{centro_gestion_id:i+1}})),
    centers:[1,2].map(id=>({id,empresa:'TEST',activo:true,codigo:`00${id}`,nombre:`Centro ${id}`})),
  };
}
const total=(rows,key)=>rows.reduce((a,r)=>a+r[key],0);
test('Shellcard and money are split by original litres into assigned centers',()=>{
  const f=fixture(),before=structuredClone(f),r=reconcileEnexInvoice(f);
  assert.equal(r.ready,true);
  assert.deepEqual(r.rows.map(x=>x.shellcard_net),[13290,39868]);
  assert.deepEqual(r.groups.map(x=>[x.center_id,x.classification]),[[1,'camioneta'],[2,'maquinaria']]);
  for(const key of ['fuel_net','shellcard_net','net','vat','specific_tax','exempt','total']) {
    assert.equal(total(r.rows,key),f.invoice[key]);
    assert.equal(total(r.groups,key),f.invoice[key]);
  }
  assert.deepEqual(f,before,'No input, movement or assignment changed');
});
for(const delta of [-20000,-1,0,1,20000])test(`Inclusive ±20 litres: adjustment ${delta} ml reconciles exactly`,()=>{
  const f=fixture();f.invoice.liters_milli+=delta;
  const r=reconcileEnexInvoice(f);
  assert.equal(r.ready,true);assert.equal(r.difference_milli,delta);
  assert.equal(total(r.rows,'adjusted_liters_milli'),f.invoice.liters_milli);
  assert.equal(total(r.rows,'original_liters_milli'),400000);
  assert.equal(total(r.rows,'adjustment_milli'),delta);
  assert.equal(total(r.rows,'shellcard_net'),53158);
});
for(const delta of [-20001,20001])test(`Out of tolerance ${delta} ml cannot issue`,()=>{
  const f=fixture();f.invoice.liters_milli+=delta;
  const r=reconcileEnexInvoice(f);assert.equal(r.ready,false);assert.equal(r.problems[0].code,'liters_mismatch');assert.deepEqual(r.rows,[]);
});
test('Default threshold is strict >180 litres, editable, and not an alert rule',()=>{
  assert.equal(classifyInvoiceMovement(180000),'camioneta');
  assert.equal(classifyInvoiceMovement(180001),'maquinaria');
  assert.equal(classifyInvoiceMovement(200000,{machinery_threshold_milli:200000}),'camioneta');
  assert.equal(classifyInvoiceMovement(200001,{machinery_threshold_milli:200000}),'maquinaria');
  for(const bad of [0,-1,NaN,Infinity,1.5,'180000'])assert.throws(()=>validateInvoiceRules({machinery_threshold_milli:bad}));
});
test('Invoice adjustment crossing threshold never reclassifies original movement',()=>{
  const f=fixture([180000,220000]);f.invoice.liters_milli=420000;
  const r=reconcileEnexInvoice(f);assert.equal(r.rows[0].adjusted_liters_milli,189000);
  assert.equal(r.rows[0].classification,'camioneta');
  assert.equal(r.rules.machinery_threshold_milli,180000);
});
test('Absent guides and unassigned loads cannot hide behind the tolerance',()=>{
  const f=fixture([10000,390000]);f.movements.shift();
  let r=reconcileEnexInvoice(f);assert.equal(r.ready,false);assert.equal(r.problems[0].code,'missing');
  const g=fixture();g.movements[0].assignment=null;
  r=reconcileEnexInvoice(g);assert.equal(r.ready,false);assert.equal(r.problems[0].code,'unassigned');
});
test('Repeated extracted guides rejected; ambiguous movement never selects first',()=>{
  const f=fixture();f.invoice.guides.push('101');assert.throws(()=>reconcileEnexInvoice(f),/repetida/);
  const g=fixture();g.movements.push({...g.movements[0],id:'other'});
  const r=reconcileEnexInvoice(g);assert.equal(r.ready,false);assert.equal(r.problems[0].code,'ambiguous');
});
test('Company and portal form part of matching identity',()=>{
  const f=fixture();f.movements[0].empresa='OTHER';
  assert.equal(reconcileEnexInvoice(f).ready,false);
  const g=fixture();g.movements[0].portal='empresa';
  assert.equal(reconcileEnexInvoice(g).ready,false);
  const h=fixture();h.movements.push({...h.movements[0],id:'unrelated',empresa:'OTHER'});
  assert.equal(reconcileEnexInvoice(h).rows.length,2);
});
test('No new center assignment; compatible existing work may resolve its center',()=>{
  const f=fixture();f.movements[0].assignment={obra_id:9};
  assert.equal(reconcileEnexInvoice(f).ready,false);
  f.works=[{id:9,empresa:'TEST',centro_gestion_id:1}];
  assert.equal(reconcileEnexInvoice(f).rows[0].center_id,1);
  f.movements[0].assignment.centro_gestion_id=2;
  assert.equal(reconcileEnexInvoice(f).problems[0].code,'invalid_center');
});
test('Inactive or other-company center rejected',()=>{
  for(const patch of [{activo:false},{empresa:'OTHER'}]){
    const f=fixture();Object.assign(f.centers[0],patch);
    assert.equal(reconcileEnexInvoice(f).problems[0].code,'invalid_center');
  }
});
test('Bad invoice totals, unsupported amounts and empty guides fail closed',()=>{
  for(const patch of [{net:1},{total:1},{liters_milli:0},{liters_milli:NaN},{shellcard_net:1.1},{guides:[]},{guides:['=1','102']}]){
    const f=fixture();Object.assign(f.invoice,patch);assert.throws(()=>reconcileEnexInvoice(f));
  }
});
test('Signed distribution is deterministic, exact and independent of source ordering',()=>{
  const weights=[{key:'a',weight:1},{key:'b',weight:1},{key:'c',weight:1}];
  assert.deepEqual([...allocateInvoiceTotal(-10,weights).values()],[-4,-3,-3]);
  const original=fixture(),reversed=fixture();reversed.movements.reverse();reversed.invoice.guides.reverse();
  assert.deepEqual(reconcileEnexInvoice(original),reconcileEnexInvoice(reversed));
  for(let n=1;n<50;n++){
    const items=Array.from({length:n},(_,i)=>({key:String(i).padStart(3,'0'),weight:(i+1)*12345}));
    for(const amount of [-599466,0,1,53158,5387591])assert.equal([...allocateInvoiceTotal(amount,items).values()].reduce((a,b)=>a+b,0),amount);
  }
});
test('Same center with both categories remains two consumption rows, not two charges',()=>{
  const f=fixture();f.movements[1].assignment.centro_gestion_id=1;
  const r=reconcileEnexInvoice(f);assert.equal(r.groups.length,2);
  assert.ok(r.groups.every(g=>g.center_id===1));assert.equal(total(r.groups,'total'),f.invoice.total);
});
test('Sample invoice totals are conserved with synthetic matches (not a real reconciliation)',()=>{
  const f=fixture([1331000,2264000]);
  Object.assign(f.invoice,{liters_milli:3595000,fuel_net:5334433,shellcard_net:53158,net:5387591,vat:1023642,specific_tax:-599466,total:5811767});
  const r=reconcileEnexInvoice(f);assert.equal(r.ready,true);
  assert.equal(total(r.rows,'total'),5811767);assert.equal(total(r.rows,'adjusted_liters_milli'),3595000);
});
