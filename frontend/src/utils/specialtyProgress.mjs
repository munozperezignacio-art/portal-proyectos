// Keep the statistics release independent of the journal's offline write machinery.
function pileDiagram(elements, completedIds) {
  const usable = elements.filter(e => e.este != null && e.norte != null && Number.isFinite(Number(e.este)) && Number.isFinite(Number(e.norte)));
  if (!usable.length) return [];
  const xs = usable.map(e => Number(e.este)), ys = usable.map(e => Number(e.norte));
  const minX = Math.min(...xs), maxY = Math.max(...ys);
  const scale = Math.min(560 / Math.max(1, Math.max(...xs) - minX), 360 / Math.max(1, maxY - Math.min(...ys)));
  const done = new Set(completedIds);
  return usable.map(e => ({...e, x:20 + (Number(e.este) - minX) * scale, y:20 + (maxY - Number(e.norte)) * scale, status:done.has(e.id) ? 'done' : 'pending'}));
}

export function specialtyProgress(state, partIds, cutoff) {
  const allowed = new Set(partIds.map(String));
  const completed = new Map();
  for (const session of state.sessions || []) {
    if (!['cerrada', 'historica'].includes(session.estado) || session.fecha > cutoff) continue;
    for (const pile of session.datos?.pilas || []) {
      if (pile.terminada) completed.set(pile.element_id, session.fecha);
    }
  }
  const elements = (state.elements || []).filter(e => allowed.has(String(e.partida_id)));
  // Current claims are not evidence of completion at a historical cutoff.
  const points = pileDiagram(elements, [...completed.keys()]);
  return points.map(p => ({...p, completedOn: completed.get(p.id) || null}));
}
