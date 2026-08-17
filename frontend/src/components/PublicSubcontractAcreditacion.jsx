import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { formatRut } from '../utils/rutUtils';
import PublicObraxisHeader from './PublicObraxisHeader';
import SubcontractOperationsPortal from './SubcontractOperationsPortal';
import { 
  Building2, ShieldCheck, User, Truck, FileUp, CheckCircle2, Lock,
  Plus, FileText, Key, Eye, MessageSquare, Save, RefreshCw
} from 'lucide-react';

export default function PublicSubcontractAcreditacion({ token }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [subInfo, setSubInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('empresa'); // 'empresa' | 'personal' | 'equipos'

  // Documentos Empresa
  const [companyDocs, setCompanyDocs] = useState({});

  // Personal Externo
  const [personalList, setPersonalList] = useState([]);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [personForm, setPersonForm] = useState({ nombre: '', rut: '', cargo: '' });

  // Equipos Externos
  const [equiposList, setEquiposList] = useState([]);
  const [showEquipoModal, setShowEquipoModal] = useState(false);
  const [equipoForm, setEquipoForm] = useState({ tipo_equipo: '', patente_codigo: '', marca_modelo: '' });

  // Listados dinámicos de documentos obligatorios (sincronizados directamente con Obraxis)
  const [mandatoryCompanyDocs, setMandatoryCompanyDocs] = useState([
    { key: 'rut_empresa', label: 'E-RUT / RUT Empresa' },
    { key: 'f30_1', label: 'Certificado F30-1 (Dirección del Trabajo)' },
    { key: 'cotizaciones_previsionales', label: 'Comprobante Cotizaciones Previsionales' },
    { key: 'seguro_rc', label: 'Póliza Seguro Responsabilidad Civil / Accidentes' },
    { key: 'plan_prevencion', label: 'Plan de Prevención / Matriz IPER' }
  ]);

  const [mandatoryWorkerDocs, setMandatoryWorkerDocs] = useState([
    {
        "key": "cedula",
        "label": "Cédula de Identidad Vigente"
    },
    {
        "key": "contrato",
        "label": "Contrato de Trabajo"
    },
    {
        "key": "afp",
        "label": "Certificado Cotizaciones AFP"
    },
    {
        "key": "salud",
        "label": "Certificado Previsión Salud (FONASA/Isapre)"
    },
    {
        "key": "examen",
        "label": "Examen de Salud / Altura Ocupacional"
    },
    {
        "key": "induccion",
        "label": "Registro de Inducción de Seguridad"
    },
    {
        "key": "epp",
        "label": "Cargo y Registro de Entrega EPP"
    }
]);

  const [mandatoryEquipoDocs, setMandatoryEquipoDocs] = useState([
    { key: 'padron', label: 'Padrón / Certificado de Dominio' },
    { key: 'revision', label: 'Revisión Técnica / Homologación Vigente' },
    { key: 'seguro', label: 'Póliza Seguro de Equipo / SOAP' },
    { key: 'checklist', label: 'Check-list Pre-operacional de Seguridad' }
  ]);

  // Mensaje y estado de guardado
  const [successMsg, setSuccessMsg] = useState('');
  const [accessError, setAccessError] = useState('');
  const [savingSync, setSavingSync] = useState(false);

  useEffect(() => {
    setAuthenticated(false);
    setSubInfo(null);
    setPassInput('');
    setAccessError('');
    setCompanyDocs({});
    setPersonalList([]);
    setEquiposList([]);
  }, [token]);

  const invokePortal = async (action, payload = {}) => {
    const { data, error } = await supabase.functions.invoke('acreditacion-publica', { body: { tipo: 'subcontrato', action, token, clave: passInput.trim().toUpperCase(), ...payload } });
    let serverMessage = data?.error || '';
    if (!serverMessage && error?.context && typeof error.context.json === 'function') {
      try {
        const response = await error.context.json();
        serverMessage = response?.error || '';
      } catch {
        // La respuesta no contenía JSON utilizable.
      }
    }
    if (error || data?.error) throw new Error(serverMessage || 'No fue posible conectar con el portal. Intenta nuevamente.');
    return data;
  };

  // BOTÓN DE GUARDAR Y SINCRONIZAR CON EL PORTAL OBRAXIS
  const handleSaveAndSyncPortal = async () => {
    if (!token) return;
    setSavingSync(true);

    const empApprovedCount = Object.values(companyDocs).filter(d => d && d.status === 'Aprobado').length;
    const progressPercent = Math.round((empApprovedCount / mandatoryCompanyDocs.length) * 100) || 0;

    try {
      await invokePortal('guardar', { companyDocs, personalList, equiposList, progressPercent });
      setSuccessMsg('¡Acreditación guardada y sincronizada exitosamente con el Portal Obraxis!');
    } catch (err) {
      setSuccessMsg('');
      alert(err.message);
    } finally {
      setSavingSync(false);
    }
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAccessError('');
    try {
      const response = await invokePortal('ingresar');
      const entity = response.entidad;
      const config = response.configuracion || {};
      setSubInfo(entity);
      setCompanyDocs(entity.companyDocs || {});
      setPersonalList(entity.personalList || []);
      setEquiposList(entity.equiposList || []);
      if (config.company_docs?.length) setMandatoryCompanyDocs(config.company_docs);
      if (config.worker_docs?.length) setMandatoryWorkerDocs(config.worker_docs);
      if (config.equipo_docs?.length) setMandatoryEquipoDocs(config.equipo_docs);
      setAuthenticated(true);
    } catch (error) {
      setAccessError(error.message);
    }
  };

  const handleFileUpload = (category, key, file, itemIndex = null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = {
        fileName: file.name,
        base64: e.target.result,
        uploadedAt: new Date().toLocaleDateString('es-CL'),
        status: 'Pendiente de Revisión',
        motivo_rechazo: null
      };

      let nextCompanyDocs = { ...companyDocs };
      let nextPersonalList = [...personalList];
      let nextEquiposList = [...equiposList];

      if (category === 'empresa') {
        nextCompanyDocs[key] = fileData;
        setCompanyDocs(nextCompanyDocs);
      } else if (category === 'personal' && itemIndex !== null) {
        nextPersonalList[itemIndex].docs = { ...(nextPersonalList[itemIndex].docs || {}), [key]: fileData };
        setPersonalList(nextPersonalList);
      } else if (category === 'equipos' && itemIndex !== null) {
        nextEquiposList[itemIndex].docs = { ...(nextEquiposList[itemIndex].docs || {}), [key]: fileData };
        setEquiposList(nextEquiposList);
      }

      setSuccessMsg(`¡Documento ${file.name} cargado! Recuerde presionar "Guardar y Sincronizar" para enviar al portal.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPerson = (e) => {
    e.preventDefault();
    if (!personForm.nombre || !personForm.rut) {
      alert('Nombre y RUT son obligatorios');
      return;
    }
    const formattedWorkerRut = formatRut(personForm.rut);
    const nextPersonalList = [...personalList, { ...personForm, rut: formattedWorkerRut, docs: {} }];
    setPersonalList(nextPersonalList);

    setPersonForm({ nombre: '', rut: '', cargo: '' });
    setShowPersonModal(false);
    setSuccessMsg(`¡Trabajador ${personForm.nombre} (${formattedWorkerRut}) registrado!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleAddEquipo = (e) => {
    e.preventDefault();
    if (!equipoForm.tipo_equipo || !equipoForm.patente_codigo) {
      alert('Tipo de equipo y patente/código son obligatorios');
      return;
    }
    const nextEquiposList = [...equiposList, { ...equipoForm, docs: {} }];
    setEquiposList(nextEquiposList);

    setEquipoForm({ tipo_equipo: '', patente_codigo: '', marca_modelo: '' });
    setShowEquipoModal(false);
    setSuccessMsg('¡Equipo registrado!');
    setTimeout(() => setSuccessMsg(''), 4000);
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

  const empApprovedCount = Object.values(companyDocs).filter(d => d && d.status === 'Aprobado').length;
  const progressPercent = Math.round((empApprovedCount / mandatoryCompanyDocs.length) * 100) || 0;

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col p-4">
        <div className="w-full"><PublicObraxisHeader /></div>
        <div className="flex flex-1 items-center justify-center">
        <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full border border-slate-100/20 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">
              {subInfo ? subInfo.empresa_nombre : 'Acreditación Subcontratista'}
            </h2>
            <p className="text-xs text-slate-500">
              Minisitio Oficial Obraxis para la acreditación de empresa, personal y equipos.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {accessError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700">
                {accessError}
              </div>
            )}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Clave de Acceso Corporativa
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Ingrese su clave otorgada por Obraxis"
                  value={passInput}
                  onChange={(e) => setPassInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 pr-10 text-xs font-bold text-slate-800 focus:outline-none focus:border-primary"
                />
                <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold py-3 rounded-xl shadow-sm text-xs cursor-pointer flex items-center justify-center gap-2 transition"
            >
              <Lock className="w-4 h-4" />
              <span>Ingresar al Portal de Acreditación</span>
            </button>
          </form>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6">
      <PublicObraxisHeader />
      {/* HEADER MINISITIO */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black text-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-blue-600 tracking-wider">Portal de Acreditación Subcontratos</span>
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-wide">{subInfo?.empresa_nombre}</h1>
            <p className="text-xs text-slate-500">RUT: <strong>{formatRut(subInfo?.rut_empresa)}</strong> | Obra: <strong>{subInfo?.obra_asociada || 'Obraxis Faena'}</strong></p>
          </div>
        </div>

        {/* BOTÓN GUARDAR Y SINCRONIZAR + NAVEGACIÓN PESTAÑAS */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSaveAndSyncPortal}
            disabled={savingSync}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
          >
            {savingSync ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>💾 Guardar y Sincronizar con Obraxis</span>
          </button>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('empresa')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${activeTab === 'empresa' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Building2 className="w-4 h-4" />
              <span>1. Docs. Empresa</span>
            </button>
            <button
              onClick={() => setActiveTab('personal')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${activeTab === 'personal' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <User className="w-4 h-4" />
              <span>2. Personal ({personalList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('equipos')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${activeTab === 'equipos' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Truck className="w-4 h-4" />
              <span>3. Equipos ({equiposList.length})</span>
            </button>
            <button onClick={() => setActiveTab('operacion')} className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${activeTab === 'operacion' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>4. Operación</button>
          </div>
        </div>
      </div>

      {/* BARRA DE AVANCE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
        <div className="text-xs font-black text-slate-700 uppercase">Estado de Cumplimiento Empresa:</div>
        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
          <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <span className="text-xs font-extrabold text-emerald-700 font-mono">{empApprovedCount} de {mandatoryCompanyDocs.length} Docs Aprobados ({progressPercent}%)</span>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeTab === 'operacion' && <SubcontractOperationsPortal subInfo={subInfo} />}

      {/* ================= PESTAÑA 1: DOCUMENTOS EMPRESA ================= */}
      {activeTab === 'empresa' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Documentación Legal Exigida por Obraxis a la Empresa Subcontratista
            </h3>
            <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              ✓ Sincronizado dinámicamente con Obraxis
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mandatoryCompanyDocs.map(item => {
              const uploaded = companyDocs[item.key];
              const docStatus = uploaded ? (uploaded.status || 'Pendiente de Revisión') : 'No cargado';

              return (
                <div key={item.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="font-extrabold text-xs text-slate-800 uppercase">{item.label}</div>
                    {uploaded && (
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                        docStatus === 'Aprobado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        docStatus === 'Rechazado' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {docStatus}
                      </span>
                    )}
                  </div>

                  {uploaded ? (
                    <div className="space-y-2">
                      <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                          <span className="truncate font-bold text-slate-700">{uploaded.fileName}</span>
                        </div>
                        <button
                          onClick={() => openFileViewer(uploaded)}
                          className="p-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 transition cursor-pointer"
                          title="Ver archivo"
                        >
                          <Eye className="w-3.5 h-3.5 text-primary" />
                        </button>
                      </div>

                      {docStatus === 'Rechazado' && (
                        <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl space-y-2 text-xs text-rose-800 animate-in fade-in">
                          <div className="flex items-start gap-1.5 font-semibold">
                            <MessageSquare className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <strong className="block uppercase text-[10px] text-rose-900">Documento Rechazado por Obraxis:</strong>
                              <span className="text-xs">{uploaded.motivo_rechazo || 'Corrija el archivo según indicaciones.'}</span>
                            </div>
                          </div>
                          <label className="cursor-pointer w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
                            <FileUp className="w-4 h-4" />
                            <span>Volver a Subir Documento</span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileUpload('empresa', item.key, e.target.files[0])}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <label className="cursor-pointer bg-white border border-dashed border-slate-300 hover:border-primary p-4 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 transition">
                      <FileUp className="w-5 h-5 text-slate-400" />
                      <span className="text-xs font-bold text-primary">Seleccionar Archivo PDF/Imagen</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload('empresa', item.key, e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= PESTAÑA 2: PERSONAL EXTERNO ================= */}
      {activeTab === 'personal' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Nómina de Personal Externo ({personalList.length})
            </h3>
            <button
              onClick={() => setShowPersonModal(true)}
              className="bg-primary hover:bg-primary-hover text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Registrar Trabajador</span>
            </button>
          </div>

          {personalList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No hay trabajadores registrados aún. Haga clic en "+ Registrar Trabajador".
            </div>
          ) : (
            <div className="space-y-4">
              {personalList.map((person, pIdx) => (
                <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-extrabold text-xs uppercase text-slate-900">{person.nombre}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-2">({formatRut(person.rut)})</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">
                      {person.cargo || 'Operario'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {mandatoryWorkerDocs.map(doc => {
                      const uploaded = person.docs && person.docs[doc.key];
                      const docStatus = uploaded ? (uploaded.status || 'Pendiente de Revisión') : 'No cargado';

                      return (
                        <div key={doc.key} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-700">{doc.label}</span>
                            {uploaded && (
                              <span className={`text-[8.5px] font-extrabold px-1 rounded uppercase ${
                                docStatus === 'Aprobado' ? 'bg-emerald-50 text-emerald-700' :
                                docStatus === 'Rechazado' ? 'bg-rose-50 text-rose-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {docStatus}
                              </span>
                            )}
                          </div>

                          {uploaded ? (
                            <div className="space-y-1">
                              <div className="text-[9.5px] font-bold text-slate-700 bg-slate-50 p-1.5 rounded-md flex items-center justify-between">
                                <span className="truncate">{uploaded.fileName}</span>
                                <button onClick={() => openFileViewer(uploaded)} className="text-primary p-0.5" title="Ver">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {docStatus === 'Rechazado' && (
                                <div className="text-[9px] text-rose-800 bg-rose-50 p-1 rounded font-medium space-y-1">
                                  <div><strong>Rechazado:</strong> {uploaded.motivo_rechazo}</div>
                                  <label className="cursor-pointer block text-center bg-rose-600 text-white font-bold py-0.5 rounded text-[8.5px]">
                                    Reemplazar
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) => handleFileUpload('personal', doc.key, e.target.files[0], pIdx)}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          ) : (
                            <label className="cursor-pointer inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md border border-slate-200 transition">
                              <FileUp className="w-3 h-3 text-slate-600" />
                              <span>Subir {doc.label}</span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => handleFileUpload('personal', doc.key, e.target.files[0], pIdx)}
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
          )}
        </div>
      )}

      {/* ================= PESTAÑA 3: EQUIPOS EXTERNOS ================= */}
      {activeTab === 'equipos' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Nómina de Equipos y Maquinarias Externas ({equiposList.length})
            </h3>
            <button
              onClick={() => setShowEquipoModal(true)}
              className="bg-primary hover:bg-primary-hover text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Registrar Equipo</span>
            </button>
          </div>

          {equiposList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No hay equipos registrados aún. Haga clic en "+ Registrar Equipo".
            </div>
          ) : (
            <div className="space-y-4">
              {equiposList.map((eq, eIdx) => (
                <div key={eIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-extrabold text-xs uppercase text-slate-900">{eq.tipo_equipo}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-2">Patente: {eq.patente_codigo}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                      {eq.marca_modelo || 'Equipo'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {mandatoryEquipoDocs.map(doc => {
                      const uploaded = eq.docs && eq.docs[doc.key];
                      const docStatus = uploaded ? (uploaded.status || 'Pendiente de Revisión') : 'No cargado';

                      return (
                        <div key={doc.key} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-700 uppercase">{doc.label}</span>
                            {uploaded && (
                              <span className={`text-[8.5px] font-extrabold px-1 rounded uppercase ${
                                docStatus === 'Aprobado' ? 'bg-emerald-50 text-emerald-700' :
                                docStatus === 'Rechazado' ? 'bg-rose-50 text-rose-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {docStatus}
                              </span>
                            )}
                          </div>

                          {uploaded ? (
                            <div className="space-y-1">
                              <div className="text-[9.5px] font-bold text-slate-700 bg-slate-50 p-1.5 rounded-md flex items-center justify-between">
                                <span className="truncate">{uploaded.fileName}</span>
                                <button onClick={() => openFileViewer(uploaded)} className="text-primary p-0.5" title="Ver">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {docStatus === 'Rechazado' && (
                                <div className="text-[9px] text-rose-800 bg-rose-50 p-1 rounded font-medium space-y-1">
                                  <div><strong>Rechazado:</strong> {uploaded.motivo_rechazo}</div>
                                  <label className="cursor-pointer block text-center bg-rose-600 text-white font-bold py-0.5 rounded text-[8.5px]">
                                    Reemplazar
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) => handleFileUpload('equipos', doc.key, e.target.files[0], eIdx)}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          ) : (
                            <label className="cursor-pointer inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md border border-slate-200 transition">
                              <FileUp className="w-3 h-3 text-slate-600" />
                              <span>Subir Documento</span>
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => handleFileUpload('equipos', doc.key, e.target.files[0], eIdx)}
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
          )}
        </div>
      )}

      {/* FOOTER CON BOTÓN GUARDAR Y SINCRONIZAR */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="text-xs text-slate-500 font-medium">
          Al finalizar la carga de documentos, presione <strong>Guardar y Sincronizar</strong> para notificar al equipo de evaluación Obraxis.
        </div>
        <button
          onClick={handleSaveAndSyncPortal}
          disabled={savingSync}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6 py-3 rounded-2xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
        >
          {savingSync ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>💾 Guardar y Sincronizar con Obraxis</span>
        </button>
      </div>

      {/* MODALES REGISTRAR */}
      {showPersonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b pb-2">
              Registrar Trabajador del Subcontrato
            </h3>
            <form onSubmit={handleAddPerson} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Juan Pérez Gómez"
                  value={personForm.nombre}
                  onChange={(e) => setPersonForm({ ...personForm, nombre: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT / DNI</label>
                  <input
                    type="text"
                    required
                    placeholder="12.345.678-9"
                    value={personForm.rut}
                    onChange={(e) => setPersonForm({ ...personForm, rut: e.target.value })}
                    onBlur={(e) => setPersonForm({ ...personForm, rut: formatRut(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cargo</label>
                  <input
                    type="text"
                    placeholder="ej: Montajista"
                    value={personForm.cargo}
                    onChange={(e) => setPersonForm({ ...personForm, cargo: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPersonModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-primary hover:bg-primary-hover transition cursor-pointer"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEquipoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b pb-2">
              Registrar Equipo / Vehículo
            </h3>
            <form onSubmit={handleAddEquipo} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Equipo / Maquinaria</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Camión Tolva, Retroexcavadora, Camioneta"
                  value={equipoForm.tipo_equipo}
                  onChange={(e) => setEquipoForm({ ...equipoForm, tipo_equipo: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Patente / Código Interno</label>
                  <input
                    type="text"
                    required
                    placeholder="ABCD-12"
                    value={equipoForm.patente_codigo}
                    onChange={(e) => setEquipoForm({ ...equipoForm, patente_codigo: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Marca / Modelo</label>
                  <input
                    type="text"
                    placeholder="ej: Caterpillar 320"
                    value={equipoForm.marca_modelo}
                    onChange={(e) => setEquipoForm({ ...equipoForm, marca_modelo: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEquipoModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-primary hover:bg-primary-hover transition cursor-pointer"
                >
                  Registrar Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
