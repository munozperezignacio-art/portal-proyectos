# Correcciones de sincronización y sesiones de la app nativa

Fecha: 20 de octubre de 2026.
Base: `7d10ccb425cd5ef8bda0c210573d24a6f66fefab` de `main`.
Rama local: `fix/native-offline-sessions`.

## Cambios preparados

- Las escrituras de la cola local se serializan. Dos guardados simultáneos ya no se pisan y terminar una sincronización no borra registros añadidos durante el envío.
- Solo hay una sincronización activa. Cada nuevo pendiente conserva el usuario autenticado y la empresa del perfil verificado. Cambiar de cuenta detiene el resto del lote y nunca atribuye sus datos a la cuenta nueva. Cada petición lleva explícitamente el token de la identidad comprobada.
- Se conserva la clave de almacenamiento existente. Los pendientes antiguos sin propietario no se asignan automáticamente a ningún usuario ni se eliminan.
- Antes de enviar un pendiente se guarda que el envío comenzó. Si la aplicación se cierra, se pierde la respuesta o falla el borrado local después de una respuesta exitosa, el registro queda para revisión, sin repetir automáticamente una operación que podría haberse aceptado.
- La interfaz actualiza el contador al guardar, muestra errores de almacenamiento/sincronización y vuelve a comprobar los pendientes durante la conexión. Los errores devueltos por una función también impiden borrar el pendiente.
- Una consulta temporalmente fallida de perfil o permisos ya no cierra la sesión persistida. Se muestra Reintentar y las pantallas de trabajo permanecen bloqueadas hasta verificar el perfil. Las respuestas tardías de una cuenta no pueden restaurarla después de salir ni sobrescribir otra cuenta. Se conserva el control biométrico.
- El acceso desde la pantalla de login se redirige cuando el perfil está disponible, para evitar navegar desde una operación asíncrona durante la comprobación de sesión.
- Formularios, asistencia y estadísticas usan la fecha de America/Santiago. El desplazamiento de +1 día hábil avanza al siguiente día hábil; la duración inclusiva de una actividad mantiene su comportamiento.

La coincidencia de partidas ya estaba corregida en la base actual (cambio 8b4feef). Se conservaron esa implementación y sus pruebas. No se modificaron dependencias, políticas de Supabase, datos reales, configuración de publicación ni controles de seguridad.

## Verificación

- `npm test` en `mobile`: 33 comprobaciones correctas, incluidas 21 nuevas sobre cola, sesiones y fechas.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto, sin desactivar reglas.
- `expo export --platform android`: correcto; Metro procesó el código y Hermes generó el paquete Android. Esto es un empaquetado local, no una APK ni una compilación nativa de EAS.
- `git diff --check`: correcto.

Las pruebas de cola simulan concurrencia, cambio de cuenta/empresa, envío de funciones, fallo de disco, almacenamiento corrupto, pérdida de respuesta y fallo del borrado posterior al envío. Las de sesión simulan fallos de red/permisos, reintento, salida/cambio de usuario durante una consulta y renovación de token. No hacen llamadas a producción.

Se usaron las dependencias instaladas mediante una unión de directorio en esta copia. Los archivos package.json y package-lock.json coinciden con los de la copia original en contenido; solo difieren sus finales de línea. Las pruebas que crean repositorios Git temporales y el compilador Hermes necesitaron ejecución fuera del sandbox para escribir sus temporales; no se modificaron los controles para eludir esos fallos del entorno.

## Límites antes de publicar

1. Falta probar en un teléfono Android: iniciar/restaurar sesión, reintentar sin red, biometría, cerrar/cambiar cuenta, guardar sin conexión y reconectar. Los mocks y el empaquetado no prueban la navegación, almacenamiento y conectividad reales del dispositivo.
2. Los registros señalados para revisión se conservan localmente. Esta entrega no incorpora una pantalla de conciliación ni su reasignación automática. Antes de recuperarlos, hay que comprobar su propietario y si ya existen en el servidor. No borrar datos de la aplicación ni reinstalar para intentar resolverlos.
3. La recuperación automática y segura tras una respuesta perdida requiere idempotencia en el servidor. Esta corrección evita el reenvío automático y conserva el registro para revisión; no promete entrega exactamente una vez. Un error de una escritura iniciada online se devuelve al formulario y no se encola silenciosamente: antes de repetirlo debe comprobarse si el servidor lo aceptó.
4. Al abrir de nuevo la aplicación sin conexión, la sesión se conserva, pero no se autoriza el acceso con permisos que no pudieron verificarse. Hace falta conexión para cargar el perfil.
5. No se generó APK, no se ejecutó GitHub Actions/EAS y no se publicó la rama. Una futura versión requiere aprobación y el proceso oficial `npm run mobile:apk` descrito en `mobile/AGENTS.md`; también deben completarse las comprobaciones remotas aplicables. Los cambios locales todavía no están en la aplicación instalada.
