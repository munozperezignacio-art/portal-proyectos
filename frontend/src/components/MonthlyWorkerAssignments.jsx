import React,{useRef,useState} from 'react';
import {supabase} from '../supabaseClient';
import {chileanAttendanceToday} from '../utils/attendanceDates';
import {workerMatchesSearch,toggleVisibleWorkers} from '../utils/workerAssignment';
import {loadMonthlyWorkerSources,buildMonthlyWorkerReport,monthlyReportWorkbook} from '../utils/monthlyWorkerReport';
import {loadSpreadsheetEngine} from '../services/documentEngines';

export default function MonthlyWorkerAssignments({company,workers,initialSelected=[],onClose}) {
  const [period,setPeriod]=useState(()=>chileanAttendanceToday().slice(0,7));
  const [selected,setSelected]=useState(initialSelected.map(String));
  const [query,setQuery]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const inFlight=useRef(false);
  const available=workers.filter(w=>w.empresa===company);
  const visible=available.filter(w=>workerMatchesSearch(w,query));
  const chosen=available.filter(w=>selected.includes(String(w.id)));
  async function download() {
    if(inFlight.current||!chosen.length)return;
    inFlight.current=true;setBusy(true);setMessage('');
    try {
      const sources=await loadMonthlyWorkerSources(supabase,company,period);
      const report=buildMonthlyWorkerReport({company,period,workers:available,selectedIds:chosen.map(w=>w.id),sources});
      const XLSX=await loadSpreadsheetEngine();
      XLSX.writeFile(monthlyReportWorkbook(XLSX,report),`Asignaciones_${company.replace(/[^a-z0-9_-]/gi,'_')}_${period}.xlsx`);
      setMessage(`Excel descargado: ${chosen.length} trabajador(es), ${report.daily.length} filas diarias.${report.warnings.length?' Revisa las advertencias incluidas en la planilla.':''}`);
    }catch(error){setMessage(`No se pudo descargar el reporte: ${error.message||'Inténtalo nuevamente.'}`);}
    finally{inFlight.current=false;setBusy(false);}
  }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label="Descargar asignaciones mensuales">
    <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl space-y-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900">Asignaciones mensuales · Excel</h3><p className="mt-1 text-xs text-slate-500">{company} · Todos los días del mes, centros, horas extras y otras horas.</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar reporte mensual" className="rounded-lg border px-3 py-2 text-sm">Cerrar</button></div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-950">Se distinguen el centro del marcaje, las asignaciones vigentes y el centro del cargo. Incluye HE detectadas y aprobadas por separado. No modifica asistencias, costos ni nóminas.</div>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]"><label className="text-xs font-bold">Mes del reporte<input aria-label="Mes del reporte" type="month" value={period} disabled={busy} onChange={e=>setPeriod(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label><label className="text-xs font-bold">Buscar trabajadores<input aria-label="Buscar trabajadores para reporte" value={query} disabled={busy} onChange={e=>setQuery(e.target.value)} placeholder="Nombre, RUT o cargo" className="mt-1 w-full rounded-lg border p-3"/></label></div>
      <div className="flex flex-wrap items-center gap-3 text-xs"><b>{chosen.length} seleccionados</b><button type="button" disabled={busy||!visible.length} onClick={()=>setSelected(current=>toggleVisibleWorkers(current,visible))} className="rounded-lg border px-3 py-2">Seleccionar / quitar resultados ({visible.length})</button><button type="button" disabled={busy} onClick={()=>setSelected([])} className="underline">Limpiar selección</button></div>
      <p className="text-xs text-slate-500">Puedes buscar, seleccionar y buscar otro: la selección se conserva.</p>
      <div className="max-h-64 overflow-auto rounded-xl border divide-y">{visible.map(w=><label key={w.id} className="flex items-center gap-3 p-3 text-sm"><input type="checkbox" disabled={busy} checked={selected.includes(String(w.id))} onChange={e=>setSelected(current=>e.target.checked?[...new Set([...current,String(w.id)])]:current.filter(id=>id!==String(w.id)))}/><span className="min-w-0"><b className="block break-words">{w.nombre}</b><small className="text-slate-500">{w.rut||'Sin RUT'} · {w.cargo||'Sin cargo'}</small></span></label>)}{!visible.length&&<p className="p-4 text-sm">No hay trabajadores con esta búsqueda.</p>}</div>
      {message&&<p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
      <button type="button" disabled={busy||!chosen.length||!period} onClick={download} className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Preparando Excel…':`Descargar Excel mensual (${chosen.length})`}</button>
    </section>
  </div>;
}
