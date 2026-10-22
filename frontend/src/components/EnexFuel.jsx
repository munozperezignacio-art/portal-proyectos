import React,{useEffect,useState,useRef} from 'react';
import {supabase} from '../supabaseClient';
import useUserPermissions from '../utils/useUserPermissions';
import {parseEnexCsv,planImport,summarize,summaryText,createOperationGate} from '../utils/enex.js';
import {readEnex,importEnex,sendEnexSummary} from '../services/enexService';

export default function EnexFuel({user}) {
 const operation=useRef(createOperationGate()),mailAttempted=useRef(false);
 const [mailConfirm,setMailConfirm]=useState(false),[mailStatus,setMailStatus]=useState('');
 const {permissions,loading:permissionsLoading}=useUserPermissions(user);
 const allowed=action=>permissions[`maquinaria.enex.${action}`]===true;
 const [rows,setRows]=useState([]),[works,setWorks]=useState([]),[centers,setCenters]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [preview,setPreview]=useState(null),[confirmed,setConfirmed]=useState(false),[updated,setUpdated]=useState('');
 const [portal,setPortal]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[work,setWork]=useState(''),[center,setCenter]=useState(''),[pending,setPending]=useState(false);
 const [editing,setEditing]=useState(null),[assignWork,setAssignWork]=useState(''),[assignCenter,setAssignCenter]=useState(''),[note,setNote]=useState('');
 useEffect(()=>{setMailConfirm(false);},[portal,from,to,work,center,pending,rows]);
 useEffect(()=>{let active=true;
  if(permissionsLoading||!allowed('ver'))return ()=>{active=false;};
  setBusy(true);
  Promise.all([readEnex(supabase,user.empresa),supabase.from('obras').select('id,nombre,centro_gestion_id').eq('empresa',user.empresa),supabase.from('facturacion_centros_gestion').select('id,codigo,nombre,activo').eq('empresa',user.empresa).eq('activo',true)])
   .then(([data,w,c])=>{if(w.error||c.error)throw Error('No se pudieron cargar obras y centros');if(active){setRows(data);setWorks(w.data||[]);setCenters(c.data||[]);setUpdated(new Date().toISOString());}})
   .catch(()=>{if(active)setError('Enex no disponible. Se requiere desplegar y validar el esquema y sus permisos.');}).finally(()=>{if(active)setBusy(false);});
  return ()=>{active=false;};
 },[user.empresa,permissionsLoading,permissions]);
 if(permissionsLoading)return <p>Cargando permisos…</p>;
 if(!allowed('ver'))return <p>Sin permiso para consultar combustible.</p>;
 const filtered=rows.filter(r=>(!portal||r.portal===portal)&&(!from||r.occurred_local.slice(0,10)>=from)&&(!to||r.occurred_local.slice(0,10)<=to)&&(!pending||!r.assignment)&&(!work||String(r.assignment?.obra_id)===work)&&(!center||String(r.assignment?.centro_gestion_id)===center));
 const total=summarize(filtered);
 async function chooseFile(event) {
  setError('');setPreview(null);setConfirmed(false);
  const file=event.target.files?.[0];if(!file)return;
  try {if(file.size>1000000)throw Error('Máximo 1 MB');const incoming=parseEnexCsv(await file.text());const plan=planImport(user.empresa,incoming,rows);setPreview({incoming,...plan});}catch(e){setError(e.message);}
  event.target.value='';
 }
 async function commitImport() {
  if(!confirmed||!preview||busy||!operation.current.enter())return;setBusy(true);setError('');
  try {const result=await importEnex(supabase,user.empresa,preview.incoming);setRows(result.stored);setUpdated(new Date().toISOString());setNotice(`Persistencia verificada: ${result.result.inserted} nuevas, ${result.result.repeated} repetidas.`);setPreview(null);setConfirmed(false);}
  catch(e){setError(e.message);setPreview(null);setConfirmed(false);}finally{operation.current.leave();setBusy(false);}
 }
 async function saveAssignment() {
  if(!editing||busy||(!assignWork&&!assignCenter)||!operation.current.enter())return;setBusy(true);setError('');
  try {const {error:e}=await supabase.from('enex_assignments').upsert({movement_id:editing,empresa:user.empresa,obra_id:assignWork?Number(assignWork):null,centro_gestion_id:assignCenter?Number(assignCenter):null,note},{onConflict:'movement_id'});if(e)throw Error('Asignación no confirmada; revise empresa y centro de la obra');const data=await readEnex(supabase,user.empresa);setRows(data);setEditing(null);setUpdated(new Date().toISOString());}catch(e){setError(e.message);}finally{operation.current.leave();setBusy(false);}
 }
 async function sendSummary() {
  if(!mailConfirm||mailAttempted.current||busy||!operation.current.enter())return;
  mailAttempted.current=true;setBusy(true);setMailStatus('Envío solicitado; no repetir mientras se comprueba.');
  try {const id=await sendEnexSummary(supabase,user.empresa,user.correo,filtered);setMailStatus(`Proveedor aceptó el correo. ID: ${id}. No confirma entrega en bandeja.`);}
  catch(e){setMailStatus(e.message);}finally{operation.current.leave();setBusy(false);}
 }
 return <section className="space-y-4 bg-white rounded-xl p-4 border">
  <h2 className="font-bold text-xl">Combustible Enex — {user.empresa}</h2>
  <p>Movimientos originales; no generan costos contables ni alteran registros de uso. Asigne cada carga explícitamente.</p>
  {error&&<p role="alert" className="text-red-700">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <fieldset disabled={busy} className="flex flex-wrap gap-3">
   <label>Portal <select value={portal} onChange={e=>setPortal(e.target.value)}><option value="">Ambos</option><option value="transporte">Transporte</option><option value="empresa">Empresa</option></select></label>
   <label>Desde <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   <label>Obra <select value={work} onChange={e=>setWork(e.target.value)}><option value="">Todas</option>{works.map(w=><option key={w.id} value={w.id}>{w.nombre}</option>)}</select></label>
   <label>Centro <select value={center} onChange={e=>setCenter(e.target.value)}><option value="">Todos</option>{centers.map(c=><option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}</select></label>
   <label><input type="checkbox" checked={pending} onChange={e=>setPending(e.target.checked)}/> Solo pendientes</label>
  </fieldset>
  <p>{total.count} cargas · {(total.liters_milli/1000).toLocaleString('es-CL',{minimumFractionDigits:3})} litros · Débito firmado: ${total.amount_signed.toLocaleString('es-CL')} · {total.pending} pendientes</p>
  <p>Moneda ISO e impuestos sin confirmar. Alertas no evaluadas: sin reglas configuradas.</p>
  {allowed('importar')&&<fieldset disabled={busy}><legend>Importar lectura verificada</legend><input aria-label="CSV Enex" type="file" accept=".csv,text/csv" onChange={chooseFile}/>
   {preview&&<div><p>{preview.incoming.length} filas: {preview.added.length} nuevas y {preview.repeated} repetidas.</p><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirmo que el archivo corresponde a {user.empresa} y a las lecturas revisadas de los portales.</label><button disabled={!confirmed} onClick={commitImport} className="border rounded p-2">Importar y verificar persistencia</button></div>}
  </fieldset>}
  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Portal','Fecha local','Vehículo visible','GD/Boleta','Litros','Débito firmado','Asignación'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.portal}</td><td>{r.occurred_local}</td><td>{r.vehicle}</td><td>{r.document}</td><td>{(r.liters_milli/1000).toFixed(3)}</td><td>{r.amount_signed}</td><td>{r.assignment?(works.find(w=>w.id===r.assignment.obra_id)?.nombre||centers.find(c=>c.id===r.assignment.centro_gestion_id)?.nombre||'Asignada'):'Pendiente'} {allowed('editar')&&<button disabled={busy} className="border p-1" onClick={()=>{setEditing(r.id);setAssignWork(String(r.assignment?.obra_id||''));setAssignCenter(String(r.assignment?.centro_gestion_id||''));setNote(r.assignment?.note||'');}}>Asignar</button>}</td></tr>)}</tbody></table></div>
  {editing&&<fieldset disabled={busy}><legend>Asignación explícita</legend><label>Obra <select value={assignWork} onChange={e=>{setAssignWork(e.target.value);setAssignCenter('');}}><option value="">Sin obra</option>{works.map(w=><option key={w.id} value={w.id}>{w.nombre}</option>)}</select></label><label>Centro <select value={assignCenter} onChange={e=>setAssignCenter(e.target.value)}><option value="">Sin centro</option>{centers.filter(c=>!assignWork||works.find(w=>String(w.id)===assignWork)?.centro_gestion_id===c.id).map(c=><option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}</select></label><label>Nota <input maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label><button onClick={saveAssignment}>Guardar asignación</button><button onClick={()=>setEditing(null)}>Cancelar</button></fieldset>}
  {updated&&<details><summary>Borrador de resumen de la selección</summary><pre className="whitespace-pre-wrap">{summaryText(user.empresa,filtered,updated)}</pre><p>El envío consulta de nuevo los registros persistidos en el servidor. Aceptación del proveedor no equivale a entrega.</p>
  {permissions['maquinaria.enex.enviar']===true && user.correo && filtered.length>0 && <div><label><input type="checkbox" checked={mailConfirm} disabled={busy||mailAttempted.current} onChange={e=>setMailConfirm(e.target.checked)}/> Confirmo enviar este resumen a mi correo: {user.correo}</label><button className="border rounded p-2" disabled={!mailConfirm||busy||mailAttempted.current} onClick={sendSummary}>Enviar resumen una vez</button></div>}
  {mailStatus&&<p role="status">{mailStatus}</p>}</details>}
 </section>;
}
