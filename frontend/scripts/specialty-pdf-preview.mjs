import {createSpecialtyProtocolPdf} from '../src/utils/specialtyProtocolPdf.js';
import {mkdir,readFile} from 'node:fs/promises';
await mkdir('../tmp/specialty-pdf',{recursive:true});
await mkdir('../output/pdf',{recursive:true});
for(const tipo of ['ejecucion','topografia']){
 const protocol={tipo,correlativo:'001',fecha:'2026-11-06',estado:'borrador',snapshot:{empresa:'EMPRESA DEMOSTRACIÓN',obra:'Obra de prueba - revisión del formato',partida:'Pilas de grava',autor:'Responsable designado',fijos:{plano:'PL-001 Rev.01',mandante:'Cliente de prueba',estructura:'Fundaciones',graduacion:'3/8 a 1 1/2 pulgadas',chancado:'Mayor a 75%',diametro:'0,70',desgaste:'Menor a 30%',finos:'Menor a 5%',cota_referencia:'9,78',volumen_cuchara:'0,27',instrumento:'Estación total',marca:'Por completar',modelo:'Por completar',serie:'Por completar',certificado:'Por completar'},observaciones:'Ejemplo de revisión visual; no corresponde a un protocolo emitido ni modifica el avance de una obra.',pilas:Array.from({length:16},(_,i)=>({id:String(i),numero:String(i+1),etapa:'Etapa 1',norte:100+(i%4)*3,este:200+Math.floor(i/4)*3,topografia:{cota_inicial:10,cota_final:4,norte_real:100+(i%4)*3+.01,este_real:200+Math.floor(i/4)*3+.02,cst:i===0?0.2:null,profundidad_control:i===0?-1:null},ejecucion:{equipo:'EQ-01',longitud:6,paladas:12,volumen:3.24}}))}};
 const doc=createSpecialtyProtocolPdf(protocol,null,await Promise.all([1,2].map(n=>readFile(new URL(`../src/assets/protocols/${tipo}-${n}.png`,import.meta.url)))));
 doc.save(`../tmp/specialty-pdf/${tipo}.pdf`);
 doc.save(`../output/pdf/protocolo-${tipo}-ejemplo.pdf`);
}
