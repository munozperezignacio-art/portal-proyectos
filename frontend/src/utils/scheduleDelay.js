// Working-day offsets retain fractional production delays. Parallel paths use
// maxima, never sums; observed downstream delay already includes upstream loss.
export function scheduleDelay(parts) {
  const rows = parts.map(p => ({ ...p, delay: Math.max(0, Number(p.delay ?? 0)) }));
  const order = [], visiting = new Set(), done = new Set();
  let issue = '';
  function visit(row) {
    if (done.has(row)) return;
    if (visiting.has(row)) { issue = 'Dependencia circular en la programación'; return; }
    visiting.add(row);
    if (![row.start, row.duration, row.delay].every(Number.isFinite) || row.duration <= 0) issue = 'Faltan fechas, duración o rendimiento';
    if (row.predecessor) {
      row.pred = rows.find(p => String(p.id) === String(row.predecessor) || p.name === row.predecessor);
      if (!row.pred) issue = 'Predecesora inexistente o fuera del alcance';
      else visit(row.pred);
      if (!['FS', 'SS', 'FF', 'SF'].includes(row.relation || 'FS') || !Number.isFinite(Number(row.lag || 0))) issue = 'Relación de programación no válida';
    }
    visiting.delete(row); done.add(row); order.push(row);
  }
  rows.forEach(visit);
  if (!rows.length || issue) return { rows: [], delay: null, issue: issue || 'Sin programación' };
  for (const r of order) {
    const relation = r.relation || 'FS';
    r.weight = (relation.startsWith('F') ? r.pred?.duration || 0 : 0) - (relation.endsWith('F') ? r.duration : 0) + Number(r.lag || 0);
    r.early = Math.max(r.start, r.pred ? r.pred.early + r.weight : r.start);
    r.end = r.early + r.duration;
    // Once started, an SS link cannot move the actual start retroactively.
    const upstream = r.pred && !(r.relation === 'SS' && r.started)
      ? (relation.startsWith('S') ? r.pred.forecastStart : r.pred.forecastEnd) - (relation.endsWith('F') ? r.duration : 0) + Number(r.lag || 0) : r.early;
    r.forecastStart = Math.max(r.early, upstream);
    r.forecastEnd = Math.max(r.end + (r.complete ? 0 : r.delay), r.forecastStart + r.duration);
  }
  const finish = Math.max(...rows.map(r => r.end));
  for (const r of [...order].reverse()) {
    const successors = rows.filter(s => s.pred === r);
    r.latest = Math.min(finish - r.duration, ...successors.map(s => s.latest - s.weight));
    r.float = Math.max(0, r.latest - r.early);
    r.critical = r.float < 1e-8;
    r.impact = Math.max(0, r.forecastEnd - r.end - r.float);
  }
  return { rows, finish, delay: Math.max(0, ...rows.map(r => r.forecastEnd - finish)), issue: '' };
}
