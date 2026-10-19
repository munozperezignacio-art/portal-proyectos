import { cleanRut, validateRut } from './rutUtils.js';

export const REQUIRED_WORKER_FIELDS = ['rut', 'nombre', 'cargo'];
export const WORKER_FIELDS = {
  rut: ['rut', 'run', 'rut trabajador'], nombre: ['nombre', 'nombre completo', 'trabajador'], cargo: ['cargo', 'puesto', 'funcion'],
  fono: ['fono', 'telefono', 'celular'], email: ['email', 'correo', 'correo electronico'],
  obra_nombre: ['obra', 'obra asignada', 'proyecto', 'faena'], fecha_asig: ['fecha asignacion', 'fecha de asignacion'],
  centro_trabajo: ['centro de trabajo', 'centro trabajo'], area: ['area', 'departamento'],
  sueldo_base: ['sueldo base', 'sueldo', 'remuneracion base'], tipo_contrato: ['tipo contrato', 'tipo de contrato', 'contrato'],
  fecha_inicio_contrato: ['fecha ingreso', 'fecha de ingreso', 'inicio contrato', 'fecha inicio contrato'],
  fecha_vencimiento_contrato: ['fecha termino', 'fecha de termino', 'fecha termino contrato', 'vencimiento contrato', 'fecha vencimiento contrato'],
  causal_termino_contrato: ['causal de termino', 'causal termino', 'causal termino contrato'],
  banco: ['banco'], tipo_cuenta: ['tipo cuenta', 'tipo de cuenta'], numero_cuenta: ['numero cuenta', 'n cuenta', 'cuenta bancaria'],
  afp: ['afp'], prevision_salud: ['salud', 'prevision salud', 'prevision de salud'], colacion: ['colacion'], movilizacion: ['movilizacion']
};
export const cleanWorkerText = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const WORKER_CAUSES = { '159i2': 'Renuncia voluntaria', '159i4': 'Vencimiento del plazo convenido', '159i5': 'Conclusión del trabajo o servicio' };

export function parseWorkerDate(value) {
  if (value === '' || value == null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1 || value > 1096000) return '';
    value = new Date(Math.round((value - 25569) * 86400000));
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const text = String(value).trim();
  let match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) match = [null, match[3], match[2], match[1]];
  else match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return '';
  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? '' : date;
}

export function readWorkerMatrix(matrix) {
  const headerIndex = matrix.slice(0, 20).findIndex(row => {
    const fields = row.map(header => Object.keys(WORKER_FIELDS).find(key => WORKER_FIELDS[key].includes(cleanWorkerText(header))));
    return REQUIRED_WORKER_FIELDS.every(field => fields.includes(field));
  });
  if (headerIndex < 0) throw new Error('No se encontró una fila de encabezados con RUT, Nombre y Cargo en las primeras 20 filas.');
  // Preserve column positions, including blank headers between populated columns.
  const columns = matrix[headerIndex].map((value, index) => ({ name: String(value ?? '').trim(), index })).filter(column => column.name);
  if (new Set(columns.map(column => cleanWorkerText(column.name))).size !== columns.length) throw new Error('Hay encabezados repetidos. Renombra las columnas antes de importar.');
  const headers = columns.map(column => column.name), mapping = {};
  for (const header of headers) {
    const field = Object.keys(WORKER_FIELDS).find(key => WORKER_FIELDS[key].includes(cleanWorkerText(header)));
    if (field && !mapping[field]) mapping[field] = header;
  }
  const rows = matrix.slice(headerIndex + 1).map((values, index) => ({ row: headerIndex + index + 2, values: Object.fromEntries(columns.map(column => [column.name, values[column.index] ?? ''])) }))
    .filter(source => Object.values(source.values).some(value => String(value).trim()));
  return { headers, mapping, rows };
}

function amount(value) {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : NaN;
}

export function workerContractSummary(worker, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())) {
  const end = worker.fecha_vencimiento_contrato, cause = worker.causal_termino_contrato;
  if (cause === '159i2' && end) return `${end <= today ? 'Renuncia efectiva' : 'Renuncia programada'}: ${end}`;
  if (worker.fecha_inicio_contrato > today) return `Ingreso futuro: ${worker.fecha_inicio_contrato}`;
  if (end) return `${end < today ? 'Término informado' : 'Término previsto'}: ${end}${cause ? ` · ${WORKER_CAUSES[cause] || cause}` : ''}`;
  return worker.tipo_contrato === 'Indefinido' ? 'Indefinido · sin fecha de término' : 'Sin fecha de término informada';
}

