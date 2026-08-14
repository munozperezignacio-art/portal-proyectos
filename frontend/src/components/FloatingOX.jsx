import React,{useEffect,useState}from'react';
import{createPortal}from'react-dom';
import{X,ShieldCheck}from'lucide-react';
import CopilotoObra from'./CopilotoObra';
import OXIcon from'./OXIcon';

export default function FloatingOX({user,obra,moduleContext,onNavigate}){
 const[open,setOpen]=useState(false);
 useEffect(()=>setOpen(false),[obra?.nombre,moduleContext?.id]);
 useEffect(()=>{if(!open)return;const close=event=>event.key==='Escape'&&setOpen(false);window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[open]);
 if((!obra?.nombre&&!moduleContext?.id)||typeof document==='undefined')return null;
 const navigate=destination=>{setOpen(false);onNavigate?.(destination)};
 return createPortal(<>
  {open&&<button type="button" aria-label="Cerrar OX" onClick={()=>setOpen(false)} className="fixed inset-0 z-[69] bg-slate-950/25 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-none"/>}
  <aside aria-hidden={!open} className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-[540px] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ${open?'translate-x-0':'translate-x-full'}`}>
   <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg"><OXIcon className="h-8 w-8"/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-lg font-black text-slate-950">OX</h2><span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-800"><ShieldCheck className="h-3 w-3"/>Solo lectura</span></div><p className="truncate text-xs text-slate-500">{obra?.nombre?`Asistente de ${obra.nombre}`:`Asistente · ${moduleContext?.label||'Obraxis'}`}</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar OX" className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"><X className="h-5 w-5"/></button></header>
   <div className="min-h-0 flex-1 overflow-y-auto p-4"><CopilotoObra user={user} obra={obra} moduleContext={moduleContext} onNavigate={navigate} compact/></div>
  </aside>
  <button type="button" onClick={()=>setOpen(value=>!value)} aria-label={open?'Cerrar asistente OX':'Abrir asistente OX'} aria-expanded={open} className={`fixed bottom-6 right-6 z-[71] flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-slate-950 text-white shadow-[0_16px_40px_rgba(15,23,42,.35)] transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-orange-300 ${open?'scale-0 pointer-events-none':'scale-100'}`}><OXIcon className="h-11 w-11"/><span className="sr-only">Abrir OX</span></button>
 </>,document.body);
}
