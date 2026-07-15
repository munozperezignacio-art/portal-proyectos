function doGet(e) {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Portal de proyectos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function loginUsuario(usuario, empresa, contrasena) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Usuarios");
    if (!sheet) return { exito: false, mensaje: "Error: Pestaña 'Usuarios' no encontrada." };
    
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().trim() === usuario.trim() &&
          data[i][1].toString().trim() === empresa.trim() &&
          data[i][2].toString().trim() === contrasena.trim()) {
        return {
          exito: true,
          rol: data[i][3],
          obras: data[i][4],
          modulos: data[i][5]
        };
      }
    }
    return { exito: false, mensaje: "Credenciales de acceso incorrectas." };
  } catch(e) {
    return { exito: false, mensaje: "Error en servidor login: " + e.toString() };
  }
}

function obtenerTodasObras() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Obras");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        lista.push({ 
          nombre: data[i][0].toString().trim(), 
          tipo: data[i][1] ? data[i][1].toString().trim() : "", 
          link: data[i][2] ? data[i][2].toString().trim() : "",
          area: data[i][3] ? data[i][3].toString().trim() : "",
          administrador: data[i][4] ? data[i][4].toString().trim() : "",
          oficinaTecnica: data[i][5] ? data[i][5].toString().trim() : "",
          prevencionista: data[i][6] ? data[i][6].toString().trim() : ""
        });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function obtenerTodosUsuarios() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Usuarios");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        lista.push({ 
          usuario: data[i][0], 
          empresa: data[i][1], 
          contrasena: data[i][2], 
          rol: data[i][3], 
          obras: data[i][4], 
          modulos: data[i][5],
          correo: data[i][6] || "",
          trabajadorRut: data[i][7] || ""
        });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function obtenerTodoElPersonal() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Maestro_Personal");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][1]) {
        lista.push({ 
          obra: data[i][0], 
          nombre: data[i][1], 
          rut: data[i][2], 
          cargo: data[i][3], 
          inicio: data[i][4], 
          termino: data[i][5],
          colacion: data[i][6] || 0,
          movilizacion: data[i][7] || 0
        });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function obtenerPersonalDeObra(obra) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Maestro_Personal");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    var obraLimpia = obra.toString().trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === obraLimpia) {
        lista.push({ 
          nombre: data[i][1], 
          rut: data[i][2], 
          cargo: data[i][3],
          colacion: data[i][6] || 0,
          movilizacion: data[i][7] || 0
        });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function obtenerMaquinariaDeObra(obra) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Inventario_Maquinaria");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    var obraLimpia = obra.toString().trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      if (data[i][3] && data[i][3].toString().trim().toLowerCase() === obraLimpia) {
        lista.push({ tipo: data[i][0], patente: data[i][1], marca: data[i][2] });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function obtenerPartidasDeObra(obra) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Partidas_Obra");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    var obraLimpia = obra.toString().trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === obraLimpia) {
        lista.push({ partida: data[i][1], unidad: data[i][2] });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function obtenerConfigCorreos() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Config_Correos");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        lista.push({ tipo: data[i][0], correos: data[i][1], filtro: data[i][2] || "" });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function guardarConfigCorreo(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Config_Correos");
    if (!sheet) return { exito: false, error: "Pestaña 'Config_Correos' no encontrada." };
    var data = sheet.getDataRange().getValues();
    var filaModificada = -1;
    var nuevoFiltro = datos.filtro ? datos.filtro.toString().trim().toLowerCase() : "";
    for (var i = 1; i < data.length; i++) {
      var rowTipo = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
      var rowFiltro = data[i][2] ? data[i][2].toString().trim().toLowerCase() : "";
      if (rowTipo === datos.tipo.toString().trim().toLowerCase() && rowFiltro === nuevoFiltro) {
        filaModificada = i + 1;
        break;
      }
    }
    if (filaModificada !== -1) {
      sheet.getRange(filaModificada, 2).setValue(datos.correos);
    } else {
      sheet.appendRow([datos.tipo, datos.correos, datos.filtro || ""]);
    }
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function guardarMovimientoMaterialBulk(datosObra, listaMateriales) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Inventario_Materiales");
    if (!sheet) return { exito: false, error: "Pestaña 'Inventario_Materiales' no existe." };
    
    var fecha = new Date();
    for (var i = 0; i < listaMateriales.length; i++) {
      var item = listaMateriales[i];
      sheet.appendRow([
        fecha,
        datosObra.obra,
        datosObra.guia || "N/A",
        datosObra.tipoMovimiento,
        item.material,
        parseFloat(item.cantidad) || 0
      ]);
    }
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function obtenerInventarioMateriales(obra) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Inventario_Materiales");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var resumen = {};
    var obraLimpia = obra.toString().trim().toLowerCase();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] && data[i][1].toString().trim().toLowerCase() === obraLimpia) {
        var mat = data[i][4];
        var tipo = data[i][3].toString().toUpperCase();
        var cant = parseFloat(data[i][5]) || 0;
        if (!resumen[mat]) resumen[mat] = { ingresos: 0, consumos: 0 };
        if (tipo === "INGRESO") resumen[mat].ingresos += cant;
        if (tipo === "USO") resumen[mat].consumos += cant;
      }
    }
    var lista = [];
    for (var key in resumen) {
      lista.push({ material: key, stock: (resumen[key].ingresos - resumen[key].consumos) });
    }
    return lista;
  } catch(e) { return []; }
}

