const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const sortPiles=rows=>[...rows].sort((a,b)=>String(a.numero).localeCompare(String(b.numero),'es',{numeric:true}));
export function matchesPile(pile,query){
 const q=normalize(query).replace(/^pila\s+/,'');
 if(/^\d+$/.test(q))return Number(pile.numero)===Number(q);
 const text=normalize(`${pile.numero} ${pile.frente||''}`);
 return q.split(/\s+/).every(word=>text.includes(word));
}
