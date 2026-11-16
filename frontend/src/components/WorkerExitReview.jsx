import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import {allocationApprovalDecisions} from '../utils/allocationApproval';

export default function WorkerExitReview({worker,company,centers,canApprove,canRead,onClose,onDone}){
 const [rows,setRows]=useState(null),[edits,setEdits]=useState({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date());
 async function load(){setRows(null);setConfirm(false);setEdits({});const {data,error}=await supabase.from('rrhh_imputaciones_diarias').select('*',{count:'exact'}).eq('empresa',company).eq('trabajador_id',worker.id).eq('estado','Pendiente').order('fecha').limit(100);
 if(error)throw error;setRows(data||[]);}
 useEffect(()=>{if(canRead)load().catch(()=>setMessage('No se pudieron consultar los pendientes.'));},[worker.id,company,canRead]);
 function edit(id,key,value){setEdits(all=>({...all,[id]:{...all[id],[key]:value}}))}
 async function approve(row){if(busy||!canApprove)return;setBusy(true);setMessage('');try{
 const decisions=allocationApprovalDecisions(rows,edits,[row.id],{today});
 const {error}=await supabase.rpc('aprobar_imputaciones_personal',{p_empresa:company,p_decisiones:decisions});if(error)throw error;
 await load();setMessage('Imputación aprobada. El costo queda registrado.');}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 async function finish(){if(!confirm||busy||!canRead||rows?.length!==0)return;setBusy(true);try{
 const {error}=await supabase.from('maestro_personal').update({estado:'Inactivo'}).eq('empresa',company).eq('id',worker.id).select('id').single();if(error)throw error;onDone();
 }catch(e){setMessage(e.message);await load().catch(()=>setRows(null));}finally{setBusy(false)}}
 return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-label="Revisar pendientes y dar de baja" className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 space-y-4"><h2 className="text-lg font-bold">Revisar pendientes · {worker.nombre}</h2>
 <p>Revisa cada día y su centro antes de aprobar el cargo. La baja retira al trabajador de la lista activa y conserva su ficha y sus costos.</p>
 {!canRead?<p>No tienes permiso para revisar las imputaciones.</p>:rows===null?<p>No hay una lectura confirmada de pendientes.</p>:rows.length?<><p>Pendientes por resolver (hasta 100 por página): {rows.length}</p>{rows.map(r=><fieldset key={r.id} disabled={busy||!canApprove} className="rounded-xl border p-3 space-y-2"><legend>{r.fecha} · {r.origen}</legend><p>Costo calculado: {r.costo_total==null?'Sin calcular':'$'+Number(r.costo_total).toLocaleString('es-CL')}</p><label>Centro de gestión <select value={edits[r.id]?.center??r.centro_propuesto_id??''} onChange={e=>edit(r.id,'center',e.target.value)}><option value="">Seleccionar centro</option>{centers.filter(c=>c.activo!==false).map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}</select></label><label> Motivo <input value={edits[r.id]?.comment||''} onChange={e=>edit(r.id,'comment',e.target.value)}/></label><button type="button" className="rounded-lg border px-3 py-2" onClick={()=>approve(r)}>Aprobar cargo del día</button></fieldset>)}{!canApprove&&<p>Tu perfil puede revisar, pero no aprobar estos cargos.</p>}</>:<label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> Sin pendientes. Confirmo la baja de {worker.nombre}.</label>}
 {message&&<p role="status">{message}</p>}<div className="flex gap-3"><button type="button" disabled={busy} onClick={onClose}>Cerrar</button><button type="button" disabled={busy||!confirm} onClick={finish} className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-40">Confirmar baja</button></div></section></div>
}
