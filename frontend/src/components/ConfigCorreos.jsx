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
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Configuración de Alertas y Reportes</h2>
        </div>
        
        <button
          onClick={handleOpenAddModal}
          className="bg-blue-900 hover:bg-blue-800 text-white font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Configurar Alerta</span>
        </button>
      </div>

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
            className="pl-9 text-slate-800 font-medium w-full px-3 py-2 border rounded-lg border-slate-200 focus:outline-none focus:border-blue-600 transition text-xs"
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
                    <Mail className="w-4 h-4 text-blue-900" />
                    <span>{cfg.tipo}</span>
                  </h3>
                  {cfg.filtro && (
                    <span className="text-[9px] font-bold bg-blue-50 text-blue-900 border border-blue-150 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                      <Filter className="w-2.5 h-2.5" />
                      <span>Proyecto: {cfg.filtro}</span>
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleOpenEditModal(cfg)}
                    className="p-1.5 hover:bg-blue-50 text-blue-900 rounded-lg transition cursor-pointer"
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
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5"
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
