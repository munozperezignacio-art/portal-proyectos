import {PNG} from 'npm:pngjs@7.0.0';
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const digits:Record<string,string[]>={
 '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['111','001','111','100','111'],'3':['111','001','111','001','111'],'4':['101','101','111','001','001'],'5':['111','100','111','001','111'],'6':['111','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','111']
};
function diagram(elements:any[],ids:Set<string>){
 const width=1200,height=800,png=new PNG({width,height});png.data.fill(255);
 if(!elements.length)return PNG.sync.write(png).toString('base64');
 const xs=elements.map(e=>Number(e.este)),ys=elements.map(e=>Number(e.norte));const minX=Math.min(...xs),maxY=Math.max(...ys);
 const scale=Math.min(1120/Math.max(1,Math.max(...xs)-minX),720/Math.max(1,maxY-Math.min(...ys)));
 const pixel=(x:number,y:number,color:number[])=>{if(x<0||x>=width||y<0||y>=height)return;const i=(y*width+x)*4;png.data[i]=color[0];png.data[i+1]=color[1];png.data[i+2]=color[2];png.data[i+3]=255;};
 for(const e of elements){const x=Math.round(40+(Number(e.este)-minX)*scale),y=Math.round(40+(maxY-Number(e.norte))*scale),color=ids.has(e.id)?[5,150,105]:e.sesion_id?[36,58,128]:[190,197,210];
  for(let dx=-4;dx<=4;dx++)for(let dy=-4;dy<=4;dy++)if(dx*dx+dy*dy<=16)pixel(x+dx,y+dy,color);
  String(e.numero).split('').forEach((digit,n)=>digits[digit]?.forEach((line,dy)=>line.split('').forEach((v,dx)=>{if(v==='1')pixel(x+6+n*4+dx,y-2+dy,[35,45,65]);})));
 }
 return PNG.sync.write(png).toString('base64');
}
export async function processSpecialtyNotifications(db:any){
 const {data:jobs,error}=await db.rpc('specialty_collect_notifications');if(error)throw error;
 const {data:config}=await db.from('config_empresa').select('email_sender').eq('empresa','Obraxis').maybeSingle();
 for(const job of jobs||[]){
  try{
   const key=Deno.env.get('RESEND_API_KEY');if(!key)throw new Error('Correo no configurado');
   const p=job.payload,rows=(p.datos?.pilas||[]).filter((r:any)=>r.terminada),elements=p.elements||[],attachments:any[]=[];
   let detail='';
   if(p.datos){attachments.push({filename:'esquema-pilas.png',content_id:'pilas',content:diagram(elements,new Set(rows.map((r:any)=>r.element_id)))});
    detail='<h3>Pilas ejecutadas</h3><table width="100%" cellpadding="8" style="border-collapse:collapse"><tr style="background:#eef2f8"><th>Pila</th><th>Equipo</th><th>Longitud m</th><th>Paladas</th><th>Volumen m³</th></tr>'+rows.map((r:any)=>'<tr style="border-bottom:1px solid #ddd">'+[elements.find((e:any)=>e.id===r.element_id)?.numero,r.equipo,r.longitud,r.paladas,r.volumen].map(v=>`<td>${escape(v)}</td>`).join('')+'</tr>').join('')+'</table><h3>Esquema por coordenadas</h3><p>Verde: jornada · Azul: ejecutadas · Gris: pendientes</p><img width="640" style="max-width:100%;height:auto" src="cid:pilas" alt="Esquema de pilas por coordenadas"/><p>'+escape(p.datos.observaciones)+'</p>';
   }
   const html=`<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;color:#17233b"><div style="background:#182b64;padding:24px;color:white"><h2>${escape(job.asunto)}</h2><p>${escape(p.empresa)} · ${escape(p.fecha)} · ${escape(p.partida)}</p></div><div style="padding:24px;border:1px solid #dbe3ef"><p>${escape(p.detalle)}</p>${detail}<p>Consulta el registro y los protocolos en Obraxis.</p></div></div>`;
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`specialty-${job.id}`},body:JSON.stringify({from:`Obraxis <${config?.email_sender||'notificaciones@obraxis.cl'}>`,to:[job.destinatario],subject:job.asunto,html,attachments}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   const saved=await db.rpc('specialty_email_result',{p_id:job.id,p_status:response.ok&&result.id?'accepted':'failed',p_provider:result.id||null,p_error:response.ok?null:'El proveedor no aceptó el correo; revisar antes de reintentar.'});if(saved.error)throw saved.error;
  }catch{
   await db.rpc('specialty_email_result',{p_id:job.id,p_status:'uncertain',p_error:'Resultado incierto. No reenviar automáticamente; revisar el proveedor.'});
  }
 }
 return {specialtyEmails:jobs?.length||0};
}
