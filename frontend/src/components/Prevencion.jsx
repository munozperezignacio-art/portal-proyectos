import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { sendSystemEmail } from '../utils/emailService';
import { generateFormPdf } from '../utils/pdfGenerator';
import { 
  ArrowLeft, ShieldAlert, Plus, Save, Trash2, FileText, CheckCircle2, 
  ChevronUp, ChevronDown, GripVertical, 
  Share2, Copy, Eye, Edit, ChevronLeft, QrCode, AlertTriangle, 
  Type, AlignLeft, Hash, Calendar, CheckSquare, Radio, ToggleLeft, 
  PenTool, Camera, Sparkles, Send, Check, Download, Layers, Building2, User, BoxSelect, Layers3,
  Award, BookOpen, GraduationCap, Video, HelpCircle, ExternalLink, FileSpreadsheet, Loader2
} from 'lucide-react';

export default function Prevencion({ user, onBack }) {
  // Apartado activo: '' (Menú), 'builder' (Creador), 'mis_formularios', 'completar', 'respuestas', 'capacitaciones', 'evaluaciones'
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
    categoria: 'Inspección EPP',
    correos_notificacion: '',
    codigo: '',
    revision: '',
    fecha_revision: ''
  });
  const [formFields, setFormFields] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [savingForm, setSavingForm] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');

  const [obrasList, setObrasList] = useState([]);
  const [formCompanyBranding, setFormCompanyBranding] = useState(null);

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

  // --- SUBMÓDULO CAPACITACIONES & EVALUACIONES ---
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [loadingCapacitaciones, setLoadingCapacitaciones] = useState(false);
  const [intentosEvaluaciones, setIntentosEvaluaciones] = useState([]);
  const [loadingIntentos, setLoadingIntentos] = useState(false);

  // Formulario Capacitación (Crear / Editar)
  const [showCapModal, setShowCapModal] = useState(false);
  const [capId, setCapId] = useState(null);
  const [capTitulo, setCapTitulo] = useState('');
  const [capDescripcion, setCapDescripcion] = useState('');
  const [capVideoUrl, setCapVideoUrl] = useState('');
  const [capContenidoTexto, setCapContenidoTexto] = useState('');

  // Configuración de Cuestionario (Evaluación)
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [selectedCapForQuiz, setSelectedCapForQuiz] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]); // [{"pregunta": "", "tipo": "multiple", "opciones": ["", ""], "correct_idx": 0, "puntos": 10}]

  // Compartir Capacitación
  const [showShareCapModal, setShowShareCapModal] = useState(false);
  const [shareCapItem, setShareCapItem] = useState(null);

  // Ver Detalle de Cuestionario de un Trabajador
  const [selectedIntentoDetail, setSelectedIntentoDetail] = useState(null);
  const [selectedResponseDetail, setSelectedResponseDetail] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // --- SUBMÓDULO CUMPLIMIENTO DE SEGURIDAD Y PREVENCIÓN ---
  const [personalMaestro, setPersonalMaestro] = useState([]);
  const [asignacionesCumplimiento, setAsignacionesCumplimiento] = useState([]);
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);
  const [registrosCumplimientoLog, setRegistrosCumplimientoLog] = useState([]);
  const [cumplimientoSubTab, setCumplimientoSubTab] = useState('seguimiento');
  
  // Formulario Asignación
  const [asigTrabajadorRut, setAsigTrabajadorRut] = useState('');
  const [asigTrabajadorNombre, setAsigTrabajadorNombre] = useState('');
  const [asigRegistroNombre, setAsigRegistroNombre] = useState('');
  const [asigFrecuencia, setAsigFrecuencia] = useState('Diario');
  const [asigFormType, setAsigFormType] = useState('');

  // Registrar Cumplimiento (Log)
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedAsigForLog, setSelectedAsigForLog] = useState(null);
  const [logFecha, setLogFecha] = useState(new Date().toISOString().split('T')[0]);
  const [logEstado, setLogEstado] = useState('Cumple');
  const [logObservaciones, setLogObservaciones] = useState('');

  // Historial de una asignación
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedAsigForHistory, setSelectedAsigForHistory] = useState(null);

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
    fetchCapacitaciones();
    fetchIntentosEvaluaciones();
    fetchPersonalMaestro();
    fetchAsignacionesCumplimiento();
    fetchRegistrosCumplimientoLog();
    fetchObrasList();
  }, []);

  const fetchObrasList = async () => {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('nombre')
        .order('nombre');
      if (error) throw error;
      setObrasList(data || []);
    } catch (err) {
      console.error('Error al cargar lista de obras:', err.message);
    }
  };

  const fetchFormCompanyBranding = async (empresaName) => {
    if (!empresaName) {
      setFormCompanyBranding(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('config_empresa')
        .select('logo_base64, color_primario, color_secundario')
        .eq('empresa', empresaName)
        .maybeSingle();
      if (error) throw error;
      setFormCompanyBranding(data || null);
    } catch (err) {
      console.error('Error al cargar branding de la empresa:', err.message);
      setFormCompanyBranding(null);
    }
  };

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
      console.error('Error al cargar formularios:', err?.message || 'Error desconocido');
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
      console.error('Error al cargar respuestas:', err?.message || 'Error desconocido');
    } finally {
      setLoadingRespuestas(false);
    }
  };

  const fetchCapacitaciones = async () => {
    setLoadingCapacitaciones(true);
    try {
      const { data, error } = await supabase
        .from('prevencion_capacitaciones')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCapacitaciones(data || []);
    } catch (err) {
      console.error('Error al cargar capacitaciones:', err?.message || 'Error desconocido');
    } finally {
      setLoadingCapacitaciones(false);
    }
  };

  const fetchIntentosEvaluaciones = async () => {
    setLoadingIntentos(true);
    try {
      const { data, error } = await supabase
        .from('prevencion_capacitaciones_intentos')
        .select('*, prevencion_capacitaciones(titulo)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setIntentosEvaluaciones(data || []);
    } catch (err) {
      console.error('Error al cargar intentos de evaluación:', err?.message || 'Error desconocido');
    } finally {
      setLoadingIntentos(false);
    }
  };

  const fetchPersonalMaestro = async () => {
    try {
      const { data, error } = await supabase
        .from('maestro_personal')
        .select('nombre, rut, cargo')
        .order('nombre', { ascending: true });
      if (error) throw error;
      setPersonalMaestro(data || []);
    } catch (err) {
      console.error('Error al cargar personal maestro:', err?.message || 'Error desconocido');
    }
  };

  const fetchAsignacionesCumplimiento = async () => {
    setLoadingAsignaciones(true);
    try {
      const { data, error } = await supabase
        .from('prevencion_cumplimiento_asignaciones')
        .select('*')
        .order('trabajador_nombre', { ascending: true });
      if (error) throw error;
      setAsignacionesCumplimiento(data || []);
    } catch (err) {
      console.error('Error al cargar asignaciones de cumplimiento:', err?.message || 'Error desconocido');
    } finally {
      setLoadingAsignaciones(false);
    }
  };

  const fetchRegistrosCumplimientoLog = async () => {
    try {
      const { data, error } = await supabase
        .from('prevencion_cumplimiento_registros')
        .select('*')
        .order('fecha_cumplimiento', { ascending: false });
      if (error) throw error;
      setRegistrosCumplimientoLog(data || []);
    } catch (err) {
      console.error('Error al cargar logs de cumplimiento:', err?.message || 'Error desconocido');
    }
  };

  const handleSaveAsignacion = async () => {
    if (!asigTrabajadorRut || !asigTrabajadorNombre.trim() || !asigRegistroNombre.trim()) {
      setErrorMsg('Por favor complete todos los datos del trabajador y del registro operacional.');
      return;
    }
    setSavingForm(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        trabajador_rut: asigTrabajadorRut,
        trabajador_nombre: asigTrabajadorNombre.trim(),
        registro_nombre: asigRegistroNombre.trim(),
        frecuencia: asigFrecuencia
      };

      const { error } = await supabase
        .from('prevencion_cumplimiento_asignaciones')
        .insert([payload]);
      if (error) throw error;

      setSuccessMsg('Asignación de cumplimiento guardada exitosamente.');
      
      // Reset form
      setAsigTrabajadorRut('');
      setAsigTrabajadorNombre('');
      setAsigRegistroNombre('');
      setAsigFrecuencia('Diario');
      setAsigFormType('');

      fetchAsignacionesCumplimiento();
    } catch (err) {
      setErrorMsg('Error al guardar asignación: ' + (err?.message || 'Error desconocido'));
    } finally {
      setSavingForm(false);
    }
  };

  const handleDeleteAsignacion = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta asignación de cumplimiento? Se borrará también su historial.')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase
        .from('prevencion_cumplimiento_asignaciones')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSuccessMsg('Asignación eliminada exitosamente.');
      fetchAsignacionesCumplimiento();
      fetchRegistrosCumplimientoLog();
    } catch (err) {
      setErrorMsg('Error al eliminar asignación: ' + (err?.message || 'Error desconocido'));
    }
  };

  const handleSaveCumplimientoLog = async () => {
    if (!selectedAsigForLog) return;
    setSavingForm(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        asignacion_id: selectedAsigForLog.id,
        fecha_cumplimiento: logFecha,
        estado: logEstado,
        observaciones: logObservaciones.trim(),
        verificado_por: user ? (user.correo || user.usuario) : 'Prevencionista'
      };

      const { error } = await supabase
        .from('prevencion_cumplimiento_registros')
        .insert([payload]);
      if (error) throw error;

      setSuccessMsg('Cumplimiento registrado con éxito.');
      setShowLogModal(false);
      
      // Reset form
      setSelectedAsigForLog(null);
      setLogFecha(new Date().toISOString().split('T')[0]);
      setLogEstado('Cumple');
      setLogObservaciones('');

      fetchRegistrosCumplimientoLog();
    } catch (err) {
      setErrorMsg('Error al registrar cumplimiento: ' + (err?.message || 'Error desconocido'));
    } finally {
      setSavingForm(false);
    }
  };

  const getCumplimientoStatus = (asig) => {
    const logs = registrosCumplimientoLog.filter(l => l.asignacion_id === asig.id);
    if (logs.length === 0) {
      return { label: 'Atrasado (Sin registros)', color: 'bg-rose-50 text-rose-700 border-rose-250', status: 'atrasado', lastDate: null };
    }
    
    const sortedLogs = [...logs].sort((a, b) => new Date(b.fecha_cumplimiento) - new Date(a.fecha_cumplimiento));
    const latestLog = sortedLogs[0];
    
    const todayStr = new Date().toISOString().split('T')[0];
    if (latestLog.fecha_cumplimiento >= todayStr) {
      return { label: 'Al Día', color: 'bg-emerald-50 text-emerald-700 border-emerald-250', status: 'aldia', lastDate: latestLog.fecha_cumplimiento };
    }
    
    const lastDate = new Date(latestLog.fecha_cumplimiento);
    const today = new Date();
    today.setHours(0,0,0,0);
    lastDate.setHours(0,0,0,0);
    
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (asig.frecuencia === 'Diario') {
      return { label: 'Atrasado', color: 'bg-rose-50 text-rose-700 border-rose-250', status: 'atrasado', lastDate: latestLog.fecha_cumplimiento };
    } else if (asig.frecuencia === 'Semanal') {
      if (diffDays <= 7) {
        return { label: 'Al Día', color: 'bg-emerald-50 text-emerald-700 border-emerald-250', status: 'aldia', lastDate: latestLog.fecha_cumplimiento };
      } else {
        return { label: 'Atrasado', color: 'bg-rose-50 text-rose-700 border-rose-250', status: 'atrasado', lastDate: latestLog.fecha_cumplimiento };
      }
    } else if (asig.frecuencia === 'Mensual') {
      if (diffDays <= 30) {
        return { label: 'Al Día', color: 'bg-emerald-50 text-emerald-700 border-emerald-250', status: 'aldia', lastDate: latestLog.fecha_cumplimiento };
      } else {
        return { label: 'Atrasado', color: 'bg-rose-50 text-rose-700 border-rose-250', status: 'atrasado', lastDate: latestLog.fecha_cumplimiento };
      }
    }
    
    return { label: 'Pendiente', color: 'bg-amber-50 text-amber-700 border-amber-250', status: 'pendiente', lastDate: latestLog.fecha_cumplimiento };
  };

  const handleSaveCapacitacion = async () => {
    if (!capTitulo.trim()) {
      setErrorMsg('Por favor ingresa un título para la capacitación.');
      return;
    }
    setSavingForm(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const payload = {
        titulo: capTitulo,
        descripcion: capDescripcion,
        video_url: capVideoUrl,
        contenido_texto: capContenidoTexto,
        creado_por: user ? (user.correo || user.usuario) : 'Prevencionista'
      };

      if (capId) {
        const { error } = await supabase
          .from('prevencion_capacitaciones')
          .update(payload)
          .eq('id', capId);
        if (error) throw error;
        setSuccessMsg('Capacitación actualizada exitosamente.');
      } else {
        const { error } = await supabase
          .from('prevencion_capacitaciones')
          .insert([{ ...payload, publico_token: token, preguntas: [] }]);
        if (error) throw error;
        setSuccessMsg('Nueva capacitación creada exitosamente.');
      }

      setShowCapModal(false);
      // Reset form
      setCapId(null);
      setCapTitulo('');
      setCapDescripcion('');
      setCapVideoUrl('');
      setCapContenidoTexto('');

      fetchCapacitaciones();
    } catch (err) {
      setErrorMsg('Error al guardar capacitación: ' + (err?.message || 'Error desconocido'));
    } finally {
      setSavingForm(false);
    }
  };

  const handleDeleteCapacitacion = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta capacitación y todas sus evaluaciones registradas?')) return;
    try {
      const { error } = await supabase
        .from('prevencion_capacitaciones')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSuccessMsg('Capacitación eliminada.');
      fetchCapacitaciones();
      fetchIntentosEvaluaciones();
    } catch (err) {
      setErrorMsg('Error al eliminar: ' + (err?.message || 'Error desconocido'));
    }
  };

  const handleSaveQuiz = async () => {
    if (!selectedCapForQuiz) return;
    setSavingForm(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase
        .from('prevencion_capacitaciones')
        .update({ preguntas: quizQuestions })
        .eq('id', selectedCapForQuiz.id);
      if (error) throw error;
      setSuccessMsg('Cuestionario de evaluación actualizado con éxito.');
      setShowQuizModal(false);
      fetchCapacitaciones();
    } catch (err) {
      setErrorMsg('Error al guardar cuestionario: ' + (err?.message || 'Error desconocido'));
    } finally {
      setSavingForm(false);
    }
  };

  const getShareCapUrl = (cap) => {
    const base = window.location.origin + window.location.pathname;
    return `${base}?prevencion_capacitacion=${cap.publico_token || cap.id}`;
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

  // Métodos para editar opciones de Selección Única y Múltiple
  const handleAddOption = (fieldId) => {
    setFormFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        const currentOptions = Array.isArray(f.options) ? f.options : [];
        return { ...f, options: [...currentOptions, `Nueva Opción ${currentOptions.length + 1}`] };
      }
      return f;
    }));
  };

  const handleUpdateOption = (fieldId, optionIdx, value) => {
    setFormFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        const currentOptions = Array.isArray(f.options) ? [...f.options] : [];
        currentOptions[optionIdx] = value;
        return { ...f, options: currentOptions };
      }
      return f;
    }));
  };

  const handleDeleteOption = (fieldId, optionIdx) => {
    setFormFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        const currentOptions = Array.isArray(f.options) ? [...f.options] : [];
        const filtered = currentOptions.filter((_, idx) => idx !== optionIdx);
        return { ...f, options: filtered };
      }
      return f;
    }));
  };

  // Métodos para reordenar campos (Botones + Drag & Drop)
  const handleMoveField = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === formFields.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...formFields];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setFormFields(updated);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = (index) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const updated = [...formFields];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, removed);
    setFormFields(updated);
    setDraggedIndex(null);
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
      categoria: 'Inspección EPP',
      correos_notificacion: '',
      codigo: '',
      revision: '',
      fecha_revision: ''
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

      const payload = {
        titulo: formMeta.titulo.trim(),
        descripcion: formMeta.descripcion.trim(),
        categoria: formMeta.categoria,
        campos: formFields,
        correos_notificacion: formMeta.correos_notificacion ? formMeta.correos_notificacion.trim() : null,
        codigo: formMeta.codigo ? formMeta.codigo.trim() : null,
        revision: formMeta.revision ? formMeta.revision.trim() : null,
        fecha_revision: formMeta.fecha_revision ? formMeta.fecha_revision.trim() : null,
        empresa: user ? user.empresa : 'Obraxis'
      };

      if (editingFormId) {
        const { error } = await supabase
          .from('prevencion_formularios')
          .update(payload)
          .eq('id', editingFormId);
        if (error) throw error;
        setSuccessMsg('Formulario actualizado con éxito.');
      } else {
        const { error } = await supabase
          .from('prevencion_formularios')
          .insert([
            {
              ...payload,
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
      categoria: form.categoria || 'Inspección EPP',
      correos_notificacion: form.correos_notificacion || '',
      codigo: form.codigo || '',
      revision: form.revision || '',
      fecha_revision: form.fecha_revision || ''
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
    fetchFormCompanyBranding(form.empresa || user?.empresa || 'Obraxis');
    
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

      // --- Despachar Reporte de Prevención y Seguridad por Correo ---
      try {
        let destinationEmails = selectedFormToFill.correos_notificacion;

        if (!destinationEmails) {
          const { data: configAlertas } = await supabase
            .from('config_correos')
            .select('correos')
            .eq('tipo', 'Prevencion y Seguridad')
            .maybeSingle();
          if (configAlertas && configAlertas.correos) {
            destinationEmails = configAlertas.correos;
          }
        }

        if (destinationEmails) {
          // Construir HTML del reporte
          let tableRowsHtml = "";
          (selectedFormToFill.campos || []).forEach((field) => {
            const ans = finalAnswers[field.id];
            let formattedAns = "";
            if (field.type === 'repeater') {
              if (Array.isArray(ans)) {
                formattedAns = `<table style="width: 100%; border-collapse: collapse; margin-top: 5px;">`;
                ans.forEach((instance, idx) => {
                  formattedAns += `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 5px; font-size: 11px; font-weight: bold; color: #64748b;">Instancia ${idx + 1}:</td><td style="padding: 5px;">`;
                  Object.entries(instance).forEach(([subId, subVal]) => {
                    const subField = field.subFields?.find(sf => sf.id === subId);
                    const subLabel = subField ? subField.label : subId;
                    if (subField?.type === 'signature' && subVal) {
                      formattedAns += `<b>${subLabel}:</b> <img src="${subVal}" style="max-height: 40px; vertical-align: middle;" /><br/>`;
                    } else {
                      formattedAns += `<b>${subLabel}:</b> ${subVal || '-'}<br/>`;
                    }
                  });
                  formattedAns += `</td></tr>`;
                });
                formattedAns += `</table>`;
              } else {
                formattedAns = "Sin registros";
              }
            } else if (field.type === 'signature' && ans) {
              formattedAns = `<img src="${ans}" style="max-height: 60px;" />`;
            } else {
              formattedAns = ans !== undefined ? String(ans) : "-";
            }

            tableRowsHtml += `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-size: 12px; color: #475569; font-weight: bold; width: 35%; background-color: #f8fafc;">${field.label}</td>
                <td style="padding: 10px; font-size: 12px; color: #1e293b;">${formattedAns}</td>
              </tr>
            `;
          });

          let mainSignatureHtml = "";
          if (mainSignatureDataUrl) {
            mainSignatureHtml = `
              <div style="margin-top: 25px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Firma del Inspector</h4>
                <img src="${mainSignatureDataUrl}" style="max-height: 80px; max-width: 100%;" />
              </div>
            `;
          }

          const mailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 25px; max-width: 600px; margin: auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
              <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #0f172a; margin: 0; font-size: 20px; text-transform: uppercase;">Portal de Prevención</h2>
                <p style="color: #2563eb; margin: 5px 0 0 0; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">${selectedFormToFill.titulo}</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <tr style="background-color: #f1f5f9;">
                  <th colspan="2" style="padding: 10px; font-size: 12px; color: #334155; text-align: left; border-bottom: 1px solid #e2e8f0;">Metadata del Registro</th>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 10px; font-size: 11px; color: #64748b; font-weight: bold; width: 35%;">Proyecto / Obra:</td>
                  <td style="padding: 8px 10px; font-size: 11px; color: #1e293b; font-weight: bold;">${fillMetadata.proyecto_nombre.trim() || 'General / Terreno'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 10px; font-size: 11px; color: #64748b; font-weight: bold;">Inspector / Autor:</td>
                  <td style="padding: 8px 10px; font-size: 11px; color: #1e293b;">${fillMetadata.inspector.trim() || 'Anónimo'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 10px; font-size: 11px; color: #64748b; font-weight: bold;">Fecha de Registro:</td>
                  <td style="padding: 8px 10px; font-size: 11px; color: #1e293b;">${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              </table>

              <h3 style="color: #0f172a; font-size: 13px; margin: 15px 0 10px 0; border-left: 4px solid #2563eb; padding-left: 8px; text-transform: uppercase; letter-spacing: 0.03em;">Registro</h3>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                ${tableRowsHtml}
              </table>

              ${mainSignatureHtml}

              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
              <p style="font-size: 10px; color: #94a3b8; text-align: center; margin: 0;">Este es un reporte automático enviado por el Portal de Proyectos de Obraxis.cl</p>
            </div>
          `;

          const pdfBase64 = generateFormPdf({
            form: selectedFormToFill,
            metadata: fillMetadata,
            answers: finalAnswers,
            mainSignature: mainSignatureDataUrl,
            companyLogo: formCompanyBranding?.logo_base64
          });

          await sendSystemEmail({
            to: destinationEmails,
            subject: `📋 Nueva Inspección: ${selectedFormToFill.titulo} - ${fillMetadata.proyecto_nombre || 'General'}`,
            htmlContent: mailHtml,
            attachments: [
              {
                content: pdfBase64,
                filename: `${selectedFormToFill.titulo.replace(/[^a-zA-Z0-9]/g, '_')}_Reporte.pdf`,
                content_type: 'application/pdf'
              }
            ]
          });
        }
      } catch (errMail) {
        console.error('Error al despachar correo de prevención:', errMail.toString());
        alert('Error al enviar correo: ' + errMail.toString());
      }

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

          {/* Card 5: Capacitaciones */}
          <div 
            onClick={() => { setActiveSection('capacitaciones'); setErrorMsg(''); setSuccessMsg(''); fetchCapacitaciones(); }}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
          >
            <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 w-fit">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Capacitaciones ({capacitaciones.length})
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Administra cursos con videos, textos y cuestionarios de evaluación con calificaciones.
              </p>
            </div>
          </div>

          {/* Card 6: Resultados Evaluaciones */}
          <div 
            onClick={() => { setActiveSection('evaluaciones'); setErrorMsg(''); setSuccessMsg(''); fetchIntentosEvaluaciones(); }}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
          >
            <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 w-fit">
              <Award className="w-6 h-6" />
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Resultados Evaluaciones ({intentosEvaluaciones.length})
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Verifica las notas, aciertos y estado de aprobación de los trabajadores en tiempo real.
              </p>
            </div>
          </div>

          {/* Card 7: Cumplimiento de Seguridad y Prevención */}
          <div 
            onClick={() => { 
              setActiveSection('cumplimiento'); 
              setErrorMsg(''); 
              setSuccessMsg(''); 
              fetchAsignacionesCumplimiento(); 
              fetchRegistrosCumplimientoLog(); 
            }}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
          >
            <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 w-fit">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Cumplimiento de Seguridad y Prevención
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Asigna registros operacionales a trabajadores con plazos diarios, semanales o mensuales y realiza su seguimiento.
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
          {activeSection === 'cumplimiento' && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCumplimientoSubTab('seguimiento')}
                className={`px-3 py-1.5 rounded-lg transition ${cumplimientoSubTab === 'seguimiento' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
              >
                Seguimiento de Cumplimiento
              </button>
              <button
                type="button"
                onClick={() => setCumplimientoSubTab('asignar')}
                className={`px-3 py-1.5 rounded-lg transition ${cumplimientoSubTab === 'asignar' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
              >
                Asignar Registro Operacional
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
                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Título del Formulario *</label>
                      <input
                        type="text"
                        value={formMeta.titulo}
                        onChange={(e) => setFormMeta({ ...formMeta, titulo: e.target.value })}
                        placeholder="ej: Charla 5 Minutos y Registro de AST"
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-850 font-extrabold focus:outline-none focus:border-primary uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Código (Opcional)</label>
                      <input
                        type="text"
                        value={formMeta.codigo}
                        onChange={(e) => setFormMeta({ ...formMeta, codigo: e.target.value })}
                        placeholder="ej: RG-PCM-14-03"
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Fecha Revisión (Opcional)</label>
                      <input
                        type="text"
                        value={formMeta.fecha_revision}
                        onChange={(e) => setFormMeta({ ...formMeta, fecha_revision: e.target.value })}
                        placeholder="ej: 09/07/2026"
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Revisión (Opcional)</label>
                      <input
                        type="text"
                        value={formMeta.revision}
                        onChange={(e) => setFormMeta({ ...formMeta, revision: e.target.value })}
                        placeholder="ej: 13"
                        className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                      />
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

                  <div>
                    {(() => {
                      const emailsList = formMeta.correos_notificacion 
                        ? formMeta.correos_notificacion.split(',').map(e => e.trim()).filter(Boolean)
                        : [];
                      
                      const handleAddEmail = (e) => {
                        e.preventDefault();
                        const email = newEmailInput.trim().toLowerCase();
                        if (!email) return;
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes('..')) {
                          alert("Por favor ingrese un correo válido sin puntos consecutivos.");
                          return;
                        }
                        if (emailsList.includes(email)) {
                          alert("Este correo ya está agregado.");
                          return;
                        }
                        const updatedEmails = [...emailsList, email].join(', ');
                        setFormMeta({ ...formMeta, correos_notificacion: updatedEmails });
                        setNewEmailInput('');
                      };

                      const handleRemoveEmail = (emailToRemove) => {
                        const updatedEmails = emailsList.filter(e => e !== emailToRemove).join(', ');
                        setFormMeta({ ...formMeta, correos_notificacion: updatedEmails });
                      };

                      return (
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Correos de Notificación de Alertas (Opcional)</label>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={newEmailInput}
                              onChange={(e) => setNewEmailInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddEmail(e);
                                }
                              }}
                              placeholder="ej: supervisor@obraxis.cl"
                              className="flex-1 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={handleAddEmail}
                              className="bg-primary hover:bg-primary-hover text-white px-4 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-xs"
                            >
                              + Agregar
                            </button>
                          </div>

                          {/* Lista de correos agregados */}
                          {emailsList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1.5">
                              {emailsList.map((email, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-750 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">
                                  <span>{email}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEmail(email)}
                                    className="text-slate-400 hover:text-red-600 font-bold focus:outline-none cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          <p className="text-[9px] text-slate-400 mt-1">Si dejas esta lista vacía, las respuestas se notificarán a los correos configurados de forma general en el panel de Alertas de Correo.</p>
                        </div>
                      );
                    })()}
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
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={() => handleDrop(index)}
                            className={`p-4 border rounded-2xl space-y-3 relative transition ${
                              isRepeater ? 'bg-amber-50/40 border-amber-300' : 'bg-slate-50 border-slate-200'
                            } ${draggedIndex === index ? 'opacity-40 border-dashed border-primary bg-primary/5' : ''}`}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <div className="flex items-center gap-2">
                                <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded-lg text-slate-400" title="Arrastra para reordenar">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md ${
                                  isRepeater ? 'bg-amber-500 text-white' : 'bg-primary/10 text-primary'
                                }`}>
                                  #{index + 1} - {isRepeater ? 'BLOQUE REPETIBLE (GRUPO +)' : field.type.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                {/* Botones para Reordenar con Click */}
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveField(index, 'up')}
                                    disabled={index === 0}
                                    className={`p-1.5 hover:bg-slate-100 transition border-r border-slate-200 ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                    title="Mover arriba"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveField(index, 'down')}
                                    disabled={index === formFields.length - 1}
                                    className={`p-1.5 hover:bg-slate-100 transition ${index === formFields.length - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                    title="Mover abajo"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                  </button>
                                </div>

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
                                  type="button"
                                  onClick={() => handleDeleteField(field.id)}
                                  className="p-1 text-red-650 hover:bg-red-50 rounded-lg transition cursor-pointer"
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
              {/* EMIN/OBRAXIS FORMATO ENCABEZADO */}
              <div className="border border-slate-300 rounded-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-12 mb-6">
                {/* Logo Empresa */}
                <div className="sm:col-span-3 flex items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-slate-300 bg-white">
                  {formCompanyBranding?.logo_base64 ? (
                    <img 
                      src={formCompanyBranding.logo_base64} 
                      className="max-h-12 max-w-full object-contain" 
                      alt="Logo Empresa" 
                    />
                  ) : (
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OBRAXIS</div>
                  )}
                </div>

                {/* Título y Subtítulo Central */}
                <div className="sm:col-span-6 flex flex-col justify-center p-4 border-b sm:border-b-0 sm:border-r border-slate-300 text-center bg-white">
                  <div className="text-[9px] font-black text-slate-450 uppercase tracking-widest">REGISTRO OPERACIONAL DIGITAL</div>
                  <h2 className="text-xs font-black text-primary uppercase tracking-wide mt-1">
                    {selectedFormToFill.titulo}
                  </h2>
                  {selectedFormToFill.descripcion && (
                    <p className="text-[9px] text-slate-500 mt-0.5">{selectedFormToFill.descripcion}</p>
                  )}
                </div>

                {/* Metadatos de la Revisión */}
                <div className="sm:col-span-3 flex flex-col justify-center p-4 text-[9px] text-slate-600 font-bold space-y-1 text-left sm:pl-6 bg-slate-50/50">
                  <div><span className="text-slate-400 font-normal">Código:</span> {selectedFormToFill.codigo || 'N/A'}</div>
                  <div><span className="text-slate-400 font-normal">Fecha:</span> {selectedFormToFill.fecha_revision || 'N/A'}</div>
                  <div><span className="text-slate-400 font-normal">Revisión:</span> {selectedFormToFill.revision || 'N/A'}</div>
                </div>
              </div>

              {/* METADATOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Obra Activa Seleccionada *</label>
                  <select
                    required
                    value={fillMetadata.proyecto_nombre}
                    onChange={(e) => setFillMetadata({ ...fillMetadata, proyecto_nombre: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold uppercase text-slate-800 focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Selecciona Obra --</option>
                    {obrasList.map((ob, oIdx) => (
                      <option key={oIdx} value={ob.nombre}>{ob.nombre}</option>
                    ))}
                  </select>
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



      {/* ================= APARTADO: CAPACITACIONES ================= */}
      {activeSection === 'capacitaciones' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
              Gestión de Capacitaciones ({capacitaciones.length})
            </h3>
            <button
              onClick={() => {
                setCapId(null);
                setCapTitulo('');
                setCapDescripcion('');
                setCapVideoUrl('');
                setCapContenidoTexto('');
                setShowCapModal(true);
              }}
              className="bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Capacitación</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capacitaciones.map((cap) => {
              const cantPreguntas = Array.isArray(cap.preguntas) ? cap.preguntas.length : 0;
              return (
                <div key={cap.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-black text-slate-850 text-xs uppercase tracking-wider line-clamp-1">{cap.titulo}</h4>
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                        {cantPreguntas} {cantPreguntas === 1 ? 'Pregunta' : 'Preguntas'}
                      </span>
                    </div>
                    {cap.descripcion && <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{cap.descripcion}</p>}
                    
                    <div className="flex flex-col gap-1 text-[10px] text-slate-450 font-bold uppercase pt-2">
                      <div className="flex items-center gap-1.5">
                        <Video className={`w-3.5 h-3.5 ${cap.video_url ? 'text-emerald-500' : 'text-slate-300'}`} />
                        <span>{cap.video_url ? 'Video Vinculado' : 'Sin Video'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className={`w-3.5 h-3.5 ${cap.contenido_texto ? 'text-emerald-500' : 'text-slate-300'}`} />
                        <span>{cap.contenido_texto ? 'Texto Vinculado' : 'Sin Material Texto'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t pt-4">
                    <button
                      onClick={() => {
                        setCapId(cap.id);
                        setCapTitulo(cap.titulo);
                        setCapDescripcion(cap.descripcion || '');
                        setCapVideoUrl(cap.video_url || '');
                        setCapContenidoTexto(cap.contenido_texto || '');
                        setShowCapModal(true);
                      }}
                      className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] uppercase py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCapForQuiz(cap);
                        setQuizQuestions(Array.isArray(cap.preguntas) ? JSON.parse(JSON.stringify(cap.preguntas)) : []);
                        setShowQuizModal(true);
                      }}
                      className="bg-primary/5 hover:bg-primary/10 text-primary font-extrabold text-[10px] uppercase py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Award className="w-3.5 h-3.5" /> Cuestionario
                    </button>
                    <button
                      onClick={() => {
                        setShareCapItem(cap);
                        setShowShareCapModal(true);
                      }}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[10px] uppercase py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Compartir
                    </button>
                    <button
                      onClick={() => handleDeleteCapacitacion(cap.id)}
                      className="border border-red-200 hover:bg-red-50 text-red-650 font-bold text-[10px] uppercase py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  </div>
                </div>
              );
            })}

            {capacitaciones.length === 0 && (
              <div className="md:col-span-3 bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center text-xs text-slate-500 font-bold uppercase">
                No tienes capacitaciones creadas aún. Presiona "Nueva Capacitación" arriba para empezar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= APARTADO: RESULTADOS DE EVALUACIONES ================= */}
      {activeSection === 'evaluaciones' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-4">
              Historial de Evaluaciones y Calificaciones ({intentosEvaluaciones.length})
            </h3>

            {intentosEvaluaciones.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No hay evaluaciones registradas en el sistema todavía.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none">
                      <th className="p-3.5">Capacitación</th>
                      <th className="p-3.5">Nombre Trabajador</th>
                      <th className="p-3.5">RUT / Identificación</th>
                      <th className="p-3.5 text-center">Respuestas (Correctas)</th>
                      <th className="p-3.5 text-center">Nota</th>
                      <th className="p-3.5 text-center">Resultado</th>
                      <th className="p-3.5">Fecha Intento</th>
                      <th className="p-3.5 w-24 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-slate-700 font-semibold">
                    {intentosEvaluaciones.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-50/50">
                        <td className="p-3.5 max-w-[200px] truncate uppercase font-bold text-slate-800">
                          {i.prevencion_capacitaciones ? i.prevencion_capacitaciones.titulo : 'Capacitación'}
                        </td>
                        <td className="p-3.5 uppercase">{i.nombre_trabajador}</td>
                        <td className="p-3.5 font-mono">{i.rut_trabajador}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-slate-600">
                          {i.puntaje_obtenido} / {i.puntaje_maximo}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`text-sm font-black px-2 py-0.5 rounded ${i.aprobado ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {parseFloat(i.nota).toFixed(1)}
                          </span>
                        </td>
                        <td className="p-3.5 text-center select-none">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            i.aprobado ? 'bg-emerald-50 text-emerald-600 border border-emerald-250' : 'bg-rose-50 text-rose-600 border border-rose-250'
                          }`}>
                            {i.aprobado ? 'Aprobado' : 'Reprobado'}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-450 font-mono">
                          {new Date(i.created_at).toLocaleDateString()} {new Date(i.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={async () => {
                              try {
                                const { data: capData } = await supabase
                                  .from('prevencion_capacitaciones')
                                  .select('*')
                                  .eq('id', i.capacitacion_id)
                                  .maybeSingle();
                                setSelectedIntentoDetail({
                                  ...i,
                                  curso: capData
                                });
                              } catch (err) {
                                console.error('Error al cargar detalle:', err);
                              }
                            }}
                            className="bg-primary/5 hover:bg-primary/10 text-primary p-1.5 rounded-lg cursor-pointer"
                            title="Ver detalles de respuestas"
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

      {/* MODAL CREAR / EDITAR CAPACITACIÓN */}
      {showCapModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span>{capId ? 'Editar Capacitación' : 'Nueva Capacitación'}</span>
              </h3>
              <button onClick={() => setShowCapModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Título de la Capacitación</label>
                <input 
                  type="text" 
                  value={capTitulo} 
                  onChange={(e) => setCapTitulo(e.target.value)} 
                  placeholder="ej: Uso Correcto de EPP para Trabajo en Altura" 
                  className="w-full border border-slate-200 rounded-xl p-2 bg-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Descripción Corta</label>
                <input 
                  type="text" 
                  value={capDescripcion} 
                  onChange={(e) => setCapDescripcion(e.target.value)} 
                  placeholder="Resumen del material para los trabajadores..." 
                  className="w-full border border-slate-200 rounded-xl p-2 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Enlace de Video (YouTube / Vimeo)</label>
                <input 
                  type="text" 
                  value={capVideoUrl} 
                  onChange={(e) => setCapVideoUrl(e.target.value)} 
                  placeholder="https://www.youtube.com/watch?v=..." 
                  className="w-full border border-slate-200 rounded-xl p-2 bg-white font-mono text-slate-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-450">Contenido de Texto / Instrucciones de Estudio</label>
                <textarea 
                  value={capContenidoTexto} 
                  onChange={(e) => setCapContenidoTexto(e.target.value)} 
                  placeholder="Escribe aquí el material instructivo, manuales, normas de seguridad y consideraciones..." 
                  rows="6"
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-white font-normal"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setShowCapModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCapacitacion}
                disabled={savingForm}
                className="bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                {savingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Guardar Capacitación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN CUESTIONARIO */}
      {showQuizModal && selectedCapForQuiz && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 shrink-0">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-5 h-5 text-emerald-650" />
                  <span>Configurar Evaluación (Cuestionario)</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{selectedCapForQuiz.titulo}</p>
              </div>
              <button onClick={() => setShowQuizModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {/* Listado de Preguntas */}
            <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-4 text-xs font-semibold text-slate-700">
              {quizQuestions.map((q, idx) => (
                <div key={idx} className="bg-slate-50 border rounded-2xl p-4 space-y-3 relative">
                  <button 
                    onClick={() => setQuizQuestions(quizQuestions.filter((_, i) => i !== idx))}
                    className="absolute top-2.5 right-2.5 text-red-500 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer transition"
                    title="Eliminar pregunta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-450 block">Pregunta {idx + 1}</label>
                      <input 
                        type="text" 
                        value={q.pregunta} 
                        onChange={(e) => {
                          const updated = [...quizQuestions];
                          updated[idx].pregunta = e.target.value;
                          setQuizQuestions(updated);
                        }} 
                        placeholder="ej: ¿Cuál es la altura mínima para requerir arnés de seguridad?" 
                        className="w-full border border-slate-200 rounded-lg p-1.5 bg-white font-bold"
                      />
                    </div>
                    <div className="w-20 space-y-1 shrink-0">
                      <label className="text-[9px] font-bold uppercase text-slate-450 block text-right">Puntos</label>
                      <input 
                        type="number" 
                        value={q.puntos} 
                        onChange={(e) => {
                          const updated = [...quizQuestions];
                          updated[idx].puntos = parseFloat(e.target.value) || 1;
                          setQuizQuestions(updated);
                        }} 
                        className="w-full border border-slate-200 rounded-lg p-1.5 bg-white text-right font-bold"
                      />
                    </div>
                  </div>

                  {/* Opciones */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase text-slate-450 flex justify-between items-center">
                      <span>Opciones de Respuesta</span>
                      <button 
                        onClick={() => {
                          const updated = [...quizQuestions];
                          updated[idx].opciones = [...(updated[idx].opciones || []), ''];
                          setQuizQuestions(updated);
                        }}
                        className="text-[8px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer transition font-black uppercase"
                      >
                        + Agregar Opción
                      </button>
                    </label>

                    <div className="space-y-1.5">
                      {(q.opciones || []).map((op, opIdx) => (
                        <div key={opIdx} className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name={`correct-${idx}`} 
                            checked={parseInt(q.correct_idx) === opIdx}
                            onChange={() => {
                              const updated = [...quizQuestions];
                              updated[idx].correct_idx = opIdx;
                              setQuizQuestions(updated);
                            }}
                            className="w-4 h-4 text-primary border-slate-350 focus:ring-primary cursor-pointer"
                            title="Marcar como respuesta correcta"
                          />
                          <input 
                            type="text" 
                            value={op} 
                            onChange={(e) => {
                              const updated = [...quizQuestions];
                              updated[idx].opciones[opIdx] = e.target.value;
                              setQuizQuestions(updated);
                            }} 
                            placeholder={`Opción ${opIdx + 1}`} 
                            className="flex-1 border border-slate-200 rounded-lg p-1.5 bg-white font-semibold text-slate-800"
                          />
                          <button 
                            disabled={q.opciones.length <= 2}
                            onClick={() => {
                              const updated = [...quizQuestions];
                              updated[idx].opciones = updated[idx].opciones.filter((_, o) => o !== opIdx);
                              if (parseInt(q.correct_idx) >= updated[idx].opciones.length) {
                                updated[idx].correct_idx = 0;
                              }
                              setQuizQuestions(updated);
                            }}
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer transition disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {quizQuestions.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-550 font-bold uppercase border border-dashed rounded-3xl bg-slate-50">
                  No hay preguntas en este cuestionario. Haz clic en "Agregar Pregunta" abajo.
                </div>
              )}

              <button
                onClick={() => {
                  setQuizQuestions([...quizQuestions, {
                    pregunta: '',
                    tipo: 'multiple',
                    opciones: ['Opción A', 'Opción B'],
                    correct_idx: 0,
                    puntos: 1
                  }]);
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] uppercase py-2.5 rounded-xl border border-dashed border-slate-300 transition cursor-pointer"
              >
                + Agregar Pregunta
              </button>
            </div>

            <div className="flex justify-between items-center pt-3 border-t shrink-0">
              <span className="text-[10px] text-slate-450 font-bold uppercase">
                Total Puntos: {quizQuestions.reduce((s, q) => s + (parseFloat(q.puntos) || 0), 0)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowQuizModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveQuiz}
                  disabled={savingForm}
                  className="bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1"
                >
                  {savingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Guardar Evaluación</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL COMPARTIR CAPACITACIÓN */}
      {showShareCapModal && shareCapItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-primary" />
                <span>Compartir Capacitación</span>
              </h3>
              <button onClick={() => setShowShareCapModal(false)} className="text-slate-400 hover:text-slate-655 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-black text-slate-850 uppercase">{shareCapItem.titulo}</h4>
              <p className="text-xs text-slate-500">
                Comparte este enlace para que los trabajadores realicen el curso y respondan el examen desde cualquier dispositivo.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[9px] font-bold uppercase text-slate-450 block">Enlace de la Capacitación:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getShareCapUrl(shareCapItem)}
                  className="bg-white border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-700 flex-1 select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getShareCapUrl(shareCapItem));
                    setSuccessMsg('Enlace de capacitación copiado.');
                    setShowShareCapModal(false);
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
                onClick={() => setShowShareCapModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLES DEL INTENTO DE EVALUACIÓN */}
      {selectedIntentoDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 shrink-0">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-5 h-5 text-emerald-650" />
                  <span>Hoja de Respuestas de Trabajador</span>
                </h3>
                <p className="text-[10px] text-slate-450 font-bold uppercase">{selectedIntentoDetail.nombre_trabajador}</p>
              </div>
              <button onClick={() => setSelectedIntentoDetail(null)} className="text-slate-400 hover:text-slate-655 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {/* Ficha Resumen */}
            <div className="bg-slate-50 p-4 rounded-2xl border my-4 grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700 shrink-0">
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-450 uppercase">RUT</p>
                <p className="text-slate-800 font-mono">{selectedIntentoDetail.rut_trabajador}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-450 uppercase">Nota Final</p>
                <p className={`text-sm font-black uppercase ${selectedIntentoDetail.aprobado ? 'text-emerald-700' : 'text-red-700'}`}>
                  {parseFloat(selectedIntentoDetail.nota).toFixed(1)} ({selectedIntentoDetail.aprobado ? 'Aprobado' : 'Reprobado'})
                </p>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-[9px] font-bold text-slate-450 uppercase">Capacitación Realizada</p>
                <p className="text-slate-800 font-bold uppercase">{selectedIntentoDetail.prevencion_capacitaciones?.titulo || 'Desconocida'}</p>
              </div>
            </div>

            {/* Listado de Preguntas Contestadas */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 text-xs font-semibold text-slate-700">
              {Array.isArray(selectedIntentoDetail.curso?.preguntas) ? (
                selectedIntentoDetail.curso.preguntas.map((preg, idx) => {
                  const selectIdx = selectedIntentoDetail.respuestas[idx];
                  const correctIdx = parseInt(preg.correct_idx);
                  const isCorrect = selectIdx === correctIdx;
                  return (
                    <div key={idx} className={`border rounded-2xl p-4 space-y-2 ${isCorrect ? 'bg-emerald-50/30 border-emerald-100' : 'bg-red-50/30 border-red-100'}`}>
                      <div className="flex justify-between items-start gap-4">
                        <p className="font-extrabold text-slate-800">{idx + 1}. {preg.pregunta}</p>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {isCorrect ? `Correcto (+${preg.puntos} pts)` : 'Incorrecto (0 pts)'}
                        </span>
                      </div>
                      <div className="space-y-1 pl-2">
                        <p className="text-[10px]">
                          <span className="text-slate-450">Respuesta elegida:</span>{' '}
                          <span className={`font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                            {preg.opciones[selectIdx] !== undefined ? preg.opciones[selectIdx] : '(No respondida)'}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p className="text-[10px]">
                            <span className="text-slate-450">Respuesta correcta:</span>{' '}
                            <span className="text-emerald-700 font-bold">
                              {preg.opciones[correctIdx]}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-slate-450 italic">No hay preguntas de referencia para mostrar.</p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t shrink-0">
              <button
                onClick={() => setSelectedIntentoDetail(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ================= APARTADO: CUMPLIMIENTO DE SEGURIDAD Y PREVENCIÓN ================= */}
      {activeSection === 'cumplimiento' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-4">
              Cumplimiento de Seguridad y Prevención ({asignacionesCumplimiento.length})
            </h3>

            {cumplimientoSubTab === 'asignar' ? (
              /* PANEL DE ASIGNACIÓN */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Formulario de Asignación */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">Asignar Registro Operacional</span>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-550 block">Seleccionar Trabajador</label>
                    <select
                      value={`${asigTrabajadorRut}|${asigTrabajadorNombre}`}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setAsigTrabajadorRut('');
                          setAsigTrabajadorNombre('');
                        } else {
                          const [rut, nombre] = val.split('|');
                          setAsigTrabajadorRut(rut);
                          setAsigTrabajadorNombre(nombre);
                        }
                      }}
                      className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Seleccione un Trabajador --</option>
                      {personalMaestro.map((p, idx) => (
                        <option key={idx} value={`${p.rut}|${p.nombre}`}>
                          {p.nombre} ({p.rut}) - {p.cargo || 'Sin Cargo'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-550 block">O buscar/ingresar RUT manualmente</label>
                    <input 
                      type="text"
                      placeholder="RUT del trabajador"
                      value={asigTrabajadorRut}
                      onChange={(e) => setAsigTrabajadorRut(e.target.value)}
                      className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-550 block">Nombre del Trabajador (Si se ingresó RUT manual)</label>
                    <input 
                      type="text"
                      placeholder="Nombre completo"
                      value={asigTrabajadorNombre}
                      onChange={(e) => setAsigTrabajadorNombre(e.target.value)}
                      className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-550 block">Registro Operacional / Requisito</label>
                    <select
                      value={asigFormType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAsigFormType(val);
                        if (val !== 'OTRO') {
                          setAsigRegistroNombre(val);
                        } else {
                          setAsigRegistroNombre('');
                        }
                      }}
                      className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Seleccione un Formulario --</option>
                      {formularios.length > 0 && (
                        <optgroup label="Formularios del Sistema">
                          {formularios.map((f) => (
                            <option key={f.id} value={f.titulo}>{f.titulo}</option>
                          ))}
                        </optgroup>
                      )}
                      <option value="OTRO">* Otro (Ingresar Texto Personalizado)</option>
                    </select>
                  </div>

                  {asigFormType === 'OTRO' && (
                    <div className="space-y-1 animate-in fade-in duration-200">
                      <label className="text-[9px] font-bold uppercase text-slate-550 block">Nombre del Registro Personalizado</label>
                      <input 
                        type="text"
                        placeholder="Escriba el nombre del registro"
                        value={asigRegistroNombre}
                        onChange={(e) => setAsigRegistroNombre(e.target.value)}
                        className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-550 block">Frecuencia de Cumplimiento</label>
                    <select
                      value={asigFrecuencia}
                      onChange={(e) => setAsigFrecuencia(e.target.value)}
                      className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                    >
                      <option value="Diario">Diario</option>
                      <option value="Semanal">Semanal</option>
                      <option value="Mensual">Mensual</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSaveAsignacion}
                    disabled={savingForm}
                    className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {savingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Asignar Requisito</span>
                  </button>
                </div>

                {/* Listado de Asignaciones Existentes */}
                <div className="lg:col-span-7 space-y-3">
                  <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">Asignaciones Activas</span>
                  
                  {asignacionesCumplimiento.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 border border-dashed rounded-2xl">
                      No hay asignaciones de registros operacionales cargadas en el sistema.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none sticky top-0 z-10">
                              <th className="p-3">Trabajador</th>
                              <th className="p-3">Registro Operacional</th>
                              <th className="p-3">Frecuencia</th>
                              <th className="p-3 w-16 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                            {asignacionesCumplimiento.map((a) => (
                              <tr key={a.id} className="hover:bg-slate-55">
                                <td className="p-3">
                                  <span className="block font-bold text-slate-800 uppercase">{a.trabajador_nombre}</span>
                                  <span className="block text-[10px] text-slate-450 font-mono">{a.trabajador_rut}</span>
                                </td>
                                <td className="p-3 uppercase text-slate-800">{a.registro_nombre}</td>
                                <td className="p-3">
                                  <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-550 px-2 py-0.5 rounded">
                                    {a.frecuencia}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleDeleteAsignacion(a.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                    title="Eliminar asignación"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* SEGUIMIENTO / MATRIZ DE CONTROL */
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Matriz de Control Operacional</h4>
                    <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">Control visual del estado de cumplimientos de seguridad en faena</p>
                  </div>
                  
                  {/* Leyenda */}
                  <div className="flex items-center gap-3 text-[9px] font-black uppercase text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                      <span>Al Día</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block"></span>
                      <span>Atrasado / Vencido</span>
                    </div>
                  </div>
                </div>

                {asignacionesCumplimiento.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 italic bg-white border border-dashed rounded-3xl">
                    No tienes asignaciones de registros. Ve a la pestaña "Asignar Registro Operacional" para empezar.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none">
                          <th className="p-4">Trabajador</th>
                          <th className="p-4">Registro Requerido</th>
                          <th className="p-4">Frecuencia</th>
                          <th className="p-4 text-center">Última Verificación</th>
                          <th className="p-4 text-center">Estado</th>
                          <th className="p-4 w-44 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                        {asignacionesCumplimiento.map((a) => {
                          const statusInfo = getCumplimientoStatus(a);
                          return (
                            <tr key={a.id} className="hover:bg-slate-50/50">
                              <td className="p-4">
                                <span className="block font-bold text-slate-800 uppercase">{a.trabajador_nombre}</span>
                                <span className="block text-[10px] text-slate-450 font-mono">{a.trabajador_rut}</span>
                              </td>
                              <td className="p-4 uppercase text-slate-850">{a.registro_nombre}</td>
                              <td className="p-4">
                                <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-550 px-2.5 py-0.5 rounded">
                                  {a.frecuencia}
                                </span>
                              </td>
                              <td className="p-4 text-center font-mono text-slate-600">
                                {statusInfo.lastDate ? (
                                  new Date(statusInfo.lastDate + 'T00:00:00').toLocaleDateString()
                                ) : (
                                  <span className="italic text-slate-400">Nunca</span>
                                )}
                              </td>
                              <td className="p-4 text-center">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedAsigForLog(a);
                                      setLogFecha(new Date().toISOString().split('T')[0]);
                                      setLogEstado('Cumple');
                                      setLogObservaciones('');
                                      setShowLogModal(true);
                                    }}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[9px] uppercase px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 border border-emerald-250"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Registrar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedAsigForHistory(a);
                                      setShowHistoryModal(true);
                                    }}
                                    className="bg-primary/5 hover:bg-primary/10 text-primary font-extrabold text-[9px] uppercase px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> Historial
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: REGISTRAR CUMPLIMIENTO LOG ================= */}
      {showLogModal && selectedAsigForLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                <span>Registrar Verificación</span>
              </h3>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-[11px] font-bold text-slate-600 space-y-1">
                <p><span className="text-slate-400 uppercase">Trabajador:</span> {selectedAsigForLog.trabajador_nombre.toUpperCase()} ({selectedAsigForLog.trabajador_rut})</p>
                <p><span className="text-slate-400 uppercase">Registro:</span> {selectedAsigForLog.registro_nombre.toUpperCase()}</p>
                <p><span className="text-slate-400 uppercase">Frecuencia:</span> {selectedAsigForLog.frecuencia.toUpperCase()}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-500 block">Fecha del Registro</label>
                <input 
                  type="date"
                  value={logFecha}
                  onChange={(e) => setLogFecha(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2 bg-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-500 block">Evaluación / Estado</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Cumple', 'No Cumple', 'N/A'].map((est) => (
                    <button
                      key={est}
                      type="button"
                      onClick={() => setLogEstado(est)}
                      className={`py-2 rounded-xl border text-[10px] font-black uppercase transition cursor-pointer ${
                        logEstado === est 
                          ? 'bg-primary text-white border-primary shadow-xs' 
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {est}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase text-slate-500 block">Observaciones / Detalles</label>
                <textarea
                  placeholder="Detalles sobre el cumplimiento, notas adicionales, etc."
                  value={logObservaciones}
                  onChange={(e) => setLogObservaciones(e.target.value)}
                  rows="3"
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-white font-semibold text-slate-700 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  onClick={() => setShowLogModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCumplimientoLog}
                  disabled={savingForm}
                  className="bg-primary hover:bg-primary-hover text-white text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {savingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Guardar Registro</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: VER HISTORIAL DE CUMPLIMIENTOS ================= */}
      {showHistoryModal && selectedAsigForHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 shrink-0">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                <span>Historial de Cumplimiento</span>
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-[11px] font-bold text-slate-600 space-y-1 shrink-0 mb-4">
              <p><span className="text-slate-400 uppercase">Trabajador:</span> {selectedAsigForHistory.trabajador_nombre.toUpperCase()} ({selectedAsigForHistory.trabajador_rut})</p>
              <p><span className="text-slate-400 uppercase">Registro:</span> {selectedAsigForHistory.registro_nombre.toUpperCase()}</p>
              <p><span className="text-slate-400 uppercase">Frecuencia:</span> {selectedAsigForHistory.frecuencia.toUpperCase()}</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {registrosCumplimientoLog.filter(l => l.asignacion_id === selectedAsigForHistory.id).length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-450 italic">
                  No hay registros de cumplimiento cargados para esta asignación aún.
                </div>
              ) : (
                registrosCumplimientoLog
                  .filter(l => l.asignacion_id === selectedAsigForHistory.id)
                  .map((log) => (
                    <div key={log.id} className="border border-slate-150 rounded-2xl p-4 bg-slate-50/20 text-xs font-semibold text-slate-700 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-slate-600 font-bold">{new Date(log.fecha_cumplimiento + 'T00:00:00').toLocaleDateString()}</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          log.estado === 'Cumple' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-250' 
                            : log.estado === 'No Cumple' 
                              ? 'bg-rose-50 text-rose-600 border-rose-250' 
                              : 'bg-slate-50 text-slate-550 border-slate-200'
                        }`}>
                          {log.estado}
                        </span>
                      </div>
                      {log.observaciones && (
                        <p className="text-[11px] text-slate-500 font-normal leading-relaxed bg-white border rounded-xl p-2.5">
                          {log.observaciones}
                        </p>
                      )}
                      <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400 pt-1">
                        <span>Verificado por: {log.verificado_por}</span>
                        <span>Registrado: {new Date(log.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t shrink-0 mt-4">
              <button
                onClick={() => setShowHistoryModal(false)}
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
