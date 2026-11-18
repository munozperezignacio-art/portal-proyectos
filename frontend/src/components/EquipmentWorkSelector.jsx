import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function EquipmentWorkSelector({ token, date, value, onChange, disabled=false }) {
  const [state,setState]=useState({loading:true,works:[],error:''});
  useEffect(()=>{
    let active=true;
    setState({loading:true,works:[],error:''}); onChange(null,false);
    if(!date)return ()=>{active=false;};
    supabase.functions.invoke('maquinaria-publica',{body:{action:'cargar',token,fecha:date}}).then(({data,error})=>{
      if(!active)return;
      if(error||data?.error)throw Error(data?.error||'No se pudieron cargar las obras asignadas.');
      const works=data.obras||[];setState({loading:false,works,error:''});
      onChange(works.length===1?works[0]:null,works.length<=1);
    }).catch(error=>{if(active)setState({loading:false,works:[],error:error.message});});
    return()=>{active=false;};
  // Assignments reload only when their date or equipment changes.
  },[token,date]);
  return <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <p className="text-sm font-bold text-slate-800">Obra del registro</p>
    {state.loading?<p role="status" className="text-sm">Consultando asignaciones…</p>:state.error?<p role="alert" className="text-sm text-rose-700">{state.error}</p>:state.works.length>1?<label className="block text-sm">Selecciona la obra asignada para esta fecha<select required disabled={disabled} value={value?.id||''} onChange={event=>onChange(state.works.find(work=>String(work.id)===event.target.value)||null,!!event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="">Selecciona una obra</option>{state.works.map(work=><option key={work.id} value={work.id}>{work.nombre}</option>)}</select></label>:<p className="text-sm">{state.works[0]?.nombre||'Sin obra asignada en esta fecha. Se conservará en el historial del equipo.'}</p>}
  </div>;
}
