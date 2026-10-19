import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkerMatrix, validateWorkerRows, parseWorkerDate, workerContractSummary } from './workerImport.js';

const headers = ['Rut', 'Nombre', 'Teléfono', 'Correo electrónico', 'Fecha Inicio contrato', 'Fecha término contrato', 'Causal de término', 'Sueldo Base', 'Cargo'];
const sample = ['12345678-5', 'Persona Prueba', '+56912345678', 'persona@example.com', '2026-01-01', '3000-01-01', 'sinDefinir', 650000, 'Operador'];
const validate = (items, existing = []) => {
  const parsed = readWorkerMatrix([['Listado de Empleados'], headers, ...items]);
  return validateWorkerRows({ ...parsed, company: 'Prueba', existing, today: '2026-10-19' });
};
test('detects titled export headers, actual row numbers and empty intermediate columns', () => {
  const parsed = readWorkerMatrix([['Título'], ['Rut', '', 'Nombre', 'Cargo'], ['12345678-5', 'IGNORAR', 'Nombre correcto', 'Operador']]);
  assert.equal(parsed.rows[0].row, 3);
  assert.equal(parsed.rows[0].values.Nombre, 'Nombre correcto');
  assert.throws(() => readWorkerMatrix([['Rut', 'Nombre', 'Cargo', 'RUT']]), /repetidos/);
});
test('both year 3000 sentinel dates become indefinite and no fabricated banking or social-security data', () => {
  for (const end of ['3000-01-01', '3000-12-31', new Date('3000-01-01T00:00:00Z')]) {
    const row = [...sample]; row[5] = end;
    const result = validate([row])[0];
    assert.deepEqual(result.errors, []);
    assert.equal(result.data.tipo_contrato, 'Indefinido');
    assert.equal(result.data.fecha_vencimiento_contrato, null);
    assert.equal(result.data.afp, null); assert.equal(result.data.banco, null);
  }
});
test('existing same-company RUT always omitted despite formatting and invalid incoming fields', () => {
  const row = [...sample]; row[0] = '12.345.678-5'; row[1] = ''; row[5] = 'NOT A DATE';
  const result = validate([row], [{ empresa: 'Prueba', rut: '123456785' }])[0];
  assert.equal(result.existing, true); assert.deepEqual(result.errors, []);
  assert.equal(validate([sample], [{ empresa: 'Otra', rut: '12345678-5' }])[0].existing, false);
});
test('all duplicate new rows blocked, invalid RUT/date/amount rejected', () => {
  assert.ok(validate([sample, sample]).every(row => row.errors.some(error => error.includes('repetido'))));
  const row = [...sample]; row[0] = '12345678-9'; row[5] = '31-02-2026'; row[7] = -1;
  const result = validate([row])[0];
  assert.equal(result.errors.length, 3);
  assert.equal(parseWorkerDate('31/02/2026'), '');
  assert.equal(parseWorkerDate('30/11/2026'), '2026-11-30');
  assert.equal(parseWorkerDate(25569), '1970-01-01');
});
test('renunciation is retained with actual date, without guessing original contract type', () => {
  const row = [...sample]; row[5] = '2026-10-07'; row[6] = '159i2';
  const result = validate([row])[0];
  assert.deepEqual(result.errors, []);
  assert.equal(result.data.causal_termino_contrato, '159i2');
  assert.equal(result.data.tipo_contrato, 'No informado');
  assert.equal(workerContractSummary(result.data, '2026-10-19'), 'Renuncia efectiva: 2026-10-07');
});
test('future terms stay planned; future starts distinguished; 159i4 and 159i5 map types', () => {
  for (const [cause, type] of [['159i4', 'Plazo Fijo'], ['159i5', 'Por Obra o Faena']]) {
    const row = [...sample]; row[5] = '2026-12-31'; row[6] = cause;
    const result = validate([row])[0];
    assert.deepEqual(result.errors, []); assert.equal(result.data.tipo_contrato, type);
    assert.match(workerContractSummary(result.data, '2026-10-19'), /^Término previsto/);
  }
  assert.match(workerContractSummary({ fecha_inicio_contrato: '2026-10-21' }, '2026-10-19'), /^Ingreso futuro/);
});
test('contract contradictions and unknown causes not silently accepted', () => {
  const row = [...sample]; row[6] = '159i2';
  assert.ok(validate([row])[0].errors.some(error => error.includes('ficticia')));
  row[6] = 'desconocida';
  assert.ok(validate([row])[0].errors.some(error => error.includes('no reconocida')));
});
