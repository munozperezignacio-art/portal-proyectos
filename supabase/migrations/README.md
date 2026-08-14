# Migraciones de Supabase

Esta carpeta contiene las migraciones incrementales versionadas de Obraxis desde
la incorporación de OX y la estabilización multiempresa.

## Estado de reproducibilidad

- Producción mantiene además migraciones históricas creadas entre el 10 y el 13
  de agosto de 2026.
- Sus fuentes originales están conservadas temporalmente como `schema_*.sql` en
  la raíz del repositorio.
- Esos archivos no deben copiarse ni ejecutarse nuevamente como migraciones:
  varios representan estados acumulados y podrían duplicar objetos o datos.
- La consolidación pendiente debe realizarse mediante un `supabase db pull` o
  un volcado de esquema limpio desde producción, comparado en una base vacía.

## Regla operativa

Toda modificación nueva debe tener un único archivo en esta carpeta, aplicarse
transaccionalmente, verificarse con consultas posteriores y coincidir con el
registro de `supabase_migrations.schema_migrations`.

Las Edge Functions que usan autenticación personalizada mediante secretos de
Vault están declaradas en `../config.toml`; desactivar `verify_jwt` en esos casos
no las hace públicas porque la función rechaza solicitudes sin su secreto.

## Contrato TypeScript del esquema

El archivo `../database.types.ts` se genera directamente desde el proyecto
productivo `wegphblwwcfidvdbdtdq`. Debe regenerarse después de aplicar cambios
de esquema y revisarse en el mismo commit que la migración correspondiente. Es
un contrato de compilación y revisión; no reemplaza el historial SQL ni debe
editarse manualmente.
