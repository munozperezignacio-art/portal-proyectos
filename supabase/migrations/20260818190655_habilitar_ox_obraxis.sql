-- OX forma parte de las herramientas operativas de la plataforma Obraxis.
-- Conserva el resto de la configuracion y limites definidos para la empresa.
update public.ia_config_empresas
set funciones = coalesce(funciones, '{}'::jsonb) || jsonb_build_object('copiloto', true),
    updated_at = now()
where lower(trim(empresa)) = 'obraxis';
