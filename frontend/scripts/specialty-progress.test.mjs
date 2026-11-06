import test from 'node:test';
import assert from 'node:assert/strict';
import {specialtyProgress} from '../src/utils/specialtyProgress.mjs';

test('diagram respects cutoff, closed sessions and selected partidas', () => {
  const state = {elements: [1,2,3,4].map(id => ({id, partida_id: id === 4 ? 20 : 10, este: id, norte: id, sesion_id: 'claimed'})), sessions: [
    {estado:'historica',fecha:'2026-11-01',datos:{pilas:[{element_id:1,terminada:true}]}},
    {estado:'cerrada',fecha:'2026-11-06',datos:{pilas:[{element_id:2,terminada:true}]}},
    {estado:'abierta',fecha:'2026-11-01',datos:{pilas:[{element_id:3,terminada:true}]}}
  ]};
  const points = specialtyProgress(state, [10], '2026-11-04');
  assert.deepEqual(points.map(p => p.status), ['done','pending','pending']);
  assert.equal(points[0].completedOn, '2026-11-01');
  assert.equal(specialtyProgress(state,[10],'2026-11-06')[1].status,'done');
  assert.deepEqual(specialtyProgress(state,[], '2026-11-06'),[]);
});
