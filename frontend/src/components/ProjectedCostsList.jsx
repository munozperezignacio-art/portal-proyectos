import React,{useState} from 'react';
import {dailyTimeRate} from '../utils/workReportCalculations';
const money=n=>Number(n).toLocaleString('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
export default function ProjectedCostsList({items=[],error='',busy=false,onEdit,onDelete}){
 const [search,setSearch]=useState('');
 const visible=items.filter(c=>`${c.nombre_item} ${c.partida}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
 return <section aria-label="Costos proyectados creados" className="rounded-2xl border border-blue-200 bg-white p-4 space-y-4">
  <header><h4 className="font-black text-slate-900">Costos proyectados creados ({items.length})</h4><p className="text-xs text-slate-600 mt-1">Se guardan por obra y se incluyen en la proyección y el calendario. Se aplican durante la ejecución de su partida; no son costos reales confirmados.</p></header>
  {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  <input aria-label="Buscar costo proyectado" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por concepto o partida" className="w-full rounded-lg border p-3 text-sm"/>
  <div className="grid gap-3 lg:grid-cols-2">{visible.map(c=><article key={c.id} className="min-w-0 rounded-xl border border-slate-200 p-4 space-y-3">
   <div className="flex flex-wrap justify-between gap-2"><h5 className="font-bold text-sm break-words">{c.nombre_item||'Costo sin nombre'}</h5><span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-900">Guardado · Proyectado</span></div>
   <p className="text-sm text-slate-600 break-words">{c.partida}</p>
   {c.tipo_proyeccion==='TIEMPO'?<div><strong className="text-xl text-indigo-950">{money(c.tarifa_tiempo_dia)}</strong><span className="text-sm"> / {c.periodicidad==='Mes'?'mes':'día laborable'}</span>{c.periodicidad==='Mes'&&<p className="text-xs text-slate-500">Equivalente: {money(dailyTimeRate(c))}/día · base 30</p>}</div>:<div><strong className="text-xl text-indigo-950">{money(c.precio_unitario_insumo)}</strong><span className="text-sm"> / {c.unidad_insumo||'insumo'}</span><p className="text-xs text-slate-500">Consumo: {c.tasa_rendimiento_insumo} por unidad producida</p></div>}
   <p className="text-xs text-slate-500">Vigencia: inicio a término de la partida, según planificación o escenario simulado.</p>
   <div className="flex justify-end gap-2 border-t pt-3"><button type="button" disabled={busy} onClick={()=>onEdit(c)} className="rounded-lg border px-3 py-2 text-sm font-bold text-blue-900">Editar</button><button type="button" disabled={busy} onClick={()=>onDelete(c)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-800">Eliminar</button></div>
  </article>)}</div>
  {!visible.length&&<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{items.length?'No hay coincidencias.':'No hay costos personalizados guardados. Las partidas sin costos usan la referencia explícita de $20.000 por día laborable y partida.'}</p>}
 </section>;
}