export function validateWorkerRows({ rows, mapping, company, existing = [], works = [], today }) {
  const existingKeys = new Set(existing.filter(worker => worker.empresa === company).map(worker => cleanRut(worker.rut)));
  const workMap = new Map(works.map(work => [cleanWorkerText(work.nombre), work.nombre]));
  const counts = new Map();
  for (const source of rows) { const key = cleanRut(source.values[mapping.rut]); counts.set(key, (counts.get(key) || 0) + 1); }
  return rows.map(source => {
    const get = field => mapping[field] ? source.values[mapping[field]] : '';
    const compact = cleanRut(get('rut')), errors = [], warnings = [];
    const data = { empresa: company, rut: compact.length > 1 ? `${compact.slice(0, -1)}-${compact.slice(-1)}` : compact,
      nombre: String(get('nombre') || '').trim().replace(/\s+/g, ' '), cargo: String(get('cargo') || '').trim() };
    const exists = existingKeys.has(compact);
    // Existing rows are always omitted, even if their incoming details are incomplete.
    if (exists) return { ...source, data, existing: true, errors, warnings: ['Ya existe: no se modificará su ficha'] };
    if (!validateRut(compact)) errors.push('RUT inválido');
    if (counts.get(compact) > 1) errors.push('RUT repetido en el archivo: revisar ambas filas');
    if (!data.nombre) errors.push('Falta nombre');
    if (!data.cargo) errors.push('Falta cargo');
    for (const field of ['fono', 'email', 'centro_trabajo', 'area', 'banco', 'tipo_cuenta', 'numero_cuenta', 'afp', 'prevision_salud']) data[field] = String(get(field) ?? '').trim() || null;
    if (data.email) { data.email = data.email.toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Correo inválido'); }
    const work = String(get('obra_nombre') || '').trim();
    data.obra_nombre = !work || ['sin asignar', 'no asignado', 'ninguna'].includes(cleanWorkerText(work)) ? null : workMap.get(cleanWorkerText(work));
    if (work && data.obra_nombre === undefined) errors.push('Obra inexistente en la empresa');
    for (const field of ['fecha_asig', 'fecha_inicio_contrato', 'fecha_vencimiento_contrato']) {
      data[field] = parseWorkerDate(get(field)) || null;
      if (get(field) !== '' && get(field) != null && !data[field]) errors.push(`Fecha inválida: ${field.replaceAll('_', ' ')}`);
    }
    const rawCause = cleanWorkerText(get('causal_termino_contrato')).replaceAll(' ', '');
    data.causal_termino_contrato = ['sindefinir', ''].includes(rawCause) ? null : rawCause;
    if (data.causal_termino_contrato && !WORKER_CAUSES[data.causal_termino_contrato]) errors.push('Causal no reconocida: use 159i2, 159i4, 159i5 o sinDefinir');
    const type = cleanWorkerText(get('tipo_contrato'));
    const contractTypes = { indefinido: 'Indefinido', 'plazo fijo': 'Plazo Fijo', 'por obra o faena': 'Por Obra o Faena', 'no informado': 'No informado' };
    if (type && !contractTypes[type]) errors.push('Tipo de contrato no reconocido');
    if (data.fecha_vencimiento_contrato?.startsWith('3000-')) {
      if (type && type !== 'indefinido') errors.push('Año 3000 significa indefinido: contradice el tipo de contrato');
      if (data.causal_termino_contrato) errors.push('Contrato indefinido con fecha ficticia y causal de término: revisar');
      data.fecha_vencimiento_contrato = null; data.tipo_contrato = 'Indefinido';
      warnings.push('Año 3000 → Indefinido, sin fecha de término');
    } else {
      data.tipo_contrato = contractTypes[type] || (rawCause === '159i4' ? 'Plazo Fijo' : rawCause === '159i5' ? 'Por Obra o Faena' : 'No informado');
      if (!type && !['159i4', '159i5'].includes(rawCause)) warnings.push('Tipo de contrato no informado: revisar ficha');
    }
    if (data.tipo_contrato === 'Indefinido' && data.fecha_vencimiento_contrato && !data.causal_termino_contrato) errors.push('Contrato indefinido con vencimiento: revisar');
    if (data.causal_termino_contrato && !data.fecha_vencimiento_contrato) errors.push('Falta fecha de término para la causal');
    if (data.fecha_inicio_contrato && data.fecha_vencimiento_contrato && data.fecha_vencimiento_contrato < data.fecha_inicio_contrato) errors.push('El término es anterior al ingreso');
    for (const field of ['sueldo_base', 'colacion', 'movilizacion']) { data[field] = amount(get(field)); if (Number.isNaN(data[field])) errors.push(`Monto inválido: ${field}`); }
    warnings.push(workerContractSummary(data, today));
    return { ...source, data, existing: false, errors, warnings };
  });
}
