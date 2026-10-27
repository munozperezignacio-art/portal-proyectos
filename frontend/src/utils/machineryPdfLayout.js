// Corporate A4 layout. Text is measured before drawing and long values continue
// on a new page; no business data is truncated to fit a fixed-height cell.
export function drawMachineryReport(doc, { report, company, companyLogo, fields, events }) {
  const left = 16, width = 178, bottom = 275;
  let y = 0;
  const text = (size = 9, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size); doc.setTextColor(30, 41, 59);
  };
  const lines = (value, w, size = 9) => {
    text(size);
    return doc.splitTextToSize(typeof value === 'number' ? value.toLocaleString('es-CL', { maximumFractionDigits: 3 }) : String(value ?? 'No informado'), w);
  };
  const header = () => {
    doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.25);
    doc.rect(left, 14, width, 26); doc.line(58, 14, 58, 40); doc.line(150, 14, 150, 40);
    let logoDrawn = false;
    if (companyLogo) {
      try {
        const image = doc.getImageProperties(companyLogo);
        const scale = Math.min(34 / image.width, 18 / image.height);
        doc.addImage(companyLogo, image.fileType || 'PNG', 37 - image.width * scale / 2, 27 - image.height * scale / 2, image.width * scale, image.height * scale);
        logoDrawn = true;
      } catch { /* A missing/invalid logo must never substitute another company. */ }
    }
    if (!logoDrawn) {
      const label = String(company || report.empresa || 'Empresa');
      let size = 9;
      while (size > 3 && lines(label, 34, size).length > 4) size -= 0.5;
      const name = lines(label, 34, size);
      text(size, true); doc.text(name, 37, 27 - (name.length - 1) * size * 0.2, { align: 'center' });
    }
    text(7); doc.text('REGISTRO OPERACIONAL DIGITAL', 104, 22, { align: 'center' });
    text(10, true); doc.text('REPORTE DE MAQUINARIA', 104, 29, { align: 'center' });
    text(7.5); doc.text('Control diario de operación', 104, 35, { align: 'center' });
    text(7.5); doc.text(`Registro: ${report.id}`, 153, 22);
    doc.text(`Fecha: ${String(report.fecha || 'No informada').slice(0, 10)}`, 153, 29);
    doc.text('Formato: MAQ-01', 153, 36);
    y = 47;
  };
  const ensure = h => { if (y + h > bottom) { doc.addPage(); header(); } };
  const title = label => {
    ensure(35);
    doc.setFillColor(241, 245, 249); doc.setDrawColor(203, 213, 225);
    doc.rect(left, y, width, 9, 'FD'); text(9, true);
    doc.text(label, left + 4, y + 6); y += 12;
  };
  const cells = entries => {
    const gap = 5, w = (width - gap * (entries.length - 1)) / entries.length;
    const measured = entries.map(([label, value]) => ({ label: lines(label, w - 8, 7.5), value: lines(value, w - 8) }));
    const h = Math.max(...measured.map(c => 8 + c.label.length * 3.5 + c.value.length * 4.3));
    // Oversized values use the full-width, paginated note layout instead.
    if (h > 90) { for (const [label, value] of entries) note(label, value); return; }
    ensure(h + 4);
    measured.forEach((c, i) => {
      const x = left + i * (w + gap);
      doc.setDrawColor(203, 213, 225); doc.rect(x, y, w, h);
      text(7.5, true); doc.text(c.label, x + 4, y + 5, { lineHeightFactor: 1.3 });
      text(); doc.text(c.value, x + 4, y + 7 + c.label.length * 3.5, { lineHeightFactor: 1.35 });
    });
    y += h + 3;
  };
  const note = (label, value) => {
    const pending = lines(value, width - 8);
    let continued = false;
    while (pending.length) {
      ensure(25);
      const count = Math.max(1, Math.floor((bottom - y - 14) / 4.3));
      const chunk = pending.splice(0, count), h = 13 + chunk.length * 4.3;
      doc.setDrawColor(203, 213, 225); doc.rect(left, y, width, h);
      text(8, true); doc.text(`${label}${continued ? ' (continuación)' : ''}`, left + 4, y + 5);
      text(); doc.text(chunk, left + 4, y + 11, { lineHeightFactor: 1.35 });
      y += h + 5; continued = true;
    }
  };
  const group = (label, indexes, cols = 2) => {
    title(label);
    for (let i = 0; i < indexes.length; i += cols) cells(indexes.slice(i, i + cols).map(n => n === 12 || n === 13 ? [`${fields[n][0]} (h)`, fields[n][1]] : fields[n]));
    y += 2;
  };
  header();
  group('01  PROYECTO Y RESPONSABLES', [1, 3, 4, 5, 6, 7]);
  group('02  EQUIPO Y OPERADOR', [8, 9, 10, 11]);
  group('03  HORÓMETRO Y JORNADA', [12, 13, 14], 3);
  group('04  COMBUSTIBLE', [15, 16]);
  group('05  FALLAS Y PARALIZACIONES', [17, 18]);
  for (const event of events) {
    title(`Detalle de falla ${event.id} - misma fecha, equipo y obra`);
    note('Descripción', event.descripcion || 'No informada');
    cells([['Severidad', event.severidad || 'No informada'], ['Horas fuera de servicio (h)', event.horas_fuera_servicio ?? 'No informadas']]);
    cells([['Detuvo el equipo', typeof event.detuvo_equipo === 'boolean' ? event.detuvo_equipo ? 'Sí' : 'No' : 'No informado'], ['Responsable', event.responsable || 'No informado']]);
    note('Causa', event.causa || 'No informada'); note('Solución', event.solucion || 'No informada');
  }
  title('06  OBSERVACIONES Y TRAZABILIDAD');
  note(...fields[19]); cells([fields[20], fields[21]]);
  note('Alcance de los datos', 'Responsables y marca/modelo corresponden a las fichas actuales. Las fallas se consultan por equipo, obra y fecha, sin afirmar un vínculo directo con este reporte. Sin registros no significa ausencia de incidentes. Combustible según uso registrado; no se infieren cargas ENEX por patente.');
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setDrawColor(203, 213, 225); doc.line(left, 282, left + width, 282);
    text(7); doc.text('Generado desde Obraxis · Registro de maquinaria', left, 288);
    doc.text(`Página ${page} de ${doc.getNumberOfPages()}`, left + width, 288, { align: 'right' });
  }
  return doc;
}
