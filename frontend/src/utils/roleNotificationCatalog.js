// Only events with a real producer are configurable. The legacy catalogue includes planned events.
export const NOTIFICATION_EVENTS = [
 ['asistencia_registrada','Recursos Humanos','Asistencia registrada','obra'],
 ['material_registrado','Bodega','Movimiento de materiales registrado','obra'],
 ['mantenimiento_registrado','Maquinaria','Mantención registrada','equipo'],
 ['maquinaria_falla_reportada','Maquinaria','Falla de equipo reportada','equipo'],
 ['solicitudes_actualizacion','Solicitudes','Solicitud recibida o actualizada','personal'],
 ['obra_reporte_avance','Obras','Reporte de avance registrado','obra'],
 ['obra_reporte_maquinaria','Maquinaria','Reporte de maquinaria registrado','equipo'],
 ['obra_alerta_plazo','Obras','Alerta de plazo','obra'],
 ['obra_alerta_sobrecosto','Obras','Alerta de sobrecosto','obra'],
 ['obra_alerta_sin_avance','Obras','Alerta de falta de avance','obra'],
 ['avance_reporte_pendiente','Obras','Reporte de avance diario pendiente','obra'],
 ['maquinaria_reporte_pendiente','Maquinaria','Reporte diario de maquinaria pendiente','obra'],
 ['reportes_diarios_pendientes','Obras','Resumen de informes pendientes','obra'],
 ['especialidad_jornada_abierta','Obras','Jornada de especialidad sin cerrar','obra'],
 ['maquinaria_termino_obra','Maquinaria','Obra terminada: revisar equipos','obra'],
 ['gastos_imputacion_pendiente','Gastos','Imputaciones pendientes','obra'],
 ['rrhh_imputacion_pendiente','Recursos Humanos','Imputaciones pendientes','obra'],
 ['maquinaria_imputacion_pendiente','Maquinaria','Imputaciones pendientes','obra'],
 ['prevencion_registro_recibido','Formularios','Formulario recibido','formulario'],
 ['prevencion_cumplimiento_pendiente','Formularios','Cumplimiento preventivo pendiente','formulario'],
 ['enex_pendiente','Combustibles','Cargas pendientes de asignar','personal'],
 ['ep_subcontrato_documentos_pendientes','Subcontratos','Documentos pendientes del estado de pago','obra'],
 ['ep_subcontrato_documento_observado','Subcontratos','Documento observado o rechazado','obra'],
 ['ep_subcontrato_expediente_aprobado','Subcontratos','Expediente documental aprobado','obra']
].map(([code,module,name,scope])=>({code,module,name,scope}));
export const defaultNotification = ()=>({email:false,mobile:false,web:false,works:'assigned',forms:'all',form_ids:[],equipment:'all',equipment_ids:[]});