function guardarArchivoEnDrive(base64Data, nombreArchivo, folderId) {
  try {
    var splitData = base64Data.split(",");
    var contentType = splitData[0].match(/:(.*?);/)[1];
    var rawFile = Utilities.base64Decode(splitData[1]);
    var blob = Utilities.newBlob(rawFile, contentType, nombreArchivo);
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch(err) { return ""; }
}

function guardarIngresoMaquinaria(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Inventario_Maquinaria");
    var folderId = "12-SDRydJ1jPHdZiZ4kKfeH_SPYjg6zdX"; 
    
    var urlFrontal = datos.fotoFrontal ? guardarArchivoEnDrive(datos.fotoFrontal, "Frontal_" + datos.patente, folderId) : "";
    var urlIzquierda = datos.fotoIzquierda ? guardarArchivoEnDrive(datos.fotoIzquierda, "Izquierda_" + datos.patente, folderId) : "";
    var urlDerecha = datos.fotoDerecha ? guardarArchivoEnDrive(datos.fotoDerecha, "Derecha_" + datos.patente, folderId) : "";
    var urlPosterior = datos.fotoPosterior ? guardarArchivoEnDrive(datos.fotoPosterior, "Posterior_" + datos.patente, folderId) : "";
    
    sheet.appendRow([
      datos.tipo, datos.patente, datos.marca, datos.obra, parseFloat(datos.horometroInicial) || 0,
      urlFrontal, urlIzquierda, urlDerecha, urlPosterior, datos.tipoActivo || "Propio", datos.registradoPor || ""
    ]);
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function guardarReporteMaquinaria(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Reporte_Maquinaria");
    if (!sheet) return { exito: false, error: "Pestaña 'Reporte_Maquinaria' no existe." };
    
    var data = sheet.getDataRange().getValues();
    var hoyStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1] && data[i][4]) {
        var rowFechaStr = Utilities.formatDate(new Date(data[i][0]), Session.getScriptTimeZone(), "yyyy-MM-dd");
        if (rowFechaStr === hoyStr && 
            data[i][1].toString().trim().toLowerCase() === datos.obra.toString().trim().toLowerCase() &&
            data[i][4].toString().trim().toLowerCase() === datos.maquinaria.toString().trim().toLowerCase()) {
          return { exito: false, error: "Ya se ingresó el parte diario para este equipo el día de hoy." };
        }
      }
    }
    
    var fecha = new Date();
    var hUso = (parseFloat(datos.horometroSalida) || 0) - (parseFloat(datos.horometroEntrada) || 0);
    sheet.appendRow([
      fecha, datos.obra, datos.operador, datos.supervisor, datos.maquinaria,
      parseFloat(datos.horometroEntrada) || 0, parseFloat(datos.horometroSalida) || 0,
      parseFloat(datos.litrosCombustible) || 0, parseFloat(datos.horometroCombustible) || 0,
      datos.paralizacion, datos.observaciones
    ]);
    
    // --- Despachar Reporte Diario por Correo ---
    try {
      var dests = obtenerDestinatariosConfig("Uso Maquinaria", datos.obra);
      var logoHtml = LOGO_BASE64 ? '<img src="data:image/png;base64,' + LOGO_BASE64 + '" style="width: 130px;" />' : '<h2 style="color:#1e3a8a;margin:0;">EMIN</h2>';
      
      var htmlContent = '<html><head><style>' +
        'body { font-family: sans-serif; font-size: 11px; color: #334155; margin: 0; padding: 20px; }' +
        '.header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }' +
        '.header-table td { border: 1px solid #e2e8f0; padding: 10px; vertical-align: middle; }' +
        '.title { font-weight: bold; font-size: 13px; text-transform: uppercase; color: #1e3a8a; }' +
        '.subtitle { font-size: 10px; color: #64748b; font-weight: normal; margin-top: 2px; }' +
        '.section-title { font-weight: bold; font-size: 11px; color: #1e3a8a; background-color: #f8fafc; padding: 6px 10px; margin-top: 15px; margin-bottom: 8px; border-left: 4px solid #1e3a8a; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }' +
        '.data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }' +
        '.data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }' +
        '.data-table th { background-color: #f1f5f9; font-weight: bold; color: #475569; width: 35%; }' +
        '.obs-box { font-size: 10px; line-height: 1.4; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; color: #334155; }' +
        '</style></head><body>' +
        '<table class="header-table"><tr>' +
        '<td style="width: 150px; text-align: center;">' + logoHtml + '</td>' +
        '<td><div class="title">Parte Diario de Control de Maquinaria</div>' +
        '<div class="subtitle">EMIN Sistemas Geotécnicos - Control Operacional de Flota</div></td>' +
        '</tr></table>' +
        
        '<div class="section-title">Información General</div>' +
        '<table class="data-table">' +
        '<tr><th>Obra / Proyecto</th><td>' + datos.obra + '</td></tr>' +
        '<tr><th>Fecha de Registro</th><td>' + Utilities.formatDate(fecha, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + '</td></tr>' +
        '<tr><th>Supervisor Encargado</th><td>' + datos.supervisor + '</td></tr>' +
        '<tr><th>Operador / Trabajador</th><td>' + datos.operador + '</td></tr>' +
        '</table>' +
        
        '<div class="section-title">Control de Horómetro y Uso</div>' +
        '<table class="data-table">' +
        '<tr><th>Equipo / Maquinaria</th><td>' + datos.maquinaria + '</td></tr>' +
        '<tr><th>Horómetro de Entrada</th><td>' + datos.horometroEntrada + ' Hrs</td></tr>' +
        '<tr><th>Horómetro de Salida</th><td>' + datos.horometroSalida + ' Hrs</td></tr>' +
        '<tr><th>Total Horas de Uso</th><td style="font-weight: bold; color: #1e3a8a;">' + hUso.toFixed(2) + ' Hrs</td></tr>' +
        '</table>' +
        
        '<div class="section-title">Abastecimiento y Combustible</div>' +
        '<table class="data-table">' +
        '<tr><th>Combustible Cargado</th><td>' + (datos.litrosCombustible || 0) + ' Litros</td></tr>' +
        '<tr><th>Horómetro de Carga</th><td>' + (datos.horometroCombustible || 0) + ' Hrs</td></tr>' +
        '</table>' +
        
        '<div class="section-title">Estado de Operación</div>' +
        '<table class="data-table">' +
        '<tr><th>Paralización / Detención</th><td>' + (datos.paralizacion || "No registra paralizaciones") + '</td></tr>' +
        '</table>';
        
      if (datos.observaciones) {
        htmlContent += '<div class="section-title">Observaciones / Comentarios</div>' +
          '<div class="obs-box">' + datos.observaciones + '</div>';
      }
      
      htmlContent += '</body></html>';
      
      var blobHTML = HtmlService.createHtmlOutput(htmlContent);
      var pdfFilename = "Parte_Diario_Maquinaria_" + datos.maquinaria.replace(/\s+/g, "_") + "_" + Utilities.formatDate(fecha, Session.getScriptTimeZone(), "yyyyMMdd") + ".pdf";
      var pdfBlob = blobHTML.getAs("application/pdf").setName(pdfFilename);
      
      var subject = "🚜 Parte Diario Maquinaria: " + datos.maquinaria + " (Obra: " + datos.obra + ")";
      var body = "Estimado/a,\n\nSe adjunta el reporte diario de horómetro y control de combustible para el equipo indicado.\n\nAtentamente,\nPortal de Proyectos EMIN Sistemas Geotécnicos";
      
      MailApp.sendEmail({
        to: dests,
        subject: subject,
        body: body,
        attachments: [pdfBlob]
      });
      
    } catch(errMail) {
      Logger.log("Error al despachar correo de maquinaria: " + errMail.toString());
    }
    
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function guardarAsistenciaPersonal(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Asistencia_Personal");
    if (!sheet) return { exito: false, error: "Pestaña 'Asistencia_Personal' no encontrada." };
    
    var data = sheet.getDataRange().getValues();
    var hoyStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1] && data[i][3]) {
        var rowFechaStr = Utilities.formatDate(new Date(data[i][0]), Session.getScriptTimeZone(), "yyyy-MM-dd");
        if (rowFechaStr === hoyStr && 
            data[i][1].toString().trim().toLowerCase() === datos.obra.toString().trim().toLowerCase() &&
            data[i][3].toString().trim().toLowerCase() === datos.trabajador.toString().trim().toLowerCase()) {
          return { exito: false, error: "Este trabajador ya tiene registrada su asistencia para el día de hoy." };
        }
      }
    }
    
    var horasOrdinarias = 0;
    var horasExtrasAuto = 0;
    var colacion = datos.colacion || "NO";
    var horasExtrasManual = parseFloat(datos.horasExtrasManual) || 0;
    
    if (datos.asistencia === "PRESENTE" && datos.ingreso && datos.salida) {
      var tIngreso = datos.ingreso.split(":");
      var tSalida = datos.salida.split(":");
      var minIngreso = parseInt(tIngreso[0]) * 60 + parseInt(tIngreso[1]);
      var minSalida = parseInt(tSalida[0]) * 60 + parseInt(tSalida[1]);
      var diffHrs = (minSalida - minIngreso) / 60;
      
      var dayOfWeek = new Date().getDay(); 
      var deduction = 0;
      
      if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Lunes a Jueves
        // Se descuenta 1 hora de colación si coinciden con el periodo de almuerzo (13:00 a 14:00)
        if (minIngreso <= 13*60 && minSalida >= 14*60) {
          deduction = 1.0;
        }
        var effectiveHours = Math.max(0, diffHrs - deduction);
        horasOrdinarias = Math.min(9.0, effectiveHours);
        horasExtrasAuto = Math.max(0, effectiveHours - 9.0);
      } else if (dayOfWeek === 5) { // Viernes
        // Si se extiende después de las 14:00 y se consideró colación
        if (colacion === "SI") {
          deduction = 1.0;
        }
        var effectiveHours = Math.max(0, diffHrs - deduction);
        horasOrdinarias = Math.min(6.0, effectiveHours);
        horasExtrasAuto = Math.max(0, effectiveHours - 6.0);
      } else { // Sábado (6) y Domingo (0)
        // Sabados y domingos siempre son 100% horas extras
        horasOrdinarias = 0;
        horasExtrasAuto = diffHrs;
      }
    }
    
    // Validar límite semanal de 12 horas extras
    var existingOvertime = 0;
    var today = new Date();
    var day = today.getDay();
    var diff = today.getDate() - day + (day === 0 ? -6 : 1);
    var monday = new Date(today.setDate(diff));
    monday.setHours(0,0,0,0);
    
    var rutLimpio = datos.rut.toString().trim().toLowerCase();
    
    for (var i = 1; i < data.length; i++) {
      var rowDate = new Date(data[i][0]);
      var rowRut = data[i][4] ? data[i][4].toString().trim().toLowerCase() : "";
      if (rowRut === rutLimpio && rowDate >= monday) {
        var autoHE = parseFloat(data[i][10]) || 0;
        var manualHE = parseFloat(data[i][11]) || 0;
        existingOvertime += (autoHE + manualHE);
      }
    }
    
    var msgTope = "";
    var totalProposed = existingOvertime + horasExtrasAuto + horasExtrasManual;
    if (totalProposed > 12) {
      var allowedNew = Math.max(0, 12 - existingOvertime);
      if (horasExtrasAuto > allowedNew) {
        horasExtrasAuto = allowedNew;
        horasExtrasManual = 0;
      } else {
        horasExtrasManual = Math.min(horasExtrasManual, allowedNew - horasExtrasAuto);
      }
      var newOvertimeCapped = horasExtrasAuto + horasExtrasManual;
      msgTope = " (Tope de 12 hrs extras semanal alcanzado: se ajustaron a " + newOvertimeCapped.toFixed(1) + " hrs extras hoy)";
    }
    
    sheet.appendRow([
      new Date(), 
      datos.obra, 
      datos.supervisor, 
      datos.trabajador, 
      datos.rut, 
      datos.asistencia,
      datos.ingreso || "", 
      datos.salida || "", 
      datos.asistencia === "PRESENTE" ? colacion : "", 
      horasOrdinarias, 
      horasExtrasAuto, 
      horasExtrasManual
    ]);
    return { exito: true, mensajeTope: msgTope };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function guardarAvanceProduccionGeneric(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Avances_Produccion_Partidas");
    sheet.appendRow([
      new Date(), datos.obra, datos.supervisor, datos.frente, datos.partida, datos.unidad, parseFloat(datos.cantidad) || 0, datos.observaciones
    ]);
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function guardarNuevaObra(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Obras");
    sheet.appendRow([datos.nombre, datos.tipo, datos.linkDrive]);
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function guardarNuevoUsuario(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Usuarios");
    
    var data = sheet.getDataRange().getValues();
    var filaDestino = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().trim().toLowerCase() === datos.usuario.toString().trim().toLowerCase() &&
          data[i][1].toString().trim().toLowerCase() === datos.empresa.toString().trim().toLowerCase()) {
        filaDestino = i + 1;
        break;
      }
    }
    
    // Asegurar encabezados en la hoja Usuarios
    if (sheet.getLastColumn() < 7) {
      sheet.getRange(1, 7).setValue("Correo");
    }
    if (sheet.getLastColumn() < 8) {
      sheet.getRange(1, 8).setValue("TrabajadorRUT");
    }

    if (filaDestino !== -1) {
      sheet.getRange(filaDestino, 3, 1, 6).setValues([[datos.contrasena, datos.rol, datos.obras, datos.modulos, datos.correo, datos.trabajadorRut]]);
    } else {
      sheet.appendRow([datos.usuario, datos.empresa, datos.contrasena, datos.rol, datos.obras, datos.modulos, datos.correo, datos.trabajadorRut]);
    }
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function guardarNuevoPersonal(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Maestro_Personal");
    if (!sheet) {
      sheet = ss.insertSheet("Maestro_Personal");
      sheet.appendRow(["Obra", "Trabajador", "RUT", "Cargo", "Fecha Inicio", "Fecha Término", "Colación", "Movilización"]);
    }
    
    var data = sheet.getDataRange().getValues();
    var filaDestino = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][2].toString().trim().toLowerCase() === datos.rut.toString().trim().toLowerCase()) {
        filaDestino = i + 1;
        break;
      }
    }
    
    var colacion = parseFloat(datos.colacion) || 0;
    var movilizacion = parseFloat(datos.movilizacion) || 0;
    
    var vals = [[
      datos.obra, 
      datos.trabajador, 
      datos.rut, 
      datos.cargo, 
      datos.fechaInicio, 
      datos.fechaTermino,
      colacion,
      movilizacion
    ]];
    
    // Asegurar encabezados para Colación y Movilización
    if (sheet.getLastColumn() < 8) {
      sheet.getRange(1, 7).setValue("Colación");
      sheet.getRange(1, 8).setValue("Movilización");
    }
    
    if (filaDestino !== -1) {
      sheet.getRange(filaDestino, 1, 1, 8).setValues(vals);
    } else {
      sheet.appendRow(vals[0]);
    }
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function guardarNuevaPartida(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Partidas_Obra");
    sheet.appendRow([datos.obra, datos.partida, datos.unidad, parseFloat(datos.rendimiento) || 0, parseFloat(datos.cantidad) || 0, parseFloat(datos.costoDia) || 0]);
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function guardarObraYPartidasBulk(datosObra, listaPartidas) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Guardar o actualizar la obra
    var sheetObras = ss.getSheetByName("Obras");
    if (!sheetObras) return { exito: false, error: "Pestaña 'Obras' no encontrada." };
    
    var dataObras = sheetObras.getDataRange().getValues();
    var filaObra = -1;
    var obraLimpia = datosObra.nombre.toString().trim();
    for (var i = 1; i < dataObras.length; i++) {
      if (dataObras[i][0] && dataObras[i][0].toString().trim().toLowerCase() === obraLimpia.toLowerCase()) {
        filaObra = i + 1;
        break;
      }
    }
    
    var area = datosObra.area || "";
    var administrador = datosObra.administrador || "";
    var oficinaTecnica = datosObra.oficinaTecnica || "";
    var prevencionista = datosObra.prevencionista || "";
    var fechaInicio = datosObra.fechaInicio || "";
    
    if (filaObra !== -1) {
      sheetObras.getRange(filaObra, 2, 1, 7).setValues([[
        datosObra.tipo, 
        datosObra.linkDrive, 
        area, 
        administrador, 
        oficinaTecnica, 
        prevencionista,
        fechaInicio
      ]]);
    } else {
      sheetObras.appendRow([
        obraLimpia, 
        datosObra.tipo, 
        datosObra.linkDrive, 
        area, 
        administrador, 
        oficinaTecnica, 
        prevencionista,
        fechaInicio
      ]);
    }
    
    // 2. Limpiar partidas existentes para esta obra y guardar las nuevas
    var sheetPartidas = ss.getSheetByName("Partidas_Obra");
    if (!sheetPartidas) return { exito: false, error: "Pestaña 'Partidas_Obra' no encontrada." };
    
    var dataPartidas = sheetPartidas.getDataRange().getValues();
    // Eliminar partidas previas de abajo hacia arriba para evitar descalce de índices
    for (var k = dataPartidas.length - 1; k >= 1; k--) {
      if (dataPartidas[k][0] && dataPartidas[k][0].toString().trim().toLowerCase() === obraLimpia.toLowerCase()) {
        sheetPartidas.deleteRow(k + 1);
      }
    }
    
    // Escribir partidas nuevas
    if (listaPartidas && listaPartidas.length > 0) {
      for (var j = 0; j < listaPartidas.length; j++) {
        var p = listaPartidas[j];
        sheetPartidas.appendRow([
          obraLimpia,
          p.partida,
          p.unidad,
          parseFloat(p.rendimiento) || 0,
          parseFloat(p.cantidad) || 0,
          parseFloat(p.costoDia) || 0
        ]);
      }
    }
    return { exito: true };
  } catch(e) {
    return { exito: false, error: e.toString() };
  }
}

