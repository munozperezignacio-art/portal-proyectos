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
const executionFields=[['equipo','Equipo'],['paladas','Paladas'],['volumen','Volumen m³'],['longitud','Longitud m'],['volumen_cuchara','Cuchara m³'],['longitud_perforacion','Perforación m'],['diametro','Diámetro m'],['profundidad','Profundidad m']];
export function SpecialtySettingsEntry(props){
 const [open,setOpen]=useState(false);
 return <div className="mb-4"><button type="button" aria-expanded={open} className={button} onClick={()=>setOpen(v=>!v)}>Configurar especialidad</button>{open&&<div className="mt-2"><SpecialtyReports {...props} settingsOnly/></div>}</div>;
}
export default function SpecialtyReports({work,user,parts=[],quality=false,settingsOnly=false,onSaved=()=>{},settingsRevision=0,onHistory}){
 const [state,setState]=useState(empty),[partId,setPartId]=useState(''),[draft,setDraft]=useState(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [tab,setTab]=useState(settingsOnly?'settings':quality?'protocols':'journal'),[config,setConfig]=useState({}),[selected,setSelected]=useState(''),[search,setSearch]=useState('');
 const call=useCallback(async(action,data={})=>{const r=await supabase.rpc('specialty_api',{p_work:work.id,p_action:action,p_data:data});if(r.error)throw r.error;return r.data;},[work.id]);
 const refresh=useCallback(async()=>{try{const next=await call('state');setState(next);onHistory?.({workId:work.id,sessions:next.sessions,elements:next.elements});setNotice('');}catch(e){setNotice(e.message);}},[call,onHistory,work.id]);
 useEffect(()=>{refresh();},[refresh,settingsRevision]);
 useEffect(()=>{if(!partId&&parts.length&&state.actor)setPartId(String(parts.find(p=>state.settings.some(s=>s.partida_id===p.id))?.id||parts.find(p=>!p.es_titulo)?.id||''));},[parts,partId,state.settings,state.actor]);
 const cfg=state.settings.find(s=>String(s.partida_id)===partId);
 useEffect(()=>{setConfig(cfg||{activa_desde:today()});},[cfg]);
 const journal=useMemo(()=>createJournalStore({storage,send:call,uuid:()=>crypto.randomUUID(),scope:`${user.empresa}:${user.auth_user_id||user.id}:${work.id}:${partId}`}),[call,user.empresa,user.auth_user_id,user.id,work.id,partId]);
 useEffect(()=>{if(settingsOnly||quality)return;let active=true;journal.read().then(s=>{if(active)setDraft(s.draft||null);});return()=>{active=false;};},[journal,settingsOnly,quality]);
 const sync=useCallback(async()=>{try{const response=await journal.sync();const local=await journal.read();setDraft(local.draft||null);if(response){setNotice(local.draft?'Guardado y sincronizado':'Jornada cerrada. Avance consolidado una sola vez.');if(!local.draft){await refresh();onSaved();}}}catch(e){setDraft((await journal.read()).draft||null);setNotice(`Borrador conservado en este dispositivo. ${e.message}`);}},[journal,refresh,onSaved]);
 useEffect(()=>{if(!draft)return;const timer=setInterval(sync,5000);return()=>clearInterval(timer);},[draft,sync]);
 const action=async fn=>{setBusy(true);try{await fn();await refresh();if(settingsOnly)onSaved();}catch(e){setNotice(e.message);}finally{setBusy(false);}};
 const edit=async next=>{setDraft(next);try{await journal.edit(next);setNotice('Guardado en este dispositivo');}catch(e){setNotice(`No se pudo guardar localmente: ${e.message}`);}};
 const elements=state.elements.filter(e=>String(e.partida_id)===partId);
 const sessions=state.sessions.filter(s=>String(s.partida_id)===partId);
 const activeSession=sessions.find(s=>s.estado==='abierta');
 const start=async()=>{const next=activeSession||{id:crypto.randomUUID(),partida_id:Number(partId),fecha:today(),revision:0,datos:{pilas:[],observaciones:''}};await edit(next);};
 const canExecute=state.can_execute===true,canTopo=cfg?.topografia===state.actor,canQuality=cfg?.calidad===state.actor;
 const rows=draft?.datos?.pilas||[];
 const updatePile=(id,key,value)=>edit({...draft,datos:{...draft.datos,pilas:rows.map(p=>p.element_id===id?{...p,[key]:value}:p)}});
 const diagram=pileDiagram(elements,rows.filter(p=>p.terminada).map(p=>p.element_id));
 if(settingsOnly&&!state.can_configure)return <p role="status">{notice||(!state.actor?'Cargando configuración…':'No tienes permiso para configurar esta especialidad.')}</p>;
 return <section className="rounded-2xl border border-indigo-200 bg-white p-5 space-y-4">
  <div><h3 className="text-lg font-bold text-indigo-950">{settingsOnly?'Configuración por partida':quality?'Protocolos por especialidad':'Reportes por especialidad'}</h3><p className="text-sm text-slate-500">Pilas de grava · Ejecución diaria, topografía y Calidad con responsables independientes.</p></div>
  <label className="block text-sm font-bold">Partida<select className={field} value={partId} onChange={e=>setPartId(e.target.value)}>{parts.filter(p=>!p.es_titulo).map(p=><option key={p.id} value={p.id}>{p.partida} · {p.unidad}</option>)}</select></label>
  {!settingsOnly&&<nav className="flex flex-wrap gap-2">{(quality?[['protocols','Protocolos'],...(state.can_configure?[['reconciliation','Conciliaciones pendientes']]:[])]:[['journal','Jornada'],['topography','Topografía']]).map(([key,label])=><button key={key} className={`${button} ${tab===key?'bg-indigo-100':''}`} onClick={()=>setTab(key)}>{label}</button>)}</nav>}
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
   <h4 className="font-bold">Reportes históricos pendientes de vincular</h4>
   <PendingReports reports={state.reports} sessions={sessions} config={cfg}/>
   <details className="rounded-xl border p-3"><summary className="cursor-pointer font-bold">Conciliaciones realizadas ({sessions.filter(s=>s.estado==='historica').length})</summary>
    {sessions.filter(s=>s.estado==='historica').map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2">
     <span>{s.fecha.split('-').reverse().join('-')} · Reportes: {s.report_ids.join(', ')}</span>
     <button type="button" className={button} disabled={busy||state.protocols.some(p=>p.sesion_id===s.id)} onClick={()=>{if(window.confirm('¿Deshacer la conciliación del '+s.fecha.split('-').reverse().join('-')+'? Las pilas quedarán desvinculadas. Se conservarán los reportes y sus cantidades de avance.'))action(()=>call('undo_reconcile',{id:s.id,partida_id:s.partida_id,revision:s.revision}));}}>{state.protocols.some(p=>p.sesion_id===s.id)?'Protegida por protocolo':'Deshacer conciliación'}</button>
    </div>)}
   </details>
   <SpecialtyWorkbookImport key={partId} work={work} partId={Number(partId)} state={state} call={call} onSaved={refresh}/>
  </section>}
  {cfg&&tab==='journal'&&<div className="space-y-4">
   {!canExecute?<p>Tu rol no tiene permiso para registrar avances en esta obra.</p>:!draft?<button className={button} onClick={start}>{activeSession?'Continuar jornada abierta':'Iniciar jornada de trabajo'}</button>:<>
    <div className="flex flex-wrap gap-3 items-center"><strong>Jornada {draft.fecha.split('-').reverse().join('-')}</strong><span>{rows.filter(p=>p.terminada).length} pilas terminadas</span><button className={button} onClick={sync}>Sincronizar ahora</button></div>
    <p className="text-xs">Autoguardado en este dispositivo. No borres los datos del navegador antes de sincronizar. Un conflicto conserva tu borrador para revisión.</p>
    <div className="flex gap-2"><select disabled={draft.closeRequested} className={field} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Seleccionar pila</option>{elements.filter(e=>!e.sesion_id&&!rows.some(r=>r.element_id===e.id)).map(e=><option key={e.id} value={e.id}>{e.etapa} · Pila {e.numero}</option>)}</select><button className={button} disabled={!selected||draft.closeRequested} onClick={()=>{edit({...draft,datos:{...draft.datos,pilas:[...rows,{element_id:selected,paladas:'',volumen:'',longitud:'',equipo:'',terminada:false}]}});setSelected('');}}>Agregar</button></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Pila',...executionFields.map(f=>f[1]),'Terminada'].map(x=><th className="p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.element_id}><td className="p-2">{elements.find(e=>e.id===r.element_id)?.numero}</td>{executionFields.map(([k])=><td className="p-1" key={k}><input aria-label={`${k} pila ${elements.find(e=>e.id===r.element_id)?.numero}`} disabled={draft.closeRequested} className={`${field} min-w-24`} type={k==='equipo'?'text':'number'} min="0" step="any" value={r[k]??''} onChange={e=>updatePile(r.element_id,k,e.target.value)}/></td>)}<td className="p-2"><input aria-label="Pila terminada" type="checkbox" disabled={draft.closeRequested} checked={!!r.terminada} onChange={e=>updatePile(r.element_id,'terminada',e.target.checked)}/></td></tr>)}</tbody></table></div>
    <label className="block">Comentarios generales del reporte<textarea className={field} disabled={draft.closeRequested} value={draft.datos.observaciones||''} onChange={e=>edit({...draft,datos:{...draft.datos,observaciones:e.target.value}})}/></label>
    <button className={`${button} bg-indigo-900 text-white`} disabled={draft.closeRequested} onClick={async()=>{if(!window.confirm('¿Cerrar la jornada? Solo las pilas terminadas se sumarán al avance. Calidad continuará por separado.'))return;await journal.close();setDraft((await journal.read()).draft);await sync();await sync();}}>{draft.closeRequested?'Cierre pendiente de sincronización':'Cerrar jornada y consolidar avance'}</button>
   </>}
  </div>}
  {cfg&&tab==='topography'&&<div className="space-y-3"><input className={field} placeholder="Buscar número de pila" value={search} onChange={e=>setSearch(e.target.value)}/>{elements.filter(e=>!search||e.numero.includes(search)).slice(0,50).map(e=><TopoRow key={`${e.id}:${e.revision_topografia}`} element={e} disabled={!canTopo} onSave={datos=>action(()=>call('topography',{partida_id:Number(partId),element_id:e.id,revision:e.revision_topografia,datos,request_id:crypto.randomUUID()}))}/>)}<p className="text-xs">Se muestran hasta 50 pilas. Busca su número para completar cotas, CST/BST y controles.</p></div>}
  {cfg&&tab==='history'&&<><svg viewBox="0 0 600 400" className="max-h-96 w-full border rounded-xl" aria-label="Esquema de pilas por coordenadas">{diagram.map(e=><g key={e.id}><circle cx={e.x} cy={e.y} r="3" fill={e.status==='day'?'#10b981':e.status==='done'?'#243a80':'#d1d5db'}/><title>{e.etapa} · {e.numero}</title></g>)}</svg><p className="text-xs">Verde: jornada actual · Azul: ejecutada · Gris: pendiente.</p>{sessions.map(s=><details key={s.id} className="rounded-lg border p-3"><summary>{s.fecha.split('-').reverse().join('-')} · {s.estado} · {s.datos.pilas.filter(p=>p.terminada).length} pilas</summary><p className="text-sm mt-2">{s.datos.pilas.map(p=>elements.find(e=>e.id===p.element_id)?.numero).join(', ')}</p><p>{s.datos.observaciones}</p></details>)}</>}
  {cfg&&tab==='protocols'&&<SpecialtyProtocols key={cfg.partida_id} work={work} user={user} state={state} cfg={cfg} sessions={sessions} elements={elements} call={call} refresh={refresh} renderTopo={e=><TopoRow key={e.id+':'+e.revision_topografia} element={e} disabled={!canTopo||busy} onSave={datos=>action(()=>call('topography',{partida_id:Number(partId),element_id:e.id,revision:e.revision_topografia,datos,request_id:crypto.randomUUID()}))}/>}/>}
 </section>;
}

