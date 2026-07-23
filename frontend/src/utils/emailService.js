import { supabase } from '../supabaseClient';

/**
 * Servicio para el envío de correos electrónicos transaccionales desde el dominio obraxis.cl.
 * Consume la API de Resend utilizando la configuración almacenada en Supabase o en variables de entorno.
 */
export async function sendSystemEmail({ to, subject, htmlContent }) {
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

    // Usar valores de BD o fallbacks de variables de entorno / valores por defecto
    const apiKey = config?.email_api_key || import.meta.env.VITE_RESEND_API_KEY;
    const sender = config?.email_sender || import.meta.env.VITE_RESEND_SENDER || 'notificaciones@obraxis.cl';

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
        htmlContent: htmlContent,
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
