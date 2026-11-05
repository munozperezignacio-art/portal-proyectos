import React,{useEffect,useState,useRef} from 'react';
import {supabase} from '../supabaseClient';
export default function WorkEquipmentCompletion({completion,periods,company,obra,onSaved}){
 const [answer,setAnswer]=useState(null),[allowed,setAllowed]=useState(false),[ready,setReady]=useState(false),[ids,setIds]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const saving=useRef(false),date=completion?.fecha_termino;
 useEffect(()=>{let active=true;setReady(false);setIds([]);setAnswer(null);setError('');
  if(!date||completion?.estado!=='completada')return;
  Promise.all([supabase.from('maquinaria_cierre_obra_respuestas').select('*').eq('empresa',company).eq('obra_id',obra.id).eq('fecha_termino',date).maybeSingle(),supabase.rpc('permisos_imputaciones_personal_obra',{p_empresa:company,p_obra:obra.id})]).then(([a,p])=>{if(!active)return;if(a.error||p.error){setError('No se pudo consultar la respuesta del cierre.');return;}setAnswer(a.data);setAllowed(!!p.data?.aprobar);setReady(true);}).catch(()=>{if(active)setError('No se pudo consultar el cierre.');});
  return()=>{active=false;};
 },[company,obra.id,date,completion?.estado]);
 if(completion?.estado!=='completada'||!date)return null;
 const next=new Date(date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);const stop=next.toISOString().slice(0,10);
 const equipment=[...new Map(periods.filter(p=>String(p.obra_id)===String(obra.id)&&p.desde<=date&&(!p.hasta||p.hasta>stop)).map(p=>[p.equipo_id,p])).values()];
 async function respond(action){
  if(saving.current||!ready||!allowed)return;
  if(!window.confirm(action==='baja'?'¿Confirmar la baja de los equipos seleccionados desde el día siguiente al término?':'¿Mantener los equipos asignados y cerrar esta pregunta?'))return;
  saving.current=true;setBusy(true);setError('');
  try{const {error:e}=await supabase.rpc('responder_cierre_maquinaria',{p_empresa:company,p_obra:obra.id,p_fecha:date,p_accion:action,p_equipos:action==='baja'?ids:[]});if(e)throw e;setAnswer({accion:action});await onSaved();}catch(e){setError(e.message);}finally{saving.current=false;setBusy(false);}
 }
 return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
 <h3 className="font-bold">Obra terminada al 100% · {date.split('-').reverse().join('-')}</h3>
 {answer?<p className="text-sm">Respuesta registrada: {answer.accion==='baja'?'baja confirmada para los equipos seleccionados':'mantener equipos asignados'}. Puedes gestionar otras bajas desde Control de costos.</p>:<>
 <p className="font-semibold">¿Quieres dar de baja los equipos de esta obra?</p>
 <p className="text-sm">El {date.split('-').reverse().join('-')} será el último día de cargo automático; la baja comienza el {stop.split('-').reverse().join('-')}. No elimina reportes, cargos confirmados ni asignaciones en otras obras. Los equipos que no selecciones se mantendrán asignados.</p>
 {ready&&<><label className="flex gap-2 text-sm"><input type="checkbox" disabled={!allowed||busy} checked={equipment.length>0&&equipment.every(p=>ids.includes(p.equipo_id))} onChange={e=>setIds(e.target.checked?equipment.map(p=>p.equipo_id):[])}/>Seleccionar todos</label>
 <div className="grid gap-2 sm:grid-cols-2">{equipment.map(p=><label key={p.equipo_id} className="flex gap-2 rounded-lg bg-white p-3 text-sm"><input type="checkbox" disabled={!allowed||busy} checked={ids.includes(p.equipo_id)} onChange={e=>setIds(prev=>e.target.checked?[...prev,p.equipo_id]:prev.filter(id=>id!==p.equipo_id))}/>{p.equipo_patente} · {p.equipo_tipo}</label>)}</div>
 {!equipment.length&&<p>No hay equipos con asignación vigente desde el término.</p>}
 {allowed?<div className="flex flex-wrap gap-2"><button disabled={busy||!ids.length} onClick={()=>respond('baja')} className="rounded-xl bg-indigo-900 px-4 py-2 text-white disabled:opacity-40">Confirmar baja de seleccionados</button><button disabled={busy} onClick={()=>respond('mantener')} className="rounded-xl border bg-white px-4 py-2">Mantener asignados</button></div>:<p className="text-sm">Debe responder un Administrador de Empresa o de Contratos.</p>}</>}
 </>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </section>;
}
