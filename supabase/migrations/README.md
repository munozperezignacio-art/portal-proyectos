# Migraciones de Supabase

Esta carpeta contiene el historial SQL productivo versionado de Obraxis.

## Estado de reproducibilidad

- Las 111 migraciones fueron recuperadas directamente desde
  `supabase_migrations.schema_migrations` mediante `supabase migration fetch`.
- Sus versiones, nombres y sentencias coinciden con el historial aplicado en el
  proyecto productivo `wegphblwwcfidvdbdtdq`.
- Los archivos `schema_*.sql` de la raíz se conservan como referencia histórica;
  no deben ejecutarse sobre una instalación que use este historial.
- No se deben renumerar, duplicar ni marcar artificialmente migraciones como
  reparadas. La comparación oficial se realiza con
  `supabase migration list --linked`.

## Regla operativa

Toda modificación nueva debe tener un único archivo en esta carpeta, aplicarse
transaccionalmente, verificarse con consultas posteriores y coincidir con el
registro de `supabase_migrations.schema_migrations`.

Después de cada migración deben ejecutarse `../tests/schema_invariants.sql` y
`../tests/rls_multiempresa.sql`. La primera impide publicar tablas sin RLS,
políticas abiertas o claves foráneas sin índice. Las cuatro tablas de intentos
incluidas en su lista privada no tienen políticas de cliente deliberadamente:
sólo `service_role` puede operar sobre ellas.

Las Edge Functions que usan autenticación personalizada mediante secretos de
Vault están declaradas en `../config.toml`; desactivar `verify_jwt` en esos casos
no las hace públicas porque la función rechaza solicitudes sin su secreto.

## Contrato TypeScript del esquema

El archivo `../database.types.ts` se genera directamente desde el proyecto
productivo `wegphblwwcfidvdbdtdq`. Debe regenerarse después de aplicar cambios
de esquema y revisarse en el mismo commit que la migración correspondiente. Es
un contrato de compilación y revisión; no reemplaza el historial SQL ni debe
editarse manualmente.
