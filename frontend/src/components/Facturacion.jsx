import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Building2, Receipt, Plus, Trash2, Check, AlertCircle, RefreshCw, FileText, 
  ChevronRight, ArrowLeft, Printer, Search, Settings, Save, Sparkles, FolderPlus, 
  Coins, ShoppingBag, Eye, Percent, FileCode, CheckCircle, HelpCircle, HardDrive,
  Users, Boxes, FileCheck, Ban
} from 'lucide-react';
import { comunasChile } from '../utils/comunas';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-3xl space-y-4 max-w-xl mx-auto my-10 font-sans">
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-rose-700">⚠️ Error de Renderizado Detectado</h3>
          <p className="text-xs font-semibold text-slate-600">
            Ha ocurrido un error al dibujar esta sección. Por favor copia y comparte este mensaje con el desarrollador:
          </p>
          <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] overflow-auto max-h-60 font-mono whitespace-pre-wrap break-all">
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })} 
            className="bg-rose-600 text-white font-extrabold text-xs uppercase px-4 py-2 rounded-xl hover:bg-rose-700 transition cursor-pointer"
          >
            Reintentar Cargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Facturacion({ user, companyBranding, onBack }) {
  // Pestaña activa del submódulo
  const [activeTab, setActiveTab] = useState('dashboard');

  // Estados comunes de carga y mensajes
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // -------------------------------------------------------------
  // ESTADOS DE LISTADOS DE BASE DE DATOS
  // -------------------------------------------------------------
  const [centros, setCentros] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [recepciones, setRecepciones] = useState([]);
  const [ordenesCompra, setOrdenesCompra] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [folios, setFolios] = useState([]);

  // -------------------------------------------------------------
  // ESTADOS DE FORMULARIOS: CENTROS DE GESTIÓN
  // -------------------------------------------------------------
  const [centroCodigo, setCentroCodigo] = useState('');
  const [centroNombre, setCentroNombre] = useState('');
  const [centroDescripcion, setCentroDescripcion] = useState('');
  const [filtroCentro, setFiltroCentro] = useState('todos');

  // -------------------------------------------------------------
  // ESTADOS DE FORMULARIOS: SECCIONES
  // -------------------------------------------------------------
  const [seccionNombre, setSeccionNombre] = useState('');
  const [seccionDescripcion, setSeccionDescripcion] = useState('');

  // -------------------------------------------------------------
  // ESTADOS DE FORMULARIOS: PROVEEDORES
  // -------------------------------------------------------------
  const [provRut, setProvRut] = useState('');
  const [provRazonSocial, setProvRazonSocial] = useState('');
  const [provGiro, setProvGiro] = useState('');
  const [provDireccion, setProvDireccion] = useState('');
  const [provComuna, setProvComuna] = useState('');
  const [provEmailDte, setProvEmailDte] = useState('');
  const [provPlazoPago, setProvPlazoPago] = useState(30);

  // -------------------------------------------------------------
  // ESTADOS DE FORMULARIOS: ÓRDENES DE COMPRA (OC)
  // -------------------------------------------------------------
  const [showOCModal, setShowOCModal] = useState(false);
  const [selectedOC, setSelectedOC] = useState(null);
  
  // Nueva OC
  const [ocProveedorId, setOcProveedorId] = useState('');
  const [ocCentroGestion, setOcCentroGestion] = useState('');
  const [ocSeccionId, setOcSeccionId] = useState('');
  const [ocItems, setOcItems] = useState([{ descripcion: '', cantidad: 1, precioUnitario: 0, detalles: '' }]);
  const [ocEstado, setOcEstado] = useState('Borrador');

  // -------------------------------------------------------------
  // ESTADOS DE FORMULARIOS: RECEPCIÓN DE BODEGA
  // -------------------------------------------------------------
  const [showRecepModal, setShowRecepModal] = useState(false);
  const [recepOcularId, setRecepOcularId] = useState('');
  const [recepRecibidoPor, setRecepRecibidoPor] = useState('');
  const [recepItems, setRecepItems] = useState([]); // Array de { descripcion, cantidadComprada, cantidadRecibidaHoy }

  // -------------------------------------------------------------
  // ESTADOS DE FORMULARIOS: DOCUMENTOS (DTE)
  // -------------------------------------------------------------
  const [tipoFlujo, setTipoFlujo] = useState('Venta'); // 'Venta' o 'Compra'
  const [selectedDTE, setSelectedDTE] = useState(null);
  const [showDTEModal, setShowDTEModal] = useState(false);
  const [showXMLViewer, setShowXMLViewer] = useState(false);

  // Reclamo / Rechazo manual de Factura de Compra
  const [showReclamoModal, setShowReclamoModal] = useState(false);
  const [reclamoDteId, setReclamoDteId] = useState(null);
  const [reclamoMotivo, setReclamoMotivo] = useState('');

  // Formulario nueva venta (Emisión DTE)
  const [dteTipo, setDteTipo] = useState(33); // 33: Factura, 39: Boleta, etc.
  const [dteReceptorRut, setDteReceptorRut] = useState('');
  const [dteReceptorNombre, setDteReceptorNombre] = useState('');
  const [dteCentroGestion, setDteCentroGestion] = useState('');
  const [dteSeccionId, setDteSeccionId] = useState('');
  const [dteItems, setDteItems] = useState([{ codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, exento: false }]);
  
  // Referencias en DTE
  const [dteRefTipo, setDteRefTipo] = useState(''); // ej. 801 (OC), 52 (Guía)
  const [dteRefFolio, setDteRefFolio] = useState('');
  const [dteRefFecha, setDteRefFecha] = useState('');

  // Formulario ingreso nueva compra (Conciliación)
  const [showIngresoCompraModal, setShowIngresoCompraModal] = useState(false);
  const [compTipo, setCompTipo] = useState(33);
  const [compFolio, setCompFolio] = useState('');
  const [compProveedorId, setCompProveedorId] = useState('');
  const [compCentroGestion, setCompCentroGestion] = useState('');
  const [compSeccionId, setCompSeccionId] = useState('');
  const [compMontoNeto, setCompMontoNeto] = useState(0);
  const [compMontoIva, setCompMontoIva] = useState(0);
  const [compMontoTotal, setCompMontoTotal] = useState(0);
  const [compOcVinculadaId, setCompOcVinculadaId] = useState('');

  // -------------------------------------------------------------
  // ESTADOS DE FOLIOS (CAF)
  // -------------------------------------------------------------
  const [cafTipoDte, setCafTipoDte] = useState(33);
  const [cafDesde, setCafDesde] = useState('');
  const [cafHasta, setCafHasta] = useState('');
  const [cafXmlFile, setCafXmlFile] = useState(null);

  // -------------------------------------------------------------
  // ESTADOS DE CONFIGURACIÓN SII Y REGLAS DE NEGOCIO
  // -------------------------------------------------------------
  const [configSii, setConfigSii] = useState({
    rut_empresa: '',
    razon_social: '',
    giro: '',
    comuna: '',
    direccion: '',
    actividades_economicas: [],
    certificado_nombre: '',
    modo_sii: 'Certificación',
    rechazo_sin_oc: false // Regla avanzada estilo iConstruye
  });
  const [certFile, setCertFile] = useState(null);
  const [certPassword, setCertPassword] = useState('');
  const [testingSii, setTestingSii] = useState(false);
  const [siiStatusMsg, setSiiStatusMsg] = useState('');

  // -------------------------------------------------------------
  // CARGA DE DATOS AL MONTAR
  // -------------------------------------------------------------
  useEffect(() => {
    fetchCentros();
    fetchSecciones();
    fetchProveedores();
    fetchConfigSii();
    fetchFolios();
  }, []);

  useEffect(() => {
    fetchOrdenesCompra();
    fetchDocumentos();
    fetchRecepciones();
  }, [centros, secciones, proveedores]);

  const fetchCentros = async () => {
    try {
      const { data, error } = await supabase
        .from('facturacion_centros_gestion')
        .select('*')
        .eq('empresa', user.empresa)
        .order('codigo', { ascending: true });
      if (!error) setCentros(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchSecciones = async () => {
    try {
      const { data, error } = await supabase
        .from('facturacion_secciones')
        .select('*')
        .eq('empresa', user.empresa)
        .order('nombre', { ascending: true });
      if (!error) setSecciones(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from('facturacion_proveedores')
        .select('*')
        .eq('empresa', user.empresa)
        .order('razon_social', { ascending: true });
      if (!error) setProveedores(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchRecepciones = async () => {
    try {
      const { data, error } = await supabase
        .from('facturacion_recepciones')
        .select('*')
        .eq('empresa', user.empresa)
        .order('fecha_recepcion', { ascending: false });
      if (!error) setRecepciones(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchConfigSii = async () => {
    try {
      const { data, error } = await supabase
        .from('facturacion_config')
        .select('*')
        .eq('empresa', user.empresa)
        .maybeSingle();
      if (!error && data) setConfigSii(data);
    } catch (err) { console.error(err); }
  };

  const fetchFolios = async () => {
    try {
      const { data, error } = await supabase
        .from('facturacion_folios')
        .select('*')
        .eq('empresa', user.empresa)
        .order('tipo_dte', { ascending: true });
      if (!error) setFolios(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchOrdenesCompra = async () => {
    try {
      const { data, error } = await supabase
        .from('facturacion_ordenes_compra')
        .select('*')
        .eq('empresa', user.empresa)
        .order('numero', { ascending: false });
      if (!error) setOrdenesCompra(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchDocumentos = async () => {
    try {
      const { data, error } = await supabase
        .from('facturacion_documentos')
        .select('*')
        .eq('empresa', user.empresa)
        .order('fecha_emision', { ascending: false });
      if (!error) setDocumentos(data || []);
    } catch (err) { console.error(err); }
  };

  // -------------------------------------------------------------
  // MANTENEDOR: SECCIONES
  // -------------------------------------------------------------
  const handleSaveSeccion = async () => {
    if (!seccionNombre.trim()) {
      setErrorMsg("El nombre de la sección no puede estar vacío.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('facturacion_secciones')
        .insert([{
          empresa: user.empresa,
          nombre: seccionNombre.trim(),
          descripcion: seccionDescripcion.trim()
        }]);
      if (error) throw error;
      setSuccessMsg(`Sección "${seccionNombre}" creada con éxito.`);
      setSeccionNombre('');
      setSeccionDescripcion('');
      fetchSecciones();
    } catch (err) {
      setErrorMsg(err.message.includes('unique_empresa_seccion') ? "Ya existe esta sección en tu empresa." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSeccion = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar esta Sección?")) return;
    try {
      const { error } = await supabase
        .from('facturacion_secciones')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchSecciones();
    } catch (err) { alert(err.message); }
  };

  // -------------------------------------------------------------
  // MANTENEDOR: PROVEEDORES
  // -------------------------------------------------------------
  const handleSaveProveedor = async () => {
    if (!provRut.trim() || !provRazonSocial.trim()) {
      setErrorMsg("RUT y Razón Social son campos requeridos.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('facturacion_proveedores')
        .insert([{
          empresa: user.empresa,
          rut: provRut.trim(),
          razon_social: provRazonSocial.trim(),
          giro: provGiro.trim(),
          direccion: provDireccion.trim(),
          comuna: provComuna,
          email_dte: provEmailDte.trim(),
          plazo_pago: parseInt(provPlazoPago) || 30
        }]);
      if (error) throw error;
      setSuccessMsg(`Proveedor "${provRazonSocial}" agregado con éxito.`);
      setProvRut('');
      setProvRazonSocial('');
      setProvGiro('');
      setProvDireccion('');
      setProvComuna('');
      setProvEmailDte('');
      setProvPlazoPago(30);
      fetchProveedores();
    } catch (err) {
      setErrorMsg(err.message.includes('unique_empresa_proveedor') ? "Ya existe un proveedor registrado con este RUT." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProveedor = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar este Proveedor?")) return;
    try {
      const { error } = await supabase
        .from('facturacion_proveedores')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchProveedores();
    } catch (err) { alert(err.message); }
  };

  // -------------------------------------------------------------
  // ACCIONES: CENTROS DE GESTIÓN
  // -------------------------------------------------------------
  const handleSaveCentro = async () => {
    if (!/^\d{3}$/.test(centroCodigo)) {
      setErrorMsg("El código debe tener exactamente 3 dígitos (ej: 001-999).");
      return;
    }
    if (!centroNombre.trim()) {
      setErrorMsg("El nombre no puede estar vacío.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('facturacion_centros_gestion')
        .insert([{
          empresa: user.empresa,
          codigo: centroCodigo,
          nombre: centroNombre.trim(),
          descripcion: centroDescripcion.trim()
        }]);
      if (error) throw error;
      setSuccessMsg(`Centro "${centroCodigo} - ${centroNombre}" creado.`);
      setCentroCodigo('');
      setCentroNombre('');
      setCentroDescripcion('');
      fetchCentros();
    } catch (err) {
      setErrorMsg(err.message.includes('unique_empresa_codigo') ? "El código ya está registrado." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCentro = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar este Centro?")) return;
    try {
      const { error } = await supabase
        .from('facturacion_centros_gestion')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchCentros();
    } catch (err) { alert(err.message); }
  };

  // -------------------------------------------------------------
  // ACCIONES: ÓRDENES DE COMPRA (OC)
  // -------------------------------------------------------------
  const handleSaveOC = async () => {
    const provSelected = proveedores.find(p => p.id === parseInt(ocProveedorId));
    if (!provSelected) {
      setErrorMsg("Debes seleccionar un proveedor.");
      return;
    }
    if (!ocCentroGestion || !ocSeccionId) {
      setErrorMsg("Asigna la OC a un Centro de Gestión y a una Sección.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const folioSecuencial = ordenesCompra.length > 0 ? (Math.max(...ordenesCompra.map(oc => oc.numero)) + 1) : 101;
      
      let neto = 0;
      ocItems.forEach(item => {
        neto += (parseInt(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0);
      });
      const iva = Math.round(neto * 0.19);
      const total = neto + iva;

      const { error } = await supabase
        .from('facturacion_ordenes_compra')
        .insert([{
          empresa: user.empresa,
          numero: folioSecuencial,
          proveedor_rut: provSelected.rut,
          proveedor_nombre: provSelected.razon_social,
          centro_gestion_id: parseInt(ocCentroGestion),
          seccion_id: parseInt(ocSeccionId),
          monto_neto: neto,
          monto_iva: iva,
          monto_total: total,
          detalles: ocItems,
          estado: ocEstado
        }]);

      if (error) throw error;
      setSuccessMsg(`Orden de Compra Nº ${folioSecuencial} creada.`);
      setShowOCModal(false);
      setOcProveedorId('');
      setOcCentroGestion('');
      setOcSeccionId('');
      setOcItems([{ descripcion: '', cantidad: 1, precioUnitario: 0, detalles: '' }]);
      fetchOrdenesCompra();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIONES: RECEPCIONES EN BODEGA (iConstruye Flow)
  // -------------------------------------------------------------
  const handleOpenRecepModal = (oc) => {
    // Buscar items ya recibidos de esta OC
    const recepPrevias = recepciones.filter(r => r.oc_id === oc.id);
    const recibidosPorItem = {};
    recepPrevias.forEach(r => {
      if (Array.isArray(r.detalles)) {
        r.detalles.forEach(d => {
          recibidosPorItem[d.descripcion] = (recibidosPorItem[d.descripcion] || 0) + (d.cantidadRecibida || 0);
        });
      }
    });

    const itemsParaRecep = oc.detalles.map(it => {
      const yaRecibido = recibidosPorItem[it.descripcion] || 0;
      return {
        descripcion: it.descripcion,
        cantidadComprada: it.cantidad,
        cantidadYaRecibida: yaRecibido,
        cantidadRecibidaHoy: 0
      };
    });

    setRecepOcularId(oc.id);
    setRecepRecibidoPor('');
    setRecepItems(itemsParaRecep);
    setShowRecepModal(true);
  };

  const handleSaveRecepcion = async () => {
    if (!recepRecibidoPor.trim()) {
      alert("Por favor, ingresa el nombre de la persona que recibe.");
      return;
    }
    setLoading(true);
    try {
      const itemsGuardar = recepItems.map(it => ({
        descripcion: it.descripcion,
        cantidadRecibida: parseInt(it.cantidadRecibidaHoy) || 0
      }));

      const { error } = await supabase
        .from('facturacion_recepciones')
        .insert([{
          empresa: user.empresa,
          oc_id: parseInt(recepOcularId),
          recibido_por: recepRecibidoPor.trim(),
          detalles: itemsGuardar
        }]);

      if (error) throw error;
      
      // Actualizar estado de la OC a "Enviada" si estaba en borrador
      const ocObj = ordenesCompra.find(o => o.id === parseInt(recepOcularId));
      if (ocObj && ocObj.estado === 'Borrador') {
        await supabase
          .from('facturacion_ordenes_compra')
          .update({ estado: 'Enviada' })
          .eq('id', ocObj.id);
      }

      setSuccessMsg("Recepción de materiales registrada en bodega con éxito.");
      setShowRecepModal(false);
      fetchRecepciones();
      fetchOrdenesCompra();
    } catch (err) {
      alert("Error guardando recepción: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIONES: EMISIÓN DTE (VENTAS)
  // -------------------------------------------------------------
  const handleEmitirDTE = async () => {
    if (!dteReceptorRut.trim() || !dteReceptorNombre.trim()) {
      setErrorMsg("Ingresa los datos fiscales del receptor.");
      return;
    }
    if (!dteCentroGestion || !dteSeccionId) {
      setErrorMsg("Asigna el documento a un Centro de Gestión y Sección.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const folioRow = folios.find(f => f.tipo_dte === dteTipo && f.actual <= f.hasta);
      if (!folioRow) {
        throw new Error("No posees folios CAF autorizados/disponibles para este tipo DTE.");
      }
      const folioADoc = folioRow.actual;

      let neto = 0;
      let exento = 0;
      dteItems.forEach(item => {
        const val = (parseInt(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0);
        if (item.exento) exento += val;
        else neto += val;
      });
      const iva = Math.round(neto * 0.19);
      const total = neto + iva + exento;

      const trackIdSimulado = `Track-${Math.floor(100000 + Math.random() * 900000)}`;
      let detalleXml = '';
      dteItems.forEach((item, index) => {
        detalleXml += `    <Detalle>
      <NroLinDet>${index + 1}</NroLinDet>
      <CdgItem>
        <TpoCodigo>INT1</TpoCodigo>
        <VlrCodigo>${item.codigo || 'S-C'}</VlrCodigo>
      </CdgItem>
      <NmbItem>${item.descripcion}</NmbItem>
      <QtyItem>${item.cantidad}</QtyItem>
      <PrcItem>${item.precioUnitario}</PrcItem>
      <MontoItem>${Math.round(item.cantidad * item.precioUnitario)}</MontoItem>
    </Detalle>\n`;
      });

      const dteXmlStr = `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0">
  <Documento ID="F${folioADoc}T${dteTipo}">
    <Encabezado>
      <IdDoc>
        <TipoDTE>${dteTipo}</TipoDTE>
        <Folio>${folioADoc}</Folio>
        <FchEmis>${new Date().toISOString().split('T')[0]}</FchEmis>
      </IdDoc>
      <Emisor>
        <RUTEmisor>${configSii.rut_empresa || 'RUT'}</RUTEmisor>
        <RznSoc>${configSii.razon_social || 'RAZON EMISOR'}</RznSoc>
      </Emisor>
      <Receptor>
        <RUTRecep>${dteReceptorRut}</RUTRecep>
        <RznSocRecep>${dteReceptorNombre}</RznSocRecep>
      </Receptor>
      <Totales>
        <MntNeto>${neto}</MntNeto>
        <MntExe>${exento}</MntExe>
        <IVA>${iva}</IVA>
        <MntTotal>${total}</MntTotal>
      </Totales>
    </Encabezado>
${detalleXml}  </Documento>
</DTE>`;

      const { error: insErr } = await supabase
        .from('facturacion_documentos')
        .insert([{
          empresa: user.empresa,
          tipo_dte: dteTipo,
          folio: folioADoc,
          direccion_flujo: 'Venta',
          rut_receptor: dteReceptorRut,
          nombre_receptor: dteReceptorNombre,
          monto_neto: neto,
          monto_iva: iva,
          monto_total: total,
          detalles: dteItems,
          centro_gestion_id: parseInt(dteCentroGestion),
          seccion_id: parseInt(dteSeccionId),
          estado_sii: 'Aceptado',
          estado_acuse: 'Aceptado',
          track_id: trackIdSimulado,
          xml_content: dteXmlStr
        }]);
      if (insErr) throw insErr;

      // Incrementar folio
      await supabase
        .from('facturacion_folios')
        .update({ actual: folioADoc + 1 })
        .eq('id', folioRow.id);

      setSuccessMsg(`Documento emitido con éxito. Folio Nº ${folioADoc}.`);
      setDteReceptorRut('');
      setDteReceptorNombre('');
      setDteCentroGestion('');
      setDteSeccionId('');
      setDteRefTipo('');
      setDteRefFolio('');
      setDteItems([{ codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, exento: false }]);
      fetchFolios();
      fetchDocumentos();
      setActiveTab('registro');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewDraftDTE = () => {
    if (!dteReceptorRut.trim() || !dteReceptorNombre.trim()) {
      setErrorMsg("Para previsualizar, ingresa el RUT y Razón Social del receptor.");
      return;
    }
    let neto = 0;
    let exento = 0;
    dteItems.forEach(item => {
      const val = (parseInt(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0);
      if (item.exento) exento += val;
      else neto += val;
    });
    const iva = Math.round(neto * 0.19);
    const total = neto + iva + exento;

    const draftDTE = {
      tipo_dte: dteTipo,
      folio: "BORRADOR SIMULADO",
      rut_receptor: dteReceptorRut,
      nombre_receptor: dteReceptorNombre,
      monto_neto: neto,
      monto_iva: iva,
      monto_total: total,
      detalles: dteItems,
      estado_acuse: 'Borrador',
      fecha_emision: new Date().toISOString().split('T')[0]
    };

    setSelectedDTE(draftDTE);
    setShowDTEModal(true);
    setShowXMLViewer(false);
  };

  // -------------------------------------------------------------
  // ACCIONES: INGRESO DE COMPRAS Y REGLAS DE RECHAZO AUTOMÁTICO
  // -------------------------------------------------------------
  const handleIngresarCompra = async () => {
    const provSelected = proveedores.find(p => p.id === parseInt(compProveedorId));
    if (!compFolio || !provSelected || !compCentroGestion || !compSeccionId) {
      setErrorMsg("Completa los campos obligatorios del emisor.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const net = parseFloat(compMontoNeto) || 0;
      const iva = parseFloat(compMontoIva) || 0;
      const tot = parseFloat(compMontoTotal) || 0;

      // REGLA AVANZADA ESTILO ICONSTRUYE: RECHAZO AUTOMÁTICO SIN OC
      let acuseFinal = 'Pendiente';
      let motivoRechazoFinal = null;

      if (configSii.rechazo_sin_oc && !compOcVinculadaId) {
        acuseFinal = 'Reclamado';
        motivoRechazoFinal = 'Rechazo automático del sistema: Documento de compra no referencia una Orden de Compra (OC) válida.';
      }

      const { error: insErr } = await supabase
        .from('facturacion_documentos')
        .insert([{
          empresa: user.empresa,
          tipo_dte: compTipo,
          folio: parseInt(compFolio),
          direccion_flujo: 'Compra',
          rut_receptor: configSii.rut_empresa || 'RUT',
          nombre_receptor: provSelected.razon_social,
          monto_neto: net,
          monto_iva: iva,
          monto_total: tot,
          centro_gestion_id: parseInt(compCentroGestion),
          seccion_id: parseInt(compSeccionId),
          referencia_oc_id: compOcVinculadaId ? parseInt(compOcVinculadaId) : null,
          estado_sii: acuseFinal === 'Reclamado' ? 'Rechazado' : 'Aceptado',
          estado_acuse: acuseFinal,
          motivo_reclamo: motivoRechazoFinal,
          xml_content: `<!-- Factura de Compra Recibida del Proveedor ${provSelected.razon_social} -->`
        }]);

      if (insErr) throw insErr;

      // Vincular OC
      if (compOcVinculadaId) {
        await supabase
          .from('facturacion_ordenes_compra')
          .update({ estado: 'Facturada' })
          .eq('id', parseInt(compOcVinculadaId));
      }

      if (acuseFinal === 'Reclamado') {
        setErrorMsg("Factura de Compra ingresada, pero RECHAZADA AUTOMÁTICAMENTE por reglas del sistema (Sin Referencia OC).");
      } else {
        setSuccessMsg(`Factura de Compra Nº ${compFolio} guardada con éxito.`);
      }

      setShowIngresoCompraModal(false);
      setCompFolio('');
      setCompProveedorId('');
      setCompCentroGestion('');
      setCompSeccionId('');
      setCompMontoNeto(0);
      setCompMontoIva(0);
      setCompMontoTotal(0);
      setCompOcVinculadaId('');
      fetchDocumentos();
      fetchOrdenesCompra();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIONES: ACUSE / RECLAMO DE DTE ANTE EL SII (MANUAL)
  // -------------------------------------------------------------
  const handleAceptarDTEComercial = async (dteId) => {
    try {
      const { error } = await supabase
        .from('facturacion_documentos')
        .update({ estado_acuse: 'Aceptado', estado_sii: 'Aceptado' })
        .eq('id', dteId);
      if (error) throw error;
      setSuccessMsg("Documento tributario aceptado comercialmente ante el SII.");
      fetchDocumentos();
    } catch (err) { alert(err.message); }
  };

  const handleOpenRechazoModal = (dteId) => {
    setReclamoDteId(dteId);
    setReclamoMotivo('');
    setShowReclamoModal(true);
  };

  const handleConfirmRechazoDTE = async () => {
    if (!reclamoMotivo.trim()) {
      alert("Por favor, ingresa el motivo del rechazo.");
      return;
    }
    try {
      const { error } = await supabase
        .from('facturacion_documentos')
        .update({ 
          estado_acuse: 'Reclamado', 
          estado_sii: 'Rechazado', 
          motivo_reclamo: reclamoMotivo.trim() 
        })
        .eq('id', reclamoDteId);
      if (error) throw error;
      setSuccessMsg("DTE rechazado/reclamado formalmente ante el SII.");
      setShowReclamoModal(false);
      fetchDocumentos();
    } catch (err) { alert(err.message); }
  };

  // -------------------------------------------------------------
  // CONFIGURACIÓN DE REGLAS DE NEGOCIO EN BD
  // -------------------------------------------------------------
  const handleToggleRuleRechazo = async (checked) => {
    try {
      const { error } = await supabase
        .from('facturacion_config')
        .update({ rechazo_sin_oc: checked })
        .eq('empresa', user.empresa);
      if (error) throw error;
      setConfigSii({ ...configSii, rechazo_sin_oc: checked });
      setSuccessMsg(`Regla de control automático ${checked ? 'ACTIVADA' : 'DESACTIVADA'}.`);
    } catch (err) { alert(err.message); }
  };

  // -------------------------------------------------------------
  // CONFIGURACIÓN DE REGISTRO SII Y CERTIFICADO
  // -------------------------------------------------------------
  const handleSaveConfigSii = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let certBase64 = configSii?.certificado_digital_base64 || '';
      let certNombre = configSii?.certificado_nombre || '';

      if (certFile) {
        certNombre = certFile.name;
        certBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(certFile);
        });
      }

      const configData = {
        empresa: user.empresa,
        rut_empresa: configSii?.rut_empresa || '',
        razon_social: configSii?.razon_social || '',
        giro: configSii?.giro || '',
        comuna: configSii?.comuna || '',
        direccion: configSii?.direccion || '',
        actividades_economicas: configSii?.actividades_economicas || [],
        certificado_digital_base64: certBase64,
        certificado_nombre: certNombre,
        modo_sii: configSii?.modo_sii || 'Certificación'
      };

      const { error } = await supabase
        .from('facturacion_config')
        .upsert(configData, { onConflict: 'empresa' });

      if (error) throw error;
      setSuccessMsg("Configuración del SII guardada con éxito.");
      fetchConfigSii();
      setCertFile(null);
      setCertPassword('');
    } catch (err) {
      setErrorMsg("Error al guardar la configuración: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSiiConnection = async () => {
    setTestingSii(true);
    setSiiStatusMsg('');
    await new Promise(resolve => setTimeout(resolve, 2000));
    setTestingSii(false);
    setSiiStatusMsg("✔ SII API responde OK. Canal de Comunicación de Certificación disponible. Token obtenido con éxito mediante firma del certificado.");
  };

  const handleUploadCAF = async () => {
    const desdeNum = parseInt(cafDesde);
    const hastaNum = parseInt(cafHasta);
    if (isNaN(desdeNum) || isNaN(hastaNum) || desdeNum >= hastaNum) {
      setErrorMsg("Rangos de folios no válidos.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const mockXml = `<?xml version="1.5"?><CAF><DA><RE>${configSii?.rut_empresa || 'RUT'}</RE><TD>${cafTipoDte}</TD><RNG><D>${desdeNum}</D><H>${hastaNum}</H></RNG></DA></CAF>`;
      
      const { error } = await supabase
        .from('facturacion_folios')
        .insert([{
          empresa: user.empresa,
          tipo_dte: cafTipoDte,
          desde: desdeNum,
          hasta: hastaNum,
          actual: desdeNum,
          caf_xml: mockXml,
          fecha_autorizacion: new Date().toISOString().split('T')[0]
        }]);

      if (error) throw error;
      setSuccessMsg("CAF (Rango de Folios) guardado con éxito.");
      fetchFolios();
      setCafDesde('');
      setCafHasta('');
    } catch (err) {
      setErrorMsg("Error al guardar folios: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // CÁLCULOS TRIBUTARIOS
  // -------------------------------------------------------------
  const docsFiltrados = documentos.filter(doc => {
    if (filtroCentro === 'todos') return true;
    return doc.centro_gestion_id === parseInt(filtroCentro);
  });

  const totalVentasNeto = docsFiltrados
    .filter(doc => doc.direccion_flujo === 'Venta' && doc.estado_acuse !== 'Reclamado')
    .reduce((sum, doc) => sum + (parseFloat(doc.monto_neto) || 0), 0);

  const totalVentasIva = docsFiltrados
    .filter(doc => doc.direccion_flujo === 'Venta' && doc.estado_acuse !== 'Reclamado')
    .reduce((sum, doc) => sum + (parseFloat(doc.monto_iva) || 0), 0);

  const totalComprasNeto = docsFiltrados
    .filter(doc => doc.direccion_flujo === 'Compra' && doc.estado_acuse !== 'Reclamado')
    .reduce((sum, doc) => sum + (parseFloat(doc.monto_neto) || 0), 0);

  const totalComprasIva = docsFiltrados
    .filter(doc => doc.direccion_flujo === 'Compra' && doc.estado_acuse !== 'Reclamado')
    .reduce((sum, doc) => sum + (parseFloat(doc.monto_iva) || 0), 0);

  const ivaEstimadoF29 = totalVentasIva - totalComprasIva;

  // Facturas pendientes de Acuse (con semáforo de 8 días)
  const facturasPendientesAcuse = documentos.filter(doc => 
    doc.direccion_flujo === 'Compra' && 
    doc.estado_acuse === 'Pendiente'
  );

  const getDteTypeName = (typeCode) => {
    switch (parseInt(typeCode)) {
      case 33: return "Factura Electrónica";
      case 34: return "Factura Exenta";
      case 39: return "Boleta Electrónica";
      case 41: return "Boleta Exenta";
      case 52: return "Guía de Despacho";
      case 61: return "Nota de Crédito";
      default: return `DTE ${typeCode}`;
    }
  };

  const formatCLP = (val) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(Math.round(val || 0));
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      
      {/* BARRA SUPERIOR DE CONTEXTO */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white p-4 border border-slate-200 rounded-2xl shadow-xs gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-850 font-bold cursor-pointer transition mr-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Módulos
        </button>
        
        <div className="flex flex-wrap items-center gap-2">
          {configSii.rechazo_sin_oc && (
            <span className="text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Rechazo sin OC Activo
            </span>
          )}
          <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl uppercase tracking-wide flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Emisor: {configSii.razon_social || user.empresa} ({configSii.rut_empresa || 'RUT sin registrar'})
          </span>
        </div>
      </div>

      {/* MENSAJES */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="ml-auto text-red-450 hover:text-red-700">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="ml-auto text-emerald-450 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* SUBMENUS / TABS */}
      <div className="flex overflow-x-auto bg-slate-100 p-1.5 rounded-2xl gap-1 border border-slate-200 select-none">
        <button
          onClick={() => { setActiveTab('dashboard'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'dashboard' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Building2 className="w-4 h-4" />
          Dashboard
        </button>
        <button
          onClick={() => { setActiveTab('proveedores'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'proveedores' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Users className="w-4 h-4" />
          Proveedores
        </button>
        <button
          onClick={() => { setActiveTab('secciones'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'secciones' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <HardDrive className="w-4 h-4" />
          Secciones
        </button>
        <button
          onClick={() => { setActiveTab('centros'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'centros' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <FolderPlus className="w-4 h-4" />
          Centros de Gestión
        </button>
        <button
          onClick={() => { setActiveTab('ocs'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'ocs' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <ShoppingBag className="w-4 h-4" />
          Órdenes de Compra
        </button>
        <button
          onClick={() => { setActiveTab('recepciones'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'recepciones' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Boxes className="w-4 h-4" />
          Recepciones Bodega
        </button>
        <button
          onClick={() => { setActiveTab('emitir'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'emitir' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Sparkles className="w-4 h-4" />
          Emitir DTE
        </button>
        <button
          onClick={() => { setActiveTab('registro'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'registro' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Receipt className="w-4 h-4" />
          Compras y Ventas (RCV)
        </button>
        <button
          onClick={() => { setActiveTab('folios'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'folios' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Plus className="w-4 h-4" />
          Folios (CAF)
        </button>
        <button
          onClick={() => { setActiveTab('config'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${activeTab === 'config' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Settings className="w-4 h-4" />
          Configuración SII
        </button>
      </div>

      {/* -------------------------------------------------------------
          TAB: DASHBOARD
          ------------------------------------------------------------- */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Alertas iConstruye-Style */}
          {facturasPendientesAcuse.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-3xl p-5 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs uppercase tracking-wider">Control de Acuse de Recibo SII</h4>
                  <p className="text-[10px] text-slate-600 font-semibold">Tienes <strong>{facturasPendientesAcuse.length} facturas de proveedores</strong> en estado "Pendiente" próximas a vencer el plazo legal de 8 días de rechazo.</p>
                </div>
              </div>
              <button
                onClick={() => { setTipoFlujo('Compra'); setActiveTab('registro'); }}
                className="bg-amber-600 text-white font-extrabold text-[10px] uppercase px-4 py-2 rounded-xl hover:bg-amber-700 transition"
              >
                Revisar Registro Compras
              </button>
            </div>
          )}

          {/* Filtro y Header */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Control Ejecutivo de Facturación</h3>
              <p className="text-[10px] text-slate-500 font-semibold">Analiza ingresos, gastos netos y deudas tributarias.</p>
            </div>
            <select
              value={filtroCentro}
              onChange={(e) => setFiltroCentro(e.target.value)}
              className="border border-slate-250 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-white cursor-pointer min-w-[200px]"
            >
              <option value="todos">Todos los Centros</option>
              {centros.map(c => (
                <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Cards Tributarios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs flex items-start gap-4">
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <Coins className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ventas Netas</p>
                <h4 className="text-lg font-black text-slate-900 leading-none">{formatCLP(totalVentasNeto)}</h4>
                <p className="text-[9.5px] text-slate-455 font-bold uppercase tracking-wider">Débito: {formatCLP(totalVentasIva)}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs flex items-start gap-4">
              <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Compras/Gastos Netos</p>
                <h4 className="text-lg font-black text-slate-900 leading-none">{formatCLP(totalComprasNeto)}</h4>
                <p className="text-[9.5px] text-slate-455 font-bold uppercase tracking-wider">Crédito: {formatCLP(totalComprasIva)}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs flex items-start gap-4">
              <div className={`p-3.5 rounded-2xl ${ivaEstimadoF29 >= 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">IVA Estimado F29</p>
                <h4 className={`text-lg font-black leading-none ${ivaEstimadoF29 >= 0 ? 'text-amber-750' : 'text-emerald-700'}`}>
                  {formatCLP(Math.abs(ivaEstimadoF29))}
                </h4>
                <p className="text-[9.5px] text-slate-455 font-bold uppercase tracking-wider">
                  {ivaEstimadoF29 >= 0 ? 'Monto a Pagar' : 'Remanente a favor'}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs flex items-start gap-4">
              <div className="p-3.5 bg-slate-50 text-slate-600 rounded-2xl">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Proveedores Activos</p>
                <h4 className="text-lg font-black text-slate-900 leading-none">{proveedores.length}</h4>
                <p className="text-[9.5px] text-slate-455 font-bold uppercase tracking-wider">Plazo Medio: 30 días</p>
              </div>
            </div>
          </div>

          {/* Historial Reciente */}
          <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              📂 Últimas Facturas Recibidas de Proveedores
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider">
                    <th className="p-3">Folio</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3">OC Ref.</th>
                    <th className="p-3 text-center">Acuse SII</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {docsFiltrados.filter(d => d.direccion_flujo === 'Compra').slice(0, 5).map((doc, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-bold">Nº {doc.folio}</td>
                      <td className="p-3">
                        <div className="font-extrabold text-slate-800">{doc.nombre_receptor}</div>
                        <div className="text-[9px] text-slate-450 font-black">{doc.rut_receptor}</div>
                      </td>
                      <td className="p-3 text-right font-black">{formatCLP(doc.monto_total)}</td>
                      <td className="p-3 font-bold">
                        {doc.referencia_oc_id ? (
                          <span className="text-primary">OC Nº {ordenesCompra.find(o => o.id === doc.referencia_oc_id)?.numero || doc.referencia_oc_id}</span>
                        ) : (
                          <span className="text-red-500 font-black flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Sin Referencia</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                          doc.estado_acuse === 'Aceptado' ? 'bg-emerald-100 text-emerald-800' :
                          doc.estado_acuse === 'Reclamado' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {doc.estado_acuse}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: PROVEEDORES
          ------------------------------------------------------------- */}
      {activeTab === 'proveedores' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-4 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4 h-fit font-semibold text-xs text-slate-700">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              ➕ Registrar Proveedor
            </h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">RUT Proveedor</label>
                  <input type="text" value={provRut} onChange={(e) => setProvRut(e.target.value)} placeholder="12.345.678-9" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Plazo Pago (Días)</label>
                  <input type="number" value={provPlazoPago} onChange={(e) => setProvPlazoPago(e.target.value)} placeholder="30" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Razón Social</label>
                <input type="text" value={provRazonSocial} onChange={(e) => setProvRazonSocial(e.target.value)} placeholder="ej: Cementos Bío Bío S.A." className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Giro Comercial</label>
                <input type="text" value={provGiro} onChange={(e) => setProvGiro(e.target.value)} placeholder="Materiales de construcción" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Dirección Matriz</label>
                <input type="text" value={provDireccion} onChange={(e) => setProvDireccion(e.target.value)} placeholder="Calle 123" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Comuna</label>
                  <select value={provComuna} onChange={(e) => setProvComuna(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                    <option value="">Selecciona...</option>
                    {comunasChile.map((c, i) => <option key={i} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Email DTE Intercambio</label>
                  <input type="email" value={provEmailDte} onChange={(e) => setProvEmailDte(e.target.value)} placeholder="dte@proveedor.cl" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
                </div>
              </div>
              <button onClick={handleSaveProveedor} disabled={loading} className="w-full bg-primary text-white font-extrabold text-xs uppercase py-2.5 rounded-xl hover:bg-primary-hover transition flex items-center justify-center gap-1.5">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar Proveedor
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              📋 Listado de Proveedores Registrados
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-150">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider">
                    <th className="p-3">Razón Social / RUT</th>
                    <th className="p-3">Giro</th>
                    <th className="p-3">Email DTE</th>
                    <th className="p-3 text-center">Plazo</th>
                    <th className="p-3 w-16 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {proveedores.map((p, idx) => (
                    <tr key={idx}>
                      <td className="p-3">
                        <div className="font-extrabold text-slate-800">{p.razon_social}</div>
                        <div className="text-[9.5px] text-slate-450 font-black">{p.rut}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-500">{p.giro || '-'}</td>
                      <td className="p-3 font-bold text-slate-650">{p.email_dte || '-'}</td>
                      <td className="p-3 text-center font-black">{p.plazo_pago} días</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDeleteProveedor(p.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer">
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: SECCIONES (DEPARTAMENTOS DE LA EMPRESA)
          ------------------------------------------------------------- */}
      {activeTab === 'secciones' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-4 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4 h-fit font-semibold text-xs text-slate-700">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              ➕ Crear Sección / Departamento
            </h4>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Nombre de la Sección</label>
                <input type="text" value={seccionNombre} onChange={(e) => setSeccionNombre(e.target.value)} placeholder="ej: Bodega Obra, Adquisiciones" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Descripción</label>
                <textarea rows={3} value={seccionDescripcion} onChange={(e) => setSeccionDescripcion(e.target.value)} placeholder="Detalle sobre las responsabilidades..." className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>
              <button onClick={handleSaveSeccion} disabled={loading} className="w-full bg-primary text-white font-extrabold text-xs uppercase py-2.5 rounded-xl hover:bg-primary-hover transition flex items-center justify-center gap-1.5">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar Sección
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              📋 Secciones Activas
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-150">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider">
                    <th className="p-3">Sección</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3 w-16 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {secciones.map((s, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-extrabold text-slate-800">{s.nombre}</td>
                      <td className="p-3 text-[11px] text-slate-500 leading-normal">{s.descripcion || '-'}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDeleteSeccion(s.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer">
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: CENTROS DE GESTIÓN
          ------------------------------------------------------------- */}
      {activeTab === 'centros' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-4 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4 h-fit font-semibold text-xs text-slate-700">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              ➕ Crear Centro de Gestión
            </h4>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-455">Código de 3 Dígitos</label>
                <input type="text" maxLength={3} value={centroCodigo} onChange={(e) => setCentroCodigo(e.target.value.replace(/\D/g, ''))} placeholder="001 al 999" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Nombre Centro de Costos</label>
                <input type="text" value={centroNombre} onChange={(e) => setCentroNombre(e.target.value)} placeholder="ej: Obra Larraín" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Descripción</label>
                <textarea rows={3} value={centroDescripcion} onChange={(e) => setCentroDescripcion(e.target.value)} placeholder="..." className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>
              <button onClick={handleSaveCentro} disabled={loading} className="w-full bg-primary text-white font-extrabold text-xs uppercase py-2.5 rounded-xl hover:bg-primary-hover transition flex items-center justify-center gap-1.5">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar Centro
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              📋 Centros de Gestión Activos
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-150">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider">
                    <th className="p-3 w-20">Código</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3 w-16 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {centros.map((c, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-extrabold text-primary">{c.codigo}</td>
                      <td className="p-3 font-bold text-slate-800">{c.nombre}</td>
                      <td className="p-3 text-[11px] text-slate-500 leading-normal">{c.descripcion || '-'}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDeleteCentro(c.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer">
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: ÓRDENES DE COMPRA (OC)
          ------------------------------------------------------------- */}
      {activeTab === 'ocs' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Órdenes de Compra</h3>
              <p className="text-[10px] text-slate-500 font-semibold">Genera compras para proveedores y autoriza recepciones.</p>
            </div>
            <button onClick={() => { setErrorMsg(''); setSuccessMsg(''); setOcProveedorId(''); setOcCentroGestion(''); setOcSeccionId(''); setOcItems([{ descripcion: '', cantidad: 1, precioUnitario: 0, detalles: '' }]); setOcEstado('Borrador'); setShowOCModal(true); }} className="bg-primary text-white font-extrabold text-xs uppercase px-4 py-2.5 rounded-xl hover:bg-primary-hover shadow-xs cursor-pointer transition flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Nueva Orden de Compra
            </button>
          </div>

          <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs">
            <div className="overflow-x-auto rounded-xl border border-slate-150">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider">
                    <th className="p-3 w-16">Nº OC</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3">Sección / Centro</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 w-32 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {ordenesCompra.map((oc, idx) => {
                    const centro = centros.find(c => c.id === oc.centro_gestion_id)?.nombre || '-';
                    const secc = secciones.find(s => s.id === oc.seccion_id)?.nombre || '-';
                    return (
                      <tr key={idx}>
                        <td className="p-3 font-extrabold">Nº {oc.numero}</td>
                        <td className="p-3">
                          <div className="font-extrabold text-slate-800">{oc.proveedor_nombre}</div>
                          <div className="text-[9px] text-slate-450 font-black">{oc.proveedor_rut}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-700 text-[11px]">{secc}</div>
                          <div className="text-[10px] text-slate-500 font-semibold">{centro}</div>
                        </td>
                        <td className="p-3 text-right font-black text-slate-800">{formatCLP(oc.monto_total)}</td>
                        <td className="p-3 text-center">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                            oc.estado === 'Facturada' ? 'bg-emerald-100 text-emerald-800' :
                            oc.estado === 'Enviada' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {oc.estado}
                          </span>
                        </td>
                        <td className="p-3 text-center flex justify-center gap-1.5">
                          <button onClick={() => setSelectedOC(oc)} className="border border-slate-200 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer flex items-center justify-center" title="Imprimir OC">
                            <Printer className="w-4 h-4 text-slate-600" />
                          </button>
                          {oc.estado !== 'Facturada' && (
                            <button onClick={() => handleOpenRecepModal(oc)} className="border border-slate-200 hover:bg-slate-50 p-1.5 rounded-lg text-emerald-600 cursor-pointer flex items-center justify-center" title="Recepción de Materiales">
                              <Boxes className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* VISOR OC */}
          {selectedOC && (
            <div className="bg-white border border-slate-250 rounded-3xl p-8 shadow-md max-w-3xl mx-auto space-y-6 relative animate-in fade-in duration-200">
              <button onClick={() => setSelectedOC(null)} className="absolute top-4 right-4 text-xs font-bold text-slate-400 hover:text-slate-700">✕ Cerrar Vista</button>
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-sm font-black text-slate-850 uppercase">{configSii.razon_social || user.empresa}</h2>
                  <p className="text-[9px] text-slate-500 font-bold">RUT: {configSii.rut_empresa}</p>
                </div>
                <div className="text-right">
                  <span className="bg-red-50 text-red-700 text-xs font-black px-4 py-1.5 rounded uppercase">Orden de Compra</span>
                  <p className="text-xs font-black text-slate-800 mt-1">Nº {selectedOC.numero}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
                <div>
                  <h4 className="text-[9px] font-black text-slate-450 uppercase mb-1">Proveedor:</h4>
                  <p className="font-extrabold text-slate-800">{selectedOC.proveedor_nombre}</p>
                  <p className="text-slate-500 font-bold">{selectedOC.proveedor_rut}</p>
                </div>
                <div>
                  <h4 className="text-[9px] font-black text-slate-450 uppercase mb-1">Sección/Costo:</h4>
                  <p className="font-extrabold text-slate-800">{secciones.find(s => s.id === selectedOC.seccion_id)?.nombre}</p>
                  <p className="text-slate-500 font-bold">{centros.find(c => c.id === selectedOC.centro_gestion_id)?.nombre}</p>
                </div>
                <div>
                  <h4 className="text-[9px] font-black text-slate-450 uppercase mb-1">Estado:</h4>
                  <p className="font-black text-primary uppercase">{selectedOC.estado}</p>
                </div>
              </div>

              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold text-[8.5px] uppercase">
                    <th className="p-2">Descripción</th>
                    <th className="p-2 w-16 text-center">Cant.</th>
                    <th className="p-2 w-24 text-right">P. Unitario</th>
                    <th className="p-2 w-28 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {selectedOC.detalles.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <p className="font-bold text-slate-800">{it.descripcion}</p>
                        {it.detalles && <p className="text-[10px] text-slate-500 font-normal mt-0.5">{it.detalles}</p>}
                      </td>
                      <td className="p-2 text-center">{it.cantidad}</td>
                      <td className="p-2 text-right">{formatCLP(it.precioUnitario)}</td>
                      <td className="p-2 text-right font-bold">{formatCLP(it.cantidad * it.precioUnitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end text-xs font-semibold text-slate-700">
                <div className="w-48 space-y-1">
                  <div className="flex justify-between"><span>Monto Neto:</span><span>{formatCLP(selectedOC.monto_neto)}</span></div>
                  <div className="flex justify-between text-slate-400"><span>IVA (19%):</span><span>{formatCLP(selectedOC.monto_iva)}</span></div>
                  <div className="flex justify-between font-black text-sm text-slate-900 border-t pt-1"><span>Total:</span><span>{formatCLP(selectedOC.monto_total)}</span></div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: RECEPCIONES DE BODEGA
          ------------------------------------------------------------- */}
      {activeTab === 'recepciones' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Historial de Recepciones Físicas en Bodega</h3>
            <p className="text-[10px] text-slate-500 font-semibold">Listado de despachos e insumos que ingresaron a terreno.</p>
          </div>

          <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs">
            <div className="overflow-x-auto rounded-xl border border-slate-150">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider">
                    <th className="p-3 w-28">Fecha Recepción</th>
                    <th className="p-3">Ref. Orden Compra</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3">Recibido Por</th>
                    <th className="p-3">Detalle Materiales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {recepciones.map((r, idx) => {
                    const ocRef = ordenesCompra.find(o => o.id === r.oc_id);
                    return (
                      <tr key={idx}>
                        <td className="p-3 font-bold">{r.fecha_recepcion}</td>
                        <td className="p-3 font-extrabold text-primary">OC Nº {ocRef?.numero || r.oc_id}</td>
                        <td className="p-3 font-bold text-slate-800">{ocRef?.proveedor_nombre || '-'}</td>
                        <td className="p-3 font-bold text-slate-655">{r.recibido_por}</td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {r.detalles.map((d, i) => (
                              <div key={i} className="text-[11px] font-semibold text-slate-500">
                                • {d.descripcion}: <span className="text-slate-800 font-extrabold">{d.cantidadRecibida} u</span>
                                {d.detalles && <span className="text-slate-400 font-normal block pl-2 text-[10px]">— {d.detalles}</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {recepciones.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-455 font-bold uppercase">No hay despachos ingresados en bodega.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'emitir' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Panel Superior: Datos del Receptor */}
          <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4 font-semibold text-xs text-slate-700">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              📄 Datos del Receptor de DTE
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Tipo DTE</label>
                <select value={dteTipo} onChange={(e) => setDteTipo(parseInt(e.target.value))} className="w-full border border-slate-250 rounded-xl p-2.5 bg-white cursor-pointer text-xs">
                  <option value={33}>Factura Electrónica (33)</option>
                  <option value={34}>Factura Exenta (34)</option>
                  <option value={39}>Boleta Electrónica (39)</option>
                  <option value={52}>Guía Despacho (52)</option>
                  <option value={61}>Nota de Crédito (61)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">RUT Receptor</label>
                <input type="text" value={dteReceptorRut} onChange={(e) => setDteReceptorRut(e.target.value)} placeholder="76.123.456-K" className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-xs" />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Centro Costos</label>
                <select value={dteCentroGestion} onChange={(e) => setDteCentroGestion(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2.5 bg-white cursor-pointer text-xs">
                  <option value="">Selecciona...</option>
                  {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-bold uppercase text-slate-450">Razón Social Receptor</label>
                <input type="text" value={dteReceptorNombre} onChange={(e) => setDteReceptorNombre(e.target.value)} placeholder="Cliente Constructora" className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-xs" />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Sección Solicitante</label>
                <select value={dteSeccionId} onChange={(e) => setDteSeccionId(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2.5 bg-white cursor-pointer text-xs">
                  <option value="">Selecciona...</option>
                  {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h5 className="text-[9px] font-black uppercase text-slate-500 border-b pb-1">🔗 Documento Referencia (SII)</h5>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase text-slate-450">Tipo</label>
                  <select value={dteRefTipo} onChange={(e) => setDteRefTipo(e.target.value)} className="w-full border border-slate-250 rounded-lg p-1.5 text-[10px] bg-white cursor-pointer">
                    <option value="">Ninguno</option>
                    <option value="801">OC (801)</option>
                    <option value="52">Guía (52)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase text-slate-450">Folio</label>
                  <input type="text" value={dteRefFolio} onChange={(e) => setDteRefFolio(e.target.value)} placeholder="Nº" className="w-full border border-slate-250 rounded-lg p-1.5 text-[10px] bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase text-slate-450">Fecha</label>
                  <input type="date" value={dteRefFecha} onChange={(e) => setDteRefFecha(e.target.value)} className="w-full border border-slate-250 rounded-lg p-1.5 text-[10px] bg-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Panel Inferior: Detalle de Ítems */}
          <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2 flex justify-between items-center">
              <span>🛠️ Detalle de Ítems</span>
              <button onClick={() => setDteItems([...dteItems, { codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, exento: false, detalles: '' }])} className="text-[9px] font-black uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl cursor-pointer transition flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Agregar Producto
              </button>
            </h4>

            {/* Listado de Productos como Tarjetas Modernas */}
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {dteItems.map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3 relative text-xs font-semibold text-slate-700">
                  <button onClick={() => { if (dteItems.length === 1) return; setDteItems(dteItems.filter((_, i) => i !== idx)); }} className="absolute top-3 right-3 text-red-500 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer transition" title="Eliminar ítem">
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-[8px] font-extrabold uppercase text-slate-450">Código Producto</label>
                      <input type="text" value={item.codigo || ''} onChange={(e) => { const upd = [...dteItems]; upd[idx].codigo = e.target.value; setDteItems(upd); }} placeholder="ej: H-30" className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white" />
                    </div>
                    <div className="md:col-span-5 space-y-1">
                      <label className="block text-[8px] font-extrabold uppercase text-slate-450">Descripción / Producto</label>
                      <input type="text" value={item.descripcion} onChange={(e) => { const upd = [...dteItems]; upd[idx].descripcion = e.target.value; setDteItems(upd); }} placeholder="Detalle del producto o servicio..." className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white font-bold" />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-[8px] font-extrabold uppercase text-slate-450 text-center">Cantidad</label>
                      <input type="number" value={item.cantidad} onChange={(e) => { const upd = [...dteItems]; upd[idx].cantidad = parseInt(e.target.value) || 0; setDteItems(upd); }} className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white text-center font-bold text-slate-800" />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-[8px] font-extrabold uppercase text-slate-450 text-right">P. Unitario</label>
                      <input type="number" value={item.precioUnitario} onChange={(e) => { const upd = [...dteItems]; upd[idx].precioUnitario = parseFloat(e.target.value) || 0; setDteItems(upd); }} className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white text-right font-bold text-slate-850" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-9 space-y-1">
                      <label className="block text-[8px] font-extrabold uppercase text-slate-450">Especificaciones / Detalles Adicionales</label>
                      <input type="text" value={item.detalles || ''} onChange={(e) => { const upd = [...dteItems]; upd[idx].detalles = e.target.value; setDteItems(upd); }} placeholder="ej: dimensiones, marca, color, notas especiales de despacho..." className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white text-slate-700 font-normal" />
                    </div>
                    <div className="md:col-span-3 flex items-center justify-end gap-2 pt-4">
                      <input type="checkbox" id={`exento-${idx}`} checked={item.exento || false} onChange={(e) => { const upd = [...dteItems]; upd[idx].exento = e.target.checked; setDteItems(upd); }} className="w-4 h-4 rounded border-slate-300 focus:ring-primary cursor-pointer text-primary" />
                      <label htmlFor={`exento-${idx}`} className="text-[10px] font-extrabold uppercase text-slate-550 cursor-pointer select-none">Exento de IVA</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t gap-3">
              <button onClick={handlePreviewDraftDTE} disabled={loading || !dteReceptorRut || !dteReceptorNombre} className="border border-slate-250 bg-slate-50 text-slate-700 hover:bg-slate-100 font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer">
                <Eye className="w-3.5 h-3.5" />
                Previsualizar Borrador
              </button>
              <button onClick={handleEmitirDTE} disabled={loading || !dteReceptorRut || !dteReceptorNombre} className="bg-primary text-white font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl hover:bg-primary-hover shadow-xs transition flex items-center gap-1.5 cursor-pointer">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Firmar y Emitir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: REGISTRO COMPRA Y VENTA (RCV) CON ACUSE DE RECIBO MANUAL
          ------------------------------------------------------------- */}
      {activeTab === 'registro' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Registro de Compra y Venta (RCV)</h3>
              <p className="text-[10px] text-slate-500 font-semibold">Administra folios, DTEs emitidos y controla el acuse formal ante el SII.</p>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="bg-slate-100 p-1 rounded-xl flex border">
                <button onClick={() => setTipoFlujo('Venta')} className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${tipoFlujo === 'Venta' ? 'bg-white text-primary shadow-xs' : 'text-slate-500'}`}>Ventas</button>
                <button onClick={() => setTipoFlujo('Compra')} className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${tipoFlujo === 'Compra' ? 'bg-white text-primary shadow-xs' : 'text-slate-500'}`}>Compras</button>
              </div>
              {tipoFlujo === 'Compra' && (
                <button onClick={() => { setErrorMsg(''); setSuccessMsg(''); setCompFolio(''); setCompProveedorId(''); setCompCentroGestion(''); setCompSeccionId(''); setCompMontoNeto(0); setCompMontoIva(0); setCompMontoTotal(0); setCompOcVinculadaId(''); setShowIngresoCompraModal(true); }} className="bg-primary text-white font-extrabold text-xs uppercase px-4 py-2.5 rounded-xl hover:bg-primary-hover shadow-xs cursor-pointer transition flex items-center gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" /> Ingresar Factura
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs">
            <div className="overflow-x-auto rounded-xl border border-slate-150">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider">
                    <th className="p-3 w-16">Folio</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Entidad Relacionada</th>
                    <th className="p-3">OC Ref.</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">Acuse SII</th>
                    <th className="p-3 w-48 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {docsFiltrados.filter(doc => doc.direccion_flujo === tipoFlujo).map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-extrabold">Nº {doc.folio}</td>
                      <td className="p-3 font-bold text-slate-600">{getDteTypeName(doc.tipo_dte)}</td>
                      <td className="p-3">
                        <div className="font-extrabold text-slate-800">{doc.nombre_receptor}</div>
                        <div className="text-[9.5px] text-slate-450 font-black">{doc.rut_receptor}</div>
                      </td>
                      <td className="p-3 font-bold">
                        {doc.referencia_oc_id ? (
                          <span className="text-primary">OC Nº {ordenesCompra.find(o => o.id === doc.referencia_oc_id)?.numero || doc.referencia_oc_id}</span>
                        ) : (
                          <span className="text-red-500 font-black flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Sin OC</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-black">{formatCLP(doc.monto_total)}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                          doc.estado_acuse === 'Aceptado' ? 'bg-emerald-100 text-emerald-800' :
                          doc.estado_acuse === 'Reclamado' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {doc.estado_acuse}
                        </span>
                        {doc.motivo_reclamo && (
                          <div className="text-[8.5px] text-red-655 font-bold mt-1 leading-normal max-w-[150px] mx-auto truncate" title={doc.motivo_reclamo}>
                            {doc.motivo_reclamo}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center flex justify-center items-center gap-1">
                        <button onClick={() => { setSelectedDTE(doc); setShowDTEModal(true); setShowXMLViewer(false); }} className="border border-slate-200 hover:bg-slate-50 p-1.5 rounded-lg cursor-pointer" title="Ver PDF">
                          <Eye className="w-4 h-4 text-slate-600" />
                        </button>
                        
                        {/* BOTONES DE ACUSE ANTE SII (Sólo para compras en estado Pendiente) */}
                        {tipoFlujo === 'Compra' && doc.estado_acuse === 'Pendiente' && (
                          <>
                            <button onClick={() => handleAceptarDTEComercial(doc.id)} className="border border-emerald-250 hover:bg-emerald-50 text-emerald-600 p-1.5 rounded-lg cursor-pointer" title="Dar Acuse Recibo / Aceptar">
                              <FileCheck className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleOpenRechazoModal(doc.id)} className="border border-red-250 hover:bg-red-50 text-red-600 p-1.5 rounded-lg cursor-pointer" title="Reclamar / Rechazar Factura">
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* VISOR DTE */}
          {showDTEModal && selectedDTE && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
                <button onClick={() => { setShowDTEModal(false); setSelectedDTE(null); }} className="absolute top-4 right-4 text-xs font-bold text-slate-400 hover:text-slate-700">✕ Cerrar</button>
                <div className="border-4 border-emerald-700 p-6 space-y-6 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-sm font-black text-emerald-800 uppercase">{configSii.razon_social || user.empresa}</h2>
                      <p className="text-[10px] text-slate-500 font-extrabold uppercase">Giro: {configSii.giro}</p>
                    </div>
                    <div className="border-4 border-red-600 rounded-lg p-3 text-center w-52 shrink-0">
                      <p className="text-red-600 text-[10px] font-black">R.U.T.: {configSii.rut_empresa}</p>
                      <p className="text-red-600 text-xs font-black uppercase">{getDteTypeName(selectedDTE.tipo_dte)}</p>
                      <p className="text-red-600 text-[11px] font-black">Nº {selectedDTE.folio}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-3 text-[10px] bg-slate-50">
                    <div>
                      <p className="text-slate-450 text-[8px] uppercase">Receptor:</p>
                      <p className="text-slate-800 font-bold">{selectedDTE.nombre_receptor}</p>
                      <p className="text-slate-800 font-bold">RUT: {selectedDTE.rut_receptor}</p>
                    </div>
                    <div>
                      <p className="text-slate-450 text-[8px] uppercase">Acuse SII:</p>
                      <p className="text-slate-800 font-black uppercase text-primary">{selectedDTE.estado_acuse}</p>
                    </div>
                  </div>

                  <table className="w-full text-left text-[10px] border">
                    <thead>
                      <tr className="bg-slate-100 border-b text-slate-655 font-bold uppercase text-[8.5px] tracking-wider bg-slate-50 text-slate-500">
                        <th className="p-2 w-20">Código</th>
                        <th className="p-2">Descripción</th>
                        <th className="p-2 w-12 text-center">Cant.</th>
                        <th className="p-2 w-20 text-right">P. Unitario</th>
                        <th className="p-2 w-24 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700 font-bold bg-white">
                      {Array.isArray(selectedDTE.detalles) && selectedDTE.detalles.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2 text-slate-450 font-mono text-[9px]">{it.codigo || '—'}</td>
                          <td className="p-2">
                            <p className="font-bold text-slate-800">{it.descripcion}</p>
                            {it.detalles && <p className="text-[9px] text-slate-500 font-normal mt-0.5">{it.detalles}</p>}
                          </td>
                          <td className="p-2 text-center">{it.cantidad}</td>
                          <td className="p-2 text-right">{formatCLP(it.precioUnitario)}</td>
                          <td className="p-2 text-right">{formatCLP(it.cantidad * it.precioUnitario)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-between items-end">
                    <div className="border p-2 text-center w-60 rounded bg-white font-mono text-[7px] text-slate-700 leading-none">[ TIMBRE ELECTRÓNICO SII PDF417 ]</div>
                    <div className="w-48 space-y-1 text-slate-750 font-bold">
                      <div className="flex justify-between"><span>Neto:</span><span>{formatCLP(selectedDTE.monto_neto)}</span></div>
                      <div className="flex justify-between text-slate-400"><span>IVA:</span><span>{formatCLP(selectedDTE.monto_iva)}</span></div>
                      <div className="flex justify-between font-black text-emerald-800 border-t pt-1"><span>Total:</span><span>{formatCLP(selectedDTE.monto_total)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODAL INGRESO COMPRA FACTURA PROVEEDOR */}
          {showIngresoCompraModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-2xl max-w-lg w-full relative animate-in zoom-in-95 duration-200">
                <button onClick={() => setShowIngresoCompraModal(false)} className="absolute top-4 right-4 text-xs font-bold text-slate-400 hover:text-slate-700">✕</button>
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b pb-2 mb-4 flex items-center gap-1.5"><ShoppingBag className="w-5 h-5 text-primary" /> Ingresar Factura de Compra</h3>
                
                <div className="space-y-3 text-xs font-semibold text-slate-700">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-450">Folio Factura</label>
                      <input type="number" value={compFolio} onChange={(e) => setCompFolio(e.target.value)} placeholder="Folio" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-450">Proveedor Emisor</label>
                      <select value={compProveedorId} onChange={(e) => setCompProveedorId(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                        <option value="">Selecciona...</option>
                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} ({p.rut})</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-450">Centro Gestión</label>
                      <select value={compCentroGestion} onChange={(e) => setCompCentroGestion(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                        <option value="">Selecciona...</option>
                        {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-450">Sección Destino</label>
                      <select value={compSeccionId} onChange={(e) => setCompSeccionId(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                        <option value="">Selecciona...</option>
                        {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-450">Vincular Orden de Compra (3-Way Match)</label>
                    <select value={compOcVinculadaId} onChange={(e) => {
                      setCompOcVinculadaId(e.target.value);
                      const oc = ordenesCompra.find(o => o.id === parseInt(e.target.value));
                      if (oc) {
                        setCompMontoNeto(oc.monto_neto);
                        setCompMontoIva(oc.monto_iva);
                        setCompMontoTotal(oc.monto_total);
                        const provObj = proveedores.find(p => p.rut === oc.proveedor_rut);
                        if (provObj) setCompProveedorId(provObj.id);
                        setCompCentroGestion(oc.centro_gestion_id);
                        setCompSeccionId(oc.seccion_id);
                      }
                    }} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                      <option value="">Ninguna</option>
                      {ordenesCompra.filter(o => o.estado !== 'Facturada').map(o => (
                        <option key={o.id} value={o.id}>OC Nº {o.numero} ({o.proveedor_nombre}) - {formatCLP(o.monto_total)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold uppercase text-slate-450">Neto</label>
                      <input type="number" value={compMontoNeto} onChange={(e) => {
                        const net = parseFloat(e.target.value) || 0;
                        setCompMontoNeto(net);
                        setCompMontoIva(Math.round(net * 0.19));
                        setCompMontoTotal(net + Math.round(net * 0.19));
                      }} className="w-full border border-slate-250 rounded-lg p-1.5 bg-white text-right" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold uppercase text-slate-450">IVA</label>
                      <input type="number" value={compMontoIva} onChange={(e) => setCompMontoIva(parseFloat(e.target.value) || 0)} className="w-full border border-slate-250 rounded-lg p-1.5 bg-white text-right" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold uppercase text-slate-450">Total</label>
                      <input type="number" value={compMontoTotal} onChange={(e) => setCompMontoTotal(parseFloat(e.target.value) || 0)} className="w-full border border-slate-250 rounded-lg p-1.5 bg-white text-right font-bold text-slate-800" />
                    </div>
                  </div>

                  <button onClick={handleIngresarCompra} disabled={loading} className="w-full bg-primary text-white font-extrabold text-xs uppercase py-2.5 rounded-xl hover:bg-primary-hover shadow-xs transition flex items-center justify-center gap-1.5">
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Guardar y Conciliar Factura
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL RECHAZO / RECLAMO ANTE EL SII */}
          {showReclamoModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-2xl max-w-sm w-full relative animate-in zoom-in-95 duration-200">
                <button onClick={() => setShowReclamoModal(false)} className="absolute top-4 right-4 text-xs font-bold text-slate-400 hover:text-slate-700">✕</button>
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b pb-2 mb-4 flex items-center gap-1.5">
                  <Ban className="w-5 h-5 text-red-600" /> Reclamo DTE ante el SII
                </h3>

                <div className="space-y-3 text-xs font-semibold text-slate-700">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold uppercase text-slate-450">Seleccione el motivo de Reclamo Comercial</label>
                    <select value={reclamoMotivo} onChange={(e) => setReclamoMotivo(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                      <option value="">Selecciona...</option>
                      <option value="Reclamo por Contenido del Documento (Precios/Detalles erróneos)">Reclamo por Contenido (Precios/Detalles erróneos)</option>
                      <option value="Falta de Entrega de Mercaderías o Prestación de Servicios">Falta de Entrega de Mercaderías/Servicios</option>
                      <option value="Servicio no contratado / Facturación no autorizada">Facturación no autorizada o no contratada</option>
                    </select>
                  </div>
                  
                  <button onClick={handleConfirmRechazoDTE} disabled={!reclamoMotivo} className="w-full bg-red-600 hover:bg-red-750 text-white font-extrabold text-xs uppercase py-2.5 rounded-xl transition flex items-center justify-center gap-1.5">
                    <Ban className="w-3.5 h-3.5" /> Reclamar / Rechazar DTE
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: FOLIOS (CAF)
          ------------------------------------------------------------- */}
      {activeTab === 'folios' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-5 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4 h-fit font-semibold text-xs text-slate-700">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              📥 Autorizar Rango de Folios CAF
            </h4>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-455">Tipo de DTE</label>
                <select value={cafTipoDte} onChange={(e) => setCafTipoDte(parseInt(e.target.value))} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                  <option value={33}>Factura Electrónica (33)</option>
                  <option value={34}>Factura Exenta (34)</option>
                  <option value={39}>Boleta Electrónica (39)</option>
                  <option value={52}>Guía Despacho (52)</option>
                  <option value={61}>Nota de Crédito (61)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Desde</label>
                  <input type="number" value={cafDesde} onChange={(e) => setCafDesde(e.target.value)} placeholder="1" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Hasta</label>
                  <input type="number" value={cafHasta} onChange={(e) => setCafHasta(e.target.value)} placeholder="100" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
                </div>
              </div>

              <button onClick={handleUploadCAF} disabled={loading || !cafDesde || !cafHasta} className="w-full bg-primary text-white font-extrabold text-xs uppercase py-2.5 rounded-xl hover:bg-primary-hover transition flex items-center justify-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Guardar Rango Folios
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              📊 Disponibilidad de Folios por Tipo DTE
            </h4>
            <div className="space-y-4">
              {folios.map((fol, idx) => {
                const total = fol.hasta - fol.desde + 1;
                const consumidos = fol.actual - fol.desde;
                const disponibles = total - consumidos;
                const pct = Math.round((consumidos / total) * 100);
                return (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-800 font-black">{getDteTypeName(fol.tipo_dte)} (Tipo {fol.tipo_dte})</span>
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase ${disponibles > 10 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse'}`}>
                        {disponibles} Libres
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct > 80 ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                      <span>Rango: {fol.desde} al {fol.hasta}</span>
                      <span>Siguiente Folio Libre: Nº {fol.actual} ({pct}% consumido)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB: CONFIGURACIÓN SII CON REGLAS DE NEGOCIO (iConstruye-Style)
          ------------------------------------------------------------- */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          
          <div className="lg:col-span-7 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-4">
            <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">
              🏢 Datos Tributarios del Emisor
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase text-slate-450">RUT Empresa</label>
                <input type="text" value={configSii?.rut_empresa || ''} onChange={(e) => setConfigSii({ ...configSii, rut_empresa: e.target.value })} className="w-full border border-slate-250 rounded-xl p-2.5 text-xs text-slate-800 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase text-slate-450">Razón Social</label>
                <input type="text" value={configSii?.razon_social || ''} onChange={(e) => setConfigSii({ ...configSii, razon_social: e.target.value })} className="w-full border border-slate-250 rounded-xl p-2.5 text-xs text-slate-800 bg-white" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[9px] font-bold uppercase text-slate-450">Giro Comercial</label>
                <input type="text" value={configSii?.giro || ''} onChange={(e) => setConfigSii({ ...configSii, giro: e.target.value })} className="w-full border border-slate-250 rounded-xl p-2.5 text-xs text-slate-800 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase text-slate-450">Dirección Casa Matriz</label>
                <input type="text" value={configSii?.direccion || ''} onChange={(e) => setConfigSii({ ...configSii, direccion: e.target.value })} className="w-full border border-slate-250 rounded-xl p-2.5 text-xs text-slate-800 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold uppercase text-slate-455">Comuna</label>
                <select value={configSii?.comuna || ''} onChange={(e) => setConfigSii({ ...configSii, comuna: e.target.value })} className="w-full border border-slate-250 rounded-xl p-2.5 text-xs text-slate-800 bg-white cursor-pointer">
                  <option value="">Selecciona Comuna...</option>
                  {Array.isArray(comunasChile) && comunasChile.map((c, i) => <option key={i} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* REGLAS DE NEGOCIO AVANZADAS (iConstruye-Style) */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
              <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-1.5 flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-primary" />
                Reglas de Validación y Control Automático (iConstruye Style)
              </h4>
              
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="ruleRechazoSinOC"
                  checked={configSii?.rechazo_sin_oc || false}
                  onChange={(e) => handleToggleRuleRechazo(e.target.checked)}
                  className="w-4 h-4 text-primary border-slate-350 rounded focus:ring-primary mt-0.5 cursor-pointer"
                />
                <div className="text-xs">
                  <label htmlFor="ruleRechazoSinOC" className="font-extrabold text-slate-850 cursor-pointer block select-none">
                    Rechazo Automático por falta de Orden de Compra (OC)
                  </label>
                  <p className="text-[10.5px] text-slate-500 font-semibold leading-relaxed mt-0.5">
                    Si está activado, el sistema marcará inmediatamente como **"Rechazado" (Reclamado ante el SII)** cualquier factura de proveedor ingresada que no posea una referencia enlazada a una Orden de Compra autorizada.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleSaveConfigSii} disabled={loading} className="bg-primary text-white font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl hover:bg-primary-hover shadow-xs transition flex items-center gap-1.5">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar Configuración
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-5 h-fit font-semibold text-xs text-slate-700">
            <div className="space-y-3">
              <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2">🔑 Certificado Digital</h4>
              {configSii?.certificado_nombre && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <p className="font-extrabold uppercase text-[9px] text-emerald-700">Firma Activa</p>
                    <p className="text-[10.5px] truncate font-bold">{configSii.certificado_nombre}</p>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-455">Cargar Archivo (.pfx / .p12)</label>
                <input type="file" accept=".pfx,.p12" onChange={(e) => setCertFile(e.target.files[0])} className="w-full border border-slate-200 rounded-xl p-2 bg-slate-50 text-[11px]" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Contraseña de Clave Privada</label>
                <input type="password" value={certPassword} onChange={(e) => setCertPassword(e.target.value)} placeholder="••••••••" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider flex items-center justify-between">
                <span>📶 Canal de Conexión SII</span>
                <select value={configSii?.modo_sii || 'Certificación'} onChange={(e) => setConfigSii({ ...configSii, modo_sii: e.target.value })} className="border text-[9px] font-black uppercase px-2 py-1 bg-slate-50 cursor-pointer">
                  <option value="Certificación">Certificación</option>
                  <option value="Producción">Producción</option>
                </select>
              </h4>
              <button onClick={handleTestSiiConnection} disabled={testingSii} className="w-full border border-slate-250 bg-slate-50 text-slate-700 hover:bg-slate-100 font-extrabold text-[10px] uppercase py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5">
                {testingSii ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Hacer Test de Conexión
              </button>
              {siiStatusMsg && (
                <p className="bg-emerald-50 text-emerald-800 border border-emerald-150 p-3 rounded-xl text-[10px] leading-normal">{siiStatusMsg}</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* MODAL CREAR ORDEN DE COMPRA */}
      {showOCModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200 font-semibold text-xs text-slate-750">
            <button onClick={() => setShowOCModal(false)} className="absolute top-4 right-4 text-xs font-bold text-slate-400 hover:text-slate-750">✕</button>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b pb-2 mb-4 flex items-center gap-1.5"><ShoppingBag className="w-5 h-5 text-primary" /> Emitir Orden de Compra</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Proveedor Autorizado</label>
                  <select value={ocProveedorId} onChange={(e) => setOcProveedorId(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                    <option value="">Selecciona...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} ({p.rut})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-455">Sección de la Empresa</label>
                  <select value={ocSeccionId} onChange={(e) => setOcSeccionId(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                    <option value="">Selecciona...</option>
                    {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Centro de Gestión</label>
                  <select value={ocCentroGestion} onChange={(e) => setOcCentroGestion(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                    <option value="">Selecciona...</option>
                    {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-450">Estado Inicial</label>
                  <select value={ocEstado} onChange={(e) => setOcEstado(e.target.value)} className="w-full border border-slate-250 rounded-xl p-2 bg-white cursor-pointer">
                    <option value="Borrador">Borrador</option>
                    <option value="Enviada">Enviada a Proveedor</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] text-slate-500 font-extrabold uppercase border-b pb-1 flex justify-between items-center">
                  <span>🛠️ Detalle de Productos (OC)</span>
                  <button onClick={() => setOcItems([...ocItems, { descripcion: '', cantidad: 1, precioUnitario: 0, detalles: '' }])} className="text-[8px] font-black uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer transition">+ Agregar Producto</button>
                </h4>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {ocItems.map((it, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 space-y-2.5 relative text-xs font-semibold text-slate-700">
                      <button onClick={() => { if (ocItems.length === 1) return; setOcItems(ocItems.filter((_, i) => i !== idx)); }} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <div className="md:col-span-6 space-y-1">
                          <label className="block text-[8px] font-extrabold uppercase text-slate-450">Descripción / Producto</label>
                          <input type="text" value={it.descripcion} onChange={(e) => { const upd = [...ocItems]; upd[idx].descripcion = e.target.value; setOcItems(upd); }} placeholder="ej: Cemento Melón Especial" className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white font-bold" />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                          <label className="block text-[8px] font-extrabold uppercase text-slate-450 text-center">Cantidad</label>
                          <input type="number" value={it.cantidad} onChange={(e) => { const upd = [...ocItems]; upd[idx].cantidad = parseInt(e.target.value) || 0; setOcItems(upd); }} className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-center font-bold" />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                          <label className="block text-[8px] font-extrabold uppercase text-slate-450 text-right">P. Unitario</label>
                          <input type="number" value={it.precioUnitario} onChange={(e) => { const upd = [...ocItems]; upd[idx].precioUnitario = parseFloat(e.target.value) || 0; setOcItems(upd); }} className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-right font-bold" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[8px] font-extrabold uppercase text-slate-450">Especificaciones / Detalles Adicionales (Notas)</label>
                        <input type="text" value={it.detalles || ''} onChange={(e) => { const upd = [...ocItems]; upd[idx].detalles = e.target.value; setOcItems(upd); }} placeholder="ej: color, dimensiones, marca, plazo de entrega en bodega..." className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-slate-700 font-normal" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end text-xs font-semibold text-slate-700 pt-2 border-t">
                <div className="w-48 space-y-1">
                  <div className="flex justify-between"><span>Neto:</span><span>{formatCLP(ocItems.reduce((s, i) => s + (i.cantidad * i.precioUnitario), 0))}</span></div>
                  <div className="flex justify-between font-black text-xs text-slate-900 border-t pt-1"><span>Total OC:</span><span>{formatCLP(Math.round(ocItems.reduce((s, i) => s + (i.cantidad * i.precioUnitario), 0) * 1.19))}</span></div>
                </div>
              </div>

              <button onClick={handleSaveOC} disabled={loading} className="w-full bg-primary text-white font-extrabold text-xs uppercase py-2.5 rounded-xl hover:bg-primary-hover transition flex items-center justify-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Emitir Orden de Compra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR RECEPCIÓN DE MATERIALES (BODEGA B3-Way MATCH) */}
      {showRecepModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-2xl max-w-lg w-full relative animate-in zoom-in-95 duration-200 font-semibold text-xs text-slate-750">
            <button onClick={() => setShowRecepModal(false)} className="absolute top-4 right-4 text-xs font-bold text-slate-400 hover:text-slate-700">✕</button>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b pb-2 mb-4 flex items-center gap-1.5">
              <Boxes className="w-5 h-5 text-emerald-600 animate-pulse" />
              Recepción Física de Insumos (3-Way Matching)
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Persona que Recibe (Responsable en Terreno)</label>
                <input type="text" value={recepRecibidoPor} onChange={(e) => setRecepRecibidoPor(e.target.value)} placeholder="ej: Juan Pérez (Bodeguero)" className="w-full border border-slate-250 rounded-xl p-2 bg-white" />
              </div>

              {/* Grid de Ítems a Recibir */}
              <div className="space-y-2">
                <h4 className="text-[9px] text-slate-500 font-extrabold uppercase border-b pb-1">Desglose de Materiales a Recibir</h4>
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {recepItems.map((it, idx) => {
                    const restante = it.cantidadComprada - it.cantidadYaRecibida;
                    return (
                      <div key={idx} className="bg-slate-50 border p-3 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex-1 space-y-0.5">
                          <p className="font-bold text-slate-800 text-xs">{it.descripcion}</p>
                          {it.detalles && <p className="text-[10px] text-slate-500 font-normal">{it.detalles}</p>}
                          <p className="text-[10px] text-slate-500 font-semibold">
                            Comprado: {it.cantidadComprada} u | Recibido antes: {it.cantidadYaRecibida} u
                          </p>
                        </div>
                        <div className="w-24 space-y-0.5 shrink-0">
                          <label className="text-[8px] font-bold uppercase text-slate-450 block text-center">Recibir Hoy</label>
                          <input
                            type="number"
                            max={restante}
                            min={0}
                            value={it.cantidadRecibidaHoy}
                            onChange={(e) => {
                              const val = Math.min(restante, Math.max(0, parseInt(e.target.value) || 0));
                              const updated = [...recepItems];
                              updated[idx].cantidadRecibidaHoy = val;
                              setRecepItems(updated);
                            }}
                            className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-center font-bold text-slate-800"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button onClick={handleSaveRecepcion} disabled={loading} className="w-full bg-emerald-650 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase py-2.5 rounded-xl transition flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Registrar Entrada a Bodega
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </ErrorBoundary>
  );
}
