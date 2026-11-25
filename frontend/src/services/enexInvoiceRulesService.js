import {DEFAULT_INVOICE_RULES,validateInvoiceRules} from '../utils/enexInvoiceReconciliation.js';

export function parseMachineryThreshold(value) {
  const text=String(value).trim().replace(',','.');
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(text)) throw new Error('Ingresa litros positivos, con hasta tres decimales.');
  const [whole,fraction='']=text.split('.');
  const milli=Number(whole)*1000+Number(fraction.padEnd(3,'0'));
  validateInvoiceRules({machinery_threshold_milli:milli});
  if(milli>100000000)throw new Error('El umbral máximo es 100.000 litros.');
  return milli;
}
export async function readInvoiceRules(db,company) {
  const {data,error}=await db.from('enex_invoice_rules').select('empresa,machinery_threshold_milli,revision,updated_at').eq('empresa',company).maybeSingle();
  if(error)throw new Error('No se pudo cargar la configuración de facturas. No se guardaron cambios.');
  if(data && data.empresa!==company)throw new Error('Configuración de otra empresa.');
  return data?{...data,...validateInvoiceRules(data)}:{empresa:company,...DEFAULT_INVOICE_RULES,revision:0,updated_at:null};
}
export async function saveInvoiceRules(db,company,previous,thresholdMilli) {
  validateInvoiceRules({machinery_threshold_milli:thresholdMilli});
  if(previous.empresa!==company)throw new Error('Configuración de otra empresa.');
  const table=db.from('enex_invoice_rules');
  const query=previous.revision===0
    ?table.insert({empresa:company,machinery_threshold_milli:thresholdMilli})
    :table.update({machinery_threshold_milli:thresholdMilli}).eq('empresa',company).eq('revision',previous.revision);
  const {data,error}=await query.select('empresa,machinery_threshold_milli,revision,updated_at').maybeSingle();
  if(error || !data || data.empresa!==company || data.machinery_threshold_milli!==thresholdMilli || data.revision!==previous.revision+1) {
    throw new Error('Guardado no confirmado o configuración modificada por otro usuario. Actualiza antes de volver a guardar.');
  }
  return data;
}
