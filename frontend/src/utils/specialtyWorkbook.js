import * as XLSX from 'xlsx';
const number=v=>v==null||v===''?null:Number(v);
export const normalizeFront=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const header=value=>normalizeFront(value).replace(/[^a-z0-9]/g,'');
const aliases={numero:['numero','numeropila','npila','npunto','numeropunto','pila','punto','n'],norte:['norte','coordenadanorte','northing'],este:['este','coordenadaeste','easting'],etapa:['etapa'],frente:['frente','frentedetrabajo','nombrefrente','nombredefrentedetrabajo'],longitud_diseno:['longitud','longituddiseno','longituddediseno']};
export function parsePileWorkbook(buffer,{frontColumn}={}){
 const book=XLSX.read(buffer,{type:'array',cellDates:true});
 const candidates=[];
 for(const sheet of book.SheetNames){
  if(header(sheet)==='avance')continue;
  const rows=XLSX.utils.sheet_to_json(book.Sheets[sheet],{header:1,defval:null});
  for(let i=0;i<Math.min(rows.length,50);i++){
   const columns=Object.fromEntries(Object.entries(aliases).map(([key,names])=>[key,rows[i].findIndex(v=>names.includes(header(v)))]));
   if(['numero','norte','este'].every(k=>columns[k]>=0)){candidates.push({sheet,rows,columns,start:i+1});break;}
  }
 }
 // Preserve the established positional template, but never apply it to arbitrary sheets.
 if(!candidates.length&&book.Sheets['DISEÑO'])candidates.push({sheet:'DISEÑO',rows:XLSX.utils.sheet_to_json(book.Sheets['DISEÑO'],{header:1,defval:null}),columns:{numero:1,etapa:2,norte:3,este:4,longitud_diseno:12,frente:-1},start:1});
 if(!candidates.length)throw new Error('No se encontraron las columnas Número de pila / N° punto, Norte y Este. Pueden estar en cualquier hoja y orden.');
 if(candidates.length>1)throw new Error('Hay varias hojas con coordenadas. Importa un archivo con una sola tabla de coordenadas para evitar mezclar catálogos.');
 const {sheet,rows:design,columns,start}=candidates[0];
 const columnOptions=Array.from({length:Math.max(...design.map(r=>r.length))},(_,index)=>({index,label:`Columna ${XLSX.utils.encode_col(index)} · ${design[start-1]?.[index]||'Sin título'}`})).filter(c=>![columns.numero,columns.norte,columns.este].includes(c.index));
 if(frontColumn!==undefined){if(!columnOptions.some(c=>c.index===frontColumn))throw new Error('Selecciona una columna válida para el frente.');columns.frente=frontColumn;}
 const advance=book.Sheets.AVANCE?XLSX.utils.sheet_to_json(book.Sheets.AVANCE,{header:1,defval:null}):[];
 const numeric=v=>typeof v==='string'?number(v.trim().replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,v.includes(',')?'':'.').replace(',','.')):number(v);
 const catalog=design.slice(start).map((r,i)=>({r,line:start+i+1})).filter(({r})=>r.some(v=>v!=null&&String(v).trim()!=='')).map(({r,line})=>({numero:String(r[columns.numero]??'').trim(),etapa:String(r[columns.etapa]??'').trim(),frente:String(r[columns.frente]??'').trim(),norte:numeric(r[columns.norte]),este:numeric(r[columns.este]),longitud_diseno:numeric(r[columns.longitud_diseno]),sourceRow:line}));
 if(!catalog.length)throw new Error('El archivo no contiene puntos.');
 for(const e of catalog)if(!e.numero)throw new Error(`Falta el número de pila en fila ${e.sourceRow}.`);
 const seen=new Set();for(const e of catalog){const key=`${e.etapa}:${e.numero}`;if(seen.has(key))throw new Error(`Pila duplicada en catálogo: ${key}`);seen.add(key);if(e.norte==null||e.este==null||!Number.isFinite(e.norte)||!Number.isFinite(e.este))throw new Error(`Coordenadas inválidas: ${key}`);}
 const history=advance.slice(3).filter(r=>r[2]!=null&&r[3]!=null&&r[4]!=null).map((r,i)=>{
  const date=r[2];if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw new Error(`Fecha inválida en AVANCE fila ${i+4}`);
  return {fecha:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,numero:String(r[3]).trim(),etapa:String(r[4]).trim(),equipo:String(r[5]||''),paladas:number(r[6]),volumen:number(r[8]),longitud:number(r[10]),cota_inicial:number(r[17]),cota_final:number(r[18]),cst:number(r[14]),sourceRow:i+4};
 });
 return {catalog,history,stages:[...new Set(catalog.map(r=>r.etapa))],sheet,columns,columnOptions};
}
