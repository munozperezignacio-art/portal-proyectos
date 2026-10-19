export const assignmentToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
const clean = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function workerMatchesSearch(worker, query) {
  const search = clean(query), compact = search.replace(/[.\-\s]/g, '');
  return !search || [worker.nombre, worker.cargo, worker.banco].some(value => clean(value).includes(search)) || (compact && clean(worker.rut).replace(/[.\-\s]/g, '').includes(compact));
}
export function toggleVisibleWorkers(selected, visible) {
  const ids = visible.map(worker => String(worker.id));
  return ids.length && ids.every(id => selected.includes(id)) ? selected.filter(id => !ids.includes(id)) : [...new Set([...selected, ...ids])];
}
export function assignmentIssue(worker, date) {
  if (worker.fecha_inicio_contrato && date < worker.fecha_inicio_contrato) return `Ingreso contractual: ${worker.fecha_inicio_contrato}`;
  if (worker.fecha_vencimiento_contrato && date > worker.fecha_vencimiento_contrato) return `Contrato terminado: ${worker.fecha_vencimiento_contrato}`;
  return '';
}
