import { readAllMachineryRows, readMachineryExport, createMachineryPdf } from './machineryExports';
import { generateFormPdf } from './pdfGenerator';

export const recordKey = record => `${record.kind}:${record.id}`;
export function checklistForm(response) {
  const form=response.respuestas?._qr_formulario||response.prevencion_formularios;
  if(!form)throw Error('No se pudo recuperar el formato del checklist.');
  const fields=Array.isArray(form.campos)?form.campos:form.campos?.items||[];
  const control=form.campos?.control_documental||{};
  return {...form,campos:fields,codigo:control.codigo||form.codigo,revision:control.revision||form.revision,fecha_revision:control.fecha_revision||form.fecha_revision};
}
export async function readEquipmentRecords(db,{company,equipmentId,workName,canReadChecklists=false}) {
  if(!company||!equipmentId)throw Error('Falta identificar el equipo.');
  const scoped=table=>{
    let q=db.from(table).select('*').eq('empresa',company).eq('equipo_id',equipmentId);
    return workName?q.eq('obra_nombre',workName):q;
  };
  const [usage,maintenance,checklists]=await Promise.all([
    readAllMachineryRows(()=>scoped('maquinaria_uso_diario')),
    readAllMachineryRows(()=>scoped('maquinaria_mantenciones')),
    canReadChecklists?readAllMachineryRows(()=>{
      let q=db.from('prevencion_respuestas').select('*,prevencion_formularios!inner(*)').eq('prevencion_formularios.empresa',company).eq('respuestas->_qr_identidad->>equipo_id',String(equipmentId));
      return workName?q.eq('proyecto_nombre',workName):q;
    }):Promise.resolve([]),
  ]);
  return [...usage.map(r=>({...r,kind:'Reporte',date:r.fecha})),...maintenance.map(r=>({...r,kind:'Mantención',date:r.fecha})),...checklists.map(r=>({...r,kind:'Checklist',date:r.respuestas?._qr_identidad?.fecha||String(r.created_at).slice(0,10)}))].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
}
const safe = value=>String(value||'equipo').replace(/[^\p{L}\p{N}_.-]+/gu,'_').slice(0,80);
export async function equipmentRecordPdf(db, record, {company,equipment,workName,companyBranding}) {
  const companyLogo=companyBranding?.logo_base64||companyBranding?.logo_url;
  if(record.kind==='Reporte'){
    const data=await readMachineryExport(db,{company,equipmentId:equipment.id,workName,reportId:record.id});
    const doc=await createMachineryPdf({...data,companyLogo});
    return new Uint8Array(doc.output('arraybuffer'));
  }
  let form,answers,metadata,mainSignature;
  if(record.kind==='Checklist'){
    form=checklistForm(record);answers=record.respuestas;mainSignature=record.firma_url;
    metadata={proyecto_nombre:record.proyecto_nombre||'',inspector:record.inspector||'',fecha:record.date};
  }else if(record.kind==='Mantención'){
    const values=[['fecha','Fecha',record.fecha],['equipo','Equipo',record.equipo_tipo||equipment.tipo],['patente','Código / patente',record.equipo_patente||equipment.patente],['tipo','Tipo de mantenimiento',record.tipo],['horometro','Lectura del medidor',record.horometro],['descripcion','Trabajo realizado',record.descripcion],['responsable','Responsable',record.responsable],['proveedor','Proveedor',record.proveedor],['registrado','Registrado por',record.registrado_por]];
    form={titulo:'REGISTRO DE MANTENIMIENTO DE MAQUINARIA',empresa:company,campos:values.map(([id,label])=>({id,label,type:'text'}))};
    answers=Object.fromEntries(values.map(([id,,v])=>[id,v??'No informado']));
    metadata={proyecto_nombre:record.obra_nombre||'',inspector:record.responsable||record.registrado_por||'',fecha:record.date};
  }else throw Error('Tipo de registro no compatible.');
  const base64=await generateFormPdf({form,metadata,answers,mainSignature,companyLogo});
  return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
}
export async function buildEquipmentRecordDownload(records,options,render) {
  if(!records.length)throw Error('Selecciona al menos un registro.');
  if(records.length>100)throw Error('Descarga hasta 100 registros por selección.');
  const files=[];
  for(const record of records)files.push({name:`${safe(record.kind)}_${safe(options.equipment.patente)}_${safe(record.date)}_${safe(record.id)}.pdf`,bytes:await render(record)});
  if(files.length===1)return {name:files[0].name,blob:new Blob([files[0].bytes],{type:'application/pdf'})};
  const {default:JSZip}=await import('jszip');const zip=new JSZip();
  files.forEach(file=>zip.file(file.name,file.bytes));
  return {name:`Registros_${safe(options.equipment.patente)}.zip`,blob:await zip.generateAsync({type:'blob',compression:'DEFLATE'})};
}
