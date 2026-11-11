import React from 'react';
import AttendanceAction from './AttendanceAction';
import {sources} from '../utils/workExpenseFilters';
export default function WorkExpenseFilters({filters:f,set,costs,shown}){
 const input='mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2';
 const change=(k,v)=>set(p=>({...p,[k]:v})),count=Object.values(f).filter(Boolean).length;
 return <div className="mb-3 flex flex-wrap items-center gap-3"><AttendanceAction title="Filtros de gastos reales" trigger={count?'Filtros · '+count:'Filtros'}>
 <div className="grid gap-3 text-xs font-bold sm:grid-cols-2"><label className="sm:col-span-2">Buscar gasto<input className={input} type="search" placeholder="Concepto, proveedor, RUT o documento" value={f.search||''} onChange={e=>change('search',e.target.value)}/></label>
 <label>Origen<select className={input} value={f.source||''} onChange={e=>change('source',e.target.value)}><option value="">Todos</option>{Object.entries(sources).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label>Categoría<select className={input} value={f.category||''} onChange={e=>change('category',e.target.value)}><option value="">Todas</option>{[...new Set(costs.map(c=>c.tipo_costo).filter(Boolean))].sort().map(c=><option key={c}>{c}</option>)}</select></label>
 <label>Desde<input className={input} type="date" max={f.to} value={f.from||''} onChange={e=>change('from',e.target.value)}/></label><label>Hasta<input className={input} type="date" min={f.from} value={f.to||''} onChange={e=>change('to',e.target.value)}/></label></div>
 <p role="status">{shown} de {costs.length} gastos</p></AttendanceAction><span className="text-xs text-slate-600">{shown} de {costs.length} gastos</span>{count>0&&<button type="button" className="text-xs font-bold text-blue-900" onClick={()=>set({})}>Limpiar filtros</button>}</div>;
}
