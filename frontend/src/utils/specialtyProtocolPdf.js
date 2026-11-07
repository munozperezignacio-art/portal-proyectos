import {jsPDF} from 'jspdf';
import geometry from './protocolTemplateGeometry.json' with {type:'json'};
// Original Excel printouts, stripped of previous values, signatures and logos.
const assets={ejecucion:[new URL('../assets/protocols/ejecucion-1.png',import.meta.url),new URL('../assets/protocols/ejecucion-2.png',import.meta.url)],topografia:[new URL('../assets/protocols/topografia-1.png',import.meta.url),new URL('../assets/protocols/topografia-2.png',import.meta.url)]};
const bounds={ejecucion:[[112.58,54.956,728.62,539.496],[124.7,54.956,716.38,539.496]],topografia:[[20.16,28.92,574.44,812.16],[21.96,28.92,572.52,812.16]]};
const date=v=>v?String(v).slice(0,10).split('-').reverse().join('-'):'';
const number=(v,d=2)=>v==null||v===''?'':Number.isFinite(Number(v))?Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):String(v);
const diff=(a,b)=>a==null||a===''||b==null||b===''?'':number(Number(a)-Number(b),3);
export function createSpecialtyProtocolPdf(protocol,companyLogo=null,backgrounds){
 if(backgrounds?.length!==2||backgrounds.some(b=>!b?.length))throw new Error('No se cargó la plantilla original del protocolo.');
 if(!['ejecucion','topografia'].includes(protocol.tipo))throw new Error('Tipo de protocolo no reconocido.');
 const kind=protocol.tipo,s=protocol.snapshot,f=s.fijos||{},execution=kind==='ejecucion',size=execution?[841.92,595.32]:[595.32,841.92];
 const doc=new jsPDF({orientation:execution?'landscape':'portrait',unit:'pt',format:size});
 const hasControl=p=>['deformacion','cst','bst'].some(k=>p.topografia[k]!=null&&p.topografia[k]!=='');
 const perPage=execution?40:30,chunks=[[]];
 for(const pile of s.pilas){let chunk=chunks.at(-1);if(chunk.length>=perPage||(execution&&hasControl(pile)&&chunk.filter(hasControl).length>=6)){chunks.push([]);chunk=chunks.at(-1);}chunk.push(pile);}
 const groups=chunks.length;let templatePage=0;
 const rect=address=>{const g=geometry[kind][templatePage],c=g.cells[address];if(!c)throw new Error(`Celda de plantilla no encontrada: ${address}`);const b=bounds[kind][templatePage],sx=(b[2]-b[0])/g.width,sy=(b[3]-b[1])/g.height;return [b[0]+c[0]*sx,b[1]+c[1]*sy,c[2]*sx,c[3]*sy];};
 const put=(address,value,{bold=false,clear=false,align='center'}={})=>{
  const [x,y,w,h]=rect(address);if(clear){doc.setFillColor(255);doc.rect(x+.7,y+.7,w-1.4,h-1.4,'F');}if(value==null||value==='')return;
  doc.setTextColor(0);doc.setFont('helvetica',bold?'bold':'normal');let font=execution?7.1:9.1,lines;
  do{doc.setFontSize(font);lines=doc.splitTextToSize(String(value),w-3);if(lines.length*font*1.08<=h-1.3)break;font-=.25;}while(font>=5);
  if(font<5)throw new Error(`El texto de ${address} no cabe en el formato original. Abrevia ese dato antes de descargar.`);
  doc.text(lines,align==='left'?x+1.5:align==='right'?x+w-1.5:x+w/2,y+h/2-(lines.length-1)*font*.54+font*.32,{align,lineHeightFactor:1.08});
 };
 const logo=address=>{const [x,y,w,h]=rect(address);if(companyLogo){const p=doc.getImageProperties(companyLogo),scale=Math.min((w-8)/p.width,(h-5)/p.height);doc.addImage(companyLogo,p.fileType,x+(w-p.width*scale)/2,y+(h-p.height*scale)/2,p.width*scale,p.height*scale);}else put(address,s.empresa,{bold:true});};
 const common=(page,total)=>{
  if(execution){const second=templatePage===1;logo(second?'P1':'B1');put(second?'S1':'E1','PROTOCOLO DE ENTREGA DE PILAS DE AGREGADO COMPACTADO',{bold:true,clear:true});
   for(const [cell,value] of Object.entries(second?{R6:s.obra,Y6:f.plano,R7:f.direccion,Y7:f.estructura,R8:f.mandante,Y8:date(protocol.fecha),AC8:protocol.correlativo}:{D6:s.obra,K6:f.plano,D7:f.direccion,K7:f.estructura,D8:f.mandante,K8:date(protocol.fecha),O8:protocol.correlativo}))put(cell,value);
   put(second?'AB4':'N4',`Pag ${page} de ${total}`,{bold:true,clear:true});
   const map=second?['P48','U48','P50','U50','P52','U52','T47','X47']:['B48','G48','B50','G50','B52','G52','F47','J47'];
   [s.autor,s.aprobado_por,f.cargo_elaborador||'Oficina Técnica',s.aprobado_por?(f.cargo_aprobador||'Calidad'):'',s.empresa,s.aprobado_por?s.empresa:'',date(protocol.fecha),date(s.aprobado_at)].forEach((value,i)=>put(map[i],value));
  }else{logo(templatePage?'L1':'B1');put(templatePage?'U4':'J4',`Pag ${page} de ${total}`,{bold:true,clear:true});
   if(!templatePage)for(const [cell,value]of Object.entries({D6:s.obra,J6:f.direccion,D7:f.mandante,J7:f.estructura,D8:f.plano,J8:date(protocol.fecha),D9:f.sistema_coordenadas,J9:protocol.correlativo,D12:f.instrumento,G12:f.serie,D13:f.modelo,G13:f.marca,J12:f.certificado,J13:date(f.fecha_calibracion),B15:f.descripcion||s.observaciones}))put(cell,value);
   else for(const [cell,value]of Object.entries({N50:s.autor,Q50:s.aprobado_por,N51:f.cargo_elaborador||'Topógrafo',Q51:s.aprobado_por?(f.cargo_aprobador||'Calidad'):'',N52:s.empresa,Q52:s.aprobado_por?s.empresa:'',N53:date(protocol.fecha),Q53:date(s.aprobado_at)}))put(cell,value);
  }
  doc.setFontSize(6);doc.setTextColor(80);doc.text(`${protocol.correlativo} · ${protocol.estado==='aprobado'?'APROBADO EN OBRAXIS':'BORRADOR - PENDIENTE DE REVISIÓN'}`,size[0]/2,size[1]-12,{align:'center'});
 };
 const sketch=(start,end,selected)=>{
  const a=rect(start),z=rect(end),box=[a[0]+7,a[1]+7,z[0]+z[2]-a[0]-14,z[1]+z[3]-a[1]-14];
  const all=(s.catalogo||s.pilas).filter(e=>['norte','este'].every(k=>e[k]!=null&&e[k]!==''&&Number.isFinite(Number(e[k]))));if(!all.length)return;
  const xs=all.map(e=>Number(e.este)),ys=all.map(e=>Number(e.norte)),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min((box[2]-16)/Math.max(1,maxX-minX),(box[3]-25)/Math.max(1,maxY-minY));
  const ox=box[0]+(box[2]-(maxX-minX)*scale)/2,oy=box[1]+(box[3]-15-(maxY-minY)*scale)/2,ids=new Set(selected.map(e=>e.id));
  for(const e of all){const x=ox+(Number(e.este)-minX)*scale,y=oy+(maxY-Number(e.norte))*scale;doc.setDrawColor(65,110,145);doc.setFillColor(...(ids.has(e.id)?[153,225,110]:e.sesion_id?[175,210,230]:[255,255,255]));doc.ellipse(x,y,all.length>100?4:7,all.length>100?2.5:4,'FD');doc.setTextColor(25);doc.setFontSize(all.length>100?3.5:6);doc.text(String(e.numero),x,y+1.4,{align:'center'});}
  doc.setFontSize(6);doc.text('Verde: pilas del protocolo   Azul: ejecutadas al corte   Blanco: pendientes',box[0]+box[2]/2,box[1]+box[3]-1,{align:'center'});
 };
 for(let group=0;group<groups;group++){
  const piles=chunks[group];
  for(templatePage=0;templatePage<2;templatePage++){
   if(group||templatePage)doc.addPage(size,execution?'landscape':'portrait');doc.addImage(backgrounds[templatePage],'PNG',0,0,...size,undefined,'FAST');common(group*2+templatePage+1,groups*2);
   if(execution&&!templatePage){
    for(const [cell,value]of Object.entries({D11:f.graduacion,H11:f.chancado,K11:f.diametro,O11:f.cota_local,D12:f.desgaste,H12:f.finos,K12:f.volumen_cuchara,O12:f.cota_referencia}))put(cell,value);
    piles.forEach((p,i)=>{const row=18+i%20,cols=i<20?['C','D','E','F','G','H']:['J','K','L','M','N','O'];[p.numero,number(p.topografia.cota_inicial),number(p.topografia.cota_final),number(p.ejecucion.longitud),number(p.ejecucion.paladas),number(p.ejecucion.volumen)].forEach((v,j)=>put(cols[j]+row,v));});
    put('E38',piles.length,{bold:true});put('J38',number(piles.reduce((n,p)=>n+Number(p.ejecucion.longitud||0),0)),{bold:true});put('O38',number(piles.reduce((n,p)=>n+Number(p.ejecucion.volumen||0),0)),{bold:true});
    const controls=piles.filter(hasControl);
    controls.forEach((p,i)=>{const row=41+i%3,cols=i<3?['C','D','F']:['J','K','M'],t=p.topografia;
     const measured=t.deformacion!=null&&t.deformacion!==''?number(t.deformacion):[['CST',t.cst],['BST',t.bst]].filter(([,v])=>v!=null&&v!=='').map(([label,v],_,values)=>`${values.length>1?`${label} `:''}${number(v)}`).join(' / ');
     [p.numero,measured,number(t.profundidad_control)].forEach((v,j)=>put(cols[j]+row,v));});
   }else if(execution)sketch('P11','AC45',piles);
   else if(!templatePage){
    piles.forEach((p,i)=>{const row=24+i,t=p.topografia;[p.numero,number(p.norte,3),number(p.este,3),number(t.cota_diseno,3),number(t.norte_real,3),number(t.este_real,3),number(t.cota_real,3),diff(t.norte_real,p.norte),diff(t.este_real,p.este),diff(t.cota_real,t.cota_diseno)].forEach((v,j)=>put(String.fromCharCode(66+j)+row,v));});put('B55',piles.length,{bold:true});
   }else{
    for(const [cell,key]of Object.entries({N9:'terreno_natural_real',O9:'terreno_natural_proyecto',N10:'plataforma_real',O10:'plataforma_proyecto',N11:'sello_real',O11:'sello_proyecto'}))put(cell,f[key]);
    (f.puntos_referencia||[]).slice(0,4).forEach((p,i)=>{['referencia','norte','este','elevacion'].forEach((key,j)=>put(['P','R','T','V'][j]+(8+i),p[key]));});
    const checks=['pilas_grava','trazado_fundacion','estacas_principales','estacas_auxiliares','dimension_excavacion','verticalidad_paredes','estabilidad_paredes','anclaje','taludes_seguridad','sello_fundacion','perfiles_hincado','material_excavado'];
    checks.forEach((key,i)=>{const v=f.autocontrol?.[key],col=['si','no','na'].indexOf(v);if(col>=0)put((i<6?['N','O','P']:['T','U','V'])[col]+(16+i%6),'X',{bold:true});});sketch('L24','V48',piles);
   }
  }
 }
 return doc;
}
export async function loadSpecialtyProtocolPdf(protocol){
 const {supabase}=await import('../supabaseClient');
 const {data,error}=await supabase.from('config_empresa').select('logo_base64').eq('empresa',protocol.snapshot.empresa).maybeSingle();if(error)throw error;
 const backgrounds=await Promise.all(assets[protocol.tipo].map(async url=>{const r=await fetch(url);if(!r.ok)throw new Error('No se pudo cargar la plantilla original');return new Uint8Array(await r.arrayBuffer());}));
 return createSpecialtyProtocolPdf(protocol,data?.logo_base64,backgrounds);
}
export async function downloadSpecialtyProtocol(protocol){const doc=await loadSpecialtyProtocolPdf(protocol);doc.save(`Protocolo-${protocol.correlativo.replace(/[^a-z0-9_-]/gi,'_')}.pdf`);}
