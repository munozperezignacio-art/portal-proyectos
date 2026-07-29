-- =====================================================================
-- SCRIPT OFICIAL OBRAXIS: HABILITACIÓN DE ROW-LEVEL SECURITY (RLS) EN SUPABASE
-- Proyecto: porta-obras (wegphblwwcfidvdbdtdq)
-- =====================================================================

-- PASO 1: Habilitar RLS en todas las tablas existentes y futuras del esquema public
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END $$;

-- PASO 2: Crear políticas permisivas para que la aplicación frontend (anon y authenticated)
-- pueda continuar leyendo, insertando, actualizando y eliminando datos sin interrupciones.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        -- Eliminar política anterior si existía para evitar errores de duplicado
        EXECUTE format('DROP POLICY IF EXISTS "Allow_All_Operations_Anon_Authenticated" ON public.%I;', r.tablename);
        
        -- Crear política pública permisiva para anon y authenticated
        EXECUTE format('CREATE POLICY "Allow_All_Operations_Anon_Authenticated" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', r.tablename);
    END LOOP;
END $$;

-- PASO 3: Asegurar permisos a los roles anon y authenticated en el esquema public
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
