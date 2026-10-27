import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import fs from 'node:fs';
import { createMachineryPdf, historySheets } from '../src/utils/machineryExports.js';
import { loadSpreadsheetEngine } from '../src/services/documentEngines.js';

const out = process.argv[2];
if (!out) throw new Error('Output directory required');
await mkdir(out, { recursive: true });
const data = {
  company: 'EMPRESA DE PRUEBA', workName: 'Proyecto de prueba',
  equipment: { patente: 'EX-01', tipo: 'Excavadora', marca: 'Modelo de prueba' },
  works: [{ nombre: 'Proyecto de prueba', cliente: 'Mandante de prueba', admin_contrato: 'Administrador de prueba', oficina_tecnica: 'Oficina técnica de prueba' }],
  usage: [{ id: 99, empresa: 'EMPRESA DE PRUEBA', equipo_id: 1, equipo_tipo: 'Excavadora', equipo_patente: 'EX-01', obra_nombre: 'Proyecto de prueba', fecha: '2026-10-27', operador: 'Operador de prueba', horometro_inicial: 1200, horometro_final: 1208.5, horas_trabajadas: 8.5, combustible_cargado: 75.25, observaciones: 'Operación normal. Revisión preventiva antes de iniciar el turno.', created_at: '2026-10-27T18:00:00Z' }],
  failures: [{ id: 10, empresa: 'EMPRESA DE PRUEBA', equipo_id: 1, obra_nombre: 'Proyecto de prueba', fecha: '2026-10-27', descripcion: 'Pérdida de presión hidráulica', detuvo_equipo: true, horas_fuera_servicio: 1.5, severidad: 'Media', causa: 'Manguera dañada', solucion: 'Reemplazo de manguera', responsable: 'Taller de prueba' }],
  maintenance: [],
};
const pdf = await createMachineryPdf(data);
pdf.save(`${out}/reporte-prueba.pdf`);
const long = await createMachineryPdf({ ...data, usage: [{ ...data.usage[0], observaciones: 'Observación extensa con datos de operación y revisión del equipo. '.repeat(220) }] });
assert.ok(long.getNumberOfPages() > 2);
long.save(`${out}/reporte-prueba-largo.pdf`);
const XLSX = await loadSpreadsheetEngine();
XLSX.set_fs(fs);
const workbook = XLSX.utils.book_new();
for (const [name, rows] of historySheets(data)) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Información: 'Sin registros' }]), name);
const file = `${out}/historial-prueba.xlsx`;
XLSX.writeFile(workbook, file);
const reopened = XLSX.readFile(file);
assert.deepEqual(reopened.SheetNames, ['Información', 'Usos', 'Fallas', 'Mantenciones']);
const row = XLSX.utils.sheet_to_json(reopened.Sheets.Usos)[0];
assert.equal(row['Horas trabajadas (h)'], 8.5);
assert.equal(row['Combustible cargado (L)'], 75.25);
assert.equal(row['Administrador (ficha actual)'], 'Administrador de prueba');
console.log(JSON.stringify({ pdfPages: pdf.getNumberOfPages(), longPdfPages: long.getNumberOfPages(), excelSheets: reopened.SheetNames, numericRoundtrip: true }));
