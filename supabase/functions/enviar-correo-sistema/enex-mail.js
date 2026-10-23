import {renderEnexMail} from './enex-mail-template.js';
export const ENEX_PERMISSION='maquinaria.enex.enviar';
export const ENEX_SUBJECT='Obraxis | Resumen de combustible';
const legacy=/^(obras\.(avances|personal|maquinaria|gestion|estados_pago|libro_obra|calidad|prevencion|subcontratos)|acreditaciones\.subcontratos|formularios\.formularios|clientes\.portales|mandante\.(contratos|acreditaciones)|prevencion\.registros|admin\.(usuarios|permisos))\.enviar$/;
export const allowedMailPermission=key=>key===ENEX_PERMISSION||legacy.test(key);
export function enexMailRequest(body,profile,effective,recipients,copies) {
 if(effective[ENEX_PERMISSION]!==true)throw Error('Permiso Enex explícito requerido');
 const own=String(profile.correo||'').trim().toLowerCase();
 if(!own||recipients.length!==1||recipients[0].toLowerCase()!==own||copies.length||body.attachments?.length)throw Error('Enex permite solo resumen propio, sin copias ni adjuntos');
 if(body.enexCompany!==profile.empresa)throw Error('Empresa no coincide');
 const ids=body.enexMovementIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>1000||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))throw Error('Selección Enex inválida');
 return [...ids].sort();
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function enexMailContent(company,ids,rows) {
 if(!Array.isArray(rows)||rows.length!==ids.length||new Set(rows.map(r=>r.id)).size!==ids.length)throw Error('Persistencia incompleta');
 let liters=0,debit=0,pending=0;const canonical=[];
 for(const r of rows) {
  if(r.empresa!==company||!ids.includes(r.id)||r.kind!=='Carga'||!['empresa','transporte'].includes(r.portal)||!Number.isSafeInteger(r.liters_milli)||r.liters_milli<=0||!Number.isSafeInteger(r.amount_signed)||r.amount_signed>=0||r.currency!==null||r.tax_breakdown!==null)throw Error('Movimiento no compatible');
  if(typeof r.occurred_local!=='string'||!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(r.occurred_local))throw Error('Fecha inválida');
  liters+=r.liters_milli;debit+=r.amount_signed;
  const assigned=Array.isArray(r.enex_assignments)?r.enex_assignments.length>0:Boolean(r.enex_assignments);
  if(!assigned)pending++;
  canonical.push([r.id,r.portal,r.occurred_local,r.liters_milli,r.amount_signed,assigned]);
 }
 if(!Number.isSafeInteger(liters)||!Number.isSafeInteger(debit))throw Error('Total fuera de rango');
 canonical.sort((a,b)=>a[0].localeCompare(b[0]));
 const dates=canonical.map(r=>r[2]).sort();
 const rendered=renderEnexMail(company,rows,pending,dates);
 return {subject:ENEX_SUBJECT,...rendered,canonical:JSON.stringify(["enex-summary-v2",company,canonical])};
}
