import { jsPDF } from 'jspdf';

/**
 * Genera un archivo PDF a partir del formulario y las respuestas dadas.
 * Retorna la representación en string Base64 del archivo PDF generado.
 */
export function generateFormPdf({ form, metadata, answers, mainSignature, companyLogo }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let y = 20;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = 170; // 210 - 20*2

  const checkPage = (heightNeeded) => {
    if (y + heightNeeded > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    // Caja del encabezado de 3 columnas EMIN/Obraxis
    doc.setDrawColor(148, 163, 184); // Borde gris (slate 400)
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentWidth, 24, 'FD');

    // Separadores verticales
    doc.line(margin + 45, y, margin + 45, y + 24);
    doc.line(margin + 125, y, margin + 125, y + 24);

    // Columna 1: Logo
    if (companyLogo) {
      try {
        doc.addImage(companyLogo, 'PNG', margin + 3, y + 3, 39, 18);
      } catch (e) {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(form.empresa || 'OBRAXIS', margin + 22.5, y + 13, { align: 'center' });
      }
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(form.empresa || 'OBRAXIS', margin + 22.5, y + 13, { align: 'center' });
    }

    // Columna 2: Título y Subtítulo Central
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('REGISTRO OPERACIONAL DIGITAL', margin + 85, y + 8, { align: 'center' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const titleText = (form.titulo || 'Formulario de Prevención').toUpperCase();
    doc.text(titleText, margin + 85, y + 15, { align: 'center' });

    // Columna 3: Metadatos de la Revisión
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Código: ${form.codigo || 'N/A'}`, margin + 128, y + 7);
    doc.text(`Fecha: ${form.fecha_revision || 'N/A'}`, margin + 128, y + 13);
    doc.text(`Revisión: ${form.revision || 'N/A'}`, margin + 128, y + 19);

    y += 32;
  };

  // 1. Dibujar Encabezado
  drawHeader();

  // 2. Tabla de Metadatos de la Inspección
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setFillColor(248, 250, 252); // Slate 50
  
  // Fondo de tabla metadatos
  doc.rect(margin, y, contentWidth, 32, 'FD');
  
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  
  doc.text('Inspector / Autor:', margin + 5, y + 8);
  doc.text('Obra / Proyecto:', margin + 5, y + 16);
  doc.text('Categoría:', margin + 5, y + 24);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(metadata.inspector || 'Anónimo', margin + 40, y + 8);
  doc.text(metadata.proyecto_nombre || 'General', margin + 40, y + 16);
  doc.text(form.categoria || 'Inspección', margin + 40, y + 24);

  // Fecha y hora a la derecha
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Fecha:', margin + 110, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(new Date().toLocaleDateString('es-CL'), margin + 125, y + 8);
  
  y += 42;

  // 3. Detalle de Respuestas del Formulario
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Respuestas del Formulario:', margin, y);
  y += 6;

  (form.campos || []).forEach((field) => {
    const val = answers[field.id];
    
    // Calcular altura estimada requerida para la pregunta
    let heightNeeded = 12;
    if (field.type === 'repeater' && Array.isArray(val)) {
      heightNeeded = 15 + (val.length * 15);
    } else if (field.type === 'signature' && val) {
      heightNeeded = 25;
    }
    
    checkPage(heightNeeded);

    // Dibujar Pregunta / Campo
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(field.label || 'Campo', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);

    if (field.type === 'repeater') {
      if (Array.isArray(val) && val.length > 0) {
        val.forEach((instance, instIdx) => {
          checkPage(15);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text(`[Instancia ${instIdx + 1}]`, margin + 5, y);
          y += 4;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          
          Object.entries(instance).forEach(([subId, subVal]) => {
            const subField = field.subFields?.find(sf => sf.id === subId);
            const subLabel = subField ? subField.label : subId;
            
            checkPage(6);
            if (subField?.type === 'signature' && subVal) {
              doc.text(`- ${subLabel}: [Firma Digital]`, margin + 10, y);
              try {
                doc.addImage(subVal, 'PNG', margin + 50, y - 4, 15, 6);
              } catch (e) {
                // Si la imagen falla
              }
            } else {
              doc.text(`- ${subLabel}: ${subVal || 'N/R'}`, margin + 10, y);
            }
            y += 5;
          });
          y += 2;
        });
      } else {
        doc.setFontStyle('italic');
        doc.text('Sin registros ingresados', margin + 5, y);
        y += 5;
      }
    } else if (field.type === 'signature' && val) {
      try {
        doc.addImage(val, 'PNG', margin, y - 3, 40, 15);
        y += 15;
      } catch (errSig) {
        doc.text('[Firma Registrada]', margin, y);
        y += 5;
      }
    } else if (field.type === 'checkbox') {
      doc.text(val ? 'Sí (Aceptado)' : 'No', margin, y);
      y += 5;
    } else {
      const textVal = String(val || 'N/R');
      // Ajustar texto largo en múltiples líneas
      const splitText = doc.splitTextToSize(textVal, contentWidth);
      splitText.forEach((line) => {
        checkPage(5);
        doc.text(line, margin, y);
        y += 5;
      });
    }

    y += 3; // Margen entre preguntas
  });

  // 4. Firma del Inspector al Pie
  if (mainSignature) {
    checkPage(35);
    y += 5;
    doc.setDrawColor(15, 23, 42);
    doc.line(margin, y, margin + contentWidth, y);
    y += 8;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('FIRMA CONFORMIDAD INSPECTOR', margin, y);
    y += 4;
    
    try {
      doc.addImage(mainSignature, 'PNG', margin, y, 50, 20);
      y += 22;
    } catch (e) {
      doc.setFont('helvetica', 'italic');
      doc.text('[Firma digital cargada]', margin, y);
      y += 8;
    }
  }

  // Generar string Base64 del PDF sin prefijos (data:application/pdf;base64,)
  const pdfOutput = doc.output('datauristring');
  const base64Prefix = 'data:application/pdf;filename=generated.pdf;base64,';
  return pdfOutput.substring(base64Prefix.length);
}
