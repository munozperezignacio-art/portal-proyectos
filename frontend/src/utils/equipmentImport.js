export const equipmentCode = value => String(value ?? '').trim().toUpperCase();
const normalize = value => equipmentCode(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function parseEquipmentCost(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : NaN;
  const text = String(value ?? '').replace(/CLP/gi, '').replace(/[$\s]/g, '');
  if (!/^\d+$/.test(text) && !/^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/.test(text)) return NaN;
  const amount = Number(text.replace(/[.,]/g, ''));
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : NaN;
}
export function parseEquipmentSheet(matrix, existing = []) {
  const aliases = [['codigo', 'patente', 'patente codigo'], ['nombre de equipo', 'nombre del equipo', 'maquinaria', 'equipo'], ['marca'], ['modelo'], ['costo dia 22 dias', 'costo dia', 'costo diario', 'costo diario clp']];
  const headerIndex = matrix.findIndex(row => aliases.slice(0, 2).every(names => row.some(cell => names.includes(normalize(cell)))));
  if (headerIndex < 0) throw new Error('No se encontraron Código y Nombre de equipo (también se acepta Maquinaria).');
  const indexes = aliases.map(names => matrix[headerIndex].findIndex(cell => names.includes(normalize(cell))));
  if (indexes.some(index => index < 0)) throw new Error('Columnas requeridas: Código, Nombre de equipo, Marca, Modelo, Costo Día (22 días).');
  const seen = new Set(); const known = new Set(existing.map(item => equipmentCode(item.patente)));
  return matrix.slice(headerIndex + 1).map((row, i) => {
    const values = indexes.map(index => row[index] ?? '');
    if (values.every(value => String(value).trim() === '')) return null;
    const [code, name, brand, model, cost] = values; const patente = equipmentCode(code); const errors = [];
    if (!patente) errors.push('Falta código');
    if (!String(name).trim()) errors.push('Falta nombre de equipo');
    if (seen.has(patente)) errors.push('Código repetido en la planilla');
    seen.add(patente); const amount = parseEquipmentCost(cost);
    if (!Number.isFinite(amount)) errors.push('Costo diario inválido: use pesos enteros');
    return { row: headerIndex + i + 2, code: patente, name: String(name).trim(), brand: String(brand).trim(), model: String(model).trim(), amount, errors, exists: known.has(patente) };
  }).filter(Boolean);
}
export function equipmentImportPayload(row, company) {
  if (!company || row.errors.length || row.exists) throw new Error('Equipo no válido para importar.');
  return { empresa: company, patente: row.code, tipo: row.name, marca: [row.brand, row.model].filter(Boolean).join(' '), costo_interno: row.amount, unidad_costo_interno: '$/día', obra_nombre: null, fecha_asig: null, tipo_activo: 'Propio', estado_equipo: 'Operativo', modalidad_dias: 'laborales' };
}
