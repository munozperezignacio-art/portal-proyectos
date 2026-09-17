import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Inbox, Mail, Paperclip, RefreshCw, Search, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';
import useUserPermissions from '../utils/useUserPermissions';
import { can, isSuperUser } from '../utils/permissionsCatalog';

const states = [['nuevo','Nuevo'],['abierto','Abierto'],['pendiente','Esperando respuesta'],['cerrado','Cerrado'],['spam','Spam']];
const colors = { nuevo:'bg-blue-50 text-blue-700', abierto:'bg-amber-50 text-amber-700', pendiente:'bg-violet-50 text-violet-700', cerrado:'bg-emerald-50 text-emerald-700', spam:'bg-rose-50 text-rose-700' };
const formatDate = value => value ? new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '—';
const addressList = value => Array.isArray(value) ? value.join(', ') : String(value || '');

export default function ContactInbox({ user }) {
  const { permissions, loading: permissionsLoading } = useUserPermissions(user);
  const allowed = user?.empresa === 'Obraxis' && (isSuperUser(user) || can(user, permissions, 'admin.contactos.ver'));
  const [rows,setRows] = useState([]), [messages,setMessages] = useState([]), [loading,setLoading] = useState(true), [loadingMessages,setLoadingMessages] = useState(false);
  const [error,setError] = useState(''), [notice,setNotice] = useState(''), [search,setSearch] = useState(''), [filter,setFilter] = useState('abiertos');
  const [selected,setSelected] = useState(null), [saving,setSaving] = useState(false), [reply,setReply] = useState(''), [sending,setSending] = useState(false), [downloading,setDownloading] = useState('');

  const load = useCallback(async () => {
    if(!allowed)return;
    setLoading(true);setError('');
    const {data,error:e}=await supabase.from('correo_conversaciones').select('*').order('ultimo_mensaje_at',{ascending:false}).limit(500);
    if(e)setError(e.message);else setRows(data||[]);
    setLoading(false);
  }, [allowed]);

  const loadMessages=useCallback(async conversationId=>{
    if(!conversationId)return;
    setLoadingMessages(true);setError('');
    const {data,error:e}=await supabase.from('correo_mensajes').select('*').eq('conversacion_id',conversationId).order('created_at',{ascending:true}).limit(500);
    if(e)setError(e.message);else setMessages(data||[]);
    setLoadingMessages(false);
  },[]);

  useEffect(()=>{ if(!permissionsLoading)load(); },[permissionsLoading,load]);
  const visible=useMemo(()=>rows.filter(row=>{
    if(filter==='abiertos'&&['cerrado','spam'].includes(row.estado))return false;
    if(filter==='no_leidos'&&!row.no_leidos)return false;
    if(!['todos','abiertos','no_leidos'].includes(filter)&&row.estado!==filter)return false;
    const q=search.trim().toLowerCase();
    return !q||[row.participante_nombre,row.participante_correo,row.asunto,row.buzon].some(v=>String(v||'').toLowerCase().includes(q));
  }),[rows,search,filter]);

  const openConversation=async row=>{
    const opened={...row,no_leidos:0};setSelected(opened);setReply('');setNotice('');
    await loadMessages(row.id);
    if(row.no_leidos){
      const {error:e}=await supabase.from('correo_conversaciones').update({no_leidos:0}).eq('id',row.id);
      if(!e)setRows(current=>current.map(item=>item.id===row.id?opened:item));
    }
  };

  const save=async()=>{
    setSaving(true);setError('');setNotice('');
    const payload={estado:selected.estado,responsable_auth_user_id:selected.responsable_auth_user_id||user?.auth_user_id||null,responsable_nombre:selected.responsable_nombre||user?.nombre||user?.usuario||'',notas_internas:selected.notas_internas||''};
    const {data,error:e}=await supabase.from('correo_conversaciones').update(payload).eq('id',selected.id).select().single();
    if(e)setError(e.message);else{setRows(old=>old.map(x=>x.id===data.id?data:x));setSelected(data);setNotice('Conversación actualizada.');}
    setSaving(false);
  };

  const sendReply=async()=>{
    const text=reply.trim();if(!text)return;
    setSending(true);setError('');setNotice('');
    const {data,error:e}=await supabase.functions.invoke('correo-bandeja',{body:{action:'reply',conversation_id:selected.id,text}});
    if(e||data?.error)setError(data?.error||e.message||'No fue posible enviar la respuesta.');
    else{setReply('');setNotice('Respuesta enviada desde Obraxis.');await Promise.all([loadMessages(selected.id),load()]);setSelected(current=>({...current,estado:'pendiente',no_leidos:0}));}
    setSending(false);
  };

  const downloadAttachment=async(message,attachment)=>{
    const key=`${message.id}:${attachment.id}`;setDownloading(key);setError('');
    const {data,error:e}=await supabase.functions.invoke('correo-bandeja',{body:{action:'attachment',message_id:message.id,attachment_id:attachment.id}});
    if(e||data?.error)setError(data?.error||e.message||'No fue posible descargar el adjunto.');
    else if(data?.url)window.open(data.url,'_blank','noopener,noreferrer');
    setDownloading('');
  };

  if(permissionsLoading)return <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Cargando autorización…</div>;
  if(!allowed)return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-900">Bandeja disponible sólo para usuarios autorizados de Obraxis.</div>;
  const unread=rows.reduce((total,item)=>total+Number(item.no_leidos||0),0);
  const pending=rows.filter(x=>!['cerrado','spam'].includes(x.estado)).length;

  return <div className="space-y-4">
    <section className="rounded-3xl bg-slate-950 p-6 text-white"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><span className="rounded-2xl bg-white/10 p-3"><Inbox className="h-6 w-6"/></span><div><h2 className="text-xl font-black">Bandeja Obraxis</h2><p className="mt-1 text-xs text-slate-300">Correos y solicitudes atendidos sin salir de la plataforma.</p></div></div><div className="flex gap-6 text-right"><div><p className="text-2xl font-black">{unread}</p><p className="text-[10px] font-black uppercase text-slate-400">sin leer</p></div><div><p className="text-2xl font-black">{pending}</p><p className="text-[10px] font-black uppercase text-slate-400">abiertos</p></div></div></div></section>
    <section className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4"><label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar remitente, asunto o buzón…" className="h-10 w-full rounded-xl border pl-9 pr-3 text-xs font-semibold"/></label><select value={filter} onChange={e=>setFilter(e.target.value)} className="h-10 rounded-xl border px-3 text-xs font-bold"><option value="abiertos">Abiertos</option><option value="no_leidos">Sin leer</option><option value="todos">Todos</option>{states.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button onClick={load} className="flex items-center gap-2 rounded-xl border px-3 text-xs font-bold"><RefreshCw className="h-4 w-4"/>Actualizar</button></section>
    {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}
    {notice&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</div>}
    <section className="overflow-hidden rounded-2xl border bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Último mensaje</th><th className="px-4 py-3">Contacto</th><th className="px-4 py-3">Asunto</th><th className="px-4 py-3">Buzón</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Responsable</th></tr></thead><tbody className="divide-y">{loading?<tr><td colSpan="6" className="p-10 text-center text-xs text-slate-500">Cargando…</td></tr>:visible.length===0?<tr><td colSpan="6" className="p-10 text-center text-xs text-slate-500">No hay conversaciones.</td></tr>:visible.map(row=><tr key={row.id} onClick={()=>openConversation(row)} className={`cursor-pointer hover:bg-slate-50 ${row.no_leidos?'bg-blue-50/50':''}`}><td className="px-4 py-3 text-xs text-slate-600"><span className="flex items-center gap-2">{row.no_leidos>0&&<span className="h-2 w-2 rounded-full bg-blue-600"/>}{formatDate(row.ultimo_mensaje_at)}</span></td><td className="px-4 py-3"><p className="text-xs font-black">{row.participante_nombre||row.participante_correo}</p><p className="text-[10px] text-slate-500">{row.participante_correo}</p></td><td className="max-w-sm px-4 py-3"><p className={`truncate text-xs ${row.no_leidos?'font-black text-slate-900':'text-slate-600'}`}>{row.asunto}</p></td><td className="px-4 py-3 text-[10px] font-semibold text-slate-500">{row.buzon}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${colors[row.estado]||colors.abierto}`}>{states.find(x=>x[0]===row.estado)?.[1]||row.estado}</span></td><td className="px-4 py-3 text-xs">{row.responsable_nombre||'Sin asignar'}</td></tr>)}</tbody></table></div></section>
    {selected&&<div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/45" onClick={()=>setSelected(null)}><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6" onClick={e=>e.stopPropagation()}><div className="flex justify-between gap-4"><div><p className="text-[10px] font-black uppercase text-primary">{selected.buzon}</p><h3 className="text-xl font-black">{selected.asunto}</h3><p className="text-xs text-slate-500">{selected.participante_nombre||'Contacto'} · {selected.participante_correo}</p></div><button onClick={()=>setSelected(null)} className="h-9 rounded-xl bg-slate-100 px-3 text-xs font-black">Cerrar</button></div>
      <div className="mt-5 space-y-3">{loadingMessages?<div className="rounded-xl bg-slate-50 p-8 text-center text-xs text-slate-500">Cargando mensajes…</div>:messages.length===0?<div className="rounded-xl bg-slate-50 p-8 text-center text-xs text-slate-500">Esta conversación todavía no tiene mensajes.</div>:messages.map(message=><article key={message.id} className={`rounded-2xl border p-4 ${message.direccion==='salida'?'ml-8 border-blue-100 bg-blue-50/50':'mr-8 bg-white'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black">{message.direccion==='salida'?(message.actor_nombre||'Obraxis'):(message.remitente_nombre||message.remitente_correo)}</p><p className="text-[10px] text-slate-400">{message.direccion==='salida'?`Para: ${addressList(message.destinatarios)}`:`De: ${message.remitente_correo}`} · {formatDate(message.recibido_at||message.enviado_at||message.created_at)}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${message.estado==='error'?'bg-red-50 text-red-700':'bg-slate-100 text-slate-500'}`}>{message.estado}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{message.cuerpo_texto||'Este mensaje contiene únicamente contenido HTML.'}</p>{Array.isArray(message.adjuntos)&&message.adjuntos.length>0&&<div className="mt-3 flex flex-wrap gap-2">{message.adjuntos.map(attachment=>{const key=`${message.id}:${attachment.id}`;return <button key={attachment.id} onClick={()=>downloadAttachment(message,attachment)} disabled={downloading===key} className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[10px] font-bold"><Paperclip className="h-3.5 w-3.5"/>{attachment.filename}<Download className="h-3.5 w-3.5"/></button>})}</div>}{message.error_detalle&&<p className="mt-2 text-xs font-bold text-red-600">{message.error_detalle}</p>}</article>)}</div>
      <div className="mt-5 rounded-2xl border bg-slate-50 p-4"><label className="text-[10px] font-black uppercase text-slate-500">Responder como {selected.buzon}<textarea rows="6" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Escribe tu respuesta…" className="mt-2 w-full resize-y rounded-xl border bg-white p-3 text-sm"/></label><div className="mt-3 flex justify-end"><button onClick={sendReply} disabled={sending||!reply.trim()} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Send className="h-4 w-4"/>{sending?'Enviando…':'Enviar respuesta'}</button></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-black uppercase text-slate-500">Estado<select value={selected.estado} onChange={e=>setSelected(v=>({...v,estado:e.target.value}))} className="mt-1 h-10 w-full rounded-xl border px-3 text-xs font-bold">{states.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="text-[10px] font-black uppercase text-slate-500">Responsable<input value={selected.responsable_nombre||''} onChange={e=>setSelected(v=>({...v,responsable_nombre:e.target.value}))} className="mt-1 h-10 w-full rounded-xl border px-3 text-xs"/></label></div><label className="mt-4 block text-[10px] font-black uppercase text-slate-500">Notas internas<textarea rows="4" value={selected.notas_internas||''} onChange={e=>setSelected(v=>({...v,notas_internas:e.target.value}))} className="mt-1 w-full rounded-xl border p-3 text-xs"/></label><div className="mt-5 flex gap-2"><a href={`mailto:${selected.participante_correo}`} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black"><Mail className="h-4 w-4"/>Abrir correo externo</a><button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white"><CheckCircle2 className="h-4 w-4"/>{saving?'Guardando…':'Guardar gestión'}</button></div></aside></div>}
  </div>;
}
