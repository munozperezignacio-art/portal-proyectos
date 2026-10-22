import {validateMovement,planImport} from '../utils/enex.js';
export async function readEnex(db,company) {
 const rows=[],seen=new Set();
 for(let offset=0;offset<100000;offset+=500) {
  const {data,error}=await db.from('enex_movements').select('id,empresa,portal,document,occurred_local,vehicle,kind,liters_milli,amount_signed,ingested_at,enex_assignments(obra_id,centro_gestion_id,note)').eq('empresa',company).order('id').range(offset,offset+499);
  if(error)throw Error('No se pudo leer Enex; compruebe acceso y migración');
  for(const r of data||[]) {
   if(r.empresa!==company)throw Error('Empresa inesperada');
   if(seen.has(r.id))throw Error('Consulta cambió durante paginación; vuelva a consultar');
   seen.add(r.id);
   rows.push({...r,occurred_local:r.occurred_local.replace('T',' ').slice(0,19),assignment:Array.isArray(r.enex_assignments)?r.enex_assignments[0]:r.enex_assignments});
  }
  if((data||[]).length<500)return rows;
 }
 throw Error('Consulta supera el límite; no se mostrarán totales parciales');
}
export async function importEnex(db,company,rows) {
 const validated=rows.map(validateMovement);
 const {data,error}=await db.rpc('import_enex_movements',{p_company:company,p_rows:validated});
 if(error)throw Error('Importación no confirmada. Consulte registros antes de repetir; puede existir un conflicto.');
 const stored=await readEnex(db,company);
 const verification=planImport(company,validated,stored);
 if(verification.added.length)throw Error('Persistencia incompleta; no enviar resumen');
 return {result:data,stored};
}

export async function sendEnexSummary(db,company,recipient,rows) {
 if(!recipient || !rows.length || rows.some(r=>r.empresa!==company || !r.id))throw Error('Selección persistida y destinatario propio requeridos');
 const {data,error}=await db.functions.invoke('enviar-correo-sistema',{body:{permissionKey:'maquinaria.enex.enviar',to:[recipient],enexCompany:company,enexMovementIds:rows.map(r=>r.id)}});
 if(error || data?.error || data?.success!==true || typeof data?.id!=='string' || !data.id)throw Error('Envío no confirmado. No repetir: comprobar el resultado con el proveedor.');
 return data.id;
}
