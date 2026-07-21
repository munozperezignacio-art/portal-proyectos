import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, ShieldAlert, Plus, Save, Trash2, FileText, CheckCircle2, 
  Share2, Copy, Eye, Edit, ChevronLeft, QrCode, AlertTriangle, 
  Type, AlignLeft, Hash, Calendar, CheckSquare, Radio, ToggleLeft, 
  PenTool, Camera, Sparkles, Send, Check, Download, Layers, Building2, User, BoxSelect, Layers3
} from 'lucide-react';

export default function Prevencion({ user, onBack }) {
  // Apartado activo: '' (Menú rectángulos), 'builder' (Creador de Formularios), 'mis_formularios', 'completar', 'respuestas'
  const [activeSection, setActiveSection] = useState('');

  // Lista de Formularios Guardados (Plantillas)
  const [formularios, setFormularios] = useState([]);
  const [loadingForms, setLoadingForms] = useState(true);

  // Lista de Respuestas Enviadas
  const [respuestas, setRespuestas] = useState([]);
  const [loadingRespuestas, setLoadingRespuestas] = useState(false);

  // ESTADO DEL CREADOR DE FORMULARIOS
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

  // FIRMAS DINÁMICAS (Canvas refs)
  const mainCanvasRef = useRef(null);
  const repeaterCanvasRefs = useRef({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [mainSignatureDataUrl, setMainSignatureDataUrl] = useState('');
  const [repeaterSignatures, setRepeaterSignatures] = useState({});

  // MODALES Y MENSAJES
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFormItem, setShareFormItem] = useState(null);
  const [selectedResponseDetail, setSelectedResponseDetail] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const categoriasPrevencion = [
    'Inspección EPP',
    'Charla 5 Minutos',
    'Análisis Seguro de Trabajo (AST)',
    'Matriz de Riesgo',
    'Reporte de Incidente / Accidente',
    'Lista de Chequeo Maquinaria / Herramientas',
    'Auditoría de Terreno'
  ];

  // Elementos disponibles para añadir en el Creador de Formularios
  const availableElements = [
    { type: 'text', label: 'Texto Corto', icon: <Type className="w-4 h-4 text-blue-600" />, defaultLabel: 'Nombre o Respuesta Corta' },
    { type: 'textarea', label: 'Texto Largo / Observaciones', icon: <AlignLeft className="w-4 h-4 text-indigo-600" />, defaultLabel: 'Observaciones o Descripción' },
    { type: 'number', label: 'Número / Medición', icon: <Hash className="w-4 h-4 text-emerald-600" />, defaultLabel: 'Cantidad o Medición' },
    { type: 'date', label: 'Fecha / Hora', icon: <Calendar className="w-4 h-4 text-amber-600" />, defaultLabel: 'Fecha de Inspección' },
    { type: 'status_switch', label: 'Cumple / No Cumple / N/A', icon: <ToggleLeft className="w-4 h-4 text-teal-600" />, defaultLabel: 'Estado de Cumplimiento' },
    { type: 'radio', label: 'Selección Única', icon: <Radio className="w-4 h-4 text-purple-600" />, defaultLabel: 'Seleccione una opción', options: ['Opción 1', 'Opción 2'] },
    { type: 'checkbox', label: 'Selección Múltiple', icon: <CheckSquare className="w-4 h-4 text-rose-600" />, defaultLabel: 'Verificación de Elementos', options: ['Elemento A', 'Elemento B', 'Elemento C'] },
    { type: 'signature', label: 'Firma Digital', icon: <PenTool className="w-4 h-4 text-slate-700" />, defaultLabel: 'Firma del Trabajador' },
    { type: 'photo', label: 'Captura Evidencia / Foto', icon: <Camera className="w-4 h-4 text-cyan-600" />, defaultLabel: 'Fotografía de Terreno' },
    { 
      type: 'repeater', 
      label: '📦 Bloque Repetible (Grupo +)', 
      icon: <Layers3 className="w-4 h-4 text-amber-600" />, 
      defaultLabel: 'Asistente / Firmante de Charla',
      buttonText: '+ Agregar Otro Integrante',
      subFields: [
        { id: 'sub_name_' + Date.now(), type: 'text', label: 'Nombre del Trabajador', required: true },
        { id: 'sub_rut_' + Date.now(), type: 'text', label: 'RUT / DNI', required: false },
        { id: 'sub_eval_' + Date.now(), type: 'status_switch', label: '¿Entendió Instrucciones?', required: true },
        { id: 'sub_sig_' + Date.now(), type: 'signature', label: 'Firma Digital', required: true }
      ]
    }
  ];

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

  // --- LÓGICA DE BUILDER ---
  const handleAddField = (elem) => {
    const newField = {
      id: 'field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: elem.type,
      label: elem.defaultLabel,
      buttonText: elem.buttonText || '+ Agregar Otro',
      required: false,
      placeholder: '',
      options: elem.options ? [...elem.options] : [],
      subFields: elem.subFields ? JSON.parse(JSON.stringify(elem.subFields)) : []
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

  const handleAddSubFieldToRepeater = (repeaterId, type) => {
    const elem = availableElements.find(e => e.type === type) || availableElements[0];
    const newSub = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: type,
      label: elem.defaultLabel,
      required: false,
      options: elem.options ? [...elem.options] : []
    };
    setFormFields(prev => prev.map(f => {
      if (f.id === repeaterId) {
        return { ...f, subFields: [...(f.subFields || []), newSub] };
      }
      return f;
    }));
  };

  const handleUpdateSubField = (repeaterId, subId, key, value) => {
    setFormFields(prev => prev.map(f => {
      if (f.id === repeaterId) {
        const updatedSubs = (f.subFields || []).map(sub => {
          if (sub.id === subId) return { ...sub, [key]: value };
          return sub;
        });
        return { ...f, subFields: updatedSubs };
      }
      return f;
    }));
  };

  const handleDeleteSubField = (repeaterId, subId) => {
    setFormFields(prev => prev.map(f => {
      if (f.id === repeaterId) {
        return { ...f, subFields: (f.subFields || []).filter(s => s.id !== subId) };
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

  // --- LÓGICA DE FIRMA CANVAS DE UN SOLO CAMPO O PRINCIPAL ---
  const startDrawing = (e, keyRef = 'main') => {
    const canvas = keyRef === 'main' ? mainCanvasRef.current : repeaterCanvasRefs.current[keyRef];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(keyRef);
  };

  const draw = (e, keyRef = 'main') => {
    if (isDrawing !== keyRef) return;
    const canvas = keyRef === 'main' ? mainCanvasRef.current : repeaterCanvasRefs.current[keyRef];
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

  const stopDrawing = (keyRef = 'main') => {
    if (isDrawing === keyRef) {
      setIsDrawing(false);
      const canvas = keyRef === 'main' ? mainCanvasRef.current : repeaterCanvasRefs.current[keyRef];
      if (canvas) {
        const url = canvas.toDataURL();
        if (keyRef === 'main') setMainSignatureDataUrl(url);
        else {
          setRepeaterSignatures(prev => ({ ...prev, [keyRef]: url }));
        }
      }
    }
  };

  const clearSignature = (keyRef = 'main') => {
    const canvas = keyRef === 'main' ? mainCanvasRef.current : repeaterCanvasRefs.current[keyRef];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (keyRef === 'main') setMainSignatureDataUrl('');
      else {
        setRepeaterSignatures(prev => ({ ...prev, [keyRef]: '' }));
      }
    }
  };

  // --- LÓGICA DE RESPONDER FORMULARIO ---
  const handleOpenFillForm = (form) => {
    setSelectedFormToFill(form);
    
    // Inicializar estructuras para bloques repetibles
    const initialAnswers = {};
    (form.campos || []).forEach(f => {
      if (f.type === 'repeater') {
        initialAnswers[f.id] = [{}]; // Iniciar con 1 bloque por defecto
      }
    });

    setFillAnswers(initialAnswers);
    setMainSignatureDataUrl('');
    setRepeaterSignatures({});
    setActiveSection('completar');
  };

  const handleAddRepeaterInstance = (fieldId) => {
    setFillAnswers(prev => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), {}]
    }));
  };

  const handleDeleteRepeaterInstance = (fieldId, index) => {
    setFillAnswers(prev => ({
      ...prev,
      [fieldId]: (prev[fieldId] || []).filter((_, idx) => idx !== index)
    }));
  };

  const handleUpdateRepeaterAnswer = (fieldId, instanceIndex, subFieldId, value) => {
    setFillAnswers(prev => {
      const instances = [...(prev[fieldId] || [])];
      instances[instanceIndex] = {
        ...(instances[instanceIndex] || {}),
        [subFieldId]: value
      };
      return { ...prev, [fieldId]: instances };
    });
  };

  const handleSubmitFill = async (e) => {
    e.preventDefault();
    if (!selectedFormToFill) return;

    setSubmittingFill(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Fusionar firmas de repetidores en las respuestas
      const finalAnswers = JSON.parse(JSON.stringify(fillAnswers));
      Object.entries(repeaterSignatures).forEach(([key, sigUrl]) => {
        const [fId, idx, subId] = key.split('_instance_');
        if (finalAnswers[fId] && finalAnswers[fId][idx]) {
          finalAnswers[fId][idx][subId] = sigUrl;
        }
      });

      const { error } = await supabase
        .from('prevencion_respuestas')
        .insert([
          {
            formulario_id: selectedFormToFill.id,
            proyecto_nombre: fillMetadata.proyecto_nombre.trim() || 'General / Terreno',
            inspector: fillMetadata.inspector.trim() || 'Anónimo',
            respuestas: finalAnswers,
            firma_url: mainSignatureDataUrl
          }
        ]);

      if (error) throw error;

      setSuccessMsg(`Inspección "${selectedFormToFill.titulo}" guardada correctamente.`);
      setSelectedFormToFill(null);
      setFillAnswers({});
      setMainSignatureDataUrl('');
      setRepeaterSignatures({});
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

  const handleHeaderBack = () => {
    if (activeSection !== '') {
      setActiveSection('');
      setErrorMsg('');
      setSuccessMsg('');
    } else {
      onBack();
    }
  };

  return (
    <div className="space-y-6 font-sans">

      {/* 1. Cabecera Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={handleHeaderBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer" title="Volver">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-primary" />
              <span>Prevención de Riesgos</span>
            </h2>
            <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">
              Gestor de inspecciones, AST, charlas de seguridad y creador de formularios dinámicos
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

      {/* ================= VISTA PRINCIPAL: RECTÁNGULOS ================= */}
      {activeSection === '' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Card 1: Nuevo Formulario */}
          <div 
            onClick={() => { resetBuilder(); setActiveSection('builder'); setErrorMsg(''); setSuccessMsg(''); }}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">Diseñador</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Nuevo Formulario
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Diseña formularios dinámicos con bloques repetibles de firmas, preguntas y fotografías.
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
                Catálogo de plantillas creadas. Genera enlaces públicos únicos y códigos QR.
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
                Historial completo de inspecciones enviadas con firmantes múltiples desglosados.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ================= BARRA DE NAVEGACIÓN DE APARTADO ================= */}
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

      {/* ================= APARTADO 1: CREADOR DE FORMULARIOS ================= */}
      {activeSection === 'builder' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {builderTab === 'edit' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* PALETA IZQUIERDA DE ELEMENTOS */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Añadir Elementos al Formulario</span>
                  </h3>
                  <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">Haz clic en un campo para incorporarlo</p>
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

              {/* LIENZO CENTRAL DE DISEÑO */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Meta del Formulario */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Título del Formulario *</label>
                      <input
                        type="text"
                        value={formMeta.titulo}
                        onChange={(e) => setFormMeta({ ...formMeta, titulo: e.target.value })}
                        placeholder="ej: Charla 5 Minutos y Registro de AST"
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
                    <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Descripción / Instrucciones</label>
                    <textarea
                      rows="2"
                      value={formMeta.descripcion}
                      onChange={(e) => setFormMeta({ ...formMeta, descripcion: e.target.value })}
                      placeholder="ej: Registro obligatorio de asistentes y evaluación de seguridad."
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* LIENZO DE CAMPOS Y BLOQUES */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Estructura del Formulario ({formFields.length})</span>
                    <span className="text-[10px] text-slate-450 font-bold uppercase">Configura cada pregunta o bloque</span>
                  </div>

                  {formFields.length === 0 ? (
                    <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-2">
                      <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600 uppercase">Formulario en blanco</p>
                      <p className="text-xs text-slate-450 max-w-sm mx-auto">
                        Haz clic en los elementos del panel izquierdo para incorporar preguntas o bloques repetibles de firmas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formFields.map((field, index) => {
                        const isRepeater = field.type === 'repeater';

                        return (
                          <div 
                            key={field.id} 
                            className={`p-4 border rounded-2xl space-y-3 relative ${
                              isRepeater ? 'bg-amber-50/40 border-amber-300' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md ${
                                isRepeater ? 'bg-amber-500 text-white' : 'bg-primary/10 text-primary'
                              }`}>
                                #{index + 1} - {isRepeater ? 'BLOQUE REPETIBLE (GRUPO +)' : field.type.toUpperCase()}
                              </span>
                              <div className="flex items-center gap-3">
                                {!isRepeater && (
                                  <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={field.required}
                                      onChange={(e) => handleUpdateField(field.id, 'required', e.target.checked)}
                                      className="rounded text-primary focus:ring-primary"
                                    />
                                    <span>Obligatorio</span>
                                  </label>
                                )}
                                <button
                                  onClick={() => handleDeleteField(field.id)}
                                  className="p-1 text-red-650 hover:bg-red-50 rounded-lg transition"
                                  title="Eliminar elemento"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Etiqueta Principal */}
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                                {isRepeater ? 'Título del Bloque Repetible' : 'Título de la Pregunta / Etiqueta'}
                              </label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => handleUpdateField(field.id, 'label', e.target.value)}
                                placeholder="Escribe el nombre aquí..."
                                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-extrabold text-slate-850 focus:outline-none focus:border-primary"
                              />
                            </div>

                            {/* CONFIGURACIÓN ESPECIAL DE BLOQUE REPETIBLE */}
                            {isRepeater ? (
                              <div className="space-y-3 pt-2">
                                <div>
                                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Texto del Botón para Agregar (+)</label>
                                  <input
                                    type="text"
                                    value={field.buttonText || '+ Agregar Otro'}
                                    onChange={(e) => handleUpdateField(field.id, 'buttonText', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-amber-800"
                                  />
                                </div>

                                <div className="space-y-2 border-t border-amber-200 pt-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                                      Campos contenidos dentro de este bloque:
                                    </span>
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleAddSubFieldToRepeater(field.id, e.target.value);
                                          e.target.value = '';
                                        }
                                      }}
                                      className="text-xs bg-white border border-amber-300 rounded-lg p-1 font-bold text-amber-800"
                                    >
                                      <option value="">+ Añadir Campo al Bloque...</option>
                                      <option value="text">Texto Corto</option>
                                      <option value="status_switch">Cumple/No Cumple</option>
                                      <option value="signature">Firma Digital</option>
                                      <option value="textarea">Texto Largo</option>
                                    </select>
                                  </div>

                                  <div className="space-y-2 pl-2">
                                    {(field.subFields || []).map((sub, sIdx) => (
                                      <div key={sub.id} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl">
                                        <span className="text-[9px] font-extrabold text-amber-600 uppercase w-20">{sub.type}</span>
                                        <input
                                          type="text"
                                          value={sub.label}
                                          onChange={(e) => handleUpdateSubField(field.id, sub.id, 'label', e.target.value)}
                                          className="flex-1 border-0 text-xs font-bold text-slate-800 focus:ring-0 p-1"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSubField(field.id, sub.id)}
                                          className="text-red-500 hover:bg-red-50 p-1 rounded"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Opciones estándar para Radio/Checkbox */
                              (field.type === 'radio' || field.type === 'checkbox') && (
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
                              )
                            )}

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

              </div>

            </div>
          ) : (
            /* VISTA PREVIA LIVE */
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
                  <div key={f.id} className="space-y-2 border-b border-slate-100 pb-4">
                    <label className="block text-xs font-bold text-slate-800 uppercase">
                      {i + 1}. {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>

                    {f.type === 'repeater' ? (
                      <div className="bg-amber-50/50 p-4 border border-amber-200 rounded-2xl space-y-3">
                        <span className="text-[10px] font-bold text-amber-800 block uppercase">[ Bloque Repetible #1 ]</span>
                        {(f.subFields || []).map((s, sIdx) => (
                          <div key={sIdx} className="text-xs text-slate-700 font-semibold pl-2">
                            • {s.label} ({s.type})
                          </div>
                        ))}
                        <button disabled className="mt-2 bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-not-allowed">
                          {f.buttonText || '+ Agregar Otro'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic block">Campo estándar ({f.type})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ================= APARTADO 2: MIS FORMULARIOS ================= */}
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
                        <span className="text-[10px] text-slate-400 font-bold">{f.campos ? f.campos.length : 0} elementos</span>
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

      {/* ================= APARTADO 3: COMPLETAR EN TERRENO (SOPORTA BLOQUES REPETIBLES) ================= */}
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

              {/* METADATOS */}
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

              {/* PREGUNTAS Y BLOQUES REPETIBLES */}
              <div className="space-y-6">
                {(selectedFormToFill.campos || []).map((f, index) => {
                  const isRepeater = f.type === 'repeater';

                  if (isRepeater) {
                    const instances = fillAnswers[f.id] || [{}];

                    return (
                      <div key={f.id} className="space-y-4 border-2 border-amber-200 rounded-3xl p-5 bg-amber-50/20">
                        <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                          <h4 className="text-xs font-black text-amber-900 uppercase">{index + 1}. {f.label}</h4>
                          <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-100 px-2 py-0.5 rounded-full">
                            {instances.length} registrados
                          </span>
                        </div>

                        {instances.map((inst, instIdx) => (
                          <div key={instIdx} className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3 relative shadow-2xs">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                              <span className="text-[10px] font-extrabold text-amber-800 uppercase">
                                #{instIdx + 1} {f.label}
                              </span>
                              {instances.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRepeaterInstance(f.id, instIdx)}
                                  className="text-red-500 hover:bg-red-50 text-[10px] font-bold px-2 py-0.5 rounded"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>

                            {(f.subFields || []).map((sub) => (
                              <div key={sub.id} className="space-y-1">
                                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                                  {sub.label}
                                </label>

                                {sub.type === 'text' && (
                                  <input
                                    type="text"
                                    value={inst[sub.id] || ''}
                                    onChange={(e) => handleUpdateRepeaterAnswer(f.id, instIdx, sub.id, e.target.value)}
                                    placeholder="Escriba aquí..."
                                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
                                  />
                                )}

                                {sub.type === 'status_switch' && (
                                  <div className="flex gap-2">
                                    {['Cumple', 'No Cumple', 'N/A'].map(st => (
                                      <button
                                        key={st}
                                        type="button"
                                        onClick={() => handleUpdateRepeaterAnswer(f.id, instIdx, sub.id, st)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                          inst[sub.id] === st
                                            ? st === 'Cumple' ? 'bg-emerald-600 text-white' :
                                              st === 'No Cumple' ? 'bg-red-650 text-white' : 'bg-slate-700 text-white'
                                            : 'bg-slate-50 text-slate-700 border-slate-200'
                                        }`}
                                      >
                                        {st}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {sub.type === 'signature' && (
                                  <div className="space-y-1">
                                    <div className="border border-slate-200 rounded-xl p-1 bg-slate-50">
                                      <canvas
                                        ref={el => { repeaterCanvasRefs.current[`${f.id}_instance_${instIdx}_${sub.id}`] = el; }}
                                        width={450}
                                        height={120}
                                        onMouseDown={(e) => startDrawing(e, `${f.id}_instance_${instIdx}_${sub.id}`)}
                                        onMouseMove={(e) => draw(e, `${f.id}_instance_${instIdx}_${sub.id}`)}
                                        onMouseUp={() => stopDrawing(`${f.id}_instance_${instIdx}_${sub.id}`)}
                                        onTouchStart={(e) => startDrawing(e, `${f.id}_instance_${instIdx}_${sub.id}`)}
                                        onTouchMove={(e) => draw(e, `${f.id}_instance_${instIdx}_${sub.id}`)}
                                        onTouchEnd={() => stopDrawing(`${f.id}_instance_${instIdx}_${sub.id}`)}
                                        className="w-full h-28 bg-white rounded-lg touch-none cursor-crosshair"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => clearSignature(`${f.id}_instance_${instIdx}_${sub.id}`)}
                                      className="text-[10px] text-red-650 font-bold hover:underline"
                                    >
                                      Limpiar Firma
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}

                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => handleAddRepeaterInstance(f.id)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{f.buttonText || '+ Agregar Otro'}</span>
                        </button>
                      </div>
                    );
                  }

                  // CAMPOS ESTÁNDAR
                  return (
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

                      {f.type === 'signature' && (
                        <div className="space-y-2">
                          <div className="border-2 border-slate-200 rounded-2xl p-1 bg-slate-50/50">
                            <canvas
                              ref={mainCanvasRef}
                              width={500}
                              height={150}
                              onMouseDown={(e) => startDrawing(e, 'main')}
                              onMouseMove={(e) => draw(e, 'main')}
                              onMouseUp={() => stopDrawing('main')}
                              onTouchStart={(e) => startDrawing(e, 'main')}
                              onTouchMove={(e) => draw(e, 'main')}
                              onTouchEnd={() => stopDrawing('main')}
                              className="w-full h-32 bg-white rounded-xl touch-none border border-slate-200 cursor-crosshair"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => clearSignature('main')}
                            className="text-[10px] text-red-650 font-bold hover:underline"
                          >
                            Limpiar Firma
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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

      {/* MODAL DETALLE RESPUESTA */}
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
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Pregunta ({fieldId}):</span>
                      <span className="text-xs font-bold text-slate-800 whitespace-pre-wrap">
                        {Array.isArray(val) ? JSON.stringify(val, null, 2) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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

      {/* MODAL COMPARTIR */}
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
                Comparte este enlace para responder la inspección desde cualquier teléfono celular sin login.
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
