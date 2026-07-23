-- Script de Creación de Tablas para el Módulo de Facturación Electrónica, Centros de Gestión y Órdenes de Compra (iConstruye Style)
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase para crear o actualizar las tablas necesarias.

-- 1. Tabla de Configuración de Facturación (SII y Certificado)
CREATE TABLE IF NOT EXISTS facturacion_config (
    id SERIAL PRIMARY KEY,
    empresa TEXT UNIQUE NOT NULL,
    rut_empresa TEXT,
    razon_social TEXT,
    giro TEXT,
    comuna TEXT,
    direccion TEXT,
    actividades_economicas JSONB DEFAULT '[]',
    certificado_digital_base64 TEXT,
    certificado_nombre TEXT,
    modo_sii TEXT DEFAULT 'Certificación', -- 'Certificación' o 'Producción'
    rechazo_sin_oc BOOLEAN DEFAULT FALSE, -- Regla de control automático
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Centros de Gestión (Costos)
CREATE TABLE IF NOT EXISTS facturacion_centros_gestion (
    id SERIAL PRIMARY KEY,
    empresa TEXT NOT NULL,
    codigo TEXT NOT NULL, -- Restringido a 3 dígitos (ej: '001', '120', etc.)
    nombre TEXT NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_empresa_codigo UNIQUE(empresa, codigo)
);

-- 3. Tabla de Secciones / Departamentos
CREATE TABLE IF NOT EXISTS facturacion_secciones (
    id SERIAL PRIMARY KEY,
    empresa TEXT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_empresa_seccion UNIQUE(empresa, nombre)
);

-- 4. Tabla de Proveedores Autorizados
CREATE TABLE IF NOT EXISTS facturacion_proveedores (
    id SERIAL PRIMARY KEY,
    empresa TEXT NOT NULL,
    rut TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    giro TEXT,
    direccion TEXT,
    comuna TEXT,
    email_dte TEXT,
    plazo_pago INTEGER DEFAULT 30, -- Días de plazo de pago pactado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_empresa_proveedor UNIQUE(empresa, rut)
);

-- 5. Tabla de Órdenes de Compra (OC)
CREATE TABLE IF NOT EXISTS facturacion_ordenes_compra (
    id SERIAL PRIMARY KEY,
    empresa TEXT NOT NULL,
    numero INTEGER NOT NULL, -- Folio secuencial de la OC por empresa
    fecha DATE DEFAULT CURRENT_DATE,
    proveedor_rut TEXT NOT NULL,
    proveedor_nombre TEXT NOT NULL,
    centro_gestion_id INTEGER REFERENCES facturacion_centros_gestion(id) ON DELETE SET NULL,
    seccion_id INTEGER REFERENCES facturacion_secciones(id) ON DELETE SET NULL, -- Seccion asociada
    monto_neto NUMERIC DEFAULT 0,
    monto_iva NUMERIC DEFAULT 0,
    monto_total NUMERIC DEFAULT 0,
    detalles JSONB DEFAULT '[]', -- Listado de ítems de compra
    estado TEXT DEFAULT 'Borrador', -- 'Borrador', 'Enviada', 'Facturada', 'Anulada'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_empresa_oc UNIQUE(empresa, numero)
);

-- 6. Tabla de Recepciones de Bodega (Materiales/Servicios)
CREATE TABLE IF NOT EXISTS facturacion_recepciones (
    id SERIAL PRIMARY KEY,
    empresa TEXT NOT NULL,
    oc_id INTEGER REFERENCES facturacion_ordenes_compra(id) ON DELETE CASCADE,
    fecha_recepcion DATE DEFAULT CURRENT_DATE,
    recibido_por TEXT NOT NULL,
    detalles JSONB DEFAULT '[]', -- Lista de items recibidos y cantidad
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabla de Documentos Tributarios Electrónicos (DTE) - Ventas y Compras
CREATE TABLE IF NOT EXISTS facturacion_documentos (
    id SERIAL PRIMARY KEY,
    empresa TEXT NOT NULL,
    tipo_dte INTEGER NOT NULL, -- 33: Factura Afecta, 34: Factura Exenta, 39: Boleta, 41: Boleta Exenta, 52: Guía de Despacho, 61: Nota de Crédito
    folio INTEGER NOT NULL,
    direccion_flujo TEXT DEFAULT 'Venta', -- 'Venta' (Emitido) o 'Compra' (Recibido de proveedor)
    fecha_emision DATE DEFAULT CURRENT_DATE,
    rut_receptor TEXT NOT NULL,
    nombre_receptor TEXT NOT NULL,
    monto_neto NUMERIC DEFAULT 0,
    monto_iva NUMERIC DEFAULT 0,
    monto_total NUMERIC DEFAULT 0,
    detalles JSONB DEFAULT '[]', -- Lista de productos/servicios
    centro_gestion_id INTEGER REFERENCES facturacion_centros_gestion(id) ON DELETE SET NULL,
    seccion_id INTEGER REFERENCES facturacion_secciones(id) ON DELETE SET NULL,
    referencia_oc_id INTEGER REFERENCES facturacion_ordenes_compra(id) ON DELETE SET NULL,
    referencia_folio INTEGER, -- Folio del documento que se referencia (ej: para Nota de Crédito o Guía)
    referencia_tipo INTEGER, -- Tipo DTE referenciado
    estado_sii TEXT DEFAULT 'Pendiente', -- 'Aceptado', 'Rechazado', 'Pendiente'
    estado_acuse TEXT DEFAULT 'Pendiente', -- Acuse de recibo SII: 'Aceptado', 'Reclamado', 'Pendiente'
    motivo_reclamo TEXT, -- Detalle si se rechaza la factura
    track_id TEXT, -- ID de seguimiento retornado por el SII
    xml_content TEXT, -- Contenido XML estructurado del DTE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabla de Folios Autorizados (CAF)
CREATE TABLE IF NOT EXISTS facturacion_folios (
    id SERIAL PRIMARY KEY,
    empresa TEXT NOT NULL,
    tipo_dte INTEGER NOT NULL,
    desde INTEGER NOT NULL,
    hasta INTEGER NOT NULL,
    actual INTEGER NOT NULL,
    caf_xml TEXT,
    fecha_autorizacion DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deshabilitar RLS para facilitar la lectura y escritura directa desde la aplicación
ALTER TABLE facturacion_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion_centros_gestion DISABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion_secciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion_proveedores DISABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion_ordenes_compra DISABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion_recepciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion_documentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion_folios DISABLE ROW LEVEL SECURITY;
