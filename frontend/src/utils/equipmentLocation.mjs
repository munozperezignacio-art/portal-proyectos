// The warehouse is represented by NULL, never by its display label.
export function equipmentLocationFields(original, form) {
  const work = form.obra_nombre || null;
  const date = work ? form.fecha_asig || null : null;
  if (!original || work !== (original.obra_nombre || null)) {
    return { obra_nombre: work, fecha_asig: date };
  }
  return work && date !== (original.fecha_asig || null) ? { fecha_asig: date } : {};
}
