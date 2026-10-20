import React,{useRef,useState} from 'react';
import {supabase} from '../supabaseClient';
import {assignmentToday} from '../utils/workerAssignment';
import {workerAdditionalCenters} from '../utils/workerCenters';
import WorkerBulkAssignment from './WorkerBulkAssignment';
import WorkerAssignmentSummary from './WorkerAssignmentSummary';

export default function WorkerCenterAssignments({company,workers,centers,assignments,obras=[],onClose,onSaved,onPrimaryAssigned}){
  const [selected,setSelected]=useState([]),[search,setSearch]=useState(''),[start,setStart]=useState(assignmentToday),[end,setEnd]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const saving=useRef(false);
  const save=async(event,link)=>{
    event?.preventDefault();if(saving.current)return;
    saving.current=true;setBusy(true);setError('');
    try{
      const payload={p_empresa:company,p_trabajadores:link?[Number(link.trabajador_id)]:workers.map(w=>Number(w.id)),p_centros:link?[Number(link.centro_gestion_id)]:selected.map(Number),p_inicio:link?link.fecha_inicio:start,p_termino:link?(end||assignmentToday()):(end||null),p_accion:link?'finalizar':'agregar'};
      const {data,error:failure}=await supabase.rpc('gestionar_personal_centros',payload);if(failure)throw failure;
      if(!data||!['agregados','omitidos','finalizados'].every(key=>Number.isInteger(data[key]))||data.agregados+data.omitidos+data.finalizados!==payload.p_trabajadores.length*payload.p_centros.length)throw Error('No se confirmó todo el lote. Actualiza antes de reintentar.');
      await onSaved(data);if(!link)onClose();
    }catch(failure){setError(failure.message||'No fue posible guardar las asignaciones');}finally{saving.current=false;setBusy(false);}
  };
  const query=search.trim().toLocaleLowerCase('es');
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-labelledby="worker-centers-title"><div className="max-h-[94dvh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
    <header className="flex items-start justify-between gap-3"><div><h3 id="worker-centers-title" className="font-black text-slate-900">Asignaciones · {workers.length} {workers.length===1?'persona':'personas'}</h3><p className="mt-2 text-xs text-slate-600">Consulta los centros vigentes y agrega otros sin reemplazarlos. No duplica sueldos ni genera cargos: el costo sigue la asistencia o la regla autorizada.</p></div><button type="button" disabled={busy} aria-label="Cerrar asignaciones" onClick={onClose} className="rounded-lg p-2">✕</button></header>
    <div className="my-4 max-h-48 space-y-2 overflow-auto rounded-xl bg-slate-50 p-3">{workers.map(worker=><div key={worker.id} className="text-xs"><b>{worker.nombre}</b><WorkerAssignmentSummary worker={worker} centers={centers} assignments={assignments}/><div className="mt-1 flex flex-wrap gap-1">{workerAdditionalCenters(worker,assignments).filter(link=>link.fecha_termino==null).map(link=><button key={link.id} type="button" disabled={busy} onClick={()=>save(null,link)} aria-label={`Finalizar ${link.centro_nombre} de ${worker.nombre}`} className="font-bold text-red-700">Finalizar {link.centro_nombre}</button>)}</div></div>)}</div>
    {onPrimaryAssigned&&<details className="mb-4 rounded-xl border p-3"><summary className="cursor-pointer text-xs font-bold">Cambiar la obra principal</summary><p className="my-2 text-xs text-slate-600">Solo para trasladar la obra principal. Conserva el historial y los centros adicionales.</p><WorkerBulkAssignment compact company={company} workers={workers} obras={obras} busy={busy} onAssigned={async result=>{await onPrimaryAssigned(result);onClose();}}/></details>}
    <form onSubmit={save}>
    {assignments.some(link=>workers.some(worker=>String(worker.id)===String(link.trabajador_id))&&link.empresa===company)&&<details className="mb-4 rounded-xl border p-3 text-xs"><summary className="cursor-pointer font-bold">Historial y asignaciones programadas</summary><ul className="mt-2 max-h-40 space-y-2 overflow-auto">{assignments.filter(link=>link.empresa===company&&workers.some(worker=>String(worker.id)===String(link.trabajador_id))).map(link=><li key={link.id}>{workers.find(worker=>String(worker.id)===String(link.trabajador_id))?.nombre} · {link.centro_codigo} · {link.centro_nombre}<span className="block text-slate-500">Desde {link.fecha_inicio} · {link.fecha_termino?`hasta ${link.fecha_termino}`:'sin término'}</span></li>)}</ul></details>}
    <label className="block text-xs font-bold">Buscar centros<input type="search" value={search} disabled={busy} onChange={e=>setSearch(e.target.value)} className="my-1 w-full rounded-xl border p-3" placeholder="Nombre o código del centro"/></label>
    <div className="max-h-56 space-y-1 overflow-auto rounded-xl border p-2">{centers.filter(c=>c.activo!==false&&(!c.empresa||c.empresa===company)&&`${c.codigo} ${c.nombre}`.toLocaleLowerCase('es').includes(query)).map(center=><label key={center.id} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50"><input type="checkbox" checked={selected.includes(String(center.id))} disabled={busy} onChange={()=>setSelected(current=>current.includes(String(center.id))?current.filter(id=>id!==String(center.id)):[...current,String(center.id)])}/>{center.codigo} · {center.nombre}</label>)}</div>
    <p className="mt-2 text-xs text-slate-500">{selected.length} centros seleccionados. Se conservan al buscar otro centro. Los vínculos idénticos se omiten; fechas solapadas se informan sin guardar parcialmente.</p>
    <div className="my-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Vigente desde<input required type="date" value={start} disabled={busy} onChange={e=>setStart(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="text-xs font-bold">Hasta (opcional)<input type="date" min={start} value={end} disabled={busy} onChange={e=>setEnd(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label></div>
    <p className="text-xs text-slate-500">«Finalizar» conserva el historial y usa «Hasta» como último día asignado; si está vacío, usa hoy. No modifica el centro principal ni costos ya registrados.</p>
    {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <footer className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border px-4 py-2 text-xs font-bold">Cerrar</button><button type="submit" disabled={busy||!selected.length||!workers.length} className="rounded-xl bg-blue-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?'Guardando…':`Agregar ${selected.length} centros`}</button></footer>
  </form></div></div>;
}
