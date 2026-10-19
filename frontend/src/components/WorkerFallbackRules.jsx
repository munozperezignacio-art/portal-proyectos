import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '../supabaseClient';
import {emptyFallbackRule,fallbackRuleArgs,fallbackWorkerRows} from '../utils/workerFallbackRules.js';

const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const cls='mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm';

export default function WorkerFallbackRules({user,personal,centrosGestion,canApprove,onChanged}){
  const [rules,setRules]=useState([]),[form,setForm]=useState(emptyFallbackRule),[busy,setBusy]=useState(true),[message,setMessage]=useState('');
  const [loaded,setLoaded]=useState(false),[search,setSearch]=useState(''),[filter,setFilter]=useState('sin');
  const [selected,setSelected]=useState([]),[replace,setReplace]=useState(false);
  const inFlight=useRef(false),generation=useRef(0),formRef=useRef(null);
  const load=useCallback(async()=>{
    const request=++generation.current;
    setBusy(true);setLoaded(false);
    try{
      const all=[];
      for(let offset=0;;offset+=1000){
        const result=await supabase.from('rrhh_reglas_sin_asistencia').select('*').eq('empresa',user.empresa).order('id').range(offset,offset+999);
        if(result.error)throw result.error;all.push(...result.data);if(result.data.length<1000)break;
      }
      if(request===generation.current){setRules(all);setLoaded(true);}
      return all;
    }finally{if(request===generation.current)setBusy(false);}
  },[user.empresa]);
  useEffect(()=>{
    setForm(emptyFallbackRule());setSelected([]);setRules([]);setSearch('');setFilter('sin');setReplace(false);setMessage('');
    load().catch(error=>setMessage(error.message||'No fue posible cargar las reglas.'));
    return ()=>{generation.current++;};
  },[load]);
  const rows=useMemo(()=>fallbackWorkerRows(personal,rules,{company:user.empresa,search,filter}),[personal,rules,user.empresa,search,filter]);
  const allRows=useMemo(()=>fallbackWorkerRows(personal,rules,{company:user.empresa,filter:'todas'}),[personal,rules,user.empresa]);
  const selectedSet=new Set(selected),existingSelected=allRows.filter(row=>selectedSet.has(String(row.worker.id))&&row.rule).length;
  const effectiveCount=selected.length-(replace?0:existingSelected);
  const visibleIds=rows.map(row=>String(row.worker.id)),allVisible=visibleIds.length>0&&visibleIds.every(id=>selectedSet.has(id));
  const hiddenSelected=selected.filter(id=>!visibleIds.includes(id)).length;
  const toggle=id=>setSelected(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const toggleVisible=()=>setSelected(current=>allVisible?current.filter(id=>!visibleIds.includes(id)):[...new Set([...current,...visibleIds])]);
  const edit=rule=>{
    setSelected([String(rule.trabajador_id)]);setReplace(true);setMessage('Editando una regla existente: al guardar se reemplazará su configuración.');
    setForm({...rule,centro_gestion_id:String(rule.centro_gestion_id),fecha_hasta:rule.fecha_hasta||'',modo_he:Number(rule.horas_extra_diarias)>0?'con':'sin',horas_extra_diarias:Number(rule.horas_extra_diarias)>0?String(rule.horas_extra_diarias):''});
    formRef.current?.scrollIntoView({block:'start',behavior:'smooth'});
  };
  const save=async event=>{
    event.preventDefault();if(busy||inFlight.current||!canApprove||!loaded)return;
    let args;
    try{args=fallbackRuleArgs({company:user.empresa,selected,form,replace});}catch(error){setMessage(error.message);return;}
    inFlight.current=true;setBusy(true);setMessage('');
    try{
      const result=await supabase.rpc('guardar_reglas_sin_asistencia_lote',args);
      if(result.error)throw result.error;
      const saved=result.data?.guardadas,skipped=result.data?.omitidas;
      if(!Number.isInteger(saved)||!Number.isInteger(skipped)||saved+skipped!==args.p_trabajadores.length)throw new Error('El servidor no confirmó todas las reglas. Actualiza antes de reintentar.');
      await load();setSelected([]);setReplace(false);
      let refreshWarning='';
      try{await onChanged?.();}catch{refreshWarning=' No se pudo actualizar la vista de costos; vuelve a cargarla.';}
      setMessage(`${saved} reglas guardadas · ${skipped} existentes conservadas. Se revisan los días sin ningún marcaje, sin esperar una hora de cierre. Si faltan datos de costeo, el cargo queda pendiente.${refreshWarning}`);
    }catch(error){setMessage(error.message||'No fue posible guardar las reglas.');}
    finally{inFlight.current=false;setBusy(false);}
  };
  const centerName=id=>{const center=centrosGestion.find(item=>String(item.id)===String(id));return center?`${center.codigo} · ${center.nombre}`:'Centro no disponible';};
  return <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5">
    <div><h4 className="font-black">Reglas de cargo sin asistencia</h4><p className="mt-2 text-sm text-slate-600">Si un trabajador no tiene ningún marcaje en ningún centro, su costo se carga al centro definido. Cualquier asistencia, incluida ausencia o permiso, tiene prioridad.</p></div>
    <p className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-950">Sin hora de cierre: se revisa al guardar y automáticamente cada 15 minutos. Solo días vigentes del contrato y de la regla. No crea asistencias, no cambia sueldos y no duplica la nómina conciliada. Las horas extra indicadas son una autorización de costo para días sin marcaje, no horas efectivamente marcadas.</p>
    {message&&<p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">{message}</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Trabajadores',allRows.length],['Sin regla',allRows.filter(row=>!row.rule).length],['Sin regla vigente',allRows.filter(row=>!row.status.current).length],['Seleccionados',selected.length]].map(([text,value])=><div key={text} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{text}</p><b className="text-xl">{loaded?value:'—'}</b></div>)}</div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Buscar trabajador<input type="search" aria-label="Buscar trabajador por nombre o RUT" placeholder="Nombre o RUT…" value={search} onChange={event=>setSearch(event.target.value)} className={cls}/></label><label className="text-xs font-bold">Mostrar trabajadores<select aria-label="Filtrar trabajadores por regla" value={filter} onChange={event=>setFilter(event.target.value)} className={cls}><option value="sin">Sin regla</option><option value="sin_vigente">Sin regla vigente</option><option value="con">Con regla (incluye inactivas)</option><option value="todas">Todos</option></select></label></div>
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 text-xs"><label className="flex items-center gap-2 font-bold"><input type="checkbox" aria-label="Seleccionar todos los trabajadores visibles" disabled={busy||!loaded||!canApprove||!rows.length} checked={allVisible} onChange={toggleVisible}/>Seleccionar visibles ({loaded?rows.length:'—'})</label><button type="button" disabled={busy||!selected.length} onClick={()=>setSelected([])} className="font-bold text-blue-900 disabled:opacity-40">Limpiar selección</button></div>
      <div className="max-h-80 overflow-y-auto divide-y">{loaded&&rows.map(({worker,rule,status})=><article key={worker.id} className={`flex flex-wrap items-start justify-between gap-2 p-3 text-sm ${selectedSet.has(String(worker.id))?'bg-emerald-50':''}`}>
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1" aria-label={`Seleccionar ${worker.nombre}`} disabled={busy||!canApprove} checked={selectedSet.has(String(worker.id))} onChange={()=>toggle(String(worker.id))}/><span className="min-w-0"><b className="block break-words">{worker.nombre}</b><span className="text-xs text-slate-500">{worker.rut||'Sin RUT'} · {worker.cargo||'Sin cargo'}</span><span className={`mt-1 block text-xs ${status.current?'text-emerald-800':'text-slate-500'}`}>{status.label}{rule?` · ${centerName(rule.centro_gestion_id)}`:''}</span>{rule&&<span className="mt-1 block text-xs text-slate-500">{Number(rule.horas_extra_diarias)>0?`Con ${rule.horas_extra_diarias} HE/día`:'Sin horas extra'} · {rule.fecha_desde} — {rule.fecha_hasta||'sin término'} · {rule.dias_semana.map(day=>days[day-1]).join(', ')}</span>}</span></label>
        {rule&&<button type="button" aria-label={`${canApprove?'Editar':'Ver'} regla de ${worker.nombre}`} disabled={busy} onClick={()=>edit(rule)} className="shrink-0 text-xs font-bold text-blue-900">{canApprove?'Editar regla':'Ver regla'}</button>}
      </article>)}{loaded&&!rows.length&&<p className="p-4 text-sm text-slate-500">No hay trabajadores que coincidan con la búsqueda y el filtro.</p>}{!loaded&&<p className="p-4 text-sm text-slate-500">{busy?'Cargando reglas…':'No se pudo comprobar quién tiene regla. Recarga la pantalla antes de guardar.'}</p>}</div>
    </div>
    <p className="text-xs text-slate-500">{selected.length} seleccionados{hiddenSelected?` · ${hiddenSelected} fuera del filtro actual (también se incluyen al guardar)`:''}. Cambiar el filtro no borra la selección.</p>
    <form ref={formRef} onSubmit={save}><fieldset disabled={busy||!canApprove||!loaded} className="space-y-4 disabled:opacity-60">
      <h5 className="font-bold">Configuración común para los seleccionados</h5>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">Cargar al centro de gestión<select required aria-label="Centro de respaldo" value={form.centro_gestion_id} onChange={event=>setForm({...form,centro_gestion_id:event.target.value})} className={cls}><option value="">Selecciona centro</option>{centrosGestion.filter(center=>center.activo!==false&&(!center.empresa||center.empresa===user.empresa)).map(center=><option key={center.id} value={center.id}>{center.codigo} · {center.nombre}</option>)}</select></label>
        <label className="text-xs font-bold">Horas extra<select aria-label="Modo de horas extra" value={form.modo_he} onChange={event=>setForm({...form,modo_he:event.target.value,horas_extra_diarias:''})} className={cls}><option value="sin">Sin horas extra</option><option value="con">Con horas extra</option></select></label>
        {form.modo_he==='con'&&<label className="text-xs font-bold">Cantidad de HE por día aplicable<input required type="number" min="0.01" max="24" step="0.01" aria-label="Horas extra diarias de la regla" value={form.horas_extra_diarias} onChange={event=>setForm({...form,horas_extra_diarias:event.target.value})} className={cls}/></label>}
        <label className="text-xs font-bold">Vigente desde<input required type="date" aria-label="Regla vigente desde" value={form.fecha_desde} onChange={event=>setForm({...form,fecha_desde:event.target.value})} className={cls}/></label>
        <label className="text-xs font-bold">Hasta (opcional)<input type="date" aria-label="Regla vigente hasta" min={form.fecha_desde} value={form.fecha_hasta} onChange={event=>setForm({...form,fecha_hasta:event.target.value})} className={cls}/></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activa} onChange={event=>setForm({...form,activa:event.target.checked})}/>Regla activa</label>
      </div>
      <fieldset><legend className="mb-2 text-xs font-bold">Días aplicables</legend><div className="flex flex-wrap gap-3">{days.map((day,index)=><label key={day} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={form.dias_semana.includes(index+1)} onChange={event=>setForm({...form,dias_semana:event.target.checked?[...form.dias_semana,index+1].sort():form.dias_semana.filter(value=>value!==index+1)})}/>{day}</label>)}</div></fieldset>
      {existingSelected>0&&<label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><input type="checkbox" aria-label="Reemplazar reglas existentes de los seleccionados" checked={replace} onChange={event=>setReplace(event.target.checked)}/><span>Reemplazar las reglas existentes de {existingSelected} seleccionados con esta configuración. Si no lo marcas, se conservan sin cambios.</span></label>}
      <button type="submit" disabled={!effectiveCount} className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy?'Guardando…':`Guardar reglas para ${effectiveCount} trabajadores`}</button>
    </fieldset></form>
    {!canApprove&&<p className="text-xs text-amber-900">Puedes consultar las reglas. Para autorizarlas necesitas permiso de aprobación de imputaciones.</p>}
    <p className="text-xs leading-relaxed text-slate-500">Al guardar se revisan hoy y hasta 31 días anteriores dentro de la vigencia. Para períodos más antiguos, actualiza las propuestas del mes. Editar o desactivar no elimina cargos ya autorizados de días anteriores. Una asistencia tardía reemplaza el respaldo en la misma imputación; los meses conciliados requieren revisión explícita.</p>
  </section>;
}
