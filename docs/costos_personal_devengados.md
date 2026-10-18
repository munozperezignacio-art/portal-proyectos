# Costos de personal aprobados y proyecciones

## Operación

1. RRHH → Asignaciones y distribución de costos → seleccionar mes → Parámetros de costeo mensual.
2. Confirmar jornada semanal contractual, tope mensual de gratificación, factor de hora extra y tasa de provisión de cargas del empleador. No se precargan tasas previsionales ni topes supuestos. Una tasa cero debe indicarse expresamente.
3. El marcaje manual presente, único y con centro y costeo válidos carga directamente su provisión diaria, incluidas las HE detectadas. No requiere una segunda confirmación. Los QR, días con varios marcajes, ausencia informada, centros faltantes o costeo incompleto permanecen como excepciones para revisión.
4. RRHH → Asignaciones y distribución de costos → Reglas sin asistencia permite autorizar por trabajador un centro de respaldo, vigencia, días de semana y hora de cierre (Chile; predeterminada 20:00). Una tarea interna revisa cada 15 minutos y recupera hasta 31 días. Solo aplica si no existe ningún marcaje en ninguna obra ese día; un AUSENTE o permiso registrado no equivale a falta de marcaje. El centro predeterminado antiguo de la ficha sigue siendo solo una propuesta, no una autorización automática. No se cargan fechas futuras ni días fuera de contrato.
5. La nómina mensual incorpora horas y haberes diarios aprobados. Los campos mensuales permiten reemplazar los valores propuestos, no sumarlos de nuevo. Guardar y cerrar intenta conciliar; si faltan aprobaciones, conserva la provisión y muestra el pendiente.
6. Reintentar la distribución desde la bandeja cuando todos los destinos estén aprobados.

## Cálculo y alcance

Provisión diaria = sueldo mensual/30 + gratificación mensual provisionada/30 + colación/30 + movilización/30 + horas extras + haberes del día + cargas configuradas sobre imponibles. Se trata de una provisión contable revisable, no de una liquidación definitiva ni de un cálculo automático de todas las cotizaciones legales.

Hora extra mensual = sueldo mensual × 7 / (30 × horas semanales) × factor pactado (mínimo 1,5). Referencia: [Dirección del Trabajo](https://www.dt.gob.cl/portal/1628/w3-article-95182.html).

En los registros antiguos, el campo manual de horas extras tiene valor cero por defecto. El cálculo toma el mayor entre automático y manual (no los suma). La corrección manual permite reemplazar expresamente las horas, incluso por cero, y agregar haberes del día. Las marcas en varias obras el mismo día generan una única imputación pendiente que requiere decidir su destino.

La nómina definitiva usa costo empleador, no sueldo líquido. Sus horas/haberes aprobados se incorporan por defecto; los haberes adicionales imponibles van al campo de bonos y los no imponibles a su componente mensual. Los descuentos personales no reducen el costo del empleador.

## No duplicación

`rrhh_costos_personal_vigentes` es la fuente efectiva:

- Sin distribución definitiva: muestra cada provisión diaria aprobada.
- Con nómina distribuida: muestra únicamente los días definitivos congelados de esa nómina para el trabajador y período; excluye sus provisiones.
- Cuando la nómina supera la provisión acumulada, distribuye la diferencia entre los días aprobados. Si es menor, ajusta proporcionalmente sin producir cargos negativos. Conserva el total en CLP con ajuste de redondeo.
- Las liquidaciones automáticas antiguas se conservan cuando aún no tienen una representación conciliada. Las manuales se conservan siempre: no es posible deducir automáticamente que un cargo manual es una provisión del mismo sueldo. No registrar manualmente la misma nómina además del circuito automático.
- Las fechas de devengo, no la fecha de cierre, determinan el corte histórico. El monto definitivo puede revisar el histórico provisional; los días definitivos quedan congelados hasta una nueva distribución explícita.
- Una asistencia tardía reemplaza el centro de respaldo en la misma imputación, sin crear un segundo cargo. Editar o borrar el marcaje reevalúa el día; conflictos quedan pendientes. Las correcciones humanas se respetan mientras no cambie la evidencia. Los cargos automáticos se recalculan al actualizar; el importe definitivo de una nómina conciliada no desaparece ni se reemplaza silenciosamente: una diferencia requiere revisión y conciliación explícita.

La conciliación solo modifica las imputaciones automáticas de la nómina seleccionada. Las nóminas antiguas sin `employerCost` requieren revisión antes de su conciliación con este modelo.

## Proyecciones

- El presupuesto de costos aprobado en CLP se configura en Proyección y es distinto de la venta contractual. El CPI monetario usa avance valorizado a ese presupuesto de costos, no a precio de venta.
- Sin presupuesto de costos, costos incurridos o avance positivo, no hay CPI, EAC ni sobrecosto estimado.
- El plazo extrapola el SPI actual sobre el plazo contractual restante. No es un modelo entrenado ni se crean escenarios favorable/adverso con ajustes arbitrarios.
- Usa el calendario de feriados del cronograma. Si el horizonte llega a un año sin calendario cargado, no publica fecha ni flujo mensual y solicita validación del calendario. No inventar feriados para desbloquear el resultado.
- El flujo distribuye el costo pendiente por días hábiles de meses calendario reales. No representa compromisos ni vencimientos de pago.
- La cobertura de datos es una lista de requisitos presentes, no una probabilidad de acierto. Las comparaciones de CPI con otras obras no se publican usando costos parciales.

## Verificación

- `supabase/tests/costos_asistencia_devengados.sql`: transacción con rollback; incluye sueldo, gratificación, extras, haberes, cargas, invalidación, conservación del total, ausencia de duplicados, liquidaciones manuales, otras nóminas y acceso no autorizado.
- `frontend/src/utils/payrollAccrual.test.js`, `laborCostPreview.test.js`, `forecastModel.test.js`.
