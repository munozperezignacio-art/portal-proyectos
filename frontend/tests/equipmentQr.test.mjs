import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRut,checklistCandidates,withEquipmentFields,assertProtectedEquipmentFields} from '../../supabase/functions/_shared/equipmentQr.mjs';
test('RUT normalizado, con dígito verificador válido',()=>{
 assert.equal(normalizeRut('12.345.678-5'),'123456785');
 assert.equal(normalizeRut('12.345.678-4'),null);
 assert.equal(normalizeRut(''),null);
 assert.equal(normalizeRut('123456785 OR 1=1'),null);
});
test('Vincula solo coincidencias específicas de la misma empresa',()=>{
 const forms=[{id:35,empresa:'EMINSG',titulo:'Lista de verificación excavadora'},{id:37,empresa:'EMINSG',titulo:'Lista de verificación excavadora Lodrill RG-OP-01-03'},{id:38,empresa:'OTRA',titulo:'Lista de verificación excavadora'}];
 assert.deepEqual(checklistCandidates({empresa:'EMINSG',tipo:'EXCAVADORA KOMATSU LODRILL DH20'},forms),[37]);
 assert.deepEqual(checklistCandidates({empresa:'EMINSG',tipo:'EXCAVADORA'},forms),[35]);
 assert.deepEqual(checklistCandidates({empresa:'EMINSG',tipo:'BROCA PARA EXCAVADORA LODRILL'},forms),[]);
});
test('Identidad y horómetro protegidos; accesorios sin lecturas ficticias',()=>{
 const fields=withEquipmentFields([],{meter:true});
 assert.throws(()=>assertProtectedEquipmentFields(fields,fields.filter(f=>f.id!=='qr_horometro')));
 assert.throws(()=>assertProtectedEquipmentFields(fields,fields.map(f=>({...f,required:false}))));
 assert.throws(()=>assertProtectedEquipmentFields(fields,fields.map(f=>({...f,hidden:true}))));
 assert.doesNotThrow(()=>assertProtectedEquipmentFields(fields,fields));
 assert.ok(!withEquipmentFields([]).some(f=>f.id==='qr_horometro'));
});
