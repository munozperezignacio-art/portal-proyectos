export const MATERIAL_UNITS = ['UND', 'KG', 'TON', 'L', 'M', 'M2', 'M3', 'SACO', 'CAJA', 'ROLLO', 'GL'];

export function materialMovement(data) {
  const cantidad = Number(data.cantidad);
  if (!data.material?.trim()) throw Error('Indica el material o insumo.');
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw Error('La cantidad debe ser mayor que cero.');
  if (!MATERIAL_UNITS.includes(data.unidad)) throw Error('Selecciona la unidad de medida.');
  return {material: data.material.trim(), cantidad, unidad: data.unidad};
}
