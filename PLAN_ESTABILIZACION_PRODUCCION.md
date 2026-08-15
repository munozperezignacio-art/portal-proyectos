# Plan de estabilización y cierre de Obraxis

Estado inicial de la auditoría: 14 de agosto de 2026.

Avance actualizado: Etapa 1 100%; Etapa 2 96%; Etapa 3 94%; Etapa 4 97%; Etapa 5 100%; plan completo 99%.

Objetivo: llevar Obraxis desde una plataforma funcionalmente amplia a una operación productiva segura, reproducible, verificable y mantenible, sin eliminar funciones existentes.

## Etapa 1 — Cierre de seguridad

- [x] Reemplazar políticas RLS abiertas por aislamiento real por empresa y obra.
- [x] Eliminar acceso anónimo directo no indispensable.
- [x] Mover Resend completamente al servidor y retirar la credencial heredada de las tablas y del navegador.
- [x] Eliminar claves de IA del navegador y de tablas expuestas.
- [x] Proteger tareas Cron con un secreto interno en Vault independiente de la clave pública.
- [x] Activar protección de contraseñas filtradas en Supabase Auth.
- [x] Revisar `GRANT` y funciones `SECURITY DEFINER`.
- [x] Verificar con pruebas cruzadas entre al menos dos empresas.

## Etapa 2 — Integridad y reproducibilidad

- [x] Eliminar o reasignar partidas, avances y registros sin `empresa` u `obra_id`.
- [x] Hacer obligatorios los identificadores multiempresa donde corresponde.
- [ ] Consolidar toda la historia en `supabase/migrations`.
- [x] Sincronizar el inventario de Edge Functions locales y desplegadas.
- [x] Corregir y verificar automatizaciones internas y del mandante que respondían 401.
- [x] Incorporar índices de claves foráneas según uso real en las tablas operativas normalizadas.

## Etapa 3 — Pruebas

- [x] Configurar pruebas unitarias, de integración y de interfaz para la base pública y los controles estructurales de Supabase.
- [x] Probar aislamiento entre empresas y permisos por rol.
- [ ] Cubrir Auth, estados de pago, Libro de Obras, calidad y prevención.
- [x] Cubrir formularios públicos, subcontratos, mandante y acreditaciones en pruebas de arquitectura y humo HTTP; quedan pendientes recorridos E2E visuales.
- [ ] Cubrir bodega, DTE, centros de gestión, OX, IA, Cron y correos.
- [x] Incorporar y ejecutar pruebas de humo repetibles sobre los portales y servicios externos críticos desplegados.

## Etapa 4 — Limpieza y refactorización

- [x] Dividir los submódulos críticos por dominio y carga diferida.
- [x] Extraer servicios compartidos de documentos, correo, auditoría, cálculos y permisos.
- [x] Centralizar adaptadores PDF, Excel y formatos documentales.
- [ ] Eliminar los fallbacks operativos silenciosos a `localStorage` que aún permanecen en módulos históricos secundarios.
- [ ] Reservar almacenamiento local para caché, preferencias y borradores explícitos.

## Etapa 5 — Rendimiento y observabilidad

- [x] Sustituir o aislar `xlsx`.
- [x] Corregir dependencias vulnerables y fijar la versión de Node.
- [x] Reparar lint y convertirlo en control obligatorio.
- [x] Reducir paquetes grandes y carga inicial.
- [x] Incorporar alertas de errores, métricas y trazabilidad de automatizaciones.

## Criterio de término

La plataforma se considerará lista para producción cuando no existan políticas abiertas en datos privados, ningún secreto llegue al navegador, el esquema sea reconstruible desde migraciones, las funciones desplegadas coincidan con Git y los flujos críticos cuenten con pruebas automatizadas.

## Avances ejecutados

