import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import {allocationApprovalDecisions} from '../utils/allocationApproval';
const control='mt-1 block w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30';

export default function WorkerExitReview({worker,company,centers,canApprove,canRead,onClose,onDone}){
 const [rows,setRows]=useState(null),[edits,setEdits]=useState({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date());
 async function load(){setRows(null);setConfirm(false);setEdits({});const {data,error}=await supabase.from('rrhh_imputaciones_diarias').select('*',{count:'exact'}).eq('empresa',company).eq('trabajador_id',worker.id).eq('estado','Pendiente').order('fecha').limit(100);
 if(error)throw error;setRows(data||[]);}
 useEffect(()=>{if(canRead)load().catch(()=>setMessage('No se pudieron consultar los pendientes.'));},[worker.id,company,canRead]);
 function edit(id,key,value){setEdits(all=>({...all,[id]:{...all[id],[key]:value}}))}
 async function approve(row){if(busy||!canApprove)return;setBusy(true);setMessage('');try{
 if(edits[row.id]?.mode==='sin'){
 const reason=(edits[row.id]?.comment||'').trim();
 if(reason.length<3)throw new Error('Escribe un motivo de al menos tres caracteres.');
 const {error}=await supabase.rpc('resolver_dia_sin_cargo',{p_empresa:company,p_id:row.id,p_motivo:reason});if(error)throw error;
 await load();setMessage('Día resuelto sin generar cargo.');return;}
 const decisions=allocationApprovalDecisions(rows,edits,[row.id],{today});
 const {error}=await supabase.rpc('aprobar_imputaciones_personal',{p_empresa:company,p_decisiones:decisions});if(error)throw error;
 await load();setMessage('Imputación aprobada. El costo queda registrado.');}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 async function finish(){if(!confirm||busy||!canRead||rows?.length!==0)return;setBusy(true);try{
 const {error}=await supabase.from('maestro_personal').update({estado:'Inactivo'}).eq('empresa',company).eq('id',worker.id).select('id').single();if(error)throw error;onDone();
 }catch(e){setMessage(e.message);await load().catch(()=>setRows(null));}finally{setBusy(false)}}
 return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-label="Revisar pendientes y dar de baja" onKeyDown={e=>{if(e.key==='Escape'&&!busy)onClose()}} className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white">
 <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3"><h2 className="text-lg font-bold">Revisar pendientes · {worker.nombre}</h2><button autoFocus type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold">Cerrar ×</button></header>
 <div className="min-h-0 overflow-y-auto p-5 space-y-4">
 <p>Revisa cada día y su centro antes de aprobar el cargo. La baja retira al trabajador de la lista activa y conserva su ficha y sus costos.</p>
 {!canRead?<p>No tienes permiso para revisar las imputaciones.</p>:rows===null?<p>No hay una lectura confirmada de pendientes.</p>:rows.length?<><p>Pendientes por resolver (hasta 100 por página): {rows.length}</p>{rows.map(r=><fieldset key={r.id} disabled={busy||!canApprove} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"><legend>{r.fecha} · {r.origen}</legend><p>Costo calculado: {r.costo_total==null?'Sin calcular':'$'+Number(r.costo_total).toLocaleString('es-CL')}</p><label className="block text-sm font-semibold">Decisión del día<select className={control} value={edits[r.id]?.mode||"cargo"} onChange={e=>edit(r.id,"mode",e.target.value)}><option value="cargo">Generar cargo</option><option value="sin">No generar cargo</option></select></label>{edits[r.id]?.mode!=="sin" && <label className="block text-sm font-semibold">Centro de gestión <select className={control} value={edits[r.id]?.center??r.centro_propuesto_id??''} onChange={e=>edit(r.id,'center',e.target.value)}><option value="">Seleccionar centro</option>{centers.filter(c=>c.activo!==false).map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}</select></label>}<label className="block text-sm font-semibold">Motivo <input className={control} placeholder="Escribe el motivo de la decisión" value={edits[r.id]?.comment||''} onChange={e=>edit(r.id,'comment',e.target.value)}/></label><button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={()=>approve(r)}>{edits[r.id]?.mode==="sin"?"Confirmar sin cargo":"Aprobar cargo del día"}</button></fieldset>)}{!canApprove&&<p>Tu perfil puede revisar, pero no aprobar estos cargos.</p>}</>:<label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> Sin pendientes. Confirmo la baja de {worker.nombre}.</label>}
 </div><footer className="shrink-0 border-t border-slate-200 px-5 py-3">{message&&<p role="status">{message}</p>}<div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Cancelar</button><button type="button" disabled={busy||!confirm} onClick={finish} className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-40">Confirmar baja</button></div></footer></section></div>
}
