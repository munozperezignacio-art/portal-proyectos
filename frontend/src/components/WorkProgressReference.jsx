import React, {useEffect, useState} from 'react';
import {supabase} from '../supabaseClient';
import {saveWorkProgressReference} from '../utils/workProgressReference';

export default function WorkProgressReference({part, parts, budgetId, canEdit, onSaved}) {
  const [value,setValue]=useState(String(part.avance_depende_de || ''));
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{setValue(String(part.avance_depende_de || ''));},[part.id,part.avance_depende_de]);
  const changed=value!==String(part.avance_depende_de || '');
  const save=async()=>{
    if(busy || !canEdit)return;
    setBusy(true);setMessage('');
    try{
      await saveWorkProgressReference(supabase,budgetId,part,value?parts.find(p=>String(p.id)===value):null,parts);
      setMessage('Referencia guardada.');
      await onSaved();
    }catch(error){setMessage(error.message || 'No fue posible guardar la referencia.');}
    finally{setBusy(false);}
  };
  return <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2 font-normal">
    <label className="block text-[10px] font-bold text-slate-700">Avance de la partida
      <select aria-label={`Avance de ${part.partida}`} value={value} disabled={!canEdit || !budgetId || busy} onChange={e=>{setValue(e.target.value);setMessage('');}} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 disabled:opacity-60">
        <option value="">Propio · registro directo</option>
        {parts.filter(p=>p.id!==part.id&&!p.es_titulo&&!['TITULO','GRUPO'].includes(p.unidad)&&Number(p.cantidad)>0).map(p=><option key={p.id} value={p.id}>Proporcional a {p.partida} ({p.unidad})</option>)}
      </select>
    </label>
    <p className="mt-1 text-[10px] text-slate-600">{!budgetId?'Vincula primero el presupuesto a esta obra.':value?'Cantidad propia × porcentaje de avance de la referencia. Sin registro manual ni cambio de precio.':'Registra el avance directamente en esta partida.'}</p>
    {changed && <div className="mt-2 flex gap-2"><button type="button" disabled={busy||!canEdit} onClick={save} className="rounded-lg bg-indigo-800 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{busy?'Guardando…':'Guardar referencia'}</button><button type="button" disabled={busy} onClick={()=>{setValue(String(part.avance_depende_de||''));setMessage('');}} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[10px] text-slate-700">Cancelar</button></div>}
    {message&&<p role="status" className="mt-1 text-[10px] text-slate-800">{message}</p>}
  </div>;
}
