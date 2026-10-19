import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFallbackRule,fallbackRuleArgs,fallbackRuleState,fallbackWorkerRows} from './workerFallbackRules.js';
const personal=[{id:1,empresa:'A',nombre:'José Álvarez',rut:'12.345.678-5'},{id:2,empresa:'A',nombre:'Ana Soto'},{id:3,empresa:'A',nombre:'Pedro Pérez'},{id:4,empresa:'B',nombre:'Otro'}];
const rules=[{id:1,empresa:'A',trabajador_id:2,activa:false,fecha_desde:'2026-01-01'},{id:2,empresa:'A',trabajador_id:3,activa:true,fecha_desde:'2026-01-01',fecha_hasta:'2026-10-01'}];
test('search by name ignores accents and RUT ignores formatting, always company scoped',()=>{
  assert.deepEqual(fallbackWorkerRows(personal,rules,{company:'A',search:'jose',filter:'todas'}).map(row=>row.worker.id),[1]);
  assert.deepEqual(fallbackWorkerRows(personal,rules,{company:'A',search:'12345678',filter:'todas'}).map(row=>row.worker.id),[1]);
  assert.equal(fallbackWorkerRows(personal,rules,{company:'A',filter:'todas'}).length,3);
});
test('no rule differs from inactive, future and expired; no-current includes all of those',()=>{
  assert.deepEqual(fallbackWorkerRows(personal,rules,{company:'A',filter:'sin'}).map(row=>row.worker.id),[1]);
  assert.equal(fallbackWorkerRows(personal,rules,{company:'A',filter:'sin_vigente',today:'2026-10-19'}).length,3);
  assert.equal(fallbackRuleState({activa:true,fecha_desde:'2027-01-01'},'2026-10-19').key,'futura');
  assert.equal(fallbackRuleState({activa:true,fecha_desde:'2026-01-01',fecha_hasta:'2026-10-19'},'2026-10-19').current,true);
});
const form=()=>({...emptyFallbackRule(),centro_gestion_id:'10',fecha_desde:'2026-10-19'});
test('bulk arguments contain no closing hour, default to no HE and preserve existing rules',()=>{
  const args=fallbackRuleArgs({company:'A',selected:['2','1','1'],form:{...form(),horas_extra_diarias:'3'}});
  assert.deepEqual(args.p_trabajadores,[1,2]);assert.equal(args.p_horas_extra,0);assert.equal(args.p_reemplazar,false);
  assert.equal(Object.hasOwn(args,'p_hora'),false);
});
test('HE requires explicit positive hours; replacement is explicit; rejects invalid selections and dates',()=>{
  assert.throws(()=>fallbackRuleArgs({company:'A',selected:['1'],form:{...form(),modo_he:'con'}}),/horas extra/);
  const args=fallbackRuleArgs({company:'A',selected:['1','2'],form:{...form(),modo_he:'con',horas_extra_diarias:'1.5'},replace:true});
  assert.equal(args.p_horas_extra,1.5);assert.equal(args.p_reemplazar,true);
  assert.throws(()=>fallbackRuleArgs({company:'A',selected:[],form:form()}),/Selecciona/);
  assert.throws(()=>fallbackRuleArgs({company:'A',selected:['1'],form:{...form(),fecha_hasta:'2026-10-01'}}),/anterior/);
  assert.throws(()=>fallbackRuleArgs({company:'A',selected:['1'],form:{...form(),dias_semana:[]}}),/días/);
  assert.throws(()=>fallbackRuleArgs({company:'A',selected:['1'],form:{...form(),modo_he:'con',horas_extra_diarias:'25'}}),/horas extra/);
});
