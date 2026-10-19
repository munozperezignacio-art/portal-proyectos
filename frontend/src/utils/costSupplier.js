import {formatRut,validateRut} from './rutUtils.js';
export function costSupplierFields(form) {
  const name=String(form.proveedor_nombre||'').trim();
  const rut=String(form.proveedor_rut||'').trim();
  if(!name&&!rut)return {proveedor_nombre:null,proveedor_rut:null};
  if(!name||!rut)throw new Error('Completa el nombre y el RUT del proveedor, o deja ambos vacíos si no aplica.');
  if(!validateRut(rut))throw new Error('El RUT del proveedor no es válido. Revisa el número y el dígito verificador.');
  return {proveedor_nombre:name,proveedor_rut:formatRut(rut)};
}
