import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, Building2, PackagePlus, ArrowRightLeft, AlertTriangle, Search, Plus, Save, Warehouse, History, PackageCheck, FileText, Link2, BarChart3 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ModuleHeader from './ModuleHeader';
import useUserPermissions from '../utils/useUserPermissions';
import { can } from '../utils/permissionsCatalog';
import { WarehouseStatistics } from './OperationalStatistics';

const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';
const qty = value => Number(value || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
const money = value => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const positiveTypes = new Set(['Entrada', 'Ajuste +', 'Transferencia entrada']);

export default function BodegaEmpresa({ user, onBack }) {
  const empresa = user?.empresa || '';
  const { permissions, loading: permissionsLoading } = useUserPermissions(user);
  const canView = can(user, permissions, 'bodega.inventario.ver');
  const canCreate = can(user, permissions, 'bodega.inventario.crear');
  const canEdit = can(user, permissions, 'bodega.inventario.editar');
  const canConfigure = can(user, permissions, 'bodega.inventario.configurar');
  const canViewStatistics = can(user, permissions, 'bodega.estadisticas.ver');
  const [tab, setTab] = useState('stock');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [bodegas, setBodegas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [centros, setCentros] = useState([]);
  const [obras, setObras] = useState([]);
  const [guias, setGuias] = useState([]);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [bodegaForm, setBodegaForm] = useState({ codigo: '', nombre: '', centro_gestion_id: '', tipo: 'Central', responsable: '', ubicacion: '' });
  const [productoForm, setProductoForm] = useState({ codigo: '', nombre: '', categoria: 'Material', unidad: 'UN', stock_minimo: 0, costo_referencia: 0 });
  const [movForm, setMovForm] = useState({ bodega_id: '', producto_id: '', tipo: 'Entrada', cantidad: '', costo_unitario: '', documento: '', contraparte: '', observaciones: '', dte_documento_id: '', generar_guia: false });
  const [transferForm, setTransferForm] = useState({ origen: '', destino: '', producto_id: '', cantidad: '', observaciones: '' });

  const load = async () => {
    if (!empresa) return;
    setLoading(true); setMessage('');
    const [b, p, m, c, o, g] = await Promise.all([
      supabase.from('bodega_bodegas').select('*').eq('empresa', empresa).order('codigo'),
      supabase.from('bodega_productos').select('*').eq('empresa', empresa).order('nombre'),
      supabase.from('bodega_movimientos').select('*').eq('empresa', empresa).order('fecha', { ascending: false }).limit(1000),
      supabase.from('facturacion_centros_gestion').select('*').eq('empresa', empresa).eq('activo', true).order('codigo'),
      supabase.from('obras').select('id,nombre,centro_gestion_id,estado').eq('empresa', empresa).order('nombre'),
      supabase.from('dte_documentos_operacion').select('*').eq('empresa', empresa).eq('tipo_dte', 52).order('fecha_emision', { ascending: false })
    ]);
    const error = b.error || p.error || m.error || c.error || o.error || g.error;
    if (error) setMessage(`No fue posible cargar Bodega: ${error.message}`);
    else { setBodegas(b.data || []); setProductos(p.data || []); setMovimientos(m.data || []); setCentros(c.data || []); setObras(o.data || []); setGuias(g.data || []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [empresa]);

  const stockRows = useMemo(() => {
    const map = new Map();
    movimientos.forEach(m => {
      const key = `${m.bodega_id}:${m.producto_id}`;
      const row = map.get(key) || { bodega_id: m.bodega_id, producto_id: m.producto_id, stock: 0, valor: 0 };
      const sign = positiveTypes.has(m.tipo) ? 1 : -1;
      row.stock += sign * Number(m.cantidad || 0);
      row.valor += sign * Number(m.cantidad || 0) * Number(m.costo_unitario || 0);
      map.set(key, row);
    });
    return [...map.values()].map(row => ({ ...row, bodega: bodegas.find(x => x.id === row.bodega_id), producto: productos.find(x => x.id === row.producto_id) }))
      .filter(row => row.bodega && row.producto);
  }, [movimientos, bodegas, productos]);
  const stockMap = useMemo(() => new Map(stockRows.map(row => [`${row.bodega_id}:${row.producto_id}`, row.stock])), [stockRows]);
  const filteredStock = stockRows.filter(row => (!warehouseFilter || String(row.bodega_id) === warehouseFilter) && `${row.producto.codigo} ${row.producto.nombre} ${row.bodega.nombre}`.toLowerCase().includes(search.toLowerCase()));
  const alerts = stockRows.filter(row => row.stock <= Number(row.producto.stock_minimo || 0));
  const totalValue = stockRows.reduce((sum, row) => sum + Math.max(0, row.valor), 0);

  const createWarehouse = async event => {
    event.preventDefault(); if (!canConfigure) return setMessage('Tu perfil no puede configurar bodegas.');
    const center = centros.find(c => String(c.id) === String(bodegaForm.centro_gestion_id));
    const obra = obras.find(o => String(o.centro_gestion_id) === String(center?.id));
    if (!center) return setMessage('Selecciona un centro de gestión.');
    const { error } = await supabase.from('bodega_bodegas').insert({ empresa, ...bodegaForm, centro_gestion_id: Number(center.id), obra_nombre: obra?.nombre || null, codigo: bodegaForm.codigo.trim().toUpperCase(), nombre: bodegaForm.nombre.trim() });
    if (error) return setMessage(`No se pudo crear la bodega: ${error.message}`);
    setBodegaForm({ codigo: '', nombre: '', centro_gestion_id: '', tipo: 'Central', responsable: '', ubicacion: '' }); setMessage('Bodega creada y vinculada al centro de gestión.'); await load();
  };
  const createProduct = async event => {
    event.preventDefault(); if (!canConfigure) return setMessage('Tu perfil no puede crear productos.');
    const { error } = await supabase.from('bodega_productos').insert({ empresa, ...productoForm, codigo: productoForm.codigo.trim().toUpperCase(), nombre: productoForm.nombre.trim(), stock_minimo: Number(productoForm.stock_minimo), costo_referencia: Number(productoForm.costo_referencia) });
    if (error) return setMessage(`No se pudo crear el producto: ${error.message}`);
    setProductoForm({ codigo: '', nombre: '', categoria: 'Material', unidad: 'UN', stock_minimo: 0, costo_referencia: 0 }); setMessage('Producto incorporado al maestro.'); await load();
  };
  const registerMovement = async event => {
    event.preventDefault(); if (!canCreate) return setMessage('Tu perfil no puede registrar movimientos.');
    const product = productos.find(p => String(p.id) === String(movForm.producto_id));
    const warehouse = bodegas.find(b => String(b.id) === String(movForm.bodega_id));
    let dteId = movForm.dte_documento_id || null;
    if (movForm.tipo === 'Salida' && movForm.generar_guia && !dteId) {
      const unitCost = Number(movForm.costo_unitario || product?.costo_referencia || 0); const net = Number(movForm.cantidad) * unitCost;
      const { data: guide, error: guideError } = await supabase.from('dte_documentos_operacion').insert({ empresa, direccion: 'Emitido', tipo_dte: 52, tipo_nombre: 'Guía de despacho electrónica', fecha_emision: new Date().toISOString().slice(0,10), rut_contraparte: '', razon_social_contraparte: movForm.contraparte || 'Destinatario por completar', monto_neto: net, monto_exento: net, tasa_iva: 0, monto_iva: 0, monto_total: net, centro_gestion_id: warehouse?.centro_gestion_id || null, obra_nombre: warehouse?.obra_nombre || null, estado: 'Borrador', observaciones: movForm.observaciones || null, creado_por: user?.nombre || user?.correo }).select().single();
      if (guideError) return setMessage(`No se pudo crear la guía de despacho: ${guideError.message}`);
      dteId = guide.id;
      const { error: itemError } = await supabase.from('dte_documento_items').insert({ documento_id: dteId, linea: 1, codigo: product?.codigo, descripcion: product?.nombre, cantidad: Number(movForm.cantidad), unidad: product?.unidad || 'UN', precio_unitario: unitCost, descuento: 0, exento: true, total_linea: net });
      if (itemError) return setMessage(`La guía se creó, pero no fue posible agregar su detalle: ${itemError.message}`);
    }
    const payload = { empresa, ...movForm, dte_documento_id: dteId, tipo_documento: dteId ? 'Guía de despacho electrónica' : null, generar_guia: undefined, bodega_id: Number(movForm.bodega_id), producto_id: Number(movForm.producto_id), cantidad: Number(movForm.cantidad), costo_unitario: Number(movForm.costo_unitario || product?.costo_referencia || 0), centro_gestion_id: warehouse?.centro_gestion_id || null, obra_nombre: warehouse?.obra_nombre || null, responsable: user?.nombre || user?.usuario || user?.correo || 'Usuario Obraxis' };
    delete payload.generar_guia;
    const { error } = await supabase.from('bodega_movimientos').insert(payload);
    if (error) return setMessage(`No se pudo registrar el movimiento: ${error.message}`);
    setMovForm({ bodega_id: '', producto_id: '', tipo: 'Entrada', cantidad: '', costo_unitario: '', documento: '', contraparte: '', observaciones: '', dte_documento_id: '', generar_guia: false }); setMessage(dteId ? 'Movimiento y guía de despacho vinculados correctamente.' : 'Movimiento registrado con trazabilidad.'); await load();
  };

  const useGuide = guide => { const expectedType = guide.direccion === 'Recibido' ? 'Entrada' : 'Salida'; setMovForm(prev => ({ ...prev, tipo: expectedType, dte_documento_id: guide.id, documento: `Guía N° ${guide.folio || 'borrador'}`, contraparte: guide.razon_social_contraparte || '', costo_unitario: prev.costo_unitario })); setTab('movimientos'); setMessage('Guía seleccionada. Completa el producto y la cantidad física recibida o despachada.'); };
  const transfer = async event => {
    event.preventDefault(); if (!canEdit) return setMessage('Tu perfil no puede transferir stock.');
    if (transferForm.origen === transferForm.destino) return setMessage('Selecciona bodegas diferentes.');
    const amount = Number(transferForm.cantidad); const available = stockMap.get(`${transferForm.origen}:${transferForm.producto_id}`) || 0;
    if (amount <= 0 || amount > available) return setMessage(`Stock insuficiente. Disponible: ${qty(available)}.`);
    const product = productos.find(p => String(p.id) === String(transferForm.producto_id));
    const transferId = crypto.randomUUID(); const common = { empresa, producto_id: Number(transferForm.producto_id), cantidad: amount, costo_unitario: Number(product?.costo_referencia || 0), transferencia_id: transferId, responsable: user?.nombre || user?.usuario || 'Usuario Obraxis', observaciones: transferForm.observaciones };
    const { error } = await supabase.from('bodega_movimientos').insert([{ ...common, bodega_id: Number(transferForm.origen), tipo: 'Transferencia salida' }, { ...common, bodega_id: Number(transferForm.destino), tipo: 'Transferencia entrada' }]);
    if (error) return setMessage(`No se pudo completar la transferencia: ${error.message}`);
    setTransferForm({ origen: '', destino: '', producto_id: '', cantidad: '', observaciones: '' }); setMessage('Transferencia completada entre bodegas.'); await load();
  };

  if (permissionsLoading || loading) return <div className="p-10 text-center text-sm font-bold text-slate-500">Cargando bodega empresarial…</div>;
  if (!canView) return <div className="rounded-2xl border bg-white p-8 text-center text-sm font-bold text-slate-600">Tu perfil no tiene acceso a Bodega.</div>;
  const tabs = [{ id: 'stock', label: 'Stock', icon: Boxes }, { id: 'movimientos', label: 'Movimientos', icon: PackagePlus }, { id: 'guias', label: 'Guías de despacho', icon: FileText }, { id: 'transferencias', label: 'Transferencias', icon: ArrowRightLeft }, ...(canViewStatistics ? [{ id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 }] : []), { id: 'maestros', label: 'Configuración', icon: Warehouse }];
  return <div className="space-y-5">
    <ModuleHeader title="Bodega e Inventario" subtitle="Stock empresarial, movimientos y transferencias asociados a centros de gestión." Icon={Boxes} onBack={onBack} />
    {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-900">{message}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi icon={Warehouse} label="Bodegas activas" value={bodegas.filter(x => x.activo).length} /><Kpi icon={PackageCheck} label="Productos" value={productos.filter(x => x.activo).length} /><Kpi icon={AlertTriangle} label="Bajo mínimo" value={alerts.length} danger={alerts.length > 0} /><Kpi icon={History} label="Stock valorizado" value={money(totalValue)} /></div>
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">{tabs.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${tab === item.id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><item.icon className="h-4 w-4" />{item.label}</button>)}</div>
    {tab === 'stock' && <section className="space-y-3"><div className="grid gap-2 md:grid-cols-[1fr_260px]"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar código, producto o bodega" className={`${field} pl-9`}/></label><select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)} className={field}><option value="">Todas las bodegas</option>{bodegas.map(b => <option key={b.id} value={b.id}>{b.codigo} · {b.nombre}</option>)}</select></div><StockTable rows={filteredStock}/></section>}
    {tab === 'movimientos' && <div className="grid gap-4 xl:grid-cols-[380px_1fr]"><form onSubmit={registerMovement} className="space-y-3 rounded-2xl border bg-white p-5"><h3 className="font-black">Registrar movimiento</h3><select required value={movForm.bodega_id} onChange={e => setMovForm({...movForm,bodega_id:e.target.value})} className={field}><option value="">Bodega</option>{bodegas.filter(x=>x.activo).map(b=><option key={b.id} value={b.id}>{b.codigo} · {b.nombre}</option>)}</select><select required value={movForm.producto_id} onChange={e => setMovForm({...movForm,producto_id:e.target.value})} className={field}><option value="">Producto</option>{productos.filter(x=>x.activo).map(p=><option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select><select value={movForm.tipo} onChange={e=>setMovForm({...movForm,tipo:e.target.value,dte_documento_id:'',generar_guia:false})} className={field}>{['Entrada','Salida','Ajuste +','Ajuste -'].map(x=><option key={x}>{x}</option>)}</select><div className="grid grid-cols-2 gap-2"><input required type="number" min="0.0001" step="any" placeholder="Cantidad" value={movForm.cantidad} onChange={e=>setMovForm({...movForm,cantidad:e.target.value})} className={field}/><input type="number" min="0" step="any" placeholder="Costo unitario" value={movForm.costo_unitario} onChange={e=>setMovForm({...movForm,costo_unitario:e.target.value})} className={field}/></div>{['Entrada','Salida'].includes(movForm.tipo)&&<select value={movForm.dte_documento_id} onChange={e=>{const guide=guias.find(g=>g.id===e.target.value);setMovForm({...movForm,dte_documento_id:e.target.value,documento:guide?`Guía N° ${guide.folio||'borrador'}`:'',contraparte:guide?.razon_social_contraparte||movForm.contraparte})}} className={field}><option value="">Sin guía vinculada</option>{guias.filter(g=>(movForm.tipo==='Entrada'?g.direccion==='Recibido':g.direccion==='Emitido')).map(g=><option key={g.id} value={g.id}>Guía {g.folio||'borrador'} · {g.razon_social_contraparte||'Sin contraparte'}</option>)}</select>}{movForm.tipo==='Salida'&&!movForm.dte_documento_id&&<label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-900"><input type="checkbox" checked={movForm.generar_guia} onChange={e=>setMovForm({...movForm,generar_guia:e.target.checked})}/>Crear borrador de guía DTE 52</label>}<input placeholder="Guía, factura u OC" value={movForm.documento} onChange={e=>setMovForm({...movForm,documento:e.target.value})} className={field}/><input placeholder="Proveedor / destinatario" value={movForm.contraparte} onChange={e=>setMovForm({...movForm,contraparte:e.target.value})} className={field}/><textarea placeholder="Observaciones" value={movForm.observaciones} onChange={e=>setMovForm({...movForm,observaciones:e.target.value})} className={field}/><button className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-black text-white"><Save className="h-4 w-4"/>Registrar</button></form><MovementTable rows={movimientos} bodegas={bodegas} productos={productos}/></div>}
    {tab === 'guias' && <section className="rounded-2xl border bg-white p-5"><div className="mb-4"><h3 className="font-black">Guías de despacho conectadas con Facturación</h3><p className="text-xs text-slate-500">Las recibidas respaldan entradas; las emitidas respaldan salidas. Un mismo DTE puede enlazarse con sus movimientos físicos.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Guía</th><th className="p-3">Flujo</th><th className="p-3">Contraparte</th><th className="p-3">Centro / obra</th><th className="p-3">Estado</th><th className="p-3">Bodega</th></tr></thead><tbody className="divide-y">{guias.map(g=>{const linked=movimientos.filter(m=>m.dte_documento_id===g.id);return <tr key={g.id}><td className="p-3 font-black">N° {g.folio||'Borrador'}<p className="font-normal text-slate-500">{g.fecha_emision}</p></td><td className="p-3">{g.direccion}</td><td className="p-3">{g.razon_social_contraparte||'—'}</td><td className="p-3">{g.obra_nombre||'Corporativo'}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{g.estado}</span></td><td className="p-3">{linked.length?<span className="font-bold text-emerald-700">{linked.length} movimiento(s)</span>:<button onClick={()=>useGuide(g)} className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1.5 text-[10px] font-black text-blue-800"><Link2 className="h-3 w-3"/>Usar en movimiento</button>}</td></tr>})}</tbody></table>{!guias.length&&<p className="p-8 text-center text-xs text-slate-500">No existen guías DTE 52 en Facturación.</p>}</div></section>}
    {tab === 'transferencias' && <form onSubmit={transfer} className="mx-auto grid max-w-4xl gap-3 rounded-2xl border bg-white p-6 md:grid-cols-2"><h3 className="md:col-span-2 text-base font-black">Transferencia entre bodegas</h3><select required value={transferForm.origen} onChange={e=>setTransferForm({...transferForm,origen:e.target.value})} className={field}><option value="">Bodega de origen</option>{bodegas.map(b=><option key={b.id} value={b.id}>{b.codigo} · {b.nombre}</option>)}</select><select required value={transferForm.destino} onChange={e=>setTransferForm({...transferForm,destino:e.target.value})} className={field}><option value="">Bodega de destino</option>{bodegas.map(b=><option key={b.id} value={b.id}>{b.codigo} · {b.nombre}</option>)}</select><select required value={transferForm.producto_id} onChange={e=>setTransferForm({...transferForm,producto_id:e.target.value})} className={field}><option value="">Producto</option>{productos.map(p=><option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select><input required type="number" min="0.0001" step="any" placeholder="Cantidad" value={transferForm.cantidad} onChange={e=>setTransferForm({...transferForm,cantidad:e.target.value})} className={field}/><textarea placeholder="Motivo o referencia" value={transferForm.observaciones} onChange={e=>setTransferForm({...transferForm,observaciones:e.target.value})} className={`${field} md:col-span-2`}/><button className="flex items-center justify-center gap-2 rounded-xl bg-blue-800 py-3 text-xs font-black text-white md:col-span-2"><ArrowRightLeft className="h-4 w-4"/>Transferir stock</button></form>}
    {tab === 'maestros' && <div className="grid gap-4 xl:grid-cols-2"><form onSubmit={createWarehouse} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-2"><h3 className="md:col-span-2 flex items-center gap-2 font-black"><Building2 className="h-5 w-5"/>Nueva bodega</h3><input required placeholder="Código" value={bodegaForm.codigo} onChange={e=>setBodegaForm({...bodegaForm,codigo:e.target.value})} className={field}/><input required placeholder="Nombre" value={bodegaForm.nombre} onChange={e=>setBodegaForm({...bodegaForm,nombre:e.target.value})} className={field}/><select required value={bodegaForm.centro_gestion_id} onChange={e=>setBodegaForm({...bodegaForm,centro_gestion_id:e.target.value})} className={`${field} md:col-span-2`}><option value="">Centro de gestión asociado</option>{centros.map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}</select><select value={bodegaForm.tipo} onChange={e=>setBodegaForm({...bodegaForm,tipo:e.target.value})} className={field}><option>Central</option><option>Obra</option><option>Temporal</option></select><input placeholder="Responsable" value={bodegaForm.responsable} onChange={e=>setBodegaForm({...bodegaForm,responsable:e.target.value})} className={field}/><input placeholder="Ubicación" value={bodegaForm.ubicacion} onChange={e=>setBodegaForm({...bodegaForm,ubicacion:e.target.value})} className={`${field} md:col-span-2`}/><button className="rounded-xl bg-slate-950 py-3 text-xs font-black text-white md:col-span-2">Crear bodega</button></form><form onSubmit={createProduct} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-2"><h3 className="md:col-span-2 flex items-center gap-2 font-black"><Plus className="h-5 w-5"/>Nuevo producto</h3><input required placeholder="SKU / código" value={productoForm.codigo} onChange={e=>setProductoForm({...productoForm,codigo:e.target.value})} className={field}/><input required placeholder="Nombre" value={productoForm.nombre} onChange={e=>setProductoForm({...productoForm,nombre:e.target.value})} className={field}/><input placeholder="Categoría" value={productoForm.categoria} onChange={e=>setProductoForm({...productoForm,categoria:e.target.value})} className={field}/><input required placeholder="Unidad (UN, KG, M3…)" value={productoForm.unidad} onChange={e=>setProductoForm({...productoForm,unidad:e.target.value})} className={field}/><input type="number" min="0" step="any" placeholder="Stock mínimo" value={productoForm.stock_minimo} onChange={e=>setProductoForm({...productoForm,stock_minimo:e.target.value})} className={field}/><input type="number" min="0" step="any" placeholder="Costo referencia" value={productoForm.costo_referencia} onChange={e=>setProductoForm({...productoForm,costo_referencia:e.target.value})} className={field}/><button className="rounded-xl bg-slate-950 py-3 text-xs font-black text-white md:col-span-2">Crear producto</button></form></div>}
    {tab === 'estadisticas' && <WarehouseStatistics stockRows={stockRows} movimientos={movimientos} bodegas={bodegas} productos={productos} guias={guias} />}
  </div>;
}

function Kpi({ icon: Icon, label, value, danger }) { return <div className={`rounded-2xl border bg-white p-4 ${danger ? 'border-amber-300' : 'border-slate-200'}`}><Icon className={`h-5 w-5 ${danger ? 'text-amber-600' : 'text-primary'}`}/><p className="mt-3 text-[10px] font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div>; }
function StockTable({ rows }) { return <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Producto</th><th className="p-3">Bodega / centro</th><th className="p-3">Stock</th><th className="p-3">Mínimo</th><th className="p-3">Valor</th><th className="p-3">Estado</th></tr></thead><tbody className="divide-y">{rows.map(r=><tr key={`${r.bodega_id}-${r.producto_id}`}><td className="p-3 font-bold">{r.producto.codigo} · {r.producto.nombre}<p className="text-[10px] font-normal text-slate-500">{r.producto.categoria}</p></td><td className="p-3">{r.bodega.nombre}<p className="text-[10px] text-slate-500">{r.bodega.obra_nombre || r.bodega.tipo}</p></td><td className="p-3 font-mono font-black">{qty(r.stock)} {r.producto.unidad}</td><td className="p-3 font-mono">{qty(r.producto.stock_minimo)}</td><td className="p-3 font-mono">{money(Math.max(0,r.valor))}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${r.stock <= Number(r.producto.stock_minimo) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{r.stock <= Number(r.producto.stock_minimo) ? 'Reponer' : 'Disponible'}</span></td></tr>)}</tbody></table>{!rows.length&&<p className="p-8 text-center text-xs text-slate-500">Sin stock para los filtros seleccionados.</p>}</div>; }
function MovementTable({ rows, bodegas, productos }) { const bMap=new Map(bodegas.map(x=>[x.id,x])); const pMap=new Map(productos.map(x=>[x.id,x])); return <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Movimiento</th><th className="p-3">Producto</th><th className="p-3">Bodega</th><th className="p-3">Cantidad</th><th className="p-3">Documento</th><th className="p-3">Responsable</th></tr></thead><tbody className="divide-y">{rows.map(m=><tr key={m.id}><td className="p-3">{new Date(m.fecha).toLocaleString('es-CL')}</td><td className="p-3 font-bold">{m.tipo}</td><td className="p-3">{pMap.get(m.producto_id)?.nombre || 'Producto'}</td><td className="p-3">{bMap.get(m.bodega_id)?.nombre || 'Bodega'}</td><td className={`p-3 font-mono font-black ${positiveTypes.has(m.tipo)?'text-emerald-700':'text-rose-700'}`}>{positiveTypes.has(m.tipo)?'+':'-'}{qty(m.cantidad)}</td><td className="p-3">{m.documento || '—'}</td><td className="p-3">{m.responsable || '—'}</td></tr>)}</tbody></table>{!rows.length&&<p className="p-8 text-center text-xs text-slate-500">Aún no hay movimientos.</p>}</div>; }
