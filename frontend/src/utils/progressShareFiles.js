import {reportDiagram} from '../../../mobile/src/lib/reportDiagram.mjs';
export async function progressShareFiles(db,work,date,partIds){
 if(!partIds.length)return [];
 const {data,error}=await db.rpc('specialty_api',{p_work:work.id,p_action:'state',p_data:{}});if(error)throw error;
 const files=[];
 for(const id of partIds){
  const points=reportDiagram(data.elements||[],data.sessions||[],id,date);if(!points.length)continue;
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=780;const ctx=canvas.getContext('2d');
  ctx.fillStyle='white';ctx.fillRect(0,0,1000,780);ctx.fillStyle='#172554';ctx.font='bold 20px sans-serif';ctx.fillText(`${work.nombre} · ${date}`,24,32);ctx.font='14px sans-serif';ctx.fillText('Amarillo: ejecutadas del día · Azul: anteriores · Borde azul: pendientes',24,760);
  for(const p of points){ctx.beginPath();ctx.arc(p.x,p.y+55,8,0,Math.PI*2);ctx.strokeStyle='#334b88';ctx.fillStyle=p.pending?'white':p.day?'#facc15':'#334b88';ctx.fill();ctx.stroke();ctx.font='7px sans-serif';ctx.textAlign='center';ctx.fillStyle=p.day||p.pending?'#172554':'white';ctx.fillText(p.label,p.x,p.y+58);}
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(blob)files.push(new File([blob],`avance-${date}-partida-${id}.png`,{type:'image/png'}));
 }
 return files;
}
export function downloadProgressDiagrams(files){for(const file of files){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}}
