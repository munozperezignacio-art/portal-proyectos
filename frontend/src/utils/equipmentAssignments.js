const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const hasAssignedWork = value => !['', 'bodega central / libre', 'bodega central', 'bodega / sin asignar', 'libre', 'sin asignar'].includes(normalized(value));
export function operationalStatus(equipment) {
  const status = normalized(equipment.estado_equipo);
  if (/mantencion|mantenimiento/.test(status)) return 'Mantención';
  if (/paraliz|fuera de servicio|inoperativ/.test(status)) return 'Paralizado';
  return equipment.estado_equipo || 'Operativo';
}
export function assignmentConflicts(equipmentIds, bookings, start, end) {
  const ids = new Set(equipmentIds.map(String));
  return bookings.filter(r => ids.has(String(r.equipo_id)) && !['cancelada','cancelado','anulado','anulada','finalizado','finalizada'].includes(normalized(r.estado)) && r.fecha_inicio && (!end || r.fecha_inicio <= end) && (!r.fecha_fin || r.fecha_fin >= start));
}
export function filterAssignments(equipment, { search = '', work = '', availability = '', operational = '' }, rentedIds = []) {
  const text = normalized(search);
  return equipment.filter(e => (!text || normalized(`${e.patente} ${e.tipo} ${e.marca}`).includes(text))
    && (!work || (work === '__bodega' ? !hasAssignedWork(e.obra_nombre) : e.obra_nombre === work))
    && (!availability || (availability === 'asignado' ? hasAssignedWork(e.obra_nombre) : !hasAssignedWork(e.obra_nombre) && !rentedIds.includes(String(e.id)) && operationalStatus(e) === 'Operativo'))
    && (!operational || operationalStatus(e) === operational));
}
