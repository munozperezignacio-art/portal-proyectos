export function emailRecipientLists(body) {
  const normalize=value=>[...new Set((Array.isArray(value)?value:String(value||'').split(',')).map(item=>String(item).trim().toLowerCase()).filter(Boolean))];
  const to=normalize(body.to),cc=normalize(body.cc).filter(email=>!to.includes(email));
  const all=[...to,...cc];
  if(!to.length||all.length>10||all.some(email=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new Error('Destinatarios invalidos');
  return {to,cc};
}
