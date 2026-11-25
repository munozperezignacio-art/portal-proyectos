import JSZip from 'jszip';
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG='http://schemas.openxmlformats.org/package/2006/relationships';
const CT='http://schemas.openxmlformats.org/package/2006/content-types';
const xml=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('Plantilla Excel inválida');return d;};
const out=d=>new XMLSerializer().serializeToString(d);
const all=(d,tag)=>[...d.getElementsByTagNameNS(NS,tag)];
const el=(d,tag,attrs={})=>{const n=d.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const serial=date=>Date.parse(`${date}T00:00:00Z`)/86400000+25569;
const total=(groups,key)=>groups.reduce((s,g)=>s+g[key],0);
function wrapStyle(styles,base){const xfs=all(styles,'cellXfs')[0],xf=xfs.children[base].cloneNode(true);let align=[...xf.children].find(n=>n.localName==='alignment');if(!align){align=el(styles,'alignment');xf.append(align);}align.setAttribute('wrapText','1');xf.setAttribute('applyAlignment','1');xfs.append(xf);xfs.setAttribute('count',xfs.children.length);return xfs.children.length-1;}
function write(d,ref,value,formula,style){
 let cell=all(d,'c').find(c=>c.getAttribute('r')===ref);
 if(!cell){const rn=ref.match(/\d+/)[0];let row=all(d,'row').find(r=>r.getAttribute('r')===rn);if(!row){row=el(d,'row',{r:rn});const data=all(d,'sheetData')[0];data.insertBefore(row,[...data.children].find(r=>+r.getAttribute('r')>+rn)||null);}cell=el(d,'c',{r:ref});const col=s=>[...s.match(/[A-Z]+/)[0]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);row.insertBefore(cell,[...row.children].find(c=>col(c.getAttribute('r'))>col(ref))||null);}
 cell.replaceChildren();cell.removeAttribute('t');if(style!=null)cell.setAttribute('s',style);
 if(formula){const f=el(d,'f');f.textContent=formula;cell.append(f);}
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Importe no válido en formulario');const v=el(d,'v');v.textContent=String(value);cell.append(v);}
 else if(value!=null){cell.setAttribute('t','inlineStr');const is=el(d,'is'),t=el(d,'t');t.textContent=String(value);is.append(t);cell.append(is);}
}
function numericStyle(styles,code,base=0){
 let formats=all(styles,'numFmts')[0];if(!formats){formats=el(styles,'numFmts');styles.documentElement.insertBefore(formats,styles.documentElement.firstChild);}
 const id=Math.max(163,...all(styles,'numFmt').map(f=>+f.getAttribute('numFmtId')))+1;formats.append(el(styles,'numFmt',{numFmtId:id,formatCode:code}));formats.setAttribute('count',formats.children.length);
 const xfs=all(styles,'cellXfs')[0];const xf=xfs.children[base].cloneNode(true);xf.setAttribute('numFmtId',id);xf.setAttribute('applyNumberFormat','1');xfs.append(xf);xfs.setAttribute('count',xfs.children.length);return xfs.children.length-1;
}
export async function createEnexInvoiceForm(record,kind,templateBytes){
 if(!['consumo','cargo'].includes(kind)||!record?.id||!record.reconciliation?.ready)throw Error('Se requiere una factura emitida');
 const zip=await JSZip.loadAsync(templateBytes);const template=await zip.file('xl/worksheets/sheet1.xml').async('string');
 const workbook=xml(await zip.file('xl/workbook.xml').async('string')),rels=xml(await zip.file('xl/_rels/workbook.xml.rels').async('string')),types=xml(await zip.file('[Content_Types].xml').async('string')),styles=xml(await zip.file('xl/styles.xml').async('string'));
 const baseDoc=xml(template),styleAt=ref=>Number(all(baseDoc,'c').find(c=>c.getAttribute('r')===ref)?.getAttribute('s')||0);
 const literStyle=numericStyle(styles,'#,##0.000',styleAt('F9')),pesoStyle=numericStyle(styles,'#,##0',styleAt(kind==='cargo'?'S11':'K9')),dateStyle=numericStyle(styles,'dd-mm-yyyy',styleAt(kind==='cargo'?'J8':'B4'));
 const locationStyle=wrapStyle(styles,styleAt(kind==='cargo'?'B11':'C9'));
 const sheets=all(workbook,'sheets')[0];sheets.replaceChildren();
 for(const r of [...rels.documentElement.children])if(r.getAttribute('Type').endsWith('/worksheet'))r.remove();
 for(const n of [...types.documentElement.children])if(n.getAttribute('PartName')?.startsWith('/xl/worksheets/sheet'))n.remove();
 let names=all(workbook,'definedNames')[0];if(!names){names=el(workbook,'definedNames');workbook.documentElement.append(names);}names.replaceChildren();
 const groups=record.reconciliation.groups,limit=kind==='consumo'?15:8,pages=Math.ceil(groups.length/limit),inv=record.invoice;
 if(!pages)throw Error('Conciliación sin centros');
 for(let page=0;page<pages;page++){
  const d=xml(template),chunk=groups.slice(page*limit,(page+1)*limit),index=page+1,name=pages===1?'Formulario':`Página ${index}`;
  const w=(ref,v,f,s)=>write(d,ref,v,f,s);
  if(kind==='consumo'){
   w('B3',inv.document);w('B4',serial(inv.date),null,dateStyle);
   for(let i=0;i<chunk.length;i++){
    const g=chunk[i],r=9+i;w('A'+r,g.center_code);w('B'+r,serial(inv.date),'$B$4',dateStyle);w('C'+r,g.center_name,null,locationStyle);w('D'+r,'ENEX S.A.');w('E'+r,inv.document);
    const row=all(d,'row').find(row=>row.getAttribute('r')===String(r));row.setAttribute('ht','30');row.setAttribute('customHeight','1');
    w('F'+r,g.adjusted_liters_milli/1000,null,literStyle);w('G'+r,g.classification==='maquinaria'?'Maquinarias':'Camionetas');
    w('H'+r,g.adjusted_liters_milli?g.net/(g.adjusted_liters_milli/1000):0,`IF(F${r}=0,0,K${r}/F${r})`);
    w('I'+r,g.specific_tax,null,pesoStyle);w('J'+r,g.vat,null,pesoStyle);w('K'+r,g.net,null,pesoStyle);w('L'+r,g.total,`SUM(I${r}:K${r})+${g.exempt}`,pesoStyle);
    w('P'+r,g.classification==='maquinaria'?g.specific_tax:0,g.classification==='maquinaria'?`I${r}`:null,pesoStyle);
    w('Q'+r,(g.classification==='camioneta'?g.specific_tax:0)+g.exempt,g.classification==='camioneta'?`I${r}+${g.exempt}`:null,pesoStyle);
    w('R'+r,g.vat,`J${r}`,pesoStyle);w('S'+r,g.net,`K${r}`,pesoStyle);w('T'+r,g.total,`SUM(P${r}:S${r})`,pesoStyle);
   }
   const cols={F:total(chunk,'adjusted_liters_milli')/1000,I:total(chunk,'specific_tax'),J:total(chunk,'vat'),K:total(chunk,'net'),L:total(chunk,'total'),P:total(chunk.filter(g=>g.classification==='maquinaria'),'specific_tax'),Q:total(chunk.filter(g=>g.classification==='camioneta'),'specific_tax')+total(chunk,'exempt'),R:total(chunk,'vat'),S:total(chunk,'net'),T:total(chunk,'total')};
   for(const [c,value] of Object.entries(cols))w(c+'29',value,`SUM(${c}9:${c}23)`,c==='F'?literStyle:pesoStyle);
   for(const c of ['P','Q','R','S','T'])w(c+'33',cols[c],`${c}29`,pesoStyle);
   w('G34',total(chunk,'net'),'K29',pesoStyle);w('G35',total(chunk,'specific_tax'),'I29',pesoStyle);w('L33',pages>1?'Subtotal página':'Total');
  }else{
   w('E8',inv.document);w('J8',serial(inv.date),null,dateStyle);w('Q8',serial(inv.due_date),null,dateStyle);
   for(let i=0;i<chunk.length;i++){
    const g=chunk[i],r=11+i;w('B'+r,`${g.center_name} · ${g.classification}`,null,locationStyle);
    const acc=inv.account.padStart(7,' '),cc=String(g.center_code).padStart(3,'0');
    [...acc].forEach((v,j)=>w(String.fromCharCode(72+j)+r,v.trim()));[...cc].forEach((v,j)=>w(String.fromCharCode(79+j)+r,v));
    w('R'+r,g.specific_tax,null,pesoStyle);w('S'+r,g.net,null,pesoStyle);
   }
   w('S20',total(chunk,'net'),'SUM(S11:S18)',pesoStyle);w('S21',total(chunk,'vat'),null,pesoStyle);w('S22',total(chunk,'specific_tax'),'SUM(R11:R18)',pesoStyle);
   if(total(chunk,'exempt')){w('P19','EXENTO');w('S19',total(chunk,'exempt'),null,pesoStyle);}
   w('S23',total(chunk,'total'),'SUM(S19:S22)',pesoStyle);if(pages>1)w('P23','SUBTOTAL PÁGINA');
  }
  // Keep complete original form on every page; never truncate excess centers.
  let setup=all(d,'pageSetup')[0];if(!setup){setup=el(d,'pageSetup');d.documentElement.append(setup);}setup.setAttribute('orientation','landscape');setup.setAttribute('paperSize',kind==='consumo'?'8':'9');setup.setAttribute('fitToWidth','1');setup.setAttribute('fitToHeight','1');
  const sheetPath=`xl/worksheets/sheet${index}.xml`;zip.file(sheetPath,out(d));
  const sheet=el(workbook,'sheet',{name,sheetId:index});sheet.setAttributeNS(REL,'r:id',`sheet${index}`);sheets.append(sheet);
  const relation=rels.createElementNS(PKG,'Relationship');for(const[k,v]of Object.entries({Id:`sheet${index}`,Type:REL+'/worksheet',Target:`/xl/worksheets/sheet${index}.xml`}))relation.setAttribute(k,v);rels.documentElement.append(relation);
  const content=types.createElementNS(CT,'Override');content.setAttribute('PartName','/'+sheetPath);content.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');types.documentElement.append(content);
  const print=el(workbook,'definedName',{name:'_xlnm.Print_Area',localSheetId:page});print.textContent=`'${name}'!$A$1:$T$${kind==='consumo'?43:27}`;names.append(print);
  if(page>0&&zip.file('xl/worksheets/_rels/sheet1.xml.rels'))zip.file(`xl/worksheets/_rels/sheet${index}.xml.rels`,await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string'));
 }
 zip.file('xl/styles.xml',out(styles));zip.file('xl/workbook.xml',out(workbook));zip.file('xl/_rels/workbook.xml.rels',out(rels));zip.file('[Content_Types].xml',out(types));
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
export async function downloadEnexInvoiceForm(record,kind){
 const response=await fetch(`/templates/enex/${kind}.xlsx`);if(!response.ok)throw Error('No se pudo cargar la plantilla');
 const data=await createEnexInvoiceForm(record,kind,await response.arrayBuffer());
 const url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const link=document.createElement('a');link.href=url;link.download=`ENEX-${record.document}-${kind}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