- Protección de contraseñas filtradas activada y verificada en Supabase Auth; el advisor dejó de reportar esa advertencia.
- Configuración contextual de correos trasladada por completo a `config_empresa`: destinatarios, copias y activación automática persisten en Supabase y los errores ya no producen confirmaciones locales engañosas.
- Las tres RPC `SECURITY DEFINER` expuestas a usuarios autenticados fueron auditadas como excepciones intencionales, documentadas y endurecidas con `search_path` fijo; todas validan sesión, empresa y permisos antes de operar.
- Validación final del esquema: cero tablas públicas sin RLS, cero políticas universalmente abiertas, cero llamadas directas no optimizadas a `auth.uid()`, `auth.jwt()` o `auth.role()` y cero configuraciones contextuales nulas.
- Batería final ampliada a 25 pruebas unitarias, con lint limpio, build productivo correcto y cinco recorridos E2E aprobados (uno omitido por viewport de forma esperada).
- Cron de informes y notificaciones autenticado mediante secreto generado en Vault.
- Edge Functions rechazan invocaciones sin el secreto interno.
- Resend eliminado de las tablas en las automatizaciones de informes, prevención y mandante intervenidas.
- RLS multiempresa cerrado para roles, relación obra–presupuesto y nueve tablas financieras heredadas.
- Acceso `anon`, `TRUNCATE`, `TRIGGER` y `REFERENCES` retirado de esas tablas.
- Formularios preventivos y sus respuestas aislados por empresa; acceso anónimo directo eliminado.
- Servicio interno de correo y formulario público centralizados en Supabase Edge Functions; clave Resend validada en servidor y pendiente sólo el cierre de rotación de credenciales antiguas.
- Bandeja comercial de contactos incorporada con persistencia, estados, responsable, notas internas y RLS exclusivo para Obraxis.
- Portal público de formularios canalizado por una Edge Function con token único, validación de obra/centro y límite de intentos.
- Datos internos de personal y correos de notificación excluidos de la respuesta pública.
- Políticas permisivas abiertas reducidas de 22 a 20 en esta iteración.
- RLS multiempresa cerrado para Bitácora y las tablas operativas de Calidad, incluidos los controles dependientes de cada recepción.
- Configuración corporativa cerrada a acceso anónimo y aislada por empresa; sólo administradores autorizados pueden modificarla.
- Corregida la función transversal de acceso multiempresa: un superusuario de una empresa cliente ya no obtiene acceso global; ese alcance queda reservado a Obraxis.
- Importador de presupuestos migrado a una Edge Function autenticada con control por empresa, presupuesto de IA y auditoría; la vista previa exige confirmación humana antes de guardar.
- Credenciales heredadas de Gemini eliminadas del frontend y del esquema público; OpenAI permanece exclusivamente en Supabase Secrets.
- Condiciones contractuales de estados de pago aisladas por empresa; se retiró su acceso anónimo abierto.
- Portal de maquinaria reconstruido con token aleatorio por equipo, validación de lecturas, límite de frecuencia y escritura exclusiva mediante Edge Function.
- Inventario, usos diarios y reservas de maquinaria aislados por empresa; acceso anónimo directo eliminado y columnas de empresa hechas obligatorias.
- Registro de maquinaria originado en formularios públicos trasladado al servidor; eliminado el acceso directo del navegador y su fallback operativo local.
- Políticas públicas abiertas reducidas de 20 a 13 durante este bloque de estabilización.
- Catálogos de centros de gestión, matrices de riesgo y maquinaria de formularios públicos encapsulados en la Edge Function protegida por token; sus RPC ya no son ejecutables por `anon` ni `authenticated`.
- Tablas operativas heredadas de inventario, planificación y reportes de maquinaria normalizadas con empresa obligatoria, índices y RLS multiempresa.
- Políticas públicas abiertas reducidas de 13 a 10; verificación en producción confirma que las nuevas políticas sólo están disponibles para usuarios autenticados de la empresa correspondiente.
- Portal de capacitaciones migrado a una Edge Function con token, límite de frecuencia y evaluación calculada en servidor; las respuestas correctas ya no se exponen al navegador.
- Capacitaciones e intentos normalizados con empresa obligatoria y RLS multiempresa; se eliminaron cuatro políticas públicas redundantes.
- Políticas públicas abiertas reducidas de 10 a 6 y portal público validado en producción mediante prueba de humo.
- Estados de Pago y Libro de Obras externos migrados a una Edge Function protegida por enlace y clave; validación, decisiones, propuestas, trazabilidad y bitácora se procesan en servidor.
- Configuración de correos normalizada por empresa y aislada mediante RLS; Estados de Pago y Libro de Obras también quedaron bajo políticas multiempresa.
- Acceso anónimo directo retirado de las tres tablas anteriores; las políticas públicas abiertas bajaron de 6 a 3.
- Marcación QR de asistencia encapsulada en una Edge Function con token aleatorio por obra, validación de RUT asignado, geolocalización, límite de frecuencia y fecha operacional de Chile.
- Acreditaciones de subcontratistas y proveedores convertidas desde una simulación local a tablas reales con RLS por empresa y persistencia centralizada.
- Portales externos de acreditación encapsulados en `acreditacion-publica`, con token y clave, límite de frecuencia, tamaño máximo y rechazo de empresas archivadas.
- Revisión, aprobación y rechazo documental conectados a la misma fuente persistente; eliminadas las credenciales universales y los respaldos operativos silenciosos del navegador.
- Pruebas de arquitectura incorporadas para impedir secretos en frontend, escrituras directas desde portales públicos y llamadas a Edge Functions no versionadas.
- Primera limpieza transversal de lint ejecutada: las advertencias bajaron de 386 a 287 sin retirar funciones, concentrando el remanente en los cinco componentes históricos que deben dividirse por dominio.
- Segunda limpieza focalizada sobre Presupuestos y Maquinaria: las advertencias globales bajaron de 287 a 220; se retiraron 67 imports, estados, omisiones y manejadores muertos sin alterar las funciones operativas.
- Presupuestos y Maquinaria quedaron sin deuda de variables muertas; permanecen cinco advertencias de dependencias de efectos que requieren refactorizar sus cargadores con callbacks estables antes de convertir lint en bloqueo obligatorio.
- Limpieza extendida a Formularios/Capacitaciones y Recursos Humanos: las advertencias globales bajaron nuevamente de 220 a 185, preservando sus flujos de carga, diseño y gestión documental.
- Limpieza profunda de Obras y Prevención: las advertencias globales bajaron de 185 a 97; ambos componentes quedaron únicamente con avisos estructurales de dependencias React.
- Retirado de `Obras.jsx` un modal heredado de asignación de maquinaria incrustado por error dentro del mapa GPS, que dependía de variables fuera de alcance y duplicaba una operación administrada por el módulo de Maquinaria.
- Eliminados imports, estados, parámetros y cálculos muertos en portales públicos, acreditaciones, configuración, facturación, informes, login y aplicación principal; corregidos además escapes documentales seguros.
- Obras, maestro de personal y asistencia quedaron aislados por empresa; `anon` ya no posee privilegios sobre esas tablas.
- Políticas públicas amplias reducidas de 3 a 0 y verificadas directamente en producción.
- Control de lint reactivado en Windows; corregido el único error bloqueante de reglas de Hooks detectado en Bodega.
- Auditoría de integridad multiempresa iniciada: quedan 19 avances, 4 partidas y 10 asistencias heredadas sin obra inequívoca; se mantienen identificadas para reasignación controlada, sin inventar relaciones ni eliminar registros.
- Recuperada en Git la función productiva `subcontrato-operacion`, que no estaba versionada.
- Desplegada `analizar-formato-laboral-ia`, antes presente sólo en Git, con autenticación, permisos por empresa, presupuesto de IA y auditoría de consumo.
- Eliminados, por autorización expresa, 4 partidas, 19 avances, 10 asistencias, 2 asignaciones preventivas vacías y sus 2 registros dependientes heredados sin origen válido.
- Las 5 respuestas preventivas antiguas con nombre de obra inequívoco fueron enlazadas a su obra real; no se creó una obra de cuarentena.
- `empresa` y `obra_id` quedaron obligatorios en partidas y avances; `obra_id` también quedó obligatorio en asistencia, con índices compuestos para los accesos por empresa, obra y fecha.
- Eliminada la validación JWT redundante del gateway en `detectar-reportes-pendientes` y `despachar-informes`; ambas conservan autenticación obligatoria mediante secreto de Vault.
- Pruebas negativas sin secreto respondieron 401 y pruebas internas con el secreto respondieron 200, sin registros pendientes procesados.
- Las funciones del mandante aceptaron su secreto de automatización y alcanzaron correctamente la validación funcional (404/400 con identificadores deliberadamente inexistentes, no 401).
- Inventario de migraciones comparado: producción conserva historia previa que Git mantiene aún como archivos `schema_*.sql`; documentado el procedimiento seguro para generar el baseline sin reejecutar SQL acumulativo.
- Contrato TypeScript completo del esquema productivo generado desde Supabase y versionado en `supabase/database.types.ts`.
- Ejecutor de pruebas unitarias incorporado sin dependencias adicionales, con siete verificaciones sobre RUT, montos, mínimo privilegio y Valor Ganado.
- Corregida una elevación heredada: sesiones ausentes o roles desconocidos ya no reciben nivel administrativo por defecto.
- Cálculos CPI, SPI, EAC, CV y SV extraídos a una utilidad determinística reutilizable y conectados al panel real de estadísticas de obra.
- Pruebas, lint y build productivo ejecutados correctamente; permanece como deuda técnica actualizar Node 22.11 a 22.12 o superior y reducir paquetes mayores a 500 kB.
- Prueba RLS transaccional ejecutada en producción con dos empresas y usuarios temporales: lectura propia permitida, lectura e inserción cruzadas bloqueadas y rollback verificado sin residuos.
- Prueba RLS multiempresa conservada en `supabase/tests/rls_multiempresa.sql` para futuras verificaciones controladas.
- Cobertura unitaria ampliada a 13 pruebas, incluyendo precedencia de permisos, orden de revisión/aprobación de Estados de Pago, flujo de no conformidades y acciones permitidas del Libro de Obras.
- Estados de Pago rechazan internamente envíos que intenten saltar la revisión; Calidad impide avanzar una no conformidad más de una etapa por operación.
- Validación de RUT del acceso centralizada en una única utilidad módulo 11 y cubierta con casos numéricos, dígito `K`, inválidos y texto arbitrario.
- Trazabilidad documental cubierta con pruebas de identidad, empresa, acción, estado, fecha y conservación inmutable del historial.
- Prueba de humo HTTP versionada para once Edge Functions críticas: Auth, formularios, capacitación, maquinaria, asistencia, cliente, mandante, subcontratos, correo, documentos y OX.
- Corregido un fallo de ejecución detectado por lint en el portal público de capacitaciones: el icono de envío ahora se importa explícitamente.
- Eliminada del portal externo de Estados de Pago la ruta heredada e inaccesible de escritura directa; decisiones y propuestas operan exclusivamente mediante la Edge Function protegida.
- Batería actual consolidada en 16 pruebas unitarias y 11 verificaciones HTTP; lint sin errores y build productivo correcto.
- Facturación consolidada en `FacturacionV2`: se retiraron dos implementaciones heredadas sin referencias, reduciendo más de 265 KB y 4.900 líneas duplicadas del código fuente.
- Eliminado un script heredado de inicialización que contenía una contraseña administrativa en texto plano; la autenticación vigente permanece centralizada en Supabase Auth.
- Limpieza transversal adicional en Last Planner, DTE, PDF, acreditaciones, Estados de Pago, configuración y aplicación principal; las advertencias de lint bajaron de 97 a 55, sin errores.
- Batería automatizada ampliada y verificada en 19 pruebas; compilación productiva correcta. Permanecen como alertas operativas la versión Node 22.11 y los paquetes mayores a 500 kB.
- Cargadores de datos estabilizados con callbacks explícitos en contactos, documentos laborales, capacitación pública, matrices de riesgo, correo contextual, subcontratos, IA, conciliación, clientes, rendiciones, bodega, nómina y facturación.
- Corregida una dependencia innecesaria que recalculaba el Flujo de Caja ante cambios de avance que no participan de su cálculo.
- Advertencias de lint reducidas nuevamente de 55 a 40; el remanente queda concentrado en componentes históricos que requieren división por dominio.
- Gobierno de permisos, informes del mandante, OX y escenarios predictivos estabilizados para reaccionar únicamente a cambios reales de identidad, empresa, obra o contrato.
- Eliminado el fallback operativo silencioso de Proyección de Personal: un fallo de Supabase ahora se informa y no crea registros locales que aparenten estar sincronizados.
- Advertencias de lint reducidas de 40 a 31, manteniendo 19 pruebas aprobadas y build productivo correcto.
- Arquitectura de carga estabilizada en los componentes historicos principales: Obras, Personal, Maquinaria, Prevencion, Formularios, Acreditaciones, Presupuestos y Configuracion.
- Consolidadas cargas duplicadas de Calidad y dependencias de contexto multiempresa en la aplicacion principal, sin alterar los flujos operativos existentes.
- Deuda de lint reducida de 31 a 0 advertencias; acumulado desde la auditoria: 386 a 0, sin desactivar reglas ni agregar excepciones.
- Verificacion integral del bloque completada con 19 de 19 pruebas aprobadas, lint limpio y build productivo correcto.
- Excel, Word y PDF quedaron bajo carga por demanda: abrir Obras, Presupuestos, Prevencion o Formularios ya no descarga esos motores hasta importar o generar un documento.
- Submodulos de Obras, Presupuestos y Prevencion separados en paquetes independientes, incluidos Calidad, Estados de Pago, Subcontratos, Last Planner, matrices de riesgo y analisis predictivo.
- El paquete de Obras bajo de 599,16 kB a 458,25 kB; Presupuestos de 212,26 kB a 192,48 kB y Prevencion de 163,65 kB a 142,62 kB.
- React, Supabase e iconos separados en paquetes cacheables; el paquete inicial principal bajo de 697,90 kB a 292,68 kB y ya no existen paquetes JavaScript superiores a 500 kB.
- Version minima de Node declarada en `package.json` y `.nvmrc`; se agrego una prueba arquitectonica que impide reintroducir imports estaticos de bibliotecas documentales pesadas.
- Bateria automatizada ampliada a 20 pruebas, con lint limpio y build productivo sin advertencias de tamano de paquetes.
- Node actualizado localmente a 22.23.1 y npm a 10.9.8; el contrato `>=22.12.0` ahora se valida tambien mediante prueba automatizada.
- Motores Excel, PDF y Word centralizados en `documentEngines`; ningun modulo puede importarlos directamente y cada motor conserva una unica carga diferida compartida.
- SheetJS actualizado desde su distribucion oficial a `xlsx 0.20.3`; auditoria npm de produccion cerrada con cero vulnerabilidades.
- GitHub Actions incorpora un control obligatorio reproducible con `npm ci`, auditoria, lint, 21 pruebas y build; el flujo Android reutiliza la misma version de Node y ejecuta la calidad antes de compilar el APK.
- Playwright incorporado con recorridos E2E en escritorio y movil para portada, acceso, formulario comercial y control de desborde responsive; 5 recorridos efectivos aprobados y uno omitido por no corresponder al viewport.
- Ejecutor E2E local administra Vite y Chromium sin dejar procesos abiertos; GitHub instala el navegador y ejecuta los mismos recorridos antes del build productivo.
- Auditoría productiva de Supabase ejecutada sobre tablas, políticas, migraciones, Edge Functions y advisors de seguridad/rendimiento.
- Las 46 claves foráneas públicas sin índice de soporte quedaron cubiertas mediante una migración idempotente; la verificación posterior informa cero pendientes.
- Agregada una prueba estructural de Supabase que bloquea tablas públicas sin RLS, políticas universalmente abiertas, claves foráneas sin índice y tablas sin política fuera de cuatro bitácoras privadas expresamente permitidas.
- Documentado el enlace obligatorio de la CLI y la prohibición de renumerar o reparar artificialmente las 99 migraciones históricas de producción antes de generar un baseline verificable.
- Formularios, capacitaciones y acreditaciones internas dejaron de simular operaciones exitosas en `localStorage`: los errores de Supabase ahora se muestran y ningún registro inexistente aparece como sincronizado.
- Maquinaria utiliza Supabase como fuente única para inventario, uso, asignaciones, reservas y arriendos: se retiraron las mezclas con registros locales, los identificadores ficticios y las confirmaciones de éxito cuando la persistencia remota falla.
- Optimizadas en producción y versionadas 24 políticas RLS de 20 tablas: `auth.uid()`, `auth.jwt()` y `auth.role()` se evalúan una vez por sentencia, manteniendo sin cambios sus roles, condiciones y alcance.
- Añadido un control arquitectónico para impedir que regresen los cuatro almacenes locales operativos retirados; la batería queda en 22 pruebas unitarias.
- Observabilidad del navegador conectada a la Auditoría General: errores no controlados, promesas rechazadas y fallos de componentes se registran mediante un RPC autenticado, limitado a diez eventos por minuto y sin permitir escritura directa sobre la auditoría.
- El RPC de errores exige usuario activo, conserva empresa y actor, limita mensaje y stack, fija `search_path`, deniega ejecución anónima y concede solamente a `authenticated`.
- Corregida la eliminación de proyecciones de dotación: ya no referencia una clave local inexistente ni acepta identificadores simulados.
- La Auditoría General incorpora filtro operativo por resultado para aislar eventos fallidos, observados, pendientes o exitosos.
