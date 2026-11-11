import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from '../supabaseClient';
import {createJournalStore,pileDiagram} from '../../../mobile/src/lib/specialtyJournal.mjs';
import SpecialtyProtocols from './SpecialtyProtocols';
import SpecialtyWorkbookImport from './SpecialtyWorkbookImport';

const field='rounded-lg border border-slate-300 bg-white p-2 text-sm w-full';
const button='rounded-lg border border-indigo-200 px-3 py-2 text-sm font-bold text-indigo-900 disabled:opacity-40';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const storage={getItem:async k=>localStorage.getItem(k),setItem:async(k,v)=>localStorage.setItem(k,v)};
const empty={settings:[],elements:[],sessions:[],protocols:[],users:[]};
const executionFields=[['paladas','Paladas'],['volumen','Volumen m³'],['longitud','Longitud m'],['longitud_perforacion','Perforación m'],['profundidad','Profundidad m']];
export function SpecialtySettingsEntry(props){
 const [open,setOpen]=useState(false);
 return <div className="mb-4"><button type="button" aria-expanded={open} className={button} onClick={()=>setOpen(v=>!v)}>Configurar especialidad</button>{open&&<div className="mt-2"><SpecialtyReports {...props} settingsOnly/></div>}</div>;
}
export default function SpecialtyReports({work,user,parts=[],quality=false,settingsOnly=false,onSaved=()=>{},settingsRevision=0,onHistory}){
 const [state,setState]=useState(empty),[partId,setPartId]=useState(''),[draft,setDraft]=useState(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [tab,setTab]=useState(settingsOnly?'settings':quality?'protocols':'journal'),[config,setConfig]=useState({}),[selected,setSelected]=useState('');
 const call=useCallback(async(action,data={})=>{const r=await supabase.rpc('specialty_api',{p_work:work.id,p_action:action,p_data:data});if(r.error)throw r.error;return r.data;},[work.id]);
 const refresh=useCallback(async()=>{try{const next=await call('state');setState(next);onHistory?.({workId:work.id,sessions:next.sessions,elements:next.elements});setNotice('');}catch(e){setNotice(e.message);}},[call,onHistory,work.id]);
 useEffect(()=>{refresh();},[refresh,settingsRevision]);
 useEffect(()=>{if(!partId&&parts.length&&state.actor)setPartId(String(parts.find(p=>state.settings.some(s=>s.partida_id===p.id))?.id||parts.find(p=>!p.es_titulo)?.id||''));},[parts,partId,state.settings,state.actor]);
 const cfg=state.settings.find(s=>String(s.partida_id)===partId);
 useEffect(()=>{setConfig(cfg||{activa_desde:today()});},[cfg]);
 const journal=useMemo(()=>createJournalStore({storage,send:call,uuid:()=>crypto.randomUUID(),scope:`${user.empresa}:${user.auth_user_id||user.id}:${work.id}:${partId}`}),[call,user.empresa,user.auth_user_id,user.id,work.id,partId]);
 useEffect(()=>{if(settingsOnly||quality)return;let active=true;journal.read().then(s=>{if(active)setDraft(s.draft||null);});return()=>{active=false;};},[journal,settingsOnly,quality]);
 const sync=useCallback(async()=>{try{const response=await journal.sync();const local=await journal.read();setDraft(local.draft||null);if(response){setNotice(response.cancelled?'Jornada cancelada sin registrar avance':local.draft?'Guardado y sincronizado':'Jornada cerrada. Avance consolidado una sola vez.');if(!local.draft){await refresh();onSaved();}}}catch(e){setDraft((await journal.read()).draft||null);setNotice(`Borrador conservado en este dispositivo. ${e.message}`);}},[journal,refresh,onSaved]);
 useEffect(()=>{if(!draft)return;const timer=setInterval(sync,5000);return()=>clearInterval(timer);},[draft,sync]);
 const action=async fn=>{setBusy(true);try{await fn();await refresh();if(settingsOnly)onSaved();}catch(e){setNotice(e.message);}finally{setBusy(false);}};
 const edit=async next=>{setDraft(next);try{await journal.edit(next);setNotice('Guardado en este dispositivo');}catch(e){setNotice(`No se pudo guardar localmente: ${e.message}`);}};
 const elements=state.elements.filter(e=>String(e.partida_id)===partId);
 const sessions=state.sessions.filter(s=>String(s.partida_id)===partId);
 const [workDate,setWorkDate]=useState(today);
 const activeSession=sessions.find(s=>s.fecha===workDate);
 const blocked=!workDate||workDate>today()||workDate<cfg?.activa_desde?'Selecciona una fecha dentro del período de registro.':
 activeSession&&activeSession.estado!=='abierta'?'Esta jornada ya está registrada. Consulta el historial de reportes.':
 !activeSession&&(state.reports||[]).some(r=>String(r.partida_id)===partId&&r.fecha===workDate)?'Ya existe un reporte de esta partida para la fecha seleccionada. Revisa el historial.':'';
 const start=async()=>{if(blocked)return;const next=activeSession||{id:crypto.randomUUID(),partida_id:Number(partId),fecha:workDate,revision:0,datos:{pilas:[],observaciones:''}};await edit(next);};
 const canExecute=state.can_execute===true,canTopo=cfg?.topografia===state.actor,canQuality=cfg?.calidad===state.actor;
 const [pileSearch,setPileSearch]=useState('');
 const rows=draft?.datos?.pilas||[];
 const updatePile=(id,key,value)=>edit({...draft,datos:{...draft.datos,pilas:rows.map(p=>p.element_id===id?{...p,[key]:value}:p)}});
 const diagram=pileDiagram(elements,rows.filter(p=>p.terminada).map(p=>p.element_id));
 if(settingsOnly&&!state.can_configure)return <p role="status">{notice||(!state.actor?'Cargando configuración…':'No tienes permiso para configurar esta especialidad.')}</p>;
 return <section className="rounded-2xl border border-indigo-200 bg-white p-5 space-y-4">
  <div><h3 className="text-lg font-bold text-indigo-950">{settingsOnly?'Configuración por partida':quality?'Protocolos por especialidad':'Reportes por especialidad'}</h3><p className="text-sm text-slate-500">Pilas de grava · Ejecución diaria, topografía y Calidad con responsables independientes.</p></div>
  <label className="block text-sm font-bold">Partida<select className={field} value={partId} onChange={e=>setPartId(e.target.value)}>{parts.filter(p=>!p.es_titulo).map(p=><option key={p.id} value={p.id}>{p.partida} · {p.unidad}</option>)}</select></label>
  {!settingsOnly&&<nav className="flex flex-wrap gap-2">{(quality?[['protocols','Protocolos'],['topography','Topografía pendiente'],...(state.can_configure?[['reconciliation','Conciliaciones pendientes']]:[])]:[['journal','Jornada']]).map(([key,label])=><button key={key} className={`${button} ${tab===key?'bg-indigo-100':''}`} onClick={()=>setTab(key)}>{label}</button>)}</nav>}
  {notice&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{notice}</p>}
  {!cfg&&tab!=='settings'&&<p>Esta partida todavía usa el registro por unidades. Administración puede configurarla en Responsables y avisos → Configurar especialidad.</p>}
  {tab==='settings'&&state.can_configure&&<div className="space-y-4">
   <p className="text-sm">Selecciona la partida y designa a sus responsables. Las reglas de avisos se administran por separado.</p>
   <div className="grid gap-3 md:grid-cols-3">{[['ejecucion','Ejecución y cierre'],['topografia','Topografía de terreno'],['calidad','Construcción y revisión de protocolos']].map(([key,label])=><label key={key}>{label}<select className={field} value={config[key]||''} onChange={e=>setConfig({...config,[key]:e.target.value})}><option value="">Sin asignar</option>{state.users.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}</select></label>)}</div>
   <label className="block">Inicio del registro por especialidad<input disabled={sessions.some(s=>s.estado!=='historica')} type="date" className={field} value={config.activa_desde||''} onChange={e=>setConfig({...config,activa_desde:e.target.value})}/></label>
   <p className="text-xs text-slate-500">Los días anteriores se concilian con sus reportes existentes; no vuelven a sumarse.</p>
   <button className={button} disabled={busy} onClick={()=>action(()=>call('configure',{...config,partida_id:Number(partId),request_id:crypto.randomUUID()}))}>Guardar especialidad y responsables</button>
   {cfg&&<p className="text-sm">El catálogo y la conciliación histórica se gestionan en Calidad → Protocolos por especialidad → Conciliaciones pendientes.</p>}
  </div>}
  {quality&&cfg&&tab==='reconciliation'&&state.can_configure&&<section className="space-y-3">
   <h4 className="font-bold">Avances por cantidad pendientes de identificar</h4>
   <PendingReports key={partId} reports={state.reports} sessions={sessions} config={cfg} elements={elements} call={call} refresh={refresh}/>
   <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">Conciliaciones realizadas ({sessions.filter(s=>s.estado==='historica').length})</summary>
    {sessions.filter(s=>s.estado==='historica').map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2">
     <span>{s.fecha.split('-').reverse().join('-')} · Reportes: {s.report_ids.join(', ')}</span>
     <button type="button" className={button} disabled={busy||state.protocols.some(p=>p.sesion_id===s.id)} onClick={()=>{if(window.confirm('¿Deshacer la conciliación del '+s.fecha.split('-').reverse().join('-')+'? Las pilas quedarán desvinculadas. Se conservarán los reportes y sus cantidades de avance.'))action(()=>call('undo_reconcile',{id:s.id,partida_id:s.partida_id,revision:s.revision}));}}>{state.protocols.some(p=>p.sesion_id===s.id)?'Protegida por protocolo':'Deshacer conciliación'}</button>
    </div>)}
   </details>
   <SpecialtyWorkbookImport key={partId} work={work} partId={Number(partId)} state={state} call={call} onSaved={refresh}/>
  </section>}
  {cfg&&tab==='journal'&&<div className="space-y-4">
   {!canExecute?<p>Tu rol no tiene permiso para registrar avances en esta obra.</p>:!draft?<div className="space-y-2"><label className="block text-sm font-bold">Fecha de la jornada<input className={field} type="date" min={cfg.activa_desde} max={today()} value={workDate} onChange={e=>setWorkDate(e.target.value)}/></label><p className="text-sm">{blocked||'Para registrar producción atrasada, selecciona el día en que se ejecutaron las pilas.'}</p><button type="button" className={button} disabled={!!blocked} onClick={start}>{activeSession?.estado==='abierta'?'Continuar jornada abierta':'Iniciar jornada de trabajo'}</button></div>:<>
    <div className="flex flex-wrap gap-3 items-center"><strong>Jornada {draft.fecha.split('-').reverse().join('-')}</strong><span>{rows.filter(p=>p.terminada).length} pilas terminadas</span><button className={button} onClick={sync}>Sincronizar ahora</button></div>
    <p className="text-xs">Puedes modificar los datos de cada pila directamente en su fila. Autoguardado en este dispositivo. No borres los datos del navegador antes de sincronizar. Un conflicto conserva tu borrador para revisión.</p>
    <label className="block text-sm">Buscar pila por número o etapa<input className={field} type="search" value={pileSearch} onChange={e=>{setPileSearch(e.target.value);setSelected('');}}/></label>
    <div className="flex gap-2"><select disabled={draft.closeRequested} className={field} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Seleccionar pila</option>{elements.filter(e=>(e.etapa+' '+e.numero).toLowerCase().includes(pileSearch.trim().toLowerCase())&&!e.sesion_id&&!rows.some(r=>r.element_id===e.id)).map(e=><option key={e.id} value={e.id}>{e.etapa} · Pila {e.numero}</option>)}</select><button className={button} disabled={!selected||draft.closeRequested} onClick={()=>{edit({...draft,datos:{...draft.datos,pilas:[...rows,{element_id:selected,paladas:'',volumen:'',longitud:'',equipo:'',terminada:false}]}});setSelected('');setPileSearch('');}}>Agregar</button></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Pila',...executionFields.map(f=>f[1]),'Terminada','Acciones'].map(x=><th className="p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.element_id}><td className="p-2">{elements.find(e=>e.id===r.element_id)?.numero}</td>{executionFields.map(([k])=><td className="p-1" key={k}>{k==='volumen'?<output>{r.paladas!==''&&Number(String(cfg?.datos_fijos?.volumen_cuchara??'').replace(',','.'))>0?(Number(r.paladas)*Number(String(cfg?.datos_fijos?.volumen_cuchara??'').replace(',','.'))).toLocaleString('es-CL',{maximumFractionDigits:6}):'Pendiente de balde o paladas'}</output>:<input aria-label={`${k} pila ${elements.find(e=>e.id===r.element_id)?.numero}`} disabled={draft.closeRequested} className={`${field} min-w-24`} type={k==='equipo'?'text':'number'} min="0" step="any" value={r[k]??''} onChange={e=>updatePile(r.element_id,k,e.target.value)}/>}</td>)}<td className="p-2"><input aria-label="Pila terminada" type="checkbox" disabled={draft.closeRequested} checked={!!r.terminada} onChange={e=>updatePile(r.element_id,'terminada',e.target.checked)}/></td><td><button type="button" className={button} disabled={draft.closeRequested} onClick={()=>{if(window.confirm('¿Quitar esta pila de la jornada? Seguirá disponible en el catálogo.'))edit({...draft,datos:{...draft.datos,pilas:rows.filter(p=>p.element_id!==r.element_id)}});}}>Quitar pila</button></td></tr>)}</tbody></table></div>
    <label className="block">Comentarios generales del reporte<textarea className={field} disabled={draft.closeRequested} value={draft.datos.observaciones||''} onChange={e=>edit({...draft,datos:{...draft.datos,observaciones:e.target.value}})}/></label>
    <button className={`${button} bg-indigo-900 text-white`} disabled={draft.closeRequested} onClick={async()=>{if(!window.confirm('¿Cerrar la jornada? Solo las pilas terminadas se sumarán al avance. Calidad continuará por separado.'))return;await journal.close();setDraft((await journal.read()).draft);await sync();await sync();}}>{draft.cancelRequested?'Cancelación pendiente':draft.closeRequested?'Cierre pendiente de sincronización':'Cerrar jornada y consolidar avance'}</button>
    <button type="button" className={button} disabled={draft.closeRequested} onClick={async()=>{if(!window.confirm('¿Cancelar toda la jornada? Se descartarán sus pilas y comentarios sin generar avance.'))return;await journal.cancel();setDraft((await journal.read()).draft);await sync();await sync();}}>Cancelar jornada</button>
   </>}
  </div>}
  {quality&&cfg&&tab==='topography'&&<TopoInbox key={partId} sessions={sessions} elements={elements} disabled={!canTopo||busy} onSave={(e,datos)=>action(()=>call('topography',{partida_id:Number(partId),element_id:e.id,revision:e.revision_topografia,datos,request_id:crypto.randomUUID()}))}/>}
  {cfg&&tab==='history'&&<><svg viewBox="0 0 600 400" className="max-h-96 w-full border rounded-xl" aria-label="Esquema de pilas por coordenadas">{diagram.map(e=><g key={e.id}><circle cx={e.x} cy={e.y} r="3" fill={e.status==='day'?'#10b981':e.status==='done'?'#243a80':'#d1d5db'}/><title>{e.etapa} · {e.numero}</title></g>)}</svg><p className="text-xs">Verde: jornada actual · Azul: ejecutada · Gris: pendiente.</p>{sessions.map(s=><details key={s.id} className="rounded-lg border p-3"><summary>{s.fecha.split('-').reverse().join('-')} · {s.estado} · {s.datos.pilas.filter(p=>p.terminada).length} pilas</summary><p className="text-sm mt-2">{s.datos.pilas.map(p=>elements.find(e=>e.id===p.element_id)?.numero).join(', ')}</p><p>{s.datos.observaciones}</p></details>)}</>}
  {cfg&&tab==='protocols'&&<SpecialtyProtocols key={cfg.partida_id} work={work} user={user} state={state} cfg={cfg} sessions={sessions} elements={elements} call={call} refresh={refresh} renderTopo={e=><TopoRow key={e.id+':'+e.revision_topografia} element={e} disabled={!canTopo||busy} onSave={datos=>action(()=>call('topography',{partida_id:Number(partId),element_id:e.id,revision:e.revision_topografia,datos,request_id:crypto.randomUUID()}))}/>}/>}
 </section>;
}

