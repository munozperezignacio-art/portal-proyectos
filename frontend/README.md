# Obraxis Web

Aplicación web de gestión integral para empresas constructoras, desplegada en
Vercel y conectada a Supabase.

## Desarrollo

```powershell
npm install
npm run dev
```

## Verificación

```powershell
npm test
npm run lint
npm run build
```

El esquema productivo se administra exclusivamente mediante
`../supabase/migrations`. No deben añadirse scripts SQL manuales en la raíz del
repositorio ni credenciales administrativas en el frontend.
