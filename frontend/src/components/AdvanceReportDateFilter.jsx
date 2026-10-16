import React from 'react';
export default function AdvanceReportDateFilter({date,order,onDateChange,onOrderChange,shown,total}) {
  return <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <label className="text-xs font-bold text-slate-700">Buscar por fecha del avance<input aria-label="Buscar por fecha del avance" type="date" value={date} onChange={e=>onDateChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"/></label>
    <label className="text-xs font-bold text-slate-700">Orden de reportes<select aria-label="Orden de reportes" value={order} onChange={e=>onOrderChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"><option value="desc">Más recientes primero</option><option value="asc">Más antiguos primero</option></select></label>
    <button type="button" disabled={!date} onClick={()=>onDateChange('')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-blue-900 disabled:opacity-40">Limpiar fecha</button>
    <p role="status" className="py-2 text-xs text-slate-600">Mostrando {shown} de {total} reportes</p>
  </div>;
}
