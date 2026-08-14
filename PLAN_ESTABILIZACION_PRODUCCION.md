# Plan de estabilización y cierre de Obraxis

Estado inicial de la auditoría: 14 de agosto de 2026.

Avance actualizado: Etapa 1 28%; plan completo 6%.

Objetivo: llevar Obraxis desde una plataforma funcionalmente amplia a una operación productiva segura, reproducible, verificable y mantenible, sin eliminar funciones existentes.

## Etapa 1 — Cierre de seguridad

- [ ] Reemplazar políticas RLS abiertas por aislamiento real por empresa y obra.
- [ ] Eliminar acceso anónimo directo no indispensable.
- [ ] Mover Resend completamente al servidor y rotar su clave.
- [ ] Eliminar claves de IA del navegador y de tablas expuestas.
- [x] Proteger tareas Cron con un secreto interno en Vault independiente de la clave pública.
- [ ] Activar protección de contraseñas filtradas en Supabase Auth.
- [ ] Revisar `GRANT` y funciones `SECURITY DEFINER`.
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
