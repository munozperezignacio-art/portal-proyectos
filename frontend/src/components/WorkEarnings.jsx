import React,{useState,useEffect} from 'react';
import {loadEarningsRoster,insertWorkEarnings} from '../utils/workEarningsRoster';
import AttendanceAction from './AttendanceAction';
import WorkerBatch from './WorkerBatch';
import {supabase} from '../supabaseClient';
import {allowanceMonth} from '../utils/workerAllowances';
import EarningsHistory from './EarningsHistory';
import LoncoDownload from './LoncoDownload';
export default function WorkEarnings({obra,workers,showHistory=false,loadRoster=loadEarningsRoster}){
 const [period,setPeriod]=useState(allowanceMonth);
 const [revision,refresh]=useState(0);
 const [range,setRange]=useState(null),[roster,setRoster]=useState({});
 const monthEnd=period?`${period}-${new Date(Number(period.slice(0,4)),Number(period.slice(5)),0).getDate()}`:'';
 const from=range?.from||period+'-01',to=range?.to||monthEnd;
 const workId=obra.id,company=obra.empresa,name=obra.nombre,centerId=obra.centro_gestion_id;
 const key=JSON.stringify([workId,company,from,to]);
 useEffect(()=>{let active=true;if(!period||from>to){setRoster({key,rows:[]});return;}loadRoster(supabase,{id:workId,empresa:company,nombre:name,centro_gestion_id:centerId},from,to).then(rows=>{if(active)setRoster({key,rows});}).catch(e=>{if(active)setRoster({key,error:e.message});});return()=>{active=false;};},[key,workId,company,name,centerId,from,to,period,loadRoster]);
 const historical=roster.key===key?roster.rows||[]:[];
 const loading=roster.key!==key;
 return <><AttendanceAction title="Registrar haberes">
 <p className="text-sm font-bold text-blue-900">{obra.nombre}</p>
 <label className="text-xs font-bold">Mes de nómina<input type="month" value={period} onChange={e=>{setPeriod(e.target.value);setRange(null);}} className="mt-1 block rounded-lg border p-2"/></label>
 <p className="text-xs text-slate-500">Nómina histórica: trabajadores con asignación o marcajes en las fechas seleccionadas, aunque ya no estén en esta obra.</p>
 {roster.key===key&&roster.error&&<p role="alert" className="text-sm text-red-700">No se pudo cargar la nómina: {roster.error}</p>}
 {period&&<WorkerBatch company={showHistory?obra.empresa:null} revision={revision} key={period} loading={loading} onRangeChange={setRange} inline savedMessage="Haberes guardados para esta obra y período." title="Trabajadores de la obra" period={period} workers={historical.map(w=>({id:w.id,name:w.nombre}))} onApply={async(selected,f)=>{
 const concepto=(f.name||'').trim(),monto=Number(f.amount),referencia=f.scope==='dia'?f.day:f.from+'/'+f.to;
 if(!concepto||!referencia?.split('/').at(-1)?.startsWith(period)||!Number.isSafeInteger(monto)||monto<=0||monto>2147483647)throw new Error('Revisa la fecha, el concepto y el monto en pesos.');
 const rows=selected.map(w=>({empresa:obra.empresa,obra_id:obra.id,trabajador_id:w.id,periodo:period,referencia,tipo:f.type||'Imponible',concepto,monto}));
 if(loading||roster.error||selected.some(w=>!historical.some(p=>p.id===w.id)))throw Error('La nómina cambió. Revisa la fecha y selecciona nuevamente los trabajadores.');
 await insertWorkEarnings(supabase,rows);
 refresh(v=>v+1);
 }}/>}</AttendanceAction>{showHistory&&<><AttendanceAction title="Haberes registrados" onOpen={()=>refresh(v=>v+1)}>{revision>0&&<EarningsHistory obra={obra} revision={revision}/>}</AttendanceAction><AttendanceAction title="Descargar haberes"><LoncoDownload empresa={obra.empresa} obra={obra} period={period} workers={workers}/></AttendanceAction></>}</>;
}
