import React,{useState} from 'react';
import AttendanceAction from './AttendanceAction';
import WorkerBatch from './WorkerBatch';
import {supabase} from '../supabaseClient';
import {allowanceMonth} from '../utils/workerAllowances';
import EarningsHistory from './EarningsHistory';
export default function WorkEarnings({obra,workers}){
 const [period,setPeriod]=useState(allowanceMonth);
 const [revision,refresh]=useState(0);
 return <><AttendanceAction title="Registrar haberes">
 <p className="text-sm font-bold text-blue-900">{obra.nombre}</p>
 <label className="text-xs font-bold">Mes de nómina<input type="month" value={period} onChange={e=>setPeriod(e.target.value)} className="mt-1 block rounded-lg border p-2"/></label>
 {period&&<WorkerBatch key={period} inline savedMessage="Haberes guardados para esta obra y período." title="Trabajadores de la obra" period={period} workers={workers.map(w=>({id:w.id,name:w.nombre}))} onApply={async(selected,f)=>{
 const concepto=(f.name||'').trim(),monto=Number(f.amount),referencia=f.scope==='dia'?f.day:period;
 if(!concepto||!referencia?.startsWith(period)||!Number.isSafeInteger(monto)||monto<=0||monto>2147483647)throw new Error('Revisa la fecha, el concepto y el monto en pesos.');
 const rows=selected.map(w=>({empresa:obra.empresa,obra_id:obra.id,trabajador_id:w.id,periodo:period,referencia,tipo:f.type||'Imponible',concepto,monto}));
 const {error}=await supabase.from('rrhh_haberes_obra').upsert(rows,{onConflict:'empresa,obra_id,trabajador_id,referencia,tipo,clave'});
 if(error)throw error;
 refresh(v=>v+1);
 }}/>}</AttendanceAction><AttendanceAction title="Haberes registrados" onOpen={()=>refresh(v=>v+1)}>{revision>0&&<EarningsHistory obra={obra} revision={revision}/>}</AttendanceAction></>;
}
