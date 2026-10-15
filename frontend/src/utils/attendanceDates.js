export function chileanAttendanceToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function resolveAttendanceDate(mode, selected, now = new Date()) {
  const today = chileanAttendanceToday(now);
  if (mode !== 'manual') return today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(selected || '') ? new Date(`${selected}T12:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== selected) throw new Error('Selecciona una fecha de marcaje válida.');
  if (selected > today) throw new Error('No puedes registrar asistencia para una fecha futura.');
  return selected;
}
export function attendanceDay(record) {
  if (record.fecha_marcacion || record.fecha) return String(record.fecha_marcacion || record.fecha).slice(0,10);
  if (!record.created_at) return '';
  const created = new Date(record.created_at);
  return Number.isNaN(created.getTime()) ? '' : chileanAttendanceToday(created);
}
export const attendanceDateLabel = record => attendanceDay(record).split('-').reverse().join('/') || 'Sin fecha';