function obtenerPartidasDeObra(obra) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Partidas_Obra");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    var obraLimpia = obra.toString().trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === obraLimpia) {
        lista.push({ 
          partida: data[i][1], 
          unidad: data[i][2], 
          rendimiento: data[i][3], 
          cantidad: data[i][4],
          costoDia: data[i][5] || 0
        });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function obtenerMetricasProyecto(obra) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var obraLimpia = obra.toString().trim().toLowerCase();
    
    // 1. Calcular avance físico global del proyecto y avance proyectado
    var sheetPartidas = ss.getSheetByName("Partidas_Obra");
    var partidasData = sheetPartidas ? sheetPartidas.getDataRange().getValues() : [];
    var sheetAvances = ss.getSheetByName("Avances_Produccion_Partidas");
    var avancesData = sheetAvances ? sheetAvances.getDataRange().getValues() : [];
    
    // Buscar fecha de inicio de la obra
    var sheetObras = ss.getSheetByName("Obras");
    var obrasData = sheetObras ? sheetObras.getDataRange().getValues() : [];
    var fechaInicioStr = "";
    for (var o = 1; o < obrasData.length; o++) {
      if (obrasData[o][0] && obrasData[o][0].toString().trim().toLowerCase() === obraLimpia) {
        fechaInicioStr = obrasData[o][7] ? obrasData[o][7].toString().trim() : "";
        break;
      }
    }
    
    var resumenPartidas = {};
    var totalMeta = 0;
    var totalAcumulado = 0;
    
    for (var p = 1; p < partidasData.length; p++) {
      if (partidasData[p][0] && partidasData[p][0].toString().trim().toLowerCase() === obraLimpia) {
        var act = partidasData[p][1];
        var meta = parseFloat(partidasData[p][4]) || 0;
        var rendimiento = parseFloat(partidasData[p][3]) || 0;
        var costoDia = parseFloat(partidasData[p][5]) || 0;
        resumenPartidas[act] = { meta: meta, rendimiento: rendimiento, costoDia: costoDia, acumulado: 0 };
        totalMeta += meta;
      }
    }
    
    for (var a = 1; a < avancesData.length; a++) {
      if (avancesData[a][1] && avancesData[a][1].toString().trim().toLowerCase() === obraLimpia) {
        var part = avancesData[a][4];
        var cant = parseFloat(avancesData[a][6]) || 0;
        if (resumenPartidas[part]) {
          resumenPartidas[part].acumulado += cant;
        }
      }
    }
    
    for (var key in resumenPartidas) {
      totalAcumulado += Math.min(resumenPartidas[key].acumulado, resumenPartidas[key].meta);
    }
    
    var avanceFisicoGlobal = totalMeta > 0 ? (totalAcumulado / totalMeta) * 100 : 0;
    
    // Calcular días hábiles transcurridos y avance proyectado
    var avanceFisicoProyectado = 0;
    if (fechaInicioStr) {
      var fInicio = new Date(fechaInicioStr);
      var fFin = new Date();
      var diasHabiles = 0;
      if (fInicio <= fFin) {
        var cur = new Date(fInicio.getTime());
        while (cur <= fFin) {
          var day = cur.getDay();
          if (day !== 0 && day !== 6) { // Excluir Sábados (6) y Domingos (0)
            diasHabiles++;
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
      
      var totalProjectedAcumulado = 0;
      for (var key in resumenPartidas) {
        var meta = resumenPartidas[key].meta;
        var rendimiento = resumenPartidas[key].rendimiento || 0;
        var proyectadoPartida = diasHabiles * rendimiento;
        totalProjectedAcumulado += Math.min(proyectadoPartida, meta);
      }
      avanceFisicoProyectado = totalMeta > 0 ? (totalProjectedAcumulado / totalMeta) * 100 : 0;
    }
    
    // 2. Calcular Horas Hombre (HH) Acumuladas
    var sheetAsist = ss.getSheetByName("Asistencia_Personal");
    var asistData = sheetAsist ? sheetAsist.getDataRange().getValues() : [];
    var totalHH = 0;
    var trabajadoresUnicos = {};
    
    for (var x = 1; x < asistData.length; x++) {
      if (asistData[x][1] && asistData[x][1].toString().trim().toLowerCase() === obraLimpia) {
        if (asistData[x][5].toString().toUpperCase() === "PRESENTE") {
          var workerID = asistData[x][3].toString().trim();
          trabajadoresUnicos[workerID] = true;
          
          var normalHrs = parseFloat(asistData[x][9]);
          var hhFinalCalculada = 0;
          if (isNaN(normalHrs)) {
            // Fallback para filas antiguas sin columna J
            var rowFecha = new Date(asistData[x][0]);
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
            hhFinalCalculada = horasBaseFaena + horasExtrasAuto + heManual;
          } else {
            // Filas nuevas: suma directa
            hhFinalCalculada = normalHrs + (parseFloat(asistData[x][10]) || 0) + (parseFloat(asistData[x][11]) || 0);
          }
          totalHH += hhFinalCalculada;
        }
      }
    }
    var totalTrabajadores = Object.keys(trabajadoresUnicos).length;
    
    // 3. Calcular Horas de Maquinaria Acumuladas
    var sheetMaq = ss.getSheetByName("Reporte_Maquinaria");
    var maqData = sheetMaq ? sheetMaq.getDataRange().getValues() : [];
    var totalHorasMaq = 0;
    var maquinasUnicas = {};
    
    for (var m = 1; m < maqData.length; m++) {
      if (maqData[m][1] && maqData[m][1].toString().trim().toLowerCase() === obraLimpia) {
        var equipoID = maqData[m][4].toString().trim();
        maquinasUnicas[equipoID] = true;
        var hUsoRow = (parseFloat(maqData[m][6]) || 0) - (parseFloat(maqData[m][5]) || 0);
        totalHorasMaq += hUsoRow;
      }
    }
    var totalMaquinas = Object.keys(maquinasUnicas).length;
    
    return {
      exito: true,
      avanceFisico: avanceFisicoGlobal,
      avanceProyectado: avanceFisicoProyectado,
      totalHH: totalHH,
      totalTrabajadores: totalTrabajadores,
      totalHorasMaq: totalHorasMaq,
      totalMaquinas: totalMaquinas
    };
  } catch(e) {
    return { exito: false, error: e.toString() };
  }
}


function obtenerTodasMaquinarias() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Inventario_Maquinaria");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][1]) {
        lista.push({
          tipo: data[i][0],
          patente: data[i][1],
          marca: data[i][2],
          obra: data[i][3],
          horometroInicial: data[i][4],
          tipoActivo: data[i][9] || "Propio",
          registradoPor: data[i][10] || ""
        });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function asignarEquipoAObra(patente, obra) {
  // Mantener compatibilidad si se llama sin fechas
  return asignarEquipoAObraConFechas({ patente: patente, obra: obra, fechaInicio: new Date(), fechaTermino: new Date(), usuario: "Sistema" });
}

function asignarEquipoAObraConFechas(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Verificar disponibilidad en el periodo solicitado
    var check = comprobarDisponibilidadEquipoInterno(datos.patente, datos.fechaInicio, datos.fechaTermino);
    if (!check.disponible) {
      return { 
        exito: false, 
        error: "El equipo ya se encuentra asignado o reservado para la obra '" + check.obraConflicto + "' en este período." 
      };
    }
    
    // 2. Registrar el bloque temporal de asignación en Reservas_Maquinaria
    var sheetRes = ss.getSheetByName("Reservas_Maquinaria");
    if (sheetRes) {
      var start = new Date(datos.fechaInicio);
      var end = new Date(datos.fechaTermino);
      var diffTime = Math.abs(end - start);
      var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      sheetRes.appendRow([
        datos.obra,
        datos.patente,
        datos.fechaInicio,
        diffDays,
        datos.fechaTermino,
        datos.usuario || "Sistema"
      ]);
    }
    
    // 3. Actualizar la ubicación actual del equipo en Inventario_Maquinaria
    var sheetInv = ss.getSheetByName("Inventario_Maquinaria");
    if (!sheetInv) return { exito: false, error: "Pestaña 'Inventario_Maquinaria' no encontrada." };
    
    var dataInv = sheetInv.getDataRange().getValues();
    for (var i = 1; i < dataInv.length; i++) {
      if (dataInv[i][1] && dataInv[i][1].toString().trim().toLowerCase() === datos.patente.toString().trim().toLowerCase()) {
        sheetInv.getRange(i + 1, 4).setValue(datos.obra); // Columna D
        return { exito: true };
      }
    }
    
    return { exito: false, error: "Equipo no encontrado en el inventario." };
  } catch(e) { 
    return { exito: false, error: e.toString() }; 
  }
}

