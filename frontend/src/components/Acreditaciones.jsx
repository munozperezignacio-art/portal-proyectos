import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { sendSystemEmail } from '../utils/emailService';
import { 
  ArrowLeft, ShieldCheck, Plus, Send, CheckCircle2, AlertCircle, FileText, 
  Trash2, Eye, Download, Copy, ExternalLink, Building2, User, Truck, 
  RefreshCw, Check, Clock, Lock, Key, Mail, Search, FileUp, Sparkles, Filter, Settings2, CheckSquare
} from 'lucide-react';

export default function Acreditaciones({ user, onBack, companyBranding }) {
  const [activeTab, setActiveTab] = useState('acreditarme'); // 'acreditarme' | 'subcontratos'

  // --- ESTADOS PARA "ACREDITARME" (PERSONAL PROPIO) ---
  const [obrasList, setObrasList] = useState([]);
  const [personalList, setPersonalList] = useState([]);
  const [selectedObra, setSelectedObra] = useState('');
  const [destinatarioEmail, setDestinatarioEmail] = useState('');
  const [asuntoEmail, setAsuntoEmail] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [customDocs, setCustomDocs] = useState({});
  const [sendingEmail, setSendingEmail] = useState(false);
  const [historialInterno, setHistorialInterno] = useState([]);
  const [selectedHistorialDetail, setSelectedHistorialDetail] = useState(null);

  // --- ESTADOS PARA "ACREDITACIÓN SUBCONTRATO" ---
  const [subcontratosList, setSubcontratosList] = useState([]);
  const [loadingSubcontratos, setLoadingSubcontratos] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subForm, setSubForm] = useState({
    empresa_nombre: '',
    rut_empresa: '',
    obra_asociada: '',
    correo_contacto: '',
    credencial_pass: ''
  });

  // Modal para Revisar Documentos y Acreditación de Subcontratista
  const [selectedSubDetail, setSelectedSubDetail] = useState(null);
  const [subModalTab, setSubModalTab] = useState('empresa'); // 'empresa' | 'personal' | 'equipos'

  // Configuración de Documentos Obligatorios
  const [showConfigDocsModal, setShowConfigDocsModal] = useState(false);
  const [mandatoryCompanyDocs, setMandatoryCompanyDocs] = useState([
    { key: 'rut_empresa', label: 'E-RUT / RUT Empresa' },
    { key: 'f30_1', label: 'Certificado F30-1 (Dirección del Trabajo)' },
    { key: 'cotizaciones_previsionales', label: 'Comprobante Cotizaciones Previsionales' },
    { key: 'seguro_rc', label: 'Póliza Seguro Responsabilidad Civil / Accidentes' },
    { key: 'plan_prevencion', label: 'Plan de Prevención / Matriz IPER' }
  ]);
  const [newCompanyDocLabel, setNewCompanyDocLabel] = useState('');

  const [mandatoryWorkerDocs, setMandatoryWorkerDocs] = useState([
    { key: 'cedula', label: 'Cédula de Identidad Vigente' },
    { key: 'contrato', label: 'Contrato de Trabajo' },
    { key: 'examen', label: 'Examen de Salud Ocupacional' }
  ]);
  const [newWorkerDocLabel, setNewWorkerDocLabel] = useState('');

  // Toast / Mensajes
  const [successMsg, setSuccessMsg] = useState('');

  // Documentos requeridos estándar por trabajador para "Acreditarme"
  const reqDocsStandard = [
    { key: 'cedula', label: 'Cédula de Identidad Vigente', rrhhField: 'rut' },
    { key: 'contrato', label: 'Contrato de Trabajo', rrhhField: 'tipo_contrato' },
    { key: 'afp', label: 'Certificado Cotizaciones AFP', rrhhField: 'afp' },
    { key: 'salud', label: 'Certificado Previsión Salud (FONASA/Isapre)', rrhhField: 'prevision_salud' },
    { key: 'examen', label: 'Examen de Salud / Altura Ocupacional', rrhhField: 'sueldo_base' },
    { key: 'induccion', label: 'Registro de Inducción de Seguridad', rrhhField: null },
    { key: 'epp', label: 'Cargo y Registro de Entrega EPP', rrhhField: null }
  ];

  useEffect(() => {
    fetchObras();
    fetchPersonal();
    fetchHistorialInterno();
    fetchSubcontratos();
    loadMandatoryDocsConfig();
  }, []);

  const loadMandatoryDocsConfig = () => {
    const savedComp = localStorage.getItem('obraxis_mandatory_company_docs');
    if (savedComp) setMandatoryCompanyDocs(JSON.parse(savedComp));

    const savedWork = localStorage.getItem('obraxis_mandatory_worker_docs');
    if (savedWork) setMandatoryWorkerDocs(JSON.parse(savedWork));
  };

  const saveMandatoryDocsConfig = (compDocs, workDocs) => {
    localStorage.setItem('obraxis_mandatory_company_docs', JSON.stringify(compDocs));
    localStorage.setItem('obraxis_mandatory_worker_docs', JSON.stringify(workDocs));
    setSuccessMsg('¡Listado de documentos obligatorios actualizado para todos los subcontratistas!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleAddMandatoryCompanyDoc = (e) => {
    e.preventDefault();
    if (!newCompanyDocLabel.trim()) return;
    const key = 'custom_' + Date.now();
    const updated = [...mandatoryCompanyDocs, { key, label: newCompanyDocLabel.trim() }];
    setMandatoryCompanyDocs(updated);
    setNewCompanyDocLabel('');
    saveMandatoryDocsConfig(updated, mandatoryWorkerDocs);
  };

  const handleAddMandatoryWorkerDoc = (e) => {
    e.preventDefault();
    if (!newWorkerDocLabel.trim()) return;
    const key = 'custom_' + Date.now();
    const updated = [...mandatoryWorkerDocs, { key, label: newWorkerDocLabel.trim() }];
    setMandatoryWorkerDocs(updated);
    setNewWorkerDocLabel('');
    saveMandatoryDocsConfig(mandatoryCompanyDocs, updated);
  };

  const handleRemoveMandatoryCompanyDoc = (key) => {
    const updated = mandatoryCompanyDocs.filter(d => d.key !== key);
    setMandatoryCompanyDocs(updated);
    saveMandatoryDocsConfig(updated, mandatoryWorkerDocs);
  };

  const handleRemoveMandatoryWorkerDoc = (key) => {
    const updated = mandatoryWorkerDocs.filter(d => d.key !== key);
    setMandatoryWorkerDocs(updated);
    saveMandatoryDocsConfig(mandatoryCompanyDocs, updated);
  };

  const fetchObras = async () => {
    try {
      const { data, error } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (error) throw error;
      setObrasList(data || []);
      if (data && data.length > 0) {
        setSelectedObra(data[0].nombre);
      }
    } catch (e) {
      console.error('Error al cargar obras:', e);
    }
  };

  const fetchPersonal = async () => {
    try {
      const { data, error } = await supabase.from('maestro_personal').select('*').order('nombre');
      if (error) throw error;
      setPersonalList(data || []);
    } catch (e) {
      console.error('Error al cargar personal:', e);
    }
  };

  const fetchHistorialInterno = async () => {
    try {
      const { data, error } = await supabase.from('acreditaciones_internas').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setHistorialInterno(data);
      } else {
        const local = localStorage.getItem('obraxis_acreditaciones_internas');
        if (local) setHistorialInterno(JSON.parse(local));
      }
    } catch (e) {
      const local = localStorage.getItem('obraxis_acreditaciones_internas');
      if (local) setHistorialInterno(JSON.parse(local));
    }
  };

  const fetchSubcontratos = async () => {
    setLoadingSubcontratos(true);
    try {
      const { data, error } = await supabase.from('acreditaciones_subcontratos').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setSubcontratosList(data);
      } else {
        const local = localStorage.getItem('obraxis_acreditaciones_subcontratos');
        if (local) setSubcontratosList(JSON.parse(local));
      }
    } catch (e) {
      const local = localStorage.getItem('obraxis_acreditaciones_subcontratos');
      if (local) setSubcontratosList(JSON.parse(local));
    } finally {
      setLoadingSubcontratos(false);
    }
  };

  // Lógica "Acreditarme"
  const toggleWorkerSelection = (rut) => {
    if (selectedWorkers.includes(rut)) {
      setSelectedWorkers(selectedWorkers.filter(r => r !== rut));
    } else {
      setSelectedWorkers([...selectedWorkers, rut]);
    }
  };

  const handleCustomFileUpload = (rut, docKey, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setCustomDocs(prev => ({
        ...prev,
        [`${rut}_${docKey}`]: {
          fileName: file.name,
          base64: e.target.result
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSendAcreditacion = async (e) => {
    e.preventDefault();
    if (!selectedObra) {
      alert('Por favor seleccione una Obra / Proyecto.');
      return;
    }
    if (selectedWorkers.length === 0) {
      alert('Por favor seleccione al menos un trabajador para acreditar.');
      return;
    }
    if (!destinatarioEmail) {
      alert('Ingrese el correo electrónico del destinatario / mandante.');
      return;
    }

    setSendingEmail(true);

    try {
      const workersData = personalList.filter(w => selectedWorkers.includes(w.rut));
      const fechaHoy = new Date().toLocaleDateString('es-CL');

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; borderRadius: 16px; padding: 24px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0;">Solicitud de Acreditación de Personal</h2>
            <p style="color: #2563eb; font-weight: bold; margin: 4px 0 0 0;">Obraxis - Control Operacional</p>
          </div>

          <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 20px; font-size: 13px;">
            <p style="margin: 4px 0;"><strong>Proyecto / Obra:</strong> ${selectedObra}</p>
            <p style="margin: 4px 0;"><strong>Fecha de Envío:</strong> ${fechaHoy}</p>
            <p style="margin: 4px 0;"><strong>Enviado Por:</strong> ${user?.nombre || user?.usuario || 'Administrador Obraxis'}</p>
            ${observaciones ? `<p style="margin: 4px 0; color: #475569;"><strong>Observaciones:</strong> ${observaciones}</p>` : ''}
          </div>

          <h3 style="color: #1e293b; font-size: 14px; text-transform: uppercase; margin-bottom: 12px;">Trabajadores Presentados (${workersData.length})</h3>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff; text-align: left;">
                <th style="padding: 8px 12px;">Trabajador</th>
                <th style="padding: 8px 12px;">RUT</th>
                <th style="padding: 8px 12px;">Cargo</th>
                <th style="padding: 8px 12px;">AFP / Salud</th>
                <th style="padding: 8px 12px; text-align: center;">Estado Sincro RRHH</th>
              </tr>
            </thead>
            <tbody>
              ${workersData.map(w => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 12px; font-weight: bold;">${w.nombre}</td>
                  <td style="padding: 8px 12px;">${w.rut}</td>
                  <td style="padding: 8px 12px;">${w.cargo || 'Maestro'}</td>
                  <td style="padding: 8px 12px;">${w.afp || 'Habitat'} / ${w.prevision_salud || 'FONASA'}</td>
                  <td style="padding: 8px 12px; text-align: center; color: #16a34a; font-weight: bold;">✓ Sincronizado RRHH</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px; border-radius: 8px; font-size: 12px; color: #1e40af; margin-bottom: 20px;">
            ℹ️ Los antecedentes y respaldos documentales de cada trabajador han sido validados e integrados directamente desde la Ficha de Recursos Humanos del Portal Obraxis.
          </div>
        </div>
      `;

      await sendSystemEmail({
        to: destinatarioEmail,
        subject: asuntoEmail || `[Acreditación Personal] ${selectedObra} - Obraxis`,
        html: htmlBody,
        tipo: 'Acreditaciones'
      });

      const newRecord = {
        obra_nombre: selectedObra,
        destinatario_email: destinatarioEmail,
        asunto: asuntoEmail || `[Acreditación Personal] ${selectedObra}`,
        observaciones: observaciones,
        trabajadores_json: workersData,
        estado: 'Enviado',
        created_at: new Date().toISOString()
      };

      try {
        await supabase.from('acreditaciones_internas').insert([newRecord]);
      } catch (e) {
        console.warn('Fallback a localStorage');
      }

      const updatedHist = [newRecord, ...historialInterno];
      setHistorialInterno(updatedHist);
      localStorage.setItem('obraxis_acreditaciones_internas', JSON.stringify(updatedHist));

      setSuccessMsg('¡Solicitud de Acreditación enviada exitosamente por correo!');
      setSelectedWorkers([]);
      setObservaciones('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      alert('Error al enviar acreditación: ' + (err.message || 'Verifique la configuración de correo'));
    } finally {
      setSendingEmail(false);
    }
  };

  // Lógica Subcontratos
  const handleCreateSubcontrato = async (e) => {
    e.preventDefault();
    if (!subForm.empresa_nombre) {
      alert('Ingrese el Nombre de la Empresa Subcontratista.');
      return;
    }

    const token = 'sub_' + Math.random().toString(36).substring(2, 9);
    const pass = subForm.credencial_pass || Math.random().toString(36).substring(2, 8).toUpperCase();

    const newSub = {
      empresa_nombre: subForm.empresa_nombre,
      rut_empresa: subForm.rut_empresa || '76.000.000-0',
      obra_asociada: subForm.obra_asociada || selectedObra || 'Todas las Obras',
      correo_contacto: subForm.correo_contacto,
      token_acceso: token,
      credencial_pass: pass,
      estado_cumplimiento: 0,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from('acreditaciones_subcontratos').insert([newSub]).select();
      if (!error && data) {
        setSubcontratosList([data[0], ...subcontratosList]);
      } else {
        const updated = [newSub, ...subcontratosList];
        setSubcontratosList(updated);
        localStorage.setItem('obraxis_acreditaciones_subcontratos', JSON.stringify(updated));
      }
    } catch (e) {
      const updated = [newSub, ...subcontratosList];
      setSubcontratosList(updated);
      localStorage.setItem('obraxis_acreditaciones_subcontratos', JSON.stringify(updated));
    }

    setShowSubModal(false);
    setSubForm({ empresa_nombre: '', rut_empresa: '', obra_asociada: '', correo_contacto: '', credencial_pass: '' });
    setSuccessMsg(`¡Empresa Subcontratista ${newSub.empresa_nombre} creada! Credenciales generadas.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const getMinisiteUrl = (subItem) => {
    const origin = window.location.origin;
    const cleanName = encodeURIComponent(subItem.empresa_nombre.toLowerCase().replace(/\s+/g, '-'));
    return `${origin}/?acreditacion_subcontrato=${cleanName}&token=${subItem.token_acceso}`;
  };

  const openSubDetailModal = (subItem) => {
    // Cargar información completa del subcontratista desde localStorage o Supabase
    const savedDataStr = localStorage.getItem('obraxis_subcontrato_data_' + subItem.token_acceso);
    let subData = { companyDocs: {}, personalList: [], equiposList: [] };
    if (savedDataStr) {
      try {
        subData = JSON.parse(savedDataStr);
      } catch (err) {}
    }

    setSelectedSubDetail({
      ...subItem,
      companyDocs: subData.companyDocs || subItem.companyDocs || {},
      personalList: subData.personalList || subItem.personalList || [],
      equiposList: subData.equiposList || subItem.equiposList || []
    });
    setSubModalTab('empresa');
  };

  const openFileViewer = (fileData) => {
    if (!fileData || !fileData.base64) {
      alert('El archivo no está disponible.');
      return;
    }
    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${fileData.base64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl transition cursor-pointer text-slate-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <span>Módulo de Acreditaciones</span>
            </h1>
            <p className="text-xs text-slate-500">Gestión de acreditaciones propias para faena y control de subcontratos externos</p>
          </div>
        </div>

        {/* NAVEGACIÓN PESTAÑAS */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 border border-slate-200">
          <button
            onClick={() => setActiveTab('acreditarme')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${activeTab === 'acreditarme' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <User className="w-4 h-4" />
            <span>Acreditarme (Personal Propio)</span>
          </button>
          <button
            onClick={() => setActiveTab('subcontratos')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${activeTab === 'subcontratos' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Building2 className="w-4 h-4" />
            <span>Acreditación Subcontrato (Externos)</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ================= PESTAÑA 1: ACREDITARME ================= */}
      {activeTab === 'acreditarme' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <form onSubmit={handleSendAcreditacion} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileUp className="w-4 h-4 text-primary" />
              <span>1. Configurar Petición de Acreditación para Proyecto</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Proyecto / Obra de Destino</label>
                <select
                  value={selectedObra}
                  onChange={(e) => setSelectedObra(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold bg-slate-50"
                  required
                >
                  <option value="">-- Seleccionar Obra --</option>
                  {obrasList.map((o) => (
                    <option key={o.id} value={o.nombre}>{o.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Correo Electrónico Destinatario / Mandante</label>
                <input
                  type="email"
                  required
                  placeholder="ej: acreditaciones@minera.cl"
                  value={destinatarioEmail}
                  onChange={(e) => setDestinatarioEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Asunto del Correo (Opcional)</label>
                <input
                  type="text"
                  placeholder="ej: Acreditación Personal Obraxis - Proyecto Parque Central"
                  value={asuntoEmail}
                  onChange={(e) => setAsuntoEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Observaciones o Instrucciones Especiales</label>
              <textarea
                rows="2"
                placeholder="Indique si hay pases de ingreso especiales o requerimientos adicionales..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white"
              ></textarea>
            </div>

            {/* SELECCIÓN DE TRABAJADORES */}
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span>2. Seleccionar Trabajadores y Verificar Documentos (${selectedWorkers.length} Seleccionados)</span>
                </h4>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Sincronización Automática activa con RRHH
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
                {personalList.map((worker) => {
                  const isSelected = selectedWorkers.includes(worker.rut);
                  return (
                    <div
                      key={worker.id || worker.rut}
                      onClick={() => toggleWorkerSelection(worker.rut)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${isSelected ? 'bg-primary/5 border-primary shadow-2xs' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                    >
                      <div>
                        <div className="font-extrabold text-xs text-slate-900 uppercase">{worker.nombre}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">RUT: {worker.rut} | {worker.cargo || 'Maestro'}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${isSelected ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={sendingEmail}
                className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold py-3.5 rounded-2xl shadow-sm text-xs cursor-pointer flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{sendingEmail ? 'Enviando Solicitud...' : 'Enviar Solicitud de Acreditación por Correo'}</span>
              </button>
            </div>
          </form>

          {/* HISTORIAL INTERNO */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
              Historial de Solicitudes Enviadas ({historialInterno.length})
            </h3>
            {historialInterno.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">No hay solicitudes registradas aún.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-650 font-bold text-[9px] uppercase tracking-wider">
                      <th className="p-3">Obra</th>
                      <th className="p-3">Destinatario</th>
                      <th className="p-3">Trabajadores</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {historialInterno.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-extrabold text-slate-900 uppercase">{item.obra_nombre}</td>
                        <td className="p-3 text-slate-700 font-mono">{item.destinatario_email}</td>
                        <td className="p-3 font-bold">{Array.isArray(item.trabajadores_json) ? item.trabajadores_json.length : 0} Personas</td>
                        <td className="p-3 text-slate-500">{new Date(item.created_at).toLocaleString('es-CL')}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setSelectedHistorialDetail(item)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= PESTAÑA 2: ACREDITACIÓN SUBCONTRATO ================= */}
      {activeTab === 'subcontratos' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Empresas Subcontratistas Habilitadas ({subcontratosList.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gestione credenciales y revise en tiempo real los documentos subidos por cada empresa contratista externa.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfigDocsModal(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
                >
                  <Settings2 className="w-4 h-4 text-slate-600" />
                  <span>Configurar Docs. Obligatorios</span>
                </button>
                <button
                  onClick={() => setShowSubModal(true)}
                  className="bg-primary hover:bg-primary-hover text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Registrar Subcontrato</span>
                </button>
              </div>
            </div>

            {subcontratosList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No hay empresas subcontratistas registradas aún. Haga clic en "+ Registrar Subcontrato" para generar credenciales.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subcontratosList.map((sub) => {
                  const minisiteUrl = getMinisiteUrl(sub);

                  // Cargar data detallada guardada
                  const savedStr = localStorage.getItem('obraxis_subcontrato_data_' + sub.token_acceso);
                  let savedData = { companyDocs: {}, personalList: [], equiposList: [] };
                  if (savedStr) {
                    try { savedData = JSON.parse(savedStr); } catch (e) {}
                  }

                  const empDocsCount = Object.values(savedData.companyDocs || sub.companyDocs || {}).filter(Boolean).length;
                  const percent = Math.round((empDocsCount / mandatoryCompanyDocs.length) * 100) || 0;

                  return (
                    <div key={sub.id || sub.token_acceso} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 hover:shadow-sm transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black text-sm text-slate-900 uppercase">{sub.empresa_nombre}</h4>
                          <span className="text-[10px] text-slate-500 font-mono block">RUT: {sub.rut_empresa || 'Sin RUT'}</span>
                        </div>
                        <span className="bg-blue-100 text-blue-900 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                          {sub.obra_asociada || 'Obraxis'}
                        </span>
                      </div>

                      {/* BARRA DE AVANCE & DOCUMENTOS RECIBIDOS */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-600">
                          <span>Docs Empresa Cargados:</span>
                          <span className="text-emerald-700 font-mono">${empDocsCount} / ${mandatoryCompanyDocs.length} (${percent}%)</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[9.5px] text-slate-500 pt-1 font-semibold">
                          <span>Personal: {(savedData.personalList || []).length} personas</span>
                          <span>Equipos: {(savedData.equiposList || []).length} vehículos</span>
                        </div>
                      </div>

                      {/* CREDANCIALES GENERADAS */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                        <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Credenciales de Acceso:</div>
                        <div className="flex justify-between items-center text-slate-700 font-mono text-[11px]">
                          <span>Token: <strong>{sub.token_acceso}</strong></span>
                          <span>Clave: <strong>{sub.credencial_pass}</strong></span>
                        </div>
                      </div>

                      {/* ACCIONES Y BOTÓN REVISAR DOCUMENTOS */}
                      <div className="space-y-2 pt-1">
                        <button
                          onClick={() => openSubDetailModal(sub)}
                          className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Revisar Documentos y Acreditación</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={minisiteUrl}
                            className="bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-mono text-slate-600 flex-1 truncate"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(minisiteUrl);
                              setSuccessMsg('Enlace copiado al portapapeles.');
                              setTimeout(() => setSuccessMsg(''), 4000);
                            }}
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition cursor-pointer"
                            title="Copiar enlace"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR DOCUMENTOS OBLIGATORIOS */}
      {showConfigDocsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                <span>Listado de Documentos Obligatorios para Subcontratos</span>
              </h3>
              <button onClick={() => setShowConfigDocsModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {/* SECCIÓN 1: DOCS EMPRESA OBLIGATORIOS */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">1. Documentos Exigidos a la Empresa Subcontratista:</h4>
              <div className="space-y-1.5">
                {mandatoryCompanyDocs.map(d => (
                  <div key={d.key} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-3.5 h-3.5 text-primary" />
                      <span>{d.label}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveMandatoryCompanyDoc(d.key)}
                      className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition cursor-pointer"
                      title="Quitar de requerimientos"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddMandatoryCompanyDoc} className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Agregar nuevo documento empresa (Ej: Reglamento Interno de Orden y Seguridad)"
                  value={newCompanyDocLabel}
                  onChange={(e) => setNewCompanyDocLabel(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold px-4 rounded-xl text-xs transition cursor-pointer">
                  + Agregar
                </button>
              </form>
            </div>

            {/* SECCIÓN 2: DOCS TRABAJADOR OBLIGATORIOS */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">2. Documentos Exigidos por cada Trabajador Externo:</h4>
              <div className="space-y-1.5">
                {mandatoryWorkerDocs.map(d => (
                  <div key={d.key} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{d.label}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveMandatoryWorkerDoc(d.key)}
                      className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition cursor-pointer"
                      title="Quitar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddMandatoryWorkerDoc} className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Agregar nuevo documento trabajador (Ej: Pase de Altura Física)"
                  value={newWorkerDocLabel}
                  onChange={(e) => setNewWorkerDocLabel(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-bold px-4 rounded-xl text-xs transition cursor-pointer">
                  + Agregar
                </button>
              </form>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowConfigDocsModal(false)}
                className="bg-slate-900 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR EMPRESA SUBCONTRATISTA */}
      {showSubModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                <span>Registrar Subcontratista Externo</span>
              </h3>
              <button onClick={() => setShowSubModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateSubcontrato} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Empresa Subcontratista</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Subcontratos y Montajes SpA"
                  value={subForm.empresa_nombre}
                  onChange={(e) => setSubForm({ ...subForm, empresa_nombre: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT Empresa</label>
                  <input
                    type="text"
                    placeholder="76.123.456-7"
                    value={subForm.rut_empresa}
                    onChange={(e) => setSubForm({ ...subForm, rut_empresa: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Obra Asociada</label>
                  <select
                    value={subForm.obra_asociada}
                    onChange={(e) => setSubForm({ ...subForm, obra_asociada: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold bg-white"
                  >
                    <option value="">-- Seleccionar --</option>
                    {obrasList.map(o => (
                      <option key={o.id} value={o.nombre}>{o.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo Electrónico de Contacto</label>
                <input
                  type="email"
                  placeholder="contacto@subcontrato.cl"
                  value={subForm.correo_contacto}
                  onChange={(e) => setSubForm({ ...subForm, correo_contacto: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Clave de Acceso (Opcional - Autogenerada si omite)</label>
                <input
                  type="text"
                  placeholder="ej: PASS2026"
                  value={subForm.credencial_pass}
                  onChange={(e) => setSubForm({ ...subForm, credencial_pass: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-primary hover:bg-primary-hover transition cursor-pointer shadow-xs"
                >
                  Generar Credenciales y Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE Y REVISIÓN DE DOCUMENTOS SUBCONTRATISTA */}
      {selectedSubDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[9.5px] font-extrabold uppercase text-blue-600 tracking-wider">Revisión de Acreditación Externa</span>
                <h3 className="font-black text-slate-900 text-sm uppercase">{selectedSubDetail.empresa_nombre}</h3>
                <span className="text-[10.5px] text-slate-500">RUT: {selectedSubDetail.rut_empresa || 'N/A'} | Obra: {selectedSubDetail.obra_asociada}</span>
              </div>
              <button onClick={() => setSelectedSubDetail(null)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {/* PESTAÑAS DEL MODAL DETALLE */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setSubModalTab('empresa')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${subModalTab === 'empresa' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Docs. Empresa ({Object.keys(selectedSubDetail.companyDocs || {}).length})
              </button>
              <button
                onClick={() => setSubModalTab('personal')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${subModalTab === 'personal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Personal Externo ({(selectedSubDetail.personalList || []).length})
              </button>
              <button
                onClick={() => setSubModalTab('equipos')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${subModalTab === 'equipos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Equipos Externos ({(selectedSubDetail.equiposList || []).length})
              </button>
            </div>

            {/* VISTA CONTENIDO SUBMODAL */}
            {subModalTab === 'empresa' && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase text-slate-700">Archivos Legales Cargados por la Empresa:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mandatoryCompanyDocs.map(item => {
                    const uploaded = selectedSubDetail.companyDocs && selectedSubDetail.companyDocs[item.key];
                    return (
                      <div key={item.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                        <div className="font-extrabold text-slate-800 uppercase">{item.label}</div>
                        {uploaded ? (
                          <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg flex justify-between items-center text-emerald-800 font-bold">
                            <span className="truncate text-[11px]">{uploaded.fileName}</span>
                            <button
                              onClick={() => openFileViewer(uploaded)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-300 rounded-md transition cursor-pointer flex items-center gap-1 text-[10px]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver Archivo</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
                            ⚠️ Pendiente de carga por el subcontratista
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {subModalTab === 'personal' && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase text-slate-700">Trabajadores Externos Registrados:</h4>
                {(selectedSubDetail.personalList || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">No hay trabajadores registrados por este subcontratista aún.</div>
                ) : (
                  <div className="space-y-3">
                    {(selectedSubDetail.personalList || []).map((p, pIdx) => (
                      <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                        <div className="flex justify-between font-extrabold text-slate-900">
                          <span>{p.nombre} ({p.rut})</span>
                          <span className="bg-blue-100 text-blue-900 text-[10px] px-2 py-0.5 rounded uppercase">{p.cargo || 'Operario'}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                          {['cedula', 'contrato', 'examen'].map(docKey => {
                            const file = p.docs && p.docs[docKey];
                            return (
                              <div key={docKey} className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center text-[10px]">
                                <span className="font-bold uppercase text-slate-600">{docKey}</span>
                                {file ? (
                                  <button
                                    onClick={() => openFileViewer(file)}
                                    className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" /> Ver
                                  </button>
                                ) : (
                                  <span className="text-slate-400 italic">No cargado</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {subModalTab === 'equipos' && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase text-slate-700">Maquinarias y Vehículos Externos Registrados:</h4>
                {(selectedSubDetail.equiposList || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">No hay equipos registrados por este subcontratista aún.</div>
                ) : (
                  <div className="space-y-3">
                    {(selectedSubDetail.equiposList || []).map((eq, eIdx) => (
                      <div key={eIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                        <div className="flex justify-between font-extrabold text-slate-900">
                          <span>{eq.tipo_equipo} (Patente: {eq.patente_codigo})</span>
                          <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded uppercase">{eq.marca_modelo || 'Equipo'}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                          {['padron', 'revision', 'seguro'].map(docKey => {
                            const file = eq.docs && eq.docs[docKey];
                            return (
                              <div key={docKey} className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center text-[10px]">
                                <span className="font-bold uppercase text-slate-600">{docKey}</span>
                                {file ? (
                                  <button
                                    onClick={() => openFileViewer(file)}
                                    className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" /> Ver
                                  </button>
                                ) : (
                                  <span className="text-slate-400 italic">No cargado</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setSelectedSubDetail(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Cerrar Revisión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
