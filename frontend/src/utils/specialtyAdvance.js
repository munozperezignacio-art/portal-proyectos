export function configuredAdvanceParts(parts,settings=[],elements=null){
 return parts.filter(p=>!p.es_titulo&&settings.some(s=>String(s.partida_id)===String(p.id))&&(elements===null||elements.some(e=>String(e.partida_id)===String(p.id))));
}
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function matchesPile(element,query){
 if(!element)return false;
 const numberQuery=normalize(query).replace(/^pila\s+/, '');
 if(/^\d+$/.test(numberQuery))return Number(element.numero)===Number(numberQuery);
 const text=normalize(`Pila ${element.numero} ${element.frente||''}`);
 return normalize(query).split(/\s+/).every(word=>text.includes(word));
}
export const sortPiles=elements=>[...elements].sort((a,b)=>String(a.numero).localeCompare(String(b.numero),'es',{numeric:true})||String(a.frente||'').localeCompare(String(b.frente||''),'es'));
