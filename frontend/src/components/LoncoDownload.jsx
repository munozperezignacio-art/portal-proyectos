import React,{useState} from 'react';
import {supabase} from '../supabaseClient';
import {loncoWorkbook,rutKey} from '../utils/loncoWorkbook';
async function pages(query){const all=[];for(let n=0;;n+=300){const {data,error}=await query().range(n,n+299);if(error)throw error;all.push(...data);if(data.length<300)return all;}}
export default function LoncoDownload({empresa,obra,period,day,workers,novelties={},disabled=false}){
 const [busy,set]=useState(false),[error,fail]=useState('');
 async function download(){set(true);fail('');try{
 const X=await import('xlsx'),end=new Date(Date.UTC(+period.slice(0,4),+period.slice(5),0)).toISOString().slice(0,10);
 const scoped=q=>obra?q.eq('obra_id',obra.id):q;
 const [marks,haberes]=await Promise.all([pages(()=>scoped(supabase.from('asistencia_personal').select('id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia,otras_horas,horas_extras_auto,horas_extras_manual').eq('empresa',empresa).gte('fecha_marcacion',day||period+'-01').lte('fecha_marcacion',day||end)).order('id')),
 pages(()=>{let q=scoped(supabase.from('rrhh_haberes_obra').select('obra_id,trabajador_id,concepto,monto,referencia,tipo,clave,maestro_personal(nombre,rut,cargo),obras(nombre)').eq('empresa',empresa).eq('periodo',period));if(day)q=q.eq('referencia',day);return q.order('obra_id').order('trabajador_id').order('referencia').order('tipo').order('clave');})]);
 const allowed=new Map(workers.map(w=>[String(w.id),w])),ids=new Set(workers.map(w=>rutKey(w.rut)).filter(Boolean)),earnings=[];
 for(const h of haberes){if(!obra&&!allowed.has(String(h.trabajador_id)))continue;const w=allowed.get(String(h.trabajador_id))||{id:h.trabajador_id,...h.maestro_personal};allowed.set(String(w.id),w);earnings.push({worker:w,date:h.referencia,name:h.concepto,amount:h.monto,work:obra?.nombre||h.obras?.nombre||'Obra '+h.obra_id});}
 for(const w of workers)for(const [key,h] of Object.entries(novelties[w.id]?.haberes_detallados||{})){if(!h.date?.startsWith(period)||key.startsWith('[')&&JSON.parse(key).length===4)continue;earnings.push({worker:w,...h,work:'Nómina RRHH'});}
 const book=loncoWorkbook(X,period,[...allowed.values()],obra?marks:marks.filter(m=>ids.has(rutKey(m.rut))),earnings);
 X.writeFile(book,'HE-'+String(obra?.nombre||'RRHH').replace(/[^\p{L}\p{N} -]/gu,'')+'-'+(day||period)+'.xlsx',{dateNF:'dd-mm-yyyy'});
 }catch(e){fail(e.message||'No se pudo descargar.');}finally{set(false);}}
 return <><button type="button" disabled={disabled||busy||!period} onClick={download} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-900">{busy?'Preparando Excel…':'Descargar haberes · Excel LONCO'}</button>{error&&<span role="alert">{error}</span>}</>;
}
