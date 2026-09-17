# Bandeja de correo interna de Obraxis

## Arquitectura

- Resend recibe los correos destinados a `@obraxis.cl`.
- El evento `email.received` llega a la Edge Function `resend-correo-entrante`.
- La función verifica la firma del webhook antes de recuperar el cuerpo y los adjuntos.
- Supabase almacena conversaciones y mensajes con RLS restringido a usuarios autorizados de Obraxis.
- Las respuestas se envían desde `correo-bandeja` mediante Resend.
- El `Reply-To` usa `contacto+<conversation-id>@obraxis.cl` para mantener el hilo incluso si un cliente cambia el asunto.

## Variables privadas requeridas

Configurar en Supabase Edge Functions:

- `RESEND_API_KEY`: clave de Resend ya utilizada por el proyecto.
- `RESEND_INBOUND_WEBHOOK_SECRET`: secreto `whsec_...` entregado al crear el webhook.

Nunca exponga estas variables en Vite ni use prefijos `VITE_`.

## Despliegue

1. Aplicar la migración `20260917205305_correo_interno_obraxis.sql`.
2. Desplegar `resend-correo-entrante` con verificación JWT deshabilitada; la autenticación es la firma de Resend.
3. Desplegar `correo-bandeja` con verificación JWT habilitada.
4. En Resend, crear un webhook para `email.received` con esta URL:

   `https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1/resend-correo-entrante`

5. Guardar el signing secret del webhook como `RESEND_INBOUND_WEBHOOK_SECRET`.
6. En Resend → Receiving → Custom Domains, añadir `obraxis.cl` y copiar exactamente el registro MX indicado.
7. Añadir ese registro MX desde Vercel DNS. No cambiar los nameservers.
8. Probar desde una cuenta externa enviando a `contacto@obraxis.cl`.

## Validación funcional

1. El mensaje aparece en Configuración → Correos → Contactos.
2. El contador “sin leer” aumenta.
3. El contenido de texto se muestra sin ejecutar HTML del remitente.
4. Los adjuntos generan una URL temporal únicamente después de autorizar al usuario.
5. Una respuesta enviada desde Obraxis aparece en el hilo y llega al remitente.
6. Al responder desde el proveedor externo, el mensaje vuelve a la misma conversación.

## Consideraciones

- Configurar el MX raíz dirige todo `@obraxis.cl` a Resend. Actualmente el dominio no tiene otro proveedor de entrada, por lo que no existe un buzón que desplazar.
- Los mensajes HTML se almacenan para trazabilidad, pero la interfaz representa únicamente texto plano para evitar XSS.
- Los adjuntos permanecen en Resend; la aplicación solicita una URL temporal al abrirlos y no expone la API key.
- El webhook es idempotente mediante el identificador único `resend_email_id`.
