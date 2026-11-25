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
 const uploaded=await db.storage.from('enex-invoices').upload(path,file,{contentType:'application/pdf',upsert:false});
 if(uploaded.error)throw Error('No se confirmó la carga del PDF. Revise el historial antes de repetir.');
 const {data,error}=await db.rpc('issue_enex_invoice',{p_id:id,p_invoice:invoice,p_expected:expected});
 if(error)throw Error(`${error.message}. Revise el historial antes de volver a emitir.`);
 const record=Array.isArray(data)&&data.length===1?data[0]:data;
 if(!record||record.id!==id||record.empresa!==invoice.empresa)throw Error('Emisión no confirmada. Revise el historial; no repita el envío.');
 return record;
}
