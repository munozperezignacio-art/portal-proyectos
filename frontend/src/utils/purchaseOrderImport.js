const text = value => String(value ?? '').trim();
const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/º/g,'°').toUpperCase();
export const ocKey = value => normalize(value).replace(/\s/g, '');
export const COST_TYPES = ['Materiales', 'Mano de Obra', 'Maquinaria & Equipos', 'Subcontratos', 'Alimentación', 'Alojamiento', 'Combustible', 'Traslado de equipos', 'Instalación de faenas', 'Elementos de protección personal', 'Costos financieros', 'Traslado de personal', 'Reparaciones', 'Gastos Generales / Varios'];
function date(value) {
  if (typeof value === 'number') value = new Date(Date.UTC(1899,11,30) + Math.floor(value)*86400000).toISOString().slice(0,10);
  const match = text(value).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso)) && new Date(iso).toISOString().slice(0,10) === iso ? iso : '';
}
export function parsePurchaseOrders(matrix) {
  const headerIndex = matrix.findIndex(row => row.some(cell => normalize(cell) === 'N° OC'));
  if (headerIndex < 0) throw new Error('No se encontró el encabezado «N° OC» de iConstruye.');
  const headers = matrix[headerIndex].map(normalize);
  for (const label of ['N° OC','NOMBRE OC','CENTRO DE GESTION','PROVEEDOR','FECHA DE CREACION','MONEDA','MONTO','ESTADO']) {
    if (!headers.includes(label)) throw new Error(`Falta la columna ${label}.`);
  }
  const seen = new Set();
  return matrix.slice(headerIndex+1).filter(row=>row.some(cell=>text(cell))).map((row,index)=>{
    const get = name => row[headers.indexOf(name)];
    const totalValue = get('MONTO');
    const total = typeof totalValue === 'number' ? totalValue : Number(text(totalValue).replace(/\$/g,'').replace(/\./g,'').replace(',','.'));
    const result = {row:index+headerIndex+2, num_oc:text(get('N° OC')), nombre:text(get('NOMBRE OC')), proveedor_nombre:text(get('PROVEEDOR')), centro:text(get('CENTRO DE GESTION')), fecha_costo:date(get('FECHA DE CREACION')), estado: text(get('ESTADO')), moneda:normalize(get('MONEDA')), monto_total:total, errors:[]};
    if (!result.num_oc || !result.nombre || !result.proveedor_nombre || !result.centro) result.errors.push('Faltan OC, concepto, proveedor o centro.');
    if (!result.fecha_costo) result.errors.push('Fecha de creación inválida.');
    if (result.moneda !== 'CLP') result.errors.push('Esta importación requiere montos CLP; no convierte UF ni USD.');
    if (!Number.isSafeInteger(total) || total <= 0) result.errors.push('Monto CLP inválido.');
    if (normalize(result.estado) !== 'OC APROBADA') result.errors.push('Solo se importan OC aprobadas.');
    if (seen.has(ocKey(result.num_oc))) result.errors.push('OC repetida dentro del archivo.');
    seen.add(ocKey(result.num_oc));
    result.monto = Math.round(total/1.19);
    result.monto_iva = total-result.monto;
    return result;
  });
}
export function purchaseOrderPayload(row, company, work, type, state) {
  if (row.errors.length || !company || !work || !COST_TYPES.includes(type) || !['pendiente','confirmado','proyectado'].includes(state)) throw new Error('Revisa la OC, obra, tipo y estado antes de guardar.');
  return {empresa:company,obra_nombre:work,num_oc:row.num_oc,nombre:row.nombre,proveedor_nombre:row.proveedor_nombre,proveedor_rut:null,fecha_costo:row.fecha_costo,tipo_costo:type,estado_costo:state,monto:row.monto,monto_iva:row.monto_iva,monto_total:row.monto_total,origen:'iconstruye_oc',asociar_factura:false,num_factura:null,imputaciones:[]};
}
