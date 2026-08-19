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
  const warnings = [];
  let version = '';
  let emitter = '';

  text.split('~').map(clean).filter(Boolean).forEach(record => {
    const fields = record.split('|');
    const kind = clean(fields[0]).toUpperCase();
    if (kind === 'V') {
      emitter = clean(fields[1]); version = clean(fields[2]);
    } else if (kind === 'C') {
      const aliases = clean(fields[1]).split('\\').map(clean).filter(Boolean);
      const code = aliases[0];
      if (!code) return;
      const prices = clean(fields[4]).split('\\').map(decimal).filter(Number.isFinite);
      concepts.set(code, { code, aliases, unit: clean(fields[2]), summary: clean(fields[3]) || code, price: prices[0] || 0, type: clean(fields[6]) || '0' });
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
    }
  });

  const childCodes = new Set([...decompositions.values()].flat().map(entry => entry.code));
  const rootCandidates = [...decompositions.keys()].filter(code => !childCodes.has(code));
  const roots = rootCandidates.sort((a, b) => Number(!/##$/.test(a)) - Number(!/##$/.test(b)));
  if (!roots.length) throw new Error('No fue posible determinar el concepto raíz del presupuesto BC3.');

  const isResource = concept => ['1', '2', '3', '4', '5'].includes(concept?.type);
  const isGroup = code => {
    const concept = concepts.get(code);
    const children = decompositions.get(code) || [];
    if (!children.length || isResource(concept)) return false;
    if (!concept?.unit) return true;
    return children.some(child => {
      const childConcept = concepts.get(child.code);
      return !isResource(childConcept) && (decompositions.get(child.code) || []).length > 0 && !childConcept?.unit;
    });
  };

  const flattenResources = (code, multiplier = 1, visited = new Set()) => {
    if (visited.has(code)) { warnings.push(`Se omitió una descomposición circular en ${code}.`); return []; }
    const nextVisited = new Set(visited).add(code);
    return (decompositions.get(code) || []).flatMap(component => {
      const concept = concepts.get(component.code);
      const quantity = multiplier * component.factor * component.rendimiento;
      if (!concept) { warnings.push(`El concepto ${component.code} está referenciado pero no definido.`); return []; }
      if (isResource(concept) || !(decompositions.get(component.code) || []).length) {
        return [{ codigo_recurso: concept.code, recurso: concept.summary, tipo: simpleType(concept.type), categoria: 'Presto / BC3', unidad: concept.unit || 'un', costo_unitario: concept.price, cantidad_unidad: quantity, rendimiento: 1, consumo_combustible_lh: 0 }];
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
      rawItems.push({ TIPO_FILA: tipo, codigo: code, codigo_origen: code, partida: concept.summary, unidad: group ? (tipo === 'CAPITULO' ? 'TITULO' : 'GRUPO') : (concept.unit || 'un'), cantidad: group ? 0 : quantity, costo_unitario: group ? 0 : concept.price, tipo_metodologia: 'Precio Unitario', rendimiento_meta: group ? 0 : 1, parent_codigo: effectiveParent, nivel: Math.max(0, artificialRoot ? level - 1 : level), origen_importacion: 'PRESTO_BC3' });
      if (!group) flattenResources(code).forEach(resource => resources.push({ ...resource, codigo_partida: code }));
    }
    if (group || artificialRoot) (decompositions.get(code) || []).forEach(child => {
      const childConcept = concepts.get(child.code);
      if (!isResource(childConcept)) visit(child.code, code, artificialRoot ? level : level + 1);
    });
  };
  roots.forEach(root => visit(root));

  const items = buildBudgetHierarchy(rawItems);
  if (!items.some(item => item.tipo_item === 'PARTIDA')) throw new Error('El BC3 no contiene partidas ejecutables reconocibles.');
  return {
    items, resources, warnings: [...new Set(warnings)],
    metadata: { fileName, version, emitter, concepts: concepts.size, roots: roots.length }
  };
}
