import React from 'react';
import {inheritProgressPlan} from '../utils/dependentProgress';

export default function WorkProgressReference({part,parts,value,onChange,canEdit}) {
  let plan=null,error='';
  if(value && Number(part.cantidad)>0) {
    try {plan=inheritProgressPlan([...parts.filter(p=>String(p.id)!==String(part.id)),{...part,id:part.id||'new',cantidad_presupuestada:Number(part.cantidad),avance_depende_de:value}]).at(-1);}
    catch(e){error=e.message;}
  }
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <label className="block text-xs font-bold text-slate-700">Avance de la partida
      <select aria-label="Avance de la partida" value={value||''} disabled={!canEdit} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800">
        <option value="">Propio · registro directo</option>
        {parts.filter(p=>String(p.id)!==String(part.id)&&!p.es_titulo&&!['TITULO','GRUPO'].includes(p.unidad)&&Number(p.cantidad)>0).map(p=><option key={p.id} value={p.id}>Proporcional a {p.partida} ({p.unidad})</option>)}
      </select>
    </label>
    <p className="mt-2 text-xs text-slate-600">{value?'Sigue el mismo porcentaje y plazo de la referencia. El rendimiento se calcula en la unidad de esta partida.':'Registra el avance directamente en esta partida.'}</p>
    {plan&&<p role="status" className="mt-2 text-xs font-semibold text-indigo-900">{plan.duracion_programada?'Duración: '+plan.duracion_programada+' días · Rendimiento: '+plan.rendimiento.toLocaleString('es-CL',{maximumFractionDigits:4})+' '+part.unidad+' / día':'La referencia todavía no tiene rendimiento ni duración configurados.'}</p>}
    {error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>;
}
