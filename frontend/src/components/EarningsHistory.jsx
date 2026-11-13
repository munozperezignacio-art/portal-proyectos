import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import {allowanceMonth} from '../utils/workerAllowances';

const control='mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2';
const key=r=>JSON.stringify([r.trabajador_id,r.referencia,r.tipo,r.clave]);
const normal=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const dateLabel=s=>s.split('/').map(d=>d.split('-').reverse().join('-')).join(' al ');
export default function EarningsHistory({obra,revision}){
 const [month,setMonth]=useState(allowanceMonth),[day,setDay]=useState(''),[person,setPerson]=useState('');
 const [rows,load]=useState([]),[err,fail]=useState(''),[busy,wait]=useState(false),[edit,start]=useState(null),[saving,saveBusy]=useState(false),[notice,say]=useState(''),[version,refresh]=useState(0);
 useEffect(()=>{
   let active=true; load([]);fail('');start(null);wait(true);
   (async()=>{try{const all=[];if(month)for(let offset=0;;offset+=300){
     let q=supabase.from('rrhh_haberes_obra').select('trabajador_id,referencia,tipo,clave,concepto,monto,maestro_personal(nombre,rut)').eq('obra_id',obra.id).eq('empresa',obra.empresa).eq('periodo',month);
     
     const {data,error}=await q.order('referencia',{ascending:false}).order('trabajador_id').order('tipo').order('clave').range(offset,offset+299);
     if(!active)return;if(error)throw error;all.push(...data.filter(r=>!day||r.referencia===day||(r.referencia.includes('/')&&r.referencia.split('/')[0]<=day&&day<=r.referencia.split('/')[1])));if(data.length<300)break;
   }if(active)load(all);}catch(e){if(active)fail(e.message);}finally{if(active)wait(false);}})();return()=>{active=false;};
 },[obra.id,obra.empresa,revision,month,day,version]);
 const query=normal(person),visible=rows.filter(r=>normal(r.maestro_personal?.nombre).includes(query)||normal(r.maestro_personal?.rut).includes(query)||(/^[0-9.kK-]+$/.test(query)&&normal(r.maestro_personal?.rut).replace(/[.-]/g,'').includes(query.replace(/[.-]/g,''))));
 async function submit(e){e.preventDefault();if(saving)return;const {original,concepto,tipo,referencia}=edit,monto=Number(edit.monto);
   if(!concepto.trim()||!Number.isSafeInteger(monto)||monto<1||monto>2147483647||referencia.split('/').at(-1).slice(0,7)!==month){say('Revisa el concepto, la fecha del período y el monto.');return;}
   saveBusy(true);say('');try{
     const {data,error}=await supabase.from('rrhh_haberes_obra').update({concepto:concepto.trim(),tipo,referencia,monto})
       .eq('obra_id',obra.id).eq('empresa',obra.empresa).eq('periodo',month).eq('trabajador_id',original.trabajador_id).eq('referencia',original.referencia).eq('tipo',original.tipo).eq('clave',original.clave).eq('concepto',original.concepto).eq('monto',original.monto).select('trabajador_id');
     if(error)throw new Error(error.code==='23505'?'Ya existe un haber con ese concepto, tipo y fecha para este trabajador.':error.message);
     if(data?.length!==1)throw new Error('No se guardó: el registro cambió o ya no tienes permiso. Actualiza el listado.');
     say('Corrección guardada.');refresh(v=>v+1);
   }catch(error){say(error.message);}finally{saveBusy(false);}
 }
 return <section className="space-y-3 text-sm"><b>{obra.nombre}</b>
 <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-3"><label>Mes de nómina<input className={control} type="month" value={month} onChange={e=>{setMonth(e.target.value);setDay('');say('');}}/></label>
 <label>Día exacto (opcional)<input className={control} type="date" value={day} onChange={e=>{setDay(e.target.value);if(e.target.value)setMonth(e.target.value.slice(0,7));say('');}}/></label>
 <label>Trabajador<input className={control} type="search" placeholder="Nombre o RUT" value={person} onChange={e=>{setPerson(e.target.value);start(null);}}/></label></fieldset>
 {busy?'Cargando haberes…':err?<p role="alert">{err}</p>:<p>{visible.length} haberes · {day?'Solo del día elegido':'Incluye haberes diarios y mensuales'}</p>}
 <button type="button" disabled={saving} className="font-bold text-blue-900" onClick={()=>refresh(v=>v+1)}>Actualizar listado</button>
 {visible.map(r=><article key={key(r)} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><b>{r.maestro_personal?.nombre||'Trabajador #'+r.trabajador_id}</b><button type="button" disabled={saving} className="rounded-lg border px-3 py-1 font-bold text-blue-900" onClick={()=>{start({...r,original:r});say('');}}>Editar</button></div>
 <p>{dateLabel(r.referencia)} · {r.concepto} · {r.tipo} · <b>${Number(r.monto).toLocaleString('es-CL')}</b></p>
 {edit&&key(edit.original)===key(r)&&<form onSubmit={submit}><fieldset disabled={saving} className="mt-3 grid gap-2 sm:grid-cols-2">
 <label>Concepto<input required maxLength="120" className={control} value={edit.concepto} onChange={e=>start({...edit,concepto:e.target.value})}/></label>
 <label>Monto ($)<input required type="number" min="1" step="1" className={control} value={edit.monto} onChange={e=>start({...edit,monto:e.target.value})}/></label>
 <label>Tipo<select className={control} value={edit.tipo} onChange={e=>start({...edit,tipo:e.target.value})}><option>Imponible</option><option>No imponible</option></select></label>
 {edit.referencia.includes(\u0027/\u0027)?<div className="flex gap-2">{[0,1].map(i=><label key={i}>{i?\u0027Hasta\u0027:\u0027Desde\u0027}<input required type="date" className={control} value={edit.referencia.split(\u0027/\u0027)[i]} onChange={e=>{const dates=edit.referencia.split(\u0027/\u0027);dates[i]=e.target.value;start({...edit,referencia:dates.join(\u0027/\u0027)});}}/></label>)}</div>:<label>Aplicar a<select className={control} value={edit.referencia.length===7?'mes':'dia'} onChange={e=>start({...edit,referencia:e.target.value==='mes'?month:month+'-01'})}><option value="mes">Mes completo</option><option value="dia">Día específico</option></select></label>}
 {!edit.referencia.includes('/')&&edit.referencia.length!==7&&<label>Día dentro del mes<input type="date" required className={control} value={edit.referencia} onChange={e=>start({...edit,referencia:e.target.value})}/></label>}
 <button className="rounded-lg bg-blue-900 p-2 font-bold text-white">Guardar corrección</button><button type="button" onClick={()=>start(null)}>Cancelar</button></fieldset></form>}</article>)}
 <p role="status">{notice}</p></section>;
}
