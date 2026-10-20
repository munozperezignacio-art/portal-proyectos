// Receives dates already resolved by the schedule (including dependencies).
export function dailyBudgetRate(part) {
  const unit = String(part.unidad_tiempo || 'Día').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rate = Number(part.rendimiento_meta || part.rendimiento);
  return unit === 'dia' && rate > 0 ? rate : null;
}

export function physicalProgressAt({ quantity, executed, start, duration, dailyRate }, date, businessDays) {
  const total = Math.max(0, Number(quantity) || 0);
  const actual = Number(executed) || 0;
  const rate = Number(dailyRate) > 0 ? Number(dailyRate) : (Number(duration) > 0 ? total / Number(duration) : 0);
  const hasPlan = Boolean(start && date && rate > 0 && total > 0);
  const fraction = hasPlan ? (start > date ? 0 : Math.max(0, Math.min(1, businessDays(start, date) * rate / total))) : null;
  const planned = fraction === null ? null : total * fraction;
  return {
    actualPct: total > 0 ? actual / total * 100 : null,
    planned, plannedPct: fraction === null ? null : fraction * 100,
    difference: planned === null ? null : actual - planned,
    differencePct: planned === null ? null : (actual - planned) / total * 100,
    planCompliance: planned > 0 ? actual / planned * 100 : null,
    remaining: Math.max(0, total - actual),
    excess: Math.max(0, actual - total),
  };
}

export function plannedValueAt(items, date, businessDays) {
  return items.reduce((sum, item) => {
    if (!item.start || item.start > date) return sum;
    const { planned } = physicalProgressAt({ ...item, duration: Math.max(1, Number(item.duration) || 1) }, date, businessDays);
    return sum + Math.round((planned || 0) * item.unitPrice);
  }, 0);
}
