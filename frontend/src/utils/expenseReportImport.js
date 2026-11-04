import {COST_TYPES} from './purchaseOrderImport.js';
const text=v=>String(v??'').trim();
export const normalize=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/º/g,'°').replace(/\s+/g,' ').toUpperCase();
const amount=v=>typeof v==='number'?v:Number(text(v).replace(/\$/g,'').replace(/\./g,'').replace(',','.'));
export const mappingKey=(category,subcategory)=>JSON.stringify([normalize(category),normalize(subcategory)]);
export function suggestedCategory(category,subcategory){
 const c=normalize(category),s=normalize(subcategory);
 if(c==='COMBUSTIBLE')return 'Combustible';
 if(c==='MATERIALES')return 'Materiales';
 if(c.startsWith('ALIMENTACION Y ALOJAMIENTO'))return s==='ALOJAMIENTO'?'Alojamiento':['COLACION','RESTAURANT','SUPERMERCADO'].includes(s)?'Alimentación':'';
 if(['TRANSPORTES PERSONAL','TRASPORTE AEREO','TRANSPORTE AEREO'].includes(c))return 'Traslado de personal';
 if(c==='OTROS GG')return 'Gastos Generales / Varios';
 return ''; // Arriendos and unknown categories require an explicit choice.
}
function rows(matrix,required){
 const index=matrix.findIndex(r=>r.some(v=>normalize(v)===required[0]));
 if(index<0)throw Error(`No se encontró la columna ${required[0]}.`);
 const headers=matrix[index].map(normalize);
 for(const h of required)if(!headers.includes(h))throw Error(`Falta la columna ${h}.`);
 return matrix.slice(index+1).filter(r=>r.some(v=>text(v))).map((r,i)=>({row:i+index+2,get:h=>r[headers.indexOf(h)]}));
}
function day(v){
 if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);
 const m=text(v).match(/^(\d{2})-(\d{2})-(\d{4})(?:\s.*)?$/);
 if(!m)return '';
 const d=`${m[3]}-${m[2]}-${m[1]}`;
 return !Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:'';
}
export function parseExpenseReports(summaryMatrix,expenseMatrix){
 const summaries=rows(summaryMatrix,['CORRELATIVO','ESTADO','GASTOS','MONTO APROBADO']);
 const reports=new Map();
 for(const r of summaries){const id=text(r.get('CORRELATIVO'));if(!id||reports.has(id))throw Error(`Rendición vacía o repetida: ${id}.`);reports.set(id,{id,count:amount(r.get('GASTOS')),total:amount(r.get('MONTO APROBADO')),state:normalize(r.get('ESTADO'))});}
 const all=rows(expenseMatrix,['PROPIETARIO DEL GASTO','NOMBRE DEL GASTO','ESTADO DEL GASTO','TIPO DE DOCUMENTO','NUMERO DE DOCUMENTO','FECHA DE EMISION','RUT PROVEEDOR','NOMBRE PROVEEDOR','MONTO APROBADO','CODIGO UNIDAD DE RENDICION','NOMBRE UNIDAD DE RENDICION','CODIGO CENTRO DE COSTO','NOMBRE CENTRO DE COSTO','CATEGORIA','SUBCATEGORIA','N° RENDICION ASOCIADA']);
 const result=[];let unmatched=0,rejected=0;
 for(const r of all){
  const report=reports.get(text(r.get('N° RENDICION ASOCIADA')));if(!report){unmatched++;continue;}
  const state=normalize(r.get('ESTADO DEL GASTO'));
  const g={row:r.row,report:report.id,state,name:text(r.get('NOMBRE DEL GASTO')),owner:text(r.get('PROPIETARIO DEL GASTO')),date:day(r.get('FECHA DE EMISION')),docType:text(r.get('TIPO DE DOCUMENTO')),doc:text(r.get('NUMERO DE DOCUMENTO')),rut:text(r.get('RUT PROVEEDOR')),provider:text(r.get('NOMBRE PROVEEDOR')),total:amount(r.get('MONTO APROBADO')),unit:text(r.get('CODIGO UNIDAD DE RENDICION')),unitName:text(r.get('NOMBRE UNIDAD DE RENDICION')),center:text(r.get('CODIGO CENTRO DE COSTO')),centerName:text(r.get('NOMBRE CENTRO DE COSTO')),category:text(r.get('CATEGORIA')),subcategory:text(r.get('SUBCATEGORIA')),distribution:text(r.get('UNIDAD/UNIDADES DE RENDICION CARGADA Y PORCENTAJE DE DISTRIBUCION')),errors:[]};
  if(state==='RECHAZADA'){rejected++;}else if(state!=='APROBADA')g.errors.push('Gasto no aprobado.');
  if(report.state!=='CONTABILIZADA')g.errors.push('Rendición no contabilizada.');
  if(!g.date||!g.name||!g.unit)g.errors.push('Falta fecha válida, concepto o unidad.');
  if(!Number.isSafeInteger(g.total)||g.total<=0)g.errors.push('Monto aprobado CLP inválido.');
  if(!g.distribution||!new RegExp(`@${g.unit.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}:\\s*100(?:[.,]0+)?%$`).test(g.distribution)|| (g.distribution.match(/%/g)||[]).length!==1)g.errors.push('Distribución compartida o ausente: requiere revisión; no se carga el 100% a una sola obra.');
  g.net=Math.round(g.total/1.19);g.vat=g.total-g.net;g.mapping=mappingKey(g.category,g.subcategory);
  // No exported expense ID: amount-independent identity detects later amount discrepancies.
  g.identity=JSON.stringify([g.report,g.date,g.docType,g.doc.replace(/[.\s]/g,''),g.rut.replace(/[.\s]/g,''),g.owner,g.name].map(normalize));
  result.push(g);
 }
 const issues=[];
 for(const report of reports.values()){
  const detail=result.filter(g=>g.report===report.id),approved=detail.filter(g=>g.state==='APROBADA');
  const invalid=detail.length!==report.count||approved.reduce((s,g)=>s+g.total,0)!==report.total;
  if(invalid){const message=`Rendición ${report.id}: el detalle no coincide con la cantidad o el monto aprobado del resumen.`;issues.push(message);detail.forEach(g=>g.errors.push(message));}
 }
 const identities=new Map();result.filter(g=>g.state!=='RECHAZADA').forEach(g=>identities.set(g.identity,(identities.get(g.identity)||0)+1));
 result.forEach(g=>{if(identities.get(g.identity)>1)g.errors.push('Gastos indistinguibles en el Excel: revisar antes de importar.');});
 return {rows:result.filter(g=>g.state!=='RECHAZADA'),rejected,unmatched,reports:reports.size,issues};
}
export async function expenseKey(row){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(row.identity));return 'iconstruye_rendicion:'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export function expensePayload(row,company,work,type,key){
 if(row.errors.length||row.state!=='APROBADA'||!COST_TYPES.includes(type)||!company||!work||!key)throw Error('Revisa gasto, categoría y obra antes de importar.');
 return {empresa:company,obra_nombre:work,nombre:row.name,tipo_costo:type,proveedor_nombre:row.provider||null,proveedor_rut:row.rut||null,fecha_costo:row.date,monto:row.net,monto_iva:row.vat,monto_total:row.total,estado_costo:'confirmado',origen:'iconstruye_rendicion',asociar_factura:/FACTURA/i.test(row.docType),num_factura:/FACTURA/i.test(row.docType)?row.doc||null:null,imputaciones:[],importacion_clave:key,importacion_datos:{rendicion:row.report,responsable:row.owner,documento_tipo:row.docType,documento_numero:row.doc,categoria:row.category,subcategoria:row.subcategory,unidad:row.unit,unidad_nombre:row.unitName,centro:row.center,centro_nombre:row.centerName,total_origen:row.total,criterio_iva:'Total incluye IVA 19% · regla confirmada por empresa'}};
}
