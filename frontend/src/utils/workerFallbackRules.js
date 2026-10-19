const clean = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const fallbackToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
export const emptyFallbackRule = () => ({ centro_gestion_id: '', fecha_desde: fallbackToday(), fecha_hasta: '', dias_semana: [1,2,3,4,5], modo_he: 'sin', horas_extra_diarias: '', activa: true });

export function fallbackRuleState(rule, date = fallbackToday()) {
  if (!rule) return { key: 'sin', label: 'Sin regla', current: false };
  if (!rule.activa) return { key: 'inactiva', label: 'Desactivada', current: false };
  if (rule.fecha_desde > date) return { key: 'futura', label: `Desde ${rule.fecha_desde}`, current: false };
  if (rule.fecha_hasta && rule.fecha_hasta < date) return { key: 'vencida', label: 'Vencida', current: false };
  return { key: 'activa', label: 'Activa', current: true };
}

export function fallbackWorkerRows(personal, rules, { company, search = '', filter = 'sin', today } = {}) {
  const ruleMap = new Map(rules.filter(rule => rule.empresa === company).map(rule => [String(rule.trabajador_id), rule]));
  const query = clean(search), compactQuery = query.replace(/[.\-\s]/g, '');
  return personal.filter(worker => worker.empresa === company).map(worker => {
    const rule = ruleMap.get(String(worker.id)), status = fallbackRuleState(rule, today);
    return { worker, rule, status };
  }).filter(({worker, rule, status}) => {
    const match = !query || clean(worker.nombre).includes(query) || (compactQuery && clean(worker.rut).replace(/[.\-\s]/g, '').includes(compactQuery));
    return match && (filter === 'todas' || (filter === 'sin' ? !rule : filter === 'sin_vigente' ? !status.current : filter === 'con' ? Boolean(rule) : status.key === filter));
  }).sort((a,b) => a.worker.nombre.localeCompare(b.worker.nombre, 'es', { sensitivity: 'base' }));
}

export function fallbackRuleArgs({ company, selected, form, replace = false }) {
  const ids = [...new Set(selected.map(Number))].sort((a,b) => a-b);
  if (!ids.length || ids.length > 500 || ids.some(id => !Number.isInteger(id) || id <= 0)) throw new Error('Selecciona entre 1 y 500 trabajadores.');
  if (!Number.isInteger(Number(form.centro_gestion_id)) || Number(form.centro_gestion_id) <= 0) throw new Error('Selecciona un centro de gestión.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha_desde)) throw new Error('Indica la fecha de inicio.');
  if (form.fecha_hasta && form.fecha_hasta < form.fecha_desde) throw new Error('La fecha de término no puede ser anterior al inicio.');
  const days = [...new Set(form.dias_semana)].sort((a,b) => a-b);
  if (!days.length || days.some(day => !Number.isInteger(day) || day < 1 || day > 7)) throw new Error('Selecciona los días aplicables.');
  const hours = form.modo_he === 'con' ? Number(form.horas_extra_diarias) : 0;
  if (!['sin','con'].includes(form.modo_he) || !Number.isFinite(hours) || hours < 0 || hours > 24 || (form.modo_he === 'con' && hours === 0)) throw new Error('Indica las horas extra diarias: mayor que 0 y hasta 24.');
  return { p_empresa: company, p_trabajadores: ids, p_centro: Number(form.centro_gestion_id), p_desde: form.fecha_desde, p_hasta: form.fecha_hasta || null,
    p_dias: days, p_horas_extra: hours, p_activa: Boolean(form.activa), p_reemplazar: replace };
}
