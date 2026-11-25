import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../supabaseClient';
import {previousReportDay,reportDateMessage} from './reportDateCheck';
export function useReportDateConfirmation(){
 const [message,setMessage]=useState(''),resolver=useRef(null),pending=useRef(false);
 const finish=value=>{setMessage('');resolver.current?.(value);resolver.current=null;};
 useEffect(()=>()=>resolver.current?.(false),[]);
 const confirm=async({date,equipment,equipmentId,company,check})=>{
  if(pending.current)return false;
  pending.current=true;
  try{
   const previous=previousReportDay(date);let exists=null;
   try{
    if(check)exists=await check(previous);
    else{const r=await supabase.from('maquinaria_uso_diario').select('id').eq('empresa',company).eq('equipo_id',equipmentId).eq('fecha',previous).limit(1);if(r.error)throw r.error;exists=Boolean(r.data?.length);}
   }catch{/* An unavailable history must not be represented as a missing report. */}
   return await new Promise(resolve=>{resolver.current=resolve;setMessage(reportDateMessage(date,exists,equipment));});
  }finally{pending.current=false;}
 };
 const dialog=message?<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="report-date-heading" onKeyDown={e=>{if(e.key==='Escape')finish(false);}} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"><h2 id="report-date-heading" className="text-lg font-black text-slate-900">Confirmar fecha del reporte</h2><p className="mt-3 text-sm text-slate-700">{message}</p><div className="mt-5 flex flex-wrap justify-end gap-3"><button autoFocus type="button" onClick={()=>finish(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700">Volver y revisar fecha</button><button type="button" onClick={()=>finish(true)} className="rounded-xl bg-indigo-900 px-4 py-3 font-bold text-white">Confirmar fecha y enviar</button></div></section></div>:null;
 return {confirm,dialog};
}
