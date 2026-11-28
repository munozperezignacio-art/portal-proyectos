export const designKeys=['numero','etapa','norte','este','frente','longitud_diseno'];
export const pileDesign=e=>e?Object.fromEntries(['id',...designKeys].map(k=>[k,e[k]==null?null:['norte','este','longitud_diseno'].includes(k)?Number(e[k]):e[k]])):null;
export function revisionRows(book,elements,stage,front){
 return book.catalog.map(row=>{
  const etapa=row.etapa||stage.trim();
  const prior=elements.find(e=>e.etapa===etapa&&String(e.numero)===row.numero);
  return {...row,etapa,frente:row.frente||prior?.frente||front,
   longitud_diseno:book.columns.longitud_diseno<0?(prior?.longitud_diseno??null):row.longitud_diseno,
   id:prior?.id,antes:pileDesign(prior)};
 });
}
export const changedDesign=row=>!row.antes||designKeys.some(k=>String(row[k]??'')!==String(row.antes[k]??''));
