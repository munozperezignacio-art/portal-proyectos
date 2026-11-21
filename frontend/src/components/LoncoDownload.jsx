import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import {loncoWorkbook,rutKey,monthEnd} from '../utils/loncoWorkbook';
import {loadEarningsExport} from '../utils/earningsExport';
import {loadEarningsRoster} from '../utils/workEarningsRoster';
import {workerIsActive} from '../utils/workerActive';
const input='mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-700 focus:ring-2 focus:ring-blue-100';
const emptyWorkers=[];
export default function LoncoDownload({empresa,obra,obras=[],period,workers:allWorkers=emptyWorkers,novelties={},disabled=false,allowPayroll=false}){
 const [busy,set]=useState(false),[error,fail]=useState('');
 const [from,start]=useState(''),[to,endAt]=useState('');
 useEffect(()=>{start(period?period+'-01':'');endAt(period?monthEnd(period):'');fail('');},[period]);
 const [chosen,choose]=useState(null),[workIds,chooseWorks]=useState(null),[search,find]=useState(''),[includePayroll,setPayroll]=useState(false);
 const [roster,setRoster]=useState([]),[loadingRoster,setLoadingRoster]=useState(true),[includeInactive,setInactive]=useState(false);
 const scopeKey=JSON.stringify((obra?[obra]:obras.filter(w=>workIds===null||workIds.includes(String(w.id)))).map(w=>[w.id,w.nombre,w.centro_gestion_id,w.empresa||empresa]));
 useEffect(()=>{
  let cancelled=false;setLoadingRoster(true);setRoster([]);choose(null);fail('');
  const selected=JSON.parse(scopeKey).map(([id,nombre,centro_gestion_id,company])=>({id,nombre,centro_gestion_id,empresa:company}));
  if(!from||!to||from>to){setLoadingRoster(false);return()=>{cancelled=true;};}
  Promise.all(selected.map(work=>loadEarningsRoster(supabase,work,from,to))).then(groups=>{
   if(cancelled)return;
   const people=new Map(groups.flat().map(w=>[String(w.id),w]));
   if(includePayroll&&workIds===null&&!obra)allWorkers.forEach(w=>people.set(String(w.id),w));
   setRoster([...people.values()].filter(w=>includeInactive||workerIsActive(w)).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')));
  }).catch(e=>{if(!cancelled)fail(e.message||'No se pudo cargar el personal del período.');}).finally(()=>{if(!cancelled)setLoadingRoster(false);});
  return()=>{cancelled=true;};
 },[scopeKey,from,to,includeInactive,includePayroll,allWorkers,obra,workIds]);
 const matches=roster.filter(w=>String(w.nombre||'').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())||(rutKey(search)&&rutKey(w.rut).includes(rutKey(search))));
 const toggle=(selected,all,id,checked)=>checked?[...new Set([...(selected||all),id])]:(selected||all).filter(v=>v!==id);
 async function download(){set(true);fail('');try{
  const data=await loadEarningsExport(supabase,{empresa,obra,workIds:obra?null:(workIds??obras.map(w=>String(w.id))),workerIds:chosen??roster.map(w=>String(w.id)),workers:roster,from,to,period,novelties,includePayroll:allowPayroll&&includePayroll&&workIds===null});
  const mod=await import('xlsx-js-style'),X=mod.default||mod;
  X.writeFile(loncoWorkbook(X,period,data.workers,data.marks,data.earnings,from,to),'HE-'+String(obra?.nombre||'RRHH').replace(/[^\p{L}\p{N} -]/gu,'')+'-'+from+'_'+to+'.xlsx',{dateNF:'dd-mm-yyyy'});
 }catch(e){fail(e.message||'No se pudo descargar.');}finally{set(false);}}
 return <fieldset disabled={busy||disabled} className="space-y-4 text-sm"><legend className="mb-3 font-bold text-blue-950">Descarga de haberes de obra</legend>
 <label className="flex items-center gap-2"><input type="checkbox" checked={includeInactive} onChange={e=>setInactive(e.target.checked)}/>Incluir trabajadores dados de baja (consulta histórica)</label>
 {loadingRoster&&<p role="status">Cargando personal de las obras y fechas seleccionadas…</p>}
 <div className="grid gap-3 sm:grid-cols-2"><label>Desde<input className={input} type="date" value={from} max={to||undefined} onChange={e=>start(e.target.value)}/></label><label>Hasta<input className={input} type="date" value={to} min={from||undefined} onChange={e=>endAt(e.target.value)}/></label></div>
 {!obra&&<section className="rounded-xl border border-slate-200 bg-slate-50 p-3"><h4 className="mb-2 font-bold text-blue-950">Obras</h4><label className="flex items-center gap-2"><input type="checkbox" checked={workIds===null} onChange={e=>chooseWorks(e.target.checked?null:[])}/>Todas las obras autorizadas</label><div className="mt-2 grid max-h-40 gap-2 overflow-auto sm:grid-cols-2">{obras.map(w=><label key={w.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2"><input type="checkbox" checked={workIds===null||workIds.includes(String(w.id))} onChange={e=>chooseWorks(toggle(workIds,obras.map(o=>String(o.id)),String(w.id),e.target.checked))}/>{w.nombre}</label>)}</div></section>}
 <section className="rounded-xl border border-slate-200 bg-slate-50 p-3"><h4 className="font-bold text-blue-950">Trabajadores</h4><input aria-label="Buscar trabajador" placeholder="Buscar por nombre o RUT" className={input} value={search} onChange={e=>find(e.target.value)}/><label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={chosen===null} onChange={e=>choose(e.target.checked?null:[])}/>Todos los trabajadores</label><div className="mt-2 grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">{matches.map(w=><label key={w.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2"><input type="checkbox" checked={chosen===null||chosen.includes(String(w.id))} onChange={e=>choose(toggle(chosen,roster.map(p=>String(p.id)),String(w.id),e.target.checked))}/>{w.nombre} · {w.rut}</label>)}</div><p className="mt-2 text-xs text-slate-500">La selección se cruza con las obras y fechas elegidas, no con la obra actual del trabajador.</p></section>
 {!obra&&allowPayroll&&workIds===null&&<label className="flex items-center gap-2"><input type="checkbox" checked={includePayroll} onChange={e=>setPayroll(e.target.checked)}/>Incluir también haberes de nómina RRHH sin obra</label>}
 <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-950">Se incluyen todas las asignaciones cuya vigencia cruza las fechas elegidas. Monto completo: se incluye una vez por asignación. Proporcional: días trabajados del rango divididos por los días trabajados de su vigencia. La planilla identifica cada período y cálculo.</p>
 <button type="button" disabled={disabled||loadingRoster||roster.length===0||chosen?.length===0||workIds?.length===0||busy||!from||!to||from>to} onClick={download} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50">{busy?'Preparando Excel…':'Descargar Excel de haberes'}</button>
 {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
 </fieldset>;
}
