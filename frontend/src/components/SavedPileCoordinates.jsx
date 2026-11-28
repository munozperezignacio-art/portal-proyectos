import React,{useState} from 'react';
import PileCatalogDialog from './PileCatalogDialog';
const field='mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm';
import {matchesPile} from '../utils/specialtyAdvance';
export default function SavedPileCoordinates({elements,workId,partId,state={},onSaved}){
 const [editor,setEditor]=useState(null),[notice,setNotice]=useState('');
 const [search,setSearch]=useState(''),[front,setFront]=useState('');
 const frontOf=e=>e.frente||'Sin frente';
 const fronts=[...new Set(elements.map(frontOf))].sort();
 const rows=elements.filter(e=>(!front||frontOf(e)===front)&&matchesPile(e,search)).sort((a,b)=>String(a.numero).localeCompare(String(b.numero),'es',{numeric:true}));
 return <section aria-label="Coordenadas guardadas" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
  <div><h4 className="text-sm font-bold text-slate-900">Coordenadas guardadas</h4><p className="mt-1 text-xs text-slate-500">{elements.length} pilas guardadas en esta partida. Consultar y filtrar no modifica las pilas.</p></div>
  {workId&&<div className="flex flex-wrap gap-2">{[['create','Agregar pila',state.can_create_piles],['import','Importar revisión de planos',state.can_import],['history','Historial de revisiones',true]].filter(([, ,allowed])=>allowed).map(([mode,label])=><button key={mode} type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700" onClick={()=>setEditor({mode})}>{label}</button>)}</div>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  {editor&&<PileCatalogDialog {...editor} elements={elements} workId={workId} partId={partId} onClose={()=>setEditor(null)} onSaved={async r=>{setNotice(`${r.added} pilas agregadas · ${r.updated} modificadas. Historial conservado; reportes y protocolos sin cambios.`);await onSaved();}}/>}
  {elements.length===0?<p className="text-sm text-slate-500">Todavía no hay coordenadas guardadas para esta partida.</p>:<>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-xs font-bold text-slate-700">Buscar pila<input type="search" className={field} placeholder="Número de pila" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <label className="text-xs font-bold text-slate-700">Filtrar por frente<select className={field} value={front} onChange={e=>setFront(e.target.value)}><option value="">Todos los frentes</option>{fronts.map(f=><option key={f}>{f}</option>)}</select></label>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-slate-500">Mostrando {rows.length} de {elements.length} pilas guardadas.</p><button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40" disabled={!search&&!front} onClick={()=>{setSearch('');setFront('');}}>Limpiar filtros</button></div>
   <div className="max-h-96 overflow-auto rounded-xl border border-slate-200"><table aria-label="Coordenadas guardadas de la partida" className="w-full text-sm text-left"><thead className="sticky top-0 bg-slate-100 text-xs text-slate-700"><tr>{['Pila','Norte','Este','Frente',...(state.can_edit_piles?['Acciones']:[])].map(label=><th scope="col" key={label} className="px-4 py-3 text-left">{label}</th>)}</tr></thead><tbody>{rows.map(e=><tr key={e.id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50">{[e.numero,e.norte??'—',e.este??'—',frontOf(e)].map((value,i)=><td key={i} className="whitespace-nowrap px-4 py-3 text-left tabular-nums">{value}</td>)}{state.can_edit_piles&&<td className="px-4 py-3"><button type="button" aria-label={`Editar pila ${e.numero} · ${e.frente||'Sin frente'}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold" onClick={()=>setEditor({mode:'edit',element:e})}>Editar</button></td>}</tr>)}{!rows.length&&<tr><td colSpan={state.can_edit_piles?5:4} className="px-4 py-6 text-center text-slate-500">No hay pilas que coincidan con los filtros.</td></tr>}</tbody></table></div>
  </>}
 </section>;
}
