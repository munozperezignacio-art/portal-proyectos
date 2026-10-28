import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFormAnswers, workCatalog } from '../../supabase/functions/_shared/formFields.mjs';

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
