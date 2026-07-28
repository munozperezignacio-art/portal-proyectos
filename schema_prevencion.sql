-- Script de base de datos para el Submódulo de Capacitaciones, Evaluaciones y Cumplimiento de Seguridad
-- Ejecutar este script en el SQL Editor de tu consola de Supabase.

-- 1. Tabla de Capacitaciones de Prevención
CREATE TABLE IF NOT EXISTS prevencion_capacitaciones (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    video_url TEXT, -- Enlace a video (YouTube, Vimeo, etc.)
    contenido_texto TEXT, -- Contenido instructivo (Textos, manuales)
    preguntas JSONB NOT NULL DEFAULT '[]', -- Estructura de evaluación: [{"pregunta": "", "tipo": "multiple", "opciones": ["", ""], "correct_idx": 0, "puntos": 10}]
    creado_por TEXT,
    publico_token TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Intentos / Resultados de Evaluaciones
CREATE TABLE IF NOT EXISTS prevencion_capacitaciones_intentos (
    id SERIAL PRIMARY KEY,
    capacitacion_id INTEGER REFERENCES prevencion_capacitaciones(id) ON DELETE CASCADE,
    nombre_trabajador TEXT NOT NULL,
    rut_trabajador TEXT NOT NULL,
    respuestas JSONB NOT NULL DEFAULT '{}', -- Registro de respuestas del trabajador: {"pregunta_idx": seleccion_idx}
    puntaje_obtenido NUMERIC DEFAULT 0,
    puntaje_maximo NUMERIC DEFAULT 0,
    nota NUMERIC DEFAULT 1.0, -- Nota de evaluación (escala 1.0 a 7.0 por defecto en Chile)
    aprobado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Asignaciones de Cumplimiento de Seguridad
CREATE TABLE IF NOT EXISTS prevencion_cumplimiento_asignaciones (
    id SERIAL PRIMARY KEY,
    trabajador_rut TEXT NOT NULL,
    trabajador_nombre TEXT NOT NULL,
    registro_nombre TEXT NOT NULL,
    frecuencia TEXT NOT NULL, -- Diario, Semanal, Mensual
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Registros de Cumplimiento (Log de Verificaciones)
CREATE TABLE IF NOT EXISTS prevencion_cumplimiento_registros (
    id SERIAL PRIMARY KEY,
    asignacion_id INTEGER REFERENCES prevencion_cumplimiento_asignaciones(id) ON DELETE CASCADE,
    fecha_cumplimiento DATE NOT NULL,
    estado TEXT DEFAULT 'Cumple', -- Cumple, No Cumple, N/A
    observaciones TEXT,
    verificado_por TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deshabilitar políticas de seguridad RLS para permitir lecturas y envíos públicos o desde cliente
ALTER TABLE prevencion_capacitaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE prevencion_capacitaciones_intentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE prevencion_cumplimiento_asignaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE prevencion_cumplimiento_registros DISABLE ROW LEVEL SECURITY;
