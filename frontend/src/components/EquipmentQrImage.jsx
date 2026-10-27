import { useEffect, useState } from 'react';
export default function EquipmentQrImage({ value, label }) {
  const [image,setImage]=useState('');
  useEffect(()=>{let active=true;setImage('');import('qrcode').then(QRCode=>QRCode.toDataURL(value,{width:600,margin:3})).then(data=>{if(active)setImage(data);}).catch(()=>{});return()=>{active=false;};},[value]);
  return image?<img src={image} alt={label} className="h-full w-full object-contain"/>:<span>Preparando QR…</span>;
}