function PendingReports({reports=[],sessions,config}){
 const linked=new Set(sessions.flatMap(session=>(session.report_ids||[]).map(String)));
 const pending=reports.filter(r=>String(r.partida_id)===String(config.partida_id)&&r.fecha&&r.fecha<config.activa_desde&&!linked.has(String(r.id))).sort((a,b)=>b.fecha.localeCompare(a.fecha));
 if(!pending.length)return <p className="text-sm">No hay reportes históricos pendientes de vincular en esta partida.</p>;
 return <ul className="divide-y text-sm">{pending.map(r=><li key={r.id} className="py-2">{r.fecha.split('-').reverse().join('-')} · Reporte #{r.id} · Cantidad: {r.cantidad}</li>)}</ul>;
}
function TopoRow({element,disabled,onSave}){
 const [data,setData]=useState(element.topografia||{});
 return <details className="rounded-xl border p-3"><summary>{element.etapa} · Pila {element.numero}</summary><div className="grid gap-2 md:grid-cols-3 mt-3">{['cota_inicial','cota_final','norte_real','este_real','cota_real','cota_diseno','deformacion','cst','bst','profundidad_control','referencia','observaciones'].map(k=><label key={k} className="text-xs">{k.replaceAll('_',' ')}<input className={field} disabled={disabled} value={data[k]??''} onChange={e=>setData({...data,[k]:['referencia','observaciones'].includes(k)?e.target.value:e.target.value.replace(',','.')})}/></label>)}</div><button disabled={disabled} className={`${button} mt-2`} onClick={()=>onSave(data)}>Guardar topografía</button></details>;
}
