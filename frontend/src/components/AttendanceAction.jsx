import React,{useRef} from 'react';
export default function AttendanceAction({title,trigger=title,onOpen,children,primary=false}){
 const ref=useRef(null);
 return <><button type="button" aria-haspopup="dialog" className={'rounded-xl border px-4 py-2 text-xs font-bold '+(primary?'border-blue-900 bg-blue-900 text-white':'border-slate-300 bg-white text-blue-900')} onClick={()=>{onOpen?.();ref.current.showModal();}}>{trigger}</button>
 <dialog ref={ref} aria-label={title} className="fixed inset-0 m-auto max-h-[85vh] w-[min(94vw,44rem)] overflow-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/45">
 <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h3 className="font-extrabold">{title}</h3><button type="button" aria-label="Cerrar ventana" onClick={()=>ref.current.close()} className="rounded-lg px-3 py-1 text-lg">×</button></header>
 <div className="space-y-4 p-5">{children}</div></dialog></>;
}
