const GROUP_TYPES = new Set(['CAPITULO', 'SUBCAPITULO']);

export const normalizeBudgetItemType = value => {
  const normalized = String(value || '').trim().toUpperCase().replace(/Í/g, 'I');
  if (['TITULO', 'CAPITULO', 'CAPÍTULO'].includes(normalized)) return 'CAPITULO';
  if (['SUBCAPITULO', 'SUBCAPÍTULO', 'GRUPO'].includes(normalized)) return 'SUBCAPITULO';
  return 'PARTIDA';
};

export const isBudgetGroup = item => {
  if (!item) return false;
  if (GROUP_TYPES.has(normalizeBudgetItemType(item.tipo_item))) return true;
  return Boolean(item.es_titulo) || ['TITULO', 'GRUPO', 'CAPITULO'].includes(String(item.unidad || '').toUpperCase());
};

const codeParent = (code, knownCodes) => {
  const segments = String(code || '').split('.');
  while (segments.length > 1) {
    segments.pop();
    const candidate = segments.join('.');
    if (knownCodes.has(candidate)) return candidate;
  }
  return '';
};

export const buildBudgetHierarchy = rows => {
  const knownGroups = new Set();
  const groupStack = [];
  return rows.map((source, index) => {
    const tipo_item = normalizeBudgetItemType(source.tipo_item || source.TIPO_FILA);
    const codigo = String(source.codigo || source.CODIGO || '').trim();
    const requestedLevel = Number(source.nivel ?? source.NIVEL);
    let parent_codigo = String(source.parent_codigo || source.CODIGO_PADRE || '').trim();

    if (!parent_codigo) parent_codigo = codeParent(codigo, knownGroups);
    if (!parent_codigo && groupStack.length) {
      if (tipo_item === 'CAPITULO') groupStack.length = 0;
      else if (Number.isFinite(requestedLevel) && requestedLevel > 0) parent_codigo = groupStack[requestedLevel - 1] || '';
      else parent_codigo = groupStack[groupStack.length - 1] || '';
    }

    let nivel = parent_codigo ? Math.max(1, Number.isFinite(requestedLevel) ? requestedLevel : groupStack.indexOf(parent_codigo) + 1) : 0;
    if (tipo_item === 'CAPITULO') { parent_codigo = ''; nivel = 0; }
    if (tipo_item === 'SUBCAPITULO' && !parent_codigo && groupStack.length) {
      parent_codigo = groupStack[groupStack.length - 1];
      nivel = groupStack.length;
    }

    if (GROUP_TYPES.has(tipo_item)) {
      knownGroups.add(codigo);
      groupStack.splice(nivel, groupStack.length - nivel, codigo);
    }
    return { ...source, tipo_item, parent_codigo, nivel, orden: index, es_titulo: tipo_item !== 'PARTIDA' };
  });
};

export const getBudgetGroupTotal = (group, rows, factor = 1) => {
  const groupId = String(group?.id ?? '');
  const groupCode = String(group?.codigo ?? '');
  const descendants = new Set([groupId]);
  let changed = true;
  while (changed) {
    changed = false;
    rows.forEach(item => {
      const parentId = String(item.parent_id ?? '');
      if (parentId && descendants.has(parentId) && !descendants.has(String(item.id))) {
        descendants.add(String(item.id)); changed = true;
      }
    });
  }
  return rows.reduce((sum, item) => {
    if (isBudgetGroup(item)) return sum;
    const explicitChild = descendants.has(String(item.parent_id ?? ''));
    const legacyChild = groupCode && String(item.codigo || '').startsWith(`${groupCode}.`);
    return explicitChild || legacyChild
      ? sum + (Number(item.cantidad) || 0) * (Number(item.costo_unitario) || 0) * factor
      : sum;
  }, 0);
};
