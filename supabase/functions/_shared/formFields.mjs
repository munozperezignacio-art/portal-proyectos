export const WORK_COLUMNS = [
  { key: 'nombre', label: 'Obra' },
  { key: 'admin_contrato', label: 'Administrador' },
  { key: 'ubicacion', label: 'Ubicación' },
  { key: 'oficina_tecnica', label: 'Oficina técnica' },
  { key: 'cliente', label: 'Mandante' },
  { key: 'prevencionista', label: 'Prevencionista' },
  { key: 'tipo', label: 'Especialidad' }
];

export function workCatalog(field, works) {
  const allowed = new Set(WORK_COLUMNS.map(column => column.key));
  const keys = ['nombre', ...(field.autofillKeys || [])].filter(key => allowed.has(key));
  return works.map(work => ({
    _id: String(work.id), _display: work.nombre,
    obra_id: work.id, centro_gestion_id: work.centro_gestion_id,
    ...Object.fromEntries(keys.map(key => [key, work[key] ?? '']))
  }));
}

// Shared by the public UI and the server: required controls cannot be bypassed.
export function validateFormAnswers(fields, answers) {
  const errors = [];
  for (const field of fields) {
    const value = answers?.[field.id];
    const empty = value == null || value === '' || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
    const fail = message => errors.push(`${field.label || 'Campo'}: ${message}`);
    if (empty) { if (field.required) fail('es obligatorio.'); continue; }
    switch (field.type) {
      case 'text': case 'textarea':
        if (typeof value !== 'string' && typeof value !== 'number') fail('texto inválido.');
        break;
      case 'date': {
        const date = new Date(`${value}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('usa una fecha válida.');
        break;
      }
      case 'time':
        if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) fail('usa una hora válida.');
        break;
      case 'select': case 'radio':
        if (!(field.options || []).includes(value)) fail('selecciona una alternativa válida.');
        break;
      case 'checkbox':
        if (!Array.isArray(value) || value.some(item => !(field.options || []).includes(item))) fail('selecciona alternativas válidas.');
        break;
      case 'status_switch':
        if (!['Cumple', 'No Cumple', 'N/A'].includes(value)) fail('selecciona un estado válido.');
        break;
      case 'rating':
        if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > (Number(field.maxRating) || 5)) fail('valor fuera de la escala.');
        break;
      case 'photo': case 'signature':
        if (typeof value !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) fail('imagen o firma inválida.');
        break;
      case 'data_lookup':
        if (typeof value !== 'object' || !value._id) fail('selecciona un registro.');
        break;
      case 'repeater':
        if (!Array.isArray(value)) fail('grupo inválido.');
        else value.forEach((row, index) => {
          const children = field.subFields || [];
          const hasValue = row && Object.values(row).some(item => item != null && item !== '' && (!Array.isArray(item) || item.length));
          if (field.required && !hasValue) fail(`completa el registro ${index + 1}.`);
          errors.push(...validateFormAnswers(children, row).map(error => `${field.label} #${index + 1} · ${error}`));
        });
        break;
      default: fail('tipo de campo no compatible.');
    }
  }
  return errors;
}
