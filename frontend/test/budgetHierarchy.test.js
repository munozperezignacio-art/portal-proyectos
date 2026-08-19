import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBudgetHierarchy, getBudgetGroupTotal, isBudgetGroup } from '../src/utils/budgetHierarchy.js';

test('construye capítulos, subcapítulos y códigos padre', () => {
    const result = buildBudgetHierarchy([
      { CODIGO: '1', TIPO_FILA: 'CAPITULO' },
      { CODIGO: '1.1', TIPO_FILA: 'SUBCAPITULO' },
      { CODIGO: '1.1.1', TIPO_FILA: 'PARTIDA' },
      { CODIGO: '2', TIPO_FILA: 'CAPITULO' },
    ]);
    assert.deepEqual(result.map(row => [row.tipo_item, row.parent_codigo, row.nivel]), [
      ['CAPITULO', '', 0], ['SUBCAPITULO', '1', 1], ['PARTIDA', '1.1', 2], ['CAPITULO', '', 0],
    ]);
});

test('totaliza todos los descendientes ejecutables', () => {
    const rows = [
      { id: 1, codigo: '1', tipo_item: 'CAPITULO' },
      { id: 2, parent_id: 1, codigo: '1.1', tipo_item: 'SUBCAPITULO' },
      { id: 3, parent_id: 2, codigo: '1.1.1', tipo_item: 'PARTIDA', cantidad: 2, costo_unitario: 50 },
    ];
    assert.equal(isBudgetGroup(rows[1]), true);
    assert.equal(getBudgetGroupTotal(rows[0], rows), 100);
});
