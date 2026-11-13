import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import {loncoWorkbook,rutKey,monthEnd} from '../utils/loncoWorkbook';
async function pages(query){const all=[];for(let n=0;;n+=300){const {data,error}=await query().range(n,n+299);if(error)throw error;all.push(...data);if(data.length<300)return all;}}
export default function LoncoDownload({empresa,obra,period,day,workers:roster,novelties={},disabled=false}){
 const [busy,set]=useState(false),[error,fail]=useState('');
 const [from,start]=useState(''),[to,endAt]=useState('');
 useEffect(()=>{start(period?period+'-01':'');endAt(period?monthEnd(period):'');fail('');},[period]);
 const [chosen,choose]=useState(null),[open,show]=useState(false),[search,find]=useState('');
 const workers=chosen===null?roster:roster.filter(w=>chosen.includes(String(w.id)));
 const matches=roster.filter(w=>String(w.nombre||'').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())||(rutKey(search)&&rutKey(w.rut).includes(rutKey(search))));
 async function download(){set(true);fail('');try{
 if(!from||!to||from>to)throw Error('Revisa las fechas del informe.');
 const mod=await import('xlsx-js-style'),X=mod.default||mod;
 const scoped=q=>obra?q.eq('obra_id',obra.id):q;
 const [marks,haberes]=await Promise.all([pages(()=>scoped(supabase.from('asistencia_personal').select('id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia,otras_horas,horas_extras_auto,horas_extras_manual').eq('empresa',empresa).gte('fecha_marcacion',from).lte('fecha_marcacion',to)).order('id')),
 pages(()=>scoped(supabase.from('rrhh_haberes_obra').select('obra_id,trabajador_id,concepto,monto,referencia,tipo,clave,maestro_personal(nombre,rut,cargo),obras(nombre)').eq('empresa',empresa).gte('periodo',from.slice(0,7)).lte('periodo',to.slice(0,7))).order('obra_id').order('trabajador_id').order('referencia').order('tipo').order('clave'))]);
 const allowed=new Map(workers.map(w=>[String(w.id),w])),ids=new Set(workers.map(w=>rutKey(w.rut)).filter(Boolean)),earnings=[];
 for(const h of haberes){if((!obra||chosen!==null)&&!allowed.has(String(h.trabajador_id)))continue;const w=allowed.get(String(h.trabajador_id))||{id:h.trabajador_id,...h.maestro_personal};allowed.set(String(w.id),w);earnings.push({worker:w,date:h.referencia,name:h.concepto,amount:h.monto,work:obra?.nombre||h.obras?.nombre||'Obra '+h.obra_id});}
 for(const w of workers)for(const [key,h] of Object.entries(novelties[w.id]?.haberes_detallados||{})){if(!h.date?.startsWith(period)||key.startsWith('[')&&JSON.parse(key).length===4)continue;earnings.push({worker:w,...h,work:'Nómina RRHH'});}
 if(!obra&&(from.slice(0,7)!==period||to.slice(0,7)!==period)){
 const saved=await pages(()=>supabase.from('rrhh_nomina_items').select('id,trabajador_id,novedades,rrhh_nominas_mensuales!inner(empresa,periodo)').eq('rrhh_nominas_mensuales.empresa',empresa).gte('rrhh_nominas_mensuales.periodo',from.slice(0,7)).lte('rrhh_nominas_mensuales.periodo',to.slice(0,7)).neq('rrhh_nominas_mensuales.periodo',period).order('id'));
 for(const item of saved){const worker=allowed.get(String(item.trabajador_id));if(worker)for(const [k,h] of Object.entries(item.novedades?.haberes_detallados||{})){if(h.date&&!(k.startsWith('[')&&JSON.parse(k).length===4))earnings.push({worker,...h,work:'Nómina RRHH'});}}}
 const book=loncoWorkbook(X,period,[...allowed.values()],obra&&chosen===null?marks:marks.filter(m=>ids.has(rutKey(m.rut))),earnings,from,to);
 X.writeFile(book,'HE-'+String(obra?.nombre||'RRHH').replace(/[^\p{L}\p{N} -]/gu,'')+'-'+from+'_'+to+'.xlsx',{dateNF:'dd-mm-yyyy'});
 }catch(e){fail(e.message||'No se pudo descargar.');}finally{set(false);}}
 return <fieldset disabled={busy} className="flex flex-wrap items-end gap-3 text-xs"><legend className="mb-2 font-bold">Descarga de haberes de obra</legend><button type="button" aria-expanded={open} className="rounded-xl border px-3 py-2 font-bold" onClick={()=>show(!open)}>Trabajadores: {chosen===null?\'Todos\':workers.length}</button>{open&&<div className="basis-full rounded-xl border p-3"><input aria-label="Buscar trabajador" placeholder="Buscar por nombre o RUT" className="rounded-lg border p-2" value={search} onChange={e=>find(e.target.value)}/><label className="ml-3"><input type="checkbox" checked={chosen===null} onChange={e=>choose(e.target.checked?null:[])}/> Todos los trabajadores</label><div className="mt-2 grid max-h-48 overflow-auto sm:grid-cols-2">{matches.map(w=><label key={w.id} className="p-1"><input type="checkbox" checked={chosen?.includes(String(w.id))||false} onChange={e=>choose(e.target.checked?[...(chosen||[]),String(w.id)]:(chosen||[]).filter(id=>id!==String(w.id)))}/> {w.nombre} · {w.rut}</label>)}</div></div>}<label>Desde<input className="block rounded-lg border p-2" type="date" value={from} max={to||undefined} onChange={e=>start(e.target.value)}/></label><label>Hasta<input className="block rounded-lg border p-2" type="date" value={to} min={from||undefined} onChange={e=>endAt(e.target.value)}/></label><button type="button" disabled={disabled||(chosen!==null&&!workers.length)||busy||!from||!to||from>to} onClick={download} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-900">{busy?'Preparando Excel…':'Descargar haberes · Excel LONCO'}</button><small>Los haberes mensuales se incluyen solo si seleccionas el mes completo.</small>{error&&<span role="alert">{error}</span>}</fieldset>;
}
