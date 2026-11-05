import test from 'node:test';import assert from 'node:assert/strict';
import {parseExpenseReports,expenseKey,expensePayload,suggestedCategory} from './expenseReportImport.js';
const summary=[['Correlativo','Estado','Gastos','Monto Aprobado'],['820-1','Contabilizada',2,1190]];
const headers=['Propietario del Gasto','Nombre del Gasto','Estado del Gasto','Tipo de Documento','Numero de Documento','Fecha de Emisión','Rut Proveedor','Nombre Proveedor','Monto Aprobado','Código Unidad de Rendición','Nombre Unidad de Rendición','Código Centro de Costo','Nombre Centro de Costo','Categoría','Subcategoría','Nº Rendición Asociada','Unidad/Unidades de Rendición cargada y porcentaje de distribución'];
const row=['Persona','Colacion','Aprobada','Boleta Electrónica (39)','1','04-11-2026','123-K','Proveedor',1190,'820','Coquimbo','','','Alimentación y Alojamiento','Colación','820-1','Coquimbo@820: 100.00%'];
const rejected=[...row];rejected[2]='Rechazada';rejected[4]='2';rejected[8]=500;
test('829: adding 106 rows without a summary preserves the keys of the 20 previously imported',async()=>{
 const rows=Array.from({length:126},(_,i)=>{const r=[...row];r[4]=String(i+1);r[9]='829';r[15]=i<20?'829-A':'829-B';r[16]='Obra@829: 100.00%';return r;});
 const s=[summary[0],['829-A','Contabilizada',20,20*1190]];
 const previous=parseExpenseReports(s,[headers,...rows.slice(0,20)]);
 const saved=new Set(await Promise.all(previous.rows.map(expenseKey)));
 const current=parseExpenseReports(s,[headers,...rows]);
 assert.equal(current.rows.length,126);assert.equal(current.rows.filter(r=>r.withoutSummary).length,106);
 assert.ok(current.rows.every(r=>!r.errors.length));
 const keys=await Promise.all(current.rows.map(expenseKey));assert.equal(keys.filter(k=>!saved.has(k)).length,106);
});
test('includes approved detail without summary, excludes rejected and reconciles net and IVA',async()=>{
 const unrelated=[...row];unrelated[15]='829-1';
 const parsed=parseExpenseReports(summary,[headers,row,rejected,unrelated]);assert.equal(parsed.rows.length,2);assert.equal(parsed.rejected,1);assert.equal(parsed.unmatched,1);assert.deepEqual(parsed.issues,[]);assert.equal(parsed.rows[1].withoutSummary,true);assert.deepEqual(parsed.rows[1].errors,[]);
 const g=parsed.rows[0];assert.deepEqual(g.errors,[]);assert.equal(g.net,1000);assert.equal(g.vat,190);assert.equal(g.date,'2026-11-04');
 const key=await expenseKey(g),changed={...g,total:2380};assert.equal(await expenseKey(changed),key);
 const payload=expensePayload(g,'EMINSG','Coquimbo','Alimentación',key);assert.equal(payload.monto+payload.monto_iva,payload.monto_total);assert.equal(payload.estado_costo,'confirmado');assert.deepEqual(payload.imputaciones,[]);
 assert.equal(suggestedCategory('Combustible',''),'Combustible');assert.equal(suggestedCategory('Arriendos',''),'');
});
test('blocks missing detail, ambiguous duplicates, shared allocations and invalid dates',()=>{
 assert.ok(parseExpenseReports(summary,[headers,row]).issues.length);
 const double=parseExpenseReports([summary[0],['820-1','Contabilizada',2,2380]],[headers,row,row]);assert.ok(double.rows.every(r=>r.errors.some(e=>e.includes('indistinguibles'))));
 const invalid=[...row];invalid[5]='31-02-2026';invalid[16]='Coquimbo@820: 50.00%, Otra@829: 50.00%';
 const p=parseExpenseReports(summary,[headers,invalid,rejected]);assert.ok(p.rows[0].errors.length>=2);
 assert.throws(()=>expensePayload(p.rows[0],'A','B','Materiales','key'));
});
