import React,{useEffect,useState} from 'react';
import {X,ClipboardList} from 'lucide-react';
import ProgressActivities from './ProgressActivities';
import {productionDate} from '../utils/progressShare.mjs';
export default function ReportActivitiesAction({work,report,reports,parts}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(!open)return;const close=e=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[open]);
 return <><button type="button" onClick={()=>setOpen(true)} title="Actividades y WhatsApp del reporte" className="mt-2 flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold not-italic text-blue-900"><ClipboardList size={16}/>Actividades y WhatsApp</button>
 {open&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-3 text-left not-italic"><div role="dialog" aria-modal="true" aria-label={`Actividades del reporte ${report.id}`} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-blue-950">Reporte #{report.id} · {productionDate(report)}</h3><p className="text-sm text-slate-600">{work.nombre} · {report.partida}</p></div><button type="button" aria-label="Cerrar actividades" onClick={()=>setOpen(false)} className="rounded-xl bg-slate-100 p-3"><X size={20}/></button></div><ProgressActivities reportId={report.id} work={work} date={productionDate(report)} reports={reports} parts={parts}/></div></div>}</>;
}
