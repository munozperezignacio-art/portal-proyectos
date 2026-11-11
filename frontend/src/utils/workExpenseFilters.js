import {costDate} from './costControl.js';
export const sources={iconstruye_oc:'Exportación OC',iconstruye_rendicion:'Exportación rendiciones',manual:'Manual',otro:'Otro / no identificado'};
export const sourceOf=c=>Object.hasOwn(sources,c.origen)?c.origen:'otro';
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function matchesExpense(c,f){
 const date=costDate(c),q=norm(f.search);
 return (!f.source||sourceOf(c)===f.source)&&(!f.category||c.tipo_costo===f.category)&&(!f.from||date>=f.from)&&(!f.to||(date&&date<=f.to))&&
 (!q||[c.nombre,c.proveedor_nombre,c.proveedor_rut,c.num_factura,c.num_oc,c.importacion_datos?.rendicion,c.importacion_datos?.documento_numero,c.importacion_datos?.responsable].some(v=>norm(v).includes(q)));
}
