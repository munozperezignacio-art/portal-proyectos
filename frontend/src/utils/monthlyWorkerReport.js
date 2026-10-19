import {attendanceDay,chileanAttendanceToday} from './attendanceDates.js';
import {normalizedAttendanceRut} from './attendanceBatch.js';

export function monthDays(period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || Number(period.slice(0,4)) < 1900 || Number(period.slice(0,4)) > 2999) throw new Error('Selecciona un mes válido.');
  const start = `${period}-01`, date = new Date(`${start}T12:00:00Z`), days=[];
  while (date.toISOString().startsWith(period)) { days.push(date.toISOString().slice(0,10)); date.setUTCDate(date.getUTCDate()+1); }
  return {start,end:date.toISOString().slice(0,10),days};
}
export async function readAllPages(makeQuery) {
  const rows=[];
  for(let offset=0;;offset+=1000) {
    const result=await makeQuery().range(offset,offset+999);
    if(result.error) throw result.error;
    rows.push(...(result.data || []));
    if((result.data || []).length<1000)return rows;
  }
}
// No RPC: a download must never prepare/approve charges or alter payroll.
export async function readMonthlyAttendance(client,company,period) {
  if(!company)throw new Error('Falta la empresa del reporte.');
  const {start,end}=monthDays(period);
  const columns='id,empresa,trabajador,rut,rut_normalizado,obra_id,obra_nombre,fecha_marcacion,created_at,asistencia,ingreso,salida,colacion,horas_extras_auto,horas_extras_manual,otras_horas';
  const before=new Date(`${start}T00:00:00Z`);before.setUTCDate(before.getUTCDate()-1);
  const after=new Date(`${end}T00:00:00Z`);after.setUTCDate(after.getUTCDate()+1);
  const [dated,legacy]=await Promise.all([
    readAllPages(()=>client.from('asistencia_personal').select(columns).eq('empresa',company).gte('fecha_marcacion',start).lt('fecha_marcacion',end).order('id')),
    readAllPages(()=>client.from('asistencia_personal').select(columns).eq('empresa',company).is('fecha_marcacion',null).gte('created_at',before.toISOString()).lt('created_at',after.toISOString()).order('id'))
  ]);
  return [...dated,...legacy].filter(row=>attendanceDay(row)>=start&&attendanceDay(row)<end);
}
export async function loadMonthlyWorkerSources(client,company,period) {
  const {start,end}=monthDays(period);
  const [attendance,allocations,primary,additional,centers,works]=await Promise.all([
    readMonthlyAttendance(client,company,period),
    readAllPages(()=>client.from('rrhh_imputaciones_diarias').select('id,empresa,trabajador_id,fecha,origen,estado,centro_propuesto_id,centro_aprobado_id,horas_extra_aprobadas').eq('empresa',company).gte('fecha',start).lt('fecha',end).order('id')),
    readAllPages(()=>client.from('rrhh_asignaciones_personal').select('*').eq('empresa',company).lt('fecha_inicio',end).or(`fecha_termino.is.null,fecha_termino.gte.${start}`).order('id')),
    readAllPages(()=>client.from('rrhh_personal_centros_detalle').select('*').eq('empresa',company).lt('fecha_inicio',end).or(`fecha_termino.is.null,fecha_termino.gte.${start}`).order('id')),
    readAllPages(()=>client.from('facturacion_centros_gestion').select('id,empresa,codigo,nombre').eq('empresa',company).order('id')),
    readAllPages(()=>client.from('obras').select('id,empresa,nombre,centro_gestion_id').eq('empresa',company).order('id'))
  ]);
  return {attendance,allocations,primary,additional,centers,works};
}
const uniqueText=items=>[...new Set(items.filter(Boolean))].join(' | ');
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const rounded=value=>Math.round((value+Number.EPSILON)*100)/100;
const nameKey=value=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function detectedExtraHours(mark) {return Math.max(0,number(mark.horas_extras_auto),number(mark.horas_extras_manual));}
export function attendanceForWorker(marks,worker,workers) {
  const rut=normalizedAttendanceRut(worker.rut), name=nameKey(worker.nombre);
  const uniqueRut=rut&&workers.filter(w=>normalizedAttendanceRut(w.rut)===rut).length===1;
  const uniqueName=name&&workers.filter(w=>nameKey(w.nombre)===name).length===1;
  return marks.filter(mark=>{
    const markRut=normalizedAttendanceRut(mark.rut_normalizado||mark.rut);
    return markRut ? uniqueRut&&markRut===rut : uniqueName&&nameKey(mark.trabajador)===name;
  });
}
export function buildMonthlyWorkerReport({company,period,workers,selectedIds,sources,today=chileanAttendanceToday()}) {
  const {days}=monthDays(period), selected=new Set(selectedIds.map(String));
  const companyWorkers=workers.filter(w=>w.empresa===company);
  const chosen=companyWorkers.filter(w=>selected.has(String(w.id))).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  if(!chosen.length)throw new Error('Selecciona al menos un trabajador de la empresa.');
  const own=list=>(list||[]).filter(r=>r.empresa===company);
  const centers=new Map(own(sources.centers).map(c=>[String(c.id),c]));
  const works=new Map(own(sources.works).map(w=>[String(w.id),w]));
  const centerLabel=(id,fallback='')=>{const c=centers.get(String(id));return c?`${c.codigo} · ${c.nombre}`:fallback||(id!=null?`Centro ${id}`:'');};
  const seen=new Set(), attendance=own(sources.attendance).filter(m=>{const key=String(m.id);if(seen.has(key))return false;seen.add(key);return days.includes(attendanceDay(m));});
  const daily=[],marks=[],warnings=[];
  const allocations=own(sources.allocations),primary=own(sources.primary),additional=own(sources.additional);
  for(const worker of chosen) {
    const rut=normalizedAttendanceRut(worker.rut);
    if(rut&&companyWorkers.filter(w=>normalizedAttendanceRut(w.rut)===rut).length>1)warnings.push(`${worker.nombre}: RUT duplicado en las fichas; no se atribuyeron marcajes por RUT.`);
    const workerMarks=attendanceForWorker(attendance,worker,companyWorkers);
    const workerAllocations=allocations.filter(r=>String(r.trabajador_id)===String(worker.id));
    const primaryLinks=primary.filter(r=>String(r.trabajador_id)===String(worker.id));
    const secondaryLinks=additional.filter(r=>String(r.trabajador_id)===String(worker.id));
    for(const date of days) {
      const dayMarks=workerMarks.filter(m=>attendanceDay(m)===date);
      const charges=workerAllocations.filter(r=>r.fecha===date);
      if(charges.length>1)throw new Error(`${worker.nombre}: más de un cargo diario para ${date}. Revisa las asignaciones antes de descargar.`);
      const charge=charges[0], approved=charge?.estado==='Aprobada';
      const historical=primaryLinks.filter(r=>r.fecha_inicio<=date&&(!r.fecha_termino||r.fecha_termino>=date));
      const extras=secondaryLinks.filter(r=>r.fecha_inicio<=date&&(!r.fecha_termino||r.fecha_termino>=date));
      const memberships=historical.map(r=>centerLabel(r.centro_gestion_id,r.destino_nombre||r.obra_nombre));
      // A current membership without a start date cannot establish historical location.
      if(!historical.length&&worker.fecha_asig&&worker.fecha_asig.slice(0,10)<=date)memberships.push(centerLabel(worker.centro_gestion_id,worker.obra_nombre));
      memberships.push(...extras.map(r=>centerLabel(r.centro_gestion_id,r.centro_nombre)));
      const outside=worker.fecha_inicio_contrato&&date<worker.fecha_inicio_contrato||worker.fecha_vencimiento_contrato&&date>worker.fecha_vencimiento_contrato;
      const state=dayMarks.length?uniqueText(dayMarks.map(m=>m.asistencia)):charge?`${charge.origen} · ${charge.estado}`:date>today?'Fecha futura':outside?'Fuera de contrato':'Sin registro';
      const workLabel=m=>{const work=works.get(String(m.obra_id));return centerLabel(work?.centro_gestion_id,work?.nombre||m.obra_nombre||'Sin obra identificada');};
      const otherHours=dayMarks.length?rounded(dayMarks.reduce((sum,m)=>sum+number(m.otras_horas),0)):null;
      daily.push({workerId:worker.id,date,worker:worker.nombre,rut:worker.rut||'',day:new Intl.DateTimeFormat('es-CL',{weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)),state,
        actualCenters:uniqueText(dayMarks.map(workLabel)),assignedCenters:uniqueText(memberships),chargeCenter:charge?centerLabel(approved?charge.centro_aprobado_id:charge.centro_propuesto_id):'',chargeState:charge?.estado||'Sin cargo',origin:charge?.origen||'',
        detected:dayMarks.length?rounded(dayMarks.reduce((sum,m)=>sum+detectedExtraHours(m),0)):null,
        approved:approved&&charge.horas_extra_aprobadas!=null?number(charge.horas_extra_aprobadas):null,otherHours,
        shifts:uniqueText(dayMarks.map(m=>`${workLabel(m)}: ${m.ingreso||'—'}–${m.salida||'—'}`))});
      for(const mark of dayMarks)marks.push({date,worker:worker.nombre,rut:worker.rut||'',center:workLabel(mark),state:mark.asistencia||'',start:mark.ingreso||'',end:mark.salida||'',break:mark.colacion||'',detected:detectedExtraHours(mark),otherHours:number(mark.otras_horas),id:mark.id});
    }
  }
  return {company,period,daily,marks,warnings};
}

