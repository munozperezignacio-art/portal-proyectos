import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInvoicePeso,parseInvoiceLiters} from '../src/utils/enexInvoicePdf.js';

test('Invoice 4161315: dots are thousands, including negative specific tax',()=>{
 const values=['5.334.433','53.158','5.387.591','1.023.642','-599.466','0','5.811.767'];
 assert.deepEqual(values.map(v=>parseInvoicePeso(v)),[5334433,53158,5387591,1023642,-599466,0,5811767]);
 assert.equal(parseInvoiceLiters('3.595'),3595000);
 assert.equal(parseInvoicePeso('5334433'),5334433);
});

test('A missing exempt amount identifies the field, not decimal misuse, and is not silently zero',()=>{
 for(const empty of ['', '  ',null,undefined])assert.throws(()=>parseInvoicePeso(empty,'Monto exento'),/Monto exento: falta completar el monto/);
 assert.equal(parseInvoicePeso('0','Monto exento'),0);
});

test('Invalid formats and out-of-range amounts identify the affected field',()=>{
 for(const value of ['5.33.433','1,50','123.45','NaN','Infinity','1e3'])assert.throws(()=>parseInvoicePeso(value,'IVA'),/IVA: formato no válido/);
 assert.throws(()=>parseInvoicePeso('1000000000001','Total factura'),/Total factura: importe fuera de rango/);
});
