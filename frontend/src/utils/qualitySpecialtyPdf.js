import {jsPDF} from 'jspdf';
export function qualitySpecialtyPdf(record){
 const doc=new jsPDF({unit:'mm',format:'a4'}),s=record.snapshot;
 let y=20;
 const line=(text,bold=false)=>{
  doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(bold?12:10);
  for(const row of doc.splitTextToSize(String(text??''),174)){
   if(y>275){doc.addPage();y=20;}
   doc.setTextColor(bold?35:55,bold?49:65,bold?110:81);doc.text(row,18,y);y+=6;
  }
  y+=2;
 };
 line(`${s.tipo} - #${record.correlativo}`,true);
 line(`Obra: ${s.obra}`);line(`Especialidad: ${s.especialidad}`);line(`Partida: ${s.partida}`);
 line(`Fecha: ${record.fecha.split('-').reverse().join('/')} | Estado: ${record.estado==='aprobado'?'Aprobado':'Borrador'}`);
 y+=4;line('Controles del protocolo',true);
 s.controles_base.forEach((c,i)=>{line(`${i+1}. ${c}`,true);line(`Resultado: ${s.resultados[i]?.resultado||'Pendiente'}`);if(s.resultados[i]?.comentario)line(`Comentario: ${s.resultados[i].comentario}`);});
 if(s.comentarios){line('Comentarios generales',true);line(s.comentarios);}
 line(`Elaborado por: ${s.autor||''}`);if(s.aprobado_por)line(`Aprobado por: ${s.aprobado_por}`);
 for(let i=1;i<=doc.getNumberOfPages();i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(100);doc.text(`Obraxis | ${i} / ${doc.getNumberOfPages()}`,18,288);}
 return doc;
}
