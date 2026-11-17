import React, {useEffect, useRef} from 'react';
export default function AssignmentWindow({row,busy,error,onClose,children}) {
 const ref=useRef(null);
 useEffect(()=>{
  const previous=document.activeElement;
  const overflow=document.body.style.overflow;
  const dialog=ref.current;
  dialog.showModal();
  document.body.style.overflow='hidden';
  return ()=>{
   dialog.close();
   document.body.style.overflow=overflow;
   if(previous?.isConnected) previous.focus({preventScroll:true});
  };
 },[]);
 return <dialog ref={ref} className="enex-assignment-dialog" aria-labelledby="enex-assignment-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <header><h2 id="enex-assignment-title">Asignar carga</h2><button type="button" disabled={busy} aria-label="Cerrar asignación" onClick={onClose}>✕</button></header>
  <p className="enex-info"><strong>Patente / vehículo: {row?.vehicle}</strong><br/>Documento: {row?.document}<br/>{row?.portal==='empresa'?'Empresa':'Transporte'} · {row?.occurred_local}</p>
  {error&&<p role="alert">{error}</p>}
  {children}
 </dialog>;
}
