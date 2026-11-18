import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function EquipmentStartMeter({ equipment, onClose, onSaved }) {
  const [state,setState]=useState(null),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  useEffect(()=>{let active=true;
    supabase.rpc('equipment_start_meter',{p_equipo:equipment.id}).then(({data,error})=>{if(!active)return;if(error){setError(error.message);return;}setState(data);setValue(String(data.lectura));}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[equipment.id]);
  async function save(event){
    event.preventDefault();if(busy||!state?.puede_configurar||saved)return;
    const reading=Number(value.replace(',','.'));
    if(!value.trim()||!Number.isFinite(reading)||reading<0||reading>999999999){setError('Ingresa un horómetro válido, igual o mayor que cero.');return;}
    setBusy(true);setError('');
    try{const {data,error}=await supabase.rpc('equipment_start_meter',{p_equipo:equipment.id,p_lectura:reading,p_anterior:state.lectura});if(error)throw error;setState(data);setSaved(true);onSaved(data.lectura);}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section aria-label="Configurar horómetro" className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
    <h4 className="text-lg font-black text-slate-900">Configurar horómetro de arranque</h4>
    <p className="mt-2 text-sm text-slate-600">Ingresa la lectura actual del medidor de {equipment.patente}. Será la lectura inicial del primer reporte. No registra horas trabajadas ni genera costos.</p>
    {error&&<p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {saved?<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800">Horómetro guardado: {Number(state.lectura).toLocaleString('es-CL')}. Antes de enviar un reporte, actualiza su pantalla para cargar esta lectura.</p>:state?.puede_configurar?<form onSubmit={save} className="mt-4 space-y-4">
      <label className="block text-sm font-bold text-slate-700">Horómetro actual<input autoFocus required inputMode="decimal" value={value} disabled={busy} onChange={e=>setValue(e.target.value)} className="mt-2 block w-full rounded-xl border-2 border-slate-300 bg-white p-3 text-lg text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100"/></label>
      <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700">Cancelar</button><button disabled={busy} className="rounded-xl bg-blue-900 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'Guardando…':'Guardar horómetro'}</button></div>
    </form>:state?<p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Este equipo ya tiene reportes. Su lectura se actualiza con ellos y no puede configurarse como lectura de arranque.</p>:!error?<p role="status" className="mt-4 text-sm">Comprobando reportes del equipo…</p>:null}
    {(saved||!state?.puede_configurar)&&<button type="button" onClick={onClose} className="mt-4 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700">Cerrar</button>}
  </section>;
}
