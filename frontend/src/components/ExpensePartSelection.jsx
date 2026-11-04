import React from 'react';
import {eligibleExpenseParts,weightedExpenseParts,partBudget} from '../utils/expenseAllocation';
export default function ExpensePartSelection({parts=[],ids,onChange,disabled=false}){
 const available=eligibleExpenseParts(parts);let distribution=[],error='';try{distribution=weightedExpenseParts(parts,ids);}catch(e){error=e.message;}
 return <fieldset disabled={disabled} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3"><legend className="px-2 text-sm font-bold">Imputar a partidas según presupuesto</legend><p className="text-xs text-slate-600">Selecciona las partidas. Peso = presupuesto de la partida / suma de presupuestos seleccionados. Se aplica la misma distribución al neto de cada gasto seleccionado.</p>
 <div className="space-y-2">{available.map(p=><label key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 text-sm"><input type="checkbox" checked={ids.map(String).includes(String(p.id))} onChange={e=>onChange(e.target.checked?[...ids,p.id]:ids.filter(id=>String(id)!==String(p.id)))}/><span className="flex-1">{p.partida}</span><span className="text-xs text-slate-500">Presupuesto: ${Number(partBudget(p)||0).toLocaleString('es-CL')}</span><strong>{distribution.find(d=>d.partida_id===Number(p.id))?.porcentaje.toFixed(2)||'0.00'}%</strong></label>)}</div>
 {!available.length&&<p className="text-sm">No hay partidas disponibles en esta obra.</p>}
 <button type="button" onClick={()=>onChange(available.map(p=>p.id))} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">Seleccionar todas las partidas y ponderar</button><button type="button" onClick={()=>onChange([])} className="ml-2 rounded-lg border bg-white px-3 py-2 text-xs">Limpiar selección</button>
 {error?<p role="alert" className="text-sm text-rose-700">{error}</p>:<p className="text-sm font-bold">Total: {distribution.length?'100.00':'0.00'}%{!ids.length?' · Sin imputación a partidas':''}</p>}
 </fieldset>;
}
