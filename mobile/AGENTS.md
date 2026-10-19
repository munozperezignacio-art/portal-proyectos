# Publicación de Obraxis Terreno

Para generar APK usa únicamente `npm run mobile:apk` desde la raíz del repositorio.
`npm run mobile:apk:check` comprueba los requisitos sin iniciar una compilación.

- Revisa todos los cambios pendientes del móvil; no selecciones solo los del chat
  actual si el usuario solicita una versión con todas las mejoras.
- Incluye y verifica las mejoras autorizadas, guarda los archivos del móvil en Git
  y publícalos en `main` antes de compilar. Si no está claro si un cambio pendiente
  debe incluirse, acláralo; no lo omitas silenciosamente.
- No ejecutes `eas build` directamente ni prepares archivos o copias parciales a
  mano. No evites los bloqueos del proceso ni alteres las comprobaciones para sacar
  una compilación. La copia temporal que prepara el comando oficial es íntegra y
  se genera después de las comprobaciones.
- Conserva la comprobación `eas-build-pre-install` y el inventario de archivos.
  Agrega una prueba de regresión si cambias las reglas de publicación.
- Antes de entregar un APK, confirma que el build terminó, comprueba su versión y
  origen contra el registro en `entregables/apk/registros/` y usa el enlace de ese
  build. Un build enviado o pendiente no es un instalador final.
- Las próximas APK muestran versión y revisión en Inicio. No hace falta generar
  un nuevo instalador solo para modificar el proceso, salvo que el usuario lo pida.
