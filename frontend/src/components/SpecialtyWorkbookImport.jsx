import React,{useState} from 'react';
import {parsePileWorkbook,normalizeFront} from '../utils/specialtyWorkbook';
export default function SpecialtyWorkbookImport({partId,state,call,onSaved,catalogOnly=false}){
 const [book,setBook]=useState(null),[stage,setStage]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [missingStage,setMissingStage]=useState('General'),[frontMap,setFrontMap]=useState({});
 const run=async fn=>{setBusy(true);try{await fn();await onSaved();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const catalog=book?.catalog.filter(e=>e.etapa===stage)||[];
 const fronts=state.fronts||['Frente Principal'];
 const sourceFronts=[...new Set(catalog.map(r=>r.frente||''))];
 const targetFront=source=>frontMap[source]||fronts.find(f=>normalizeFront(f)===normalizeFront(source))||'';
 const ready=catalog.length&&sourceFronts.every(f=>targetFront(f))&&(stage||missingStage.trim());
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
 return <div className="rounded-xl border p-4 space-y-3"><h4 className="font-bold">{catalogOnly?'Cargar coordenadas de pilas desde Excel':'Catálogo e historial desde Excel'}</h4><p className="text-sm text-slate-500">Selecciona tu Excel con número de pila o punto, Norte y Este. Reconocemos los encabezados sin cambiar hojas ni mover columnas. Etapa, frente y longitud son opcionales en el archivo. Las pilas existentes no se sobrescriben.</p><label className="block text-sm font-bold">Archivo Excel de coordenadas<input className="mt-2 block w-full" type="file" accept=".xlsx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)run(async()=>{setBook(null);setFrontMap({});const b=parsePileWorkbook(await f.arrayBuffer());setBook(b);setStage(b.stages[0]||'');setMessage('Archivo reconocido. Revisa los puntos y confirma el frente antes de cargar.');});}}/></label>
 {book&&<>
 <p className="text-sm">Hoja reconocida: <b>{book.sheet}</b> · {catalog.length} puntos</p>
 {stage!==''?<label className="block">Etapa<select aria-label="Etapa de coordenadas" className="border rounded p-2 w-full" value={stage} onChange={e=>setStage(e.target.value)}>{book.stages.map(s=><option key={s} value={s}>{s||'Sin etapa en Excel'}</option>)}</select></label>:<label className="block">Etapa para los puntos sin etapa<input aria-label="Etapa para los puntos sin etapa" className="border rounded p-2 w-full" maxLength={100} value={missingStage} onChange={e=>setMissingStage(e.target.value)}/></label>}
 {sourceFronts.map(source=><label className="block" key={source}>{source?`Frente del Excel: ${source}`:'Frente de trabajo (el Excel no lo incluye)'}<select aria-label={source?`Vincular frente ${source}`:'Frente de trabajo'} className="border rounded p-2 w-full" value={targetFront(source)} onChange={e=>setFrontMap({...frontMap,[source]:e.target.value})}><option value="">Selecciona el mismo frente del reporte de avance</option>{fronts.map(f=><option key={f} value={f}>{f}</option>)}</select></label>)}
 <p className="text-xs text-slate-500">Se usan los nombres de frente registrados en los avances de esta obra. No se crean frentes por diferencias de escritura.</p>
 <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th>Pila</th><th>Norte</th><th>Este</th><th>Frente</th></tr></thead><tbody>{catalog.slice(0,5).map(r=><tr key={r.sourceRow}><td>{r.numero}</td><td>{r.norte}</td><td>{r.este}</td><td>{targetFront(r.frente||'')||'Por seleccionar'}</td></tr>)}</tbody></table></div>
 {state.can_import&&<button disabled={busy||!ready} className="border rounded p-2 mr-2 disabled:opacity-50" onClick={()=>run(async()=>{await call('catalog',{partida_id:partId,rows:catalog.map(r=>({...r,etapa:r.etapa||missingStage.trim(),frente:targetFront(r.frente||'')})),request_id:crypto.randomUUID()});setMessage('Catálogo cargado. Los elementos existentes idénticos se conservan.');})}>Cargar coordenadas de esta etapa</button>}{!catalogOnly&&state.can_configure&&book.history.length>0&&<button disabled={busy} className="border rounded p-2" onClick={()=>run(reconcile)}>Conciliar historial con reportes existentes</button>}</>}
 {message&&<p role="status" className="whitespace-pre-wrap text-sm bg-amber-50 p-3">{message}</p>}
 </div>;
}
