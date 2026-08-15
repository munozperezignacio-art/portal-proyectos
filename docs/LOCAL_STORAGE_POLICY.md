# Política de almacenamiento local

`localStorage` no es una fuente de verdad operativa en Obraxis.

Se permite únicamente para:

- sesión y preferencias de interfaz (empresa seleccionada, favoritos y pestañas);
- caché visual recuperable desde Supabase;
- borradores o simulaciones de planificación que todavía no constituyen un registro aprobado;
- parámetros privados del dispositivo que no se presentan como sincronizados.

Los registros de RR. HH., procedimientos, presupuestos, partidas, costos, arriendos,
cuadrillas, liquidaciones, maquinaria, formularios y fechas contractuales se confirman
solamente después de persistir en Supabase. Las pruebas de arquitectura bloquean la
reintroducción de sus antiguas claves locales.
