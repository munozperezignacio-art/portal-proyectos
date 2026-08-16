# Plan de transición a operación comercial

## Estado actual

Mientras Obraxis opere exclusivamente con información ficticia y no tenga clientes comerciales, se mantiene el flujo ágil actual: desarrollo, verificación proporcional al cambio y publicación directa en `main`.

Este esquema debe finalizar **antes de incorporar la primera empresa con datos reales o comenzar a cobrar por el servicio**, lo que ocurra primero.

## Condición de activación

La transición se ejecutará cuando ocurra cualquiera de estos eventos:

- incorporación de una empresa piloto con datos reales;
- contratación o pago por el servicio;
- ingreso de documentos reales, datos personales o antecedentes contractuales;
- publicación formal de las aplicaciones móviles para usuarios externos.

## Arquitectura objetivo

### Producción

- Rama Git: `main`.
- Aplicación: `obraxis.cl`.
- Supabase exclusivo de producción.
- Solo datos reales y versiones aprobadas.
- Publicaciones planificadas; sin commits directos.

### Pruebas o staging

- Rama Git permanente: `develop`.
- URL Preview privada de Vercel o `pruebas.obraxis.cl`.
- Supabase aislado de producción.
- Datos ficticios y correos limitados a destinatarios internos.
- Claves, Auth, Storage y Edge Functions separados.

### Desarrollo

- Una rama por cambio: `feature/*`, `fix/*` o `hotfix/*`.
- Preview independiente por rama.
- Integración primero en `develop` y posteriormente en `main`.

## Flujo de publicación

1. Implementar en una rama de trabajo.
2. Ejecutar compilación, pruebas automáticas y controles de seguridad.
3. Publicar Preview conectada exclusivamente a staging.
4. Revisar en escritorio y móvil con datos ficticios.
5. Revisar migraciones, RLS, Edge Functions, Storage y permisos.
6. Integrar en `develop`.
7. Preparar versión y copia de seguridad de producción.
8. Integrar mediante pull request en `main`.
9. Verificar producción y mantener una ruta de rollback.

## Frecuencia sugerida

- Etapa comercial inicial: una publicación semanal.
- Operación estable: publicación quincenal.
- Incidentes críticos o de seguridad: hotfix inmediato y acotado.

## Reglas de base de datos

- Ningún Preview puede usar la base productiva.
- Toda modificación se registra como migración versionada.
- Las migraciones deben ser compatibles hacia atrás cuando sea posible.
- Los cambios destructivos se separan en etapas: agregar, migrar, verificar y retirar.
- Las pruebas usan datos sintéticos; nunca copias indiscriminadas de producción.

## Liberación gradual

Incorporar banderas de funcionalidad para habilitar cambios por:

- equipo interno de Obraxis;
- empresa piloto;
- módulo contratado;
- rol o usuario autorizado;
- disponibilidad global.

## Aplicaciones móviles

- Compilación interna antes de cada publicación.
- Canal cerrado en Google Play y TestFlight.
- Validación contra staging.
- Versión pública solo después de verificar compatibilidad con las API productivas.

## Lista previa a la primera empresa real

- [ ] Crear rama `develop` y política de pull requests para `main`.
- [ ] Crear Supabase de staging aislado.
- [ ] Configurar variables Vercel para Preview y Production.
- [ ] Restringir correos de staging a cuentas internas.
- [ ] Configurar CI para compilación, pruebas y validación de migraciones.
- [ ] Establecer respaldos, monitoreo y procedimiento de rollback.
- [ ] Implementar banderas de funcionalidad.
- [ ] Definir calendario y responsable de cada publicación.
- [ ] Ejecutar una simulación completa de despliegue y reversión.

