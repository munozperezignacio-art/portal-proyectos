import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import EquipmentQrDocuments from './EquipmentQrDocuments';
import EquipmentQrPortal from './EquipmentQrPortal';
import EquipmentFormHeader from './EquipmentFormHeader';
import PublicFormFiller from './PublicFormFiller';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
async function qrRequest(body) {
 const {data,error}=await supabase.functions.invoke('maquinaria-publica',{body});
 if(error){const payload=await error.context?.json?.().catch(()=>null);throw Error(payload?.error||'No se pudo completar la solicitud.');}
 if(data?.error)throw Error(data.error);return data;
}
export default function MachineryPublicForm({token}) {
 const [equipment,setEquipment]=useState(null),[error,setError]=useState(''),[checklist,setChecklist]=useState('');
 useEffect(()=>{let active=true;setEquipment(null);setError('');qrRequest({action:'cargar',token}).then(data=>{if(active)setEquipment(data.equipo);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[token]);
 if(!equipment)return <main className="p-6"><p role={error?'alert':'status'}>{error||'Cargando equipo…'}</p></main>;
 return <EquipmentQrPortal key={token} equipment={equipment} identify={async rut=>{const data=await qrRequest({action:'identificar',token,rut});return {...data,session:rut};}} openAction={async(action,rut)=>{if(action==='checklist'){setChecklist('');const data=await qrRequest({action:'checklist',token,rut});setChecklist(data.formToken);}}}>
  {(action,identity)=>action==='documentos'?<EquipmentQrDocuments token={token}/>:action==='reporte'?<MachineryDailyReport token={token} identity={identity}/>:action==='mantenimiento'?<QrMaintenance token={token} identity={identity} equipment={equipment}/>:<QrChecklist formToken={checklist} token={token} identity={identity}/>}
 </EquipmentQrPortal>;
}
function QrChecklist({formToken,token,identity}) {
 const qrContext=useMemo(()=>({token,rut:identity.rut}),[token,identity.rut]);
 return <PublicFormFiller formToken={formToken} qrContext={qrContext}/>;
}
function QrMaintenance({token,identity,equipment}) {
 const [form,setForm]=useState({fecha:today(),horometro:String(equipment.horometro_inicial??''),tipo:'Preventiva',descripcion:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState(null);
 const request=useRef(crypto.randomUUID());
 if(receipt)return <p role="status" className="rounded-xl bg-emerald-50 p-4">Mantenimiento #{receipt} guardado en el historial del equipo.</p>;
 return <><EquipmentFormHeader title="Registrar mantenimiento" company={equipment.empresa}/><form className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await qrRequest({...form,action:'mantencion',token,rut:identity.rut,solicitud_id:request.current});setReceipt(result.id);}catch(failure){setError(failure.message);}finally{setBusy(false);}}}>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
  {['fecha','horometro'].map(key=><label key={key} className="block text-sm font-semibold">{key==='fecha'?'Fecha':`Lectura (${equipment.unidad})`}<input required disabled={busy} type={key==='fecha'?'date':'number'} min={key==='horometro'?0:undefined} step={key==='horometro'?'any':undefined} max={key==='fecha'?today():undefined} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>)}
  <label className="block text-sm font-semibold">Tipo<select disabled={busy} value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 p-3"><option>Preventiva</option><option>Correctiva</option></select></label>
  <label className="block text-sm font-semibold">Trabajo realizado<textarea required minLength={3} maxLength={4000} disabled={busy} value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>
  <button disabled={busy} className="w-full rounded-xl bg-indigo-900 p-3 font-bold text-white disabled:opacity-50">{busy?'Guardando…':'Guardar mantenimiento'}</button>
 </form></>;
}
function MachineryDailyReport({ token, identity }) {
  const [equipment,setEquipment]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState(null),[operators,setOperators]=useState([]);
  const request=useRef(crypto.randomUUID());
  const [form,setForm]=useState({fecha:today(),operador:'',operador_id:'',autor_declarado:'',horometro_inicial:'',horometro_final:'',horas_trabajadas:'',hubo_combustible:'',combustible_cargado:'',hubo_falla:'',detuvo_equipo:'',horas_fuera_servicio:'',descripcion:'',severidad:'Media',observaciones:''});
  const set=(key,value)=>setForm(previous=>({...previous,[key]:value}));
  useEffect(()=>{let active=true;(async()=>{try{
    const {data,error:failure}=await supabase.functions.invoke('maquinaria-publica',{body:{action:'cargar',token}});
    if(failure||data?.error)throw new Error(data?.error||'Enlace no disponible o desactivado.');
    if(active){setOperators(data.operadores||[]);setEquipment(data.equipo);set('horometro_inicial',String(data.equipo.horometro_inicial));}
  }catch(e){if(active)setError(e.message);}})();return()=>{active=false;};},[token]);
  const submit=async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{
    const {data,error:failure}=await supabase.functions.invoke('maquinaria-publica',{body:{...form,rut:identity.rut,unidad:equipment.unidad,obra_nombre:equipment.obra_nombre||'',action:'registrar',token,solicitud_id:request.current,hubo_combustible:form.hubo_combustible==='si',hubo_falla:form.hubo_falla==='si',detuvo_equipo:form.detuvo_equipo==='si'}});
    if(failure){const response=await failure.context?.json?.().catch(()=>null);throw new Error(response?.error||'No se confirmó el envío. Puedes reintentar sin duplicarlo.');}
    if(data?.error)throw new Error(data.error);setReceipt(data.id);
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  const input=(key,label,decimal=false)=><label className="block text-sm font-semibold">{label}<input required disabled={busy} inputMode={decimal?'decimal':'text'} value={form[key]} onChange={e=>set(key,e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"/></label>;
  const choice=(key,label)=><label className="block text-sm font-semibold">{label}<select required disabled={busy} value={form[key]} onChange={e=>set(key,e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-3"><option value="">Seleccionar</option><option value="no">No</option><option value="si">Sí</option></select></label>;
  const section='space-y-4 border-b border-slate-200 pb-5 last:border-0';
  return <div className="w-full space-y-5 text-slate-900">
    <EquipmentFormHeader title="Reporte diario de maquinaria" company={equipment?.empresa} code={equipment?.codigo} revision={equipment?.revision}/>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {receipt?<section role="status" className={section}><h2 className="font-bold">Reporte #{receipt} recibido</h2><p>Los datos quedaron guardados. La consulta y descarga están disponibles para usuarios autorizados en Obraxis.</p></section>:equipment?<form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <section className={section}><h2 className="font-bold">1. Jornada y operador</h2><label className="block text-sm font-semibold">Fecha<input required type="date" max={today()} value={form.fecha} onChange={e=>set('fecha',e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label></section>
      <section className={section}><h2 className="font-bold">2. Lecturas ({equipment.unidad})</h2><p className="rounded-xl bg-slate-50 p-3">Inicial: <strong>{form.horometro_inicial} {equipment.unidad}</strong></p>{input('horometro_final',`Lectura final (${equipment.unidad})`,true)}{equipment.unidad==='km'&&input('horas_trabajadas','Horas trabajadas (h)',true)}</section>
      <section className={section}><h2 className="font-bold">3. Combustible</h2>{choice('hubo_combustible','¿Hubo carga de combustible?')}{form.hubo_combustible==='si'&&input('combustible_cargado','Litros cargados (L)',true)}</section>
      <section className={section}><h2 className="font-bold">4. Fallas y paralización</h2>{choice('hubo_falla','¿Hubo alguna falla?')}{form.hubo_falla==='si'&&<>{input('descripcion','Describe la falla')}<label className="block text-sm font-semibold">Severidad<select value={form.severidad} onChange={e=>set('severidad',e.target.value)} className="mt-1 w-full rounded-xl border p-3">{['Baja','Media','Alta','Crítica'].map(v=><option key={v}>{v}</option>)}</select></label>{choice('detuvo_equipo','¿La falla detuvo el equipo?')}{form.detuvo_equipo==='si'&&input('horas_fuera_servicio','Horas de paralización (h)',true)}</>}</section>
      <section className={section}><label className="block text-sm font-semibold">Observaciones (opcional)<textarea rows={4} maxLength={4000} value={form.observaciones} onChange={e=>set('observaciones',e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label></section>
      <button disabled={busy} className="w-full rounded-xl bg-indigo-900 p-4 font-bold text-white disabled:opacity-50">{busy?'Enviando…':'Enviar reporte'}</button><p className="text-center text-xs text-slate-500">Este enlace solo permite enviar reportes de este equipo.</p>
    </form>:!error&&<p role="status">Cargando formulario…</p>}
  </div>;
}
