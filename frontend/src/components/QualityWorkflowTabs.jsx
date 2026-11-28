import React from 'react';

// Same navigation treatment as the parent Calidad module.
export default function QualityWorkflowTabs({items,value,onChange}){
 return <nav aria-label="Trabajo de la especialidad" className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1.5">
  {items.map(([id,label])=><button type="button" key={id} aria-current={value===id?'page':undefined} onClick={()=>onChange(id)} className={`rounded-lg px-3 py-2 text-xs font-bold ${value===id?'bg-white text-emerald-800 shadow-sm':'text-slate-600'}`}>{label}</button>)}
 </nav>;
}
