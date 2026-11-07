import * as XLSX from 'xlsx';
const number=v=>v==null||v===''?null:Number(v);
export function parsePileWorkbook(buffer){
 const book=XLSX.read(buffer,{type:'array',cellDates:true});
 if(!book.Sheets['DISEÑO']||!book.Sheets.AVANCE)throw new Error('Se requieren las hojas DISEÑO y AVANCE del formato de pilas.');
 const design=XLSX.utils.sheet_to_json(book.Sheets['DISEÑO'],{header:1,defval:null});
 const advance=XLSX.utils.sheet_to_json(book.Sheets.AVANCE,{header:1,defval:null});
 const catalog=design.slice(1).filter(r=>r[1]!=null&&r[2]!=null).map((r,i)=>({numero:String(r[1]).trim(),etapa:String(r[2]).trim(),norte:number(r[3]),este:number(r[4]),longitud_diseno:number(r[12]),sourceRow:i+2}));
 const seen=new Set();for(const e of catalog){const key=`${e.etapa}:${e.numero}`;if(seen.has(key))throw new Error(`Pila duplicada en catálogo: ${key}`);seen.add(key);if(e.norte==null||e.este==null||!Number.isFinite(e.norte)||!Number.isFinite(e.este))throw new Error(`Coordenadas inválidas: ${key}`);}
 const history=advance.slice(3).filter(r=>r[2]!=null&&r[3]!=null&&r[4]!=null).map((r,i)=>{
  const date=r[2];if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw new Error(`Fecha inválida en AVANCE fila ${i+4}`);
  return {fecha:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,numero:String(r[3]).trim(),etapa:String(r[4]).trim(),equipo:String(r[5]||''),paladas:number(r[6]),volumen:number(r[8]),longitud:number(r[10]),cota_inicial:number(r[17]),cota_final:number(r[18]),cst:number(r[14]),sourceRow:i+4};
 });
 return {catalog,history,stages:[...new Set(catalog.map(r=>r.etapa))]};
}
