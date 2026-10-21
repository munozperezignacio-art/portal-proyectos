# Actualización Android desde Obraxis

Módulo local de Expo, descubierto automáticamente desde `modules/`.
Necesita una APK nueva; no funciona en Expo Go ni en navegador.

- DownloadManager mantiene la descarga al cerrar o poner la app en segundo plano.
- El identificador se conserva en preferencias privadas; la app recupera el progreso.
- Guarda una única APK en el directorio externo privado de la app.
- SHA-256 se calcula en Android con un buffer de 64 KiB, sin cargar la APK completa en JavaScript.
- Rechaza archivos que no coinciden con el catálogo. Antes de abrir el instalador vuelve a verificar la huella.
- FileProvider concede lectura temporal únicamente al archivo de actualización.
- Android solicita permiso de instalación desde Obraxis y confirmación del usuario.
- Después de autorizar la fuente, se pulsa Instalar actualización de nuevo; no se descarga otra vez.
- Abrir el instalador no se anuncia como instalación completada. Android comprueba firma y compatibilidad.

Validación pendiente en dispositivo con una APK compilada: descargar con pantalla bloqueada, recuperar tras cierre, cancelar/reintentar, autorizar fuente, cancelar instalador y actualizar conservando sesión/datos. Las pruebas de JavaScript cubren estados y reintentos; no sustituyen esta prueba nativa.
