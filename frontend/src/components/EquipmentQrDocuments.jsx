import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function EquipmentQrDocuments({ equipmentId, token, canConfigure=false }) {
 const [name,setName]=useState(''),[expiry,setExpiry]=useState(''),[file,setFile]=useState(null),[editing,setEditing]=useState(null),[showDeleted,setShowDeleted]=useState(false),[removeId,setRemoveId]=useState(null);
 const [documents,setDocuments]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function load(){
  const result=token ? await supabase.functions.invoke('equipment-documents',{body:{token}}) : await supabase.from('equipo_documentos_qr').select('id,nombre,publico_qr,fecha_vencimiento,deleted_at').eq('equipo_id',equipmentId).order('created_at');
  if(result.error||result.data?.error)throw Error(result.data?.error||'No se pudieron cargar los documentos.');
  return token?result.data.documents:result.data;
 }
 useEffect(()=>{let active=true;setLoading(true);setDocuments([]);setError('');load().then(rows=>{if(active)setDocuments(rows);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[equipmentId,token]);
 async function upload(event){
  event.preventDefault();const uploadForm=event.currentTarget;if(!file||!name.trim()||busy)return;
  if(!['application/pdf','image/jpeg','image/png'].includes(file.type)||file.size>10485760){setError('Selecciona un PDF, JPG o PNG de hasta 10 MB.');return;}
  setBusy(true);setError('');
  try{
   const id=crypto.randomUUID();
   const inserted=await supabase.from('equipo_documentos_qr').insert({id,equipo_id:equipmentId,nombre:name.trim(),fecha_vencimiento:expiry||null,publico_qr:false});
   if(inserted.error)throw inserted.error;
   const uploaded=await supabase.storage.from('equipment-qr-documents').upload(id,file,{contentType:file.type,upsert:false});
   if(uploaded.error)throw Error('No se completó la carga. El documento permanece privado.');
   setDocuments(await load());setName('');setExpiry('');setFile(null);uploadForm.reset();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function updateMetadata(doc,patch){
  if(busy)return;setBusy(true);setError('');
  try {const result=await supabase.from('equipo_documentos_qr').update(patch).eq('id',doc.id).eq('equipo_id',equipmentId).select('id').single();if(result.error)throw result.error;setDocuments(await load());setEditing(null);setRemoveId(null);}
  catch(e){setError(e.message);}finally{setBusy(false);}
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
  {canConfigure&&!token&&<form onSubmit={upload} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
   <label className="block text-sm font-semibold">Nombre del documento<input required maxLength={180} value={name} disabled={busy} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white p-3"/></label>
   <label className="block text-sm font-semibold">Fecha de vencimiento (opcional)<input type="date" value={expiry} disabled={busy} onChange={e=>setExpiry(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white p-3"/></label>
   <label className="block text-sm font-semibold">Archivo (PDF, JPG o PNG · máximo 10 MB)<input disabled={busy} required type="file" accept="application/pdf,image/jpeg,image/png" onChange={e=>{const selected=e.target.files?.[0];setFile(selected||null);if(selected&&!name)setName(selected.name.replace(/\.[^.]+$/,''));}} className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white p-3"/></label>
   <button disabled={busy||!file||!name.trim()} className="rounded-xl bg-indigo-900 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?'Guardando…':'Subir documento'}</button>
  </form>}
  {canConfigure&&!token&&<button onClick={()=>setShowDeleted(!showDeleted)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">{showDeleted?'Ver documentos activos':'Ver eliminados'}</button>}
  {loading?<p role="status">Cargando documentos…</p>:!documents.length?<p className="text-sm text-slate-500">{token?'No hay documentos publicados para este equipo.':'No hay documentos cargados.'}</p>:<ul className="space-y-2">{documents.filter(doc=>token?!doc.deleted_at:Boolean(doc.deleted_at)===showDeleted).map(doc=><li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
   <div className="min-w-0"><button disabled={busy} onClick={()=>download(doc)} className="break-all text-left text-sm font-semibold text-indigo-800 underline">{doc.nombre}</button><p className="mt-1 text-xs text-slate-600">{doc.fecha_vencimiento?`Vencimiento: ${doc.fecha_vencimiento}`:'Sin vencimiento informado'}</p></div>
   {canConfigure&&!token&&<div className="flex flex-wrap gap-2">
   {doc.deleted_at?<button disabled={busy} onClick={()=>updateMetadata(doc,{deleted_at:null,publico_qr:false})} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Restaurar como privado</button>:<><button disabled={busy} onClick={()=>setEditing({...doc})} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Editar datos</button><button disabled={busy} onClick={()=>setRemoveId(doc.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Eliminar</button></>}
   </div>}
   {removeId===doc.id&&<div role="alert" className="w-full rounded-xl border border-red-200 bg-red-50 p-3"><p>¿Eliminar «{doc.nombre}»? Se retirará del QR y podrás restaurarlo desde Eliminados.</p><div className="mt-3 flex gap-2"><button disabled={busy} onClick={()=>updateMetadata(doc,{deleted_at:new Date().toISOString(),publico_qr:false})} className="rounded-lg bg-red-700 px-3 py-2 text-white">Confirmar eliminación</button><button disabled={busy} onClick={()=>setRemoveId(null)} className="rounded-lg border bg-white px-3 py-2">Cancelar</button></div></div>}
   {editing?.id===doc.id&&<form className="w-full space-y-3 rounded-xl bg-slate-50 p-3" onSubmit={e=>{e.preventDefault();updateMetadata(doc,{nombre:editing.nombre.trim(),fecha_vencimiento:editing.fecha_vencimiento||null});}}>
    <label className="block text-sm font-semibold">Nombre<input required maxLength={180} disabled={busy} value={editing.nombre} onChange={e=>setEditing({...editing,nombre:e.target.value})} className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white p-3"/></label>
    <label className="block text-sm font-semibold">Vencimiento<input type="date" disabled={busy} value={editing.fecha_vencimiento||''} onChange={e=>setEditing({...editing,fecha_vencimiento:e.target.value})} className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white p-3"/></label>
    <button disabled={busy||!editing.nombre.trim()} className="rounded-xl bg-indigo-900 px-4 py-2 text-white">Guardar datos</button> <button type="button" disabled={busy} onClick={()=>setEditing(null)} className="rounded-xl border bg-white px-4 py-2">Cancelar</button>
   </form>}
   {!token&&!doc.deleted_at&&(canConfigure?<label className="flex items-center gap-2 text-sm"><input disabled={busy} type="checkbox" checked={doc.publico_qr} onChange={()=>toggle(doc)} className="h-5 w-5 accent-indigo-800"/>Visible en QR</label>:<span className="text-xs">{doc.publico_qr?'Visible en QR':'Privado'}</span>)}
  </li>)}</ul>}
 </section>;
}
