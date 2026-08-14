import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedBookActions, canDispatchPayment, canTransitionNonConformity, nextNonConformityState, paymentDispatchType } from '../src/utils/workflowRules.js';

test('Estados de Pago respetan revisión antes de aprobación', () => {
  assert.equal(paymentDispatchType('Borrador'), 'revision');
  assert.equal(paymentDispatchType('En aprobación'), 'aprobacion');
  assert.equal(paymentDispatchType('Aprobado'), null);
  assert.equal(canDispatchPayment('Borrador', 'aprobacion'), false);
  assert.equal(canDispatchPayment('En aprobación', 'aprobacion'), true);
});

test('no conformidades avanzan una etapa a la vez', () => {
  assert.equal(nextNonConformityState('Abierta'), 'En corrección');
  assert.equal(nextNonConformityState('En corrección'), 'Verificada');
  assert.equal(nextNonConformityState('Verificada'), 'Cerrada');
  assert.equal(nextNonConformityState('Cerrada'), null);
  assert.equal(canTransitionNonConformity('Abierta', 'Cerrada'), false);
});

test('Libro de Obras expone únicamente acciones de su etapa', () => {
  assert.deepEqual(allowedBookActions('Emitido'), ['autorizar']);
  assert.deepEqual(allowedBookActions('Autorizado'), ['enviar_cliente']);
  assert.deepEqual(allowedBookActions('Observado por cliente'), ['modificar_reenviar', 'aceptar_comentarios']);
  assert.deepEqual(allowedBookActions('Cerrado'), []);
});
