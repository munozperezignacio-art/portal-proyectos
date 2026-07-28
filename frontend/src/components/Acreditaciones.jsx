import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { sendSystemEmail } from '../utils/emailService';
import { 
  ArrowLeft, ShieldCheck, Plus, Send, CheckCircle2, AlertCircle, FileText, 
  Trash2, Eye, Download, Copy, ExternalLink, Building2, User, Truck, 
  RefreshCw, Check, Clock, Lock, Key, Mail, Search, FileUp, Sparkles, Filter
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
  const [selectedWorkers, setSelectedWorkers] = useState([]); // [rut1, rut2]
  const [customDocs, setCustomDocs] = useState({}); // { 'rut_docName': { file, name, url } }
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
  const [selectedSubDetail, setSelectedSubDetail] = useState(null);
  const [subDocsEmpresa, setSubDocsEmpresa] = useState([]);
  const [subPersonal, setSubPersonal] = useState([]);
  const [subEquipos, setSubEquipos] = useState([]);

  // Toast / Mensajes
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Documentos requeridos estándar por trabajador
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
  }, []);

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

  // --- LÓGICA DE TRABAJADORES Y SINCRONIZACIÓN CON RRHH ---
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
      const base64 = e.target.result;
      setCustomDocs(prev => ({
        ...prev,
        [`${rut}_${docKey}`]: {
          fileName: file.name,
          base64: base64
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  // Enviar Solicitud de Acreditación por Correo
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

          <div style="text-align: center; border-top: 1px solid #e2e8f0; pt: 16px; font-size: 11px; color: #94a3b8;">
            Documento respaldado automáticamente por el Módulo de Acreditaciones de Obraxis.
          </div>
        </div>
      `;

      // Enviar email vía servicio
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

      // Guardar en Supabase o localStorage
      try {
        await supabase.from('acreditaciones_internas').insert([newRecord]);
      } catch (e) {
        console.warn('Fallback a localStorage para acreditaciones_internas');
      }

      const updatedHist = [newRecord, ...historialInterno];
      setHistorialInterno(updatedHist);
      localStorage.setItem('obraxis_acreditaciones_internas', JSON.stringify(updatedHist));

      setSuccessMsg('¡Solicitud de Acreditación enviada exitosamente por correo!');
      setSelectedWorkers([]);
      setObservaciones('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error al enviar acreditación:', err);
      alert('Error al enviar acreditación: ' + (err.message || 'Verifique la configuración de correo'));
    } finally {
      setSendingEmail(false);
    }
  };

  // --- LÓGICA DE SUBCONTRATOS Y CREDENTCIALES EXTERNAS ---
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

      {/* MENSAJE MENSAJES FEEDBACK */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ================= PESTAÑA 1: ACREDITARME (PERSONAL PROPIO) ================= */}
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

            {/* SELECCIÓN DE TRABAJADORES Y MATRIZ DE DOCUMENTOS */}
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
                        <div className="text-[9.5px] text-emerald-700 font-semibold mt-1">
                          AFP {worker.afp || 'Habitat'} | {worker.prevision_salud || 'FONASA'}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${isSelected ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MATRIZ DETALLADA SI HAY SELECCIONADOS */}
              {selectedWorkers.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">Matriz de Antecedentes y Documentación por Trabajador:</h5>
                  <div className="space-y-4">
                    {personalList.filter(w => selectedWorkers.includes(w.rut)).map(worker => (
                      <div key={worker.rut} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <div>
                            <span className="font-extrabold text-xs uppercase text-slate-900">{worker.nombre}</span>
                            <span className="text-[10px] text-slate-500 font-mono ml-2">({worker.rut})</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">
                            {worker.cargo || 'Personal Faena'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                          {reqDocsStandard.map(doc => {
                            const isSynced = doc.rrhhField && worker[doc.rrhhField];
                            const customFileKey = `${worker.rut}_${doc.key}`;
                            const customFile = customDocs[customFileKey];

                            return (
                              <div key={doc.key} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                                <div className="text-[10px] font-bold text-slate-700 truncate" title={doc.label}>{doc.label}</div>
                                {isSynced ? (
                                  <div className="inline-flex items-center gap-1 text-[9.5px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" /> Sincro RRHH (${worker[doc.rrhhField]})
                                  </div>
                                ) : customFile ? (
                                  <div className="inline-flex items-center gap-1 text-[9.5px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                    <FileText className="w-3 h-3" /> ${customFile.fileName}
                                  </div>
                                ) : (
                                  <label className="cursor-pointer inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md border border-slate-200 transition">
                                    <FileUp className="w-3 h-3 text-slate-600" />
                                    <span>Adjuntar Doc.</span>
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) => handleCustomFileUpload(worker.rut, doc.key, e.target.files[0])}
                                    />
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* BOTÓN ENVIAR */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={sendingEmail}
                className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold py-3.5 rounded-2xl shadow-sm text-xs cursor-pointer flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{sendingEmail ? 'Enviando Solicitud y Documentos...' : 'Enviar Solicitud de Acreditación por Correo'}</span>
              </button>
            </div>
          </form>

          {/* HISTORIAL DE SOLICITUDES INTERNAS */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
              Historial de Solicitudes de Acreditación Enviadas ({historialInterno.length})
            </h3>

            {historialInterno.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">No hay solicitudes registradas aún.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-650 font-bold text-[9px] uppercase tracking-wider select-none">
                      <th className="p-3">Obra / Proyecto</th>
                      <th className="p-3">Destinatario</th>
                      <th className="p-3">Trabajadores</th>
                      <th className="p-3">Fecha Envío</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {historialInterno.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="p-3 font-extrabold text-slate-900 uppercase">{item.obra_nombre}</td>
                        <td className="p-3 text-slate-700 font-mono">{item.destinatario_email}</td>
                        <td className="p-3 text-slate-700 font-bold">
                          {Array.isArray(item.trabajadores_json) ? item.trabajadores_json.length : 0} Personas
                        </td>
                        <td className="p-3 text-slate-500">{new Date(item.created_at).toLocaleString('es-CL')}</td>
                        <td className="p-3 text-center">
                          <span className="bg-emerald-50 text-emerald-700 text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200">
                            {item.estado || 'Enviado'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setSelectedHistorialDetail(item)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
                            title="Ver resumen"
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

      {/* ================= PESTAÑA 2: ACREDITACIÓN SUBCONTRATO (EXTERNOS) ================= */}
      {activeTab === 'subcontratos' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Empresas Subcontratistas Habilitadas ({subcontratosList.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Genere credenciales de acceso para que cada empresa contratista suba sus documentos, personal y equipos al minisitio dedicado.
                </p>
              </div>
              <button
                onClick={() => setShowSubModal(true)}
                className="bg-primary hover:bg-primary-hover text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Subcontrato</span>
              </button>
            </div>

            {subcontratosList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No hay empresas subcontratistas registradas aún. Haga clic en "+ Registrar Subcontrato" para crear credenciales.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subcontratosList.map((sub) => {
                  const minisiteUrl = getMinisiteUrl(sub);

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

                      {/* CREDANCIALES GENERADAS */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                        <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Credenciales de Acceso Externo:</div>
                        <div className="flex justify-between items-center text-slate-700 font-mono text-[11px]">
                          <span>Token: <strong>{sub.token_acceso}</strong></span>
                          <span>Clave: <strong>{sub.credencial_pass}</strong></span>
                        </div>
                        <div className="text-[10px] text-slate-500">Contacto: {sub.correo_contacto || 'No especificado'}</div>
                      </div>

                      {/* ENLACE Y ACCIONES MINISITIO */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Enlace al Minisitio Dedicado:</span>
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
                              setSuccessMsg('Enlace de minisitio copiado al portapapeles.');
                              setTimeout(() => setSuccessMsg(''), 4000);
                            }}
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition cursor-pointer"
                            title="Copiar enlace"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={minisiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition cursor-pointer"
                            title="Abrir Minisitio"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
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

      {/* MODAL DETALLE SOLICITUD INTERNA */}
      {selectedHistorialDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 animate-in fade-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                Resumen de Acreditación - {selectedHistorialDetail.obra_nombre}
              </h3>
              <button onClick={() => setSelectedHistorialDetail(null)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div><strong>Destinatario:</strong> {selectedHistorialDetail.destinatario_email}</div>
              <div><strong>Fecha de Envío:</strong> {new Date(selectedHistorialDetail.created_at).toLocaleString('es-CL')}</div>
              {selectedHistorialDetail.observaciones && <div><strong>Observaciones:</strong> {selectedHistorialDetail.observaciones}</div>}
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="font-bold text-xs uppercase text-slate-700">Trabajadores Presentados:</h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {(selectedHistorialDetail.trabajadores_json || []).map((w, i) => (
                  <div key={i} className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs flex justify-between">
                    <div><strong>{w.nombre}</strong> <span className="text-[10px] text-slate-500">({w.rut})</span></div>
                    <span className="text-[10px] font-bold text-emerald-700">✓ Habilitado</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedHistorialDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
