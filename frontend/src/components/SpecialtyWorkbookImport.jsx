import React,{useState} from 'react';
import {parsePileWorkbook} from '../utils/specialtyWorkbook';
export default function SpecialtyWorkbookImport({work,partId,state,call,onSaved}){
 const [book,setBook]=useState(null),[stage,setStage]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const run=async fn=>{setBusy(true);try{await fn();await onSaved();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const catalog=book?.catalog.filter(e=>e.etapa===stage)||[];
 const reconcile=async()=>{
  const groups=new Map();for(const row of book.history.filter(e=>e.etapa===stage)){if(!groups.has(row.fecha))groups.set(row.fecha,[]);groups.get(row.fecha).push(row);}
  let done=0;const errors=[];
  for(const [fecha,rows] of groups){
   if(state.sessions.some(s=>s.partida_id===partId&&s.fecha===fecha&&s.estado==='historica'))continue;
   const elements=rows.map(r=>({row:r,el:state.elements.find(e=>e.partida_id===partId&&e.numero===r.numero&&e.etapa===r.etapa)}));
   if(elements.some(r=>!r.el)){errors.push(`${fecha}: primero carga el catálogo.`);continue;}
   const reports=(state.reports||[]).filter(r=>r.partida_id===partId&&r.fecha===fecha);
   if(!reports?.length||reports.reduce((n,r)=>n+Number(r.cantidad),0)!==rows.length){errors.push(`${fecha}: ${rows.length} pilas en Excel; ${reports?.reduce((n,r)=>n+Number(r.cantidad),0)||0} en reportes. Requiere conciliación.`);continue;}
   try{await call('reconcile',{id:crypto.randomUUID(),partida_id:partId,fecha,revision:0,report_ids:reports.map(r=>r.id),datos:{pilas:elements.map(({el,row})=>({element_id:el.id,terminada:true,paladas:row.paladas,volumen:row.volumen,longitud:row.longitud,equipo:row.equipo,origen_excel:{fila:row.sourceRow,cota_inicial:row.cota_inicial,cota_final:row.cota_final,cst:row.cst}})),observaciones:'Historial conciliado desde AVANCE. No genera avance adicional.'},request_id:crypto.randomUUID()});done++;}catch(e){errors.push(`${fecha}: ${e.message}`);}
  }
  setMessage(`${done} jornadas conciliadas sin sumar nuevamente. ${errors.join('\n')}`);
 };
 return <div className="rounded-xl border p-4 space-y-3"><h4 className="font-bold">Catálogo e historial desde Excel</h4><input type="file" accept=".xlsx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)run(async()=>{const b=parsePileWorkbook(await f.arrayBuffer());setBook(b);setStage(b.stages[0]||'');setMessage('Archivo revisado. Selecciona la etapa que corresponde a esta partida.');});}}/>
 {book&&<><select className="border rounded p-2" value={stage} onChange={e=>setStage(e.target.value)}>{book.stages.map(s=><option key={s}>{s}</option>)}</select><p>{catalog.length} pilas del catálogo · {book.history.filter(r=>r.etapa===stage).length} registros históricos.</p><button disabled={busy} className="border rounded p-2 mr-2" onClick={()=>run(async()=>{await call('catalog',{partida_id:partId,rows:catalog,request_id:crypto.randomUUID()});setMessage('Catálogo cargado. Los elementos existentes idénticos se conservan.');})}>Cargar catálogo de esta etapa</button><button disabled={busy} className="border rounded p-2" onClick={()=>run(reconcile)}>Conciliar historial con reportes existentes</button></>}
 {message&&<p role="status" className="whitespace-pre-wrap text-sm bg-amber-50 p-3">{message}</p>}
 </div>;
}
