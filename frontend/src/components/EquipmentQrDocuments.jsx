import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function EquipmentQrDocuments({ equipmentId, token, canConfigure=false }) {
 const [documents,setDocuments]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function load(){
  const result=token ? await supabase.functions.invoke('equipment-documents',{body:{token}}) : await supabase.from('equipo_documentos_qr').select('id,nombre,publico_qr').eq('equipo_id',equipmentId).order('created_at');
  if(result.error||result.data?.error)throw Error(result.data?.error||'No se pudieron cargar los documentos.');
  return token?result.data.documents:result.data;
 }
 useEffect(()=>{let active=true;setLoading(true);setDocuments([]);setError('');load().then(rows=>{if(active)setDocuments(rows);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[equipmentId,token]);
 async function upload(event){
  const file=event.target.files?.[0];event.target.value='';if(!file||busy)return;
  if(!['application/pdf','image/jpeg','image/png'].includes(file.type)||file.size>10485760){setError('Selecciona un PDF, JPG o PNG de hasta 10 MB.');return;}
  setBusy(true);setError('');
  try{
   const id=crypto.randomUUID();
   const inserted=await supabase.from('equipo_documentos_qr').insert({id,equipo_id:equipmentId,nombre:file.name.slice(0,180),publico_qr:false});
   if(inserted.error)throw inserted.error;
   const uploaded=await supabase.storage.from('equipment-qr-documents').upload(id,file,{contentType:file.type,upsert:false});
   if(uploaded.error)throw Error('No se completó la carga. El documento permanece privado.');
   setDocuments(await load());
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function toggle(doc){
  if(busy)return;setBusy(true);setError('');
  try{const result=await supabase.from('equipo_documentos_qr').update({publico_qr:!doc.publico_qr}).eq('id',doc.id).eq('equipo_id',equipmentId).select('id').single();if(result.error)throw result.error;setDocuments(await load());}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function download(doc){
  if(busy)return;setBusy(true);setError('');
  try{
   const result=token?await supabase.functions.invoke('equipment-documents',{body:{token,documentId:doc.id}}):await supabase.storage.from('equipment-qr-documents').createSignedUrl(doc.id,60,{download:doc.nombre});
   if(result.error||result.data?.error)throw Error(result.data?.error||'No se pudo abrir el documento.');
   const a=document.createElement('a');a.href=result.data.url||result.data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';a.click();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
  <h2 className="text-lg font-bold">Documentos del equipo</h2>
  {!token&&<p className="text-sm text-slate-600">Los archivos son privados por defecto. Activa «Visible en QR» solo para documentos que puedan consultarse públicamente. Los enlaces abiertos caducan en un minuto.</p>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {canConfigure&&!token&&<label className="block text-sm font-semibold">Subir documento (PDF, JPG o PNG · máximo 10 MB)<input disabled={busy} aria-label="Subir documento del equipo" type="file" accept="application/pdf,image/jpeg,image/png" onChange={upload} className="mt-2 block w-full rounded-xl border border-slate-300 p-3 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-indigo-900"/></label>}
  {loading?<p role="status">Cargando documentos…</p>:!documents.length?<p className="text-sm text-slate-500">{token?'No hay documentos publicados para este equipo.':'No hay documentos cargados.'}</p>:<ul className="space-y-2">{documents.map(doc=><li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
   <button disabled={busy} onClick={()=>download(doc)} className="break-all text-left text-sm font-semibold text-indigo-800 underline">{doc.nombre}</button>
   {!token&&(canConfigure?<label className="flex items-center gap-2 text-sm"><input disabled={busy} type="checkbox" checked={doc.publico_qr} onChange={()=>toggle(doc)} className="h-5 w-5 accent-indigo-800"/>Visible en QR</label>:<span className="text-xs">{doc.publico_qr?'Visible en QR':'Privado'}</span>)}
  </li>)}</ul>}
 </section>;
}
