// Text extraction is a draft only: the original PDF and every field require review.
export function invoicePdfLines(items){
 const lines=[];
 for(const item of items.filter(i=>typeof i.str==='string'&&i.str.trim())){
  const y=item.transform[5];let line=lines.find(l=>Math.abs(l.y-y)<2);
  if(!line){line={y,items:[]};lines.push(line);}line.items.push(item);
 }
 return lines.sort((a,b)=>b.y-a.y).map(l=>l.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str.trim()).join(' ').replace(/\s+/g,' ').trim());
}
export const normalizeInvoiceRut=value=>String(value||'').replace(/[.\s,]/g,'').toUpperCase();
export function parseInvoicePeso(value){
 const raw=String(value).trim();
 if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(raw))throw Error('Use pesos enteros, sin decimales');
 const n=Number(raw.replaceAll('.',''));if(!Number.isSafeInteger(n)||Math.abs(n)>1e12)throw Error('Importe fuera de rango');return n;
}
export function parseInvoiceLiters(value){
 const raw=String(value).trim();
 if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,3})?$/.test(raw))throw Error('Litros: use coma para los decimales, máximo 3');
 const [whole,fraction='']=raw.replaceAll('.','').split(',');const n=Number(whole)*1000+Number(fraction.padEnd(3,'0'));
 if(!Number.isSafeInteger(n)||n<=0||n>1e12)throw Error('Litros fuera de rango');return n;
}
export function extractInvoiceDraft(lines){
 const clean=lines.filter(l=>!/[0-9]{35}/.test(l));
 const text=clean.join('\n'),draft={guides:'',issuer_rut:'',receiver_rut:'',document:'',date:'',due_date:'',liters:'',fuel_net:'',shellcard_net:'',net:'',vat:'',specific_tax:'',exempt:'',total:'',account:'2003'};
 draft.document=text.match(/N[º°]\s*:?\s*(\d{5,12})/)?.[1]||'';
 const ruts=[...text.matchAll(/\b\d{1,2}[.,]?\d{3}[.,]?\d{3}-[\dKk]\b/g)].map(m=>normalizeInvoiceRut(m[0]));
 draft.issuer_rut=ruts.find(r=>r==='92011000-2')||'';draft.receiver_rut=ruts.find(r=>r!==draft.issuer_rut)||'';
 const dates=[...text.matchAll(/\b(\d{2})[-/](\d{2})[-/](20\d{2})\b/g)].map(m=>`${m[3]}-${m[2]}-${m[1]}`);
 draft.date=dates[0]||'';draft.due_date=dates.find(d=>d>draft.date)||'';
 // ENEX prints its guide list as standalone rows of 7–10 digit numbers.
 // No slicing arbitrary barcode digits, dates, customer IDs or invoice totals.
 const productIndex=clean.findIndex(l=>/Shellcard/i.test(l));
 if(productIndex>=0){const end=clean.findIndex((l,i)=>i>productIndex&&/MONTO NETO|TOTAL A PAGAR/.test(l));draft.guides=clean.slice(productIndex+1,end<0?undefined:end).filter(l=>/^\d{7,10}(?:\s+\d{7,10})*$/.test(l)).join(' ');}
 for(const line of clean){
  const money=line.match(/-?\d{1,3}(?:\.\d{3})+(?![\d,])/g)||[];
  const last=money.at(-1);
  if(/Petr[oó]leo Diesel/i.test(line)){
   draft.fuel_net=last||'';
   // Quantity immediately following the product description, before unit price.
   draft.liters=line.match(/Diesel\s+G-B\s+(?:LT\s+)?(\d[\d.]*(?:,\d{1,3})?)/i)?.[1]||'';
  }
  if(/Shellcard/i.test(line))draft.shellcard_net=last||'';
  if(/MONTO NETO/i.test(line))draft.net=last||'';
  if(/I\.V\.A\./i.test(line))draft.vat=last||'';
  if(/IMP\. ESPEC\. DIESEL/i.test(line))draft.specific_tax=last||'';
  if(/MONTO EXENTO/i.test(line))draft.exempt=last||'';
  if(/TOTAL A PAGAR/i.test(line)&&last)draft.total=last;
 }
 return draft;
}
export async function readInvoicePdf(file){
 if(file.size>10485760)throw Error('PDF de máximo 10 MB');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('El archivo no es PDF');
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
 const task=pdfjs.getDocument({data:bytes,isEvalSupported:false});const pdf=await task.promise;
 try{
  if(pdf.numPages>30)throw Error('Máximo 30 páginas por factura');
  const lines=[];for(let i=1;i<=pdf.numPages;i++)lines.push(...invoicePdfLines((await(await pdf.getPage(i)).getTextContent()).items));
  return {draft:extractInvoiceDraft(lines),hasText:lines.length>0};
 }finally{await task.destroy();}
}
