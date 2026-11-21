import React,{useEffect,useId,useState} from 'react';
import {Plus,Trash2,Save,MessageCircle} from 'lucide-react';
import {supabase} from '../supabaseClient';
import {activityMinutes,validateActivities,dailyProgressMessage,progressEntries} from '../utils/progressActivities';
import {productionDate} from '../utils/progressShare.mjs';
import {progressShareFiles,downloadProgressDiagrams} from '../utils/progressShareFiles';
const input='w-full min-w-0 rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-800 focus:border-blue-800 focus:ring-2 focus:ring-blue-100';
export default function ProgressActivities({work,date,reportId,reports=[],parts=[],share=true}){
 const [state,setState]=useState(null),[rows,setRows]=useState([]),[busy,setBusy]=useState(true),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const list=useId();
 const [notes,setNotes]=useState(undefined),[files,setFiles]=useState([]),[fileWarning,setFileWarning]=useState('');
 const diagramIds=JSON.stringify(progressEntries(parts,reports).filter(e=>e.part.id&&e.history.some(r=>productionDate(r)===date)).map(e=>e.part.id));
 useEffect(()=>{let live=true;setFiles([]);setFileWarning('');if(share)progressShareFiles(supabase,work,date,JSON.parse(diagramIds)).then(f=>{if(live)setFiles(f);}).catch(()=>{if(live)setFileWarning('No se pudo preparar el diagrama. Puedes compartir el texto y volver a intentar el diagrama.');});return()=>{live=false;};},[work.id,date,diagramIds,share]);
 useEffect(()=>{let live=true;setBusy(true);setState(null);setRows([]);setDirty(false);setError('');setNotice('');
  Promise.resolve(supabase.rpc('report_progress_activities',{p_report:reportId})).then(({data,error})=>{if(!live)return;if(error)setError(error.message);else{setState(data);setRows(data.entries);}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};
 },[reportId]);
 function change(next){setRows(next);setDirty(true);setNotice('');}
 function update(i,values){change(rows.map((r,j)=>i===j?{...r,...values}:r));}
 async function save(){setError('');try{validateActivities(rows);setBusy(true);const {data,error}=await supabase.rpc('report_progress_activities',{p_report:reportId,p_entries:rows,p_revision:state.revision});if(error)throw error;setState(data);setRows(data.entries);setDirty(false);setNotice('Actividades y tiempos guardados.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 const canEdit=state?.can_write&&!busy;
 const message=dailyProgressMessage(work.nombre,date,rows,reports,notes,parts);
 const originalNotes=[...new Set(reports.filter(r=>productionDate(r)===date).map(r=>r.observaciones).filter(Boolean))].join('\n');
 async function shareMessage(){try{if(files.length&&navigator.canShare?.({files}))await navigator.share({text:message,files});else window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');}catch(e){if(e.name!=='AbortError')setError('No fue posible abrir el envío: '+e.message);}}
 return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
  <h4 className="font-bold text-blue-950">Registro de actividades · Reporte #{reportId}</h4><p className="text-xs text-slate-500">{date.split('-').reverse().join('-')} · Actividades de este reporte, con sus horarios y duración.</p>
  {busy&&<p role="status">Cargando…</p>}
  <datalist id={list}>{state?.catalog.map(c=><option key={c.nombre} value={c.nombre}/>)}</datalist>
  {rows.map((r,i)=><div key={i} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[110px_110px_1fr_auto]">
   <label className="text-xs font-semibold">Inicio<input aria-label={`Inicio ${i+1}`} type="time" value={r.inicio} disabled={!canEdit} className={input} onChange={e=>update(i,{inicio:e.target.value})}/></label>
   <label className="text-xs font-semibold">Término<input aria-label={`Término ${i+1}`} type="time" value={r.termino} disabled={!canEdit} className={input} onChange={e=>update(i,{termino:e.target.value})}/></label>
   <div className="space-y-2"><label className="text-xs font-semibold">Actividad<select aria-label={`Tipo de actividad ${i+1}`} className={input} disabled={!canEdit} value={r.partida_id||''} onChange={e=>update(i,{partida_id:e.target.value?Number(e.target.value):null,actividad:e.target.value?state.parts.find(p=>String(p.id)===e.target.value).partida:''})}><option value="">Escribir o elegir actividad guardada</option>{state?.parts.map(p=><option key={p.id} value={p.id}>{p.partida}</option>)}</select></label>{!r.partida_id&&<input aria-label={`Actividad ${i+1}`} list={list} maxLength={300} placeholder="Ej.: Charla y HCR" className={input} disabled={!canEdit} value={r.actividad} onChange={e=>update(i,{actividad:e.target.value})}/>}<p className="text-xs text-slate-500">{activityMinutes(r)>0?`${activityMinutes(r)} min`:'Completa el horario'}</p></div>
   <button type="button" disabled={!canEdit} aria-label={`Quitar actividad ${i+1}`} className="self-center rounded-lg p-2 text-red-700 hover:bg-red-50" onClick={()=>change(rows.filter((_,j)=>j!==i))}><Trash2 size={18}/></button>
  </div>)}
  {!busy&&!rows.length&&<p className="text-sm text-slate-500">Sin actividades registradas para este reporte.</p>}
  <div className="flex flex-wrap gap-2">
   {state?.can_write&&<><button type="button" disabled={busy} className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-bold text-blue-900" onClick={()=>change([...rows,{inicio:rows.at(-1)?.termino||'',termino:'',actividad:'',partida_id:null}])}><Plus size={16}/>Agregar actividad</button><button type="button" disabled={busy||!dirty} onClick={save} className="flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2 font-bold text-white disabled:opacity-50"><Save size={16}/>Guardar actividades</button></>}
   {share&&<button type="button" disabled={busy||dirty||!rows.length||!state} onClick={shareMessage} className="flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white disabled:opacity-50"><MessageCircle size={16}/>Compartir por WhatsApp</button>}
   {share&&files.length>0&&<button type="button" onClick={()=>downloadProgressDiagrams(files)} className="rounded-xl border border-blue-200 px-4 py-2 font-bold text-blue-900">Descargar diagramas</button>}
  </div>{dirty&&<p className="text-xs text-amber-800">Hay cambios sin guardar. Guarda antes de compartir o cambiar de fecha.</p>}{notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
 {share&&<><label className="block text-sm font-semibold">Observaciones para compartir<textarea className={input} value={notes??originalNotes} onChange={e=>setNotes(e.target.value)}/></label><p className="text-xs text-slate-500">Si el navegador admite archivos, puedes compartir texto y diagramas juntos. En WhatsApp Web puedes adjuntar los diagramas descargados.</p>{fileWarning&&<p className="text-xs text-amber-800">{fileWarning}</p>}<pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-sm">{message}</pre></>}
 </section>;
}
