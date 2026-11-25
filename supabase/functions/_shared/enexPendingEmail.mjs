const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => String(value ?? '').slice(0,10).split('-').reverse().join('-');

// Same company branding / inline attachment contract as advance report emails.
// Do not put base64 data URLs in HTML: common email clients refuse them.
function companyHeader(company, branding) {
 const embedded = String(branding?.logo_base64 || '').match(/^data:image\/(png|jpe?g|gif|webp);base64,([a-z0-9+/=\s]+)$/i);
 if (!embedded) return {header:`<span style="font-size:20px;font-weight:bold;color:#17335f">${esc(company)}</span>`,attachments:[]};
 return {
  header:`<img src="cid:company-logo" alt="${esc(company)}" style="max-width:220px;max-height:80px;object-fit:contain;display:inline-block" />`,
  attachments:[{filename:`company-logo.${embedded[1].toLowerCase()}`,content:embedded[2].replace(/\s/g,''),content_id:'company-logo'}]
 };
}

// Summary and logo are read on the server for this owner/company only.
export function renderEnexPendingEmail(summary, branding = null) {
 const {company,name,count,vehicles,oldest,day} = summary;
 const brand = companyHeader(company,branding);
 const subject = `Obraxis · ${count} ${count === 1 ? 'carga pendiente' : 'cargas pendientes'} de asignación · ${company}`;
 const heading = count === 1 ? 'Tienes 1 carga pendiente de asignar' : `Tienes ${count} cargas pendientes de asignar`;
 const vehicleCount = new Set(vehicles.map(v=>v.vehicle)).size;
 const detail = vehicles.map(v => `${v.vehicle} · ${v.portal === 'empresa' ? 'Empresa' : 'Transporte'}: ${v.count} ${v.count === 1 ? 'carga' : 'cargas'}`);
 const reminder = 'Recibirás como máximo un correo de recordatorio al día, a las 09:00 de Chile, mientras tengas pendientes. Si ya los resolviste después del envío, no necesitas realizar otra acción.';
 const text = [`OBRAXIS | Combustibles`,`${company} · ${date(day)}`,`Hola, ${name}.`,heading,
  'Asigna cada carga a la obra o al centro de gestión correspondiente. Puedes hacerlo desde la web o desde Combustibles en la aplicación.',
  ...detail,`Pendiente más antiguo: ${date(oldest)}.`,
  'Abrir mis pendientes: https://www.obraxis.cl/dashboard?modulo=combustibles','Si no tienes una sesión activa, inicia sesión con tu empresa y usuario. Después se abrirán tus cargas pendientes.',
  'Este resumen incluye únicamente las cargas pendientes de los vehículos que tienes asignados.',reminder,
  'Enviado desde Obraxis · Gestión inteligente para construir mejor.'
 ].join('\n\n');
 const rows = vehicles.map(v => `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px;font-weight:bold;color:#1e293b">${esc(v.vehicle)}</td><td style="padding:10px;color:#475569">${v.portal === 'empresa' ? 'Empresa' : 'Transporte'}</td><td style="padding:10px;font-weight:bold;color:#047857;text-align:right">${esc(v.count)}</td></tr>`).join('');
 const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title><style>@media(max-width:560px){.outer{padding:18px 10px!important}.card{padding:20px 16px!important}.detail th,.detail td{padding:10px 8px!important}}</style></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif">
<div class="outer" style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,sans-serif">
 <div style="max-width:720px;margin:0 auto 12px;text-align:center">${brand.header}</div>
 <div class="card" style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background-color:#ffffff">
  <div style="border-bottom:2px solid #1e3a8a;padding-bottom:16px;margin-bottom:20px">
   <span style="font-size:11px;font-weight:bold;color:#1e3a8a;text-transform:uppercase;letter-spacing:.1em">${esc(company)} • Control de Combustibles</span>
   <h2 style="color:#0f172a;margin:6px 0 0;font-size:20px">⛽ Cargas pendientes de asignación</h2>
   <p style="color:#64748b;font-size:13px;margin:4px 0 0">Recordatorio diario | Fecha: <strong>${esc(date(day))}</strong></p>
  </div>
  <div style="background-color:#f8fafc;padding:14px;border-radius:10px;margin-bottom:20px;border:1px solid #cbd5e1;font-size:13px">
   <p style="margin:0;color:#334155">👤 <strong>Responsable:</strong> ${esc(name)}</p>
   <p style="margin:4px 0 0;color:#334155">📋 <strong>Cargas pendientes:</strong> ${esc(count)} ${count===1?'carga':'cargas'} en ${vehicleCount} ${vehicleCount===1?'vehículo':'vehículos'}</p>
  </div>
  <p style="font-size:13px;color:#334155;line-height:1.7;margin:0 0 20px">Tienes cargas pendientes de asignar. Asocia cada una a la <strong>obra o al centro de gestión</strong> correspondiente desde la web o desde <strong>Combustibles</strong> en la aplicación.</p>
  <table class="detail" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
   <thead><tr style="background-color:#1e3a8a;color:#ffffff;text-align:left;font-size:11px;text-transform:uppercase">
    <th style="padding:10px">Vehículo / patente</th><th style="padding:10px">Portal</th><th style="padding:10px;text-align:right">Cargas pendientes</th>
   </tr></thead><tbody>${rows}</tbody>
  </table>
  <p style="color:#334155;font-size:13px;line-height:1.7"><strong>Pendiente más antiguo:</strong> ${esc(date(oldest))}.</p>
  <p style="color:#334155;font-size:13px;line-height:1.7"><strong>Importante:</strong> Este resumen incluye únicamente las cargas pendientes de los vehículos que tienes asignados.</p>
  <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9">
   <a href="https://www.obraxis.cl/dashboard?modulo=combustibles" style="background-color:#1e3a8a;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:12px;display:inline-block">Ver pendientes en Obraxis</a>
   <p style="font-size:11px;color:#64748b;margin:10px 0 0">Inicia sesión si se solicita. Después se abrirán tus cargas pendientes.</p>
  </div>
  <p style="font-size:11px;color:#64748b;line-height:1.6;margin:20px 0 0">${reminder}</p>
 </div>
 <p style="max-width:650px;margin:16px auto 0;text-align:center;font-size:10px;line-height:1.5;color:#64748b">Enviado desde <a href="https://www.obraxis.cl" style="color:#073b76;font-weight:bold;text-decoration:none">Obraxis</a> · Gestión inteligente para construir mejor.</p>
</div></body></html>`;
 return {subject,html,text,...(brand.attachments.length?{attachments:brand.attachments}:{})};
}
