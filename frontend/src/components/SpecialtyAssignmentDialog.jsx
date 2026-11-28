import React,{useEffect,useRef} from 'react';

export default function SpecialtyAssignmentDialog({children,onClose,busy,title='Asignar especialidades a la obra',description='Selecciona la especialidad y sus partidas asociadas.'}){
 const ref=useRef(null);
 useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
 return <dialog ref={ref} aria-labelledby="specialty-assignment-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-5 shadow-2xl sm:p-6 backdrop:bg-slate-950/50">
  <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3"><div><h3 id="specialty-assignment-title" className="text-lg font-black text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-500">{description}</p></div><button type="button" disabled={busy} aria-label="Cerrar asignación de especialidades" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button></div>
  <div className="space-y-4">{children}</div>
 </dialog>;
}
