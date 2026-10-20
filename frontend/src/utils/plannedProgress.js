// Receives dates already resolved by the schedule (including dependencies).
export function physicalProgressAt({ quantity, executed, start, duration }, date, businessDays) {
  const total = Math.max(0, Number(quantity) || 0);
  const actual = Number(executed) || 0;
  const hasPlan = Boolean(start && date && Number(duration) > 0 && total > 0);
  const fraction = hasPlan ? (start > date ? 0 : Math.max(0, Math.min(1, businessDays(start, date) / duration))) : null;
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
    const duration = Math.max(1, Number(item.duration) || 1);
    const fraction = Math.max(0, Math.min(1, businessDays(item.start, date) / duration));
    return sum + Math.round(item.quantity * item.unitPrice * fraction);
  }, 0);
}
