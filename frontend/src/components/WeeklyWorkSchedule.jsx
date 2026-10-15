import React,{useState} from 'react';
import {supabase} from '../supabaseClient';
import {WEEK_DAYS,draftWeeklySchedule,scheduledDayHours,validateWeeklySchedule} from '../utils/weeklyWorkSchedule';
export default function WeeklyWorkSchedule({work,company,canConfigure,onSaved,onClose}) {
  const [draft,setDraft]=useState(()=>draftWeeklySchedule(work)); const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const setDay=(key,field,value)=>setDraft(prev=>({...prev,[key]:{...prev[key],[field]:value}}));
  const save=async event=>{event.preventDefault();if(!canConfigure || busy)return;setError('');try{
    validateWeeklySchedule(draft);setBusy(true);
    const {data,error:saveError}=await supabase.from('obras').update({jornada_semanal:draft}).eq('id',work.id).eq('empresa',company).select('id');
    if(saveError)throw saveError;if(!data?.length)throw new Error('No se guardó la jornada. Revisa tus permisos.');
    onSaved(draft);onClose();
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  let total=0;try{total=WEEK_DAYS.reduce((sum,[key])=>sum+scheduledDayHours(draft[key]),0);}catch{}
  return <div className="fixed inset-0 z-[10000] bg-slate-950/60 flex items-center justify-center p-3"><form onSubmit={save} role="dialog" aria-modal="true" aria-label="Jornada semanal" className="bg-white rounded-2xl p-5 w-full max-w-3xl max-h-[94vh] overflow-auto space-y-4"><header className="flex justify-between gap-3"><div><h3 className="font-black text-lg">Jornada semanal de la obra</h3><p className="text-xs text-slate-500">{work.nombre}</p></div><button type="button" disabled={busy} onClick={onClose}>Cerrar</button></header>
    <p className="text-xs text-slate-600">Configura la jornada contractual de cada día. Todo el tiempo trabajado fuera de sus intervalos ordinarios se calcula como HE, sujeto a aprobación. En días sin jornada, las horas trabajadas se calculan como HE.</p>
    {!work.jornada_semanal && <p className="bg-amber-50 p-3 rounded-xl text-xs text-amber-900">Esta es una propuesta inicial, aún no guardada. Revisa todos los días y horarios antes de confirmar.</p>}
    <div className="space-y-2">{WEEK_DAYS.map(([key,label])=><div key={key} className="rounded-xl border border-slate-200 p-3"><label className="flex gap-2 items-center text-sm font-bold"><input type="checkbox" disabled={!canConfigure || busy} checked={draft[key].active} onChange={e=>setDay(key,'active',e.target.checked)}/>{label}{!draft[key].active && <span className="text-xs font-normal text-slate-500">Sin jornada ordinaria</span>}</label>{draft[key].active && <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">{[['start','Entrada'],['end','Salida'],['breakStart','Inicio colación'],['breakEnd','Fin colación']].map(([field,name])=><label key={field} className="text-[10px] font-bold text-slate-600">{name}<input aria-label={`${label} ${name}`} disabled={!canConfigure || busy} required={field==='start'||field==='end'} type="time" value={draft[key][field]} onChange={e=>setDay(key,field,e.target.value)} className="block border border-slate-200 rounded-lg p-2 mt-1 w-full bg-white"/></label>)}</div>}</div>)}</div>
    <p className="text-xs font-bold">Total de horas ordinarias configuradas: {Number(total.toFixed(2))} h/semana.</p><p className="text-xs text-slate-500">Se aplica a nuevos marcajes. Cada registro conserva la jornada utilizada y no se recalcula por cambiar esta configuración. Para corregir un marcaje anterior, revísalo y guárdalo expresamente.</p>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}{canConfigure && <button disabled={busy} className="bg-blue-900 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40">{busy?'Guardando…':'Guardar jornada semanal'}</button>}
  </form></div>;
}
