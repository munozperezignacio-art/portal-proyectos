import test from 'node:test';
import assert from 'node:assert/strict';
import {extractInvoiceDraft,parseInvoiceLiters,parseInvoicePeso} from '../src/utils/enexInvoicePdf.js';

const products=[
 'DIXSEL 237 LT SD Extra Petróleo Diesel G-B LT 237 1.481,6076 351.141',
 'DIXTRA 66 LT SD Extra Petróleo Diesel G-A1 LT 66 1.453,2273 95.913',
];
const guides='43532335 43679426 43695459 43731555 43772652';
const invoice=[
 'Nº: 4158588','3298688 16-11-2026','4158588','2471445',
 ...products,
 'IE $/L DSF al 05/11/26 Base 108,6600 Variable -285,9062 182 LT',
 'IE $/L DSF al 12/11/26 Base 108,6600 Variable -165,0473 121 LT',
 guides,'Nombre: R.U.T.: MONTO NETO 447.054','I.V.A. 19.00% 84.940',
 'IMP. ESPEC. DIESEL -39.082','MONTO EXENTO','TOTAL A PAGAR 492.912',
 '17349358','77777777070707000777171670574401007633675264313340073113052221530140',
];

test('4158588: sum both fuel rows, five guides without Shellcard; exclude tax liters and unrelated numbers',()=>{
 const d=extractInvoiceDraft(invoice);
 assert.equal(d.document,'4158588');assert.equal(d.liters,'303');assert.equal(d.guides,guides);
 assert.equal(d.fuel_net,'447.054');assert.equal(d.shellcard_net,'0');
 assert.equal(d.net,'447.054');assert.equal(d.vat,'84.940');assert.equal(d.specific_tax,'-39.082');
 assert.equal(d.total,'492.912');assert.equal(d.exempt,'');
});

test('Original G-B + Shellcard format preserves quantities, adjustment and multiline guides',()=>{
 const d=extractInvoiceDraft([
  'DIXSEL 3595 LT SD Extra Petróleo Diesel G-B LT 3.595 1.483,8478 5.334.433',
  'Z-AJUSTE 1 UN Cargo o Descuento Shellcard UN 1 53.158,0000 53.158',
  '42014872 43167078','43920714 43920772','MONTO NETO 5.387.591',
 ]);
 assert.equal(d.liters,'3.595');assert.equal(d.fuel_net,'5.334.433');assert.equal(d.shellcard_net,'53.158');
 assert.equal(d.guides,'42014872 43167078 43920714 43920772');
});

test('Quantities use integer milliliters; totals support sub-thousand whole pesos',()=>{
 const d=extractInvoiceDraft(['SD Extra Petróleo Diesel G-B LT 0,1 100,0000 10','SD Extra Petróleo Diesel G-A1 LT 0,2 100,0000 20']);
 assert.equal(parseInvoiceLiters(d.liters),300);assert.equal(parseInvoicePeso(d.fuel_net),30);
});

test('Never present partial fuel totals when a fuel line cannot be read',()=>{
 const d=extractInvoiceDraft([...products,'SD Extra Petróleo Diesel G-A1 LT ilegible 1.000,0000 100.000','MONTO NETO 547.054']);
 assert.equal(d.liters,'');assert.equal(d.fuel_net,'');assert.equal(d.shellcard_net,'');
});

test('Do not infer an absent adjustment if the invoice net differs',()=>{
 assert.equal(extractInvoiceDraft([...products,'MONTO NETO 448.054']).shellcard_net,'');
});
