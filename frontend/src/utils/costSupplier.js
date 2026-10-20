import {formatRut,validateRut} from './rutUtils.js';
export function costSupplierFields(form) {
  const name=String(form.proveedor_nombre||'').trim();
  const rut=String(form.proveedor_rut||'').trim();
  const invoice=form.asociar_factura===true||form.asociar_factura==='SI';
  if(invoice&&(!name||!rut))throw new Error('Para asociar una factura o documento, ingresa la razón social y el RUT de su emisor.');
  if(!name&&!rut)return {proveedor_nombre:null,proveedor_rut:null};
  if(!name||!rut)throw new Error('Completa la razón social y el RUT del emisor/proveedor, o deja ambos vacíos si no aplica.');
  if(!validateRut(rut))throw new Error('El RUT del emisor no es válido. Revisa el número y el dígito verificador.');
  return {proveedor_nombre:name,proveedor_rut:formatRut(rut)};
}