// Use the portal's browser Excel engine; this is an application exporter, not an authored attachment.
export function monthlyReportWorkbook(XLSX,report) {
  const book=XLSX.utils.book_new();
  const dateValue=date=>({t:'n',v:25569+Date.parse(`${date}T00:00:00Z`)/86400000,z:'dd/mm/yyyy'});
  const header=['Fecha','Día','Trabajador','RUT','Estado asistencia / día','Centro según marcaje','Centros asignados (no prueban asistencia)','Centro del cargo','Estado cargo','Origen cargo','HE detectadas (h)','HE aprobadas (h)','Otras horas (h)','Horarios por centro'];
  const grid=[[],['Asignaciones mensuales',report.company,report.period],['Sin registro no significa ausencia. Centros asignados no acreditan ubicación efectiva.'],['HE aprobadas en blanco = sin aprobación informada. Otras horas son informativas, no se suman a HE ni al pago.'],...report.warnings.map(w=>[w]),[],header,
    ...report.daily.map(r=>[dateValue(r.date),r.day,r.worker,r.rut,r.state,r.actualCenters,r.assignedCenters,r.chargeCenter,r.chargeState,r.origin,r.detected,r.approved,r.otherHours,r.shifts])];
  const headerIndex=5+report.warnings.length;
  const sheet=XLSX.utils.aoa_to_sheet(grid,{cellDates:false,dateNF:'dd/mm/yyyy'});
  sheet['!cols']=[13,13,42,16,32,45,48,42,16,24,20,20,18,70].map(wch=>({wch}));
  sheet['!autofilter']={ref:XLSX.utils.encode_range({r:headerIndex,c:0},{r:grid.length-1,c:13})};
  for(let r=headerIndex+1;r<grid.length;r++)for(const c of [10,11,12]){const cell=sheet[XLSX.utils.encode_cell({r,c})];if(cell)cell.z='0.00';}
  XLSX.utils.book_append_sheet(book,sheet,'Día a día');
  const detail=XLSX.utils.aoa_to_sheet([['Fecha','Trabajador','RUT','Centro según marcaje','Estado','Ingreso','Salida','Colación','HE detectadas (h)','Otras horas (h)','ID marcaje'],
    ...report.marks.map(r=>[dateValue(r.date),r.worker,r.rut,r.center,r.state,r.start,r.end,r.break,r.detected,r.otherHours,r.id])],{dateNF:'dd/mm/yyyy'});
  detail['!cols']=[13,42,16,48,18,12,12,12,20,18,15].map(wch=>({wch}));
  detail['!autofilter']={ref:detail['!ref']};
  XLSX.utils.book_append_sheet(book,detail,'Marcajes');
  return book;
}
