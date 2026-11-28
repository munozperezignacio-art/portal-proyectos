import React,{useRef,useState} from 'react';
import {topographyFields,topographyPayload} from '../../../mobile/src/lib/topographyJournal.mjs';
import {matchesPile} from '../utils/specialtyAdvance';
const field='rounded-lg border border-slate-300 bg-white p-2 text-sm w-full';
const button='rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40';
export default function SpecialtyTopographyEntry({elements,scope,allowed,call,refresh}){
 const [initial]=useState(()=>{try{return {data:JSON.parse(localStorage.getItem(scope)||'null'),error:''};}catch{return {data:null,error:'No se pudo recuperar el borrador. Vuelve a abrir la obra.'};}});
 const [date,setDate]=useState(initial.data?.date||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date()));
 const [rows,setRows]=useState(initial.data?.rows||[]),[search,setSearch]=useState(''),[message,setMessage]=useState(initial.error),[busy,setBusy]=useState(false);
 const lock=useRef(false);
 const persist=(next,day=date)=>{localStorage.setItem(scope,JSON.stringify({date:day,rows:next}));setRows(next);setDate(day);};
 const change=(next,day=date)=>{try{persist(next,day);}catch{setMessage('No se pudo guardar el borrador en este navegador. No se enviaron cambios.');}};
 const save=async()=>{if(lock.current||!allowed||!rows.length)return;lock.current=true;setBusy(true);let remaining=[...rows],count=0;
  try{for(const row of rows){const element=elements.find(e=>e.id===row.element_id);if(!element)throw Error('La pila ya no está disponible en esta partida.');
   const payload=row.request||{...topographyPayload(element,row,date),request_id:crypto.randomUUID()};
   remaining=remaining.map(r=>r.element_id===row.element_id?{...r,request:payload}:r);persist(remaining);
   try{await call('topography',payload);}catch(error){if(['P0001','23514','22P02'].includes(error.code)){remaining=remaining.map(r=>r.element_id===row.element_id?{...r,request:undefined}:r);persist(remaining);}throw error;}
   count++;remaining=remaining.filter(r=>r.element_id!==row.element_id);persist(remaining);
  }setMessage(`${count} pilas guardadas. Mediciones vinculadas sin sumar avance de ejecución.`);
  }catch(error){setMessage(`${count} pilas guardadas; ${remaining.length} pendientes. ${error.message} El borrador se conserva para reintentar.`);}
  finally{await refresh();lock.current=false;setBusy(false);}
 };
 const candidates=elements.filter(e=>!rows.some(r=>r.element_id===e.id)&&matchesPile(e,search));
 return <section className="space-y-4" aria-label="Registro de topografía"><h4 className="font-bold text-slate-900">Registrar topografía por pila</h4><p className="text-sm text-slate-600">Registra las mediciones antes o después de la ejecución, en cualquier orden. Cada medición queda asociada a la misma pila.</p>
 {!allowed?<p>Tu rol necesita Editar en Mediciones de topografía por especialidad.</p>:<>
 <label className="block text-sm font-bold">Fecha de medición<input className={field} type="date" value={date} disabled={busy||rows.some(r=>r.request)||!!initial.error} onChange={e=>change(rows,e.target.value)}/></label>
 <label className="block text-sm">Buscar pila por número, etapa o frente<input className={field} type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <p className="text-sm text-slate-500">{candidates.length} pilas disponibles · Mostrando hasta 20 coincidencias.</p>
 <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">{candidates.slice(0,20).map(e=><div key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm"><span>Pila {e.numero} · {e.etapa} · {e.frente||'Sin frente'}</span><button className={button} disabled={busy||!!initial.error} onClick={()=>{change([...rows,{element_id:e.id,baseRevision:e.revision_topografia,baseTopography:e.topografia||{},...Object.fromEntries(topographyFields.map(([k])=>[k,e.topografia?.[k]??'']))}]);setSearch('');}}>Agregar pila {e.numero}</button></div>)}{!candidates.length&&<p className="p-3 text-sm">Sin pilas disponibles para esta búsqueda. Revisa también las pilas seleccionadas.</p>}</div>
 {rows.map(row=>{const element=elements.find(e=>e.id===row.element_id);return <div key={row.element_id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"><h5 className="font-bold">Pila {element?.numero} · {element?.etapa} · {element?.frente}</h5><div className="grid grid-cols-1 gap-3 md:grid-cols-3">{topographyFields.map(([key,label])=><label key={key} className="text-sm">{label}<input aria-label={`${label} pila ${element?.numero}`} className={field} inputMode="decimal" disabled={busy||!!row.request} value={row[key]??''} onChange={e=>change(rows.map(r=>r.element_id===row.element_id?{...r,[key]:e.target.value}:r))}/></label>)}</div><button className={button} disabled={busy||!!row.request} onClick={()=>change(rows.filter(r=>r.element_id!==row.element_id))}>Quitar pila {element?.numero}</button></div>;})}
 <button className="rounded-xl bg-blue-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40" disabled={busy||!rows.length||!!initial.error} onClick={save}>{busy?'Guardando…':'Guardar jornada de topografía'}</button>
 </>}{message&&<p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{message}</p>}</section>;
}
