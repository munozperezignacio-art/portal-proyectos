import test from 'node:test';
import assert from 'node:assert/strict';
import * as X from 'xlsx';
import {parsePileWorkbook,normalizeFront} from '../src/utils/specialtyWorkbook.js';
const parse=rows=>{const b=X.utils.book_new();X.utils.book_append_sheet(b,X.utils.aoa_to_sheet(rows),'Mis puntos');return parsePileWorkbook(X.write(b,{type:'buffer',bookType:'xlsx'}));};
test('detects moved columns and header rows, optional fronts, decimal commas',()=>{
 const b=parse([['Proyecto'],[],['Este','Frente de trabajo','N° Punto','Norte'],['3.008,63','Frente Principal',1,'5.004,33']]);
 assert.equal(b.catalog[0].norte,5004.33);assert.equal(b.catalog[0].este,3008.63);assert.equal(b.catalog[0].sourceRow,4);assert.equal(b.catalog[0].etapa,'');
 assert.equal(normalizeFront('  FRÉNTE   Principal '),'frente principal');
});
test('rejects invalid coordinates, missing identifiers and duplicates without partial import',()=>{
 assert.throws(()=>parse([['Pila','Norte','Este'],[1,'abc',3]]),/inválidas/);
 assert.throws(()=>parse([['Pila','Norte','Este'],[null,1,3]]),/Falta el número/);
 assert.throws(()=>parse([['Pila','Norte','Este'],[1,2,3],[1,2,3]]),/duplicada/);
});
