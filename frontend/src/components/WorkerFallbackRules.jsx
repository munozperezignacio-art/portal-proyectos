import React,{useCallback,useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';

const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date());
const blank=()=>({trabajador_id:'',centro_gestion_id:'',fecha_desde:today(),fecha_hasta:'',dias_semana:[1,2,3,4,5],hora_cierre:'20:00',activa:true});

export default function WorkerFallbackRules({user,personal,centrosGestion,canApprove,onChanged}){
  const [rules,setRules]=useState([]),[form,setForm]=useState(blank),[busy,setBusy]=useState(true),[message,setMessage]=useState('');
  const [loaded,setLoaded]=useState(false);
  const load=useCallback(async()=>{
    setBusy(true);setLoaded(false);
    try{
      const all=[];
      for(let offset=0;;offset+=1000){
        const result=await supabase.from('rrhh_reglas_sin_asistencia').select('*').eq('empresa',user.empresa).order('id').range(offset,offset+999);
        if(result.error)throw result.error;all.push(...result.data);if(result.data.length<1000)break;
      }
      setRules(all);setLoaded(true);
    }catch(error){setMessage(error.message||'No fue posible cargar las reglas.');}
    finally{setBusy(false);}
  },[user.empresa]);
  useEffect(()=>{setForm(blank());setMessage('');load();},[load]);
  const selectWorker=id=>{
    const existing=rules.find(rule=>String(rule.trabajador_id)===id);
    setForm(existing?{...existing,fecha_hasta:existing.fecha_hasta||'',hora_cierre:existing.hora_cierre.slice(0,5)}:{...blank(),trabajador_id:id});setMessage('');
  };
  const save=async event=>{
    event.preventDefault();if(busy||!canApprove||!loaded)return;
    if(!form.dias_semana.length){setMessage('Selecciona al menos un día.');return;}
    if(form.fecha_hasta&&form.fecha_hasta<form.fecha_desde){setMessage('La fecha de término no puede ser anterior al inicio.');return;}
    setBusy(true);setMessage('');
    try{
      const result=await supabase.rpc('guardar_regla_sin_asistencia',{
        p_empresa:user.empresa,p_trabajador:Number(form.trabajador_id),p_centro:Number(form.centro_gestion_id),p_desde:form.fecha_desde,
        p_hasta:form.fecha_hasta||null,p_dias:form.dias_semana,p_hora:form.hora_cierre,p_activa:form.activa
      });
      if(result.error)throw result.error;
      await load();onChanged?.();setMessage('Regla guardada. Se aplicará a los días de su vigencia al cierre indicado, solo si no existe ningún marcaje.');
    }catch(error){setMessage(error.message||'No fue posible guardar la regla.');}
    finally{setBusy(false);}
  };
  const workerName=id=>personal.find(worker=>String(worker.id)===String(id))?.nombre||`Trabajador ${id}`;
  const centerName=id=>{const center=centrosGestion.find(item=>String(item.id)===String(id));return center?`${center.codigo} · ${center.nombre}`:'Centro no disponible';};
  const cls='mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm';
  return <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5">
    <h4 className="font-black">Reglas de cargo sin asistencia</h4>
    <p className="text-sm text-slate-600">Por trabajador: si no tiene ningún marcaje en ningún centro durante el día, cargar su costo al centro definido. Una asistencia informada como ausencia o permiso no activa esta regla.</p>
    <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-950">La asistencia tiene prioridad. El cierre usa la hora de Chile y se revisa automáticamente cada 15 minutos, sin abrir esta pantalla. Incluye solo días vigentes del contrato; no crea ausencias, no cambia sueldos y no duplica la nómina conciliada. El centro predeterminado de la ficha sigue siendo una propuesta si no autorizas una regla aquí.</p>
    <p className="text-xs text-slate-500">Desactivar o editar una regla no elimina sus cargos de días anteriores. Una asistencia tardía reemplaza el respaldo en la misma imputación. Los meses conciliados requieren revisión y nueva conciliación explícita.</p>
    {message&&<p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">{message}</p>}
    <form onSubmit={save}><fieldset disabled={busy||!canApprove||!loaded} className="space-y-4 disabled:opacity-60">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">Trabajador<select required aria-label="Trabajador de la regla" value={form.trabajador_id} onChange={e=>selectWorker(e.target.value)} className={cls}><option value="">Selecciona trabajador</option>{personal.map(worker=><option key={worker.id} value={worker.id}>{worker.nombre}</option>)}</select></label>
        <label className="text-xs font-bold">Cargar al centro de gestión<select required aria-label="Centro de respaldo" value={form.centro_gestion_id} onChange={e=>setForm({...form,centro_gestion_id:e.target.value})} className={cls}><option value="">Selecciona centro</option>{centrosGestion.filter(center=>center.activo!==false).map(center=><option key={center.id} value={center.id}>{center.codigo} · {center.nombre}</option>)}</select></label>
        <label className="text-xs font-bold">Vigente desde<input required type="date" aria-label="Regla vigente desde" value={form.fecha_desde} onChange={e=>setForm({...form,fecha_desde:e.target.value})} className={cls}/></label>
        <label className="text-xs font-bold">Hasta (opcional)<input type="date" aria-label="Regla vigente hasta" min={form.fecha_desde} value={form.fecha_hasta} onChange={e=>setForm({...form,fecha_hasta:e.target.value})} className={cls}/></label>
        <label className="text-xs font-bold">Hora de cierre del día<input required type="time" aria-label="Hora de cierre de la regla" value={form.hora_cierre} onChange={e=>setForm({...form,hora_cierre:e.target.value})} className={cls}/></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activa} onChange={e=>setForm({...form,activa:e.target.checked})}/>Regla activa</label>
      </div>
      <fieldset><legend className="mb-2 text-xs font-bold">Días aplicables</legend><div className="flex flex-wrap gap-3">{days.map((day,index)=><label key={day} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={form.dias_semana.includes(index+1)} onChange={e=>setForm({...form,dias_semana:e.target.checked?[...form.dias_semana,index+1].sort():form.dias_semana.filter(value=>value!==index+1)})}/>{day}</label>)}</div></fieldset>
      <button type="submit" className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white">{busy?'Guardando…':'Guardar regla del trabajador'}</button>
    </fieldset></form>
    {!canApprove&&<p className="text-xs text-amber-900">Puedes consultar las reglas. Para autorizarlas necesitas permiso de aprobación de imputaciones.</p>}
    <div className="space-y-2">{rules.map(rule=><article key={rule.id} className="rounded-xl border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><b>{workerName(rule.trabajador_id)}</b><span className={rule.activa?'text-emerald-800':'text-slate-500'}>{rule.activa?'Activa':'Desactivada'}</span></div>
      <p className="mt-1">Sin marcaje → {centerName(rule.centro_gestion_id)}</p>
      <p className="mt-1 text-xs text-slate-500">{rule.fecha_desde} — {rule.fecha_hasta||'sin término'} · {rule.hora_cierre.slice(0,5)} · {rule.dias_semana.map(day=>days[day-1]).join(', ')}</p>
      <button type="button" disabled={busy} onClick={()=>selectWorker(String(rule.trabajador_id))} className="mt-2 text-xs font-bold text-blue-900">{canApprove?'Editar regla':'Ver regla'}</button>
    </article>)}{loaded&&!rules.length&&<p className="text-sm text-slate-500">No hay reglas autorizadas. Los días sin asistencia permanecen pendientes de asignación.</p>}</div>
  </section>;
}
