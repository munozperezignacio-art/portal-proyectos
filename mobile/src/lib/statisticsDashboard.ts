import { countChileanBusinessDays, productionMetrics } from './workStatistics';

type Row = Record<string, any>;
export type StatisticsPeriod = '7' | '30' | 'all';
export const dateOnly = (value:unknown) => String(value || '').slice(0,10);
export function localToday() {
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function moveDate(value:string,days:number) {
  const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const reportDate=(r:Row)=>dateOnly(r.fecha || r.fecha_avance || r.created_at);
const attendanceDate=(r:Row)=>dateOnly(r.fecha_marcacion || r.created_at);
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(new Date(`${v}T12:00:00`).getTime());
const positive=(v:unknown)=>Math.max(0,Number(v)||0);
export const isPresent=(r:Row)=>String(r.asistencia || r.estado || '').trim().toLocaleLowerCase('es-CL')==='presente';

export function statisticsDashboard(data:Row,period:StatisticsPeriod,cutoff=localToday()) {
  const parts:Row[]=data.parts||[], reports:Row[]=data.adv||[], attendance:Row[]=data.attendance||[];
  const dated=reports.filter(r=>validDate(reportDate(r))&&reportDate(r)<=cutoff);
  const starts=[...parts.filter(p=>!p.es_titulo).map(p=>dateOnly(p.baselineStart||p.fecha_inicio)),...dated.map(reportDate),...attendance.map(attendanceDate),dateOnly(data.work?.fecha_inicio_real||data.work?.fecha_inicio)].filter(v=>validDate(v)&&v<=cutoff).sort();
  const start=period==='all'?(starts[0]||cutoff):moveDate(cutoff,-(Number(period)-1));
  const previous=moveDate(start,-1);
  const current=productionMetrics(parts,dated,cutoff), before=productionMetrics(parts,dated,previous);
  const budget=current.detail.reduce((sum,p)=>sum+positive(p.budget),0);
  const hasBase=budget>0;
  const hasPlan=hasBase&&current.detail.filter(p=>p.budget>0).every(p=>validDate(dateOnly(p.fecha_inicio)));
  const periodReports=dated.filter(r=>reportDate(r)>=start);
  const reportDays=new Set(periodReports.map(reportDate)).size;
  const points:string[]=[];
  const span=Math.max(0,Math.round((new Date(`${cutoff}T12:00:00`).getTime()-new Date(`${start}T12:00:00`).getTime())/86400000));
  for(let i=0;i<Math.min(6,span+1);i++)points.push(moveDate(start,Math.round(span*i/Math.max(1,Math.min(6,span+1)-1))));
  const evolution=points.map(date=>({date,...productionMetrics(parts,dated,date)}));
  // Keep the latest correction for each worker/day, independent of server ordering.
  const unique=new Map<string,Row>();
  attendance.forEach((row,index)=>{
    const date=attendanceDate(row);if(!validDate(date)||date>cutoff)return;
    const person=String(row.rut_normalizado||row.rut||row.trabajador||row.nombre||`row:${row.id??index}`).replace(/[.\-\s]/g,'').toLowerCase();
    const key=`${date}:${person}`, old=unique.get(key);
    if(!old||String(row.updated_at||row.created_at||'')>String(old.updated_at||old.created_at||''))unique.set(key,row);
  });
  const rows=[...unique.values()].filter(r=>attendanceDate(r)>=start);
  const attendanceDays=[...new Set(rows.map(attendanceDate))].sort().map(date=>{
    const dayRows=rows.filter(r=>attendanceDate(r)===date);
    return {date,total:dayRows.length,present:dayRows.filter(isPresent).length};
  });
  const present=rows.filter(isPresent).length;
  const hoursRows=rows.filter(r=>isPresent(r)&&(r.horas_ordinarias!=null||r.horas_extras_auto!=null));
  const ordinary=hoursRows.reduce((sum,r)=>sum+positive(r.horas_ordinarias),0);
  const extra=hoursRows.reduce((sum,r)=>sum+positive(r.horas_extras_auto),0);
  const latest=dated.map(reportDate).sort().at(-1)||'';
  const critical=current.detail.filter(p=>p.planned>p.pct+.1&&p.pct<100).sort((a,b)=>((b.plannedValue-b.earned)-(a.plannedValue-a.earned))||a.scheduleDays-b.scheduleDays);
  const completed=current.detail.filter(p=>p.pct>=100).length;
  const missingBase=current.detail.filter(p=>!(p.budget>0)).length;
  const finish=dateOnly(data.work?.fecha_termino_estimada||data.work?.fecha_termino);
  const workStart=dateOnly(data.work?.fecha_inicio_real||data.work?.fecha_inicio);
  const validSchedule=validDate(finish)&&validDate(workStart)&&finish>=workStart;
  const elapsed=validSchedule?(cutoff<workStart?0:Math.min(100,countChileanBusinessDays(workStart,cutoff)/Math.max(1,countChileanBusinessDays(workStart,finish))*100)):null;
  return {...current,start,cutoff,hasBase,hasPlan,budget,missingBase,critical,completed,
    noProgress:current.detail.filter(p=>p.planned>0&&p.pct===0).length,
    delta:hasBase?current.progress-before.progress:null,gap:hasPlan?current.progress-current.planned:null,
    periodReports:periodReports.length,reportDays,latest,evolution,finish:validSchedule?finish:'',elapsed,
    attendance:{days:attendanceDays,records:rows.length,present,rate:rows.length?present/rows.length*100:null,ordinary,extra,hoursRows:hoursRows.length,missingHours:rows.filter(isPresent).length-hoursRows.length,latest:attendanceDays.at(-1)||null},
  };
}
