CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.clientes_portales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa TEXT NOT NULL, cliente_nombre TEXT NOT NULL,
  cliente_rut TEXT NOT NULL, contacto_nombre TEXT NOT NULL, contacto_email TEXT NOT NULL, contacto_cargo TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'), clave_hash TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE, creado_por TEXT, ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa, cliente_rut, contacto_email)
);
CREATE TABLE IF NOT EXISTS public.clientes_portal_obras (
  id BIGSERIAL PRIMARY KEY, portal_id UUID NOT NULL REFERENCES public.clientes_portales(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL, obra_nombre TEXT NOT NULL, permisos JSONB NOT NULL DEFAULT '{}'::jsonb,
  permite_comentar BOOLEAN NOT NULL DEFAULT FALSE, publicada BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portal_id, obra_nombre)
);
CREATE TABLE IF NOT EXISTS public.clientes_portal_eventos (
  id BIGSERIAL PRIMARY KEY, portal_id UUID REFERENCES public.clientes_portales(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL, obra_nombre TEXT, accion TEXT NOT NULL, actor TEXT, detalle TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS clientes_portales_empresa_idx ON public.clientes_portales (empresa, cliente_nombre);
CREATE INDEX IF NOT EXISTS clientes_portal_obras_portal_idx ON public.clientes_portal_obras (portal_id, publicada);
CREATE INDEX IF NOT EXISTS clientes_portal_eventos_portal_idx ON public.clientes_portal_eventos (portal_id, created_at DESC);
ALTER TABLE public.clientes_portales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_portal_obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_portal_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clientes_portales_empresa_auth ON public.clientes_portales;
CREATE POLICY clientes_portales_empresa_auth ON public.clientes_portales FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo) = lower(auth.jwt() ->> 'email') AND u.empresa = clientes_portales.empresa))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo) = lower(auth.jwt() ->> 'email') AND u.empresa = clientes_portales.empresa));
DROP POLICY IF EXISTS clientes_portal_obras_empresa_auth ON public.clientes_portal_obras;
CREATE POLICY clientes_portal_obras_empresa_auth ON public.clientes_portal_obras FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo) = lower(auth.jwt() ->> 'email') AND u.empresa = clientes_portal_obras.empresa))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo) = lower(auth.jwt() ->> 'email') AND u.empresa = clientes_portal_obras.empresa));
DROP POLICY IF EXISTS clientes_portal_eventos_empresa_auth ON public.clientes_portal_eventos;
CREATE POLICY clientes_portal_eventos_empresa_auth ON public.clientes_portal_eventos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo) = lower(auth.jwt() ->> 'email') AND u.empresa = clientes_portal_eventos.empresa));
REVOKE ALL ON public.clientes_portales, public.clientes_portal_obras, public.clientes_portal_eventos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_portales, public.clientes_portal_obras TO authenticated;
GRANT SELECT ON public.clientes_portal_eventos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.clientes_portal_obras_id_seq, public.clientes_portal_eventos_id_seq TO authenticated;;
