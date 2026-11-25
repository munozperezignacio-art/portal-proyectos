import React,{useEffect,useRef,useState} from 'react';
import {FileText,Upload,Download,RefreshCw} from 'lucide-react';
import {supabase} from '../supabaseClient';
import {readInvoicePdf,parseInvoiceLiters,parseInvoicePeso,normalizeInvoiceRut} from '../utils/enexInvoicePdf';
import {listEnexInvoices,previewEnexInvoice,issueEnexInvoice,saveEnexInvoiceDraft,readEnexInvoiceDraft} from '../services/enexInvoicesService';
import {invoiceDraftFields,invoiceProgress} from '../utils/enexInvoiceProgress';
import EnexInvoicePending from './EnexInvoicePending';
const moneyFields=[['fuel_net','Neto combustible'],['shellcard_net','Cargo / descuento Shellcard'],['net','Monto neto'],['vat','IVA'],['specific_tax','Impuesto específico'],['exempt','Monto exento'],['total','Total factura']];
const money=n=>'$'+Number(n).toLocaleString('es-CL');
const liters=n=>(Number(n)/1000).toLocaleString('es-CL',{minimumFractionDigits:3});
export default function EnexInvoices({company,canImport,db=supabase}){
 const [history,setHistory]=useState([]),[file,setFile]=useState(null),[draft,setDraft]=useState(null),[portal,setPortal]=useState('transporte');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[checked,setChecked]=useState(false),[preview,setPreview]=useState(null),[uncertain,setUncertain]=useState(false);
 const [selected,setSelected]=useState(null),[pdfUrl,setPdfUrl]=useState('');const gate=useRef(false),attempt=useRef(null),mounted=useRef(true);
 const [saved,setSaved]=useState(null),[dirty,setDirty]=useState(false),[pendingRefresh,setPendingRefresh]=useState(0);const uploadState=useRef({});
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let active=true;listEnexInvoices(db,company).then(r=>{if(active)setHistory(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[db,company]);
 useEffect(()=>{if(!file){setPdfUrl('');return;}const url=URL.createObjectURL(file);setPdfUrl(url);return()=>URL.revokeObjectURL(url);},[file]);
 function change(key,value){setDraft(d=>({...d,[key]:value}));setDirty(true);setPreview(null);setChecked(false);setError('');}
 async function run(action){if(gate.current)return;gate.current=true;setBusy(true);setError('');try{await action();}catch(e){if(mounted.current)setError(e.message);}finally{gate.current=false;if(mounted.current)setBusy(false);}}
 async function refresh(){await run(async()=>{const all=await listEnexInvoices(db,company);setHistory(all);const found=all.find(i=>i.id===attempt.current);if(found){setSelected(found);setDraft(null);setFile(null);setUncertain(false);setNotice('Emisión encontrada y verificada. Descargue los formularios desde el historial.');}else if(uncertain){setNotice('No aparece una emisión con ese identificador. Revise el error antes de cargar nuevamente la factura.');} });}
 function payload(){return {empresa:company,portal,document:draft.document.trim(),issuer_rut:normalizeInvoiceRut(draft.issuer_rut),receiver_rut:normalizeInvoiceRut(draft.receiver_rut),date:draft.date,due_date:draft.due_date,account:draft.account.trim(),guides:draft.guides.trim().split(/[\s,;]+/).filter(Boolean),liters_milli:parseInvoiceLiters(draft.liters),...Object.fromEntries(moneyFields.map(([k,label])=>[k,parseInvoicePeso(draft[k],label)]))};}
 async function load(event){const chosen=event.target.files?.[0];event.target.value='';if(!chosen)return;await run(async()=>{setPreview(null);setChecked(false);setSelected(null);setDraft(null);setFile(null);setSaved(null);setDirty(true);uploadState.current={};const result=await readInvoicePdf(chosen);setFile(chosen);setDraft(result.draft);attempt.current=crypto.randomUUID();setUncertain(false);setNotice(result.hasText?'Lectura preliminar: revise las guías, fechas e importes contra el PDF. Complete los campos vacíos, incluido exento si corresponde a $0. Luego pulse Guardar factura y cruzar: quedará en Pendientes hasta poder emitir.':'El PDF no contiene texto extraíble. Complete y revise los datos manualmente contra el original antes de guardar.');});}
 async function cross(){await run(async()=>{
  setSelected(null);setChecked(false);const invoice=payload();
  const result=await previewEnexInvoice(db,invoice);
  const record=await saveEnexInvoiceDraft(db,attempt.current,file,invoice,saved?.revision,uploadState.current);
  setSaved(record);setDirty(false);setFile(null);setPreview(result);setPendingRefresh(n=>n+1);
  setNotice('Factura y PDF guardados. Puede cerrar y retomarla desde Facturas pendientes sin subirla otra vez. No se han emitido formularios.');
 });}
 async function openPending(id){await run(async()=>{
  const record=await readEnexInvoiceDraft(db,company,id);attempt.current=record.id;setSaved(record);setDraft(invoiceDraftFields(record.invoice));setPortal(record.portal);setFile(null);setSelected(null);setPreview(record.reconciliation);setDirty(false);setChecked(false);setUncertain(false);
  setNotice('Factura recuperada con su PDF original. El cruce se actualizó con las asignaciones actuales.');
 });}
 async function emit(){await run(async()=>{if(!checked||!preview?.ready||!saved||dirty||uncertain)return;setUncertain(true);const result=await issueEnexInvoice(db,attempt.current,null,payload(),preview);setSelected(result);setHistory(h=>[result,...h.filter(i=>i.id!==result.id)]);setDraft(null);setFile(null);setSaved(null);setPreview(null);setUncertain(false);setPendingRefresh(n=>n+1);setNotice('Factura emitida y persistencia confirmada. Los movimientos y sus asignaciones no se modificaron.');});}
 async function download(record,kind){await run(async()=>{const {downloadEnexInvoiceForm}=await import('../utils/enexInvoiceForms');await downloadEnexInvoiceForm(record,kind);});}
 async function source(record){await run(async()=>{const {data,error:e}=await db.storage.from('enex-invoices').download(record.source_path);if(e)throw Error('No se pudo descargar el PDF original');const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=`ENEX-${record.document}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);});}
 const view=selected?.reconciliation||preview;
 return <section className="enex-invoices" aria-label="Facturas ENEX" aria-busy={busy}>
  <header className="enex-invoice-title"><div><h3><FileText size={20}/> Facturas y formularios de cargo</h3><p className="enex-muted">Cruza las guías con las cargas asignadas. El centro de gestión corresponde al centro de costo del formulario.</p></div><button className="enex-secondary" disabled={busy} onClick={refresh}><RefreshCw size={16}/> Actualizar historial</button></header>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {canImport&&<EnexInvoicePending db={db} company={company} onOpen={openPending} disabled={busy} refreshKey={pendingRefresh}/>}
  {canImport&&<fieldset disabled={busy}><legend><Upload size={16}/> Cargar factura</legend><label>Factura PDF<input type="file" accept="application/pdf,.pdf" onChange={load}/></label><p className="enex-muted">Máximo 10 MB. No genera cargos contables ni modifica litros, responsables o asignaciones. La emisión requiere permiso «Importar» de Combustible Enex.</p></fieldset>}
  {draft&&<><p className="enex-info">{saved?`Factura ${saved.document} guardada${dirty?' · Tiene cambios sin guardar': ' · PDF conservado'}`:'Todavía no guardada. Revise los datos y pulse Guardar factura y cruzar para conservar el PDF y retomar después.'}</p><fieldset disabled={busy||uncertain}><legend>Revisar datos de la factura</legend>
   <div className="enex-invoice-fields">
    <label>Portal<select value={portal} onChange={e=>{setPortal(e.target.value);setDirty(true);setPreview(null);setChecked(false);}}><option value="transporte">Transporte</option><option value="empresa">Empresa</option></select></label>
    {[['document','N° factura'],['issuer_rut','RUT proveedor'],['receiver_rut','RUT receptor'],['date','Fecha emisión'],['due_date','Fecha vencimiento'],['liters','Litros facturados'],['account','Cuenta contable']].map(([k,label])=><label key={k}>{label}<input readOnly={Boolean(saved)&&(k==='document'||k==='issuer_rut')} type={k==='date'||k==='due_date'?'date':'text'} value={draft[k]} onChange={e=>change(k,e.target.value)}/></label>)}
    {moneyFields.map(([k,label])=><label key={k}>{label} ($ CLP)<input inputMode="decimal" value={draft[k]} placeholder={k==='exempt'?'Ingrese 0 si no corresponde':undefined} onChange={e=>change(k,e.target.value)}/></label>)}
   </div>
   <p className="enex-muted">Los puntos separan miles en los importes en pesos (ej.: 5.334.433). Complete los montos vacíos; si no corresponden, ingrese 0 después de revisar el PDF.</p>
   <label className="enex-invoice-guides">Guías de despacho (una por línea o separadas por espacios)<textarea rows={4} value={draft.guides} onChange={e=>change('guides',e.target.value)}/></label>
   {pdfUrl&&<a href={pdfUrl} target="_blank" rel="noreferrer">Abrir PDF original para revisar</a>}
   {saved&&<button className="enex-secondary" onClick={()=>source(saved)}>Descargar PDF guardado</button>}
   <button onClick={cross}>{saved?'Guardar y actualizar cruce':'Guardar factura y cruzar'}</button>
  </fieldset>{uncertain&&<p role="alert">Se intentó emitir esta factura. Actualice el historial para comprobar el resultado; el botón queda bloqueado para evitar repetir el envío.</p>}</>}
  {view&&<section className="enex-invoice-review"><h3>{selected?`Factura ${selected.document} · conciliación emitida`:'Resultado del cruce'}</h3>
   {!selected&&saved&&<p className="enex-info"><strong>{invoiceProgress(saved.invoice,view).assigned} de {invoiceProgress(saved.invoice,view).total} movimientos con asignación válida.</strong> {view.ready?'Lista para revisar y emitir.':'Guardada en Facturas pendientes. Aún no se pueden emitir los formularios.'}</p>}
   {!view.ready?<div role="alert"><strong>No se puede emitir todavía.</strong><ul>{view.problems.map((p,i)=><li key={i}>{p.document?`Guía ${p.document}: `:''}{p.message}</li>)}</ul><p>Resuelva las asignaciones en Movimientos y vuelva a cruzar.</p></div>:<>
    <p className="enex-info">{view.rows.length} guías · {liters(view.original_liters_milli)} L originales · {liters(view.invoice_liters_milli)} L facturados · diferencia {liters(view.difference_milli)} L. Maquinaria: cargas originales superiores a {liters(view.rules.machinery_threshold_milli)} L.</p>
    <div className="enex-table-wrap"><table><caption>Distribución por centro y uso</caption><thead><tr>{['Centro de costo','Uso','Guías','Litros originales','Litros conciliados','Neto','IVA','Imp. específico','Total'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{view.groups.map(g=><tr key={`${g.center_id}-${g.classification}`}><td>{g.center_code} · {g.center_name}</td><td>{g.classification}</td><td>{g.documents.join(', ')}</td><td>{liters(g.original_liters_milli)}</td><td>{liters(g.adjusted_liters_milli)}</td><td>{money(g.net)}</td><td>{money(g.vat)}</td><td>{money(g.specific_tax)}</td><td>{money(g.total)}</td></tr>)}</tbody></table></div>
    {!selected&&<div className="enex-invoice-confirm"><label><input type="checkbox" disabled={busy||uncertain} checked={checked} onChange={e=>setChecked(e.target.checked)}/> Revisé el PDF completo, receptor {company}, todas las guías, la cuenta y los importes. Confirmo la distribución proporcional mostrada.</label><button disabled={!checked||busy||uncertain} onClick={emit}>Emitir los dos formularios</button></div>}
    {selected&&<div className="enex-invoice-actions">{['consumo','cargo'].map(k=><button key={k} disabled={busy} onClick={()=>download(selected,k)}><Download size={16}/> Descargar {k==='consumo'?'consumo de combustible':'formulario de cargo'} (.xlsx)</button>)}<button className="enex-secondary" disabled={busy} onClick={()=>source(selected)}>PDF original</button></div>}
   </>}
  </section>}
  <section><h3>Facturas emitidas</h3><p className="enex-muted">Volver a descargar conserva la conciliación original y no crea otro cargo.</p><div className="enex-table-wrap"><table><thead><tr><th>Factura</th><th>Portal</th><th>Fecha factura</th><th>Emitida en Obraxis</th><th>Total</th><th>Formularios</th></tr></thead><tbody>{history.map(r=><tr key={r.id}><td>{r.document}</td><td>{r.portal}</td><td>{r.invoice.date}</td><td>{new Date(r.issued_at).toLocaleString('es-CL')}</td><td>{money(r.invoice.total)}</td><td><button disabled={busy} onClick={()=>{setSelected(r);setError('');}}>Ver y descargar</button></td></tr>)}{!history.length&&<tr><td colSpan={6}>No hay facturas emitidas.</td></tr>}</tbody></table></div></section>
 </section>;
}