function comprobarDisponibilidadEquipoInterno(equipo, inicioStr, finStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Reservas_Maquinaria");
  if (!sheet) return { disponible: true };
  
  var data = sheet.getDataRange().getValues();
  var startNew = new Date(inicioStr);
  var endNew = new Date(finStr);
  
  var eqLimpio = equipo.toString().trim().toLowerCase();
  
  for (var i = 1; i < data.length; i++) {
    var eqRow = data[i][1] ? data[i][1].toString().trim().toLowerCase() : "";
    if (eqRow === eqLimpio) {
      var startRow = new Date(data[i][2]);
      var endRow = new Date(data[i][4]);
      
      // Traslape si: (InicioNuevo <= TerminoFila) && (TerminoNuevo >= InicioFila)
      if (startNew <= endRow && endNew >= startRow) {
        return { disponible: false, obraConflicto: data[i][0] };
      }
    }
  }
  return { disponible: true };
}

function guardarReservaMaquinaria(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Reservas_Maquinaria");
    if (!sheet) {
      sheet = ss.insertSheet("Reservas_Maquinaria");
      sheet.appendRow(["Obra", "Equipo", "Fecha Inicio", "Duración (Días)", "Fecha Término", "Reservado Por"]);
    }
    
    var check = comprobarDisponibilidadEquipoInterno(datos.equipo, datos.fechaInicio, datos.fechaTermino);
    if (!check.disponible) {
      return { exito: false, error: "El activo seleccionado ya se encuentra reservado para la obra: " + check.obraConflicto + " en el rango de fechas solicitado." };
    }
    
    sheet.appendRow([
      datos.obra,
      datos.equipo,
      datos.fechaInicio,
      parseInt(datos.duracion) || 0,
      datos.fechaTermino,
      datos.usuario || "Sistema"
    ]);
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function consultarDisponibilidadEquipos(fechaInicio, fechaTermino) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetMaq = ss.getSheetByName("Inventario_Maquinaria");
    if (!sheetMaq) return [];
    
    var dataMaq = sheetMaq.getDataRange().getValues();
    var list = [];
    
    for (var i = 1; i < dataMaq.length; i++) {
      var patente = dataMaq[i][1] ? dataMaq[i][1].toString().trim() : "";
      if (!patente) continue;
      
      var check = comprobarDisponibilidadEquipoInterno(patente, fechaInicio, fechaTermino);
      list.push({
        tipo: dataMaq[i][0],
        patente: patente,
        marca: dataMaq[i][2],
        obraActual: dataMaq[i][3],
        tipoActivo: dataMaq[i][9] || "Propio",
        disponible: check.disponible,
        obraConflicto: check.disponible ? "" : check.obraConflicto
      });
    }
    return list;
  } catch(e) { return []; }
}

function guardarRequerimientoMaquinaria(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Requerimientos_Maquinaria");
    if (!sheet) {
      sheet = ss.insertSheet("Requerimientos_Maquinaria");
      sheet.appendRow(["ID", "Fecha Solicitud", "Obra Solicitante", "Tipo/Descripción", "Fecha Inicio", "Duración (Días)", "Fecha Término", "Estado", "Tipo Conclusión", "Activo Asignado", "Justificación", "Usuario Solicitante", "Fecha Resolución"]);
    }
    
    var data = sheet.getDataRange().getValues();
    var nextId = "R-" + (1000 + data.length);
    var fechaTermino = datos.fechaTermino || "";
    
    sheet.appendRow([
      nextId,
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"),
      datos.obra,
      datos.descripcion,
      datos.fechaInicio,
      parseInt(datos.duracion) || 0,
      fechaTermino,
      "PENDIENTE",
      "",
      "",
      "",
      datos.usuario || "",
      ""
    ]);
    
    // Enviar documento de requerimiento por correo inmediatamente
    enviarCorreoRequerimientoCreado(datos, nextId);
    
    return { exito: true, id: nextId };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function obtenerRequerimientosMaquinaria() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Requerimientos_Maquinaria");
    if (!sheet) return [];
    
    var data = sheet.getDataRange().getValues();
    var lista = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        lista.push({
          id: data[i][0],
          fechaSolicitud: data[i][1] instanceof Date ? Utilities.formatDate(data[i][1], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : data[i][1],
          obra: data[i][2],
          descripcion: data[i][3],
          fechaInicio: data[i][4] instanceof Date ? Utilities.formatDate(data[i][4], Session.getScriptTimeZone(), "yyyy-MM-dd") : data[i][4],
          duracion: data[i][5],
          fechaTermino: data[i][6] instanceof Date ? Utilities.formatDate(data[i][6], Session.getScriptTimeZone(), "yyyy-MM-dd") : data[i][6],
          estado: data[i][7],
          tipoConclusion: data[i][8],
          activoAsignado: data[i][9],
          justificacion: data[i][10],
          usuarioSolicitante: data[i][11],
          fechaResolucion: data[i][12] instanceof Date ? Utilities.formatDate(data[i][12], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : data[i][12]
        });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function resolverRequerimientoMaquinaria(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Requerimientos_Maquinaria");
    if (!sheet) return { exito: false, error: "Pestaña 'Requerimientos_Maquinaria' no encontrada." };
    
    var data = sheet.getDataRange().getValues();
    var filaRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === datos.id.toString().trim().toLowerCase()) {
        filaRow = i + 1;
        break;
      }
    }
    
    if (filaRow === -1) {
      return { exito: false, error: "Requerimiento no encontrado." };
    }
    
    var estado = datos.estado; // APROBADO / RECHAZADO
    var tipoConclusion = datos.tipoConclusion || ""; // Fabricación / Asignar Activo / N/A
    var activoAsignado = datos.activoAsignado || "";
    var justificacion = datos.justificacion || "";
    
    if (!justificacion.trim()) {
      return { exito: false, error: "La justificación de la resolución es obligatoria." };
    }
    
    if (estado === "APROBADO" && tipoConclusion === "Asignar Activo") {
      if (!activoAsignado) {
        return { exito: false, error: "Debe seleccionar un activo de maquinaria para asignar." };
      }
      
      var reqFechaInicio = data[filaRow - 1][4];
      var reqFechaTermino = data[filaRow - 1][6];
      
      if (reqFechaInicio instanceof Date) {
        reqFechaInicio = Utilities.formatDate(reqFechaInicio, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      if (reqFechaTermino instanceof Date) {
        reqFechaTermino = Utilities.formatDate(reqFechaTermino, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      
      var check = comprobarDisponibilidadEquipoInterno(activoAsignado, reqFechaInicio, reqFechaTermino);
      if (!check.disponible) {
        return { exito: false, error: "El activo seleccionado " + activoAsignado + " no está disponible en esas fechas. Choca con la reserva para la obra: " + check.obraConflicto };
      }
      
      var sheetReservas = ss.getSheetByName("Reservas_Maquinaria");
      if (!sheetReservas) {
        sheetReservas = ss.insertSheet("Reservas_Maquinaria");
        sheetReservas.appendRow(["Obra", "Equipo", "Fecha Inicio", "Duración (Días)", "Fecha Término", "Reservado Por"]);
      }
      
      sheetReservas.appendRow([
        data[filaRow - 1][2], // Obra Solicitante
        activoAsignado,
        reqFechaInicio,
        data[filaRow - 1][5], // Duración
        reqFechaTermino,
        "Sistema (Aprobación Requerimiento)"
      ]);
      
      // Asignar el equipo a la obra actual en el inventario
      asignarEquipoAObra(activoAsignado, data[filaRow - 1][2]);
    }
    
    sheet.getRange(filaRow, 8, 1, 6).setValues([[
      estado,
      tipoConclusion,
      activoAsignado,
      justificacion,
      data[filaRow - 1][11],
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
    ]]);
    
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function enviarCorreoSemanalRequerimientosPendientes() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetReq = ss.getSheetByName("Requerimientos_Maquinaria");
    if (!sheetReq) return;
    
    var dataReq = sheetReq.getDataRange().getValues();
    var pendientes = [];
    
    for (var i = 1; i < dataReq.length; i++) {
      var estado = dataReq[i][7] ? dataReq[i][7].toString().trim().toUpperCase() : "";
      if (estado === "PENDIENTE") {
        var fStr = dataReq[i][1];
        if (fStr instanceof Date) {
          fStr = Utilities.formatDate(fStr, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
        }
        var fIniStr = dataReq[i][4];
        if (fIniStr instanceof Date) {
          fIniStr = Utilities.formatDate(fIniStr, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        
        pendientes.push({
          id: dataReq[i][0],
          fecha: fStr,
          obra: dataReq[i][2],
          descripcion: dataReq[i][3],
          fechaInicio: fIniStr,
          duracion: dataReq[i][5],
          solicitante: dataReq[i][11]
        });
      }
    }
    
    if (pendientes.length === 0) return;
    
    var correos = obtenerDestinatariosConfig("Uso Maquinaria", "");
    
    var htmlBody = "<html><body>";
    htmlBody += "<h2 style='color:#1e3a8a; font-family:sans-serif;'>Resumen Semanal de Requerimientos de Maquinaria Pendientes</h2>";
    htmlBody += "<p style='font-family:sans-serif;'>A continuación se detallan las solicitudes de equipos de obra pendientes de resolución:</p>";
    htmlBody += "<table border='1' cellpadding='8' style='border-collapse:collapse; font-family:sans-serif; width:100%; border:1px solid #ddd;'>";
    htmlBody += "<tr style='background-color:#1e3a8a; color:white; font-size:12px;'><th>ID</th><th>Fecha Solicitud</th><th>Obra</th><th>Descripción / Equipo</th><th>Inicio Requerido</th><th>Duración</th><th>Solicitante</th></tr>";
    
    pendientes.forEach(p => {
      htmlBody += "<tr style='font-size:12px;'>";
      htmlBody += "<td><b>" + p.id + "</b></td>";
      htmlBody += "<td>" + p.fecha + "</td>";
      htmlBody += "<td>" + p.obra + "</td>";
      htmlBody += "<td>" + p.descripcion + "</td>";
      htmlBody += "<td>" + p.fechaInicio + "</td>";
      htmlBody += "<td>" + p.duracion + " días</td>";
      htmlBody += "<td>" + p.solicitante + "</td>";
      htmlBody += "</tr>";
    });
    
    htmlBody += "</table>";
    htmlBody += "<p style='font-size:11px; color:#666; font-family:sans-serif; margin-top:20px;'>Este correo ha sido generado automáticamente por el Portal de Proyectos de EMIN.</p>";
    htmlBody += "</body></html>";
    
    MailApp.sendEmail({
      to: correos,
      subject: "🚨 [PENDIENTES] Requerimientos de Maquinaria Semanal EMIN",
      htmlBody: htmlBody
    });
  } catch(e) {
    Logger.log("Error en envío de correo semanal: " + e.toString());
  }
}

function crearTriggerSemanalRequerimientos() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "enviarCorreoSemanalRequerimientosPendientes") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("enviarCorreoSemanalRequerimientosPendientes")
           .timeBased()
           .onWeekDay(ScriptApp.WeekDay.MONDAY)
           .atHour(8)
           .create();
  return { exito: true };
}


function obtenerTodasReservas() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Reservas_Maquinaria");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        list.push({
          obra: data[i][0],
          equipo: data[i][1],
          fechaInicio: data[i][2] instanceof Date ? Utilities.formatDate(data[i][2], Session.getScriptTimeZone(), "yyyy-MM-dd") : data[i][2],
          duracion: data[i][3],
          fechaTermino: data[i][4] instanceof Date ? Utilities.formatDate(data[i][4], Session.getScriptTimeZone(), "yyyy-MM-dd") : data[i][4],
          reservadoPor: data[i][5]
        });
      }
    }
    return list;
  } catch(e) { return []; }
}

