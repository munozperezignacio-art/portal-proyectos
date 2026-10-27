import test from 'node:test';
import assert from 'node:assert/strict';
import { reportFields, relatedFailures, historySheets, readAllMachineryRows } from './machineryExports.js';

const report = { id: 5, equipo_id: 9, empresa: 'Demo', fecha: '2026-10-27', obra_nombre: 'Obra A', combustible_cargado: 0, horometro_inicial: 0, horometro_final: 8, horas_trabajadas: 8 };
test('preserves zero and distinguishes unknown from no fuel', () => {
  const fields = Object.fromEntries(reportFields(report));
  assert.equal(fields['Horómetro inicial'], 0);
  assert.equal(fields['Carga de combustible'], 'No, según el reporte');
  assert.equal(Object.fromEntries(reportFields({ ...report, combustible_cargado: null }))['Carga de combustible'], 'No informado');
  assert.equal(fields['Paralización'], 'No informada');
});
test('failure context never mixes equipment, work or dates', () => {
  const f = { id: 1, equipo_id: 9, fecha: '2026-10-27', obra_nombre: 'Obra A', detuvo_equipo: true };
  const events = [f, { ...f, equipo_id: 10 }, { ...f, obra_nombre: 'Obra B' }, { ...f, fecha: '2026-10-26' }];
  assert.deepEqual(relatedFailures(report, events), [f]);
  assert.equal(Object.fromEntries(reportFields(report, {}, {}, events))['Paralización'], 'Sí, registrada en la fecha');
});
test('Excel retains numeric values and labels current work responsibilities', () => {
  const sheets = historySheets({ company: 'Demo', equipment: {}, usage: [report], failures: [], maintenance: [], works: [{ nombre: 'Obra A', admin_contrato: 'Ana', oficina_tecnica: 'Luis' }] });
  assert.equal(sheets.length, 4);
  assert.equal(sheets[1][1][0]['Horas trabajadas (h)'], 8);
  assert.equal(sheets[1][1][0]['Administrador (ficha actual)'], 'Ana');
});
test('reads every page and does not export partial results on failure', async () => {
  const source = [{id:1},{id:2},{id:3}];
  const factory = () => ({ order: () => ({ range: async (a,b) => ({data:source.slice(a,b+1)}) }) });
  assert.deepEqual(await readAllMachineryRows(factory, 2), source);
  await assert.rejects(readAllMachineryRows(() => ({ order: () => ({ range: async () => ({error:{message:'denied'}}) }) })), /denied/);
});
test('rejects repeated IDs during pagination', async () => {
  await assert.rejects(readAllMachineryRows(() => ({ order: () => ({ range: async () => ({data:[{id:1}]}) }) }), 1), /cambió/);
});
