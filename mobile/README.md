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

Para binarios instalables se configurará EAS Build cuando se definan las cuentas de Apple Developer y Google Play.

## Compilaciones

- `npx eas-cli build --platform android --profile preview`: genera una APK instalable para pruebas.
- `npx eas-cli build --platform android --profile production`: genera el AAB destinado a Google Play.

Las variables públicas de Supabase deben configurarse también en el entorno EAS antes de la primera compilación remota.
