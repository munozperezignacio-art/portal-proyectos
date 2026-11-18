// Keep the QR and its quiet zone intact; place identification below it.
export async function equipmentQrDownloadImage(url, equipment) {
  const QRCode = await import('qrcode');
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { width: 1200, margin: 4 });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen');
  const name = String(equipment.tipo || equipment.nombre || 'Equipo').trim();
  const code = String(equipment.patente || equipment.id || '').trim();
  const font = 'bold 42px Arial, sans-serif';
  ctx.font = font;
  const lines = [];
  let line = '';
  for (const char of name) {
    if (line && ctx.measureText(line + char).width > 1080) {
      lines.push(line.trim()); line = '';
    }
    line += char;
  }
  if (line.trim()) lines.push(line.trim());
  canvas.width = 1200;
  canvas.height = 1200 + 40 + lines.length * 56 + (code ? 60 : 0) + 32;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qr, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#172554';
  ctx.font = font;
  lines.forEach((text, i) => ctx.fillText(text, 600, 1220 + i * 56));
  if (code) {
    ctx.font = '36px Arial, sans-serif';
    ctx.fillText(code, 600, 1232 + lines.length * 56, 1080);
  }
  return canvas.toDataURL('image/png');
}
