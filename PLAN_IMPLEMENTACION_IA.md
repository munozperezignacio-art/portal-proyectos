# Plan rector de implementación de IA en Obraxis

La IA asiste. Los cálculos, permisos, aprobaciones y registros oficiales continúan siendo determinísticos. Este archivo define el orden obligatorio de implementación y se actualiza en cada entrega.

## Estado resumido

| Fase | Estado | Avance estimado |
|---|---|---:|
| 1. Gobierno y control de IA | Cerrada | 100% |
| 2. IA documental | En ejecución | 75% |
| 3. Informes asistidos | Base determinística existente; interpretación IA pendiente | 35% |
| 4. Copiloto contextual por obra | Pendiente | 0% |
| 5. Asistencia especializada | Iniciada solo en lectura de maquinaria | 10% |
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
- [ ] Completar lectura uniforme de facturas, notas de crédito y guías.
- [ ] Asociación sugerida con proveedor, obra y centro de gestión.
- [ ] Conciliación OC ↔ guía ↔ recepción ↔ factura.
- [ ] Alertas de diferencias de cantidades y montos.
- [ ] Asegurar que inventario solo cambie después de validación humana.

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
- [ ] Generar interpretación IA revisable para cada tipo de informe.
- [ ] Informe semanal y mensual de obra.
- [ ] Informe corporativo, prevención, calidad, maquinaria y RR. HH.
- [ ] Registrar aprobación previa al envío y consumo IA asociado.

## Fase 4 — Copiloto contextual por obra

- [ ] Aislamiento estricto por empresa y obras autorizadas.
- [ ] Consultas de todos los módulos contratados.
- [ ] Citas y enlaces a registros originales.
- [ ] Separación visible entre hechos, cálculos y sugerencias.
- [ ] Modo solo lectura e historial de consultas.

## Fase 5 — Asistencia especializada

- [ ] Planificación y Last Planner.
- [ ] Calidad.
- [ ] Prevención.
- [x] Lectura asistida de horómetro/kilometraje con revisión humana.
- [ ] Anomalías, fallas recurrentes, mantenimiento y redistribución de maquinaria.

## Fase 6 — Predicción y optimización

No se inicia hasta disponer de volumen, calidad y continuidad histórica suficientes.

- [ ] Fecha probable de término y costo final.
- [ ] Riesgo de sobrecosto y de incumplimiento de hitos.
- [ ] Flujo de caja.
- [ ] Accidentabilidad y no conformidades.
- [ ] Utilización y fallas de equipos.
- [ ] Comparación interna anonimizada entre obras.

## Próximo bloque obligatorio

Continuar Fase 2 en **Facturación y Bodega**, empezando por la conciliación documental y la validación humana previa a movimientos de inventario. No iniciar el Copiloto ni predicciones antes de cerrar las fases anteriores.