function enviarCorreoRequerimientoCreado(datos, nextId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dests = obtenerDestinatariosConfig("Uso Maquinaria", datos.obra);
    
    // Buscar el correo del usuario que realiza la solicitud
    var activeUserEmail = "";
    var userSheet = ss.getSheetByName("Usuarios");
    if (userSheet && datos.usuario) {
      var uData = userSheet.getDataRange().getValues();
      for (var u = 1; u < uData.length; u++) {
        if (uData[u][0] && uData[u][0].toString().trim().toLowerCase() === datos.usuario.toString().trim().toLowerCase()) {
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
    var finalRecipients = emailList.join(",");
    
    var fecha = new Date();
    var logoHtml = LOGO_BASE64 ? '<img src="data:image/png;base64,' + LOGO_BASE64 + '" style="width: 130px;" />' : '<h2 style="color:#1e3a8a;margin:0;">EMIN</h2>';
    
    var htmlContent = '<html><head><style>' +
      'body { font-family: sans-serif; font-size: 11px; color: #334155; margin: 0; padding: 10px; }' +
      '.header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }' +
      '.header-table td { border: 1px solid #e2e8f0; padding: 10px; vertical-align: middle; }' +
      '.title { font-weight: bold; font-size: 13px; text-transform: uppercase; color: #1e3a8a; }' +
      '.section-title { font-weight: bold; font-size: 11px; color: #1e3a8a; background-color: #f8fafc; padding: 6px 10px; margin-top: 15px; margin-bottom: 8px; border-left: 4px solid #1e3a8a; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }' +
      '.data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }' +
      '.data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }' +
      '.data-table th { background-color: #f1f5f9; font-weight: bold; color: #475569; width: 35%; }' +
      '.badge { font-weight: bold; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-size: 9px; color: #d97706; background-color: #fef3c7; border: 1px solid #f59e0b; }' +
      '</style></head><body>';
      
    htmlContent += '<table class="header-table"><tr>' +
      '<td style="width: 30%; text-align: center; background-color: #ffffff;">' + logoHtml + '</td>' +
      '<td style="text-align: center; background-color: #ffffff;">' +
        '<span class="title">SOLICITUD DE REQUERIMIENTO</span><br/>' +
        '<span style="font-weight: bold; font-size: 11px; color: #334155;">MAQUINARIA Y FLOTA</span>' +
      '</td>' +
      '<td style="width: 30%; text-align: center; font-size: 9px; color: #64748b; background-color: #ffffff;">' +
        '<b>ID Solicitud:</b> ' + nextId + '<br/>' +
        '<b>Fecha:</b> ' + Utilities.formatDate(fecha, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + '<br/>' +
      '</td>' +
      '</tr></table>';
      
    htmlContent += '<div class="section-title">Detalle del Requerimiento</div>';
    htmlContent += '<table class="data-table">' +
      '<tr><th>ID Requerimiento</th><td><b>' + nextId + '</b></td></tr>' +
      '<tr><th>Obra o Área Solicitante</th><td>' + datos.obra + '</td></tr>' +
      '<tr><th>Equipo / Descripción Requerida</th><td>' + datos.descripcion + '</td></tr>' +
      '<tr><th>Fecha de Inicio Estimada</th><td>' + datos.fechaInicio + '</td></tr>' +
      '<tr><th>Duración Solicitada</th><td>' + datos.duracion + ' días</td></tr>' +
      '<tr><th>Fecha de Término Estimada</th><td>' + datos.fechaTermino + '</td></tr>' +
      '<tr><th>Usuario Solicitante</th><td>' + datos.usuario + '</td></tr>' +
      '<tr><th>Estado Solicitud</th><td><span class="badge">PENDIENTE DE RESOLUCIÓN</span></td></tr>' +
      '</table>';
      
    htmlContent += '<p style="font-size:10px; color:#64748b; margin-top:30px; text-align:center;">Este documento oficial respalda la solicitud ingresada al sistema EMIN.</p>';
    htmlContent += '</body></html>';
    
    var blobHTML = HtmlService.createHtmlOutput(htmlContent);
    var filename = "REQ_" + nextId + "_" + datos.obra.replace(/\s+/g, "_") + ".pdf";
    var pdfBlob = blobHTML.getAs("application/pdf").setName(filename);
    
    var subject = "🚨 Nuevo Requerimiento de Maquinaria [" + nextId + "] - " + datos.obra;
    var body = "Estimado/a,\n\nSe ha ingresado una nueva solicitud de requerimiento de flota al sistema.\n\n" +
      "Detalles:\n" +
      "- ID Solicitud: " + nextId + "\n" +
      "- Obra/Área Solicitante: " + datos.obra + "\n" +
      "- Descripción: " + datos.descripcion + "\n" +
      "- Fecha de Inicio: " + datos.fechaInicio + "\n" +
      "- Duración: " + datos.duracion + " días\n" +
      "- Solicitante: " + datos.usuario + "\n\n" +
      "Se adjunta el documento PDF de respaldo oficial. Resuelva esta solicitud en la consola de seguimiento del portal.\n\nAtentamente,\nPortal de Proyectos EMIN Sistemas Geotécnicos";
      
    MailApp.sendEmail({
      to: finalRecipients,
      subject: subject,
      body: body,
      attachments: [pdfBlob]
    });
  } catch(err) {
    Logger.log("Error al enviar correo de requerimiento creado: " + err.toString());
  }
}

function guardarConfiguracionTriggerReporte(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Config_Trigger_Reportes");
    if (!sheet) {
      sheet = ss.insertSheet("Config_Trigger_Reportes");
      sheet.appendRow(["Reporte", "Dias", "Hora"]);
      sheet.getRange("A1:C1").setFontWeight("bold").setBackground("#f1f5f9");
    }
    
    var data = sheet.getDataRange().getValues();
    var filaModificada = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === datos.reporte.toString().trim().toLowerCase()) {
        filaModificada = i + 1;
        break;
      }
    }
    
    var vals = [[datos.reporte, datos.dias, parseInt(datos.hora) || 18]];
    if (filaModificada !== -1) {
      sheet.getRange(filaModificada, 1, 1, 3).setValues(vals);
    } else {
      sheet.appendRow(vals[0]);
    }
    
    // Intentar crear el trigger maestro horario de forma segura (sin fallar si faltan permisos)
    var resTrigger = crearTriggerMaestroHorario();
    
    return { 
      exito: true, 
      advertencia: resTrigger.exito ? "" : "Configuración guardada. Nota: Para que el envío automático funcione, debe autorizar el trigger horario 'ejecutarTriggersHorarios' (cada 1 hora) manualmente en el editor de Apps Script (esquina izquierda superior de Triggers)."
    };
  } catch(e) {
    return { exito: false, error: e.toString() };
  }
}

function obtenerConfiguracionTriggerReporte(reporte) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Config_Trigger_Reportes");
    var defaultVal = { dias: "Lunes,Martes,Miercoles,Jueves,Viernes", hora: 18 };
    if (reporte === "Requerimientos Pendientes") {
      defaultVal = { dias: "Lunes", hora: 8 };
    }
    
    if (!sheet) return defaultVal;
    
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === reporte.toLowerCase()) {
        return { dias: data[i][1], hora: parseInt(data[i][2]) || 18 };
      }
    }
    return defaultVal;
  } catch(e) {
    return { dias: "Lunes,Martes,Miercoles,Jueves,Viernes", hora: 18 };
  }
}

function crearTriggerMaestroHorario() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var existe = false;
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "ejecutarTriggersHorarios") {
        existe = true;
        break;
      }
    }
    if (!existe) {
      ScriptApp.newTrigger("ejecutarTriggersHorarios")
               .timeBased()
               .everyHours(1)
               .create();
    }
    return { exito: true };
  } catch(e) {
    Logger.log("No se pudo crear el trigger maestro automáticamente por falta de permisos: " + e.toString());
    return { exito: false, error: e.toString() };
  }
}

function ejecutarTriggersHorarios() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Config_Trigger_Reportes");
  if (!sheet) return;
  
  var data = sheet.getDataRange().getValues();
  var hoy = new Date();
  var diasSemana = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  var hoyDia = diasSemana[hoy.getDay()];
  var hoyHora = hoy.getHours();
  
  var hoyDiaNorm = hoyDia.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (var i = 1; i < data.length; i++) {
    var reporte = data[i][0] ? data[i][0].toString().trim() : "";
    var dias = data[i][1] ? data[i][1].toString().trim().toLowerCase() : "";
    var hora = data[i][2] ? parseInt(data[i][2]) : -1;
    
    if (!reporte || !dias || hora === -1) continue;
    
    var diasNorm = dias.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (diasNorm.indexOf(hoyDiaNorm) !== -1 && hora === hoyHora) {
      Logger.log("Ejecutando trigger programado para: " + reporte);
      try {
        if (reporte === "Produccion Diaria") {
          ejecutarReporteDiarioDirecto();
        } else if (reporte === "Requerimientos Pendientes") {
          enviarCorreoSemanalRequerimientosPendientes();
        } else if (reporte === "Alertas Cumplimiento SSO") {
          enviarAlertasPendientesSSO();
        }
      } catch(err) {
        Logger.log("Error al ejecutar " + reporte + ": " + err.toString());
      }
    }
  }
}

