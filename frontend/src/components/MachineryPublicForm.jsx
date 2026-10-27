import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
export default function MachineryPublicForm({ token }) {
  const [equipment,setEquipment]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState(null);
  const request=useRef(crypto.randomUUID());
  const [form,setForm]=useState({fecha:today(),operador:'',horometro_inicial:'',horometro_final:'',horas_trabajadas:'',hubo_combustible:'',combustible_cargado:'',hubo_falla:'',detuvo_equipo:'',horas_fuera_servicio:'',descripcion:'',severidad:'Media',observaciones:''});
  const set=(key,value)=>setForm(previous=>({...previous,[key]:value}));
  useEffect(()=>{let active=true;(async()=>{try{
    const {data,error:failure}=await supabase.functions.invoke('maquinaria-publica',{body:{action:'cargar',token}});
    if(failure||data?.error)throw new Error(data?.error||'Enlace no disponible o desactivado.');
    if(active){setEquipment(data.equipo);set('horometro_inicial',String(data.equipo.horometro_inicial));}
  }catch(e){if(active)setError(e.message);}})();return()=>{active=false;};},[token]);
  const submit=async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{
    const {data,error:failure}=await supabase.functions.invoke('maquinaria-publica',{body:{...form,unidad:equipment.unidad,obra_nombre:equipment.obra_nombre||'',action:'registrar',token,solicitud_id:request.current,hubo_combustible:form.hubo_combustible==='si',hubo_falla:form.hubo_falla==='si',detuvo_equipo:form.detuvo_equipo==='si'}});
    if(failure){const response=await failure.context?.json?.().catch(()=>null);throw new Error(response?.error||'No se confirmó el envío. Puedes reintentar sin duplicarlo.');}
    if(data?.error)throw new Error(data.error);setReceipt(data.id);
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  const input=(key,label,decimal=false)=><label className="block text-sm font-semibold">{label}<input required disabled={busy} inputMode={decimal?'decimal':'text'} value={form[key]} onChange={e=>set(key,e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>;
  const choice=(key,label)=><label className="block text-sm font-semibold">{label}<select required disabled={busy} value={form[key]} onChange={e=>set(key,e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3"><option value="">Seleccionar</option><option value="no">No</option><option value="si">Sí</option></select></label>;
  const section='space-y-4 rounded-2xl border bg-white p-5';
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800"><div className="mx-auto max-w-lg space-y-4">
    <header className={section}><p className="text-xs font-bold uppercase text-indigo-700">{equipment?.empresa||'Obraxis'}</p><h1 className="text-xl font-black">Reporte diario de maquinaria</h1>{equipment&&<><p className="font-bold">{equipment.tipo} · {equipment.patente}</p><p className="text-sm">{equipment.obra_nombre||'Sin obra asignada'}</p><p className="text-xs text-slate-500">Documento {equipment.codigo} · Revisión {equipment.revision}</p></>}</header>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {receipt?<section role="status" className={section}><h2 className="font-bold">Reporte #{receipt} recibido</h2><p>Los datos quedaron guardados. La consulta y descarga están disponibles para usuarios autorizados en Obraxis.</p></section>:equipment?<form onSubmit={submit} className="space-y-4">
      <section className={section}><h2 className="font-bold">1. Jornada y operador</h2><label className="block text-sm font-semibold">Fecha<input required type="date" max={today()} value={form.fecha} onChange={e=>set('fecha',e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>{input('operador','Nombre del operador')}<p className="text-xs text-slate-500">Identidad declarada por quien completa este formulario público.</p></section>
      <section className={section}><h2 className="font-bold">2. Lecturas ({equipment.unidad})</h2><p className="rounded-xl bg-slate-50 p-3">Inicial: <strong>{form.horometro_inicial} {equipment.unidad}</strong></p>{input('horometro_final',`Lectura final (${equipment.unidad})`,true)}{equipment.unidad==='km'&&input('horas_trabajadas','Horas trabajadas (h)',true)}</section>
      <section className={section}><h2 className="font-bold">3. Combustible</h2>{choice('hubo_combustible','¿Hubo carga de combustible?')}{form.hubo_combustible==='si'&&input('combustible_cargado','Litros cargados (L)',true)}</section>
      <section className={section}><h2 className="font-bold">4. Fallas y paralización</h2>{choice('hubo_falla','¿Hubo alguna falla?')}{form.hubo_falla==='si'&&<>{input('descripcion','Describe la falla')}<label className="block text-sm font-semibold">Severidad<select value={form.severidad} onChange={e=>set('severidad',e.target.value)} className="mt-1 w-full rounded-xl border p-3">{['Baja','Media','Alta','Crítica'].map(v=><option key={v}>{v}</option>)}</select></label>{choice('detuvo_equipo','¿La falla detuvo el equipo?')}{form.detuvo_equipo==='si'&&input('horas_fuera_servicio','Horas de paralización (h)',true)}</>}</section>
      <section className={section}><label className="block text-sm font-semibold">Observaciones (opcional)<textarea rows={4} maxLength={4000} value={form.observaciones} onChange={e=>set('observaciones',e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label></section>
      <button disabled={busy} className="w-full rounded-xl bg-indigo-900 p-4 font-bold text-white disabled:opacity-50">{busy?'Enviando…':'Enviar reporte'}</button><p className="text-center text-xs text-slate-500">Este enlace solo permite enviar reportes de este equipo.</p>
    </form>:!error&&<p role="status">Cargando formulario…</p>}
  </div></main>;
}
