import { drawMachineryReport } from './machineryPdfLayout.js';
import { loadPdfEngine, loadSpreadsheetEngine } from '../services/documentEngines.js';

const present = value => value !== null && value !== undefined && value !== '';
const number = value => present(value) && Number.isFinite(Number(value)) ? Number(value) : null;
const day = value => String(value || '').slice(0, 10);
const safeName = value => String(value || 'equipo').replace(/[^\p{L}\p{N}_.-]+/gu, '_').slice(0, 80);

export function relatedFailures(report, failures) {
  // Same-day events are context, not a fabricated direct relationship to this report.
  return failures.filter(f => (f.uso_diario_id == null || String(f.uso_diario_id) === String(report.id)) && String(f.equipo_id) === String(report.equipo_id)
    && f.obra_nombre === report.obra_nombre && day(f.fecha) === day(report.fecha));
}

export function reportFields(report, equipment = {}, work = {}, failures = []) {
  const events = relatedFailures(report, failures);
  const fuel = number(report.combustible_cargado);
  const stopped = events.some(f => f.detuvo_equipo === true || number(f.horas_fuera_servicio) > 0);
  return [
    ['ID del reporte', report.id], ['Empresa', report.empresa], ['Fecha', report.fecha],
    ['Proyecto', report.obra_nombre], ['Mandante', work.cliente], ['Ubicación', work.ubicacion],
    ['Administrador (ficha actual)', work.admin_contrato], ['Oficina técnica (ficha actual)', work.oficina_tecnica],
    ['Equipo', report.equipo_tipo || equipment.tipo], ['Código / patente', report.equipo_patente || equipment.patente],
    ['Marca / modelo (ficha actual)', equipment.marca], ['Operador', report.operador],
    [report.reporte_datos?.unidad === 'km' ? 'Odómetro inicial (km)' : 'Horómetro inicial', number(report.horometro_inicial)], [report.reporte_datos?.unidad === 'km' ? 'Odómetro final (km)' : 'Horómetro final', number(report.horometro_final)],
    ['Horas trabajadas (h)', number(report.horas_trabajadas)],
    ['Carga de combustible', fuel === null ? 'No informado' : fuel > 0 ? 'Sí' : 'No, según el reporte'],
    ['Combustible cargado (L)', fuel],
    ['Fallas del equipo / obra en la fecha', report.reporte_datos?.hubo_falla === false ? `No declarada en este reporte${events.length ? `; ${events.length} evento(s) en la fecha` : ''}` : events.length ? `Sí: ${events.length} registro(s)` : 'Sin registro asociado a la fecha'],
    ['Paralización', report.reporte_datos?.detuvo_equipo === false ? 'No, según el reporte' : stopped ? 'Sí, registrada en la fecha' : events.length && events.every(f => f.detuvo_equipo === false) ? 'No, según las fallas registradas' : 'No informada'],
    ['Observaciones', report.observaciones], ['Registrado por', report.registrado_por],
    ['Fecha de creación', report.created_at],
    ['Código de documento', report.reporte_datos?.codigo], ['Revisión', report.reporte_datos?.revision],
    ['Responsable de maquinaria', report.reporte_datos?.responsable],
  ].map(([label, value]) => [label, present(value) ? value : 'No informado']);
}

export async function readAllMachineryRows(queryFactory, pageSize = 500) {
  const rows = [], ids = new Set();
  for (let offset = 0; offset < 100000; offset += pageSize) {
    const { data, error } = await queryFactory().order('id').range(offset, offset + pageSize - 1);
    if (error) throw new Error(`No se pudo completar la descarga: ${error.message}`);
    for (const row of data || []) {
      if (ids.has(String(row.id))) throw new Error('El historial cambió durante la lectura. Intenta nuevamente.');
      ids.add(String(row.id)); rows.push(row);
    }
    if ((data || []).length < pageSize) return rows;
  }
  throw new Error('El historial supera el límite de exportación. No se descargará un archivo incompleto.');
}

