export function invoiceProgress(invoice,result){
 const total=new Set(invoice?.guides||[]).size;
 if(!result)return {total,assigned:null,pending:null,missing:null,other:null};
 const blocked=new Set((result.problems||[]).filter(p=>p.document).map(p=>p.document));
 const count=message=>new Set((result.problems||[]).filter(p=>p.document&&p.message===message).map(p=>p.document)).size;
 const pending=count('Movimiento pendiente de asignación'),missing=count('Guía sin movimiento');
 return {total,assigned:Math.max(0,total-blocked.size),pending,missing,other:Math.max(0,blocked.size-pending-missing)};
}
export function invoiceDraftFields(invoice){
 const draft={...invoice,guides:invoice.guides.join('\n'),liters:(invoice.liters_milli/1000).toLocaleString('es-CL',{maximumFractionDigits:3})};
 for(const key of ['fuel_net','shellcard_net','net','vat','specific_tax','exempt','total'])draft[key]=Number(invoice[key]).toLocaleString('es-CL');
 return draft;
}
