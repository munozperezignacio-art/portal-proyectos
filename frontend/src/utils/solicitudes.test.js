import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUEST_CATEGORIES, isRequestClosed, requestTransitions } from './solicitudes.js';
test('las cinco categorías operacionales están disponibles', () => assert.equal(new Set(REQUEST_CATEGORIES).size, 5));
test('aprobar no equivale a entregar ni cerrar', () => { assert.equal(isRequestClosed('Aprobada'), false); assert.deepEqual(requestTransitions('Aprobada'), ['Completada']); });
test('los estados terminales no pueden reabrirse', () => { for (const state of ['Rechazada', 'Completada']) { assert.equal(isRequestClosed(state), true); assert.deepEqual(requestTransitions(state), []); } });
test('no se puede completar una solicitud pendiente', () => assert.equal(requestTransitions('Pendiente').includes('Completada'), false));
