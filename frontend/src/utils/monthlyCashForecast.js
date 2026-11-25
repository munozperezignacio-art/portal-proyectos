import { matchesWorkReport } from './workReportCalculations.js';

export const shiftDay = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const validDay = day => /^\d{4}-\d{2}-\d{2}$/.test(day || '') && Number.isFinite(Date.parse(`${day}T12:00:00Z`));
const reportDay = r => String(r.fecha || r.fecha_avance || r.created_at || '').slice(0, 10);

// Read-only forecast. Production is valued once; payment certificates are not added again.
export function monthlyCashForecast({ parts, reports, cutoff, marginRatio, isBusinessDay, currencyRate = 1 }) {
  if (!validDay(cutoff)) throw new Error('Fecha de corte inválida');
  const months = new Map(), warnings = [];
  const add = (date, amount, actual) => {
    const key = date.slice(0, 7);
    if (!months.has(key)) months.set(key, { key, ingreso: 0, ejecutado: 0 });
    const row = months.get(key);
    row.ingreso += amount;
    if (actual) row.ejecutado += amount;
  };
  const recent = [];
  for (let d = shiftDay(cutoff, -1), guard = 0; recent.length < 5 && guard < 366; d = shiftDay(d, -1), guard++) {
    if (isBusinessDay(d)) recent.push(d);
  }
  for (const p of parts.filter(p => !p.es_titulo && !['TITULO', 'GRUPO'].includes(p.unidad))) {
    const quantity = Math.max(0, Number(p.cantidad ?? p.cantidad_presupuestada) || 0);
    const price = (Number(p.pu ?? p.costo_por_dia) || 0) * currencyRate;
    const start = String(p.scheduledStart || p.fecha_inicio || '').slice(0,10);
    if (!validDay(start)) { warnings.push(`${p.partida}: falta fecha de programación`); continue; }
    const duration = Math.max(1, Number(p.duracion_programada) || Math.ceil(quantity / (Number(p.rendimiento_meta || p.rendimiento) || 10)));
    const plannedRate = quantity / duration;
    const own = reports.filter(r => matchesWorkReport(r,p) && validDay(reportDay(r)) && reportDay(r) <= cutoff).sort((a,b) => reportDay(a).localeCompare(reportDay(b)));
    let remaining = quantity;
    for (const r of own) {
      const amount = Math.min(remaining, Math.max(0, Number(r.cantidad) || 0));
      add(reportDay(r), amount * price, true);
      remaining -= amount;
    }
    const window = recent.filter(d => d >= start);
    const recentQuantity = own.filter(r => window.includes(reportDay(r))).reduce((sum,r) => sum + Math.max(0, Number(r.cantidad) || 0), 0);
    // An unstarted item uses the programme; an active item includes zero-report days.
    const rate = own.length && window.length ? recentQuantity / window.length : plannedRate;
    if (remaining > 0 && rate <= 0) { warnings.push(`${p.partida}: sin producción en los últimos cinco días laborables; saldo sin fecha estimable`); continue; }
    let date = start > cutoff ? start : shiftDay(cutoff, 1);
    for (let guard = 0; remaining > 0.0000001 && guard < 3660; date = shiftDay(date,1), guard++) {
      if (!isBusinessDay(date)) continue;
      const amount = Math.min(remaining, rate);
      add(date, amount * price, false);
      remaining -= amount;
    }
    if (remaining > 0.0000001) warnings.push(`${p.partida}: saldo fuera del horizonte de diez años`);
  }
  const keys = [...months.keys(), cutoff.slice(0,7)].sort();
  let accumulated = 0;
  const rows = [];
  for (let key = keys[0]; key <= keys.at(-1);) {
    const next = new Date(`${key}-01T12:00:00Z`); next.setUTCMonth(next.getUTCMonth()+1);
    const close = shiftDay(next.toISOString().slice(0,10), -1);
    const row = months.get(key) || { key, ingreso:0, ejecutado:0 };
    const egreso = Number.isFinite(marginRatio) ? row.ingreso * (1-marginRatio) : null;
    const flujo = egreso == null ? null : row.ingreso-egreso;
    accumulated = flujo == null || accumulated == null ? null : accumulated+flujo;
    rows.push({...row, close, egreso, flujo, accumulated});
    key = next.toISOString().slice(0,7);
  }
  return {rows, warnings, recent};
}
