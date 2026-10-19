# Obraxis Terreno

Aplicación nativa Android/iOS para la operación esencial de Obraxis en terreno.

## Alcance MVP

- Obras: avance, maquinaria, asistencia, subcontratos y estadísticas.
- Maquinaria: equipos, registros de uso/fallas, reservas y estadísticas.
- Recursos Humanos: listado de personal y asignaciones.
- Formularios: biblioteca y consulta de registros respondidos.

La app usa el mismo Supabase Auth, perfiles, empresas, permisos y políticas RLS de la plataforma web. No contiene claves administrativas.

## Configuración local

1. Copia `.env.example` como `.env`.
2. Usa la URL y la **Publishable Key** del proyecto Supabase. Nunca uses `service_role` ni una Secret Key.
3. Ejecuta `npm install` y luego `npm start` dentro de `mobile`, o desde la raíz: `npm run mobile`.

El acceso mantiene la identidad actual: usuario + empresa + contraseña mediante la función segura `login-usuario`.

## Verificación

```bash
npm run typecheck
npm run lint
npx expo export --platform web
```

## Compilaciones

Desde la raíz del repositorio:

```bash
npm run mobile:apk:check
npm run mobile:apk:inspect
npm run mobile:apk
```

El primer comando verifica sin iniciar una compilación remota. El segundo inspecciona
el archivo real que EAS enviaría y comprueba su inventario, sin generar una APK.
El tercero actualiza
la referencia de `origin/main`, ejecuta tipos y pruebas, prepara una copia completa
del commit y solicita el APK a Expo. No selecciona archivos individuales ni realiza
commits o publicaciones automáticamente.

Antes de compilar, todas las mejoras del móvil deben estar integradas y publicadas
en `main`. Si hay archivos modificados, nuevos o código ignorado en `src`, `assets`
o `scripts`, el proceso se detiene e indica cuáles faltan. Tampoco admite ejecutar
desde una copia parcial ni con variables que cambien el origen de los archivos.

El envío lleva un inventario de archivos y huellas SHA-256. Expo comprueba ese
inventario antes de instalar dependencias: si falta un archivo, cambia su contenido
o falta el inventario, la compilación se bloquea. El incremento remoto del contador
Android/iOS se permite sin alterar la versión ni el resto de la configuración.

Los registros quedan en `entregables/apk/registros/`, con versión, commit, inventario
e identificador del build. La pantalla de inicio de las próximas APK mostrará la
versión y la revisión para identificar el instalador. La compilación enviada queda
pendiente hasta que Expo confirme su finalización; no se entrega un enlace antiguo
como si correspondiera a una nueva versión.

No usar `eas build` directamente, copias de `git archive` manuales o carpetas de
compilaciones anteriores. Los comandos directos no generan el inventario obligatorio.
La única copia sin Git permitida es la que crea el proceso después de verificar el
proyecto original: contiene todos los archivos del commit, no una selección.

El flujo histórico `Android web (Capacitor, legado)` empaqueta la plataforma web,
no Obraxis Terreno. Queda limitado a ejecución manual y su artefacto se identifica
como `obraxis-web-capacitor-debug-apk`. No debe entregarse como actualización de la
app nativa ni usarse para validar sus mejoras de asistencia o estadísticas.

Las variables públicas de Supabase deben configurarse también en el entorno EAS antes de la primera compilación remota.
