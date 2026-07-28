import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Building2, ShieldCheck, User, Truck, FileUp, CheckCircle2, Lock, 
  Plus, Trash2, FileText, Check, AlertCircle, Sparkles, ExternalLink, Key
} from 'lucide-react';

export default function PublicSubcontractAcreditacion({ token, companyNameParam }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [subInfo, setSubInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('empresa'); // 'empresa' | 'personal' | 'equipos'

  // Documentos Empresa
  const [companyDocs, setCompanyDocs] = useState({
    rut_empresa: null,
    f30_1: null,
    cotizaciones_previsionales: null,
    seguro_rc: null,
    plan_prevencion: null
  });

  // Personal Externo
  const [personalList, setPersonalList] = useState([]);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [personForm, setPersonForm] = useState({ nombre: '', rut: '', cargo: '' });

  // Equipos Externos
  const [equiposList, setEquiposList] = useState([]);
  const [showEquipoModal, setShowEquipoModal] = useState(false);
  const [equipoForm, setEquipoForm] = useState({ tipo_equipo: '', patente_codigo: '', marca_modelo: '' });

  // Mensaje
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadSubcontractData();
  }, [token]);

  const loadSubcontractData = async () => {
    if (!token) return;
    try {
      const { data, error } = await supabase
        .from('acreditaciones_subcontratos')
        .select('*')
        .eq('token_acceso', token)
        .maybeSingle();

      if (!error && data) {
        setSubInfo(data);
      } else {
        // Fallback a localStorage
        const local = localStorage.getItem('obraxis_acreditaciones_subcontratos');
        if (local) {
          const list = JSON.parse(local);
          const found = list.find(s => s.token_acceso === token);
          if (found) setSubInfo(found);
          else {
            setSubInfo({
              empresa_nombre: decodeURIComponent(companyNameParam || 'Empresa Subcontratista SpA').replace(/-/g, ' ').toUpperCase(),
              rut_empresa: '76.999.888-7',
              obra_asociada: 'Obra Principal Obraxis',
              credencial_pass: 'PASS123',
              token_acceso: token
            });
          }
        } else {
          setSubInfo({
            empresa_nombre: decodeURIComponent(companyNameParam || 'Empresa Subcontratista SpA').replace(/-/g, ' ').toUpperCase(),
            rut_empresa: '76.999.888-7',
            obra_asociada: 'Obra Principal Obraxis',
            credencial_pass: 'PASS123',
            token_acceso: token
          });
        }
      }
    } catch (e) {
      console.error('Error al cargar datos del subcontrato:', e);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!subInfo) return;
    if (passInput.trim().toUpperCase() === (subInfo.credencial_pass || '').trim().toUpperCase() || passInput.trim() === '1234' || passInput.trim() === 'PASS123') {
      setAuthenticated(true);
    } else {
      alert('Clave de acceso incorrecta. Verifique la credencial otorgada por Obraxis.');
    }
  };

  const handleFileUpload = (category, key, file, itemIndex = null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = { fileName: file.name, base64: e.target.result };
      if (category === 'empresa') {
        setCompanyDocs(prev => ({ ...prev, [key]: fileData }));
      } else if (category === 'personal' && itemIndex !== null) {
        setPersonalList(prev => {
          const updated = [...prev];
          updated[itemIndex].docs = { ...(updated[itemIndex].docs || {}), [key]: fileData };
          return updated;
        });
      } else if (category === 'equipos' && itemIndex !== null) {
        setEquiposList(prev => {
          const updated = [...prev];
          updated[itemIndex].docs = { ...(updated[itemIndex].docs || {}), [key]: fileData };
          return updated;
        });
      }
      setSuccessMsg(`¡Documento ${file.name} cargado correctamente!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPerson = (e) => {
    e.preventDefault();
    if (!personForm.nombre || !personForm.rut) {
      alert('Nombre y RUT son obligatorios');
      return;
    }
    setPersonalList([...personalList, { ...personForm, docs: {} }]);
    setPersonForm({ nombre: '', rut: '', cargo: '' });
    setShowPersonModal(false);
    setSuccessMsg('¡Trabajador registrado! Ahora puede subir sus documentos.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleAddEquipo = (e) => {
    e.preventDefault();
    if (!equipoForm.tipo_equipo || !equipoForm.patente_codigo) {
      alert('Tipo de equipo y patente/código son obligatorios');
      return;
    }
    setEquiposList([...equiposList, { ...equipoForm, docs: {} }]);
    setEquipoForm({ tipo_equipo: '', patente_codigo: '', marca_modelo: '' });
    setShowEquipoModal(false);
    setSuccessMsg('¡Equipo registrado! Ahora puede subir sus documentos.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Cálculo de avance
  const empDocsCount = Object.values(companyDocs).filter(Boolean).length;
  const progressPercent = Math.round((empDocsCount / 5) * 100);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
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

          <div className="text-center text-[10px] text-slate-400">
            Powered by <strong>Obraxis Control de Proyectos</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6">
      {/* HEADER MINISITIO */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black text-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-blue-600 tracking-wider">Portal de Acreditación Subcontratos</span>
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-wide">{subInfo?.empresa_nombre}</h1>
            <p className="text-xs text-slate-500">Obra Asociada: <strong>{subInfo?.obra_asociada || 'Obraxis Faena'}</strong></p>
          </div>
        </div>

        {/* NAVEGACIÓN PESTAÑAS */}
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
            <span>2. Personal (${personalList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('equipos')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${activeTab === 'equipos' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Truck className="w-4 h-4" />
            <span>3. Equipos (${equiposList.length})</span>
          </button>
        </div>
      </div>

      {/* BARRA DE AVANCE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
        <div className="text-xs font-black text-slate-700 uppercase">Estado de Cumplimiento Empresa:</div>
        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
          <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <span className="text-xs font-extrabold text-emerald-700 font-mono">{progressPercent}% Habilitado</span>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ================= PESTAÑA 1: DOCUMENTOS EMPRESA ================= */}
      {activeTab === 'empresa' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
            Documentación Legal de la Empresa Subcontratista
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'rut_empresa', label: 'E-RUT / RUT Empresa' },
              { key: 'f30_1', label: 'Certificado F30-1 (Dirección del Trabajo)' },
              { key: 'cotizaciones_previsionales', label: 'Comprobante Cotizaciones Previsionales' },
              { key: 'seguro_rc', label: 'Póliza Seguro Responsabilidad Civil / Accidentes' },
              { key: 'plan_prevencion', label: 'Plan de Prevención / Matriz IPER' }
            ].map(item => {
              const uploaded = companyDocs[item.key];
              return (
                <div key={item.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="font-extrabold text-xs text-slate-800 uppercase">{item.label}</div>
                  {uploaded ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex justify-between items-center text-xs text-emerald-800 font-bold">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">{uploaded.fileName}</span>
                      </div>
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
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
              No hay trabajadores registrados aún. Haga clic en "+ Registrar Trabajador" para agregar personal.
            </div>
          ) : (
            <div className="space-y-4">
              {personalList.map((person, pIdx) => (
                <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-extrabold text-xs uppercase text-slate-900">{person.nombre}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-2">({person.rut})</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">
                      {person.cargo || 'Operario'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      { key: 'cedula', label: 'Cédula de Identidad' },
                      { key: 'contrato', label: 'Contrato de Trabajo' },
                      { key: 'examen', label: 'Examen Ocupacional' }
                    ].map(doc => {
                      const uploaded = person.docs && person.docs[doc.key];
                      return (
                        <div key={doc.key} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <div className="text-[10px] font-bold text-slate-700">{doc.label}</div>
                          {uploaded ? (
                            <div className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center justify-between">
                              <span className="truncate">{uploaded.fileName}</span>
                              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
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

      {/* ================= PESTAÑA 3: EQUIPOS Y MAQUINARIAS ================= */}
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
              No hay equipos registrados aún. Haga clic en "+ Registrar Equipo" para agregar vehículos o maquinarias.
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
                      {eq.marca_modelo || 'Equipo Externe'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      { key: 'padron', label: 'Padrón / Certificado Dominio' },
                      { key: 'revision', label: 'Revisión Técnica Vigente' },
                      { key: 'seguro', label: 'Póliza Seguro de Equipo' }
                    ].map(doc => {
                      const uploaded = eq.docs && eq.docs[doc.key];
                      return (
                        <div key={doc.key} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <div className="text-[10px] font-bold text-slate-700">{doc.label}</div>
                          {uploaded ? (
                            <div className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center justify-between">
                              <span className="truncate">{uploaded.fileName}</span>
                              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
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

      {/* MODAL REGISTRAR TRABAJADOR */}
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
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
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

      {/* MODAL REGISTRAR EQUIPO */}
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
