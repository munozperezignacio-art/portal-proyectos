export const rutKey = value => String(value ?? '').replace(/[^0-9kK]/g, '').toUpperCase();

export async function readPages(makeQuery) {
  const result = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await makeQuery().range(offset, offset + 499);
    if (error) throw new Error('No se pudo verificar la asignación. Intenta nuevamente.');
    result.push(...(data || []));
    if (!data || data.length < 500) return result;
  }
}

// A period already started is authoritative, including transfers and unassigned periods.
// Future periods must not revoke today's legacy assignment.
export function assignedOn(worker, periods, work, day) {
  if (worker.empresa !== work.empresa || worker.estado !== 'Activo') return false;
  const started = periods.filter(p => p.empresa === work.empresa
    && String(p.trabajador_id) === String(worker.id) && p.fecha_inicio <= day);
  if (started.length) {
    const current = started.filter(p => !p.fecha_termino || p.fecha_termino >= day);
    return current.length === 1 && current[0].obra_nombre === work.nombre;
  }
  return worker.obra_nombre === work.nombre && (!worker.fecha_asig || worker.fecha_asig <= day);
}

export async function lookupWorker(db, work, input, day) {
  const key = rutKey(input);
  // Digits are the only query characters; separators may vary in stored legacy RUTs.
  const candidates = await readPages(() => db.from('maestro_personal')
    .select('id,empresa,nombre,rut,cargo,estado,obra_nombre,fecha_asig')
    .eq('empresa', work.empresa).ilike('rut', `%${key.split('').join('%')}%`).order('id'));
  const matches = candidates.filter(w => rutKey(w.rut) === key && w.estado === 'Activo');
  if (matches.length !== 1) return null;
  const worker = matches[0];
  const periods = await readPages(() => db.from('rrhh_asignaciones_personal')
    .select('id,empresa,trabajador_id,obra_nombre,fecha_inicio,fecha_termino')
    .eq('empresa', work.empresa).eq('trabajador_id', worker.id).order('id'));
  return assignedOn(worker, periods, work, day) ? worker : null;
}
