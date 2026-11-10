export function reportDiagram(elements,sessions,part,date){
 const history=new Map(sessions.filter(s=>String(s.partida_id)===String(part)&&s.fecha<=date&&['cerrada','historica'].includes(s.estado)).flatMap(s=>(s.datos?.pilas||[]).filter(p=>p.terminada).map(p=>[p.element_id,s.fecha])));
 const pts=elements.filter(e=>String(e.partida_id)===String(part)&&history.has(e.id)&&[e.este,e.norte].every(v=>v!=null&&String(v).trim()!==''&&Number.isFinite(+v)));
 if(!pts.length)return [];
 const xs=pts.map(e=>+e.este),ys=pts.map(e=>+e.norte),left=Math.min(...xs),top=Math.max(...ys);
 const scale=Math.min(940/Math.max(1,Math.max(...xs)-left),620/Math.max(1,top-Math.min(...ys)));
 return pts.map(e=>({id:e.id,label:String(e.numero),x:30+(e.este-left)*scale,y:30+(top-e.norte)*scale,day:history.get(e.id)===date}));
}
