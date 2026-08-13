import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Link2, RefreshCw, Save } from 'lucide-react';
import { supabase } from '../supabaseClient';

const money = value => `$${Math.round(Number(value || 0)).toLocaleString('es-CL')}`;
const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-blue-600';
const empty = { numero_oc: '', monto_oc: '', guia_id: '', factura_id: '', nota_credito_id: '', observaciones: '' };

export default function ConciliacionCompras({ empresa, user }) {
  const [docs, setDocs] = useState([]);
  const [items, setItems] = useState([]);
  const [moves, setMoves] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');
  const load = async () => {
    const [d, i, m, c] = await Promise.all([
      supabase.from('dte_documentos_operacion').select('*').eq('empresa', empresa).eq('direccion', 'Recibido').order('fecha_emision', { ascending: false }),
      supabase.from('dte_documento_items').select('*'),
      supabase.from('bodega_movimientos').select('*').eq('empresa', empresa),
      supabase.from('compras_conciliaciones').select('*').eq('empresa', empresa).order('created_at', { ascending: false }),
    ]);
    const issue = d.error || i.error || m.error || c.error;
    if (issue) setMessage(`No fue posible cargar la conciliación: ${issue.message}`);
    else { setDocs(d.data || []); setItems(i.data || []); setMoves(m.data || []); setRows(c.data || []); }
  };
  useEffect(() => { if (empresa) load(); }, [empresa]);
  const guides = docs.filter(doc => Number(doc.tipo_dte) === 52);
  const invoices = docs.filter(doc => [33, 34].includes(Number(doc.tipo_dte)));
  const credits = docs.filter(doc => Number(doc.tipo_dte) === 61);
  const selectedGuide = docs.find(doc => doc.id === form.guia_id);
  const selectedInvoice = docs.find(doc => doc.id === form.factura_id);
  const selectedCredit = docs.find(doc => doc.id === form.nota_credito_id);
  const analysis = useMemo(() => {
    const guideItems = items.filter(item => item.documento_id === form.guia_id);
    const receptions = moves.filter(move => move.dte_documento_id === form.guia_id && (move.estado_validacion || 'Validado') !== 'Rechazado');
    const guideQty = guideItems.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
    const receivedQty = receptions.reduce((sum, move) => sum + Number(move.cantidad || 0), 0);
    const receptionAmount = receptions.reduce((sum, move) => sum + Number(move.cantidad || 0) * Number(move.costo_unitario || 0), 0);
    const invoiceAmount = Number(selectedInvoice?.monto_total || 0);
    const creditAmount = Number(selectedCredit?.monto_total || 0);
    const ocAmount = Number(form.monto_oc || 0);
    const netInvoice = invoiceAmount - creditAmount;
    const alerts = [];
    if (!form.numero_oc) alerts.push('Falta número de orden de compra');
    if (!selectedGuide) alerts.push('Falta guía de despacho');
    if (!selectedInvoice) alerts.push('Falta factura');
    if (selectedGuide && receivedQty !== guideQty) alerts.push(`Cantidad recibida ${receivedQty} versus guía ${guideQty}`);
    if (ocAmount && Math.abs(netInvoice - ocAmount) > 1) alerts.push(`Factura neta de notas ${money(netInvoice)} versus OC ${money(ocAmount)}`);
    if (selectedGuide && selectedInvoice && selectedGuide.rut_contraparte !== selectedInvoice.rut_contraparte) alerts.push('El RUT de la guía no coincide con la factura');
    return { guideQty, receivedQty, receptionAmount, invoiceAmount, creditAmount, netInvoice, ocAmount, amountDifference: netInvoice - ocAmount, qtyDifference: receivedQty - guideQty, alerts };
  }, [form, items, moves, selectedGuide, selectedInvoice, selectedCredit]);
  const save = async event => {
    event.preventDefault();
    const base = selectedInvoice || selectedGuide;
    const payload = { empresa, ...form, monto_oc: analysis.ocAmount, monto_recepcion: analysis.receptionAmount, monto_factura: analysis.invoiceAmount, monto_nota_credito: analysis.creditAmount, diferencia_monto: analysis.amountDifference, diferencia_cantidad: analysis.qtyDifference, alertas: analysis.alerts, estado: analysis.alerts.length ? 'Con diferencias' : 'Conciliado', proveedor_rut: base?.rut_contraparte || null, proveedor_nombre: base?.razon_social_contraparte || null, obra_nombre: base?.obra_nombre || null, centro_gestion_id: base?.centro_gestion_id || null, revisado_por: analysis.alerts.length ? null : (user?.nombre || user?.usuario || user?.correo), revisado_at: analysis.alerts.length ? null : new Date().toISOString() };
    ['guia_id','factura_id','nota_credito_id'].forEach(key => { if (!payload[key]) payload[key] = null; });
    const { error } = await supabase.from('compras_conciliaciones').insert(payload);
    if (error) return setMessage(error.message);
    setForm(empty); setMessage('Expediente de compra guardado con sus diferencias calculadas.'); await load();
  };
  const confirm = async row => {
    const { error } = await supabase.from('compras_conciliaciones').update({ estado: 'Conciliado', revisado_por: user?.nombre || user?.usuario || user?.correo, revisado_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) return setMessage(error.message); setMessage('Conciliación confirmada por el revisor.'); await load();
  };
  const option = doc => `${doc.tipo_nombre} N° ${doc.folio || 's/folio'} · ${doc.razon_social_contraparte} · ${money(doc.monto_total)}`;
  return <div className="space-y-4">
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-black"><Link2 className="h-5 w-5 text-blue-700"/>Conciliación de compras</h3><p className="mt-1 text-xs text-slate-500">Orden de compra, guía, recepción física, factura y nota de crédito en un solo expediente.</p></div><button onClick={load} className="rounded-xl border p-2"><RefreshCw className="h-4 w-4"/></button></div>
      {message && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-900">{message}</p>}
      <form onSubmit={save} className="mt-5 grid gap-3 lg:grid-cols-2"><input required placeholder="Número orden de compra" value={form.numero_oc} onChange={e=>setForm({...form,numero_oc:e.target.value})} className={field}/><input required type="number" min="0" placeholder="Monto total OC" value={form.monto_oc} onChange={e=>setForm({...form,monto_oc:e.target.value})} className={field}/><select required value={form.guia_id} onChange={e=>setForm({...form,guia_id:e.target.value})} className={field}><option value="">Guía recibida</option>{guides.map(doc=><option key={doc.id} value={doc.id}>{option(doc)}</option>)}</select><select required value={form.factura_id} onChange={e=>setForm({...form,factura_id:e.target.value})} className={field}><option value="">Factura recibida</option>{invoices.map(doc=><option key={doc.id} value={doc.id}>{option(doc)}</option>)}</select><select value={form.nota_credito_id} onChange={e=>setForm({...form,nota_credito_id:e.target.value})} className={field}><option value="">Sin nota de crédito</option>{credits.map(doc=><option key={doc.id} value={doc.id}>{option(doc)}</option>)}</select><input placeholder="Observaciones del expediente" value={form.observaciones} onChange={e=>setForm({...form,observaciones:e.target.value})} className={field}/>
        <div className="rounded-2xl bg-slate-50 p-4 text-xs lg:col-span-2"><div className="grid gap-2 sm:grid-cols-4"><span>OC <b>{money(analysis.ocAmount)}</b></span><span>Factura neta <b>{money(analysis.netInvoice)}</b></span><span>Recepción <b>{analysis.receivedQty} / {analysis.guideQty}</b></span><span>Diferencia <b className={analysis.amountDifference ? 'text-rose-700' : 'text-emerald-700'}>{money(analysis.amountDifference)}</b></span></div>{analysis.alerts.length>0&&<ul className="mt-3 list-disc pl-5 font-bold text-amber-800">{analysis.alerts.map(alert=><li key={alert}>{alert}</li>)}</ul>}</div><button className="flex items-center justify-center gap-2 rounded-xl bg-blue-800 py-3 text-xs font-black text-white lg:col-span-2"><Save className="h-4 w-4"/>Guardar conciliación</button></form>
    </section>
    <section className="overflow-x-auto rounded-3xl border bg-white"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="p-3">OC / proveedor</th><th className="p-3">Documentos</th><th className="p-3">Montos</th><th className="p-3">Diferencias</th><th className="p-3">Estado</th><th className="p-3">Acción</th></tr></thead><tbody className="divide-y">{rows.map(row=><tr key={row.id}><td className="p-3"><b>{row.numero_oc}</b><p>{row.proveedor_nombre || 'Sin proveedor'}</p></td><td className="p-3">Guía {row.guia_id?'✓':'—'} · Factura {row.factura_id?'✓':'—'} · NC {row.nota_credito_id?'✓':'—'}</td><td className="p-3">OC {money(row.monto_oc)}<br/>Factura {money(Number(row.monto_factura)-Number(row.monto_nota_credito))}</td><td className="p-3">Monto {money(row.diferencia_monto)}<br/>Cantidad {Number(row.diferencia_cantidad||0).toLocaleString('es-CL')}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${row.estado==='Conciliado'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-800'}`}>{row.estado}</span></td><td className="p-3">{row.estado!=='Conciliado'&&<button onClick={()=>confirm(row)} className="flex items-center gap-1 rounded-lg bg-emerald-700 px-2 py-1.5 text-[10px] font-black text-white"><CheckCircle2 className="h-3 w-3"/>Confirmar revisión</button>}</td></tr>)}</tbody></table>{!rows.length&&<p className="p-8 text-center text-xs text-slate-500">Aún no existen expedientes conciliados.</p>}</section>
  </div>;
}