function emitirPlanillaHaberesPDF(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var sheetPers = ss.getSheetByName("Maestro_Personal");
    if (!sheetPers) return { exito: false, error: "Pestaña Maestro_Personal no encontrada." };
    
    var persData = sheetPers.getDataRange().getValues();
    var trabajadorInfo = null;
    for (var i = 1; i < persData.length; i++) {
      if (persData[i][2].toString().trim().toLowerCase() === datos.rut.toString().trim().toLowerCase()) {
        trabajadorInfo = {
          nombre: persData[i][1],
          rut: persData[i][2],
          cargo: persData[i][3],
          obra: persData[i][0],
          colacion: parseFloat(datos.colacion) || 0,
          movilizacion: parseFloat(datos.movilizacion) || 0
        };
        break;
      }
    }
    
    if (!trabajadorInfo) return { exito: false, error: "Trabajador no encontrado en el Maestro de Personal." };
    
    var sheetAsist = ss.getSheetByName("Asistencia_Personal");
    var asistData = sheetAsist ? sheetAsist.getDataRange().getValues() : [];
    
    var asistMap = {};
    for (var i = 1; i < asistData.length; i++) {
      var rowDate = asistData[i][0];
      var rowRut = asistData[i][4] ? asistData[i][4].toString().trim().toLowerCase() : "";
      
      if (rowRut === datos.rut.toLowerCase() && rowDate instanceof Date) {
        var dateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        asistMap[dateStr] = {
          obra: asistData[i][1],
          asistencia: asistData[i][5],
          horasAuto: parseFloat(asistData[i][10]) || 0,
          horasManual: parseFloat(asistData[i][11]) || 0
        };
      }
    }
    
    var start = new Date(datos.fechaInicio + "T00:00:00");
    var end = new Date(datos.fechaTermino + "T00:00:00");
    
    var rowsHtml = "";
    var totalPresentes = 0;
    var totalAusentes = 0;
    var totalHEAuto = 0;
    var totalHEManual = 0;
    var totalColacion = 0;
    var totalMovilizacion = 0;
    
    var loop = new Date(start);
    while (loop <= end) {
      var loopStr = Utilities.formatDate(loop, Session.getScriptTimeZone(), "yyyy-MM-dd");
      var dateLabel = Utilities.formatDate(loop, Session.getScriptTimeZone(), "dd/MM/yyyy");
      
      var record = asistMap[loopStr];
      var workedObra = "-";
      var presentLabel = "No";
      var heAuto = 0;
      var heManual = 0;
      var dailyCol = 0;
      var dailyMov = 0;
      
      if (record) {
        workedObra = record.obra;
        if (record.asistencia === "PRESENTE") {
          presentLabel = "Sí";
          totalPresentes++;
          heAuto = record.horasAuto;
          heManual = record.horasManual;
          dailyCol = trabajadorInfo.colacion;
          dailyMov = trabajadorInfo.movilizacion;
          totalHEAuto += heAuto;
          totalHEManual += heManual;
          totalColacion += dailyCol;
          totalMovilizacion += dailyMov;
        } else {
          totalAusentes++;
        }
      } else {
        totalAusentes++;
      }
      
      rowsHtml += '<tr>' +
        '<td>' + dateLabel + '</td>' +
        '<td>' + workedObra + '</td>' +
        '<td style="text-align:center;">' + presentLabel + '</td>' +
        '<td style="text-align:right;">' + heAuto.toFixed(1) + '</td>' +
        '<td style="text-align:right;">' + heManual.toFixed(1) + '</td>' +
        '<td style="text-align:right;">$' + dailyCol.toLocaleString("es-CL") + '</td>' +
        '<td style="text-align:right;">$' + dailyMov.toLocaleString("es-CL") + '</td>' +
        '</tr>';
        
      loop.setDate(loop.getDate() + 1);
    }
    
    var dests = "rrhh@eminsg.cl";
    var configSheet = ss.getSheetByName("Config_Correos");
    if (configSheet) {
      var configData = configSheet.getDataRange().getValues();
      for (var c = 1; c < configData.length; c++) {
        if (configData[c][0] && configData[c][0].toString().trim().toLowerCase() === "recursos humanos") {
          dests = configData[c][1];
          break;
        }
      }
    }
    
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
    var finalRecipients = emailList.join(",");
    
    var logoHtml = LOGO_BASE64 ? '<img src="data:image/png;base64,' + LOGO_BASE64 + '" style="width: 130px;" />' : '<h2 style="color:#1e3a8a;margin:0;">EMIN</h2>';
    
    var htmlContent = '<html><head><style>' +
      'body { font-family: sans-serif; font-size: 11px; color: #334155; margin: 0; padding: 10px; }' +
      '.header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }' +
      '.header-table td { border: 1px solid #e2e8f0; padding: 10px; vertical-align: middle; }' +
      '.title { font-weight: bold; font-size: 13px; text-transform: uppercase; color: #1e3a8a; }' +
      '.section-title { font-weight: bold; font-size: 11px; color: #1e3a8a; background-color: #f8fafc; padding: 6px 10px; margin-top: 15px; margin-bottom: 8px; border-left: 4px solid #1e3a8a; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }' +
      '.data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }' +
      '.data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }' +
      '.data-table th { background-color: #f1f5f9; font-weight: bold; color: #475569; width: 35%; }' +
      '.resp-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }' +
      '.resp-table th, .resp-table td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }' +
      '.resp-table th { background-color: #f1f5f9; font-weight: bold; color: #475569; }' +
      '</style></head><body>';
      
    htmlContent += '<table class="header-table"><tr>' +
      '<td style="width: 30%; text-align: center; background-color: #ffffff;">' + logoHtml + '</td>' +
      '<td style="text-align: center; background-color: #ffffff;">' +
        '<span class="title">PLANILLA DE HABERES Y ASISTENCIA</span><br/>' +
        '<span style="font-weight: bold; font-size: 11px; color: #334155;">REPORTE DE REMUNERACIONES</span>' +
      '</td>' +
      '<td style="width: 30%; text-align: center; font-size: 9px; color: #64748b; background-color: #ffffff;">' +
        '<b>Rango:</b> ' + datos.fechaInicio + ' al ' + datos.fechaTermino + '<br/>' +
        '<b>Emisión:</b> ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + '<br/>' +
      '</td>' +
      '</tr></table>';
      
    htmlContent += '<div class="section-title">Datos del Trabajador</div>';
    htmlContent += '<table class="data-table">' +
      '<tr><th>Nombre Completo</th><td><b>' + trabajadorInfo.nombre + '</b></td></tr>' +
      '<tr><th>RUT</th><td>' + trabajadorInfo.rut + '</td></tr>' +
      '<tr><th>Cargo</th><td>' + trabajadorInfo.cargo + '</td></tr>' +
      '<tr><th>Proyecto / Obra Actual</th><td>' + trabajadorInfo.obra + '</td></tr>' +
      '<tr><th>Colación diaria contratada</th><td>$' + trabajadorInfo.colacion.toLocaleString("es-CL") + '</td></tr>' +
      '<tr><th>Movilización diaria contratada</th><td>$' + trabajadorInfo.movilizacion.toLocaleString("es-CL") + '</td></tr>' +
      '</table>';
      
    htmlContent += '<div class="section-title">Detalle de Asistencia Diaria</div>';
    htmlContent += '<table class="resp-table">' +
      '<thead><tr>' +
      '<th>Fecha</th>' +
      '<th>Obra / Frente</th>' +
      '<th style="text-align:center;">Asistencia</th>' +
      '<th style="text-align:right;">H.E. Auto</th>' +
      '<th style="text-align:right;">H.E. Manual</th>' +
      '<th style="text-align:right;">Colación</th>' +
      '<th style="text-align:right;">Movilización</th>' +
      '</tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
      '</table>';
      
    htmlContent += '<div class="section-title">Resumen y Totales a Liquidar</div>';
    htmlContent += '<table class="data-table">' +
      '<tr><th>Días Trabajados (Presente)</th><td><b>' + totalPresentes + ' días</b></td></tr>' +
      '<tr><th>Días Ausentes / Faltantes</th><td>' + totalAusentes + ' días</td></tr>' +
      '<tr><th>Total Horas Extras Automáticas</th><td>' + totalHEAuto.toFixed(1) + ' hrs</td></tr>' +
      '<tr><th>Total Horas Extras Manuales</th><td>' + totalHEManual.toFixed(1) + ' hrs</td></tr>' +
      '<tr><th>Total Acumulado Horas Extras</th><td><b>' + (totalHEAuto + totalHEManual).toFixed(1) + ' hrs</b></td></tr>' +
      '<tr><th>Total Asignación Colación</th><td><b>$' + totalColacion.toLocaleString("es-CL") + '</b></td></tr>' +
      '<tr><th>Total Asignación Movilización</th><td><b>$' + totalMovilizacion.toLocaleString("es-CL") + '</b></td></tr>' +
      '<tr style="background-color: #f1f5f9;"><th>Total Haberes Adicionales (Colación + Movilización)</th><td><b style="color: #1e3a8a; font-size: 13px;">$' + (totalColacion + totalMovilizacion).toLocaleString("es-CL") + '</b></td></tr>' +
      '</table>';
      
    htmlContent += '</body></html>';
    
    var blobHTML = HtmlService.createHtmlOutput(htmlContent);
    var filename = "HABERES_" + trabajadorInfo.nombre.replace(/\s+/g, "_") + "_" + datos.fechaInicio + "_" + datos.fechaTermino + ".pdf";
    var pdfBlob = blobHTML.getAs("application/pdf").setName(filename);
    
    var subject = "📋 Planilla de Haberes - " + trabajadorInfo.nombre + " (" + datos.fechaInicio + " al " + datos.fechaTermino + ")";
    var body = "Estimado/a,\n\nSe adjunta la planilla de haberes y asistencia oficial para el trabajador:\n\n" +
      "- Trabajador: " + trabajadorInfo.nombre + "\n" +
      "- RUT: " + trabajadorInfo.rut + "\n" +
      "- Cargo: " + trabajadorInfo.cargo + "\n" +
      "- Período: " + datos.fechaInicio + " al " + datos.fechaTermino + "\n\n" +
      "Resumen:\n" +
      "- Días Trabajados: " + totalPresentes + "\n" +
      "- Horas Extras Acumuladas: " + (totalHEAuto + totalHEManual).toFixed(1) + " hrs\n" +
      "- Monto Colación: $" + totalColacion.toLocaleString("es-CL") + "\n" +
      "- Monto Movilización: $" + totalMovilizacion.toLocaleString("es-CL") + "\n" +
      "- Total Haberes Adicionales: $" + (totalColacion + totalMovilizacion).toLocaleString("es-CL") + "\n\n" +
      "Atentamente,\nPortal de Proyectos EMIN Sistemas Geotécnicos";
      
    MailApp.sendEmail({
      to: finalRecipients,
      subject: subject,
      body: body,
      attachments: [pdfBlob]
    });
    
    return { exito: true };
  } catch(e) {
    return { exito: false, error: e.toString() };
  }
}

