import React,{useState,useEffect,useRef} from 'react';
import {supabase} from '../supabaseClient';
import {validBudgetMargin} from '../utils/budgetMargin';
export default function WorkBudgetMargin({obra,canConfigure,onSaved}){
 const [value,setValue]=useState(obra.margen_presupuestado_pct??''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const saving=useRef(false);
 useEffect(()=>{setValue(obra.margen_presupuestado_pct??'');setMessage('');},[obra.id,obra.margen_presupuestado_pct]);
 async function save(){
  if(saving.current||!canConfigure)return;
  if(!validBudgetMargin(value)){setMessage('Ingresa un margen desde 0% y menor que 100%.');return;}
  saving.current=true;setBusy(true);setMessage('');
  try{
   let query=supabase.from('obras').update({margen_presupuestado_pct:Number(value)}).eq('id',obra.id).eq('empresa',obra.empresa);
   query=obra.margen_presupuestado_pct==null?query.is('margen_presupuestado_pct',null):query.eq('margen_presupuestado_pct',obra.margen_presupuestado_pct);
   const {data,error}=await query.select('margen_presupuestado_pct').single();
   if(error)throw error;
   onSaved(data.margen_presupuestado_pct);setMessage('Margen guardado. Estadísticas y proyecciones actualizadas.');
  }catch(e){setMessage(`No se guardó el margen. Actualiza y revisa antes de reintentar: ${e.message}`);}finally{saving.current=false;setBusy(false);}
 }
 return <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3" aria-label="Margen presupuestado de obra"><h4 className="font-bold text-indigo-950">Margen presupuestado</h4><p className="text-xs text-slate-600">Porcentaje sobre la venta neta, sin IVA. Costo objetivo = venta × (1 − margen). No se agrega como gasto. Es la referencia única del CPI y de las proyecciones.</p><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-bold">Margen presupuestado (%)<input type="number" min="0" max="99.99" step="0.01" value={value} disabled={!canConfigure||busy} onChange={e=>setValue(e.target.value)} className="block mt-1 w-40 rounded-lg border bg-white p-2" placeholder="Pendiente"/></label>{canConfigure&&<button type="button" onClick={save} disabled={busy} className="rounded-lg bg-indigo-900 px-4 py-2 text-sm font-bold text-white">{busy?'Guardando…':'Guardar margen'}</button>}</div>{obra.margen_presupuestado_pct==null&&<p className="text-xs text-amber-800">Margen presupuestado pendiente. No se asume 0%.</p>}{message&&<p role="status" className="text-sm">{message}</p>}</section>;
}
