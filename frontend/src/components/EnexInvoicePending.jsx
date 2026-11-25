import React,{useEffect,useRef,useState} from 'react';
import {listEnexInvoiceDrafts} from '../services/enexInvoicesService';
import {invoiceProgress} from '../utils/enexInvoiceProgress';

export default function EnexInvoicePending({db,company,onOpen,disabled,refreshKey}){
 const [page,setPage]=useState(0),[data,setData]=useState({records:[],hasMore:false}),[error,setError]=useState(''),[loading,setLoading]=useState(true),[checkedAt,setCheckedAt]=useState('');
 const [refresh,setRefresh]=useState(0);const pending=useRef(false);
 useEffect(()=>{
  let active=true;pending.current=false;
  async function load(){
   if(pending.current)return;pending.current=true;setLoading(true);
   try{const result=await listEnexInvoiceDrafts(db,company,page);if(active){setData(result);setError('');setCheckedAt(new Date().toLocaleTimeString('es-CL'));}}
   catch(e){if(active)setError(e.message);}finally{if(active){pending.current=false;setLoading(false);}}
  }
  const resume=()=>{if(document.visibilityState==='visible')void load();};
  void load();const timer=setInterval(resume,60000);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
 },[db,company,page,refresh,refreshKey]);
 return <section className="enex-invoice-pending" aria-label="Facturas pendientes">
  <header className="enex-invoice-title"><h3>Facturas pendientes</h3><button className="enex-secondary" disabled={loading||disabled} onClick={()=>setRefresh(n=>n+1)}>Actualizar pendientes</button></header>
  <p className="enex-muted">El PDF y los datos quedan guardados. El avance se consulta al abrir, al volver a esta pestaña y cada minuto mientras esté visible. No necesita volver a subir la factura.</p>
  {error&&<p role="alert">{error}. El estado anterior no está confirmado.</p>}
  {checkedAt&&<p className="enex-muted">Última consulta: {checkedAt}{loading?' · Actualizando…':''}</p>}
  {!data.records.length&&!loading&&!error&&<p>No hay facturas pendientes guardadas.</p>}
  <div className="enex-invoice-pending-grid">{data.records.map(r=>{
   const p=invoiceProgress(r.invoice,r.check_error?null:r.reconciliation),ready=!r.check_error&&r.reconciliation?.ready;
   return <article className="enex-invoice-pending-card" key={r.id}>
    <header><h4>Factura {r.document}</h4><span className={ready?'enex-badge':'enex-pending'}>{r.check_error?'Revisión no disponible':ready?'Lista para emitir':'Pendiente'}</span></header>
    <p>{r.portal==='empresa'?'Empresa':'Transporte'} · {r.invoice.date} · ${Number(r.invoice.total).toLocaleString('es-CL')}</p>
    <strong>{p.assigned===null?'Sin estado actualizado':`${p.assigned} de ${p.total} movimientos con asignación válida`}</strong>
    {p.assigned!==null&&<progress max={p.total||1} value={p.assigned} aria-label={`Avance factura ${r.document}`}/>}
    {p.assigned!==null&&<p>{p.pending} por asignar · {p.missing} sin movimiento · {p.other} con observaciones</p>}
    <p>{r.check_error||(!ready?'Aún no se pueden emitir los formularios. Abra la factura para ver los bloqueos.':'Todas las guías están asignadas y el cruce cuadra. Falta su revisión y confirmación.')}</p>
    <button disabled={disabled||loading||Boolean(error)} onClick={()=>onOpen(r.id)}>Abrir factura {r.document}</button>
   </article>;
  })}</div>
  {(page>0||data.hasMore)&&<nav aria-label="Páginas de facturas pendientes"><button disabled={page===0||loading||disabled} onClick={()=>setPage(n=>n-1)}>Anterior</button><span>Página {page+1}</span><button disabled={!data.hasMore||loading||disabled} onClick={()=>setPage(n=>n+1)}>Siguiente</button></nav>}
 </section>;
}
