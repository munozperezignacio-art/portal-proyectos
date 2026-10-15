// Receives dates already resolved by the schedule (including dependencies).
export function plannedValueAt(items, date, businessDays) {
  return items.reduce((sum, item) => {
    if (!item.start || item.start > date) return sum;
    const duration = Math.max(1, Number(item.duration) || 1);
    const fraction = Math.max(0, Math.min(1, businessDays(item.start, date) / duration));
    return sum + Math.round(item.quantity * item.unitPrice * fraction);
  }, 0);
}
