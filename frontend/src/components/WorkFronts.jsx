import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';

export async function workFronts(workId,action,data={}){
 const result=await supabase.rpc('work_fronts_api',{p_work:workId,p_action:action,p_data:data});
 if(result.error)throw result.error;
 return result.data;
}
export function WorkFrontInput({workId,...props}){
 const [fronts,setFronts]=useState([]),[error,setError]=useState(''),[manual,setManual]=useState(false);
 useEffect(()=>{let active=true;setFronts([]);setError('');if(workId)workFronts(workId,'list').then(r=>{if(active)setFronts(r.fronts||[]);}).catch(()=>{if(active)setError('No se pudo cargar la lista de frentes. Puedes escribir el nombre.');});return()=>{active=false;};},[workId]);
 const options=[...new Set(['Frente Principal',...fronts,props.value].filter(Boolean))];
 return <><select aria-label={props['aria-label']||'Frente de Trabajo'} className={props.className} disabled={props.disabled} value={manual?'__write':props.value||''} onChange={e=>{if(e.target.value==='__write')setManual(true);else{setManual(false);props.onChange?.(e);}}}><option value="">Selecciona un frente</option>{options.map(f=><option key={f} value={f}>{f}</option>)}<option value="__write">Escribir otro frente…</option></select>{manual&&<input {...props} aria-label="Nombre de otro frente"/>}{error&&<small role="status">{error}</small>}</>;
}
export function CorrectReportFronts({workId,partId,fronts,onSaved}){
 const [open,setOpen]=useState(false),[rows,setRows]=useState([]),[selected,setSelected]=useState([]),[target,setTarget]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState(false);
 const load=async()=>{setBusy(true);setMessage('');setSelected([]);setConfirmed(false);try{setRows(await workFronts(workId,'reports',{partida_id:partId}));setOpen(true);}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const save=async()=>{setBusy(true);try{
  const r=await workFronts(workId,'correct_reports',{partida_id:partId,frente:target,reports:rows.filter(r=>selected.includes(r.id)).map(r=>({id:r.id,frente:r.frente}))});
  setMessage(`${r.updated} reportes corregidos. Se conservaron fechas, cantidades, cuadrillas y costos.`);setOpen(false);setSelected([]);setConfirmed(false);await onSaved?.();
 }catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
  <h4 className="font-bold text-indigo-950">Frente de reportes anteriores</h4>
  <p className="text-sm">Frente Principal es el valor por defecto. No se reemplaza automáticamente. Selecciona solo los reportes que correspondan al frente correcto.</p>
  <button type="button" disabled={busy} onClick={load}>Corregir frente de reportes anteriores</button>
  {open&&<>
   <label className="block">Nuevo frente<select aria-label="Nuevo frente de reportes" value={target} disabled={busy} onChange={e=>{setTarget(e.target.value);setConfirmed(false);}}><option value="">Selecciona un frente</option>{fronts.map(f=><option key={f}>{f}</option>)}</select></label>
   {!rows.length&&<p>No hay reportes anteriores de esta partida.</p>}
   <div className="overflow-auto max-h-80"><table className="w-full"><thead><tr><th>Seleccionar</th><th>Fecha</th><th>Frente actual</th><th>Cantidad</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><input aria-label={`Corregir reporte ${r.id}`} type="checkbox" disabled={busy||r.blocked} checked={selected.includes(r.id)} onChange={e=>{setSelected(prev=>e.target.checked?[...prev,r.id]:prev.filter(id=>id!==r.id));setConfirmed(false);}}/>{r.blocked&&<small>Vinculado a pilas: revisar conciliación</small>}</td><td>{r.fecha}</td><td>{r.frente||'Frente Principal'}</td><td>{r.cantidad} {r.unidad}</td></tr>)}</tbody></table></div>
   <label className="block"><input type="checkbox" checked={confirmed} disabled={busy||!target||!selected.length} onChange={e=>setConfirmed(e.target.checked)}/> Confirmo cambiar únicamente el frente de {selected.length} reportes a {target||'…'}.</label>
   <button type="button" disabled={busy||!confirmed||!target||!selected.length} onClick={save}>Guardar corrección de frentes</button>
   <button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</button>
  </>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
