import { calendarTimeline } from './sCurveTimeline.js';

export function forecastModel({ cutoff, baselineFinish, actualProgress, plannedProgress, actualCost, costBudget, holidays = [], costError = '' }) {
  const holidaySet = new Set(holidays);
  const workday = date => ![0,6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) && !holidaySet.has(date);
  const daysBetween = (a,b) => calendarTimeline(a,b).slice(1).filter(d => workday(d.dateStr)).length;
  const progress = Math.max(0,Math.min(1,Number(actualProgress)/100));
  const spi = Number(plannedProgress)>0 ? Number(actualProgress)/Number(plannedProgress) : null;
  const pendingPlan = daysBetween(cutoff,baselineFinish);
  const duration = progress>=1 ? 0 : spi>0 && pendingPlan>0 ? Math.ceil(pendingPlan/spi) : null;
  let finish = duration === 0 ? cutoff : null;
  if (duration>0 && duration<=5200) {
    const date = new Date(`${cutoff}T12:00:00Z`); let pending=duration;
    while(pending>0) { date.setUTCDate(date.getUTCDate()+1); const key=date.toISOString().slice(0,10); if(workday(key))pending--; }
    finish=date.toISOString().slice(0,10);
  }
  const cpi = !costError && costBudget>0 && actualCost>0 && progress>0 ? costBudget*progress/actualCost : null;
  // EAC at current cost/physical-progress rate does not require a comparison budget.
  const baseCost = !costError && actualCost>0 && progress>0 ? Math.round(actualCost/progress) : null;
  const remainingCost = baseCost == null ? null : Math.max(0,baseCost-actualCost);
  const monthDays = new Map();
  if (finish && remainingCost != null) calendarTimeline(cutoff,finish).slice(1).filter(d=>workday(d.dateStr)).forEach(d=>monthDays.set(d.dateStr.slice(0,7),(monthDays.get(d.dateStr.slice(0,7))||0)+1));
  const totalDays=[...monthDays.values()].reduce((s,n)=>s+n,0);
  const cashflow=[...monthDays].map(([month,days])=>({month,amount:Math.floor(remainingCost*days/totalDays),days}));
  if(cashflow.length)cashflow.at(-1).amount+=remainingCost-cashflow.reduce((s,m)=>s+m.amount,0);
  const coveredYears = new Set(holidays.map(d=>d.slice(0,4)));
  const missingCalendarYears = finish ? [...new Set(calendarTimeline(cutoff,finish).map(d=>d.dateStr.slice(0,4)))].filter(y=>!coveredYears.has(y)) : [];
  const calendarWarning = missingCalendarYears.length ? `Fecha referencial: se excluyen fines de semana y los feriados cargados. Falta validar los feriados de ${missingCalendarYears.join(', ')}; la fecha y el reparto mensual pueden variar.` : '';
  const scheduleWarning = finish ? '' : !baselineFinish ? 'Falta la fecha de término programada de la obra.' : !(spi>0) ? 'Falta avance real o avance programado al corte para extrapolar el plazo.' : pendingPlan<=0 ? 'La fecha programada ya venció; revise el cronograma para calcular el plazo restante.' : 'El horizonte calculado excede el límite de la proyección.';
  const costWarning = costError ? 'No se pudieron cargar los costos reales. Reintente la carga antes de calcular costos.' : !(actualCost>0) ? 'Aún no hay costos reales aprobados al corte. La proyección de plazo sí está disponible; el costo al término y el flujo se habilitarán al registrar costos.' : !(progress>0) ? 'Falta avance real para estimar el costo al término.' : '';
  return { spi,cpi,baseCost,finish,duration,cashflow,calendarWarning,scheduleWarning,costWarning,
    delay: finish ? daysBetween(baselineFinish,finish) : null,
    overrun:baseCost==null || !(costBudget>0)?null:Math.max(0,baseCost-costBudget),
    milestoneRisk:spi==null?'Sin base':spi<.9?'Alto':spi<1?'Medio':'Bajo',
    scenarios:[{name:'Continuidad del ritmo actual',finish,cost:baseCost,tone:'blue'}] };
}