function verificarCumplimientoSSO(rut, fechaInicioStr, fechaFinStr) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var sheetAsig = ss.getSheetByName("Asignaciones_SSO");
    if (!sheetAsig) return [];
    var dataAsig = sheetAsig.getDataRange().getValues();
    var assignments = [];
    var rutLimpio = rut.toString().trim().toLowerCase();
    for (var i = 1; i < dataAsig.length; i++) {
      if (dataAsig[i][0] && dataAsig[i][0].toString().trim().toLowerCase() === rutLimpio) {
        assignments.push({
          rut: dataAsig[i][0],
          nombre: dataAsig[i][1],
          formCode: dataAsig[i][2],
          formTitle: dataAsig[i][3],
          periodo: dataAsig[i][4]
        });
      }
    }
    
    if (assignments.length === 0) return [];
    
    var sheetReg = ss.getSheetByName("Registros_Digitales");
    var submissions = [];
    if (sheetReg) {
      var dataReg = sheetReg.getDataRange().getValues();
      for (var j = 1; j < dataReg.length; j++) {
        var rowDate = dataReg[j][0];
        var rowRUT = dataReg[j][10] ? dataReg[j][10].toString().trim().toLowerCase() : "";
        if (rowRUT === rutLimpio && rowDate instanceof Date) {
          submissions.push({
            date: rowDate,
            formCode: dataReg[j][2],
            formTitle: dataReg[j][3]
          });
        }
      }
    }
    
    var today = new Date();
    
    var curr = new Date();
    var day = curr.getDay();
    var diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    var startOfWeek = new Date(curr.setDate(diff));
    startOfWeek.setHours(0,0,0,0);
    var endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    
    var startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0,0,0,0);
    
    var startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    startOfToday.setHours(0,0,0,0);
    
    var results = [];
    assignments.forEach(function(asig) {
      var cumplido = false;
      var lastSubmissionDate = null;
      
      var matchingSubmissions = submissions.filter(function(sub) {
        return sub.formCode.toString().trim().toLowerCase() === asig.formCode.toString().trim().toLowerCase();
      });
      
      matchingSubmissions.sort(function(a, b) { return b.date - a.date; });
      if (matchingSubmissions.length > 0) {
        lastSubmissionDate = matchingSubmissions[0].date;
      }
      
      if (asig.periodo === "Diario") {
        cumplido = matchingSubmissions.some(function(sub) {
          var subDate = new Date(sub.date);
          subDate.setHours(0,0,0,0);
          return subDate.getTime() === startOfToday.getTime();
        });
      } else if (asig.periodo === "Semanal") {
        cumplido = matchingSubmissions.some(function(sub) {
          return sub.date >= startOfWeek && sub.date < endOfWeek;
        });
      } else if (asig.periodo === "Mensual") {
        cumplido = matchingSubmissions.some(function(sub) {
          return sub.date >= startOfMonth;
        });
      }
      
      results.push({
        formCode: asig.formCode,
        formTitle: asig.formTitle,
        periodo: asig.periodo,
        cumplido: cumplido,
        ultimaFecha: lastSubmissionDate ? Utilities.formatDate(lastSubmissionDate, Session.getScriptTimeZone(), "dd/MM/yyyy") : "Nunca"
      });
    });
    
    return results;
  } catch(e) {
    return [];
  }
}

function obtenerReporteCumplimientoSSOTodos() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var sheetPers = ss.getSheetByName("Maestro_Personal");
    if (!sheetPers) return [];
    var dataPers = sheetPers.getDataRange().getValues();
    var personalMap = {};
    for (var i = 1; i < dataPers.length; i++) {
      if (dataPers[i][1] && dataPers[i][2]) {
        personalMap[dataPers[i][2].toString().trim().toLowerCase()] = {
          nombre: dataPers[i][1].toString().trim(),
          rut: dataPers[i][2].toString().trim(),
          obra: dataPers[i][0] || "Sin Obra"
        };
      }
    }
    
    var sheetAsig = ss.getSheetByName("Asignaciones_SSO");
    var assignments = [];
    if (sheetAsig) {
      var dataAsig = sheetAsig.getDataRange().getValues();
      for (var i = 1; i < dataAsig.length; i++) {
        if (dataAsig[i][0]) {
          assignments.push({
            rut: dataAsig[i][0].toString().trim().toLowerCase(),
            nombre: dataAsig[i][1],
            formCode: dataAsig[i][2],
            formTitle: dataAsig[i][3],
            periodo: dataAsig[i][4]
          });
        }
      }
    }
    
    var sheetReg = ss.getSheetByName("Registros_Digitales");
    var submissions = [];
    if (sheetReg) {
      var dataReg = sheetReg.getDataRange().getValues();
      for (var j = 1; j < dataReg.length; j++) {
        var rowDate = dataReg[j][0];
        var rowRUT = dataReg[j][10] ? dataReg[j][10].toString().trim().toLowerCase() : "";
        if (rowRUT && rowDate instanceof Date) {
          submissions.push({
            date: rowDate,
            rut: rowRUT,
            formCode: dataReg[j][2]
          });
        }
      }
    }
    
    var today = new Date();
    var startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    startOfToday.setHours(0,0,0,0);
    
    var curr = new Date();
    var day = curr.getDay();
    var diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    var startOfWeek = new Date(curr.setDate(diff));
    startOfWeek.setHours(0,0,0,0);
    var endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    
    var startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0,0,0,0);
    
    var rutsWithAssignments = {};
    assignments.forEach(function(a) {
      rutsWithAssignments[a.rut] = true;
    });
    
    var report = [];
    for (var rut in rutsWithAssignments) {
      var pInfo = personalMap[rut] || { nombre: "Trabajador Desvinculado", rut: rut, obra: "N/A" };
      var workerAssignments = assignments.filter(function(a) { return a.rut === rut; });
      var workerSubmissions = submissions.filter(function(s) { return s.rut === rut; });
      
      var cumplidos = 0;
      var pendientes = 0;
      var details = [];
      
      workerAssignments.forEach(function(asig) {
        var subForAsig = workerSubmissions.filter(function(s) {
          return s.formCode.toString().trim().toLowerCase() === asig.formCode.toString().trim().toLowerCase();
        });
        
        subForAsig.sort(function(a,b) { return b.date - a.date; });
        var lastDate = subForAsig.length > 0 ? subForAsig[0].date : null;
        
        var cumplido = false;
        if (asig.periodo === "Diario") {
          cumplido = subForAsig.some(function(s) {
            var sD = new Date(s.date);
            sD.setHours(0,0,0,0);
            return sD.getTime() === startOfToday.getTime();
          });
        } else if (asig.periodo === "Semanal") {
          cumplido = subForAsig.some(function(s) {
            return s.date >= startOfWeek && s.date < endOfWeek;
          });
        } else if (asig.periodo === "Mensual") {
          cumplido = subForAsig.some(function(s) {
            return s.date >= startOfMonth;
          });
        }
        
        if (cumplido) cumplidos++; else pendientes++;
        
        details.push({
          formCode: asig.formCode,
          formTitle: asig.formTitle,
          periodo: asig.periodo,
          cumplido: cumplido,
          ultimaFecha: lastDate ? Utilities.formatDate(lastDate, Session.getScriptTimeZone(), "dd/MM/yyyy") : "Nunca"
        });
      });
      
      report.push({
        nombre: pInfo.nombre,
        rut: pInfo.rut,
        obra: pInfo.obra,
        cumplidos: cumplidos,
        pendientes: pendientes,
        total: workerAssignments.length,
        detalles: details
      });
    }
    
    return report;
  } catch(e) {
    return [];
  }
}

function guardarAsignacionSSO(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Asignaciones_SSO");
    if (!sheet) {
      sheet = ss.insertSheet("Asignaciones_SSO");
      sheet.appendRow(["RUT", "Nombre", "Código Formulario", "Nombre Formulario", "Periodicidad", "Fecha Asignación"]);
      sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#f1f5f9");
    }
    
    var data = sheet.getDataRange().getValues();
    var exists = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().trim().toLowerCase() === datos.rut.toString().trim().toLowerCase() &&
          data[i][2].toString().trim().toLowerCase() === datos.formCode.toString().trim().toLowerCase() &&
          data[i][4].toString().trim().toLowerCase() === datos.periodo.toString().trim().toLowerCase()) {
        exists = true;
        break;
      }
    }
    
    if (exists) {
      return { exito: false, error: "Este registro ya se encuentra asignado a este trabajador con la misma periodicidad." };
    }
    
    sheet.appendRow([
      datos.rut,
      datos.nombre,
      datos.formCode,
      datos.formTitle,
      datos.periodo,
      new Date()
    ]);
    return { exito: true };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function eliminarAsignacionSSO(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Asignaciones_SSO");
    if (!sheet) return { exito: false, error: "Pestaña Asignaciones_SSO no encontrada." };
    
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().trim().toLowerCase() === datos.rut.toString().trim().toLowerCase() &&
          data[i][2].toString().trim().toLowerCase() === datos.formCode.toString().trim().toLowerCase() &&
          data[i][4].toString().trim().toLowerCase() === datos.periodo.toString().trim().toLowerCase()) {
        sheet.deleteRow(i + 1);
        return { exito: true };
      }
    }
    return { exito: false, error: "Asignación no encontrada." };
  } catch(e) { return { exito: false, error: e.toString() }; }
}

function obtenerAsignacionesTrabajador(rut) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Asignaciones_SSO");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var lista = [];
    var rutLimpio = rut.toString().trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === rutLimpio) {
        lista.push({
          rut: data[i][0],
          nombre: data[i][1],
          formCode: data[i][2],
          formTitle: data[i][3],
          periodo: data[i][4]
        });
      }
    }
    return lista;
  } catch(e) { return []; }
}

