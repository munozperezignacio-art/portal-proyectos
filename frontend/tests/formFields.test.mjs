import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFormAnswers, workCatalog, responsibleCatalog } from '../../supabase/functions/_shared/formFields.mjs';

test('required controls include choices, photos, signatures, rating and work', () => {
  for (const type of ['text','textarea','date','time','select','radio','checkbox','rating','photo','signature','data_lookup','repeater']) {
    assert.equal(validateFormAnswers([{id:'f',label:'Prueba',type,required:true}],{}).length,1,type);
  }
});
test('calendar and time reject impossible values', () => {
  for (const value of ['2026-02-30','28/10/2026','bad']) assert.ok(validateFormAnswers([{id:'f',type:'date'}],{f:value}).length);
  assert.deepEqual(validateFormAnswers([{id:'f',type:'date'}],{f:'2028-02-29'}),[]);
  for (const value of ['25:00','08:65','8am']) assert.ok(validateFormAnswers([{id:'f',type:'time'}],{f:value}).length);
  assert.deepEqual(validateFormAnswers([{id:'f',type:'time'}],{f:'08:30'}),[]);
});
test('choices and repeated required fields validate on server', () => {
  assert.ok(validateFormAnswers([{id:'f',type:'select',options:['A']}],{f:'B'}).length);
  assert.ok(validateFormAnswers([{id:'f',type:'checkbox',options:['A']}],{f:['B']}).length);
  assert.ok(validateFormAnswers([{id:'f',type:'rating',maxRating:5}],{f:6}).length);
  assert.ok(validateFormAnswers([{id:'f',type:'repeater',subFields:[{id:'d',type:'date',required:true}]}],{f:[{}]}).length);
});
test('work catalog exposes configured ficha data only, not contact or costs', () => {
  const [record] = workCatalog({autofillKeys:['admin_contrato','cliente_email','costos','ubicacion']},[{id:1,nombre:'Obra',centro_gestion_id:7,admin_contrato:'Administrador',cliente_email:'private',costos:500,ubicacion:'Lugar'}]);
  assert.equal(record.admin_contrato,'Administrador');
  assert.equal(record.ubicacion,'Lugar');
  assert.equal(record.cliente_email,undefined);
  assert.equal(record.costos,undefined);
});

test('responsibles include every matching active person, only authorized centers, multiple cargos', () => {
  const people = [
    {id:1,nombre:'Uno',cargo:'Supervisor',centro_gestion_id:7,rut:'PRIVATE'},
    {id:2,nombre:'Dos',cargo:'Supervisor',centro_gestion_id:7},
    {id:3,nombre:'Tres',cargo:'Capataz',centro_gestion_id:9},
    {id:4,nombre:'Otro cargo',cargo:'Operador',centro_gestion_id:7},
    {id:5,nombre:'Terminado',cargo:'Supervisor',centro_gestion_id:7,fecha_vencimiento_contrato:'2026-10-01'},
    {id:6,nombre:'Otra obra',cargo:'Supervisor',centro_gestion_id:9},
    {id:7,nombre:'Futuro',cargo:'Supervisor',centro_gestion_id:7,fecha_inicio_contrato:'2026-11-01'}
  ];
  const assignments = [{trabajador_id:3,centro_gestion_id:7,fecha_inicio:'2026-10-01',fecha_termino:null}];
  const records=responsibleCatalog({cargos:['Supervisor','Capataz']},people,assignments,[{id:7}],'2026-10-28');
  assert.deepEqual(records.map(item=>item.nombre),['Uno','Dos','Tres']);
  assert.ok(records.every(item=>!('rut' in item)));
  assert.deepEqual(responsibleCatalog({cargos:[]},people,assignments,[{id:7}],'2026-10-28'),[]);
});
