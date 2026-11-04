import React from 'react';
import {allowanceMonth} from '../utils/workerAllowances';

export default function WorkerAllowancesEditor({value = [], onChange}) {
  const change=(index,key,next)=>onChange(value.map((row,i)=>i===index?{...row,[key]:next}:row));
  const input='mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800';
  return <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-3" aria-label="Otras asignaciones">
    <div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-xs font-bold text-blue-950">Otras asignaciones mensuales</h5><button type="button" disabled={value.length>=50} onClick={()=>onChange([...value,{nombre:'',monto:'',tipo:'',desde:allowanceMonth(),hasta:''}])} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-900">+ Agregar asignación</button></div>
    <p className="text-xs text-slate-600">Montos en CLP, proporcionales a los días pagados. No repitas colación, movilización ni bonos ya registrados. Para cambiar un monto desde otro mes, termina la asignación anterior y agrega una nueva.</p>
    {!value.length&&<p className="text-xs text-slate-500">Sin otras asignaciones.</p>}
    {value.map((row,index)=><div key={index} className="rounded-xl border border-slate-200 bg-white p-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold sm:col-span-2">Nombre o detalle<input aria-label={`Nombre asignación ${index+1}`} required maxLength={160} value={row.nombre} onChange={e=>change(index,'nombre',e.target.value)} placeholder="Ej. Asignación de responsabilidad" className={input}/></label>
      <label className="text-xs font-semibold">Monto mensual ($ CLP)<input aria-label={`Monto asignación ${index+1}`} required type="number" min="1" max="1000000000" step="1" value={row.monto} onChange={e=>change(index,'monto',e.target.value)} className={input}/></label>
      <label className="text-xs font-semibold">Tipo<select aria-label={`Tipo asignación ${index+1}`} required value={row.tipo} onChange={e=>change(index,'tipo',e.target.value)} className={input}><option value="">Seleccionar tipo</option><option value="imponible">Imponible</option><option value="no_imponible">No imponible</option></select></label>
      <label className="text-xs font-semibold">Desde (mes)<input aria-label={`Desde asignación ${index+1}`} required type="month" min="1900-01" max="2999-12" value={row.desde} onChange={e=>change(index,'desde',e.target.value)} className={input}/></label>
      <label className="text-xs font-semibold">Hasta (opcional)<input aria-label={`Hasta asignación ${index+1}`} type="month" min={row.desde} max="2999-12" value={row.hasta || ''} onChange={e=>change(index,'hasta',e.target.value)} className={input}/></label>
      <button type="button" onClick={()=>onChange(value.filter((_,i)=>i!==index))} className="justify-self-start text-xs font-semibold text-rose-700">Quitar asignación {index+1}</button>
    </div>)}
  </section>;
}
