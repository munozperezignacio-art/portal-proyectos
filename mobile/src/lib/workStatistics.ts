type Row = Record<string, any>;
const CHILEAN_HOLIDAYS = [
    '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-07', '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25',
    '2025-01-01', '2025-04-18', '2025-04-19', '2025-05-01', '2025-05-21', '2025-06-20', '2025-06-29', '2025-07-16', '2025-08-15', '2025-09-18', '2025-09-19', '2025-10-12', '2025-10-31', '2025-11-01', '2025-12-08', '2025-12-25',
    '2024-01-01', '2024-03-29', '2024-03-30', '2024-05-01', '2024-05-21', '2024-06-20', '2024-06-29', '2024-07-16', '2024-08-15', '2024-09-18', '2024-09-19', '2024-09-20', '2024-10-12', '2024-10-31', '2024-11-01', '2024-12-08', '2024-12-25'
  ];

export const countChileanBusinessDays = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dayOfWeek = cur.getDay(); // 0 = Sunday, 6 = Saturday
      const dateStr = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = CHILEAN_HOLIDAYS.includes(dateStr);

      if (!isWeekend && !isHoliday) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, count);
  };

export const addChileanBusinessDays = (startStr: string, workingDays: number) => {
    if (!startStr) return '';
    const daysToAdd = Math.max(1, Math.round(workingDays));
    let cur = new Date(startStr + 'T00:00:00');
    if (isNaN(cur.getTime())) return startStr;

    let added = 0;
    while (added < daysToAdd) {
      const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
      const dateStr = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = CHILEAN_HOLIDAYS.includes(dateStr);

      if (!isWeekend && !isHoliday) {
        added++;
      }
      if (added < daysToAdd) {
        cur.setDate(cur.getDate() + 1);
      }
    }
    return cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
  };

export const shiftChileanBusinessDays = (startStr: string, workingDays: number) => {
    if (!startStr || !Number.isFinite(Number(workingDays)) || Number(workingDays) === 0) return startStr || '';
    if (workingDays > 0) return addChileanBusinessDays(startStr, workingDays);
    const cur = new Date(`${startStr}T00:00:00`);
    if (isNaN(cur.getTime())) return startStr;
    let shifted = 0;
    while (shifted < Math.abs(Math.round(workingDays))) {
      cur.setDate(cur.getDate() - 1);
      const dateStr = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      if (cur.getDay() !== 0 && cur.getDay() !== 6 && !CHILEAN_HOLIDAYS.includes(dateStr)) shifted++;
    }
    return cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
  };

export const subtractChileanBusinessDays = (endStr: string, workingDays: number) => {
    if (!endStr) return '';
    const daysToSubtract = Math.max(1, Math.round(workingDays));
    let cur = new Date(endStr + 'T00:00:00');
    if (isNaN(cur.getTime())) return endStr;

    let subtracted = 0;
    while (subtracted < daysToSubtract) {
      const dayOfWeek = cur.getDay();
      const dateStr = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = CHILEAN_HOLIDAYS.includes(dateStr);

      if (!isWeekend && !isHoliday) {
        subtracted++;
      }
      if (subtracted < daysToSubtract) {
        cur.setDate(cur.getDate() - 1);
      }
    }
    return cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
  };
