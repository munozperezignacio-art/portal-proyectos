import React,{useRef,useState} from 'react';
import {supabase} from '../supabaseClient';
import {assignmentIssue,assignmentToday} from '../utils/workerAssignment.js';

export default function WorkerBulkAssignment({company,workers,obras,hiddenCount,busy:parentBusy,onClear,onRemove,onAssigned}){
 const [open,setOpen]=useState(false),[work,setWork]=useState(''),[date,setDate]=useState(assignmentToday),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const saving=useRef(false);
 const invalid=workers.some(worker=>assignmentIssue(worker,date));
 const save=async event=>{
  event.preventDefault();if(saving.current||parentBusy||!work||!workers.length||invalid)return;
  saving.current=true;setBusy(true);setError('');
  try{
   const response=await supabase.rpc('asignar_personal_obra_lote',{p_empresa:company,p_trabajadores:workers.map(worker=>Number(worker.id)),p_obra:Number(work),p_fecha:date});
   if(response.error)throw response.error;
   if(!Number.isInteger(response.data?.asignados)||!Number.isInteger(response.data?.omitidos)||response.data.asignados+response.data.omitidos!==workers.length)throw new Error('No se confirmó todo el lote. Actualiza el listado antes de reintentar.');
   await onAssigned(response.data);setOpen(false);
  }catch(failure){setError(failure.message||'No fue posible asignar los trabajadores.');}
  finally{saving.current=false;setBusy(false);}
 };
 return <>
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
   <div><p className="text-sm font-bold text-blue-950">{workers.length} trabajadores seleccionados</p><p className="mt-1 text-xs text-blue-900">La selección se conserva al buscar o filtrar.{hiddenCount>0?` ${hiddenCount} seleccionados fuera del filtro actual.`:''}</p></div>
   <div className="flex flex-wrap gap-2"><button disabled={busy||parentBusy} onClick={onClear} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-950">Limpiar selección</button><button disabled={busy||parentBusy} onClick={()=>{setOpen(true);setError('');}} className="rounded-xl bg-blue-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Asignar obra ({workers.length})</button></div>
  </div>
  {open&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3"><form role="dialog" aria-modal="true" aria-label="Asignar trabajadores a obra" onSubmit={save} className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
   <header className="border-b p-4"><h3 className="font-black">Asignar {workers.length} trabajadores a una obra</h3><p className="mt-1 text-xs text-slate-500">Se guardan la obra, su centro de gestión y el historial juntos. No modifica sueldos, asistencias ni reglas de respaldo.</p></header>
   <div className="space-y-4 overflow-y-auto p-4"><label className="block text-xs font-bold">Obra de destino<select required aria-label="Obra para los seleccionados" disabled={busy} value={work} onChange={event=>setWork(event.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3 text-sm"><option value="">Selecciona obra</option>{obras.filter(obra=>!obra.empresa||obra.empresa===company).map(obra=><option key={obra.id} value={obra.id}>{obra.nombre}</option>)}</select></label>
    <label className="block text-xs font-bold">Fecha desde<input required type="date" aria-label="Fecha de asignación del lote" max={assignmentToday()} disabled={busy} value={date} onChange={event=>setDate(event.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label>
    <p className="text-xs text-slate-500">Asignación vigente, no programación futura. Los que ya estén en esa obra se conservan, sin cambiar su fecha ni duplicar historial.</p>
    <ul className="max-h-64 divide-y overflow-auto rounded-xl border">{workers.map(worker=><li key={worker.id} className="flex items-start justify-between gap-3 p-3 text-xs"><div><b>{worker.nombre}</b><p className="mt-1 text-slate-500">{worker.rut} · Actual: {worker.obra_nombre||'Sin obra'}</p>{assignmentIssue(worker,date)&&<p className="mt-1 text-red-700">{assignmentIssue(worker,date)}</p>}</div><button type="button" aria-label={`Quitar ${worker.nombre} de la asignación`} disabled={busy} onClick={()=>onRemove(String(worker.id))} className="font-bold text-red-700">Quitar</button></li>)}</ul>
    {invalid&&<p className="text-xs text-red-700">Hay trabajadores fuera de vigencia contractual en esa fecha. Cambia la fecha o quítalos de la selección.</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
   </div><footer className="flex flex-wrap justify-end gap-2 border-t p-4"><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="rounded-xl border px-4 py-2 text-xs font-bold">Cancelar</button><button type="submit" disabled={busy||parentBusy||invalid||!work||!workers.length} className="rounded-xl bg-blue-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?'Asignando…':'Confirmar asignación'}</button></footer>
  </form></div>}
 </>;
}