function enviarAlertasPendientesSSO() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var ssoSupervisorEmail = "prevencion@eminsg.cl";
    var configSheet = ss.getSheetByName("Config_Correos");
    if (configSheet) {
      var configData = configSheet.getDataRange().getValues();
      for (var c = 1; c < configData.length; c++) {
        if (configData[c][0] && configData[c][0].toString().trim().toLowerCase() === "prevencion de riesgos") {
          ssoSupervisorEmail = configData[c][1];
          break;
        }
      }
    }
    
    var userEmails = {};
    var userSheet = ss.getSheetByName("Usuarios");
    if (userSheet) {
      var uData = userSheet.getDataRange().getValues();
      for (var u = 1; u < uData.length; u++) {
        if (uData[u][7]) {
          var wRUT = uData[u][7].toString().trim().toLowerCase();
          var wEmail = uData[u][6] ? uData[u][6].toString().trim() : "";
          if (wEmail) {
            userEmails[wRUT] = wEmail;
          }
        }
      }
    }
    
    var report = obtenerReporteCumplimientoSSOTodos();
    if (report.length === 0) return { exito: true, enviado: 0 };
    
    var countEnviados = 0;
    report.forEach(function(p) {
      if (p.pendientes > 0) {
        var workerEmail = userEmails[p.rut.toLowerCase()] || "";
        
        var subject = "⚠️ Alerta EMIN: Registros SSO Obligatorios Pendientes";
        var htmlBody = '<html><body style="font-family:sans-serif;font-size:13px;color:#334155;">' +
          '<h2 style="color:#1e3a8a;">Control de Cumplimiento SSO</h2>' +
          '<p>Estimado/a <b>' + p.nombre + '</b>,</p>' +
          '<p>Te recordamos que a la fecha tienes los siguientes registros operacionales obligatorios <b>PENDIENTES</b> de realización:</p>' +
          '<table style="width:100%;border-collapse:collapse;margin:15px 0;">' +
          '<thead><tr style="background-color:#f1f5f9;">' +
          '<th style="border:1px solid #e2e8f0;padding:8px;text-align:left;">Código</th>' +
          '<th style="border:1px solid #e2e8f0;padding:8px;text-align:left;">Nombre del Registro</th>' +
          '<th style="border:1px solid #e2e8f0;padding:8px;text-align:center;">Frecuencia</th>' +
          '<th style="border:1px solid #e2e8f0;padding:8px;text-align:center;">Estado</th>' +
          '</tr></thead><tbody>';
          
        p.detalles.forEach(function(det) {
          if (!det.cumplido) {
            htmlBody += '<tr>' +
              '<td style="border:1px solid #e2e8f0;padding:8px;">' + det.formCode + '</td>' +
              '<td style="border:1px solid #e2e8f0;padding:8px;">' + det.formTitle + '</td>' +
              '<td style="border:1px solid #e2e8f0;padding:8px;text-align:center;">' + det.periodo + '</td>' +
              '<td style="border:1px solid #e2e8f0;padding:8px;text-align:center;color:#ef4444;font-weight:bold;">PENDIENTE</td>' +
              '</tr>';
          }
        });
        
        htmlBody += '</tbody></table>' +
          '<p>Por favor ingresa al portal de proyectos y completa tus firmas/registros correspondientes para evitar multas o no conformidades en obra.</p>' +
          '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />' +
          '<p style="font-size:11px;color:#64748b;">Atentamente,<br/>Prevención de Riesgos y Medio Ambiente - EMIN Sistemas Geotécnicos</p>' +
          '</body></html>';
          
        var toAddress = workerEmail || ssoSupervisorEmail;
        var ccAddress = workerEmail ? ssoSupervisorEmail : "";
        
        MailApp.sendEmail({
          to: toAddress,
          cc: ccAddress,
          subject: subject,
          htmlBody: htmlBody
        });
        countEnviados++;
      }
    });
    
    return { exito: true, enviado: countEnviados };
  } catch(e) {
    return { exito: false, error: e.toString() };
  }
}

function generarExcelHaberesObra(datos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var obra = datos.obra;
    var fInicioStr = datos.fechaInicio;
    var fTerminoStr = datos.fechaTermino;
    
    // 1. Obtener personal de la obra
    var personal = obtenerPersonalDeObra(obra);
    if (personal.length === 0) {
      return { exito: false, error: "No se encontró personal contratado para la obra seleccionada." };
    }
    
    // 2. Crear Spreadsheet temporal
    var tempSS = SpreadsheetApp.create("Planilla_Haberes_Obra_" + obra.replace(/[^a-zA-Z0-9]/g, "_"));
    var resumenSheet = tempSS.getSheets()[0];
    resumenSheet.setName("Resumen");
    
    // Escribir cabecera del resumen
    var resumenHeaders = [
      "Colaborador", "RUT", "Cargo", 
      "Días Trabajados", "Días Ausentes", 
      "Total H.E. Auto", "Total H.E. Manual", 
      "Total Colación", "Total Movilización", "Total Haberes"
    ];
    resumenSheet.appendRow(resumenHeaders);
    resumenSheet.getRange(1, 1, 1, resumenHeaders.length)
                .setFontWeight("bold")
                .setBackground("#1e3a8a")
                .setFontColor("white");
    
    // Cargar mapa de asistencia
    var sheetAsist = ss.getSheetByName("Asistencia_Personal");
    var asistData = sheetAsist ? sheetAsist.getDataRange().getValues() : [];
    var asistMap = {}; // Key: RUT_yyyy-MM-dd
    for (var i = 1; i < asistData.length; i++) {
      var rowDate = asistData[i][0];
      var rowRut = asistData[i][4] ? asistData[i][4].toString().trim().toLowerCase() : "";
      if (rowRut && rowDate instanceof Date) {
        var dateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        asistMap[rowRut + "_" + dateStr] = {
          obra: asistData[i][1],
          asistencia: asistData[i][5],
          horasAuto: parseFloat(asistData[i][10]) || 0,
          horasManual: parseFloat(asistData[i][11]) || 0
        };
      }
    }
    
    var start = new Date(fInicioStr + "T00:00:00");
    var end = new Date(fTerminoStr + "T00:00:00");
    
    // Procesar cada colaborador
    for (var c = 0; c < personal.length; c++) {
      var colab = personal[c];
      var colabRut = colab.rut.toString().trim();
      var colabNombre = colab.nombre.toString().trim();
      
      // Nombre de hoja seguro (máx 30 caracteres, sin caracteres especiales []*:?/\)
      var colabSheetName = colabNombre.replace(/[\[\]\*:\?\/\\]/g, "").substring(0, 30);
      // Evitar nombres de hoja duplicados
      var sheetIndex = 1;
      var finalSheetName = colabSheetName;
      while (tempSS.getSheetByName(finalSheetName)) {
        finalSheetName = colabSheetName.substring(0, 27) + "(" + sheetIndex + ")";
        sheetIndex++;
      }
      
      var colabSheet = tempSS.insertSheet(finalSheetName);
      
      // Escribir datos cabecera individual
      colabSheet.appendRow(["Colaborador:", colabNombre, "RUT:", colabRut]);
      colabSheet.appendRow(["Cargo:", colab.cargo, "Obra:", obra]);
      colabSheet.appendRow([""]); // Fila vacía
      
      var colabHeaders = ["Fecha", "Obra / Frente", "Asistencia", "H.E. Auto", "H.E. Manual", "Colación ($)", "Movilización ($)"];
      colabSheet.appendRow(colabHeaders);
      colabSheet.getRange(4, 1, 1, colabHeaders.length)
                .setFontWeight("bold")
                .setBackground("#4b5563")
                .setFontColor("white");
      
      var totalPresentes = 0;
      var totalAusentes = 0;
      var totalHEAuto = 0;
      var totalHEManual = 0;
      var totalColacion = 0;
      var totalMovilizacion = 0;
      
      var loop = new Date(start);
      var rowIdx = 5;
      while (loop <= end) {
        var loopStr = Utilities.formatDate(loop, Session.getScriptTimeZone(), "yyyy-MM-dd");
        var dateLabel = Utilities.formatDate(loop, Session.getScriptTimeZone(), "dd/MM/yyyy");
        
        var record = asistMap[colabRut.toLowerCase() + "_" + loopStr];
        var workedObra = "-";
        var presentLabel = "AUSENTE";
        var heAuto = 0;
        var heManual = 0;
        var dailyCol = 0;
        var dailyMov = 0;
        
        if (record) {
          workedObra = record.obra;
          if (record.asistencia === "PRESENTE") {
            presentLabel = "PRESENTE";
            totalPresentes++;
            heAuto = record.horasAuto;
            heManual = record.horasManual;
            dailyCol = parseFloat(colab.colacion) || 0;
            dailyMov = parseFloat(colab.movilizacion) || 0;
            
            totalHEAuto += heAuto;
            totalHEManual += heManual;
            totalColacion += dailyCol;
            totalMovilizacion += dailyMov;
          } else {
            totalAusentes++;
          }
        } else {
          totalAusentes++;
        }
        
        colabSheet.appendRow([dateLabel, workedObra, presentLabel, heAuto, heManual, dailyCol, dailyMov]);
        rowIdx++;
        loop.setDate(loop.getDate() + 1);
      }
      
      // Agregar fila de Totales
      var lastRow = rowIdx - 1;
      colabSheet.appendRow([
        "TOTALES", "", "", 
        "=SUM(D5:D" + lastRow + ")", 
        "=SUM(E5:E" + lastRow + ")", 
        "=SUM(F5:F" + lastRow + ")", 
        "=SUM(G5:G" + lastRow + ")"
      ]);
      colabSheet.getRange(rowIdx, 1, 1, colabHeaders.length)
                .setFontWeight("bold")
                .setBackground("#e2e8f0");
                
      // Formatear columnas
      colabSheet.getRange("D5:E" + rowIdx).setNumberFormat("0.0");
      colabSheet.getRange("F5:G" + rowIdx).setNumberFormat("$#,##0");
      colabSheet.autoResizeColumns(1, colabHeaders.length);
      
      // Agregar al Resumen
      resumenSheet.appendRow([
        colabNombre, colabRut, colab.cargo, 
        totalPresentes, totalAusentes, 
        totalHEAuto, totalHEManual, 
        totalColacion, totalMovilizacion, 
        (totalColacion + totalMovilizacion)
      ]);
    }
    
    // Formatear pestaña Resumen
    var resRows = resumenSheet.getLastRow();
    resumenSheet.getRange("D2:G" + resRows).setNumberFormat("0");
    resumenSheet.getRange("H2:J" + resRows).setNumberFormat("$#,##0");
    resumenSheet.autoResizeColumns(1, resumenHeaders.length);
    
    // Guardar cambios
    SpreadsheetApp.flush();
    
    // Exportar
    var url = "https://docs.google.com/spreadsheets/d/" + tempSS.getId() + "/export?format=xlsx";
    var token = ScriptApp.getOAuthToken();
    var response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    var blob = response.getBlob();
    var base64 = Utilities.base64Encode(blob.getBytes());
    
    // Eliminar archivo temporal
    try {
      DriveApp.getFileById(tempSS.getId()).setTrashed(true);
    } catch(e) { Logger.log("Error al borrar tempSS: " + e.toString()); }
    
    return {
      exito: true,
      fileName: "Planilla_Haberes_Obra_" + obra.replace(/\s+/g, "_") + "_" + fInicioStr + "_" + fTerminoStr + ".xlsx",
      base64: base64
    };
  } catch(e) {
    return { exito: false, error: e.toString() };
  }
}

function dummyAuthorize() {
  UrlFetchApp.fetch("https://www.google.com");
}