const day = (v: any) => String(v || '').slice(0, 10);
export function normalizeParts(listPart: Row[], linkedBudgetItems: Row[], linkedSchedule: Row[], projectStartDate: string) {
 const normalizePlanningText = (v: any) => String(v || '').trim().toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
 const scheduleByCode = new Map(linkedSchedule.map(row => [String(row.codigo || '').trim(), row]));
      const normalizedListPart: Row[] = (listPart || []).map((p: Row) => {
        const isTit = p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo || (p.partida && /^[0-9]\./.test(p.partida.trim()));
        const budgetMatch = linkedBudgetItems.find((item: Row) => normalizePlanningText(item.partida) === normalizePlanningText(p.partida));
        const scheduleMatch = (budgetMatch?.codigo && scheduleByCode.get(String(budgetMatch.codigo).trim()))
          || linkedSchedule.find((row: Row) => normalizePlanningText(row.tarea) === normalizePlanningText(p.partida));
        const predecessorMatch = scheduleMatch?.predecesora
          ? String(scheduleMatch.predecesora).match(/^(.+?)(FC|CC)([+-]\d+)?$/i)
          : null;

        return {
          ...p,
          es_titulo: isTit,
          cantidad: isTit ? 0 : (parseFloat(p.cantidad_presupuestada !== undefined && p.cantidad_presupuestada !== null && p.cantidad_presupuestada !== 0 ? p.cantidad_presupuestada : p.cantidad) || 0),
          pu: isTit ? 0 : (parseFloat(p.costo_por_dia !== undefined && p.costo_por_dia !== null && p.costo_por_dia !== 0 ? p.costo_por_dia : p.pu) || 0),
          rendimiento: p.rendimiento_meta || p.rendimiento || '10',
          // Si aún no existe programación por partida, usar inicio real de la obra; nunca fechas de una obra de prueba.
          fecha_inicio: scheduleMatch?.fecha_inicio || p.fecha_inicio || p.fecha_inicio_programada || projectStartDate,
          fecha_termino: scheduleMatch?.fecha_fin || p.fecha_termino || null,
          duracion_programada: scheduleMatch?.duracion ?? null,
          predecesora: predecessorMatch?.[1] || p.predecesora || null,
          tipo_relacion: predecessorMatch?.[2]?.toUpperCase() === 'CC' ? 'SS' : (p.tipo_relacion || 'FS'),
          desfase_dias: predecessorMatch?.[3] ? parseInt(predecessorMatch[3], 10) : (p.desfase_dias || 0),
          origen_planificacion: scheduleMatch ? 'Presupuesto / archivo importado' : 'Obra'
        };
      });


 const partidasList = normalizedListPart;
 const fInicioObraDefault = projectStartDate;
      const initialItems: Row[] = partidasList.map((p: Row) => {
        const isGroup = p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo;
        const cant = parseFloat(p.cantidad) || 0;
        const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
        const duracionDias = isGroup ? 0 : Math.max(1, parseInt(p.duracion_programada, 10) || Math.ceil(cant / rend));
        const fechaInicio = p.fecha_inicio ? String(p.fecha_inicio).split('T')[0] : fInicioObraDefault;
        const fechaTermino = isGroup ? '' : addChileanBusinessDays(fechaInicio, duracionDias);
        return { ...p, isGroup, cant, rend, duracionDias, fechaInicio, fechaTermino };
      });

      const itemsMap = new Map<string, Row>();
      initialItems.forEach(item => {
        itemsMap.set(String(item.partida || item.id).trim(), { ...item });
      });

      for (let pass = 0; pass < 5; pass++) {
        initialItems.forEach(item => {
          if (item.isGroup) return;
          const curr = itemsMap.get(String(item.partida || item.id).trim());
          if (!curr || !curr.predecesora) return;

          const pred = itemsMap.get(String(curr.predecesora).trim());
          if (!pred) return;

          const relType = curr.tipo_relacion || 'FS';
          const lag = parseInt(curr.desfase_dias || 0, 10) || 0;

          let calcStart = curr.fechaInicio;

          if (relType === 'FS') {
            const predEnd = pred.fechaTermino || pred.fechaInicio;
            const nextBus = addChileanBusinessDays(predEnd, 2);
            calcStart = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(nextBus, lag + 1) : subtractChileanBusinessDays(nextBus, Math.abs(lag) + 1)) : nextBus;
          } else if (relType === 'SS') {
            const predStart = pred.fechaInicio;
            calcStart = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(predStart, lag + 1) : subtractChileanBusinessDays(predStart, Math.abs(lag) + 1)) : predStart;
          } else if (relType === 'FF') {
            const predEnd = pred.fechaTermino;
            const calcEnd = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(predEnd, lag + 1) : subtractChileanBusinessDays(predEnd, Math.abs(lag) + 1)) : predEnd;
            calcStart = subtractChileanBusinessDays(calcEnd, curr.duracionDias);
          } else if (relType === 'SF') {
            const predStart = pred.fechaInicio;
            const calcEnd = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(predStart, lag + 1) : subtractChileanBusinessDays(predStart, Math.abs(lag) + 1)) : predStart;
            calcStart = subtractChileanBusinessDays(calcEnd, curr.duracionDias);
          }

          if (calcStart) {
            curr.fechaInicio = calcStart;
            curr.fechaTermino = addChileanBusinessDays(calcStart, curr.duracionDias);
          }
        });
      }


 return normalizedListPart.map(p => ({...p, baselineStart: day(p.fecha_inicio), fecha_inicio: itemsMap.get(String(p.partida || p.id).trim())?.fechaInicio || p.fecha_inicio}));
}
export function productionMetrics(parts: Row[], reports: Row[], cutoff: string) {
 const matches = (a: any, b: any) => {
  if (!a || !b) return false;
  const x = String(a).trim().toLowerCase(), y = String(b).trim().toLowerCase();
  const nx = x.replace(/[^a-z0-9]/g, ''), ny = y.replace(/[^a-z0-9]/g, '');
  return x === y || !!(nx && ny && (nx.includes(ny) || ny.includes(nx)));
 };
 const advances = reports.filter(r => day(r.fecha || r.fecha_avance || r.created_at) <= cutoff);
 const detail = parts.filter(p => !p.es_titulo && p.unidad !== 'TITULO' && p.unidad !== 'GRUPO').map((p): Row & {done:number;pct:number;duration:number;planned:number;scheduleDays:number;budget:number;earned:number;plannedValue:number} => {
  const quantity = Number(p.cantidad) || 0, price = Number(p.pu) || 0;
  const done = advances.filter(r => matches(r.partida, p.partida)).reduce((sum, r) => sum + (Number(r.cantidad) || 0), 0);
  const pct = quantity > 0 ? Math.min(100, done / quantity * 100) : 0;
  const duration = Math.max(1, parseInt(p.duracion_programada, 10) || Math.ceil(quantity / (Number(p.rendimiento_meta || p.rendimiento) || 10)));
  const fraction = p.fecha_inicio && day(p.fecha_inicio) <= cutoff ? Math.min(1, countChileanBusinessDays(day(p.fecha_inicio), cutoff) / duration) : 0;
  return {...p, done, pct, duration, planned: fraction * 100, scheduleDays: Math.round((pct / 100 - fraction) * duration), budget: Math.round(quantity * price), earned: Math.round(Math.min(quantity, done) * price), plannedValue: Math.round(quantity * price * fraction)};
 });
 const budget = detail.reduce((sum, p) => sum + p.budget, 0);
 const progress = budget > 0 ? Number((detail.reduce((sum, p) => sum + p.earned, 0) / budget * 100).toFixed(1)) : 0;
 const planned = budget > 0 ? detail.reduce((sum, p) => sum + p.plannedValue, 0) / budget * 100 : 0;
 return {detail, progress, planned};
}
