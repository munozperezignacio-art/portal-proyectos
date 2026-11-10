import React from 'react';
export default function AttendanceRegisterFilters({date,person,onDateChange,onPersonChange,onClear,shown,total,filters={},states=[],onFilter}) {
  return <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <label className="text-xs font-bold text-slate-700">Día del marcaje<input aria-label="Filtrar asistencia por día" type="date" value={date} onChange={e=>onDateChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"/></label>
    <label className="min-w-0 flex-1 text-xs font-bold text-slate-700">Trabajador — nombre o RUT<input aria-label="Filtrar asistencia por trabajador" type="search" value={person} onChange={e=>onPersonChange(e.target.value)} placeholder="Ej.: Franco o 18.009.385-0" className="mt-1 block w-full min-w-40 rounded-lg border border-slate-200 bg-white p-2 text-xs"/></label>
    {Object.entries({from:'Desde',to:'Hasta'}).map(([k,label])=><label key={k} className="text-xs font-bold">{label}<input type="date" className="mt-1 block rounded-lg border bg-white p-2" value={filters[k]||''} min={k==='to'?filters.from:undefined} max={k==='from'?filters.to:undefined} onChange={e=>onFilter(k,e.target.value)}/></label>)}
    {Object.entries({state:['Estado',states],extra:['Horas extra',['Con horas extra','Sin horas extra']],validation:['Validación',['Manual','QR/GPS']]}).map(([k,[label,options]])=><label key={k} className="text-xs font-bold">{label}<select className="mt-1 block rounded-lg border bg-white p-2" value={filters[k]||''} onChange={e=>onFilter(k,e.target.value)}><option value="">Todos</option>{options.map(v=><option key={v}>{v}</option>)}</select></label>)}
    <button type="button" disabled={!date && !person && !Object.values(filters).some(Boolean)} onClick={onClear} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-blue-900 disabled:opacity-40">Limpiar filtros</button>
    <p role="status" className="py-2 text-xs text-slate-600">Mostrando {shown} de {total} marcajes</p>
  </div>;
}
