import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import SpecialtyReports from './SpecialtyReports';
export default function SpecialtyConfiguration({user}){
 const [works,setWorks]=useState([]),[workId,setWorkId]=useState(''),[parts,setParts]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{let active=true;supabase.from('obras').select('id,nombre,empresa').eq('empresa',user.empresa).order('nombre').then(({data,error})=>{if(!active)return;if(error)setError(error.message);else setWorks(data||[]);});return()=>{active=false;};},[user.empresa]);
 useEffect(()=>{if(!workId)return;let active=true;setParts([]);setLoading(true);setError('');supabase.from('partidas_obra').select('id,partida,unidad,es_titulo').eq('empresa',user.empresa).eq('obra_id',Number(workId)).order('id').then(({data,error})=>{if(!active)return;if(error)setError(error.message);else setParts(data||[]);setLoading(false);});return()=>{active=false;};},[workId,user.empresa]);
 const work=works.find(w=>String(w.id)===workId);
 return <section className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black">Obras · Configuración de especialidades</h3><p className="mt-2 text-sm text-slate-500">Selecciona obra y partida para habilitar el registro por especialidad. Los responsables se definen por rol en Responsabilidades por módulo; aquí no se asignan personas.</p><label className="mt-4 block text-sm font-bold">Obra<select className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3" value={workId} onChange={e=>setWorkId(e.target.value)}><option value="">Seleccionar obra</option>{works.map(w=><option key={w.id} value={w.id}>{w.nombre}</option>)}</select></label></div>{error&&<p role="alert">{error}</p>}{loading&&<p>Cargando partidas…</p>}{work&&!loading&&!error&&<SpecialtyReports key={work.id} work={work} user={user} parts={parts} settingsOnly/>}</section>;
}
