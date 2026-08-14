# Plan rector de implementación de IA en Obraxis

La IA asiste. Los cálculos, permisos, aprobaciones y registros oficiales continúan siendo determinísticos. Este archivo define el orden obligatorio de implementación y se actualiza en cada entrega.

## Estado resumido

| Fase | Estado | Avance estimado |
|---|---|---:|
| 1. Gobierno y control de IA | Cerrada | 100% |
| 2. IA documental | Cerrada | 100% |
| 3. Informes asistidos | Cerrada | 100% |
| 4. Copiloto contextual por obra | Trazabilidad navegable, aislamiento reforzado y consultas determinísticas | 95% |
| 5. Asistencia especializada | Cerrada: especialidades operativas y bandeja transversal priorizada | 100% |
| 6. Predicción y optimización | Pendiente de historial confiable | 0% |

## Fase 1 — Gobierno y control de IA

- [x] Centro de IA en Panel de Control.
- [x] Activación por empresa y función.
- [x] Modelo permitido.
- [x] Presupuesto mensual por empresa.
- [x] Límites mensuales por función y usuario.
- [x] Registro de tokens, costo, duración, resultado y solicitante.
- [x] Bloqueo real en PostgreSQL al alcanzar límites.
- [x] Roles autorizados por función y excepciones por usuario.
- [x] Clave exclusivamente en Supabase Secrets.
- [x] Revisión/confirmación humana en operaciones que proponen datos.

## Fase 2 — IA documental

### Rendición de gastos

- [x] Lectura de boletas y comprobantes en imagen.
- [x] Proveedor, RUT, folio, fecha, neto, IVA y total.
- [x] Categoría sugerida.
- [x] Centro de gestión sugerido localmente, sin enviar el catálogo interno a OpenAI.
- [x] Detección determinística de posibles duplicados.
- [x] Confianza y confirmación humana antes de guardar.

### Facturación y Bodega

- [x] Lector inicial de DTE.
- [x] Lectura uniforme de facturas, notas de crédito y guías.
- [x] Asociación sugerida con proveedor, obra y centro de gestión usando historial del proveedor.
- [x] Conciliación OC ↔ guía ↔ recepción ↔ factura/nota de crédito.
- [x] Alertas de diferencias de RUT, cantidades y montos.
- [x] Inventario cambia solo después de validación humana.
- [x] Referencia tributaria explícita de notas de crédito/débito al DTE original, extraída y confirmada antes de guardar.

### Acreditaciones

- [x] Clasificación y extracción documental.
- [x] Empresa, trabajador o equipo y vigencias.
- [x] Recomendación asistida con decisión humana separada.

### Extensión autorizada de RR. HH.

- [x] Documentos privados por trabajador.
- [x] Envío voluntario y explícito a OpenAI.
- [x] Extracción, vigencia, advertencias y confirmación humana.

## Fase 3 — Informes asistidos

- [x] Programación, destinatarios y base gráfica determinística.
- [x] Indicadores EVM, Curva S y días de atraso/adelanto disponibles en la base de informes.
- [x] Generar interpretación IA estructurada y revisable desde indicadores determinísticos.
- [ ] Informe semanal y mensual de obra.
- [ ] Informe corporativo, prevención, calidad, maquinaria y RR. HH.
- [x] Registrar aprobación previa al envío manual y consumo IA asociado.
- [ ] Integrar interpretación IA en el despachador automático sin omitir control presupuestario.
- [ ] Completar fuentes específicas de maquinaria y RR. HH. en sus informes.

## Fase 4 — Copiloto contextual por obra

- [x] Aislamiento estricto por empresa y obras autorizadas.
- [ ] Consultas de todos los módulos contratados (primera versión: programación, avances, costos, calidad, prevención y estados de pago).
- [x] Citas al módulo y registro de origen con navegación al área correspondiente.
- [x] Separación visible entre hechos, cálculos y sugerencias.
- [x] Modo solo lectura e historial de consultas.
- [x] Referencias controladas por servidor con navegación al módulo y registro de origen; la IA no puede inventar destinos.
- [x] Consultas determinísticas de avance, calidad/prevención, estados de pago y costo total sin consumo de tokens.
- [x] Consultas determinísticas de restricciones Last Planner, maquinaria y dotación asignada sin consumo de tokens.
- [x] Navegación desde hechos de restricciones, maquinaria y personal hacia su área operativa en la obra.
- [x] Aislamiento defensivo para fuentes antiguas relacionadas solo por nombre de obra.

## Fase 5 — Asistencia especializada

La cobertura operativa determinística de esta fase está cerrada. Las interpretaciones IA indicadas como opcionales quedan como extensiones contratables y no reducen la funcionalidad base.

- [x] Base determinística de Planificación y Last Planner: semáforo por partida, restricciones, responsables, compromisos, criticidad y sugerencias de recuperación sin consumo de tokens.
- [ ] Interpretación IA opcional de Planificación y Last Planner, sujeta a autorización específica para enviar restricciones y recursos a OpenAI.
- [x] Base determinística de Calidad: contención, análisis causal, recurrencia, acción correctiva, verificación de eficacia y cierre por etapas.
- [ ] Asistencia IA opcional de Calidad para borradores de protocolos, síntesis de recurrencias y propuestas de causa/acción, sujeta a autorización específica.
- [x] Base determinística de Prevención: clasificación del evento, potencial de gravedad, método de investigación, causas inmediata y raíz, referencia a matriz de riesgos, acciones con responsable/plazo/estado y verificación obligatoria antes del cierre.
- [ ] Asistencia IA opcional de Prevención para borradores de AST, síntesis de recurrencias y sugerencias de controles, sujeta a autorización específica.
- [x] Base determinística de Maquinaria: utilización, disponibilidad, índice de fallas, MTBF, costo horario, alertas de discontinuidad de lecturas y proyección de mantenciones por tiempo, horómetro o kilometraje.
- [ ] Asistencia IA opcional de Maquinaria para síntesis de fallas recurrentes y recomendaciones de redistribución, sujeta a autorización específica.
- [x] Base determinística de Recursos Humanos: personal disponible, costo sin asignar, asistencia y horas extra de 30 días, brechas proyectadas por cargo y sugerencias de reasignación con confirmación humana.
- [ ] Asistencia IA opcional de Recursos Humanos para explicar brechas y proponer escenarios de dotación, sujeta a autorización específica.
- [x] Bandeja transversal por obra: consolida prioridades de planificación, Last Planner, Calidad, Prevención, Maquinaria y RR. HH.; enlaza cada alerta con su registro responsable y no ejecuta cambios automáticos.
- [x] Lectura asistida de horómetro/kilometraje con revisión humana.
- [x] Anomalías de lecturas, fallas recurrentes, mantenimiento proyectado y sugerencias determinísticas de redistribución de maquinaria.

## Fase 6 — Predicción y optimización

No se inicia hasta disponer de volumen, calidad y continuidad histórica suficientes.

- [ ] Fecha probable de término y costo final.
- [ ] Riesgo de sobrecosto y de incumplimiento de hitos.
- [ ] Flujo de caja.
- [ ] Accidentabilidad y no conformidades.
- [ ] Utilización y fallas de equipos.
- [ ] Comparación interna anonimizada entre obras.

## Próximo bloque obligatorio

Cerrar Fase 4 con evaluación funcional autenticada de respuestas, referencias y permisos antes de iniciar predicción.
