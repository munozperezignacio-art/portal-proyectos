import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, ShieldAlert, Plus, Save, Trash2, FileText, CheckCircle2, 
  Share2, Copy, Eye, Edit, ChevronLeft, QrCode, AlertTriangle, 
  Type, AlignLeft, Hash, Calendar, CheckSquare, Radio, ToggleLeft, 
  PenTool, Camera, Sparkles, Send, Check, Download, Layers, Building2, User
} from 'lucide-react';

export default function Prevencion({ user, onBack }) {
  // Apartado activo: '' (Menú rectángulos), 'builder' (Nuevo Formulario), 'mis_formularios', 'completar', 'respuestas'
  const [activeSection, setActiveSection] = useState('');

  // Lista de Formularios Guardados (Plantillas)
  const [formularios, setFormularios] = useState([]);
  const [loadingForms, setLoadingForms] = useState(true);

  // Lista de Respuestas Enviadas
  const [respuestas, setRespuestas] = useState([]);
  const [loadingRespuestas, setLoadingRespuestas] = useState(false);

  // ESTADO DEL BUILDER (NUEVO FORMULARIO TIPO JOTFORM)
  const [builderTab, setBuilderTab] = useState('edit'); // 'edit' o 'preview'
  const [editingFormId, setEditingFormId] = useState(null);
  const [formMeta, setFormMeta] = useState({
    titulo: '',
    descripcion: '',
    categoria: 'Inspección EPP'
  });
  const [formFields, setFormFields] = useState([]);
  const [savingForm, setSavingForm] = useState(false);

  // ESTADO DE LLENADO DE FORMULARIO (COMPLETAR EN TERRENO)
  const [selectedFormToFill, setSelectedFormToFill] = useState(null);
  const [fillAnswers, setFillAnswers] = useState({});
  const [fillMetadata, setFillMetadata] = useState({
    proyecto_nombre: '',
    inspector: user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() : ''
  });
  const [submittingFill, setSubmittingFill] = useState(false);

  // ESTADO DE LA FIRMA DIGITAL (CANVAS)
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');

  // ESTADOS DE MODALES Y MENSAJES
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFormItem, setShareFormItem] = useState(null);
  const [selectedResponseDetail, setSelectedResponseDetail] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Categorías de Prevención de Riesgos
  const categoriasPrevencion = [
    'Inspección EPP',
    'Charla 5 Minutos',
    'Análisis Seguro de Trabajo (AST)',
    'Matriz de Riesgo',
    'Reporte de Incidente / Accidente',
    'Lista de Chequeo Maquinaria / Herramientas',
    'Auditoría de Terreno'
  ];

  // Elementos disponibles para añadir en el Jotform Builder
  const availableElements = [
    { type: 'text', label: 'Texto Corto', icon: <Type className="w-4 h-4 text-blue-600" />, defaultLabel: 'Nombre o Respuesta Corta' },
    { type: 'textarea', label: 'Texto Largo / Observaciones', icon: <AlignLeft className="w-4 h-4 text-indigo-600" />, defaultLabel: 'Observaciones o Descripción Detallada' },
    { type: 'number', label: 'Número / Medición', icon: <Hash className="w-4 h-4 text-emerald-600" />, defaultLabel: 'Cantidad o Medición' },
    { type: 'date', label: 'Fecha / Hora', icon: <Calendar className="w-4 h-4 text-amber-600" />, defaultLabel: 'Fecha de Inspección' },
    { type: 'status_switch', label: 'Cumple / No Cumple / N/A', icon: <ToggleLeft className="w-4 h-4 text-teal-600" />, defaultLabel: 'Estado de Cumplimiento' },
    { type: 'radio', label: 'Selección Única', icon: <Radio className="w-4 h-4 text-purple-600" />, defaultLabel: 'Seleccione una opción', options: ['Opción 1', 'Opción 2'] },
    { type: 'checkbox', label: 'Selección Múltiple', icon: <CheckSquare className="w-4 h-4 text-rose-600" />, defaultLabel: 'Verificación de Elementos', options: ['Elemento A', 'Elemento B', 'Elemento C'] },
    { type: 'signature', label: 'Firma Digital', icon: <PenTool className="w-4 h-4 text-slate-700" />, defaultLabel: 'Firma de Conformidad del Trabajador' },
    { type: 'photo', label: 'Captura Evidencia / Foto', icon: <Camera className="w-4 h-4 text-cyan-600" />, defaultLabel: 'Fotografía de Terreno' }
  ];

  // Cargar formularios al inicio
  useEffect(() => {
    fetchFormularios();
    fetchRespuestas();
  }, []);

  const fetchFormularios = async () => {
    setLoadingForms(true);
    try {
      const { data, error } = await supabase
        .from('prevencion_formularios')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFormularios(data || []);
    } catch (err) {
      console.error('Error al cargar formularios:', err.message);
    } finally {
      setLoadingForms(false);
    }
  };

  const fetchRespuestas = async () => {
    setLoadingRespuestas(true);
    try {
      const { data, error } = await supabase
        .from('prevencion_respuestas')
        .select('*, prevencion_formularios(titulo, categoria)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRespuestas(data || []);
    } catch (err) {
      console.error('Error al cargar respuestas:', err.message);
    } finally {
      setLoadingRespuestas(false);
    }
  };

  // --- LÓGICA DE JOTFORM BUILDER ---
  const handleAddField = (elem) => {
    const newField = {
      id: 'field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: elem.type,
      label: elem.defaultLabel,
      required: false,
      placeholder: '',
      options: elem.options ? [...elem.options] : []
    };
    setFormFields([...formFields, newField]);
  };

  const handleUpdateField = (id, key, value) => {
    setFormFields(prev => prev.map(f => {
      if (f.id === id) return { ...f, [key]: value };
      return f;
    }));
  };

  const handleDeleteField = (id) => {
    setFormFields(prev => prev.filter(f => f.id !== id));
  };

  const handleAddOption = (fieldId) => {
    setFormFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        const nextOpt = `Nueva Opción ${f.options.length + 1}`;
        return { ...f, options: [...f.options, nextOpt] };
      }
      return f;
    }));
  };

  const handleUpdateOption = (fieldId, index, value) => {
    setFormFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        const updated = [...f.options];
        updated[index] = value;
        return { ...f, options: updated };
      }
      return f;
    }));
  };

  const handleDeleteOption = (fieldId, index) => {
    setFormFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        const updated = f.options.filter((_, idx) => idx !== index);
        return { ...f, options: updated };
      }
      return f;
    }));
  };

  const resetBuilder = () => {
    setEditingFormId(null);
    setFormMeta({
      titulo: '',
      descripcion: '',
      categoria: 'Inspección EPP'
    });
    setFormFields([]);
    setBuilderTab('edit');
  };

  const handleSaveForm = async () => {
    if (!formMeta.titulo.trim()) {
      alert('Por favor, ingresa un título para el formulario.');
      return;
    }
    if (formFields.length === 0) {
      alert('Añade al menos un campo o pregunta al formulario.');
      return;
    }

    setSavingForm(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const publicToken = 'form-' + Math.random().toString(36).substring(2, 10);

      if (editingFormId) {
        // Actualizar existente
        const { error } = await supabase
          .from('prevencion_formularios')
          .update({
            titulo: formMeta.titulo.trim(),
            descripcion: formMeta.descripcion.trim(),
            categoria: formMeta.categoria,
            campos: formFields
          })
          .eq('id', editingFormId);
        if (error) throw error;
        setSuccessMsg('Formulario actualizado con éxito.');
      } else {
        // Insertar nuevo
        const { error } = await supabase
          .from('prevencion_formularios')
          .insert([
            {
              titulo: formMeta.titulo.trim(),
              descripcion: formMeta.descripcion.trim(),
              categoria: formMeta.categoria,
              campos: formFields,
              creado_por: user ? user.email : 'Prevencionista',
              publico_token: publicToken
            }
          ]);
        if (error) throw error;
        setSuccessMsg('Nuevo formulario publicado exitosamente.');
      }

      await fetchFormularios();
      setActiveSection('mis_formularios');
      resetBuilder();
    } catch (err) {
      setErrorMsg('Error al guardar formulario: ' + err.message);
    } finally {
      setSavingForm(false);
    }
  };

  const handleEditForm = (form) => {
    setEditingFormId(form.id);
    setFormMeta({
      titulo: form.titulo,
      descripcion: form.descripcion || '',
      categoria: form.categoria || 'Inspección EPP'
    });
    setFormFields(form.campos || []);
    setBuilderTab('edit');
    setActiveSection('builder');
  };

  // --- LÓGICA DE FIRMA DIGITAL (CANVAS) ---
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        setSignatureDataUrl(canvas.toDataURL());
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureDataUrl('');
    }
  };

  // --- LÓGICA DE RESPONDER FORMULARIO ---
  const handleOpenFillForm = (form) => {
    setSelectedFormToFill(form);
    setFillAnswers({});
    setSignatureDataUrl('');
    setActiveSection('completar');
  };

  const handleSubmitFill = async (e) => {
    e.preventDefault();
    if (!selectedFormToFill) return;

    setSubmittingFill(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('prevencion_respuestas')
        .insert([
          {
            formulario_id: selectedFormToFill.id,
            proyecto_nombre: fillMetadata.proyecto_nombre.trim() || 'General / Terreno',
            inspector: fillMetadata.inspector.trim() || 'Anónimo',
            respuestas: fillAnswers,
            firma_url: signatureDataUrl
          }
        ]);

      if (error) throw error;

      setSuccessMsg(`Inspección "${selectedFormToFill.titulo}" guardada correctamente.`);
      setSelectedFormToFill(null);
      setFillAnswers({});
      setSignatureDataUrl('');
      await fetchRespuestas();
      setActiveSection('respuestas');
    } catch (err) {
      setErrorMsg('Error enviando formulario: ' + err.message);
    } finally {
      setSubmittingFill(false);
    }
  };

  const getFormPublicUrl = (form) => {
    const base = window.location.origin + window.location.pathname;
    return `${base}?prevencion_form=${form.publico_token || form.id}`;
  };

  return (
    <div className="space-y-6">

      {/* 1. Cabecera Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-primary" />
              <span>Prevención de Riesgos</span>
            </h2>
            <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">
              Gestor de inspecciones, AST, charlas de seguridad y creador dinámico de formularios (Jotform)
            </p>
          </div>
        </div>

        {activeSection === '' && (
          <button
            onClick={() => {
              resetBuilder();
              setActiveSection('builder');
            }}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary-hover transition cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Formulario</span>
          </button>
        )}
      </div>

      {/* Alertas */}
      {successMsg && <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold border border-emerald-250 animate-in fade-in duration-150">{successMsg}</div>}
      {errorMsg && <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-semibold border border-red-250 animate-in fade-in duration-150">{errorMsg}</div>}

      {/* ================= VISTA PRINCIPAL: MENÚ DE RECTÁNGULOS ================= */}
      {activeSection === '' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Card 1: Nuevo Formulario (Jotform Builder) */}
          <div 
            onClick={() => { resetBuilder(); setActiveSection('builder'); setErrorMsg(''); setSuccessMsg(''); }}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">Jotform Builder</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Nuevo Formulario
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Diseña formularios dinámicos arrastrando campos, radios, checklists, fotos y firmas.
              </p>
            </div>
          </div>

          {/* Card 2: Mis Formularios */}
          <div 
            onClick={() => { setActiveSection('mis_formularios'); setErrorMsg(''); setSuccessMsg(''); }}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
          >
            <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 w-fit">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Mis Formularios ({formularios.length})
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Catálogo de plantillas creadas. Genera enlaces públicos, edita o duplica formularios.
              </p>
            </div>
          </div>

          {/* Card 3: Completar Formulario */}
          <div 
            onClick={() => { setActiveSection('completar'); setErrorMsg(''); setSuccessMsg(''); }}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
          >
            <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 w-fit">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Completar en Terreno
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Selecciona una plantilla activa para responder inspecciones, charlas o AST en faena.
              </p>
            </div>
          </div>

          {/* Card 4: Registro de Respuestas */}
          <div 
            onClick={() => { setActiveSection('respuestas'); setErrorMsg(''); setSuccessMsg(''); }}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
          >
            <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 w-fit">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Registro de Inspecciones ({respuestas.length})
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Historial completo de inspecciones enviadas con firma digital e informes detallados.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ================= BARRA DE REGRESO SI SE ESTÁ DENTRO DE UN APARTADO ================= */}
      {activeSection !== '' && (
        <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
          <button
            onClick={() => { setActiveSection(''); setErrorMsg(''); setSuccessMsg(''); }}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-850 font-bold cursor-pointer transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Volver al menú de Prevención</span>
          </button>

          {activeSection === 'builder' && (
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBuilderTab('edit')}
                  className={`px-3 py-1.5 rounded-lg transition ${builderTab === 'edit' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
                >
                  Diseñar Formulario
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderTab('preview')}
                  className={`px-3 py-1.5 rounded-lg transition ${builderTab === 'preview' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
                >
                  Vista Previa (Live)
                </button>
              </div>

              <button
                onClick={handleSaveForm}
                disabled={savingForm}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{savingForm ? 'Publicando...' : 'Publicar Formulario'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= APARTADO 1: JOTFORM BUILDER (NUEVO FORMULARIO) ================= */}
      {activeSection === 'builder' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {builderTab === 'edit' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* PALETA IZQUIERDA: ELEMENTOS DISPONIBLES */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Añadir Campos al Formulario</span>
                  </h3>
                  <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">Haz clic en un elemento para incorporarlo</p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {availableElements.map((elem, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAddField(elem)}
                      className="flex items-center justify-between p-3 bg-slate-50 hover:bg-primary/5 hover:border-primary border border-slate-200 rounded-2xl transition cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl border border-slate-200 group-hover:border-primary/30 shadow-2xs">
                          {elem.icon}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 group-hover:text-primary transition block">{elem.label}</span>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400 group-hover:text-primary transition" />
                    </button>
                  ))}
                </div>
              </div>

              {/* LIENZO CENTRAL: CONFIGURACIÓN Y ESTRUCTURA DEL FORMULARIO */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Cabecera / Configuración Meta del Formulario */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Título del Formulario *</label>
                      <input
                        type="text"
                        value={formMeta.titulo}
                        onChange={(e) => setFormMeta({ ...formMeta, titulo: e.target.value })}
                        placeholder="ej: Inspección Diaria de Arneses y EPP"
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-850 font-extrabold focus:outline-none focus:border-primary uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Categoría</label>
                      <select
                        value={formMeta.categoria}
                        onChange={(e) => setFormMeta({ ...formMeta, categoria: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-750 font-semibold focus:outline-none focus:border-primary bg-white"
                      >
                        {categoriasPrevencion.map((cat, idx) => (
                          <option key={idx} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Instrucciones o Descripción</label>
                    <textarea
                      rows="2"
                      value={formMeta.descripcion}
                      onChange={(e) => setFormMeta({ ...formMeta, descripcion: e.target.value })}
                      placeholder="ej: Obligatorio completar antes del inicio de la jornada en terreno."
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* LIENZO DE CAMPOS AÑADIDOS */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Preguntas del Formulario ({formFields.length})</span>
                    <span className="text-[10px] text-slate-450 font-bold uppercase">Arrastra o edita cada campo</span>
                  </div>

                  {formFields.length === 0 ? (
                    <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-2">
                      <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600 uppercase">El formulario está vacío</p>
                      <p className="text-xs text-slate-450 max-w-sm mx-auto">
                        Haz clic en los elementos del panel izquierdo para ir añadiendo preguntas, checklists o firmas digitales.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formFields.map((field, index) => (
                        <div key={field.id} className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3 relative group">
                          
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] font-extrabold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md">
                              #{index + 1} - {field.type.toUpperCase()}
                            </span>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => handleUpdateField(field.id, 'required', e.target.checked)}
                                  className="rounded text-primary focus:ring-primary"
                                />
                                <span>Obligatorio</span>
                              </label>
                              <button
                                onClick={() => handleDeleteField(field.id)}
                                className="p-1 text-red-650 hover:bg-red-50 rounded-lg transition"
                                title="Eliminar campo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Pregunta / Etiqueta */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Título de la Pregunta / Etiqueta</label>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => handleUpdateField(field.id, 'label', e.target.value)}
                              placeholder="Escribe la pregunta aquí..."
                              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-850 focus:outline-none focus:border-primary"
                            />
                          </div>

                          {/* Opciones en caso de Radio o Checkbox */}
                          {(field.type === 'radio' || field.type === 'checkbox') && (
                            <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                              <span className="text-[9px] font-bold uppercase text-slate-450 block">Opciones Seleccionables:</span>
                              {field.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleUpdateOption(field.id, oIdx, e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 flex-1 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleDeleteOption(field.id, oIdx)}
                                    className="p-1 text-slate-400 hover:text-red-650"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => handleAddOption(field.id)}
                                className="text-[10px] font-extrabold text-primary hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Añadir Opción
                              </button>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}

                </div>

              </div>

            </div>
          ) : (
            /* VISTA PREVIA EN VIVO (LIVE PREVIEW DE CÓMO SE VERÁ EN MÓVIL/TERRENO) */
            <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-md space-y-6">
              <div className="border-b border-slate-100 pb-4 text-center space-y-1">
                <span className="text-[9px] font-extrabold uppercase bg-primary/10 text-primary px-3 py-1 rounded-full">
                  {formMeta.categoria}
                </span>
                <h2 className="text-lg font-black text-slate-850 uppercase tracking-wide mt-2">
                  {formMeta.titulo || 'Formulario sin título'}
                </h2>
                {formMeta.descripcion && (
                  <p className="text-xs text-slate-500">{formMeta.descripcion}</p>
                )}
              </div>

              <div className="space-y-5">
                {formFields.map((f, i) => (
                  <div key={f.id} className="space-y-1.5 border-b border-slate-100 pb-4">
                    <label className="block text-xs font-bold text-slate-800 uppercase">
                      {i + 1}. {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>

                    {f.type === 'text' && (
                      <input type="text" disabled placeholder="Respuesta de texto corto..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-400" />
                    )}
                    {f.type === 'textarea' && (
                      <textarea rows="2" disabled placeholder="Escriba sus observaciones..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-400" />
                    )}
                    {f.type === 'number' && (
                      <input type="number" disabled placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-400" />
                    )}
                    {f.type === 'date' && (
                      <input type="date" disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-400" />
                    )}
                    {f.type === 'status_switch' && (
                      <div className="flex gap-2">
                        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-200">Cumple</span>
                        <span className="bg-red-50 text-red-700 px-3 py-1 rounded-lg text-xs font-bold border border-red-200">No Cumple</span>
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold">N/A</span>
                      </div>
                    )}
                    {(f.type === 'radio' || f.type === 'checkbox') && (
                      <div className="space-y-1 pl-2">
                        {f.options.map((opt, oIdx) => (
                          <label key={oIdx} className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                            <input type={f.type === 'radio' ? 'radio' : 'checkbox'} disabled />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {f.type === 'signature' && (
                      <div className="h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-xs text-slate-400 italic">
                        [Área de Firma Digital en Terreno]
                      </div>
                    )}
                    {f.type === 'photo' && (
                      <div className="h-20 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-xs text-slate-400 font-semibold gap-1.5">
                        <Camera className="w-4 h-4" /> Capturar Foto de Evidencia
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ================= APARTADO 2: MIS FORMULARIOS (PLANTILLAS) ================= */}
      {activeSection === 'mis_formularios' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Banco de Plantillas ({formularios.length})</h3>
              <button
                onClick={() => { resetBuilder(); setActiveSection('builder'); }}
                className="flex items-center gap-1 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-primary-hover transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo
              </button>
            </div>

            {formularios.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No has creado ningún formulario aún. Haz clic en "Nuevo Formulario" para diseñar tu primera plantilla.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {formularios.map((f) => (
                  <div key={f.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-primary transition space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-extrabold uppercase bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                          {f.categoria}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">{f.campos ? f.campos.length : 0} preguntas</span>
                      </div>
                      <h4 className="font-extrabold text-slate-850 text-sm uppercase leading-snug">{f.titulo}</h4>
                      {f.descripcion && <p className="text-xs text-slate-500 line-clamp-2">{f.descripcion}</p>}
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenFillForm(f)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Responder
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setShareFormItem(f);
                            setShowShareModal(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Compartir Enlace Público / QR"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleEditForm(f)}
                          className="p-1.5 text-slate-650 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                          title="Editar plantilla"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={async () => {
                            if (confirm(`¿Estás seguro de eliminar el formulario "${f.titulo}"?`)) {
                              await supabase.from('prevencion_formularios').delete().eq('id', f.id);
                              fetchFormularios();
                            }
                          }}
                          className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= APARTADO 3: COMPLETAR FORMULARIO EN TERRENO ================= */}
      {activeSection === 'completar' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {!selectedFormToFill ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
                Selecciona la inspección a realizar en terreno
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {formularios.map(f => (
                  <div 
                    key={f.id} 
                    onClick={() => handleOpenFillForm(f)}
                    className="bg-slate-50 border border-slate-200 hover:border-primary p-4 rounded-2xl transition cursor-pointer space-y-2"
                  >
                    <span className="text-[9px] font-bold uppercase text-primary">{f.categoria}</span>
                    <h4 className="font-bold text-slate-800 text-xs uppercase">{f.titulo}</h4>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitFill} className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
              <div className="border-b border-slate-150 pb-4 space-y-1">
                <span className="text-[9px] font-extrabold uppercase bg-primary/10 text-primary px-3 py-1 rounded-full">
                  {selectedFormToFill.categoria}
                </span>
                <h2 className="text-base font-black text-slate-850 uppercase tracking-wide mt-2">
                  {selectedFormToFill.titulo}
                </h2>
                {selectedFormToFill.descripcion && (
                  <p className="text-xs text-slate-500">{selectedFormToFill.descripcion}</p>
                )}
              </div>

              {/* METADATOS DE LA INSPECCIÓN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Proyecto / Faena *</label>
                  <input
                    type="text"
                    required
                    value={fillMetadata.proyecto_nombre}
                    onChange={(e) => setFillMetadata({ ...fillMetadata, proyecto_nombre: e.target.value })}
                    placeholder="ej: Faena San Bernardo"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold uppercase text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Inspector / Realizado Por *</label>
                  <input
                    type="text"
                    required
                    value={fillMetadata.inspector}
                    onChange={(e) => setFillMetadata({ ...fillMetadata, inspector: e.target.value })}
                    placeholder="ej: Juan Pérez"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold uppercase text-slate-800"
                  />
                </div>
              </div>

              {/* CAMPOS DINÁMICOS DEL FORMULARIO */}
              <div className="space-y-6">
                {(selectedFormToFill.campos || []).map((f, index) => (
                  <div key={f.id} className="space-y-2 border-b border-slate-100 pb-5">
                    <label className="block text-xs font-extrabold text-slate-800 uppercase">
                      {index + 1}. {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>

                    {f.type === 'text' && (
                      <input
                        type="text"
                        required={f.required}
                        value={fillAnswers[f.id] || ''}
                        onChange={(e) => setFillAnswers({ ...fillAnswers, [f.id]: e.target.value })}
                        placeholder="Escriba aquí..."
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                      />
                    )}

                    {f.type === 'textarea' && (
                      <textarea
                        rows="3"
                        required={f.required}
                        value={fillAnswers[f.id] || ''}
                        onChange={(e) => setFillAnswers({ ...fillAnswers, [f.id]: e.target.value })}
                        placeholder="Escriba observaciones..."
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                      />
                    )}

                    {f.type === 'number' && (
                      <input
                        type="number"
                        required={f.required}
                        value={fillAnswers[f.id] || ''}
                        onChange={(e) => setFillAnswers({ ...fillAnswers, [f.id]: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                      />
                    )}

                    {f.type === 'date' && (
                      <input
                        type="date"
                        required={f.required}
                        value={fillAnswers[f.id] || ''}
                        onChange={(e) => setFillAnswers({ ...fillAnswers, [f.id]: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                      />
                    )}

                    {f.type === 'status_switch' && (
                      <div className="flex gap-3">
                        {['Cumple', 'No Cumple', 'N/A'].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setFillAnswers({ ...fillAnswers, [f.id]: st })}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                              fillAnswers[f.id] === st
                                ? st === 'Cumple' ? 'bg-emerald-600 text-white border-emerald-600' :
                                  st === 'No Cumple' ? 'bg-red-650 text-white border-red-650' : 'bg-slate-700 text-white border-slate-700'
                                : 'bg-slate-50 text-slate-700 border-slate-250'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    )}

                    {(f.type === 'radio' || f.type === 'checkbox') && (
                      <div className="space-y-1.5 pl-2">
                        {f.options.map((opt, oIdx) => (
                          <label key={oIdx} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type={f.type === 'radio' ? 'radio' : 'checkbox'}
                              name={f.id}
                              checked={
                                f.type === 'radio'
                                  ? fillAnswers[f.id] === opt
                                  : (fillAnswers[f.id] || []).includes(opt)
                              }
                              onChange={(e) => {
                                if (f.type === 'radio') {
                                  setFillAnswers({ ...fillAnswers, [f.id]: opt });
                                } else {
                                  const currentArr = fillAnswers[f.id] || [];
                                  const updated = e.target.checked
                                    ? [...currentArr, opt]
                                    : currentArr.filter(x => x !== opt);
                                  setFillAnswers({ ...fillAnswers, [f.id]: updated });
                                }
                              }}
                              className="text-primary focus:ring-primary"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {f.type === 'signature' && (
                      <div className="space-y-2">
                        <div className="border-2 border-slate-200 rounded-2xl p-1 bg-slate-50/50">
                          <canvas
                            ref={canvasRef}
                            width={500}
                            height={150}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-32 bg-white rounded-xl touch-none border border-slate-200 cursor-crosshair"
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-450 font-bold">Dibuja la firma en el cuadro con el dedo o puntero</span>
                          <button
                            type="button"
                            onClick={clearSignature}
                            className="text-red-650 hover:underline font-bold"
                          >
                            Limpiar Firma
                          </button>
                        </div>
                      </div>
                    )}

                    {f.type === 'photo' && (
                      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50">
                        <Camera className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                        <span className="text-xs font-bold text-slate-600 block">Cargar o Tomar Fotografía de Evidencia</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setFillAnswers({ ...fillAnswers, [f.id]: reader.result });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="mt-2 text-xs text-slate-500 file:bg-primary file:text-white file:border-0 file:px-3 file:py-1 file:rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={submittingFill}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl shadow-sm text-xs cursor-pointer flex items-center justify-center gap-2 transition"
              >
                <Send className="w-4 h-4" />
                <span>{submittingFill ? 'Enviando Inspección...' : 'Enviar Inspección de Prevención'}</span>
              </button>
            </form>
          )}

        </div>
      )}

      {/* ================= APARTADO 4: REGISTRO DE RESPUESTAS E INSPECCIONES ================= */}
      {activeSection === 'respuestas' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-4">
              Historial de Inspecciones Enviadas ({respuestas.length})
            </h3>

            {respuestas.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No hay inspecciones enviadas registradas en el sistema.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-650 font-bold text-[9px] uppercase tracking-wider select-none">
                      <th className="p-3.5">Formulario</th>
                      <th className="p-3.5">Proyecto / Faena</th>
                      <th className="p-3.5">Inspector</th>
                      <th className="p-3.5">Fecha y Hora</th>
                      <th className="p-3.5 w-24 text-center">Firma</th>
                      <th className="p-3.5 w-24 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {respuestas.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-3.5 font-bold text-slate-800 uppercase">
                          {r.prevencion_formularios ? r.prevencion_formularios.titulo : 'Formulario'}
                          <span className="block text-[9.5px] text-primary font-bold mt-0.5">
                            {r.prevencion_formularios ? r.prevencion_formularios.categoria : ''}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-700 font-semibold uppercase">{r.proyecto_nombre || '-'}</td>
                        <td className="p-3.5 text-slate-700 font-semibold uppercase">{r.inspector || '-'}</td>
                        <td className="p-3.5 text-slate-500 font-medium">
                          {new Date(r.created_at).toLocaleString('es-CL')}
                        </td>
                        <td className="p-3.5 text-center">
                          {r.firma_url ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3" /> Firmado
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">Sin firma</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setSelectedResponseDetail(r)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition"
                            title="Ver detalle completo"
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

      {/* ================= MODAL: DETALLE COMPLETO DE RESPUESTA ================= */}
      {selectedResponseDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                Detalle de Inspección #{selectedResponseDetail.id}
              </h3>
              <button onClick={() => setSelectedResponseDetail(null)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Proyecto / Faena:</span>
                  <span className="font-extrabold text-slate-800 uppercase">{selectedResponseDetail.proyecto_nombre}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Inspector:</span>
                  <span className="font-extrabold text-slate-800 uppercase">{selectedResponseDetail.inspector}</span>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block">Respuestas Registradas:</span>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 divide-y divide-slate-100">
                  {Object.entries(selectedResponseDetail.respuestas || {}).map(([fieldId, val], idx) => (
                    <div key={idx} className="pt-2 first:pt-0">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Pregunta ID ({fieldId}):</span>
                      <span className="text-xs font-bold text-slate-800 whitespace-pre-wrap">
                        {Array.isArray(val) ? val.join(', ') : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedResponseDetail.firma_url && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Firma Digital del Inspector:</span>
                  <img src={selectedResponseDetail.firma_url} alt="Firma Digital" className="h-24 border border-slate-200 rounded-xl bg-slate-50/50 p-2" />
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6 border-t border-slate-100 pt-3">
              <button
                onClick={() => setSelectedResponseDetail(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: COMPARTIR ENLACE PÚBLICO / CÓDIGO QR ================= */}
      {showShareModal && shareFormItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-primary" />
                <span>Compartir Formulario</span>
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-black text-slate-850 uppercase">{shareFormItem.titulo}</h4>
              <p className="text-xs text-slate-500">
                Comparte este enlace o código QR con trabajadores y prevencionistas para completar la inspección directamente desde cualquier teléfono móvil.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[9px] font-bold uppercase text-slate-450 block">Enlace Público Único:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getFormPublicUrl(shareFormItem)}
                  className="bg-white border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-700 flex-1 select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getFormPublicUrl(shareFormItem));
                    setSuccessMsg('Enlace público copiado al portapapeles.');
                  }}
                  className="bg-primary hover:bg-primary-hover text-white p-2 rounded-xl transition cursor-pointer"
                  title="Copiar enlace"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
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
