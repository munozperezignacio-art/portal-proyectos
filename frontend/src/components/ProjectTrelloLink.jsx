import React, {useEffect,useRef,useState} from 'react';
import {supabase} from '../supabaseClient';

export default function ProjectTrelloLink({obra,canEdit}) {
 const [url,setUrl]=useState(''),[active,setActive]=useState(true),[link,setLink]=useState(null),[busy,setBusy]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState('');
 const pending=useRef(false);
 const obraId=obra.id;
 useEffect(()=>{
  let alive=true;
  setBusy(true);setError('');setMessage('');setLink(null);setUrl('');setActive(true);
  supabase.from('obra_trello_vinculos').select('*').eq('obra_id',obraId).maybeSingle().then(({data,error})=>{
   if(!alive)return;
   if(error)setError('No se pudo cargar el enlace de Trello.');
   else {setLink(data);setUrl(data?.tarjeta_url||'');setActive(data?.activa??true);}
   setBusy(false);
  });return()=>{alive=false;};
 },[obraId]);
 async function execute(action){
  if(pending.current||!canEdit)return;
  pending.current=true;setBusy(true);setError('');setMessage('');
  try{
   const {data,error}=await supabase.functions.invoke('sincronizar-trello',{body:{action,obra_id:obraId,url,active}});
   if(error){let detail;try{detail=await error.context?.json();}catch{/* Keep generic transport message. */}throw new Error(detail?.error||'No se pudo contactar con Trello.');}
   if(data.error||data.success===false)throw new Error(data.error||data.results?.find(r=>r.error)?.error||'No se completó la sincronización.');
   if(action==='save'){setLink(data.link);setUrl(data.link?.tarjeta_url||'');setMessage(data.link?'Enlace guardado.':'Tarjeta desvinculada.');}
   else {
    setMessage('Campos y portada actualizados en Trello.');
    const {data:current,error:readError}=await supabase.from('obra_trello_vinculos').select('*').eq('obra_id',obraId).maybeSingle();
    if(!readError)setLink(current);
   }
  }catch(e){setError(e.message);}finally{setBusy(false);pending.current=false;}
 }
 if(obra.empresa!=='EMINSG')return null;
 const changed=url.trim()!==(link?.tarjeta_url||'')||active!==(link?.activa??true);
 return <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-labelledby="trello-link-title">
  <h4 id="trello-link-title" className="text-sm font-black text-blue-950">Integración con Trello</h4>
  <p className="mt-1 text-xs text-slate-600">Pega la tarjeta del TABLERO PRUEBA. Obraxis actualizará CPI, SPI, venta neta, avance y la portada con la curva S.</p>
  <label className="mt-3 block text-xs font-bold text-slate-700">Enlace de la tarjeta<input type="url" maxLength={500} disabled={!canEdit||busy} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://trello.com/c/…" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:opacity-60"/></label>
  <label className="mt-3 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={active} disabled={!canEdit||busy} onChange={e=>setActive(e.target.checked)}/>Actualizar automáticamente cada 15 minutos</label>
  <p className="mt-2 text-xs text-slate-500">Este enlace se guarda por separado de la ficha. Déjalo vacío y guarda para desvincular la tarjeta.</p>
  {link&&<p className="mt-2 text-xs text-slate-600">{link.activa?link.estado:'Automatización pausada'}{link.ultima_sincronizacion?` · Última actualización: ${new Date(link.ultima_sincronizacion).toLocaleString('es-CL',{timeZone:'America/Santiago'})}`:''}</p>}
  {link?.ultimo_error&&!error&&<p className="mt-2 text-xs text-amber-900">{link.ultimo_error}</p>}
  {error&&<p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
  {message&&<p role="status" className="mt-2 text-sm text-emerald-800">{message}</p>}
  <div className="mt-3 flex flex-wrap items-center gap-2">
   {canEdit&&<><button type="button" disabled={busy} onClick={()=>execute('save')} className="rounded-lg bg-blue-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy?'Procesando…':'Guardar enlace'}</button><button type="button" disabled={busy||!link||changed} onClick={()=>execute('sync')} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-900 disabled:opacity-50">Sincronizar ahora</button></>}
   {link&&<a href={link.tarjeta_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-800 underline">Abrir tarjeta</a>}
  </div>
 </section>;
}
