export async function listEnexInvoices(db,company){
 const result=[];
 for(let offset=0;offset<10000;offset+=100){
  const {data,error}=await db.from('enex_invoices').select('id,empresa,document,portal,issued_at,invoice,source_path,reconciliation').eq('empresa',company).order('issued_at',{ascending:false}).order('id').range(offset,offset+99);
  if(error)throw Error('No se pudo consultar el historial de facturas');
  result.push(...data);if(data.length<100)return result;
 }throw Error('Historial demasiado extenso; solicite una consulta acotada');
}
export async function previewEnexInvoice(db,invoice){
 const {data,error}=await db.rpc('preview_enex_invoice',{p_invoice:invoice});
 if(error)throw Error(error.message||'No fue posible conciliar');
 if(!data||typeof data.ready!=='boolean')throw Error('Respuesta de conciliación inválida');
 return data;
}
export async function issueEnexInvoice(db,id,file,invoice,expected){
 const path=`${invoice.empresa}/${id}/source.pdf`;
 if(file){
  const uploaded=await db.storage.from('enex-invoices').upload(path,file,{contentType:'application/pdf',upsert:false});
  if(uploaded.error)throw Error('No se confirmó la carga del PDF. Revise el historial antes de repetir.');
 }
 const {data,error}=await db.rpc('issue_enex_invoice',{p_id:id,p_invoice:invoice,p_expected:expected});
 if(error)throw Error(`${error.message}. Revise el historial antes de volver a emitir.`);
 const record=Array.isArray(data)&&data.length===1?data[0]:data;
 if(!record||record.id!==id||record.empresa!==invoice.empresa)throw Error('Emisión no confirmada. Revise el historial; no repita el envío.');
 return record;
}

const draftColumns='id,empresa,issuer_rut,document,portal,source_path,invoice,revision,created_at,updated_at,emitted_at';
export async function listEnexInvoiceDrafts(db,company,page=0){
 const {data,error}=await db.from('enex_invoice_drafts').select(draftColumns).eq('empresa',company).is('emitted_at',null).order('created_at',{ascending:false}).order('id').range(page*20,page*20+20);
 if(error)throw Error('No se pudieron consultar las facturas pendientes');
 const records=[];
 // Bound concurrent reconciliation requests; the 21st row only indicates another page.
 for(let i=0;i<Math.min(data.length,20);i+=4){
  records.push(...await Promise.all(data.slice(i,Math.min(i+4,20)).map(async r=>{
   try{return {...r,reconciliation:await previewEnexInvoice(db,r.invoice),checked_at:new Date().toISOString()};}
   catch(e){return {...r,check_error:e.message};}
  })));
 }
 return {records,hasMore:data.length>20};
}
export async function readEnexInvoiceDraft(db,company,id){
 const {data,error}=await db.from('enex_invoice_drafts').select(draftColumns).eq('empresa',company).eq('id',id).maybeSingle();
 if(error||!data)throw Error('No se pudo abrir la factura pendiente');
 if(data.emitted_at)throw Error('Esta factura ya fue emitida. Consulte el historial');
 return {...data,reconciliation:await previewEnexInvoice(db,data.invoice)};
}
export async function saveEnexInvoiceDraft(db,id,file,invoice,revision,uploadState){
 if(!revision){
  const {data:existing,error}=await db.from('enex_invoice_drafts').select(draftColumns).eq('empresa',invoice.empresa).eq('issuer_rut',invoice.issuer_rut).eq('document',invoice.document).maybeSingle();
  if(error)throw Error('No se pudo comprobar si la factura ya está guardada');
  if(existing)throw Error('Esta factura ya está guardada. Ábrala desde Facturas pendientes; no vuelva a subir el PDF');
  if(!file)throw Error('Seleccione el PDF original para guardar la factura');
  if(uploadState.id!==id||!uploadState.uploaded){
   const {error:uploadError}=await db.storage.from('enex-invoices').upload(`${invoice.empresa}/${id}/source.pdf`,file,{contentType:'application/pdf',upsert:false});
   if(uploadError)throw Error('No se confirmó la carga del PDF. Revise Pendientes antes de repetir.');
   uploadState.id=id;uploadState.uploaded=true;
  }
 }
 const {data,error}=await db.rpc('save_enex_invoice_draft',{p_id:id,p_invoice:invoice,p_revision:revision||0});
 if(error)throw Error(error.message||'No se confirmó el guardado. Revise Facturas pendientes antes de repetir.');
 const record=Array.isArray(data)&&data.length===1?data[0]:data;
 if(!record||record.id!==id||record.empresa!==invoice.empresa)throw Error('Guardado no confirmado. Revise Facturas pendientes antes de repetir.');
 return record;
}
