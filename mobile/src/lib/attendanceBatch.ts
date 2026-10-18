type Row = Record<string, any>;
export const normalizedAttendanceRut=(value: any)=>String(value || '').replace(/[^0-9kK]/g,'').toUpperCase();
export const attendanceWorkerKey=(worker: Row)=>String(worker.id ?? (normalizedAttendanceRut(worker.rut) || worker.nombre));
const name=(value: any)=>String(value || '').trim().toLocaleLowerCase();
export function buildManualAttendanceBatch(base: Row,workers: Row[],existing: Row[]=[]) {
  if(!workers.length || workers.length>200)throw new Error('Selecciona entre 1 y 200 trabajadores por lote.');
  const seen=new Set();
  return workers.map(worker=>{
    if(worker.empresa && worker.empresa!==base.empresa)throw new Error('La selección contiene trabajadores de otra empresa.');
    const rut=normalizedAttendanceRut(worker.rut);
    if(!rut || !worker.nombre?.trim())throw new Error('Todos los trabajadores del lote deben tener nombre y RUT.');
    if(seen.has(rut))throw new Error(`RUT repetido en la selección: ${worker.nombre}.`);seen.add(rut);
    if(existing.some(row=>normalizedAttendanceRut(row.rut_normalizado || row.rut)===rut || (!row.rut && !row.rut_normalizado && name(row.trabajador)===name(worker.nombre))))throw new Error(`${worker.nombre} ya tiene marcaje en esa obra y fecha. Desmárcalo o edita su registro existente.`);
    return {...base,trabajador:worker.nombre.trim(),rut:worker.rut.trim(),rut_normalizado:rut,verificado_qr:false,firma_base64:null,latitud:null,longitud:null,distancia_obra_m:null};
  });
}
