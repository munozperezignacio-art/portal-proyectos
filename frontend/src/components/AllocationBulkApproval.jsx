import React, {useState} from 'react';
export default function AllocationBulkApproval({count,reason,onReasonChange,onApprove,busy,message,selectionKey=''}) {
  const [confirmation,setConfirmation]=useState(null);
  const key=JSON.stringify([selectionKey,count,reason]);
  const confirming=confirmation===key && count>0 && !busy;
  return <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
    <label className="block text-xs font-bold text-emerald-950">Motivo común para los seleccionados<textarea aria-label="Motivo común de aprobación" maxLength={1000} rows={2} value={reason} disabled={busy || !count} onChange={event=>onReasonChange(event.target.value)} placeholder="Ej.: Asignaciones y horas revisadas con supervisión de obra" className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs disabled:opacity-50"/></label>
    <p className="text-[11px] text-slate-600">Este motivo quedará en el historial de cada día seleccionado y reemplazará el motivo individual para este lote. Se conservan los destinos, horas extras y haberes de cada fila.</p>
    {confirming ? <div role="group" aria-label="Confirmar aprobación del lote" className="rounded-lg border border-emerald-300 bg-white p-3 text-xs space-y-2">
      <p>¿Confirmas aprobar {count} días con el motivo «{reason.trim()}»? Se conservarán los destinos, horas extras y haberes de cada fila.</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>{setConfirmation(null);onApprove();}} className="rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white">Confirmar aprobación</button><button type="button" onClick={()=>setConfirmation(null)} className="rounded-lg border px-4 py-2">Cancelar</button></div>
    </div> : <button type="button" disabled={busy || !count || reason.trim().length<3} onClick={()=>setConfirmation(key)} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?'Procesando…':`Aprobar seleccionados (${count}) con este motivo`}</button>}
    {message && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-900">{message}</p>}
  </div>;
}
