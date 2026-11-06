const number = value => Number(value) || 0;
export function filterCostGroups(groups, category) {
  if (!category) return groups;
  return groups.map(group => {
    const rows = group.rows.filter(row => row.category === category);
    return { ...group, rows, total: rows.reduce((sum, row) => sum + row.allocated, 0) };
  }).filter(group => group.rows.length > 0);
}
export function costCategory(row) {
  const label = row.categoria_proyeccion || row.tipo_costo || 'Otros gastos';
  if (/mano de obra|personal/i.test(label)) return 'Personal';
  if (/maquinaria|equipos|mantenciones/i.test(label) && !/traslado/i.test(label)) return 'Equipos y maquinarias';
  return label;
}

// Inputs are already restricted to the cutoff date and selected work.
export function costDistribution(records, parts, matches, global = true) {
  const categories = new Map();
  const groups = parts.filter(p => !p.es_titulo).map(p => ({ name: p.partida, rows: [], total: 0 }));
  const unassigned = { name: 'Sin imputar a partidas', rows: [], total: 0 };
  const pendingApproval = { name: 'Personal pendiente de aprobación · Sin reporte de avance', rows: [], total: 0 };
  let total = 0;
  for (const record of records) {
    const amount = number(record.monto);
    const category = costCategory(record);
    total += amount;
    categories.set(category, (categories.get(category) || 0) + amount);
    let allocated = 0;
    for (const group of groups) {
      const labor = Array.isArray(record.obra_liquidaciones_partidas);
      const links = labor ? record.obra_liquidaciones_partidas : record.imputaciones || [];
      const matching = links.filter(link => (!labor || link.partida_id != null) && matches(link.partida, group.name));
      const value = labor
        ? matching.reduce((sum, link) => sum + number(link.monto_imputado), 0)
        : matching.length ? Math.round(number(record.monto_base ?? record.monto) * number(matching[0].porcentaje) / 100) : 0;
      if (value !== 0) {
        group.rows.push({ ...record, category, allocated: value, allocationFactor: labor ? matching[0]?.factor : undefined, allocationReason: labor ? matching[0]?.criterio : undefined });
        group.total += value;
        allocated += value;
      }
    }
    if (global && Math.abs(amount - allocated) > 0.01) {
      const destination = record.estado_imputacion_partidas === 'Pendiente de aprobación: sin reporte de avance' ? pendingApproval : unassigned;
      destination.rows.push({ ...record, category, allocated: amount - allocated });
      destination.total += amount - allocated;
    }
  }
  if (global) groups.push(unassigned);
  if (global && pendingApproval.rows.length) groups.push(pendingApproval);
  return { total, categories: [...categories].map(([name, value]) => ({ name, value })).filter(c => c.value !== 0).sort((a,b) => b.value-a.value), groups };
}