function QuickPilePicker({number,setNumber,elements,items,full,add}){
 const input=React.useRef(null),q=number.trim().toLowerCase();
 const available=elements.filter(e=>!e.sesion_id&&!items.some(i=>i.element_id===e.id));
 const matches=available.filter(e=>String(e.numero).toLowerCase().startsWith(q));
 const exact=matches.filter(e=>String(e.numero).toLowerCase()===q);
 const choose=e=>{if(!full&&e){add(e);input.current?.focus();}};
 return <div className="space-y-2"><label className="block text-sm font-bold">Número de pila
 <input ref={input} className={field} placeholder="Ej.: 111" value={number} disabled={full} onChange={e=>setNumber(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(exact.length===1)choose(exact[0]);}}}/></label>
 <button type="button" className={button} disabled={full||exact.length!==1} onClick={()=>choose(exact[0])}>Agregar pila</button>
 <span className="ml-2 text-xs" role="status">{full?'Cantidad del reporte completa.':!matches.length?'No hay pilas disponibles con ese número.':exact.length>1?'Número repetido: selecciona la etapa.':'Escribe el número completo y pulsa Enter.'}</span>
 <select className={field} disabled={full} aria-label="Agregar pila a conciliación" value="" onChange={e=>choose(matches.find(p=>String(p.id)===e.target.value))}><option value="">Seleccionar pila por etapa y número</option>{matches.map(e=><option key={e.id} value={e.id}>{e.etapa} · Pila {e.numero}</option>)}</select></div>;
}
function PendingReports({reports=[],sessions,config,elements,call,refresh}){
 const [number,setNumber]=useState('');
 const [date,setDate]=useState(''),[items,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const linked=new Set(sessions.flatMap(session=>(session.report_ids||[]).map(String)));
 const pending=reports.filter(r=>String(r.partida_id)===String(config.partida_id)&&r.fecha&&!linked.has(String(r.id)));
 const days=[...new Set(pending.map(r=>r.fecha))].sort().reverse(),day=pending.filter(r=>r.fecha===date),total=day.reduce((n,r)=>n+Number(r.cantidad),0);
 const change=(id,k,v)=>setItems(items.map(x=>x.element_id===id?{...x,[k]:v,...(k==='paladas'?{volumen:v!==''&&Number(String(config.datos_fijos?.volumen_cuchara??'').replace(',','.'))>0?Number(v)*Number(String(config.datos_fijos.volumen_cuchara).replace(',','.')):''}:{})}:x));
 if(!pending.length)return <p>No hay avances por cantidad pendientes en esta partida.</p>;
 return <fieldset disabled={busy} className="space-y-2"><label>Fecha del avance<select className={field} value={date} onChange={e=>{setDate(e.target.value);setItems([]);setError('');}}><option value="">Selecciona un día</option>{days.map(d=><option key={d} value={d}>{d.split('-').reverse().join('-')}</option>)}</select></label>{day.length>0&&<>
 <p>Reportes {day.map(r=>'#'+r.id).join(', ')} · {items.length} de {total} pilas identificadas. Conciliar no modifica la cantidad registrada.</p>
 <QuickPilePicker number={number} setNumber={setNumber} elements={elements} items={items} full={items.length>=total} add={e=>{setItems(prev=>prev.length>=total||prev.some(i=>i.element_id===e.id)?prev:[...prev,{element_id:e.id,terminada:true,paladas:'',volumen:'',longitud:''}]);setNumber('');}}/>
 {items.map(i=><div key={i.element_id} className="flex flex-wrap gap-2 items-end"><strong>Pila {elements.find(e=>e.id===i.element_id)?.numero}</strong>{executionFields.filter(([k])=>['paladas','volumen','longitud'].includes(k)).map(([k,label])=><label key={k}>{label}<input className={field} type="number" readOnly={k==='volumen'} min="0" step="any" value={i[k]} onChange={e=>change(i.element_id,k,e.target.value)}/></label>)}<button type="button" onClick={()=>setItems(items.filter(x=>x!==i))}>Quitar</button></div>)}
 <button type="button" className={button} disabled={!items.length||items.length!==total} onClick={async()=>{setBusy(true);setError('');try{await call('reconcile',{id:crypto.randomUUID(),fecha:date,partida_id:config.partida_id,revision:0,report_ids:day.map(r=>r.id),datos:{pilas:items,observaciones:'Conciliación de avance por cantidad en Calidad.'},request_id:crypto.randomUUID()});setItems([]);setDate('');await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}}>Conciliar sin sumar avance</button>{error&&<p role="alert">{error}</p>}</>}</fieldset>;
}
const missing=v=>v==null||String(v).trim()==='';
const historicalFields=['cota_inicial','cota_final','cst','bst','norte_real','este_real','cota_real','cota_diseno','deformacion','profundidad_control'];
function TopoInbox({sessions,elements,disabled,onSave}){
 const [day,setDay]=useState(''),[search,setSearch]=useState(''),[onlyPending,setOnlyPending]=useState(true),[limit,setLimit]=useState(40);
 const bySession=new Map(sessions.map(s=>[s.id,s]));
 const historical=new Map(sessions.filter(s=>s.estado==='historica').flatMap(s=>(s.datos?.pilas||[]).map(p=>[p.element_id,p.origen_excel||p])));
 const rows=elements.filter(e=>{const s=bySession.get(e.sesion_id),t=e.topografia||{},h=historical.get(e.id)||{};
 return (!day||s?.fecha===day)&&String(e.numero).includes(search.trim())&&(!onlyPending||(s&&(missing(t.cota_inicial)||missing(t.cota_final)||historicalFields.some(k=>missing(t[k])&&!missing(h[k])))));});
 return <div className="space-y-3"><p>Completa las cotas inicial y final o revisa mediciones históricas aún no incorporadas. Para agregar datos antes de la ejecución, desmarca el filtro de pendientes.</p>
 <div className="flex flex-wrap items-end gap-3"><label>Jornada<select className={field} value={day} onChange={e=>{setDay(e.target.value);setLimit(40);}}><option value="">Todas las jornadas</option>{[...new Set(sessions.map(s=>s.fecha))].sort().reverse().map(d=><option key={d} value={d}>{d.split('-').reverse().join('-')}</option>)}</select></label>
 <label>Número de pila<input className={field} value={search} onChange={e=>{setSearch(e.target.value);setLimit(40);}}/></label><label><input type="checkbox" checked={onlyPending} onChange={e=>{setOnlyPending(e.target.checked);setLimit(40);}}/> Solo pendientes</label></div>
 <p>{rows.length} pilas coinciden con los filtros.</p>{disabled&&<p>Solo el topógrafo designado puede guardar mediciones.</p>}
 {rows.slice(0,limit).map(e=><TopoRow key={e.id+':'+e.revision_topografia} element={e} historical={historical.get(e.id)} disabled={disabled} onSave={datos=>onSave(e,datos)}/>)}{rows.length>limit&&<button className={button} onClick={()=>setLimit(limit+40)}>Ver más pilas</button>}</div>;
}
function TopoRow({element,disabled,onSave,historical={}}){
 const [data,setData]=useState(element.topografia||{});
 return <details className="rounded-xl border p-3"><summary>{element.etapa} · Pila {element.numero}</summary>{historicalFields.some(k=>!missing(historical[k]))&&<div className="my-2 rounded-lg bg-slate-50 p-2"><strong>Referencia del Excel histórico</strong><p>{historicalFields.filter(k=>!missing(historical[k])).map(k=>k.replaceAll('_',' ')+': '+historical[k]).join(' · ')}</p><button className={button} disabled={disabled} onClick={()=>setData(prev=>({...prev,...Object.fromEntries(historicalFields.filter(k=>missing(prev[k])&&!missing(historical[k])).map(k=>[k,String(historical[k]).replace(',','.')]))}))}>Copiar datos faltantes para revisar</button></div>}<div className="grid gap-2 md:grid-cols-3 mt-3">{['cota_inicial','cota_final','norte_real','este_real','cota_real','cota_diseno','deformacion','cst','bst','profundidad_control','referencia','observaciones'].map(k=><label key={k} className="text-xs">{k.replaceAll('_',' ')}<input className={field} disabled={disabled} value={data[k]??''} onChange={e=>setData({...data,[k]:['referencia','observaciones'].includes(k)?e.target.value:e.target.value.replace(',','.')})}/></label>)}</div><button disabled={disabled} className={`${button} mt-2`} onClick={()=>onSave(data)}>Guardar topografía</button></details>;
}
