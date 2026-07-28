var LOGO_BASE64 = "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";

function ejecutarReporteDiario() {
  ejecutarReporteDiarioDirecto();
}

function ejecutarReporteDiarioDirecto() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetObras = ss.getSheetByName("Obras");
  var dataObras = sheetObras.getDataRange().getValues();
  
  var hoy = new Date();
  var fechaHoyStr = Utilities.formatDate(hoy, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  for (var i = 1; i < dataObras.length; i++) {
    var nombreObra = dataObras[i][0];
    if (!nombreObra) continue;
    var correoDestino = obtenerDestinatariosConfig("Produccion Diaria", nombreObra);
    generarPDFObra(nombreObra, fechaHoyStr, correoDestino);
  }
}

function generarPDFObra(obra, fechaStr, destinatario) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPartidas = ss.getSheetByName("Partidas_Obra");
  var partidasData = sheetPartidas ? sheetPartidas.getDataRange().getValues() : [];
  var sheetAvances = ss.getSheetByName("Avances_Produccion_Partidas");
  var avancesData = sheetAvances ? sheetAvances.getDataRange().getValues() : [];
  
  var tablaProduccionHTML = ""; var datosGraficoBarras = {}; var ultimos5Dias = [];
  for (var k = 4; k >= 0; k--) {
    var d = new Date(); d.setDate(d.getDate() - k);
    var dStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
    ultimos5Dias.push(dStr); datosGraficoBarras[dStr] = 0;
  }
  
  var resumenPartidas = {};
  for (var p = 1; p < partidasData.length; p++) {
    if (partidasData[p][0].toString().trim().toLowerCase() === obra.toLowerCase()) {
      var act = partidasData[p][1];
      resumenPartidas[act] = { unidad: partidasData[p][2], rendimiento: parseFloat(partidasData[p][3]) || 0, meta: parseFloat(partidasData[p][4]) || 0, dia: 0, acumulado: 0 };
    }
  }
  
  for (var a = 1; a < avancesData.length; a++) {
    if (avancesData[a][1].toString().trim().toLowerCase() === obra.toLowerCase()) {
      var fAvanceStr = Utilities.formatDate(new Date(avancesData[a][0]), Session.getScriptTimeZone(), "yyyy-MM-dd");
      var part = avancesData[a][4]; var cant = parseFloat(avancesData[a][6]) || 0;
      if (resumenPartidas[part]) {
        resumenPartidas[part].acumulado += cant;
        if (fAvanceStr === fechaStr) { resumenPartidas[part].dia += cant; }
      }
      if (datosGraficoBarras[fAvanceStr] !== undefined) { datosGraficoBarras[fAvanceStr] += cant; }
    }
  }
  
  for (var key in resumenPartidas) {
    var item = resumenPartidas[key]; var pendiente = item.meta - item.acumulado; if (pendiente < 0) pendiente = 0;
    tablaProduccionHTML += `<tr>
      <td style='padding:8px; border:1px solid #ddd;'>${key}</td>
      <td style='padding:8px; border:1px solid #ddd; text-align:center;'>${item.unidad}</td>
      <td style='padding:8px; border:1px solid #ddd; text-align:right; font-weight:bold;'>${item.dia.toFixed(2)}</td>
      <td style='padding:8px; border:1px solid #ddd; text-align:right;'>${item.acumulado.toFixed(2)}</td>
      <td style='padding:8px; border:1px solid #ddd; text-align:right; color:#777;'>${pendiente.toFixed(2)}</td>
    </tr>`;
  }
  
  // 1. MAQUINARIA: CALCULAR HORAS ACUMULADAS TOTALES PROYECTO
  var sheetMaq = ss.getSheetByName("Reporte_Maquinaria"); var maqData = sheetMaq ? sheetMaq.getDataRange().getValues() : [];
  var horasAcumuladasEquipos = {};
  for (var m = 1; m < maqData.length; m++) {
    if (maqData[m][1].toString().trim().toLowerCase() === obra.toLowerCase()) {
      var equipoID = maqData[m][4].toString().trim();
      var hUsoRow = (parseFloat(maqData[m][6]) || 0) - (parseFloat(maqData[m][5]) || 0);
      if (!horasAcumuladasEquipos[equipoID]) horasAcumuladasEquipos[equipoID] = 0;
      horasAcumuladasEquipos[equipoID] += hUsoRow;
    }
  }
  
  var tablaEquiposHTML = "";
  for (var m = 1; m < maqData.length; m++) {
    var fMaqStr = Utilities.formatDate(new Date(maqData[m][0]), Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (maqData[m][1].toString().trim().toLowerCase() === obra.toLowerCase() && fMaqStr === fechaStr) {
      var hUsoDia = (parseFloat(maqData[m][6]) || 0) - (parseFloat(maqData[m][5]) || 0);
      var equipoID = maqData[m][4].toString().trim();
      var totalAcumEquipo = horasAcumuladasEquipos[equipoID] || hUsoDia;
      
      tablaEquiposHTML += `<tr>
        <td style='padding:8px; border:1px solid #ddd;'>${equipoID}</td>
        <td style='padding:8px; border:1px solid #ddd;'>${maqData[m][2]}</td>
        <td style='padding:8px; border:1px solid #ddd; text-align:center;'>${hUsoDia.toFixed(2)} Hrs</td>
        <td style='padding:8px; border:1px solid #ddd; text-align:center; font-weight:bold; color:#1A365D;'>${totalAcumEquipo.toFixed(2)} Hrs</td>
        <td style='padding:8px; border:1px solid #ddd; text-align:center;'>${maqData[m][9]}</td>
      </tr>`;
    }
  }
  
  // 2. PERSONAL: CALCULAR HORAS HOMBRE ACUMULADAS TOTALES PROYECTO
  var sheetAsist = ss.getSheetByName("Asistencia_Personal"); var asistData = sheetAsist ? sheetAsist.getDataRange().getValues() : [];
  var horasAcumuladasPersonal = {}; var totalHH_ProyectoAcumulado = 0; var totalHHDia = 0;
  
  for (var x = 1; x < asistData.length; x++) {
    if (asistData[x][1].toString().trim().toLowerCase() === obra.toLowerCase()) {
      if (asistData[x][5].toString().toUpperCase() === "PRESENTE") {
        var rowFecha = new Date(asistData[x][0]);
        var rowFechaStr = Utilities.formatDate(rowFecha, Session.getScriptTimeZone(), "yyyy-MM-dd");
        var dayOfWeek = rowFecha.getDay();
        
        var valIn = asistData[x][6]; var valOut = asistData[x][7];
        var minIngreso = valIn instanceof Date ? valIn.getHours() * 60 + valIn.getMinutes() : (valIn || "08:00").toString().trim().split(":").reduce((h, m) => parseInt(h, 10) * 60 + parseInt(m || 0, 10));
        var minSalida = valOut instanceof Date ? valOut.getHours() * 60 + valOut.getMinutes() : (valOut || "18:00").toString().trim().split(":").reduce((h, m) => parseInt(h, 10) * 60 + parseInt(m || 0, 10));
        
        var diffHrs = (minSalida - minIngreso) / 60;
        var horasExtrasAuto = 0; var horasBaseFaena = 0;
        
        if (dayOfWeek >= 1 && dayOfWeek <= 4) { 
          horasExtrasAuto = Math.max(0, diffHrs - 10);
          horasBaseFaena = Math.min(9, Math.max(0, diffHrs - 1)); 
        } else if (dayOfWeek === 5) { 
          horasExtrasAuto = Math.max(0, diffHrs - 6);
          horasBaseFaena = Math.min(6, diffHrs); 
        } else {
          horasExtrasAuto = diffHrs; horasBaseFaena = 0;
        }
        
        var heManual = parseFloat(asistData[x][11]) || 0; 
        var hhFinalCalculada = horasBaseFaena + horasExtrasAuto + heManual;
        var workerID = asistData[x][3].toString().trim();
        
        if (!horasAcumuladasPersonal[workerID]) horasAcumuladasPersonal[workerID] = 0;
        horasAcumuladasPersonal[workerID] += hhFinalCalculada;
        totalHH_ProyectoAcumulado += hhFinalCalculada;
        if (rowFechaStr === fechaStr) { totalHHDia += hhFinalCalculada; }
      }
    }
  }
  
  var tablaPersonalHTML = "";
  for (var x = 1; x < asistData.length; x++) {
    var rFechaStr = Utilities.formatDate(new Date(asistData[x][0]), Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (asistData[x][1].toString().trim().toLowerCase() === obra.toLowerCase() && rFechaStr === fechaStr) {
      var workerID = asistData[x][3].toString().trim();
      var hhFinalCalculada = 0;
      if (asistData[x][5].toString().toUpperCase() === "PRESENTE") {
        var rowFecha = new Date(asistData[x][0]); var dayOfWeek = rowFecha.getDay();
        var valIn = asistData[x][6]; var valOut = asistData[x][7];
        var minIngreso = valIn instanceof Date ? valIn.getHours() * 60 + valIn.getMinutes() : (valIn || "08:00").toString().trim().split(":").reduce((h, m) => parseInt(h, 10) * 60 + parseInt(m || 0, 10));
        var minSalida = valOut instanceof Date ? valOut.getHours() * 60 + valOut.getMinutes() : (valOut || "18:00").toString().trim().split(":").reduce((h, m) => parseInt(h, 10) * 60 + parseInt(m || 0, 10));
        var diffHrs = (minSalida - minIngreso) / 60;
        var horasExtrasAuto = (dayOfWeek >= 1 && dayOfWeek <= 4) ? Math.max(0, diffHrs - 10) : (dayOfWeek === 5 ? Math.max(0, diffHrs - 6) : diffHrs);
        var horasBaseFaena = (dayOfWeek >= 1 && dayOfWeek <= 4) ? Math.min(9, Math.max(0, diffHrs - 1)) : (dayOfWeek === 5 ? Math.min(6, diffHrs) : 0);
        hhFinalCalculada = horasBaseFaena + horasExtrasAuto + (parseFloat(asistData[x][11]) || 0);
      }
      
      tablaPersonalHTML += `<tr>
        <td style='padding:8px; border:1px solid #ddd;'>${workerID}</td>
        <td style='padding:8px; border:1px solid #ddd; text-align:center;'>${asistData[x][5]}</td>
        <td style='padding:8px; border:1px solid #ddd; text-align:right;'>${hhFinalCalculada.toFixed(1)} Hrs</td>
        <td style='padding:8px; border:1px solid #ddd; text-align:right; font-weight:bold; color:#1A365D;'>${(horasAcumuladasPersonal[workerID] || 0).toFixed(1)} Hrs</td>
      </tr>`;
    }
  }
  
  // 3. LOGÍSTICA: REPORTE DE CONSUMO ACUMULADO
  var sheetMat = ss.getSheetByName("Inventario_Materiales"); var matData = sheetMat ? sheetMat.getDataRange().getValues() : [];
  var resumenMateriales = {};
  for (var b = 1; b < matData.length; b++) {
    if (matData[b][1] && matData[b][1].toString().trim().toLowerCase() === obra.toLowerCase()) {
      var matNombre = matData[b][4]; var tipoMov = matData[b][3].toString().toUpperCase(); var cantidad = parseFloat(matData[b][5]) || 0;
      var fMatStr = Utilities.formatDate(new Date(matData[b][0]), Session.getScriptTimeZone(), "yyyy-MM-dd");
      if (!resumenMateriales[matNombre]) resumenMateriales[matNombre] = { ingresos: 0, consumos: 0, usoDia: 0 };
      if (tipoMov === "INGRESO") resumenMateriales[matNombre].ingresos += cantidad;
      else if (tipoMov === "USO") {
        resumenMateriales[matNombre].consumos += cantidad;
        if (fMatStr === fechaStr) { resumenMateriales[matNombre].usoDia += cantidad; }
      }
    }
  }
  
  var tablaMaterialesHTML = "";
  for (var mKey in resumenMateriales) {
    var saldoBodega = resumenMateriales[mKey].ingresos - resumenMateriales[mKey].consumos;
    tablaMaterialesHTML += `<tr>
      <td style='padding:8px; border:1px solid #ddd;'>${mKey}</td>
      <td style='padding:8px; border:1px solid #ddd; text-align:right;'>${resumenMateriales[mKey].usoDia.toFixed(2)}</td>
      <td style='padding:8px; border:1px solid #ddd; text-align:right; font-weight:bold; color:#4A5568;'>${resumenMateriales[mKey].consumos.toFixed(2)}</td>
      <td style='padding:8px; border:1px solid #ddd; text-align:right; font-weight:bold; color:#1A365D;'>${saldoBodega.toFixed(2)}</td>
    </tr>`;
  }
  
  var imgCurvaBase64 = generarGraficoCurvaCalendarioChile(obra, resumenPartidas, fechaStr);
  var imgBarrasBase64 = generarGraficoColumnasInvertido(ultimos5Dias, datosGraficoBarras);
  
  var htmlCuerpo = `
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; margin:20px;">
      <div style="border-bottom: 3px solid #1E3A8A; padding-bottom: 12px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; border: none; margin: 0; padding: 0;">
          <tr style="border: none;">
            <td style="width: 160px; padding: 0; border: none; vertical-align: middle;">
              <img src="data:image/png;base64,${LOGO_BASE64}" style="width: 150px; height: auto;" />
            </td>
            <td style="text-align: right; border: none; vertical-align: middle; padding: 0;">
              <h2 style="color: #1E3A8A; margin: 0; font-size: 18px; font-weight: bold;">Informe Diario de Gestión</h2>
              <p style="color: #4B5563; margin: 3px 0 0 0; font-size: 12px;"><b>Proyecto:</b> ${obra} | <b>Fecha Reporte:</b> ${fechaStr}</p>
              <p style="color: #1E3A8A; margin: 3px 0 0 0; font-size: 12px;"><b>Horas Hombre (HH) Totales Acumuladas:</b> <span style="font-size:13px; color:#EA580C; font-weight: bold;">${totalHH_ProyectoAcumulado.toFixed(1)} HH</span></p>
            </td>
          </tr>
        </table>
      </div>
      
      <h4 style="color: #1E3A8A; border-left: 4px solid #EA580C; padding-left: 8px;">Avance Diario e Histórico de Partidas</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #1E3A8A; color: white;">
            <th style="padding:8px; text-align:left;">Partida Actividad</th>
            <th style="padding:8px; text-align:center;">U.M</th>
            <th style="padding:8px; text-align:right;">Avance Día</th>
            <th style="padding:8px; text-align:right;">Acumulado</th>
            <th style="padding:8px; text-align:right;">Pendiente</th>
          </tr>
        </thead>
        <tbody>${tablaProduccionHTML || "<tr><td colspan='5' style='text-align:center; padding:8px;'>Sin producción hoy.</td></tr>"}</tbody>
      </table>
      
      <div style="margin-bottom: 25px; text-align: center;">
        <table style="width:100%;">
          <tr>
            <td style="width:50%; text-align:center;">
              <h5 style="color:#4B5563; margin:5px 0;">Curva de Avance Progresivo (Todos los días)</h5>
              <img src="data:image/png;base64,${imgCurvaBase64}" style="width:340px; height:190px; border:1px solid #eee;" />
            </td>
            <td style="width:50%; text-align:center;">
              <h5 style="color:#4B5563; margin:5px 0;">Producción Últimos 5 Días (Columnas)</h5>
              <img src="data:image/png;base64,${imgBarrasBase64}" style="width:340px; height:190px; border:1px solid #eee;" />
            </td>
          </tr>
        </table>
      </div>
      
      <h4 style="color: #1E3A8A; border-left: 4px solid #EA580C; padding-left: 8px;">Uso de Equipos y Maquinaria</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead><tr style="background-color: #4B5563; color: white;"><th style="padding:8px; text-align:left;">Equipo</th><th style="padding:8px; text-align:left;">Operador</th><th style="padding:8px; text-align:center;">Horas Día</th><th style="padding:8px; text-align:center;">Horas Acumuladas</th><th style="padding:8px; text-align:center;">Paralizado</th></tr></thead>
        <tbody>${tablaEquiposHTML || "<tr><td colspan='5' style='text-align:center; padding:8px;'>Sin horómetros hoy.</td></tr>"}</tbody>
      </table>
      
      <h4 style="color: #1E3A8A; border-left: 4px solid #EA580C; padding-left: 8px;">Dotación de Personal del Día (${totalHHDia.toFixed(1)} HH)</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead><tr style="background-color: #4B5563; color: white;"><th style="padding:8px; text-align:left;">Trabajador</th><th style="padding:8px; text-align:center;">Asistencia</th><th style="padding:8px; text-align:right;">Horas Día</th><th style="padding:8px; text-align:right;">Horas Acumuladas</th></tr></thead>
        <tbody>${tablaPersonalHTML || "<tr><td colspan='4' style='text-align:center; padding:8px;'>Sin firmas registradas hoy.</td></tr>"}</tbody>
      </table>
      
      <h4 style="color: #1E3A8A; border-left: 4px solid #EA580C; padding-left: 8px;">Utilización de Materiales y Saldos en Bodega</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead><tr style="background-color: #4B5563; color: white;"><th style="padding:8px; text-align:left;">Material</th><th style="padding:8px; text-align:right;">Consumo Día</th><th style="padding:8px; text-align:right;">Consumo Acumulado</th><th style="padding:8px; text-align:right;">Saldo Bodega</th></tr></thead>
        <tbody>${tablaMaterialesHTML || "<tr><td colspan='4' style='text-align:center; padding:8px;'>Sin movimientos de bodega hoy.</td></tr>"}</tbody>
      </table>
    </body>
    </html>`;
  
  var blobHTML = Utilities.newBlob(htmlCuerpo, "text/html", "Informe_Diario_" + obra);
  var pdfFile = blobHTML.getAs("application/pdf").setName("Informe_Diario_" + obra + "_" + fechaStr + ".pdf");
  
  MailApp.sendEmail({
    to: destinatario,
    subject: "📢 INFORME DIARIO DE GESTIÓN: " + obra + " [" + fechaStr + "]",
    body: "Adjuntamos el reporte diario consolidado de control operacional.",
    attachments: [pdfFile]
  });
}

function generarGraficoCurvaCalendarioChile(obra, resumenPartidas, fechaHoyStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); var sheetAvances = ss.getSheetByName("Avances_Produccion_Partidas");
  var fechaInicio = new Date(); fechaInicio.setDate(fechaInicio.getDate() - 14);
  
  if (sheetAvances) {
    var dataAv = sheetAvances.getDataRange().getValues(); var fechasObra = [];
    for(var r=1; r<dataAv.length; r++) { if(dataAv[r][1] == obra && dataAv[r][0]) { fechasObra.push(new Date(dataAv[r][0])); } }
    if(fechasObra.length > 0) { fechasObra.sort((a,b) => a - b); fechaInicio = new Date(fechasObra[0].getTime()); }
  }
  
  fechaInicio.setHours(0,0,0,0); var fechaFin = new Date(); fechaFin.setHours(0,0,0,0);
  var totalBudgetGlobal = 0; var dailyTargetGlobal = 0;
  for (var k in resumenPartidas) { totalBudgetGlobal += resumenPartidas[k].meta; dailyTargetGlobal += resumenPartidas[k].rendimiento; }
  if(totalBudgetGlobal === 0) totalBudgetGlobal = 1;
  
  var chartData = Charts.newDataTable().addColumn(Charts.ColumnType.STRING, "Fecha").addColumn(Charts.ColumnType.NUMBER, "% Proyectado").addColumn(Charts.ColumnType.NUMBER, "% Real");
  var acumuladoRealUnidades = 0; var acumuladoProyectadoUnidades = 0;
  
  var loopDate = new Date(fechaInicio.getTime());
  while (loopDate <= fechaFin) {
    var dStr = Utilities.formatDate(loopDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    var labelStr = Utilities.formatDate(loopDate, Session.getScriptTimeZone(), "dd-MM");
    var dayOfWeek = loopDate.getDay();
    
    // Solo los días hábiles suman al rendimiento esperado del proyecto
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { acumuladoProyectadoUnidades += dailyTargetGlobal; }
    var pctProyectado = (acumuladoProyectadoUnidades / totalBudgetGlobal) * 100;
    if (pctProyectado > 100) pctProyectado = 100;
    
    var unidadesHoy = 0;
    if (sheetAvances) {
      var dataAv = sheetAvances.getDataRange().getValues();
      for(var r=1; r<dataAv.length; r++) {
        var avFechaStr = Utilities.formatDate(new Date(dataAv[r][0]), Session.getScriptTimeZone(), "yyyy-MM-dd");
        if(dataAv[r][1] == obra && avFechaStr === dStr) { unidadesHoy += (parseFloat(dataAv[r][6]) || 0); }
      }
    }
    acumuladoRealUnidades += unidadesHoy;
    var pctReal = (acumuladoRealUnidades / totalBudgetGlobal) * 100;
    
    chartData.addRow([labelStr, pctProyectado, pctReal]);
    loopDate.setDate(loopDate.getDate() + 1);
  }
  
  var chart = Charts.newLineChart().setDataTable(chartData).setColors(["#1A365D", "#F60"]).setBackgroundColor("#FAFAFA").setDimensions(340, 190).setOption("legend", {position: "bottom"}).setOption("hAxis", {slantedText: true, slantedTextAngle: 45}).build();
  return Utilities.base64Encode(chart.getAs("image/png").getBytes());
}

function generarGraficoColumnasInvertido(dias, datosBarras) {
  var chartData = Charts.newDataTable().addColumn(Charts.ColumnType.STRING, "Día").addColumn(Charts.ColumnType.NUMBER, "Producción");
  dias.forEach(function(dStr) { chartData.addRow([dStr.substring(5), datosBarras[dStr] || 0]); });
  var chart = Charts.newColumnChart().setDataTable(chartData).setColors(["#1E3A8A"]).setBackgroundColor("#FAFAFA").setDimensions(340, 190).setOption("legend", {position: "none"}).build();
  return Utilities.base64Encode(chart.getAs("image/png").getBytes());
}

function guardarYEnviarFormularioDigital(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Guardar registro en la hoja de cálculo "Registros_Digitales"
    var sheet = ss.getSheetByName("Registros_Digitales");
    if (!sheet) {
      sheet = ss.insertSheet("Registros_Digitales");
      sheet.appendRow([
        "Fecha", "Obra", "Código Formulario", "Nombre Formulario", 
        "Supervisor", "Operador/Trabajador", "Equipo", "Tipo Template", 
        "Detalles Respuestas", "Observaciones"
      ]);
      // Dar formato en negrita a la primera fila
      sheet.getRange("A1:J1").setFontWeight("bold").setBackground("#f1f5f9");
    }
    
    // Asegurar columnas K y L en Registros_Digitales
    if (sheet.getLastColumn() < 11) {
      sheet.getRange(1, 11).setValue("RUT Trabajador Vinculado");
    }
    if (sheet.getLastColumn() < 12) {
      sheet.getRange(1, 12).setValue("Usuario Portal");
    }

    var fecha = new Date();
    var respuestasJson = JSON.stringify(datos.respuestas);
    sheet.appendRow([
      fecha,
      datos.obra,
      datos.codigoFormulario || "N/A",
      datos.nombreFormulario,
      datos.supervisor,
      datos.operador,
      datos.equipo || "N/A",
      datos.tipoTemplate,
      respuestasJson,
      datos.observaciones || "",
      datos.usuarioRUT || "",
      datos.usuarioActivo || ""
    ]);
    
    // 2. Determinar destinatarios desde Config_Correos usando filtros avanzados de obra
    var dests = obtenerDestinatariosConfig("Registros Digitales", datos.obra);
    
    // Buscar el correo del usuario activo de la sesión
    var activeUserEmail = "";
    var userSheet = ss.getSheetByName("Usuarios");
    if (userSheet && datos.usuarioActivo) {
      var uData = userSheet.getDataRange().getValues();
      for (var u = 1; u < uData.length; u++) {
        if (uData[u][0] && uData[u][0].toString().trim().toLowerCase() === datos.usuarioActivo.toString().trim().toLowerCase()) {
          activeUserEmail = uData[u][6] ? uData[u][6].toString().trim() : "";
          break;
        }
      }
    }
    
    // Unificar y desduplicar destinatarios
    var emailList = [];
    if (dests) {
      dests.split(",").forEach(function(email) {
        var clean = email.trim();
        if (clean && emailList.indexOf(clean) === -1) {
          emailList.push(clean);
        }
      });
    }
    if (activeUserEmail) {
      var cleanActive = activeUserEmail.trim();
      if (cleanActive && emailList.indexOf(cleanActive) === -1) {
        emailList.push(cleanActive);
      }
    }
    var finalDests = emailList.join(",");
    
    // 3. Construir plantilla HTML para el PDF
    var logoHtml = LOGO_BASE64 ? '<img src="data:image/png;base64,' + LOGO_BASE64 + '" style="width: 130px;" />' : '<h2 style="color:#1e3a8a;margin:0;">EMIN</h2>';
    
    var htmlContent = '<html><head><style>' +
      'body { font-family: sans-serif; font-size: 11px; color: #334155; margin: 0; padding: 10px; }' +
      '.header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }' +
      '.header-table td { border: 1px solid #e2e8f0; padding: 10px; vertical-align: middle; }' +
      '.title { font-weight: bold; font-size: 13px; text-transform: uppercase; color: #1e3a8a; }' +
      '.subtitle { font-size: 10px; color: #64748b; font-weight: normal; margin-top: 2px; }' +
      '.section-title { font-weight: bold; font-size: 11px; color: #1e3a8a; background-color: #f8fafc; padding: 6px 10px; margin-top: 15px; margin-bottom: 8px; border-left: 4px solid #1e3a8a; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.5px; }' +
      '.data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }' +
      '.data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 7px 10px; text-align: left; }' +
      '.data-table th { background-color: #f1f5f9; font-weight: bold; color: #475569; width: 35%; }' +
      '.data-table td { color: #334155; }' +
      '.resp-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }' +
      '.resp-table th, .resp-table td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }' +
      '.resp-table th { background-color: #f1f5f9; font-weight: bold; color: #475569; }' +
      '.badge { font-weight: bold; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-size: 9px; }' +
      '.obs-box { font-size: 10px; line-height: 1.4; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; color: #334155; margin-bottom: 15px; }' +
      '.signature-area { margin-top: 40px; width: 100%; border-collapse: collapse; }' +
      '.signature-area td { width: 50%; border: none; padding: 10px; }' +
      '.signature-box { border-top: 1px solid #94a3b8; width: 220px; text-align: center; padding-top: 6px; font-size: 9px; color: #64748b; margin: 0 auto; }' +
      '</style></head><body>';
      
    htmlContent += '<table class="header-table"><tr>' +
      '<td style="width: 30%; text-align: center; background-color: #ffffff;">' + logoHtml + '</td>' +
      '<td style="text-align: center; background-color: #ffffff;">' +
        '<span class="title">REGISTRO OPERACIONAL DIGITAL</span><br/>' +
        '<span style="font-weight: bold; font-size: 11px; color: #334155;">' + datos.nombreFormulario + '</span>' +
      '</td>' +
      '<td style="width: 30%; text-align: center; font-size: 9px; color: #64748b; background-color: #ffffff;">' +
        '<b>Código:</b> ' + (datos.codigoFormulario || 'RG-PCM-14-09') + '<br/>' +
        '<b>Fecha:</b> ' + Utilities.formatDate(fecha, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + '<br/>' +
        '<b>Revisión:</b> 13' +
      '</td>' +
      '</tr></table>';
      
    // Datos Generales
    htmlContent += '<div class="section-title">Datos Generales de Control</div>';
    htmlContent += '<table class="data-table">' +
      '<tr><th>Proyecto / Obra</th><td>' + datos.obra + '</td></tr>' +
      '<tr><th>Supervisor / Inspector EMIN</th><td>' + datos.supervisor + '</td></tr>' +
      '<tr><th>Operador / Trabajador</th><td>' + datos.operador + '</td></tr>' +
      '<tr><th>Equipo / Código / Patente</th><td>' + (datos.equipo || 'N/A') + '</td></tr>' +
      '</table>';
      
    // Respuestas / Cuestionario
    htmlContent += '<div class="section-title">Evaluación / Respuestas del Registro</div>';
    
    if (datos.tipoTemplate === "inspeccion") {
      htmlContent += '<table class="resp-table"><thead><tr><th style="width: 70%;">Concepto Evaluado</th><th style="text-align: center; width: 30%;">Evaluación</th></tr></thead><tbody>';
      var respKeys = Object.keys(datos.respuestas);
      for (var r = 0; r < respKeys.length; r++) {
        var key = respKeys[r];
        var val = datos.respuestas[key];
        var color = "#475569";
        var bgColor = "#f1f5f9";
        if (val === "B") { color = "#16a34a"; bgColor = "#f0fdf4"; val = "Bueno (B)"; }
        else if (val === "M") { color = "#dc2626"; bgColor = "#fef2f2"; val = "Malo (M)"; }
        else if (val === "N/A") { color = "#475569"; bgColor = "#f8fafc"; val = "No Aplica"; }
        
        htmlContent += '<tr>' +
          '<td>' + key + '</td>' +
          '<td style="text-align: center;"><span class="badge" style="color: ' + color + '; background-color: ' + bgColor + '; border: 1px solid ' + color + '22;">' + val + '</span></td>' +
          '</tr>';
      }
      htmlContent += '</tbody></table>';
    } else {
      // Para reporte o registro, listar llave-valor en tabla estándar
      htmlContent += '<table class="resp-table"><tbody>';
      var respKeys = Object.keys(datos.respuestas);
      for (var r = 0; r < respKeys.length; r++) {
        var key = respKeys[r];
        var val = datos.respuestas[key];
        htmlContent += '<tr>' +
          '<th style="width: 35%; background-color:#f8fafc; font-weight:bold; color:#475569;">' + key + '</th>' +
          '<td>' + (val ? val.toString().replace(/\n/g, "<br/>") : "") + '</td>' +
          '</tr>';
      }
      htmlContent += '</tbody></table>';
    }
    
    // Observaciones
    if (datos.observaciones) {
      htmlContent += '<div class="section-title">Comentarios y Observaciones Generales</div>';
      htmlContent += '<div class="obs-box">' + datos.observaciones.replace(/\n/g, "<br/>") + '</div>';
    }
    
    // Firmas con imagen dibujada
    var firmaSupervisorHtml = datos.firmaBase64 ? '<img src="' + datos.firmaBase64 + '" style="height: 55px; max-width: 200px; display: block; margin: 0 auto 5px auto;" /><br/>' : '<br/><br/><br/>';
    
    var showOperadorFirma = true;
    if (datos.codigoFormulario === "RG-PCM-14-03" || !datos.operador || datos.operador === "N/A" || datos.operador.toString().trim() === "") {
      showOperadorFirma = false;
    }
    
    htmlContent += '<table class="signature-area"><tr>';
    if (showOperadorFirma) {
      htmlContent += '<td><div class="signature-box">' + firmaSupervisorHtml + 'Firma Supervisor EMIN<br/><b>' + datos.supervisor + '</b><br/>Validado en Sistema</div></td>' +
        '<td><div class="signature-box"><br/><br/><br/>Firma Operador / Trabajador<br/><b>' + datos.operador + '</b><br/>Validado en Sistema</div></td>';
    } else {
      htmlContent += '<td style="width: 100%;"><div class="signature-box" style="width: 250px; margin: 0 auto;">' + firmaSupervisorHtml + 'Firma Supervisor EMIN<br/><b>' + datos.supervisor + '</b><br/>Validado en Sistema</div></td>';
    }
    htmlContent += '</tr></table>';
    // Firmas de Colaboradores si aplica
    if (datos.colaboradores && datos.colaboradores.length > 0) {
      htmlContent += '<div class="section-title">Firmas del Personal / Colaboradores Participantes</div>';
      htmlContent += '<table class="resp-table"><thead><tr>' +
        '<th style="width: 40%;">Nombre / RUT</th>' +
        '<th style="width: 25%; text-align: center;">Condición de Salud</th>' +
        '<th style="width: 35%; text-align: center;">Firma Digital</th>' +
        '</tr></thead><tbody>';
        
      for (var c = 0; c < datos.colaboradores.length; c++) {
        var colab = datos.colaboradores[c];
        var colabFirmaHtml = colab.firma ? '<img src="' + colab.firma + '" style="height: 35px; max-width: 150px; display: block; margin: 0 auto;" />' : '<span style="font-size: 8px; color: #94a3b8;">No firmó</span>';
        var condColor = colab.condicion === "Apto" ? "#16a34a" : "#dc2626";
        var condBg = colab.condicion === "Apto" ? "#f0fdf4" : "#fef2f2";
        
        htmlContent += '<tr>' +
          '<td><b>' + colab.nombre + '</b><br/><span style="font-size: 9px; color: #64748b;">RUT: ' + colab.rut + '</span></td>' +
          '<td style="text-align: center;"><span class="badge" style="color: ' + condColor + '; background-color: ' + condBg + '; border: 1px solid ' + condColor + '22;">' + (colab.condicion === "Apto" ? "Apto para Trabajar" : "No Apto") + '</span></td>' +
          '<td style="text-align: center; vertical-align: middle;">' + colabFirmaHtml + '</td>' +
          '</tr>';
      }
      htmlContent += '</tbody></table>';
    }
      
    // Registro Fotográfico si aplica
    if (datos.fotos && (datos.fotos.foto1 || datos.fotos.foto2 || datos.fotos.foto3)) {
      htmlContent += '<div class="section-title">Registro Fotográfico de Terreno</div>';
      htmlContent += '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;"><tr>';
      var colCount = 0;
      if (datos.fotos.foto1) {
        htmlContent += '<td style="width: 33%; text-align: center; padding: 5px; border: 1px solid #e2e8f0; background-color: #ffffff;"><img src="' + datos.fotos.foto1 + '" style="width: 100%; max-height: 140px; object-fit: contain; border-radius: 4px;" /><br/><span style="font-size: 8px; color: #64748b;">Evidencia Fotográfica 1</span></td>';
        colCount++;
      }
      if (datos.fotos.foto2) {
        htmlContent += '<td style="width: 33%; text-align: center; padding: 5px; border: 1px solid #e2e8f0; background-color: #ffffff;"><img src="' + datos.fotos.foto2 + '" style="width: 100%; max-height: 140px; object-fit: contain; border-radius: 4px;" /><br/><span style="font-size: 8px; color: #64748b;">Evidencia Fotográfica 2</span></td>';
        colCount++;
      }
      if (datos.fotos.foto3) {
        htmlContent += '<td style="width: 33%; text-align: center; padding: 5px; border: 1px solid #e2e8f0; background-color: #ffffff;"><img src="' + datos.fotos.foto3 + '" style="width: 100%; max-height: 140px; object-fit: contain; border-radius: 4px;" /><br/><span style="font-size: 8px; color: #64748b;">Evidencia Fotográfica 3</span></td>';
        colCount++;
      }
      for (var c = colCount; c < 3; c++) {
        htmlContent += '<td style="width: 33%; border: none; background-color: transparent;"></td>';
      }
      htmlContent += '</tr></table>';
    }
      
    htmlContent += '</body></html>';
    
    // Generar PDF Blob
    var blobHTML = HtmlService.createHtmlOutput(htmlContent);
    var filename = (datos.codigoFormulario || "REG") + "_" + datos.nombreFormulario.replace(/\s+/g, "_") + "_" + Utilities.formatDate(fecha, Session.getScriptTimeZone(), "yyyyMMdd_HHmm") + ".pdf";
    var blob = blobHTML.getAs("application/pdf").setName(filename);
    
    // 4. Despachar por correo
    var subject = "Registro Digital EMIN [" + (datos.codigoFormulario || "RG-PCM-14-09") + "] - " + datos.nombreFormulario + " (Obra: " + datos.obra + ")";
    var body = "Estimado/a,\\n\\nSe ha completado un nuevo registro operacional en formato digital desde el Portal de Proyectos de EMIN Sistemas Geotécnicos.\\n\\n" +
      "Resumen de Transacción:\\n" +
      "- Formulario: " + datos.nombreFormulario + "\\n" +
      "- Código Oficial: " + (datos.codigoFormulario || "N/A") + "\\n" +
      "- Obra/Proyecto: " + datos.obra + "\\n" +
      "- Realizado por: " + datos.supervisor + "\\n" +
      "- Operador/Trabajador: " + datos.operador + "\\n" +
      "- Fecha y Hora: " + Utilities.formatDate(fecha, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + "\\n\\n" +
      "Se adjunta el reporte oficial firmado en formato PDF para su archivo e inspección.\\n\\nAtentamente,\\nPortal de Proyectos EMIN Sistemas Geotécnicos";
      
    MailApp.sendEmail({
      to: finalDests,
      subject: subject,
      body: body,
      attachments: [blob]
    });
    
    return { exito: true };
  } catch(e) {
    return { exito: false, error: e.toString() };
  }
}

function obtenerDestinatariosConfig(tipoReporte, obraNombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Config_Correos");
  var dests = [];
  var defaultDests = [];
  
  var defaultEmail = "imunozp@eminsg.cl";
  if (tipoReporte === "Uso Maquinaria" || tipoReporte === "Alta Maquinaria" || tipoReporte === "Ingreso equipo") {
    defaultEmail = "maquinaria@eminsg.cl";
  }
  
  if (sheet) {
    var configData = sheet.getDataRange().getValues();
    for (var i = 1; i < configData.length; i++) {
      var rowTipo = configData[i][0] ? configData[i][0].toString().trim().toLowerCase() : "";
      var rowEmails = configData[i][1] ? configData[i][1].toString().trim() : "";
      var rowFiltro = configData[i][2] ? configData[i][2].toString().trim().toLowerCase() : "";
      
      if (rowTipo === tipoReporte.toLowerCase() && rowEmails) {
        var emailsArray = rowEmails.split(",").map(function(e) { return e.trim(); }).filter(function(e) { return e !== ""; });
        
        if (!rowFiltro) {
          defaultDests = defaultDests.concat(emailsArray);
        } else {
          var filtros = rowFiltro.split(",").map(function(f) { return f.trim(); }).filter(function(f) { return f !== ""; });
          var obraLimpia = obraNombre ? obraNombre.toLowerCase() : "";
          var coincide = false;
          for (var f = 0; f < filtros.length; f++) {
            if (obraLimpia.indexOf(filtros[f]) >= 0) {
              coincide = true;
              break;
            }
          }
          if (coincide) {
            dests = dests.concat(emailsArray);
          }
        }
      }
    }
  }
  
  var finalDests = dests.concat(defaultDests);
  var uniqueDests = finalDests.filter(function(item, index) {
    return finalDests.indexOf(item) === index;
  });
  
  if (uniqueDests.length === 0) {
    return defaultEmail;
  }
  return uniqueDests.join(",");
}