export async function readMachineryExport(db, { company, equipmentId, workName, reportId }) {
  if (!company || !equipmentId) throw new Error('Falta identificar la empresa o el equipo.');
  const scope = table => {
    let query = db.from(table).select('*').eq('empresa', company).eq('equipo_id', equipmentId);
    if (workName) query = query.eq('obra_nombre', workName);
    return query;
  };
  const usage = await readAllMachineryRows(() => {
    const query = scope('maquinaria_uso_diario');
    return reportId ? query.eq('id', reportId) : query;
  });
  if (reportId && usage.length !== 1) throw new Error('El reporte ya no existe o no está autorizado.');
  const report = usage[0];
  const [failures, maintenance, equipmentResult, works, reportConfig] = await Promise.all([
    readAllMachineryRows(() => reportId ? scope('maquinaria_fallas').eq('fecha', day(report.fecha)).eq('obra_nombre', report.obra_nombre) : scope('maquinaria_fallas')),
    reportId ? [] : readAllMachineryRows(() => scope('maquinaria_mantenciones')),
    db.from('inventario_maquinaria').select('*').eq('empresa', company).eq('id', equipmentId).maybeSingle(),
    readAllMachineryRows(() => db.from('obras').select('id,nombre,cliente,ubicacion,admin_contrato,oficina_tecnica').eq('empresa', company)),
    db.from('maquinaria_reporte_config').select('codigo,revision').eq('empresa',company).maybeSingle(),
  ]);
  if (equipmentResult.error) throw new Error('No se pudo consultar la ficha del equipo.');
  if (reportConfig.error) throw new Error('No se pudo consultar el formato del reporte.');
  return { usage, failures, maintenance, equipment: equipmentResult.data || {}, works, company, workName, reportConfig: reportConfig.data };
}

export async function createMachineryPdf(data) {
  const jsPDF = await loadPdfEngine();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const original = data.usage[0];
  const report = original && { ...original, reporte_datos: original.reporte_datos || { ...data.reportConfig, configuracion_actual: true } };
  if (!report) throw new Error('Reporte no disponible.');
  const work = data.works.find(w => w.nombre === report.obra_nombre) || {};
  let companyLogo = data.companyLogo;
  if (typeof companyLogo === 'string' && /^https:\/\//i.test(companyLogo)) {
    try {
      const response = await fetch(companyLogo, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Logo no disponible');
      companyLogo = new Uint8Array(await response.arrayBuffer());
    } catch { companyLogo = null; }
  }
  drawMachineryReport(doc, { report, company: data.company, companyLogo,
    fields: reportFields(report, data.equipment, work, data.failures),
    events: relatedFailures(report, data.failures) });
  return doc;
}

export function historySheets(data) {
  const sorted = rows => [...rows].sort((a,b) => String(a.fecha || a.created_at).localeCompare(String(b.fecha || b.created_at)) || String(a.id).localeCompare(String(b.id)));
  const usage = sorted(data.usage).map(report => Object.fromEntries(reportFields(report, data.equipment, data.works.find(w => w.nombre === report.obra_nombre), data.failures)));
  const eventRows = rows => sorted(rows).map(r => ({
    ID: String(r.id), Empresa: r.empresa, Fecha: r.fecha, Proyecto: r.obra_nombre,
    Equipo: r.equipo_tipo || data.equipment.tipo, 'Código / patente': r.equipo_patente || data.equipment.patente,
    Tipo: r.tipo, Descripción: r.descripcion, Severidad: r.severidad,
    'Detuvo equipo': typeof r.detuvo_equipo === 'boolean' ? r.detuvo_equipo ? 'Sí' : 'No' : '',
    'Horas fuera de servicio': number(r.horas_fuera_servicio), Horómetro: number(r.horometro),
    Causa: r.causa, Solución: r.solucion, Costo: number(r.costo), Proveedor: r.proveedor,
    Responsable: r.responsable, 'Registrado por': r.registrado_por, 'Creado el': r.created_at,
  }));
  return [
    ['Información', [{ Empresa: data.company, Equipo: data.equipment.tipo, 'Código / patente': data.equipment.patente,
      Alcance: data.workName || 'Historial autorizado de la empresa',
      Nota: 'Responsables actuales de la ficha de obra. Sin registro no significa ausencia de fallas. Combustible según uso registrado, sin inferir ENEX.',
      Usos: data.usage.length, Fallas: data.failures.length, Mantenciones: data.maintenance.length }]],
    ['Usos', usage], ['Fallas', eventRows(data.failures)], ['Mantenciones', eventRows(data.maintenance)],
  ];
}

export async function downloadMachinery(data, format) {
  const name = safeName(data.equipment.patente || data.usage[0]?.equipo_patente);
  if (format === 'pdf') {
    const doc = await createMachineryPdf(data);
    doc.save(`Reporte_${name}_${safeName(data.usage[0].fecha)}_${safeName(data.usage[0].id)}.pdf`);
    return;
  }
  const XLSX = await loadSpreadsheetEngine();
  const workbook = XLSX.utils.book_new();
  for (const [title, rows] of historySheets(data)) {
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Información: 'Sin registros para este alcance' }]);
    sheet['!cols'] = Object.keys(rows[0] || { Información: '' }).map(key => ({ wch: /Observ|Descripción|Nota/.test(key) ? 60 : 25 }));
    sheet['!autofilter'] = { ref: sheet['!ref'] };
    XLSX.utils.book_append_sheet(workbook, sheet, title);
  }
  XLSX.writeFile(workbook, `Historial_${name}.xlsx`, { compression: true });
}
