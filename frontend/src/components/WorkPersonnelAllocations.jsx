import React, {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../supabaseClient';
const money=n=>'$'+Math.round(Number(n)||0).toLocaleString('es-CL');
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Santiago'});
const initialFrom=()=>{const d=new Date();d.setDate(d.getDate()-90);return d.toISOString().slice(0,10);};
const status=r=>Number(r.version_imputacion)>0?'Manual':r.obra_liquidaciones_partidas?.length?'Automática':'Pendiente';

export default function WorkPersonnelAllocations({obra,user,parts,onSaved}) {
 const company=obra.empresa||user.empresa;
 const [from,setFrom]=useState(initialFrom),[through,setThrough]=useState(today),[filter,setFilter]=useState('Todas'),[search,setSearch]=useState('');
 const [rows,setRows]=useState([]),[permissions,setPermissions]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editing,setEditing]=useState(null),[selection,setSelection]=useState({}),[reason,setReason]=useState(''),[saving,setSaving]=useState(false);
 const [workers,setWorkers]=useState([]),[batch,setBatch]=useState([]);
 const request=useRef(0),inFlight=useRef(false);
 const load=useCallback(async()=>{
  const serial=++request.current;setBusy(true);setError('');
  try{
   if(!from||!through||from>through)throw new Error('Revisa el rango de fechas.');
   const rights=await supabase.rpc('permisos_imputaciones_personal_obra',{p_empresa:company,p_obra:obra.id});
   if(rights.error)throw rights.error;
   if(!rights.data?.ver)throw new Error('No tienes acceso a las imputaciones de esta obra.');
   const all=[];
   for(let offset=0;;offset+=1000){
    const result=await supabase.from('rrhh_costos_personal_vigentes').select('*').eq('empresa',company).eq('obra_id',obra.id).gte('fecha',from).lte('fecha',through).order('fecha',{ascending:false}).order('id').range(offset,offset+999);
    if(result.error)throw result.error;all.push(...result.data);if(result.data.length<1000)break;
   }
   if(serial===request.current){setRows(all);setPermissions(rights.data);}
  }catch(e){if(serial===request.current){setRows([]);setPermissions({});setError(e.message);}}
  finally{if(serial===request.current)setBusy(false);}
 },[company,obra.id,from,through]);
 useEffect(()=>{setEditing(null);setWorkers([]);setBatch([]);load();return()=>{request.current++;};},[load]);
 const available=parts.filter(p=>!p.es_titulo && p.id);
 const filtered=rows.filter(r=>(filter==='Todas'||status(r)===filter)&&String(r.trabajador||'').toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 const begin=r=>{setBatch([]);setEditing(r);setReason('');setError('');setNotice('');let assigned=0;const list=r.obra_liquidaciones_partidas||[];setSelection(Object.fromEntries(list.map((p,i)=>{const value=i===list.length-1?100-assigned:Math.round(Number(p.factor ?? Number(p.monto_imputado)/Number(r.monto_real))*10000)/100;assigned+=value;return[p.partida_id,value.toFixed(2)];})));};
 const total=Object.values(selection).reduce((s,v)=>s+(Number(v)||0),0);
 const weight=(values=selection)=>{
  const selected=available.filter(p=>Object.hasOwn(values,p.id));
  const weights=selected.map(p=>Number(p.cantidad ?? p.cantidad_presupuestada)*Number(p.pu ?? p.costo_por_dia));
  if(!selected.length||weights.some(w=>!(w>0))){setError('Selecciona partidas con presupuesto total mayor a cero.');return;}
  const sum=weights.reduce((a,b)=>a+b,0);let assigned=0;
  setSelection(Object.fromEntries(selected.map((p,i)=>{const value=i===selected.length-1?100-assigned:Math.round(weights[i]/sum*10000)/100;assigned+=value;return[p.id,value.toFixed(2)];})));setError('');
 };
 const beginBatch=list=>{
  if(!list.length)return;
  begin(list[0]);setBatch(list);
  const ids=new Set(list.flatMap(r=>(r.obra_liquidaciones_partidas||[]).map(p=>String(p.partida_id))));
  if(ids.size)weight(Object.fromEntries([...ids].map(id=>[id,''])));
  else setSelection({});
 };
 const save=async()=>{
  if(inFlight.current||!editing)return;
  if(Math.abs(total-100)>0.000001||!Object.keys(selection).length||Object.values(selection).some(v=>!(Number(v)>0))){setError('Los porcentajes deben ser positivos y sumar 100%.');return;}
  if(reason.trim().length<5){setError('Indica un motivo de al menos 5 caracteres.');return;}
  inFlight.current=true;setSaving(true);setError('');
  try{
   const targets=batch.length?batch:[editing];let confirmed=0;
   for(const row of targets){
    const result=await supabase.rpc('guardar_imputacion_personal_partidas',{p_empresa:company,p_obra:obra.id,p_cargo:row.id,p_version:Number(row.version_imputacion)||0,p_monto:Number(row.monto_real),p_distribucion:Object.entries(selection).map(([id,porcentaje])=>({partida_id:Number(id),porcentaje:Number(porcentaje)})),p_motivo:reason.trim()});
    if(result.error){if(targets.length>1){setEditing(null);setBatch([]);setWorkers([]);await load();await onSaved?.();throw new Error(`${confirmed} de ${targets.length} guardados. Se detuvo el lote: ${result.error.message}. Actualiza y revisa antes de continuar.`);}throw result.error;}
    confirmed++;
   }
   setEditing(null);setBatch([]);setWorkers([]);await load();await onSaved?.();setNotice('Distribución guardada. Se conserva el costo total y queda registro del cambio.');
  }catch(e){setError(e.message||'No se pudo confirmar el guardado. Actualiza antes de volver a intentarlo.');}
  finally{inFlight.current=false;setSaving(false);}
 };
 return <section className="space-y-4" aria-label="Imputaciones de personal">
  <div className="rounded-2xl border border-emerald-200 bg-white p-4"><h3 className="font-black text-emerald-950">Imputaciones de personal</h3><p className="mt-1 text-xs text-slate-600">Historial de costos por persona y día. Las automáticas siguen los avances y el presupuesto; los días sin reporte requieren aprobación. Editar cambia la distribución entre partidas, no el sueldo ni el costo total.</p></div>
  <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-3 text-xs">
   <label>Desde<input aria-label="Imputaciones desde" type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block rounded-lg border p-2"/></label>
   <label>Hasta<input aria-label="Imputaciones hasta" type="date" value={through} onChange={e=>setThrough(e.target.value)} className="block rounded-lg border p-2"/></label>
   <label>Estado<select aria-label="Estado" value={filter} onChange={e=>setFilter(e.target.value)} className="block rounded-lg border p-2">{['Todas','Automática','Pendiente','Manual'].map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Trabajador<input value={search} onChange={e=>setSearch(e.target.value)} className="block rounded-lg border p-2" placeholder="Buscar por nombre"/></label>
   <button type="button" onClick={load} disabled={busy||saving} className="self-end rounded-lg border px-3 py-2">Actualizar</button>
  </div>
  <p className="text-sm text-slate-600">{filtered.length} cargos · {money(filtered.reduce((s,r)=>s+Number(r.monto_real),0))} · Solo Administrador de Empresa y Administrador de Contratos pueden editar o aprobar.</p>
  {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm">{notice}</p>}
  {editing&&<div className="rounded-2xl border-2 border-indigo-200 bg-white p-4 space-y-3" role="region" aria-label="Editar distribución de personal">
   <h4 className="font-bold">{status(editing)==='Pendiente'?'Aprobar':'Editar'} · {editing.trabajador} · {editing.fecha} · {money(editing.monto_real)}</h4>
   {batch.length>0&&<p className="rounded-lg bg-indigo-50 p-3 text-sm">Distribución para {batch.length} trabajadores del {editing.fecha} · {money(batch.reduce((s,r)=>s+Number(r.monto_real),0))}. Se aplica el porcentaje a cada costo individual. Sin reporte, selecciona las partidas a aprobar; no se asignan partidas supuestas.</p>}
   <fieldset disabled={saving} className="space-y-2"><legend className="text-xs mb-2">Selecciona partidas y distribuye el 100% del costo.</legend>{available.map(p=><div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-2 text-sm"><label className="flex-1"><input type="checkbox" checked={Object.hasOwn(selection,p.id)} onChange={e=>setSelection(old=>{const next={...old};if(e.target.checked)next[p.id]='';else delete next[p.id];return next;})}/> {p.partida}</label>{Object.hasOwn(selection,p.id)&&<label className="text-xs">Porcentaje<input aria-label={`Porcentaje ${p.partida}`} type="number" min="0.01" max="100" step="0.01" value={selection[p.id]} onChange={e=>setSelection(old=>({...old,[p.id]:e.target.value}))} className="ml-2 w-24 rounded border p-2"/>%</label>}</div>)}
   <button type="button" onClick={()=>weight()} className="rounded-lg border px-3 py-2 text-xs">Ponderar según presupuesto</button><button type="button" onClick={()=>weight(Object.fromEntries(available.map(p=>[p.id,''])))} className="ml-2 rounded-lg border px-3 py-2 text-xs">Seleccionar todas las partidas y ponderar</button><strong className="ml-3 text-sm">Total: {total.toFixed(2)}%</strong>
   <label className="block text-xs">Motivo de la aprobación o edición<textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"/></label>
   <div className="flex gap-2"><button type="button" onClick={save} className="rounded-lg bg-indigo-900 px-4 py-2 text-sm font-bold text-white">{saving?'Guardando…':status(editing)==='Pendiente'?'Aprobar distribución':'Guardar cambios'}</button><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button></div></fieldset>
  </div>}
  {busy?<p role="status">Cargando imputaciones…</p>:<div className="space-y-6">{['Pendiente','Automática','Manual'].map(kind=>{
   const section=filtered.filter(r=>status(r)===kind);if(!section.length)return null;
   const days=[...new Set(section.map(r=>r.fecha))].sort().reverse();
   const allowed=kind==='Pendiente'?permissions.aprobar:permissions.editar;
   return <section key={kind} aria-label={kind==='Pendiente'?'Pendientes':kind==='Automática'?'Automáticas':'Editadas y aprobadas'} className="rounded-2xl border bg-slate-50 p-3 space-y-3"><h4 className="font-bold text-indigo-950">{kind==='Pendiente'?'Pendientes de aprobación':kind==='Automática'?'Imputaciones automáticas':'Editadas y aprobadas'} · {section.length} cargos · {money(section.reduce((s,r)=>s+Number(r.monto_real),0))}</h4>{days.map(day=>{
    const daily=section.filter(r=>r.fecha===day),chosen=daily.filter(r=>workers.includes(r.id));
    return <div key={day} className="rounded-xl border bg-white p-3 space-y-2"><h5 className="font-bold">{day} · {daily.length} trabajadores · {money(daily.reduce((s,r)=>s+Number(r.monto_real),0))}</h5>{allowed&&<div className="flex flex-wrap items-center gap-3 text-sm"><label><input type="checkbox" aria-label={`Seleccionar todos ${kind} ${day}`} disabled={saving} checked={chosen.length===daily.length} onChange={e=>{setWorkers(old=>e.target.checked?[...new Set([...old,...daily.map(r=>r.id)])]:old.filter(id=>!daily.some(r=>r.id===id)));if(e.target.checked)beginBatch(daily);else {setEditing(null);setBatch([]);}}}/> Seleccionar todos los trabajadores del día</label><button type="button" disabled={!chosen.length||saving} onClick={()=>beginBatch(chosen)} className="rounded-lg border px-3 py-2 font-bold text-indigo-900">Distribuir seleccionados ({chosen.length})</button></div>}
    {daily.map(r=><div key={r.id} className="flex items-start gap-2">{allowed&&<input className="mt-4" type="checkbox" aria-label={`Seleccionar ${r.trabajador} ${r.fecha}`} disabled={saving} checked={workers.includes(r.id)} onChange={e=>{setEditing(null);setBatch([]);setWorkers(old=>e.target.checked?[...old,r.id]:old.filter(id=>id!==r.id));}}/>}<details className="min-w-0 flex-1 rounded-xl border bg-white p-3"><summary className="cursor-pointer text-sm"><strong>{r.fecha} · {r.trabajador}</strong><span className="ml-3 inline-block">{money(r.monto_real)} · {status(r)}</span></summary><div className="mt-3 space-y-2 text-xs"><p>{r.estado_imputacion_partidas}</p>{(r.obra_liquidaciones_partidas||[]).map(p=><p key={p.partida_id} className="rounded-lg bg-slate-50 p-2">{p.partida} · {money(p.monto_imputado)} · {(Number(p.factor ?? p.monto_imputado/r.monto_real)*100).toFixed(2)}%</p>)}
   {(status(r)==='Pendiente'?permissions.aprobar:permissions.editar)&&<button type="button" onClick={()=>begin(r)} disabled={saving} className="rounded-lg border border-indigo-200 px-3 py-2 font-bold text-indigo-900">{status(r)==='Pendiente'?'Revisar y aprobar':'Editar imputación'}</button>}
   <h5 className="font-bold">Historial</h5><p>Origen: {r.fuente}. {Number(r.version_imputacion)>0?'Distribución manual vigente.':'Cálculo automático vigente según los reportes y presupuesto.'}</p>{(r.historial_imputacion||[]).map((h,i)=><div key={i} className="rounded-lg border p-2"><p>{new Date(h.fecha).toLocaleString('es-CL',{timeZone:'America/Santiago'})} · {h.responsable||'Usuario autorizado'} · {h.accion}</p><p>{h.motivo}</p><p>Anterior: {(h.anterior||[]).map(p=>`${p.partida} (${p.porcentaje ?? (Number(p.factor)||0)*100}%)`).join(' · ')||'Sin distribución'}</p><p>Nueva: {(h.nueva||[]).map(p=>`${p.partida} (${p.porcentaje}%)`).join(' · ')}</p></div>)}</div></details></div>)}</div>;
   })}</section>;
  })}{!filtered.length&&<p className="rounded-xl border bg-white p-4 text-sm">No hay cargos para este rango y filtro.</p>}</div>}
 </section>;
}
