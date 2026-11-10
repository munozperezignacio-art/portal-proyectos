export function reportDiagram(elements,sessions,part,date){
 const history=new Map();
 for(const s of sessions){
  const when=String(s.fecha||'').slice(0,10);
  if(!when||when>date||String(s.partida_id)!==String(part)||!['cerrada','historica'].includes(s.estado))continue;
  for(const p of s.datos?.pilas||[])if(p.terminada&&p.element_id!=null){const id=String(p.element_id);if(!history.has(id)||when>history.get(id))history.set(id,when);}
 }
 const pts=elements.filter(e=>String(e.partida_id)===String(part)&&[e.este,e.norte].every(v=>v!=null&&String(v).trim()!==''&&Number.isFinite(+v)));
 if(!pts.length)return [];
 const xs=pts.map(e=>+e.este),ys=pts.map(e=>+e.norte),left=Math.min(...xs),top=Math.max(...ys);
 const scale=Math.min(940/Math.max(1,Math.max(...xs)-left),620/Math.max(1,top-Math.min(...ys)));
 return pts.map(e=>({id:e.id,label:String(e.numero),x:30+(e.este-left)*scale,y:30+(top-e.norte)*scale,day:history.get(String(e.id))===date,pending:!history.has(String(e.id))}));
}
