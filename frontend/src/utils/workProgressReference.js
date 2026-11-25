export function budgetItemForWorkPart(part, items) {
  const matches = items.filter(item => part.presupuesto_item_id != null
    ? String(item.id) === String(part.presupuesto_item_id)
    : String(item.partida).trim().toLowerCase() === String(part.partida).trim().toLowerCase());
  return matches.length === 1 ? matches[0] : null;
}

export async function saveWorkProgressReference(db, budgetId, part, source, parts) {
  if (!budgetId) throw new Error('Vincula primero el presupuesto a esta obra.');
  const result = await db.from('presupuestos_items').select('id,partida,avance_depende_de').eq('presupuesto_id', budgetId);
  if (result.error) throw result.error;
  const target = budgetItemForWorkPart(part, result.data || []);
  const reference = source ? budgetItemForWorkPart(source, result.data || []) : null;
  if (!target || (source && !reference)) throw new Error('La partida debe tener un vínculo único con el presupuesto de la obra.');
  if (source && (String(source.id) === String(part.id) || Number(source.cantidad) <= 0 || Number(part.cantidad) <= 0)) throw new Error('Selecciona otra partida con cantidad positiva.');
  const seen = new Set([String(part.id)]);
  let cursor = source;
  while (cursor) {
    if (seen.has(String(cursor.id))) throw new Error('No se permiten dependencias circulares.');
    seen.add(String(cursor.id));
    cursor = parts.find(p => String(p.id) === String(cursor.avance_depende_de));
  }
  let query = db.from('presupuestos_items').update({avance_depende_de: reference?.id ?? null}).eq('presupuesto_id', budgetId).eq('id', target.id);
  query = target.avance_depende_de == null ? query.is('avance_depende_de', null) : query.eq('avance_depende_de', target.avance_depende_de);
  const saved = await query.select('id,avance_depende_de').single();
  if (saved.error) throw saved.error;
  if (!saved.data || String(saved.data.avance_depende_de ?? '') !== String(reference?.id ?? '')) throw new Error('No se confirmó el guardado. Recarga la obra e inténtalo nuevamente.');
  return saved.data;
}
