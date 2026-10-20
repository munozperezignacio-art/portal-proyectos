import test from 'node:test';
import assert from 'node:assert/strict';
import { responsibleRecipients } from '../../../supabase/functions/detectar-reportes-pendientes/recipients.js';
import { can, mergePermissions } from './permissionsCatalog.js';

test('custom technical office role can edit without receiving delete permission',()=>{
  const user={empresa:'Test',rol:'Oficina Técnica',rol_base:'Personalizado',nivel:4};
  const permissions=mergePermissions({'obras.avances.editar':true,'obras.avances.eliminar':false});
  assert.equal(can(user,permissions,'obras.avances.editar'),true);
  assert.equal(can(user,permissions,'obras.avances.eliminar'),false);
  assert.equal(can({...user,rol_base:'Administrador'},permissions,'obras.avances.eliminar'),false);
});
test('assigned work notifications reach only the responsible people for that work',()=>{
  const rule={empresa:'Test',destinatarios_roles:['Oficina Técnica'],destinatarios_usuarios:[],condiciones:{alcance_tipo:'asignadas'},correos_adicionales:['global@test.cl']};
  const users=[
    {id:1,empresa:'Test',rol:'Oficina Técnica',correo:'a@test.cl',obras:'A'},
    {id:2,empresa:'Test',rol:'Oficina Técnica',correo:'b@test.cl',obras:'B'},
    {id:3,empresa:'Otra',rol:'Oficina Técnica',correo:'other@test.cl',obras:'A'},
    {id:4,empresa:'Test',rol:'Otro',correo:'otro@test.cl',obras:'A'},
  ];
  assert.deepEqual(responsibleRecipients(rule,users,'A').emails,['a@test.cl']);
  assert.deepEqual(responsibleRecipients(rule,users,'B').emails,['b@test.cl']);
  assert.deepEqual(responsibleRecipients(rule,users,'C').emails,[]);
  assert.deepEqual(responsibleRecipients({...rule,destinatarios_usuarios:['4']},users,'A').emails,['a@test.cl','otro@test.cl']);
});
test('explicit responsibility supports a person with no mail and selected work boundaries',()=>{
  const rule={empresa:'Test',destinatarios_usuarios:['1'],condiciones:{alcance_tipo:'seleccionadas',obras_seleccionadas:['A']},correos_adicionales:['jefe@test.cl']};
  const users=[{id:1,nombre:'Persona',empresa:'Test'}];
  assert.equal(responsibleRecipients(rule,users,'A').users.length,1);
  assert.deepEqual(responsibleRecipients(rule,users,'A').emails,['jefe@test.cl']);
  assert.deepEqual(responsibleRecipients(rule,users,'B'),{users:[],emails:[]});
});
