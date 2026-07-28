import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, ClipboardCheck, Plus, FileText, CheckCircle2, AlertCircle, 
  HelpCircle, Trash2, Edit3, Share2, Download, Copy, Eye, BookOpen, 
  GraduationCap, Users, Calendar, Award, CheckSquare, Layers, Building2, Send
} from 'lucide-react';

export default function FormulariosCapacitaciones({ user, onBack, companyBranding }) {
  const [activeTab, setActiveTab] = useState('menu'); // menu, designer, forms_list, capacitaciones, respuestas
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Módulos disponibles para asignar formularios
  const modulosAsignables = [
    { id: 'general', name: 'General (Todos los Módulos)' },
    { id: 'prevencion', name: 'Prevención de Riesgos' },
    { id: 'rrhh', name: 'Recursos Humanos' },
    { id: 'maquinaria', name: 'Maquinaria y Equipos' },
    { id: 'facturacion', name: 'Facturación y Costos' },
    { id: 'acreditaciones', name: 'Acreditaciones' }
  ];

  // Estados de Formularios
  const [formularios, setFormularios] = useState([]);
  const [respuestas, setRespuestas] = useState([]);

  // Formulario en edición
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formModulo, setFormModulo] = useState('general');
  const [formFields, setFormFields] = useState([
    { id: Date.now(), type: 'text', label: 'Nombre o Título', required: true, options: [] }
  ]);

  // Estados de Capacitaciones
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [capTitle, setCapTitle] = useState('');
  const [capDesc, setCapDesc] = useState('');
  const [capTipo, setCapTipo] = useState('Charla 5 Minutos');
  const [capModulo, setCapModulo] = useState('general');
  const [capQuiz, setCapQuiz] = useState([
    { id: Date.now(), pregunta: '¿Comprendió la charla?', opciones: ['Sí', 'No'], correcta: 0 }
  ]);

  // Detalle de Respuestas / Visores
  const [selectedFormDetail, setSelectedFormDetail] = useState(null);

  useEffect(() => {
    fetchFormularios();
    fetchRespuestas();
    fetchCapacitaciones();
  }, []);

  const fetchFormularios = async () => {
    try {
      const { data, error } = await supabase
        .from('prevencion_formularios')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setFormularios(data);
      } else {
        const local = localStorage.getItem('obraxis_formularios_dinamicos');
        if (local) {
          try { setFormularios(JSON.parse(local)); } catch (e) { setFormularios([]); }
        }
      }
    } catch (e) {
      const local = localStorage.getItem('obraxis_formularios_dinamicos');
      if (local) {
        try { setFormularios(JSON.parse(local)); } catch (e) { setFormularios([]); }
      }
    }
  };

  const fetchRespuestas = async () => {
    try {
      const { data, error } = await supabase
        .from('prevencion_respuestas_formularios')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRespuestas(data);
      } else {
        const local = localStorage.getItem('obraxis_respuestas_formularios');
        if (local) {
          try { setRespuestas(JSON.parse(local)); } catch (e) { setRespuestas([]); }
        }
      }
    } catch (e) {
      const local = localStorage.getItem('obraxis_respuestas_formularios');
      if (local) {
        try { setRespuestas(JSON.parse(local)); } catch (e) { setRespuestas([]); }
      }
    }
  };

  const fetchCapacitaciones = async () => {
    try {
      const { data, error } = await supabase
        .from('prevencion_capacitaciones')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCapacitaciones(data);
      } else {
        const local = localStorage.getItem('obraxis_capacitaciones_charlas');
        if (local) {
          try { setCapacitaciones(JSON.parse(local)); } catch (e) { setCapacitaciones([]); }
        }
      }
    } catch (e) {
      const local = localStorage.getItem('obraxis_capacitaciones_charlas');
      if (local) {
        try { setCapacitaciones(JSON.parse(local)); } catch (e) { setCapacitaciones([]); }
      }
    }
  };

  // Agregar campo en Diseñador
  const handleAddField = (type) => {
    setFormFields([
      ...formFields,
      {
        id: Date.now(),
        type,
        label: `Nuevo campo (${type})`,
        required: false,
        options: type === 'select' || type === 'radio' || type === 'checkbox' ? ['Opción 1', 'Opción 2'] : []
      }
    ]);
  };

  const handleUpdateField = (id, key, value) => {
    setFormFields(formFields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const handleRemoveField = (id) => {
    setFormFields(formFields.filter(f => f.id !== id));
  };

  // Guardar Formulario Dinámico
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setErrorMsg('Ingrese el título del formulario.');
      return;
    }

    setLoading(true);
    const token = 'FORM_' + Math.random().toString(36).substring(2, 9).toUpperCase();

    const newForm = {
      titulo: formTitle,
      descripcion: formDesc,
      modulo_asignado: formModulo,
      campos: formFields,
      token_publico: token,
      creador_email: user?.email || 'admin@obraxis.cl',
      empresa: user?.empresa || 'EMIN',
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from('prevencion_formularios').insert([newForm]).select();
      if (error) throw error;
      setSuccessMsg('¡Formulario creado y asignado con éxito!');
      fetchFormularios();
    } catch (err) {
      console.warn('Guardando formulario en localStorage:', err);
      const updated = [newForm, ...formularios];
      setFormularios(updated);
      localStorage.setItem('obraxis_formularios_dinamicos', JSON.stringify(updated));
      setSuccessMsg('¡Formulario creado localmente!');
    } finally {
      setLoading(false);
      setFormTitle('');
      setFormDesc('');
      setFormFields([{ id: Date.now(), type: 'text', label: 'Nombre o Título', required: true, options: [] }]);
      setActiveTab('forms_list');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // Guardar Capacitación / Charla
  const handleSaveCapacitacion = async (e) => {
    e.preventDefault();
    if (!capTitle.trim()) {
      setErrorMsg('Ingrese el título de la capacitación.');
      return;
    }

    setLoading(true);
    const token = 'CAP_' + Math.random().toString(36).substring(2, 9).toUpperCase();

    const newCap = {
      titulo: capTitle,
      descripcion: capDesc,
      tipo: capTipo,
      modulo_asignado: capModulo,
      preguntas: capQuiz,
      token_publico: token,
      creador_email: user?.email || 'admin@obraxis.cl',
      empresa: user?.empresa || 'EMIN',
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('prevencion_capacitaciones').insert([newCap]);
      if (error) throw error;
      setSuccessMsg('¡Capacitación registrada y publicada!');
      fetchCapacitaciones();
    } catch (err) {
      console.warn('Guardando capacitación en localStorage:', err);
      const updated = [newCap, ...capacitaciones];
      setCapacitaciones(updated);
      localStorage.setItem('obraxis_capacitaciones_charlas', JSON.stringify(updated));
      setSuccessMsg('¡Capacitación registrada localmente!');
    } finally {
      setLoading(false);
      setCapTitle('');
      setCapDesc('');
      setCapQuiz([{ id: Date.now(), pregunta: '¿Comprendió la charla?', opciones: ['Sí', 'No'], correcta: 0 }]);
      setActiveTab('capacitaciones');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccessMsg('¡Enlace copiado al portapapeles!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition cursor-pointer"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                Módulo Independiente
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-indigo-600" />
              Formularios y Capacitaciones
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Crea formularios dinámicos, listas de chequeo y capacitaciones asignables a cualquier módulo del sistema.
            </p>
          </div>
        </div>

        {/* Tab Selector Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${activeTab === 'menu' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Panel Principal
          </button>
          <button
            onClick={() => setActiveTab('designer')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${activeTab === 'designer' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            + Diseñador
          </button>
          <button
            onClick={() => setActiveTab('forms_list')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${activeTab === 'forms_list' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Mis Formularios ({formularios.length})
          </button>
          <button
            onClick={() => setActiveTab('capacitaciones')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${activeTab === 'capacitaciones' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Capacitaciones ({capacitaciones.length})
          </button>
          <button
            onClick={() => setActiveTab('respuestas')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${activeTab === 'respuestas' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Respuestas ({respuestas.length})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-700 text-sm font-bold">✕</button>
        </div>
      )}

      {/* TAB 1: MENU PRINCIPAL CARDS */}
      {activeTab === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 animate-in fade-in duration-200">
          <div 
            onClick={() => setActiveTab('designer')}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs hover:shadow-lg hover:border-indigo-200 transition duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">Diseñador de Formularios</h3>
              <p className="text-xs text-slate-500 font-medium">Crea encuestas, inspecciones y check-lists personalizados y asígnalos a cualquier módulo.</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-indigo-600 font-bold text-xs">
              <span>Crear Nuevo</span>
              <span>→</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('forms_list')}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs hover:shadow-lg hover:border-indigo-200 transition duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">Mis Formularios ({formularios.length})</h3>
              <p className="text-xs text-slate-500 font-medium">Administra formularios activos, genera enlaces públicos de llenado y edita sus asignaciones.</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-blue-600 font-bold text-xs">
              <span>Ver Listado</span>
              <span>→</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('capacitaciones')}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs hover:shadow-lg hover:border-indigo-200 transition duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">Charlas y Capacitaciones</h3>
              <p className="text-xs text-slate-500 font-medium">Registra capacitaciones, charlas de 5 minutos, evaluación de conocimientos y control de asistencia.</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-purple-600 font-bold text-xs">
              <span>Gestionar Charlas</span>
              <span>→</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('respuestas')}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs hover:shadow-lg hover:border-indigo-200 transition duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">Respuestas ({respuestas.length})</h3>
              <p className="text-xs text-slate-500 font-medium">Inspecciona y exporta los registros de respuestas completadas por trabajadores y contratistas.</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-emerald-600 font-bold text-xs">
              <span>Revisar Respuestas</span>
              <span>→</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DISEÑADOR DE FORMULARIOS */}
      {activeTab === 'designer' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in duration-200 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">Crear Formulario Dinámico</h2>
              <p className="text-xs text-slate-500">Configura preguntas y define en qué módulo estará disponible.</p>
            </div>
          </div>

          <form onSubmit={handleSaveForm} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
              <div className="md:col-span-2 space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Título del Formulario *</label>
                <input
                  type="text"
                  placeholder="Ej: Check-list de Entrega de EPP o Inspección de Herramientas"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Asignar a Módulo *</label>
                <select
                  value={formModulo}
                  onChange={(e) => setFormModulo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white"
                >
                  {modulosAsignables.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Descripción u Objetivo</label>
                <textarea
                  rows="2"
                  placeholder="Instrucciones para la persona que responderá este formulario..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white"
                ></textarea>
              </div>
            </div>

            {/* Barra de herramientas para agregar campos */}
            <div className="space-y-3">
              <label className="block text-xs font-extrabold uppercase text-slate-700">Diseño de Campos y Preguntas</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleAddField('text')} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">+ Texto Corto</button>
                <button type="button" onClick={() => handleAddField('textarea')} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">+ Párrafo</button>
                <button type="button" onClick={() => handleAddField('select')} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">+ Desplegable (Select)</button>
                <button type="button" onClick={() => handleAddField('checkbox')} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">+ Checkbox / Casilla</button>
                <button type="button" onClick={() => handleAddField('date')} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">+ Fecha</button>
              </div>
            </div>

            {/* Lista de Campos */}
            <div className="space-y-3">
              {formFields.map((field, index) => (
                <div key={field.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3 relative">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Campo #{index + 1} ({field.type})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(field.id)}
                      className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-[9.5px] font-bold text-slate-500 uppercase">Etiqueta de la Pregunta</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleUpdateField(field.id, 'label', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => handleUpdateField(field.id, 'required', e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <span>Obligatorio</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('menu')}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-md flex items-center gap-2"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>{loading ? 'Guardando...' : 'Guardar y Publicar Formulario'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: LISTADO DE FORMULARIOS CREADOS */}
      {activeTab === 'forms_list' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in duration-200 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 uppercase">Mis Formularios Configurados</h2>
            <button
              onClick={() => setActiveTab('designer')}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Formulario</span>
            </button>
          </div>

          {formularios.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">No hay formularios registrados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {formularios.map(form => {
                const publicUrl = `${window.location.origin}/?prevencion_form=${form.token_publico || form.id}`;
                const modObj = modulosAsignables.find(m => m.id === form.modulo_asignado) || { name: 'General' };

                return (
                  <div key={form.id} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 shadow-xs transition flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-150">
                          Módulo: {modObj.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(form.created_at || Date.now()).toLocaleDateString('es-CL')}
                        </span>
                      </div>

                      <h4 className="text-xs font-extrabold text-slate-900 uppercase leading-snug">{form.titulo}</h4>
                      {form.descripcion && <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{form.descripcion}</p>}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => copyToClipboard(publicUrl)}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Copiar Enlace</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CAPACITACIONES Y CHARLAS */}
      {activeTab === 'capacitaciones' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in duration-200 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 uppercase">Gestor de Charlas y Capacitaciones</h2>
              <p className="text-xs text-slate-500">Publica charlas de seguridad, material interactivo y cuestionarios de conocimiento.</p>
            </div>
          </div>

          <form onSubmit={handleSaveCapacitacion} className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-xs font-black text-slate-800 uppercase">Registrar Nueva Capacitación</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label className="block text-[9.5px] font-bold uppercase text-slate-600">Título de la Charla / Curso *</label>
                <input
                  type="text"
                  placeholder="Ej: Charla de Uso Correcto de EPP e Higiene Industrial"
                  value={capTitle}
                  onChange={(e) => setCapTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9.5px] font-bold uppercase text-slate-600">Tipo de Contenido</label>
                <select
                  value={capTipo}
                  onChange={(e) => setCapTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white"
                >
                  <option value="Charla 5 Minutos">Charla 5 Minutos</option>
                  <option value="Capacitación Teórica">Capacitación Teórica</option>
                  <option value="Inducción General">Inducción General</option>
                </select>
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="block text-[9.5px] font-bold uppercase text-slate-600">Descripción o Resumen</label>
                <textarea
                  rows="2"
                  placeholder="Resumen de los temas abordados..."
                  value={capDesc}
                  onChange={(e) => setCapDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white"
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition cursor-pointer flex items-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4" />
                <span>{loading ? 'Guardando...' : 'Publicar Capacitación'}</span>
              </button>
            </div>
          </form>

          {/* Listado de Capacitaciones */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase">Capacitaciones Publicadas ({capacitaciones.length})</h3>
            
            {capacitaciones.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay capacitaciones registradas.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {capacitaciones.map(cap => (
                  <div key={cap.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                        {cap.tipo || 'Charla'}
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(cap.created_at || Date.now()).toLocaleDateString('es-CL')}</span>
                    </div>
                    <h4 className="text-xs font-black text-slate-800 uppercase">{cap.titulo}</h4>
                    {cap.descripcion && <p className="text-[11px] text-slate-500 line-clamp-2">{cap.descripcion}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: RESPUESTAS REGISTRADAS */}
      {activeTab === 'respuestas' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in duration-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 uppercase">Registros de Respuestas Recibidas</h2>
            <p className="text-xs text-slate-500">Historial completo de formularios completados por personal o subcontratistas.</p>
          </div>

          {respuestas.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">Aún no se registran respuestas en los formularios.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {respuestas.map(resp => (
                <div key={resp.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{resp.formulario_titulo || 'Formulario'}</h4>
                    <p className="text-[10.5px] text-slate-500">Respondido por: {resp.usuario_nombre || 'Anónimo'} ({resp.usuario_rut || 'Sin RUT'})</p>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(resp.created_at || Date.now()).toLocaleDateString('es-CL')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
