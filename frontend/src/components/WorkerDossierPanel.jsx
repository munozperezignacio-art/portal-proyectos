import React, {useEffect, useState} from 'react';
import {supabase} from '../supabaseClient';
import {chileanAttendanceToday} from '../utils/attendanceDates';
import {loadMonthlyWorkerSources, buildMonthlyWorkerReport} from '../utils/monthlyWorkerReport';
import WorkerDocumentsPanel from './WorkerDocumentsPanel';

const money = value => value == null || value === '' ? 'No informado' : new Intl.NumberFormat('es-CL', {style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value));
const tabs = [['documents','Documentos'],['calendar','Calendario'],['earnings','Asignaciones y haberes']];

export default function WorkerDossierPanel({user, worker, workers, documentTypes, aiEnabled}) {
  const [tab,setTab] = useState('documents');
  const [period,setPeriod] = useState(()=>chileanAttendanceToday().slice(0,7));
  const [selected,setSelected] = useState('');
  const [report,setReport] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const needsReport = tab !== 'documents';
  useEffect(()=>{
    if(!needsReport || !period)return;
    let active=true;
    setBusy(true);setError('');setReport(null);setSelected('');
    loadMonthlyWorkerSources(supabase,user.empresa,period).then(sources=>{
      const result=buildMonthlyWorkerReport({company:user.empresa,period,workers,selectedIds:[worker.id],sources});
      if(active){setReport(result);setSelected(result.daily[0]?.date||'');}
    }).catch(err=>{if(active)setError(err.message||'No fue posible cargar los registros.');})
      .finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[needsReport,period,user.empresa,worker.id,workers,retry]);
  function changeMonth(delta){
    const date=new Date(`${period||chileanAttendanceToday().slice(0,7)}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth()+delta);setPeriod(date.toISOString().slice(0,7));
  }
  const day=report?.daily.find(row=>row.date===selected);
  const offset=report?.daily.length?(new Date(`${report.daily[0].date}T12:00:00Z`).getUTCDay()+6)%7:0;
  return <div className="space-y-4">
    <div role="tablist" aria-label="Ficha del trabajador" className="flex flex-wrap gap-2 border-b pb-3">
      {tabs.map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id} aria-controls={`worker-panel-${id}`} onClick={()=>setTab(id)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab===id?'bg-blue-900 text-white':'bg-slate-100 text-slate-700'}`}>{label}</button>)}
    </div>
    {tab==='documents'?<div role="tabpanel" id="worker-panel-documents" aria-label="Documentos"><WorkerDocumentsPanel user={user} worker={worker} documentTypes={documentTypes} aiEnabled={aiEnabled}/></div>:<div role="tabpanel" id={`worker-panel-${tab}`} aria-label={tab==='calendar'?'Calendario':'Asignaciones y haberes'} className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-bold text-slate-600">Mes<input aria-label="Mes de la ficha" type="month" min="1900-01" max="2999-12" value={period} onChange={e=>{if(e.target.value)setPeriod(e.target.value);}} className="mt-1 block rounded-lg border p-2.5"/></label>
        <button type="button" onClick={()=>changeMonth(-1)} className="rounded-lg border p-2.5" aria-label="Mes anterior">←</button>
        <button type="button" onClick={()=>changeMonth(1)} className="rounded-lg border p-2.5" aria-label="Mes siguiente">→</button>
      </div>
      {tab==='earnings'&&<section className="space-y-3"><h4 className="font-bold">Haberes configurados en la ficha actual</h4><p className="text-xs text-slate-500">Estos valores no son una liquidación ni acreditan pago. No representan necesariamente los valores históricos del mes consultado.</p><dl className="grid grid-cols-2 gap-3">
        {[['Sueldo base',money(worker.sueldo_base)],['Colación',money(worker.colacion)],['Movilización',money(worker.movilizacion)],['Gratificación',worker.gratificacion||'No informada']].map(([label,value])=><div key={label} className="rounded-xl border bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-bold break-words">{value}</dd></div>)}
      </dl></section>}
      {busy&&<p role="status">Cargando historial del mes…</p>}
      {error&&<div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">No se pudo cargar el historial: {error} <button type="button" onClick={()=>setRetry(value=>value+1)} className="underline">Reintentar</button></div>}
      {report&&!busy&&!error&&<>
        {report.warnings.map(warning=><p key={warning} role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{warning}</p>)}
        {tab==='calendar'?<>
          <p className="text-xs text-slate-600">Azul: marcaje registrado. Ámbar: solo asignación. Sin registro no significa ausencia. Pulsa un día para ver obras, horarios y horas extras.</p>
          <p className="text-xs text-slate-500 sm:hidden">Desliza horizontalmente para ver todos los días de la semana.</p>
          <div className="overflow-x-auto"><div className="min-w-[560px] grid grid-cols-7 gap-1.5">
            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(label=><div key={label} className="p-2 text-center text-xs font-bold">{label}</div>)}
            {Array.from({length:offset},(_,i)=><div key={`empty-${i}`}/>)}
            {report.daily.map(row=><button key={row.date} type="button" aria-label={`Ver día ${row.date}`} aria-pressed={selected===row.date} onClick={()=>setSelected(row.date)} className={`min-h-28 rounded-xl border p-2 text-left text-xs ${selected===row.date?'ring-2 ring-blue-800':''} ${row.actualCenters?'border-blue-200 bg-blue-50':row.assignedCenters?'border-amber-200 bg-amber-50':'border-slate-200 bg-slate-50'}`}>
              <b className="block text-sm">{Number(row.date.slice(-2))}</b><span className="block mt-1 font-semibold">{row.state}</span><span className="mt-1 block break-words">{row.actualCenters|| (row.assignedCenters?`Asignado: ${row.assignedCenters}`:'Sin ubicación registrada')}</span>
            </button>)}
          </div></div>
          {day&&<section className="rounded-xl border border-blue-200 bg-white p-4 space-y-3" aria-label="Detalle del día"><h4 className="font-bold">Detalle del {day.date}</h4><p className="text-sm">{day.state}</p><dl className="grid gap-3 sm:grid-cols-2 text-sm">
            {[['Obras según marcaje',day.actualCenters||'Sin marcajes'],['Asignaciones (no acreditan asistencia)',day.assignedCenters||'Sin asignaciones'],['Horario registrado',day.shifts||'Sin horario'],['Centro del cargo',day.chargeCenter||'Sin cargo'],['Estado del cargo',day.chargeState],['HE detectadas',day.detected==null?'Sin registro':`${day.detected} h`],['HE aprobadas',day.approved==null?'Sin aprobación':`${day.approved} h`],['Otras horas',day.otherHours==null?'Sin registro':`${day.otherHours} h`]].map(([label,value])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}
          </dl></section>}
        </>:<><h4 className="font-bold">Asignaciones y horas del mes</h4><p className="text-xs text-slate-500">Las horas detectadas no se consideran aprobadas automáticamente. Esta consulta no genera cargos ni modifica remuneraciones.</p><div className="overflow-auto rounded-xl border"><table className="w-full min-w-[620px] text-xs"><thead className="bg-slate-50"><tr>{['Día','Centros asignados','Centro del cargo / estado','HE detectadas','HE aprobadas'].map(label=><th key={label} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{report.daily.map(row=><tr key={row.date} className="border-t"><td className="p-3 whitespace-nowrap">{row.date}</td><td className="p-3">{row.assignedCenters||'Sin asignación'}</td><td className="p-3">{row.chargeCenter||'—'}<small className="block">{row.chargeState}</small></td><td className="p-3">{row.detected??'—'}</td><td className="p-3">{row.approved??'—'}</td></tr>)}</tbody></table></div></>}
      </>}
    </div>}
  </div>;
}
