import React, {useCallback,useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import SpecialtyReports from './SpecialtyReports';
import QualityWorkflowTabs from './QualityWorkflowTabs';
import SpecialtyAssignmentDialog from './SpecialtyAssignmentDialog';
import ProtocolReviewAction from './ProtocolReviewAction';
const field='w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
const button='rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40';
const primary=`${button} !bg-emerald-700 !text-white`;
const box='rounded-2xl border border-slate-200 bg-white p-4 space-y-4';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export default function QualitySpecialties({work,user,parts=[]}){
 const [state,setState]=useState({specialties:[],types:[],protocols:[]}),[specialty,setSpecialty]=useState('');
 const [pileSettings,setPileSettings]=useState([]),[loading,setLoading]=useState(true),[configureChoice,setConfigureChoice]=useState('');
 const [part,setPart]=useState(''),[type,setType]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [config,setConfig]=useState(null),[format,setFormat]=useState(null),[draft,setDraft]=useState(null);
 const [workflow,setWorkflow]=useState('protocols');
 const addSpecialty=()=>{setConfigureChoice('pilas_grava');setConfig(null);};
 const closeAssignment=()=>{if(window.confirm('¿Cerrar la asignación? Los cambios que no hayas guardado se descartarán.')){setConfigureChoice('');setConfig(null);}};
 const call=useCallback(async(action,data={})=>{const r=await supabase.rpc('quality_specialties_api',{p_work:work.id,p_action:action,p_data:data});if(r.error)throw r.error;return r.data;},[work.id]);
 const load=useCallback(async()=>{const [s,p]=await Promise.all([call('state'),supabase.rpc('specialty_api',{p_work:work.id,p_action:'state',p_data:{}})]);if(p.error)throw p.error;return {s,settings:p.data.settings||[]};},[call,work.id]);
 const accept=useCallback(({s,settings})=>{setState(s);setPileSettings(settings);setSpecialty(previous=>previous|| (settings.length?'pilas_grava':s.specialties[0]?.id||''));setLoading(false);},[]);
 const refresh=useCallback(async()=>accept(await load()),[load,accept]);
 useEffect(()=>{let active=true;load().then(data=>{if(active)accept(data);}).catch(e=>{if(active){setNotice(e.message);setLoading(false);}});return()=>{active=false;};},[load,accept]);
 const run=async fn=>{setBusy(true);setNotice('');try{await fn();await refresh();}catch(e){setNotice(e.message);}finally{setBusy(false);}};
 const chosen=state.specialties.find(s=>s.id===specialty),linked=parts.filter(p=>!p.es_titulo&&chosen?.part_ids.includes(p.id));
 const types=state.types.filter(t=>t.especialidad_id===specialty),selectedType=types.find(t=>t.id===type);
 const records=state.protocols.filter(p=>p.especialidad_id===specialty&&(!part||String(p.partida_id)===part)&&(!type||p.tipo_id===type));
 const discard=()=>!draft||window.confirm('¿Descartar los cambios del protocolo sin guardar?');
 const start=()=>setDraft({id:crypto.randomUUID(),fecha:today(),estado:'borrador',tipo_id:type,partida_id:Number(part),tipo_revision:selectedType.revision,controles_base:selectedType.controles,resultados:selectedType.controles.map(()=>({resultado:'Pendiente',comentario:''})),comentarios:''});
 const save=estado=>run(async()=>{const r=await call('protocol',{...draft,especialidad_id:specialty,estado});setDraft(null);setNotice(`Protocolo #${r.correlativo} ${estado==='aprobado'?'aprobado':'guardado'}.`);});
 const updateResult=(i,key,value)=>setDraft({...draft,resultados:draft.resultados.map((r,j)=>j===i?{...r,[key]:value}:r)});
 return <section className="space-y-4" aria-label="Calidad por especialidad">
  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-sm text-slate-900">Especialidades de la obra</h3>{state.can_configure&&<div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy||!!draft} onClick={addSpecialty}>{pileSettings.length||state.specialties.length?'Agregar especialidad':'Configurar especialidad'}</button>{specialty&&<button type="button" className={button} disabled={busy||!!draft} onClick={()=>{setConfigureChoice(specialty);setConfig(chosen?{...chosen}:null);}}>Asignar especialidades y partidas</button>}</div>}</div>
   <div className="flex flex-wrap items-end gap-3">{(pileSettings.length>0||state.specialties.length>0)&&<label className="flex-1 min-w-0 font-bold text-sm">Especialidad<select className={field} aria-label="Especialidad" value={specialty} disabled={busy} onChange={e=>{if(!discard())return;setSpecialty(e.target.value);setPart('');setType('');setDraft(null);setConfig(null);setConfigureChoice('');setFormat(null);}}>{pileSettings.length>0&&<option value="pilas_grava">Pilas de grava</option>}{state.specialties.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>}
    </div>
   {loading?<p role="status">Cargando especialidades…</p>:!pileSettings.length&&!state.specialties.length&&<p>Esta obra no tiene especialidades configuradas.</p>}
  </div>
  {notice&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3">{notice}</p>}
  {configureChoice&&state.can_configure&&<SpecialtyAssignmentDialog busy={busy} onClose={closeAssignment}><div className="space-y-4">
   <label className="block font-bold">Especialidad a configurar<select className={field} aria-label="Especialidad a configurar" value={configureChoice} onChange={e=>{const id=e.target.value;setConfigureChoice(id);setConfig(id==='new'?{nombre:'',part_ids:[]}:state.specialties.find(s=>s.id===id)||null);}}><option value="pilas_grava">Pilas de grava · formato existente</option>{state.specialties.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}<option value="new">Crear una especialidad nueva…</option></select></label>
   {configureChoice==='pilas_grava'&&<><p className="text-sm">Asocia Pilas de grava a una partida medida en unidades. Las coordenadas y los frentes se administran después en su pestaña Configurar.</p><SpecialtyReports settingsOnly assignmentOnly work={work} user={user} parts={parts.filter(p=>['UND','UN','UNIDAD','UNIDADES'].includes(String(p.unidad).toUpperCase()))} onSaved={async()=>{await refresh();setSpecialty('pilas_grava');setConfigureChoice('');}}/></>}
  </div>
  {config&&state.can_configure&&<form className="space-y-4 border-t border-slate-200 pt-4" onSubmit={e=>{e.preventDefault();run(async()=>{const r=await call('specialty',config);setSpecialty(r.id);setPart('');setType('');setConfig(null);setConfigureChoice('');setNotice('Especialidad y partidas guardadas.');});}}>
   <h4 className="font-bold">{config.id?'Configurar especialidad y partidas':'Nueva especialidad'}</h4>
   {config.id?<p className="font-bold text-indigo-900">{config.nombre}</p>:<label className="block">Nombre de la especialidad<input required maxLength={120} className={field} value={config.nombre} onChange={e=>setConfig({...config,nombre:e.target.value})}/></label>}
   <fieldset><legend className="font-bold mb-2">Partidas vinculadas</legend><div className="grid gap-2 md:grid-cols-2 max-h-72 overflow-auto">{parts.filter(p=>!p.es_titulo).map(p=><label className="rounded-xl border border-slate-200 bg-white p-3 flex gap-2 items-start" key={p.id}><input type="checkbox" checked={config.part_ids.includes(p.id)} onChange={e=>setConfig({...config,part_ids:e.target.checked?[...config.part_ids,p.id]:config.part_ids.filter(id=>id!==p.id)})}/><span>{p.partida} · {p.unidad}</span></label>)}</div></fieldset>
   <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" disabled={busy} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold" onClick={closeAssignment}>Cancelar</button><button className="rounded-xl bg-blue-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy||!config.part_ids.length}>{busy?'Guardando…':'Guardar especialidad y partidas'}</button></div>
  </form>}
  {notice&&<p role="status">{notice}</p>}
  </SpecialtyAssignmentDialog>}
  {specialty==='pilas_grava'&&pileSettings.length>0?<SpecialtyReports quality work={work} user={user} parts={parts.filter(p=>pileSettings.some(s=>String(s.partida_id)===String(p.id)))}/>:chosen&&<>
   <QualityWorkflowTabs value={workflow} onChange={next=>{if(discard()){setDraft(null);setFormat(null);setConfig(null);setWorkflow(next);}}} items={[...(state.can_configure?[['settings','Configurar']]:[]),['protocols','Protocolos'],['review','Revisar y emitir protocolos']]}/>
   <div className={box}><h4 className="font-bold text-slate-900">Partidas asociadas · {chosen.nombre}</h4>
    <div className="grid md:grid-cols-2 gap-3"><label>Partida<select className={field} aria-label="Partida" value={part} disabled={!!draft||busy} onChange={e=>setPart(e.target.value)}><option value="">Todas las partidas vinculadas</option>{linked.map(p=><option key={p.id} value={p.id}>{p.partida} · {p.unidad}</option>)}</select></label>
     <label>Tipo de protocolo<select className={field} aria-label="Tipo de protocolo" value={type} disabled={!!draft||busy} onChange={e=>setType(e.target.value)}><option value="">Todos los tipos</option>{types.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label></div>
    <div className="flex flex-wrap gap-2">{workflow==='settings'&&state.can_configure&&<><button className={button} disabled={!!draft||busy} onClick={()=>setFormat({nombre:'',controles:''})}>Agregar tipo de protocolo</button>{selectedType&&<button className={button} disabled={!!draft||busy} onClick={()=>setFormat({...selectedType,controles:selectedType.controles.join('\n')})}>Editar formato</button>}</>}
     {workflow==='protocols'&&state.can_create&&<button className={primary} disabled={!part||!type||!!draft||busy} onClick={start}>Crear protocolo</button>}</div>
    {!types.length&&<p className="text-sm text-slate-600">Todavía no hay formatos. Agrega un tipo de protocolo con sus controles para esta especialidad.</p>}
    {workflow==='protocols'&&!draft&&(!part||!type)&&<p className="text-sm text-slate-600">Para crear un protocolo, selecciona una partida y un tipo.</p>}
   </div>
   {format&&state.can_configure&&<form className={box} onSubmit={e=>{e.preventDefault();run(async()=>{const r=await call('type',{...format,especialidad_id:specialty,controles:format.controles.split('\n').map(s=>s.trim()).filter(Boolean)});setType(r.id);setFormat(null);setNotice('Formato guardado. Los protocolos existentes mantienen sus controles.');});}}>
    <h4 className="font-bold">Formato del protocolo · {chosen.nombre}</h4><p className="text-sm">Define los puntos a revisar. Cada uno tendrá un resultado y comentario opcional. Los cambios solo se aplican a protocolos nuevos.</p>
    <label className="block">Nombre del tipo de protocolo<input className={field} required maxLength={120} value={format.nombre} onChange={e=>setFormat({...format,nombre:e.target.value})}/></label>
    <label className="block">Controles del protocolo (uno por línea)<textarea className={field} required rows={6} value={format.controles} onChange={e=>setFormat({...format,controles:e.target.value})}/></label>
    <div className="flex gap-2"><button className={primary} disabled={busy}>Guardar formato</button><button className={button} type="button" onClick={()=>setFormat(null)}>Cancelar</button></div>
   </form>}
   {draft&&<div className={`${box} !border-indigo-200`}>
    <h4 className="font-bold text-indigo-950">{draft.correlativo?`Protocolo #${draft.correlativo}`:'Crear protocolo'} · {draft.tipo||selectedType?.nombre}</h4><p>{chosen.nombre} · {parts.find(p=>p.id===draft.partida_id)?.partida}</p>
    <fieldset disabled={busy||draft.estado==='aprobado'||(draft.revision?!state.can_edit:!state.can_create)} className="space-y-3">
     <label className="block">Fecha del protocolo<input required className={field} type="date" value={draft.fecha} onChange={e=>setDraft({...draft,fecha:e.target.value})}/></label>
     {draft.controles_base.map((control,i)=><div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2"><strong>{i+1}. {control}</strong>
      <label className="block text-sm">Resultado · {control}<select className={field} aria-label={`Resultado · ${control}`} value={draft.resultados[i].resultado} onChange={e=>updateResult(i,'resultado',e.target.value)}>{['Pendiente','Conforme','No conforme','No aplica'].map(r=><option key={r}>{r}</option>)}</select></label>
      <label className="block text-sm">Comentario · {control} (opcional)<textarea className={field} value={draft.resultados[i].comentario||''} onChange={e=>updateResult(i,'comentario',e.target.value)}/></label></div>)}
     <label className="block">Comentarios generales (opcional)<textarea className={field} value={draft.comentarios} onChange={e=>setDraft({...draft,comentarios:e.target.value})}/></label>
     {draft.estado!=='aprobado'&&<div className="flex flex-wrap gap-2"><button className={primary} disabled={!draft.fecha} onClick={()=>save('borrador')}>Guardar borrador</button><p className="text-sm text-slate-500">Guarda los cambios y revisa esta versión en Revisar y emitir protocolos antes de aprobar.</p></div>}
    </fieldset><button className={button} onClick={()=>{if(discard())setDraft(null);}}>Cerrar protocolo</button>
   </div>}
   {workflow==='review'&&<section className={box}><h4 className="font-bold">Protocolos · {chosen.nombre} ({records.length})</h4>{!records.length&&<p>No hay protocolos para esta selección.</p>}
    {records.map(r=><article key={r.id} className="rounded-xl border border-slate-200 p-3 space-y-2"><strong>{r.snapshot.tipo} · #{r.correlativo}</strong><p className="text-sm text-indigo-900">{r.snapshot.especialidad} · {r.snapshot.partida}</p><p className="text-sm">{r.fecha.split('-').reverse().join('/')} · {r.estado==='aprobado'?'Aprobado':'Borrador'} · {r.snapshot.autor}</p><ProtocolReviewAction workId={work.id} kind="general" protocol={r} allowed={state.can_review} onSaved={refresh}/>{r.estado==='borrador'&&state.can_approve&&<button className={button} disabled={busy||r.revision_revisada!==r.revision||!r.revisado_at} onClick={()=>{if(window.confirm('¿Aprobar esta versión revisada?'))run(async()=>{await call('protocol',{...r,...r.snapshot,especialidad_id:specialty,estado:'aprobado'});setDraft(null);setNotice(`Protocolo #${r.correlativo} aprobado.`);});}}>Aprobar protocolo</button>}<button className={button} onClick={()=>{if(discard())setDraft({...r,...r.snapshot});}}>{r.estado==='borrador'&&state.can_edit?'Ver / editar protocolo':'Ver protocolo'}</button>{state.can_download&&<button className={button} disabled={busy} onClick={()=>run(async()=>{const {qualitySpecialtyPdf}=await import('../utils/qualitySpecialtyPdf');qualitySpecialtyPdf(r).save(`protocolo-${r.correlativo}-${r.fecha}.pdf`);})}>Descargar PDF</button>}</article>)}
   </section>}
  </>}
 </section>;
}
