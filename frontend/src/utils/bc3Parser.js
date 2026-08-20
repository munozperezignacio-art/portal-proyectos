import { buildBudgetHierarchy } from './budgetHierarchy.js';

const clean = value => String(value ?? '').split(String.fromCharCode(26)).join('').trim();
const decimal = value => {
  const normalized = clean(value).replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const canonicalCode = value => clean(value).split('\\')[0];
const simpleType = type => ({ '1': 'Mano de Obra', '2': 'Maquinaria', '3': 'Material' }[clean(type)] || 'Otros');

export function decodeBc3(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementRatio = (utf8.match(/�/g) || []).length / Math.max(utf8.length, 1);
  return replacementRatio > 0.0005 ? new TextDecoder('windows-1252').decode(bytes) : utf8;
}

export function parseBc3(source, { fileName = 'presupuesto.bc3' } = {}) {
  const text = clean(source);
  if (!text.includes('~C|') || !text.includes('~D|')) throw new Error('El archivo no contiene los registros ~C y ~D requeridos por FIEBDC.');
  const concepts = new Map();
  const decompositions = new Map();
  const measurements = new Map();
  const indicators = new Map();
  const warnings = [];
  let version = '';
  let emitter = '';
  let currency = '';

  text.split('~').map(clean).filter(Boolean).forEach(record => {
    const fields = record.split('|');
    const kind = clean(fields[0]).toUpperCase();
    if (kind === 'V') {
      emitter = clean(fields[1]); version = clean(fields[2]);
    } else if (kind === 'K') {
      const currencyMatch = record.match(/(?:^|\\)(CLP|UF|USD|EUR)(?:\\|$)/i);
      currency = currencyMatch?.[1]?.toUpperCase() || currency;
    } else if (kind === 'C') {
      const aliases = clean(fields[1]).split('\\').map(clean).filter(Boolean);
      const code = aliases[0];
      if (!code) return;
      const prices = clean(fields[4]).split('\\').map(decimal).filter(Number.isFinite);
      concepts.set(code, { code, aliases, unit: clean(fields[2]), summary: clean(fields[3]) || code, price: prices[0] || 0, priceDate: clean(fields[5]), type: clean(fields[6]) || '0' });
    } else if (kind === 'D') {
      const parent = canonicalCode(fields[1]);
      const parts = clean(fields[2]).split('\\');
      const children = [];
      for (let index = 0; index < parts.length; index += 3) {
        const child = canonicalCode(parts[index]);
        if (child) children.push({ code: child, factor: decimal(parts[index + 1]) || 1, rendimiento: decimal(parts[index + 2]) || 1 });
      }
      if (parent) decompositions.set(parent, children);
    } else if (kind === 'M') {
      const relation = clean(fields[1]).split('\\').map(clean).filter(Boolean);
      const child = relation[relation.length - 1];
      if (child) measurements.set(`${relation[0] || ''}>${child}`, decimal(fields[3]));
    } else if (kind === 'X' && clean(fields[1])) {
      const values = clean(fields[2]).split('\\');
      const data = {};
      for (let index = 0; index < values.length; index += 2) if (clean(values[index])) data[clean(values[index])] = decimal(values[index + 1]);
      indicators.set(canonicalCode(fields[1]), data);
    }
  });

  // Presto guarda los capítulos en ~C con sufijo #, pero en ~D y ~M suele
  // referenciarlos sin él (por ejemplo, 1.1 -> 1.1#).
  const codeIndex = new Map();
  concepts.forEach(concept => {
    [concept.code, ...concept.aliases, concept.code.replace(/#+$/, '')].filter(Boolean)
      .forEach(alias => codeIndex.set(clean(alias).toLowerCase(), concept.code));
  });
  const resolveCode = value => codeIndex.get(canonicalCode(value).toLowerCase()) || canonicalCode(value);
  const resolvedDecompositions = new Map();
  decompositions.forEach((children, parent) => {
    const resolvedParent = resolveCode(parent);
    resolvedDecompositions.set(resolvedParent, children.map(child => ({ ...child, code: resolveCode(child.code) })));
  });
  decompositions.clear();
  resolvedDecompositions.forEach((children, parent) => decompositions.set(parent, children));
  const resolvedMeasurements = new Map();
  measurements.forEach((quantity, relation) => {
    const [parent, child] = relation.split('>');
    resolvedMeasurements.set(`${resolveCode(parent)}>${resolveCode(child)}`, quantity);
  });
  measurements.clear();
  resolvedMeasurements.forEach((quantity, relation) => measurements.set(relation, quantity));

  const childCodes = new Set([...decompositions.values()].flat().map(entry => entry.code));
  const rootCandidates = [...decompositions.keys()].filter(code => !childCodes.has(code));
  const roots = rootCandidates.sort((a, b) => Number(!/##$/.test(a)) - Number(!/##$/.test(b)));
  if (!roots.length) throw new Error('No fue posible determinar el concepto raíz del presupuesto BC3.');

  // FIEBDC permite conceptos porcentuales como % y %% con tipo 0. Aunque no
  // tengan naturaleza de insumo, forman parte de la descomposición del APU y
  // nunca deben convertirse en partidas del presupuesto.
  const isResource = concept => ['1', '2', '3', '4', '5'].includes(concept?.type) || /^%+$/.test(concept?.code || '');
  const isGroup = code => {
    const concept = concepts.get(code);
    const children = decompositions.get(code) || [];
    if (!children.length || isResource(concept)) return false;
    return /#$/.test(code) || !concept?.unit;
  };

  const flattenResources = (code, multiplier = 1, visited = new Set()) => {
    if (visited.has(code)) { warnings.push(`Se omitió una descomposición circular en ${code}.`); return []; }
    const nextVisited = new Set(visited).add(code);
    return (decompositions.get(code) || []).flatMap(component => {
      const concept = concepts.get(component.code);
      const quantity = multiplier * component.factor * component.rendimiento;
      if (!concept) { warnings.push(`El concepto ${component.code} está referenciado pero no definido.`); return []; }
      if (isResource(concept) || !(decompositions.get(component.code) || []).length) {
        return [{ codigo_recurso: concept.code, recurso: concept.summary, tipo: simpleType(concept.type), tipo_bc3: concept.type, categoria: 'Presto / BC3', unidad: concept.unit || 'un', costo_unitario: concept.price, fecha_precio: concept.priceDate || null, factor_descomposicion: component.factor, cantidad_descomposicion: component.rendimiento, cantidad_unidad: quantity, porcentaje_bc3: /%$/.test(concept.code), rendimiento: 1, indicadores_ambientales: indicators.get(concept.code) || {}, consumo_combustible_lh: 0 }];
      }
      return flattenResources(component.code, quantity, nextVisited);
    });
  };

  const rawItems = [];
  const resources = [];
  const seen = new Set();
  const visit = (code, parentCode = '', level = 0) => {
    if (seen.has(`${parentCode}>${code}`)) return;
    seen.add(`${parentCode}>${code}`);
    const concept = concepts.get(code);
    if (!concept) { warnings.push(`El concepto ${code} no tiene registro ~C.`); return; }
    const group = isGroup(code);
    const artificialRoot = !parentCode && /##$/.test(code);
    if (!artificialRoot) {
      const tipo = group ? (level === 0 ? 'CAPITULO' : 'SUBCAPITULO') : 'PARTIDA';
      const effectiveParent = parentCode && !/##$/.test(parentCode) ? parentCode : '';
      const measurement = measurements.get(`${parentCode}>${code}`);
      const relationship = (decompositions.get(parentCode) || []).find(entry => entry.code === code);
      const quantity = measurement || (relationship ? relationship.factor * relationship.rendimiento : 1);
      const rawItem = { TIPO_FILA: tipo, codigo: code, codigo_origen: code, partida: concept.summary, unidad: group ? (tipo === 'CAPITULO' ? 'TITULO' : 'GRUPO') : (concept.unit || 'un'), cantidad: group ? 0 : quantity, costo_unitario: group ? 0 : concept.price, tipo_metodologia: 'Precio Unitario', rendimiento_meta: group ? 0 : 1, parent_codigo: effectiveParent, nivel: Math.max(0, artificialRoot ? level - 1 : level), origen_importacion: 'PRESTO_BC3' };
      rawItems.push(rawItem);
      if (!group) {
        const itemResources = flattenResources(code);
        const aggregated = new Map();
        itemResources.forEach(resource => {
          const rate = resource.cantidad_descomposicion * 100;
          if (resource.codigo_recurso === 'WL%') rawItem.leyes_sociales_pct = Math.max(rawItem.leyes_sociales_pct || 0, rate);
          else if (resource.codigo_recurso === '%') rawItem.imponderables_pct = Math.max(rawItem.imponderables_pct || 0, rate);
          else {
            const key = `${resource.codigo_recurso}|${resource.unidad}|${resource.costo_unitario}`;
            const previous = aggregated.get(key);
            aggregated.set(key, previous ? { ...previous, cantidad_unidad: previous.cantidad_unidad + resource.cantidad_unidad, factor_descomposicion: null, cantidad_descomposicion: null } : resource);
          }
        });
        aggregated.forEach(resource => resources.push({ ...resource, codigo_partida: code }));
      }
    }
    if (group || artificialRoot) (decompositions.get(code) || []).forEach(child => {
      const childConcept = concepts.get(child.code);
      if (!isResource(childConcept)) visit(child.code, code, artificialRoot ? level : level + 1);
    });
  };
  roots.forEach(root => visit(root));

  const items = buildBudgetHierarchy(rawItems);
  if (!items.some(item => item.tipo_item === 'PARTIDA')) throw new Error('El BC3 no contiene partidas ejecutables reconocibles.');
  const globalCosts = [];
  const seenGlobals = new Set();
  decompositions.forEach(children => children.forEach(component => {
    if (component.code !== '%%') return;
    const concept = concepts.get(component.code);
    const value = Math.round((component.rendimiento * 100 || concept?.price || 0) * 1e8) / 1e8;
    const key = `${component.code}:${value}`;
    if (!seenGlobals.has(key)) globalCosts.push({ codigo_origen: component.code, concepto: concept?.summary || 'Costo global BC3', tipo: 'Porcentaje', valor: value, prorratear: true });
    seenGlobals.add(key);
  }));
  return {
    items, resources, warnings: [...new Set(warnings)],
    globalCosts, metadata: { fileName, version, emitter, currency: currency || null, concepts: concepts.size, roots: roots.length }
  };
}
