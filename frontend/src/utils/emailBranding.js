const escape = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Inline attachments work in email clients that refuse data: image sources.
export function emailBranding({ companyBranding, companyName, attachments = [] } = {}) {
  const name = companyName || 'Obraxis';
  const embedded = String(companyBranding?.logo_base64 || '').match(/^data:image\/(png|jpe?g|gif|webp);base64,([a-z0-9+/=\s]+)$/i);
  let src = '';
  const files = [...attachments];
  if (embedded) {
    src = 'cid:company-logo';
    files.push({ filename: `company-logo.${embedded[1].toLowerCase()}`, content: embedded[2].replace(/\s/g, ''), content_id: 'company-logo' });
  } else if (/^https:\/\//i.test(companyBranding?.logo_url || '')) {
    src = companyBranding.logo_url;
  } else if (!companyName && !companyBranding) {
    src = 'https://www.obraxis.cl/brand/obraxis-primary.png';
  }
  const header = src
    ? `<img src="${escape(src)}" alt="${escape(name)}" style="max-width:220px;max-height:80px;object-fit:contain;display:inline-block;" />`
    : `<span style="font-size:20px;font-weight:bold;color:#17335f;">${escape(name)}</span>`;
  return { header, attachments: files };
}
