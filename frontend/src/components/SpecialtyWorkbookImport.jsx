import React,{useEffect,useState} from 'react';
import {workFronts,CorrectReportFronts} from './WorkFronts';
import {parsePileWorkbook,normalizeFront} from '../utils/specialtyWorkbook';
import './SpecialtyWorkbookImport.css';
export default function SpecialtyWorkbookImport({work,partId,state,call,onSaved,catalogOnly=false}){
 const [book,setBook]=useState(null),[stage,setStage]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [missingStage,setMissingStage]=useState('General'),[frontMap,setFrontMap]=useState({});
 const [completed,setCompleted]=useState(null);
 const [fileBuffer,setFileBuffer]=useState(null);
 const run=async fn=>{setBusy(true);try{await fn();await onSaved();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const catalog=book?.catalog||[];
 const [frontState,setFrontState]=useState(null);
 useEffect(()=>{let active=true;if(work?.id)workFronts(work.id,'list').then(r=>{if(active)setFrontState(r);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[work?.id]);
 const fronts=frontState?.fronts||state.fronts||['Frente Principal'];
 const createFront=async source=>{setBusy(true);try{const r=await workFronts(work.id,'create',{nombre:source});const next=await workFronts(work.id,'list');setFrontState(next);setFrontMap(prev=>({...prev,[source]:r.nombre}));setMessage(`Frente ${r.nombre} disponible en esta obra y en el reporte de avance. Los reportes anteriores no se modificaron.`);}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const corrections=frontState?.can_edit&&<CorrectReportFronts key={partId} workId={work?.id} partId={partId} fronts={fronts} onSaved={onSaved}/>;
 const sourceFronts=[...new Set(catalog.map(r=>r.frente||''))];
 const targetFront=source=>frontMap[source]||fronts.find(f=>normalizeFront(f)===normalizeFront(source))||'';
 const ready=catalog.length&&sourceFronts.every(f=>targetFront(f))&&(stage||missingStage.trim());
 const upload=async()=>{
  setBusy(true);setMessage('');
  try{
   await call('catalog',{partida_id:partId,rows:catalog.map(r=>({...r,etapa:r.etapa||missingStage.trim(),frente:targetFront(r.frente||'')})),request_id:crypto.randomUUID()});
   setCompleted({count:catalog.length,stage:stage||missingStage.trim()});
   try{await onSaved();}catch{setMessage('La carga está guardada. Actualiza la página para refrescar el listado.');}
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 };
 const reconcile=async()=>{
  const groups=new Map();for(const row of book.history){if(!groups.has(row.fecha))groups.set(row.fecha,[]);groups.get(row.fecha).push(row);}
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
 if(completed)return <section className="specialty-import-success" role="status" aria-live="polite">
  <h4>✓ Carga de coordenadas completada</h4>
  <p>{completed.count} pilas confirmadas en el catálogo.</p>
  <p>Las pilas que ya existían se conservaron sin duplicarlas.</p>
  {message&&<p>{message}</p>}
  <button type="button" disabled={busy} onClick={()=>{setCompleted(null);setBook(null);setFrontMap({});setMessage('');}}>Cargar otro archivo</button>
  {!catalogOnly&&book?.history.length>0&&<button type="button" disabled={busy} onClick={()=>{setCompleted(null);setMessage('Coordenadas cargadas. Puedes continuar con la conciliación del historial.');}}>Continuar con el historial</button>}
  {corrections}
 </section>;
 return <div className="specialty-workbook-import rounded-xl border p-4 space-y-3"><h4 className="font-bold">{catalogOnly?'Cargar coordenadas de pilas desde Excel':'Catálogo e historial desde Excel'}</h4><p className="text-sm text-slate-500">Selecciona tu Excel con número de pila o punto, Norte y Este. Reconocemos los encabezados sin cambiar hojas ni mover columnas. Frente y longitud son opcionales en el archivo. Las pilas existentes no se sobrescriben.</p><label className="block text-sm font-bold">Archivo Excel de coordenadas<input className="mt-2 block w-full" type="file" accept=".xlsx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)run(async()=>{setBook(null);setFrontMap({});const buffer=await f.arrayBuffer();setFileBuffer(buffer);const b=parsePileWorkbook(buffer);setBook(b);setStage(b.stages[0]||'');setMessage('Archivo reconocido. Revisa los puntos y confirma el frente antes de cargar.');});}}/></label>
 {book&&<>
 <p className="text-sm">Hoja reconocida: <b>{book.sheet}</b> · {catalog.length} puntos</p>
 <label className="block">Columna del Excel que contiene el frente<select aria-label="Columna del frente" disabled={busy} value={book.columns.frente} onChange={e=>{try{setBook(parsePileWorkbook(fileBuffer,e.target.value==='-1'?{}:{frontColumn:Number(e.target.value)}));setFrontMap({});}catch(error){setMessage(error.message);}}}><option value="-1">Sin columna de frente: seleccionar para todos</option>{book.columnOptions.map(c=><option key={c.index} value={c.index}>{c.label}</option>)}</select></label>
 {sourceFronts.map(source=><div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 space-y-2" key={source}><label className="block">{source?`Frente del Excel: ${source}`:'Frente de trabajo (el Excel no lo incluye)'}<select disabled={busy} aria-label={source?`Vincular frente ${source}`:'Frente de trabajo'} className="border rounded p-2 w-full" value={targetFront(source)} onChange={e=>setFrontMap({...frontMap,[source]:e.target.value})}><option value="">Selecciona el mismo frente del reporte de avance</option>{fronts.map(f=><option key={f} value={f}>{f}</option>)}</select></label>{source&&!fronts.some(f=>normalizeFront(f)===normalizeFront(source))&&<button type="button" disabled={busy||!state.can_import} onClick={()=>createFront(source)}>Crear frente «{source}» en esta obra</button>}</div>)}
 <p className="text-xs text-slate-500">Puedes elegir un frente existente o crear el del Excel. Quedará disponible en el reporte de avance. Frente Principal es solo el valor por defecto.</p>
 <div className="coordinate-preview overflow-x-auto"><table aria-label="Vista previa de coordenadas" className="text-sm w-full"><caption>Vista previa · primeras {Math.min(5,catalog.length)} de {catalog.length} pilas</caption><thead><tr><th scope="col">Pila</th><th scope="col">Norte</th><th scope="col">Este</th><th scope="col">Frente</th></tr></thead><tbody>{catalog.slice(0,5).map(r=><tr key={r.sourceRow}><td>{r.numero}</td><td>{r.norte}</td><td>{r.este}</td><td>{targetFront(r.frente||'')||'Por seleccionar'}</td></tr>)}</tbody></table></div>
 {state.can_import&&<button disabled={busy||!ready} className="border rounded p-2 mr-2 disabled:opacity-50" onClick={upload}>{busy?'Cargando coordenadas…':'Cargar coordenadas'}</button>}{!catalogOnly&&state.can_configure&&book.history.length>0&&<button disabled={busy} className="border rounded p-2" onClick={()=>run(reconcile)}>Conciliar historial con reportes existentes</button>}</>}
 {message&&<p role="status" className="whitespace-pre-wrap text-sm bg-amber-50 p-3">{message}</p>}
 {corrections}
 </div>;
}
