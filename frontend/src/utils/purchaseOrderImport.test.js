import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePurchaseOrders,purchaseOrderPayload,ocKey} from './purchaseOrderImport.js';
const headers=['Nº OC','Tipo de Orden','Nombre OC','Centro de Gestión','Proveedor','Solicitante','Fecha de Creación','Fecha de Aprobación','Moneda','Monto','Estado','Enviada a PNI'];
const row=['820-135','Normal','traslado de equipos','820 CAM COQUIMBO','Proveedor','Persona','27-10-2026','29-10-2026','CLP',18683000,'OC Aprobada','Pendiente'];
test('iConstruye reads useful fields and preserves gross via net plus VAT',()=>{
 const [r]=parsePurchaseOrders([headers,row,Array(12).fill(null)]);
 assert.deepEqual(r.errors,[]);assert.equal(r.monto,15700000);assert.equal(r.monto_iva,2983000);assert.equal(r.fecha_costo,'2026-10-27');
 const p=purchaseOrderPayload(r,'EMINSG','Obra','Traslado de equipos','pendiente');
 assert.equal(p.monto+p.monto_iva,p.monto_total);assert.equal(p.asociar_factura,false);assert.equal(p.proveedor_rut,null);assert.deepEqual(p.imputaciones,[]);
});
test('rejects duplicate OC, foreign currency, invalid date, amount and unapproved orders',()=>{
 const invalid=[...row];invalid[6]='31-02-2026';invalid[8]='UF';invalid[9]=-1;invalid[10]='Anulada';
 const parsed=parsePurchaseOrders([headers,row,invalid]);assert.equal(parsed[1].errors.length,5);
 assert.throws(()=>purchaseOrderPayload(parsed[1],'EMINSG','Obra','Materiales','confirmado'));
 assert.equal(ocKey(' 820 -135 '),'820-135');
});
test('rounding reconciles every peso and required columns are checked',()=>{
 const r=[...row];r[9]=100;const [p]=parsePurchaseOrders([headers,r]);assert.equal(p.monto,84);assert.equal(p.monto_iva,16);
 assert.throws(()=>parsePurchaseOrders([['N° OC'],['1']]),/Falta/);
});

test('fractional CLP from iConstruye is importable with editable categories and reconciled amounts',()=>{
 for(const [value,total,net,vat] of [[1648066.7,1648067,1384930,263137],[493106.25,493106,414375,78731],['$1.648.066,70',1648067,1384930,263137],['493.106,25',493106,414375,78731]]){
  const input=[...row];input[9]=value;
  const [parsed]=parsePurchaseOrders([headers,input]);
  assert.deepEqual(parsed.errors,[]);
  for(const category of ['Reparaciones','Maquinaria & Equipos']){
   const payload=purchaseOrderPayload(parsed,'EMINSG','Obra',category,'confirmado');
   assert.equal(payload.tipo_costo,category);
   assert.equal(payload.monto_total,total);assert.equal(payload.monto,net);assert.equal(payload.monto_iva,vat);
   assert.equal(payload.monto+payload.monto_iva,payload.monto_total);
  }
  assert.match(parsePurchaseOrders([headers,input,input])[1].errors.join(' '),/repetida/);
 }
});

test('invalid amounts remain blocked after rounding',()=>{
 for(const value of [null,'',NaN,Infinity,-1,0,0.1,Number.MAX_SAFE_INTEGER+1,'no es monto']){
  const input=[...row];input[9]=value;
  const [parsed]=parsePurchaseOrders([headers,input]);
  assert.ok(parsed.errors.includes('Monto CLP inválido.'));
  assert.throws(()=>purchaseOrderPayload(parsed,'EMINSG','Obra','Reparaciones','confirmado'));
 }
});
