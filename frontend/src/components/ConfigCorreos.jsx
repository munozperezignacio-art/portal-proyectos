import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Settings, ArrowLeft, Search, Plus, Edit, Trash2, Loader2, AlertCircle, Check, Mail, Filter 
} from 'lucide-react';

function ConfigCorreos({ user, onBack }) {
  const [configs, setConfigs] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Formulario
  const [formData, setFormData] = useState({
    tipo: 'Produccion Diaria',
    correos: '',
    filtro: ''
  });

  const [logoBase64, setLogoBase64] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1e3a8a');
  const [secondaryColor, setSecondaryColor] = useState('#1d4ed8');
  const [activeTab, setActiveTab] = useState('alertas');
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState('');
  const [brandingError, setBrandingError] = useState('');

  // Cargar branding de la empresa
  useEffect(() => {
    if (activeTab === 'branding') {
      fetchBranding();
    }
  }, [activeTab]);

  const fetchBranding = async () => {
    setBrandingLoading(true);
    setBrandingSuccess('');
    setBrandingError('');
    try {
      const { data, error } = await supabase
        .from('config_empresa')
        .select('*')
        .eq('empresa', user.empresa)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLogoBase64(data.logo_base64 || '');
        setPrimaryColor(data.color_primario || '#1e3a8a');
        setSecondaryColor(data.color_secundario || '#1d4ed8');
      }
    } catch (err) {
      console.error('Error fetching branding:', err.message);
      setBrandingError('Error al cargar la personalización corporativa.');
    } finally {
      setBrandingLoading(false);
    }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    setBrandingLoading(true);
    setBrandingSuccess('');
    setBrandingError('');

    try {
      const { error } = await supabase
        .from('config_empresa')
        .upsert([
          {
            empresa: user.empresa,
            logo_base64: logoBase64,
            color_primario: primaryColor,
            color_secundario: secondaryColor
          }
        ], { onConflict: 'empresa' });

      if (error) throw error;

      document.documentElement.style.setProperty('--primary-color', primaryColor);
      document.documentElement.style.setProperty('--primary-color-hover', secondaryColor);

      setBrandingSuccess('¡Personalización guardada! Los colores se han aplicado en tiempo real.');
      setTimeout(() => {
        setBrandingSuccess('');
      }, 4000);
    } catch (err) {
      console.error('Error saving branding:', err.message);
      setBrandingError(`Error al guardar: ${err.message}`);
    } finally {
      setBrandingLoading(false);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("El logotipo no debe superar los 2MB de tamaño.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dataConfigs, error: errConfigs } = await supabase
        .from('config_correos')
        .select('*')
        .order('tipo', { ascending: true });
      if (errConfigs) throw errConfigs;
      setConfigs(dataConfigs || []);

      const { data: dataObras, error: errObras } = await supabase
        .from('obras')
        .select('nombre')
        .order('nombre', { ascending: true });
      if (errObras) throw errObras;
      setObras(dataObras || []);
    } catch (err) {
      console.error('Error cargando configuraciones/obras:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingConfig(null);
    setFormData({
      tipo: 'Produccion Diaria',
      correos: '',
      filtro: ''
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (cfg) => {
    setEditingConfig(cfg);
    setFormData({
      tipo: cfg.tipo || 'Produccion Diaria',
      correos: cfg.correos || '',
      filtro: cfg.filtro || ''
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleDeleteConfig = async (cfg) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la configuración de correos para ${cfg.tipo}?`)) return;

    try {
      const { error } = await supabase.from('config_correos').delete().eq('id', cfg.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert(`Error al eliminar configuración: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    // Validar correos
    const emails = formData.correos.split(',').map(email => email.trim());
    const invalidEmail = emails.find(email => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return !re.test(email);
    });

    if (invalidEmail) {
      setErrorMsg(`El correo "${invalidEmail}" no tiene un formato válido.`);
      setModalLoading(false);
      return;
    }

    const dataToSave = {
      tipo: formData.tipo,
      correos: emails.join(', '),
      filtro: formData.filtro || null
    };

    try {
      if (editingConfig) {
        // Actualizar
        const { error } = await supabase
          .from('config_correos')
          .update(dataToSave)
          .eq('id', editingConfig.id);
        if (error) throw error;
        setSuccessMsg('Configuración de correos guardada con éxito.');
      } else {
        // Insertar nuevo
        const { error } = await supabase.from('config_correos').insert([dataToSave]);
        if (error) throw error;
        setSuccessMsg('Nueva alerta de reporte configurada correctamente.');
      }

      fetchData();
      setTimeout(() => setModalOpen(false), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const filteredConfigs = configs.filter(c => {
    return (
      (c.tipo && c.tipo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.correos && c.correos.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.filtro && c.filtro.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const tiposReporte = ['Produccion Diaria', 'Uso Maquinaria', 'Asistencia Personal'];

  return (
    <div className="space-y-4">
      
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-200 rounded-lg transition cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Panel de Configuración General</h2>
        </div>
        
        {activeTab === 'alertas' && (
          <button
            onClick={handleOpenAddModal}
            className="bg-primary hover:bg-primary-hover text-white font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Configurar Alerta</span>
          </button>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200 gap-2 mb-4">
        <button
          onClick={() => setActiveTab('alertas')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'alertas' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Destinatarios de Alertas
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'branding' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Personalización de Marca
        </button>
      </div>

      {activeTab === 'alertas' ? (
        <>
          {/* Buscador */}
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por tipo de reporte o correo destinatario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-slate-800 font-medium w-full px-3 py-2 border rounded-lg border-slate-200 focus:outline-none focus:border-primary transition text-xs"
              />
            </div>
          </div>

          {/* Listado */}
          {loading ? (
            <p className="text-sm text-slate-500 p-2">⏳ Cargando alertas...</p>
          ) : filteredConfigs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No se encontraron configuraciones de alertas.</p>
          ) : (
            <div className="space-y-4">
              {filteredConfigs.map((cfg) => (
                <div 
                  key={cfg.id} 
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-350 transition duration-200"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-primary" />
                        <span>{cfg.tipo}</span>
                      </h3>
                      {cfg.filtro && (
                        <span className="text-[9px] font-bold bg-blue-50 text-primary border border-blue-150 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          <Filter className="w-2.5 h-2.5" />
                          <span>Proyecto: {cfg.filtro}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(cfg)}
                        className="p-1.5 hover:bg-blue-50 text-primary rounded-lg transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(cfg)}
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 font-medium text-slate-600 border-t border-slate-100 pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Destinatarios</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {cfg.correos.split(',').map((email, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[10px]">
                          {email.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Branding Editor Panel */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-lg space-y-6">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Personalización Visual de la Empresa</h3>
            <p className="text-xs text-slate-500 mt-1">Define el logo corporativo y la paleta de colores para tu portal ({user.empresa}) en vivo.</p>
          </div>

          {brandingSuccess && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-xs font-semibold">{brandingSuccess}</div>}
          {brandingError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-semibold">{brandingError}</div>}

          {brandingLoading && !logoBase64 ? (
            <p className="text-xs text-slate-500">⏳ Cargando configuraciones de marca...</p>
          ) : (
            <form onSubmit={handleSaveBranding} className="space-y-5">
              
              {/* Cargar Logotipo */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2">Logotipo de la Empresa (Máx 2MB)</label>
                <div className="flex items-center gap-4">
                  {logoBase64 ? (
                    <div className="border border-slate-200 p-2 rounded-xl bg-slate-50 flex items-center justify-center h-20 w-36 overflow-hidden">
                      <img src={logoBase64} className="max-h-full max-w-full object-contain" alt="Vista Previa" />
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-300 rounded-xl flex items-center justify-center h-20 w-36 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase p-2 text-center">
                      Sin Logotipo
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      id="logo-upload"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs cursor-pointer transition border border-slate-250"
                    >
                      Subir Imagen
                    </label>
                    <p className="text-[9px] text-slate-450 mt-1.5">Formatos recomendados: PNG o JPG con fondo transparente.</p>
                  </div>
                </div>
              </div>

              {/* Colores Temáticos */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Color Principal</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#1e3a8a"
                      className="border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none w-full uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Color de Enfoque / Hover</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#1d4ed8"
                      className="border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none w-full uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Guardar */}
              <button
                type="submit"
                disabled={brandingLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-lg text-xs cursor-pointer shadow-sm transition disabled:opacity-75 flex items-center justify-center gap-1.5"
              >
                {brandingLoading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Guardando Marca...</span>
                  </>
                ) : (
                  <span>Guardar Personalización</span>
                )}
              </button>

            </form>
          )}
        </div>
      )}

      {/* Modal: Crear / Editar Configuración */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingConfig ? 'Editar Alerta' : 'Configurar Nueva Alerta'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Reporte</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white"
                >
                  {tiposReporte.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Destinatarios (Separados por coma)</label>
                <textarea
                  required
                  rows={3}
                  value={formData.correos}
                  onChange={(e) => setFormData({ ...formData, correos: e.target.value })}
                  placeholder="ejemplo1@eminsg.cl, ejemplo2@eminsg.cl"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
                <span className="block text-[9px] text-slate-450 mt-1">Ingresa múltiples destinatarios separándolos con una coma.</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Filtro de Obra (Opcional)</label>
                <select
                  value={formData.filtro}
                  onChange={(e) => setFormData({ ...formData, filtro: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white"
                >
                  <option value="">Aplicar a todas las obras</option>
                  {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                </select>
                <span className="block text-[9px] text-slate-450 mt-1">Si seleccionas una obra, esta alerta se enviará únicamente para ese proyecto.</span>
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5"
              >
                {modalLoading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Guardar Configuración</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ConfigCorreos;
