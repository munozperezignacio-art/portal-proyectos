import { supabase } from '../supabaseClient';

/**
 * Servicio para el envío de correos electrónicos transaccionales desde el dominio obraxis.cl.
 * Consume la API de Resend utilizando la configuración almacenada en Supabase o en variables de entorno.
 */
export async function sendSystemEmail({ to, subject, htmlContent, attachments, customSender }) {
  try {
    // 1. Obtener la configuración global de correo desde la fila 'Obraxis' en config_empresa
    const { data: config, error } = await supabase
      .from('config_empresa')
      .select('email_api_key, email_sender')
      .eq('empresa', 'Obraxis')
      .maybeSingle();

    if (error) {
      console.error('Error al consultar configuración de correo:', error.message);
    }

    // Usar remitente personalizado (ej: usuarios@obraxis.cl), o de BD, o fallback
    const apiKey = config?.email_api_key || import.meta.env.VITE_RESEND_API_KEY;
    const sender = customSender || config?.email_sender || import.meta.env.VITE_RESEND_SENDER || 'usuarios@obraxis.cl';

    if (!apiKey) {
      console.warn('Advertencia: No se ha configurado la API Key de Resend en config_empresa ni en .env');
      return { success: false, error: 'API Key de correo no configurada' };
    }

    // Limpiar y validar correos de destino
    const recipients = typeof to === 'string' 
      ? to.split(',').map(email => email.trim()).filter(Boolean) 
      : to;

    if (!recipients || recipients.length === 0) {
      return { success: false, error: 'No se especificaron destinatarios válidos' };
    }

    // 2. Realizar petición POST al endpoint serverless (para evitar bloqueos de CORS en el navegador)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiEndpoint = isLocal 
      ? 'https://obraxis.cl/api/send-email'
      : '/api/send-email';

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey,
        sender: `Obraxis <${sender}>`,
        to: recipients,
        subject: subject,
        htmlContent: `<div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,sans-serif;"><div style="max-width:720px;margin:0 auto 12px;text-align:center;"><img src="https://www.obraxis.cl/brand/obraxis-primary.png" alt="Obraxis" style="width:150px;height:64px;object-fit:contain;display:inline-block;" /></div>${htmlContent}<p style="max-width:650px;margin:16px auto 0;text-align:center;font-size:10px;line-height:1.5;color:#64748b;">Enviado desde <a href="https://www.obraxis.cl" style="color:#073b76;font-weight:bold;text-decoration:none;">Obraxis</a> · Gestión inteligente para construir mejor.</p></div>`,
        attachments: attachments || [],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error en la petición a la API de Resend');
    }

    console.log('Correo enviado con éxito:', result);
    return { success: true, data: result };
  } catch (err) {
    console.error('Error en el servicio de correo:', err.message);
    return { success: false, error: err.message };
  }
}
