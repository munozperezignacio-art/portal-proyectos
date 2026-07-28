import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wegphblwwcfidvdbdtdq.supabase.co';
const supabaseAnonKey = 'sb_publishable_LKC9XEmI711b7nm7rVPalQ_FxZPKis2';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function start() {
  console.log("Iniciando inserción de documentos de prueba...");
  
  // 1. Obtener la primera empresa registrada para vincular los DTEs de prueba
  const { data: users, error: userErr } = await supabase
    .from('usuarios')
    .select('empresa')
    .limit(1);

  if (userErr || !users || users.length === 0) {
    console.error("Error obteniendo empresa de usuarios:", userErr?.message);
    process.exit(1);
  }

  const empresa = users[0].empresa;
  console.log(`Asociando documentos de prueba a la empresa: "${empresa}"`);

  // 2. Insertar proveedores de prueba si no existen
  const proveedoresTest = [
    {
      empresa: empresa,
      rut: '76.120.456-9',
      razon_social: 'Hormigones del Pacífico Ltda.',
      giro: 'Venta de Hormigón Preparado',
      direccion: 'Av. Las Acacias 4500',
      comuna: 'San Bernardo',
      email_dte: 'facturacion@hormigonespacifico.cl',
      plazo_pago: 30
    },
    {
      empresa: empresa,
      rut: '79.088.330-2',
      razon_social: 'Tubos Chile SpA',
      giro: 'Fabricación de cañerías y tuberías',
      direccion: 'Panamericana Norte Km 15',
      comuna: 'Lampa',
      email_dte: 'dte@tuboschile.cl',
      plazo_pago: 30
    }
  ];

  const { error: provErr } = await supabase
    .from('facturacion_proveedores')
    .upsert(proveedoresTest, { onConflict: 'empresa,rut' });

  if (provErr) {
    console.warn("Advertencia al insertar proveedores (puede ser que falte crear la tabla):", provErr.message);
  } else {
    console.log("✅ Proveedores de prueba creados.");
  }

  // 3. Insertar documentos de prueba en facturacion_documentos
  const dtesTest = [
    {
      empresa: empresa,
      tipo_dte: 33, // Factura Electrónica
      folio: 1502,
      direccion_flujo: 'Compra',
      rut_receptor: '76.120.456-9', // Emisor (nuestro proveedor)
      nombre_receptor: 'Hormigones del Pacífico Ltda.',
      monto_neto: 1000000,
      monto_iva: 190000,
      monto_total: 1190000,
      detalles: [
        { descripcion: 'Hormigón H-30 C/B Bombeable', cantidad: 10, precioUnitario: 100000 }
      ],
      estado_sii: 'Pendiente',
      estado_acuse: 'Pendiente',
      xml_content: '<!-- XML de prueba de Hormigones del Pacífico -->'
    },
    {
      empresa: empresa,
      tipo_dte: 33, // Factura Electrónica
      folio: 883,
      direccion_flujo: 'Compra',
      rut_receptor: '79.088.330-2', // Emisor (nuestro proveedor)
      nombre_receptor: 'Tubos Chile SpA',
      monto_neto: 400000,
      monto_iva: 76000,
      monto_total: 476000,
      detalles: [
        { descripcion: 'Tubo Corrugado HDPE 110mm', cantidad: 20, precioUnitario: 20000 }
      ],
      estado_sii: 'Pendiente',
      estado_acuse: 'Pendiente', // Pendiente para probar rechazo automático
      xml_content: '<!-- XML de prueba de Tubos Chile SpA -->'
    }
  ];

  const { error: dteErr } = await supabase
    .from('facturacion_documentos')
    .insert(dtesTest);

  if (dteErr) {
    console.error("❌ Error al insertar documentos de prueba en facturacion_documentos:", dteErr.message);
    console.error("Asegúrate de haber ejecutado el script schema_facturacion.sql en el SQL Editor de Supabase primero.");
  } else {
    console.log("✅ Documentos de prueba insertados con éxito.");
    console.log("   - Factura Nº 1502 de Hormigones del Pacífico (Total: $1,190,000) en estado 'Pendiente'.");
    console.log("   - Factura Nº 883 de Tubos Chile SpA (Total: $476,000) en estado 'Pendiente' (Sin OC).");
  }
}

start();
