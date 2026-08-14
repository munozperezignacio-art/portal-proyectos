import { supabase } from '../supabaseClient';

/**
 * Servicio para el envío de correos electrónicos transaccionales desde el dominio obraxis.cl.
 * La clave de Resend permanece exclusivamente en Supabase Secrets.
 */
export async function sendSystemEmail({ to, subject, htmlContent, attachments, customSender, permissionKey }) {
  try {
    // Limpiar y validar correos de destino
    const recipients = typeof to === 'string' 
      ? to.split(',').map(email => email.trim()).filter(Boolean) 
      : to;

    if (!recipients || recipients.length === 0) {
      return { success: false, error: 'No se especificaron destinatarios válidos' };
    }
    if (!permissionKey) return { success: false, error: 'El flujo no declaró un permiso de envío' };

    const { data, error } = await supabase.functions.invoke('enviar-correo-sistema', {
      body: {
        to: recipients,
        subject,
        htmlContent: `<div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,sans-serif;"><div style="max-width:720px;margin:0 auto 12px;text-align:center;"><img src="https://www.obraxis.cl/brand/obraxis-primary.png" alt="Obraxis" style="width:150px;height:64px;object-fit:contain;display:inline-block;" /></div>${htmlContent}<p style="max-width:650px;margin:16px auto 0;text-align:center;font-size:10px;line-height:1.5;color:#64748b;">Enviado desde <a href="https://www.obraxis.cl" style="color:#073b76;font-weight:bold;text-decoration:none;">Obraxis</a> · Gestión inteligente para construir mejor.</p></div>`,
        attachments: attachments || [],
        customSender,
        permissionKey
      }
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || 'No fue posible enviar el correo');
    return { success: true, data };
  } catch (err) {
    console.error('Error en el servicio de correo:', err.message);
    return { success: false, error: err.message };
  }
}
