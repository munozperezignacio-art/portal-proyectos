import {useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import {overlaps} from '../utils/earningOverlap.mjs';
export function useEarningAlerts(company,from,to,revision,draft,month){
 const [result,set]=useState({});const stamp=JSON.stringify([company,from,to,revision,month]);
 useEffect(()=>{let active=true;if(!company||!from||!to||from>to)return;
 (async()=>{const entries=new Map();const add=(id,k,date,name)=>{if(overlaps(date,from,to))entries.set(JSON.stringify([String(id),k]),{id,name,date});};
 const read=async(make,each)=>{for(let i=0;;i+=500){const {data,error}=await make().range(i,i+499);if(!active)return;if(error)throw error;data.forEach(each);if(data.length<500)return;}};
 const payroll=(id,items)=>Object.entries(items||{}).forEach(([k,h])=>{if(k.startsWith('[')&&JSON.parse(k).length===4)return;add(id,'nomina:'+k,h.date,h.name);});
 try{
 await read(()=>supabase.from('rrhh_haberes_obra').select('obra_id,trabajador_id,referencia,tipo,clave,concepto').eq('empresa',company).gte('periodo',from.slice(0,7)).order('obra_id').order('trabajador_id').order('referencia').order('tipo').order('clave'),r=>add(r.trabajador_id,JSON.stringify([r.obra_id,r.referencia,r.tipo,r.clave]),r.referencia,r.concepto));
 if(!active)return;
 await read(()=>supabase.from('rrhh_nomina_items').select('trabajador_id,novedades,rrhh_nominas_mensuales!inner(empresa,periodo)').eq('rrhh_nominas_mensuales.empresa',company).gte('rrhh_nominas_mensuales.periodo',from.slice(0,7)).order('id'),r=>{if(!draft||r.rrhh_nominas_mensuales.periodo!==month)payroll(r.trabajador_id,r.novedades?.haberes_detallados);});
 for(const [id,n] of Object.entries(draft||{}))payroll(id,n.haberes_detallados);
 const byId={};for(const r of entries.values())(byId[r.id]??=[]).push(r);
 if(active)set({stamp,byId});
 }catch{if(active)set({stamp,error:true});}})();return()=>{active=false;};},[stamp,draft]);
 return result.stamp===stamp?result:{};
}
