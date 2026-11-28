import React,{useState} from 'react';
const field='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm';
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export default function SavedPileCoordinates({elements}){
 const [search,setSearch]=useState(''),[stage,setStage]=useState(''),[front,setFront]=useState('');
 const stageOf=e=>e.etapa||'Sin etapa',frontOf=e=>e.frente||'Sin frente';
 const stages=[...new Set(elements.map(stageOf))].sort(),fronts=[...new Set(elements.map(frontOf))].sort();
 const rows=elements.filter(e=>(!stage||stageOf(e)===stage)&&(!front||frontOf(e)===front)&&normalize(e.numero).includes(normalize(search))).sort((a,b)=>String(a.numero).localeCompare(String(b.numero),'es',{numeric:true}));
 return <section aria-label="Coordenadas guardadas" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
  <div><h4 className="text-sm font-bold text-slate-900">Coordenadas guardadas</h4><p className="mt-1 text-xs text-slate-500">{elements.length} pilas guardadas en esta partida. Solo consulta; no modifica las pilas.</p></div>
  {elements.length===0?<p className="text-sm text-slate-500">Todavía no hay coordenadas guardadas para esta partida.</p>:<>
   <div className="grid gap-3 sm:grid-cols-3">
    <label className="text-xs font-bold text-slate-700">Buscar pila<input type="search" className={field} placeholder="Número de pila" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <label className="text-xs font-bold text-slate-700">Filtrar por etapa<select className={field} value={stage} onChange={e=>setStage(e.target.value)}><option value="">Todas las etapas</option>{stages.map(s=><option key={s}>{s}</option>)}</select></label>
    <label className="text-xs font-bold text-slate-700">Filtrar por frente<select className={field} value={front} onChange={e=>setFront(e.target.value)}><option value="">Todos los frentes</option>{fronts.map(f=><option key={f}>{f}</option>)}</select></label>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-slate-500">Mostrando {rows.length} de {elements.length} pilas guardadas.</p><button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40" disabled={!search&&!stage&&!front} onClick={()=>{setSearch('');setStage('');setFront('');}}>Limpiar filtros</button></div>
   <div className="max-h-96 overflow-auto rounded-xl border border-slate-200"><table aria-label="Coordenadas guardadas de la partida" className="w-full text-sm text-left"><thead className="sticky top-0 bg-slate-100 text-xs text-slate-700"><tr>{['Pila','Norte','Este','Etapa','Frente'].map(label=><th scope="col" key={label} className="px-4 py-3 text-left">{label}</th>)}</tr></thead><tbody>{rows.map(e=><tr key={e.id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50">{[e.numero,e.norte??'—',e.este??'—',stageOf(e),frontOf(e)].map((value,i)=><td key={i} className="whitespace-nowrap px-4 py-3 text-left tabular-nums">{value}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No hay pilas que coincidan con los filtros.</td></tr>}</tbody></table></div>
  </>}
 </section>;
}
