import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBc3 } from '../src/utils/bc3Parser.js';

const SAMPLE = `~V|RIB Spain|FIEBDC-3/2020|Presto 24||ANSI|
~K|\\2\\2\\5\\2\\2\\2\\2\\CLP\\|0\\10\\27.33\\0\\0|3\\2\\\\3\\5\\\\2\\2\\2\\2\\2\\2\\2\\2\\CLP\\|
~C|0##||OBRA DE EJEMPLO|2400|010124|0|
~C|01||OBRAS PRELIMINARES|2400|010124|0|
~C|01.01||INSTALACIONES PROVISORIAS|2400|010124|0|
~C|01.01.01|m2|CIERRE PERIMETRAL|1200|010124|0|
~C|MO001|h|MAESTRO PRIMERA|8000|010124|1|
~C|MAT001|m2|PANEL DE CIERRE|10000|010124|3|
~D|0##|01\\1\\1\\|
~D|01|01.01\\1\\1\\|
~D|01.01|01.01.01\\2\\1\\|
~D|01.01.01|MO001\\1\\0.25\\MAT001\\1\\1\\|`;

test('interpreta jerarquía y recursos de un BC3 de Presto', () => {
  const result = parseBc3(SAMPLE, { fileName: 'ejemplo.bc3' });
  assert.deepEqual(result.items.map(item => [item.codigo, item.tipo_item, item.parent_codigo]), [
    ['01', 'CAPITULO', ''], ['01.01', 'SUBCAPITULO', '01'], ['01.01.01', 'PARTIDA', '01.01']
  ]);
  assert.equal(result.items[2].cantidad, 2);
  assert.equal(result.items[2].costo_unitario, 1200);
  assert.deepEqual(result.resources.map(resource => [resource.tipo, resource.cantidad_unidad]), [
    ['Mano de Obra', 0.25], ['Material', 1]
  ]);
  assert.equal(result.metadata.emitter, 'RIB Spain');
  assert.equal(result.metadata.currency, 'CLP');
});

test('rechaza contenido que no es FIEBDC presupuestario', () => {
  assert.throws(() => parseBc3('texto cualquiera'), /registros ~C y ~D/);
});

test('resuelve capítulos Presto con # y conserva el detalle original del recurso', () => {
  const source = `~V|RIB Spain|FIEBDC-3/2024|Presto 26||ANSI|
~C|0##||RUTA|100|190826|0|
~C|1#|GL|CAPÍTULO|100|190826|0|
~C|1.1#|GL|SUBCAPÍTULO|100|190826|0|
~C|1.1.1|m2|PARTIDA|100|190826|0|
~C|M001|kg|MATERIAL|25|160626|3|
~D|0##|1\\1\\1\\|
~D|1#|1.1\\1\\1\\|
~D|1.1#|1.1.1\\1\\12.5\\|
~D|1.1.1|M001\\2\\0.4\\|`;
  const result = parseBc3(source);
  assert.deepEqual(result.items.map(item => [item.codigo, item.tipo_item, item.parent_codigo]), [
    ['1#', 'CAPITULO', ''], ['1.1#', 'SUBCAPITULO', '1#'], ['1.1.1', 'PARTIDA', '1.1#']
  ]);
  assert.equal(result.items[2].cantidad, 12.5);
  assert.deepEqual(result.resources[0], {
    codigo_recurso: 'M001', recurso: 'MATERIAL', tipo: 'Material', tipo_bc3: '3', categoria: 'Presto / BC3',
    unidad: 'kg', costo_unitario: 25, fecha_precio: '160626', factor_descomposicion: 2,
    cantidad_descomposicion: 0.4, cantidad_unidad: 0.8, porcentaje_bc3: false, rendimiento: 1,
    indicadores_ambientales: {}, consumo_combustible_lh: 0, codigo_partida: '1.1.1'
  });
});

test('mantiene los porcentajes repetidos como recursos de cada capítulo', () => {
  const source = `~V|RIB Spain|FIEBDC-3/2024|Presto 26||ANSI|
~C|0##||OBRA|0|190826|0|
~C|1#|GL|CAPÍTULO 1|0|190826|0|
~C|2#|GL|CAPÍTULO 2|0|190826|0|
~C|1.1|m2|PARTIDA 1|10|190826|0|
~C|2.1|m2|PARTIDA 2|10|190826|0|
~C|%%|GL|IMPONDERADOS|7|190826|0|
~D|0##|1\\1\\1\\2\\1\\1\\|
~D|1#|1.1\\1\\1\\%%\\1\\0.07\\|
~D|2#|2.1\\1\\1\\%%\\1\\0.07\\|`;
  const result = parseBc3(source);
  assert.deepEqual(result.items.map(item => item.codigo), ['1#', '1.1', '2#', '2.1']);
  assert.equal(result.resources.length, 0);
  assert.deepEqual(result.globalCosts, [{ codigo_origen: '%%', concepto: 'IMPONDERADOS', tipo: 'Porcentaje', valor: 7, prorratear: true }]);
});
