import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAudit, auditActor } from '../src/utils/documentAudit.js';

test('registra identidad, empresa, acción y medio del firmante', () => {
  const entry = auditActor({ nombre: 'Ana Pérez', rut: '12.345.678-5', cargo: 'ITO', empresa: 'Mandante Uno' }, 'Aprobó', 'Aprobado', 'Conforme');
  assert.equal(entry.nombre, 'Ana Pérez');
  assert.equal(entry.rut, '12.345.678-5');
  assert.equal(entry.cargo, 'ITO');
  assert.equal(entry.empresa, 'Mandante Uno');
  assert.equal(entry.medio, 'Sistema Obraxis');
  assert.equal(entry.accion, 'Aprobó');
  assert.equal(entry.estado, 'Aprobado');
  assert.ok(!Number.isNaN(Date.parse(entry.fecha_hora)));
});

test('appendAudit preserva el historial y no modifica el arreglo original', () => {
  const previous = [{ accion: 'Emitió' }];
  const result = appendAudit(previous, { accion: 'Revisó' });
  assert.deepEqual(result.map(item => item.accion), ['Emitió', 'Revisó']);
  assert.equal(previous.length, 1);
  assert.deepEqual(appendAudit(null, { accion: 'Creó' }), [{ accion: 'Creó' }]);
});
