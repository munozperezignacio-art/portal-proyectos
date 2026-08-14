# Plan de estabilización y cierre de Obraxis

Estado inicial de la auditoría: 14 de agosto de 2026.

Avance actualizado: Etapa 1 99%; plan completo 22%.

Objetivo: llevar Obraxis desde una plataforma funcionalmente amplia a una operación productiva segura, reproducible, verificable y mantenible, sin eliminar funciones existentes.

## Etapa 1 — Cierre de seguridad

- [x] Reemplazar políticas RLS abiertas por aislamiento real por empresa y obra.
- [x] Eliminar acceso anónimo directo no indispensable.
- [ ] Mover Resend completamente al servidor y rotar su clave.
- [x] Eliminar claves de IA del navegador y de tablas expuestas.
- [x] Proteger tareas Cron con un secreto interno en Vault independiente de la clave pública.
- [ ] Activar protección de contraseñas filtradas en Supabase Auth.
- [x] Revisar `GRANT` y funciones `SECURITY DEFINER`.
- [ ] Verificar con pruebas cruzadas entre al menos dos empresas.

## Etapa 2 — Integridad y reproducibilidad

- [ ] Reasignar partidas y avances sin `empresa` u `obra_id`.
- [ ] Hacer obligatorios los identificadores multiempresa donde corresponda.
- [ ] Consolidar toda la historia en `supabase/migrations`.
- [ ] Sincronizar Edge Functions locales y desplegadas.
- [ ] Corregir automatizaciones del mandante que responden 401.
- [ ] Incorporar índices de claves foráneas según uso real.

## Etapa 3 — Pruebas

- [ ] Configurar pruebas unitarias, de integración y de interfaz.
- [ ] Probar aislamiento entre empresas y permisos por rol.
- [ ] Cubrir Auth, estados de pago, Libro de Obras, calidad y prevención.
- [ ] Cubrir formularios públicos, subcontratos, mandante y acreditaciones.
- [ ] Cubrir bodega, DTE, centros de gestión, OX, IA, Cron y correos.
- [ ] Ejecutar pruebas de humo posteriores a cada despliegue.

## Etapa 4 — Limpieza y refactorización

- [ ] Dividir componentes extensos por dominio.
- [ ] Extraer servicios de datos, hooks, reglas de cálculo y permisos.
- [ ] Centralizar adaptadores PDF, Excel y formatos documentales.
- [ ] Eliminar fallbacks operativos silenciosos a `localStorage`.
- [ ] Reservar almacenamiento local para caché, preferencias y borradores explícitos.

## Etapa 5 — Rendimiento y observabilidad

- [ ] Sustituir o aislar `xlsx`.
- [ ] Corregir dependencias vulnerables y fijar la versión de Node.
- [ ] Reparar lint y convertirlo en control obligatorio.
- [ ] Reducir paquetes grandes y carga inicial.
- [ ] Incorporar alertas de errores, métricas y trazabilidad de automatizaciones.

## Criterio de término

La plataforma se considerará lista para producción cuando no existan políticas abiertas en datos privados, ningún secreto llegue al navegador, el esquema sea reconstruible desde migraciones, las funciones desplegadas coincidan con Git y los flujos críticos cuenten con pruebas automatizadas.

## Avances ejecutados

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
- Obras, maestro de personal y asistencia quedaron aislados por empresa; `anon` ya no posee privilegios sobre esas tablas.
- Políticas públicas amplias reducidas de 3 a 0 y verificadas directamente en producción.
- Control de lint reactivado en Windows; corregido el único error bloqueante de reglas de Hooks detectado en Bodega.
- Auditoría de integridad multiempresa iniciada: quedan 19 avances, 4 partidas y 10 asistencias heredadas sin obra inequívoca; se mantienen identificadas para reasignación controlada, sin inventar relaciones ni eliminar registros.
