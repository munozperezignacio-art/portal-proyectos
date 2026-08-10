import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ModuleHeader from './ModuleHeader';
import { generateFormPdf } from '../utils/pdfGenerator';
import { 
  ArrowLeft, ChevronRight, ClipboardCheck, Plus, FileText, CheckCircle2, AlertCircle, 
  HelpCircle, Trash2, Edit3, Share2, Download, Copy, Eye, BookOpen, 
  GraduationCap, Users, Calendar, Award, CheckSquare, Layers, Building2, Send, Sparkles
} from 'lucide-react';

export default function FormulariosCapacitaciones({ user, onBack, companyBranding }) {
  const [activeTab, setActiveTab] = useState('menu'); // menu, designer, forms_list, capacitaciones, respuestas
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [formSearch, setFormSearch] = useState('');
  const [responseSearch, setResponseSearch] = useState('');
  const [viewingResponse, setViewingResponse] = useState(null);

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
  const [formCodigo, setFormCodigo] = useState('');
  const [formRevision, setFormRevision] = useState('0');
  const [formFechaRevision, setFormFechaRevision] = useState(() => new Date().toISOString().slice(0, 10));
  const [formEmails, setFormEmails] = useState(['']);
  const [formAllowedCargos, setFormAllowedCargos] = useState([]);
  const [availableCargos, setAvailableCargos] = useState([]);
  const [editingForm, setEditingForm] = useState(null);
  const [formFields, setFormFields] = useState([
    { id: Date.now(), type: 'text', label: 'Nombre o Título', required: true, options: [] }
  ]);

  const protectedBaseFields = {
    maquinaria_uso: ['equipo_patente', 'horometro_inicial', 'horometro_final'],
    pare: ['actividad', 'peligro', 'riesgo', 'accion', 'aviso', 'firma'],
    incidente_accidente: ['tipo', 'fecha_evento', 'hora_evento', 'descripcion', 'accion_inmediata', 'firma']
  };
  const formRegistrationType = (form) => {
    const stored = form?.campos;
    return !Array.isArray(stored) ? stored?.control_documental?.tipo_registro : '';
  };
  const isProtectedField = (field) => Boolean(field.systemRequired || (protectedBaseFields[formRegistrationType(editingForm)] || []).includes(field.id));

  // Estados de Capacitaciones
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [capTitle, setCapTitle] = useState('');
  const [capDesc, setCapDesc] = useState('');
  const [capTipo, setCapTipo] = useState('Charla 5 Minutos');
  const [capModulo, setCapModulo] = useState('general');
  const [capQuiz, setCapQuiz] = useState([
    { id: Date.now(), pregunta: '¿Comprendió la charla?', opciones: ['Sí', 'No'], correcta: 0 }
  ]);

  useEffect(() => {
    fetchFormularios();
    fetchRespuestas();
    fetchCapacitaciones();
    fetchAvailableCargos();
  }, [user?.empresa]);

  const fetchAvailableCargos = async () => {
    try {
      const { data, error } = await supabase.from('maestro_personal').select('cargo').eq('empresa', user?.empresa || 'EMIN').order('cargo');
      if (error) throw error;
      setAvailableCargos([...new Set((data || []).map(person => person.cargo?.trim()).filter(Boolean))]);
    } catch (error) {
      console.warn('No se pudieron cargar los cargos:', error.message);
      setAvailableCargos([]);
    }
  };

  const fetchFormularios = async () => {
    try {
      const { data, error } = await supabase
        .from('prevencion_formularios')
        .select('*')
        .eq('empresa', user?.empresa || 'EMIN')
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
        .from('prevencion_respuestas')
        .select('*, prevencion_formularios(titulo, categoria, empresa)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRespuestas(data.filter(response => !response.prevencion_formularios?.empresa || response.prevencion_formularios.empresa === (user?.empresa || 'EMIN')));
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
        .eq('empresa', user?.empresa || 'EMIN')
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
    if (type === 'repeater') {
      setFormFields([...formFields, { id: Date.now(), type: 'repeater', label: 'Grupo repetible', required: false, buttonText: '+ Agregar registro', subFields: [{ id: `${Date.now()}_select`, type: 'select', label: 'Lista desplegable', options: ['Opción 1', 'Opción 2'] }, { id: `${Date.now()}_multiple`, type: 'radio', label: 'Selección múltiple (una respuesta)', options: ['Opción 1', 'Opción 2'] }, { id: `${Date.now()}_signature`, type: 'signature', label: 'Firma' }] }]);
      return;
    }
    setFormFields([
      ...formFields,
      {
        id: Date.now(),
        type,
        label: `Nuevo campo (${type})`,
        required: false,
        maxRating: type === 'rating' ? 5 : undefined,
        options: type === 'select' || type === 'radio' || type === 'checkbox' ? ['Opción 1', 'Opción 2'] : []
      }
    ]);
  };

  const handleUpdateField = (id, key, value) => {
    const field = formFields.find(item => item.id === id);
    if (field && isProtectedField(field) && ['label', 'required', 'type'].includes(key)) return;
    setFormFields(formFields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };
  const handleUpdateOption = (fieldId, optionIndex, value) => {
    setFormFields(formFields.map(field => field.id === fieldId ? { ...field, options: (field.options || []).map((option, index) => index === optionIndex ? value : option) } : field));
  };
  const addOption = (fieldId) => setFormFields(formFields.map(field => field.id === fieldId ? { ...field, options: [...(field.options || []), `Opción ${(field.options || []).length + 1}`] } : field));
  const removeOption = (fieldId, optionIndex) => setFormFields(formFields.map(field => field.id === fieldId ? { ...field, options: (field.options || []).filter((_, index) => index !== optionIndex) } : field));
  const addRepeaterField = (fieldId, type) => setFormFields(formFields.map(field => field.id === fieldId ? { ...field, subFields: [...(field.subFields || []), { id: `${Date.now()}_${type}`, type, label: `Nuevo ${type}`, options: ['Opción 1', 'Opción 2'] }] } : field));
  const removeRepeaterField = (fieldId, subId) => setFormFields(formFields.map(field => field.id === fieldId ? { ...field, subFields: (field.subFields || []).filter(sub => sub.id !== subId) } : field));
  const moveRepeaterField = (fieldId, fromIndex, toIndex) => setFormFields(formFields.map(field => {
    if (field.id !== fieldId || fromIndex === toIndex) return field;
    const subFields = [...(field.subFields || [])];
    const [moved] = subFields.splice(fromIndex, 1);
    subFields.splice(toIndex, 0, moved);
    return { ...field, subFields };
  }));
  const updateRepeaterSubField = (fieldId, subId, key, value) => setFormFields(formFields.map(field => field.id === fieldId ? { ...field, subFields: (field.subFields || []).map(sub => sub.id === subId ? { ...sub, [key]: value } : sub) } : field));
  const addRepeaterOption = (fieldId, subId) => setFormFields(formFields.map(field => field.id === fieldId ? { ...field, subFields: (field.subFields || []).map(sub => sub.id === subId ? { ...sub, options: [...(sub.options || []), `Opción ${(sub.options || []).length + 1}`] } : sub) } : field));
  const updateRepeaterOption = (fieldId, subId, index, value) => setFormFields(formFields.map(field => field.id === fieldId ? { ...field, subFields: (field.subFields || []).map(sub => sub.id === subId ? { ...sub, options: (sub.options || []).map((option, optionIndex) => optionIndex === index ? value : option) } : sub) } : field));

  const handleRemoveField = (id) => {
    const field = formFields.find(item => item.id === id);
    if (field && isProtectedField(field)) {
      setErrorMsg('Este es un campo base requerido para el funcionamiento del formulario y no se puede eliminar.');
      return;
    }
    setFormFields(formFields.filter(f => f.id !== id));
  };

  const openFormEditor = (form) => {
    const stored = form.campos;
    const control = stored && !Array.isArray(stored) ? (stored.control_documental || {}) : {};
    setEditingForm(form);
    setFormTitle(form.titulo || ''); setFormDesc(form.descripcion || ''); setFormModulo(form.categoria || form.modulo_asignado || 'general');
    setFormCodigo(control.codigo || ''); setFormRevision(control.revision || '0'); setFormFechaRevision(control.fecha_revision || new Date().toISOString().slice(0, 10)); setFormEmails((form.correos_notificacion || '').split(',').map(email => email.trim()).filter(Boolean).concat((form.correos_notificacion || '').trim() ? [] : ['']));
    setFormAllowedCargos((form.cargos_obligados || '').split(',').map(cargo => cargo.trim()).filter(Boolean));
    const requiredIds = protectedBaseFields[formRegistrationType(form)] || [];
    setFormFields((Array.isArray(stored) ? stored : (stored?.items || [])).map(field => (field.systemRequired || requiredIds.includes(field.id)) ? { ...field, systemRequired: true, required: true } : field));
    setActiveTab('designer');
  };

  const installOperationalTemplates = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const common = (codigo, modulo, titulo, descripcion, tipo_registro, items) => ({
      titulo, descripcion, categoria: modulo,
      publico_token: `FORM_${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      creado_por: user?.email || 'admin@obraxis.cl', empresa: user?.empresa || 'EMIN', created_at: new Date().toISOString(),
      campos: { items: items.map(field => (protectedBaseFields[tipo_registro] || []).includes(field.id) ? { ...field, required: true, systemRequired: true } : field), control_documental: { codigo, revision: '0', fecha_revision: today, tipo_registro } }
    });
    const templates = [
      common('MAQ-REG-001', 'maquinaria', 'Registro diario de uso y horómetro', 'Registro base para controlar horas, combustible, operador y evidencia de uso.', 'maquinaria_uso', [
        { id: 'equipo_patente', type: 'text', label: 'Equipo / patente', required: true, options: [] }, { id: 'horometro_inicial', type: 'text', label: 'Horómetro inicial', required: true, options: [] }, { id: 'horometro_final', type: 'text', label: 'Horómetro final', required: true, options: [] }, { id: 'combustible', type: 'text', label: 'Combustible cargado (L)', required: false, options: [] }, { id: 'observaciones', type: 'textarea', label: 'Observaciones', required: false, options: [] }, { id: 'evidencia', type: 'photo', label: 'Evidencia fotográfica', required: false, options: [] }
      ]),
      common('PR-PARE-001', 'prevencion', 'Tarjeta PARE — detención preventiva', 'Detén la tarea, identifica el peligro, define controles e informa antes de reiniciar.', 'pare', [
        { id: 'actividad', type: 'text', label: 'Actividad detenida', required: true, options: [] }, { id: 'peligro', type: 'textarea', label: 'Peligro o condición detectada', required: true, options: [] }, { id: 'riesgo', type: 'rating', label: 'Nivel de riesgo antes del control', required: true, maxRating: 5, options: [] }, { id: 'accion', type: 'textarea', label: 'Acción inmediata y control definido', required: true, options: [] }, { id: 'aviso', type: 'radio', label: '¿Se informó a la supervisión?', required: true, options: ['Sí', 'No'] }, { id: 'evidencia', type: 'photo', label: 'Evidencia fotográfica', required: false, options: [] }, { id: 'firma', type: 'signature', label: 'Firma de quien detiene', required: true, options: [] }
      ]),
      common('PR-INC-001', 'prevencion', 'Informe de incidente o accidente', 'Registro inicial del evento. La clasificación y los días perdidos se completan posteriormente en Prevención.', 'incidente_accidente', [
        { id: 'tipo', type: 'radio', label: 'Tipo de evento', required: true, options: ['Incidente', 'Accidente'] }, { id: 'fecha_evento', type: 'date', label: 'Fecha del evento', required: true, options: [] }, { id: 'hora_evento', type: 'time', label: 'Hora del evento', required: true, options: [] }, { id: 'persona', type: 'text', label: 'Persona involucrada', required: false, options: [] }, { id: 'descripcion', type: 'textarea', label: 'Descripción inicial del evento', required: true, options: [] }, { id: 'accion_inmediata', type: 'textarea', label: 'Acciones inmediatas ejecutadas', required: true, options: [] }, { id: 'evidencia', type: 'photo', label: 'Evidencia fotográfica', required: false, options: [] }, { id: 'firma', type: 'signature', label: 'Firma del informante', required: true, options: [] }
      ])
    ];
    const incidentTemplate = templates.find(template => template.titulo === 'Informe de incidente o accidente');
    const existingIncident = formularios.find(form => form.titulo === incidentTemplate.titulo);
    if (existingIncident) {
      const refreshed = { ...existingIncident, descripcion: incidentTemplate.descripcion, campos: incidentTemplate.campos };
      if (existingIncident.id) await supabase.from('prevencion_formularios').update({ descripcion: refreshed.descripcion, campos: refreshed.campos }).eq('id', existingIncident.id);
      else {
        const local = formularios.map(form => form === existingIncident ? refreshed : form);
        setFormularios(local); localStorage.setItem('obraxis_formularios_dinamicos', JSON.stringify(local));
      }
    }
    const existingTitles = new Set(formularios.map(form => form.titulo));
    const pending = templates.filter(template => !existingTitles.has(template.titulo));
    if (!pending.length) { setSuccessMsg('Las plantillas operacionales ya están disponibles.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('prevencion_formularios').insert(pending);
      if (error) throw error;
      await fetchFormularios();
      setSuccessMsg(`${pending.length} plantillas operacionales instaladas.`);
    } catch (error) {
      const updated = [...pending, ...formularios]; setFormularios(updated); localStorage.setItem('obraxis_formularios_dinamicos', JSON.stringify(updated));
      setSuccessMsg('Plantillas instaladas localmente.');
    } finally { setLoading(false); setTimeout(() => setSuccessMsg(''), 4000); }
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
      categoria: formModulo,
      campos: {
        items: formFields,
        control_documental: {
          codigo: formCodigo.trim(),
          revision: formRevision.trim(),
          fecha_revision: formFechaRevision
        }
      },
      publico_token: editingForm?.publico_token || token,
      creado_por: user?.email || 'admin@obraxis.cl',
      correos_notificacion: formEmails.map(email => email.trim()).filter(Boolean).join(','),
      cargos_obligados: formAllowedCargos.join(','),
      empresa: user?.empresa || 'EMIN',
      created_at: new Date().toISOString()
    };

    try {
      const request = editingForm?.id
        ? supabase.from('prevencion_formularios').update(newForm).eq('id', editingForm.id).select()
        : supabase.from('prevencion_formularios').insert([newForm]).select();
      const { data, error } = await request;
      if (error) throw error;
      setSuccessMsg(editingForm ? 'Formulario actualizado con éxito.' : '¡Formulario creado y asignado con éxito!');
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
      setFormCodigo('');
      setFormRevision('0');
      setFormFechaRevision(new Date().toISOString().slice(0, 10));
      setFormEmails(['']);
      setFormAllowedCargos([]);
      setEditingForm(null);
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

  const publishLocalForm = async (form) => {
    setLoading(true);
    try {
      const payload = {
        titulo: form.titulo, descripcion: form.descripcion || '', categoria: form.categoria || form.modulo_asignado || 'general', campos: form.campos,
        publico_token: form.publico_token || form.token_publico || `FORM_${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        creado_por: form.creado_por || form.creador_email || user?.email || 'admin@obraxis.cl', cargos_obligados: form.cargos_obligados || '', empresa: form.empresa || user?.empresa || 'EMIN', created_at: form.created_at || new Date().toISOString()
      };
      const { error } = await supabase.from('prevencion_formularios').insert([payload]);
      if (error) throw error;
      const local = JSON.parse(localStorage.getItem('obraxis_formularios_dinamicos') || '[]').filter(item => item.token_publico !== form.token_publico && item.publico_token !== form.publico_token);
      localStorage.setItem('obraxis_formularios_dinamicos', JSON.stringify(local));
      await fetchFormularios();
      setSuccessMsg('Formulario publicado. Ahora su enlace es público.');
    } catch (error) {
      setErrorMsg(`No se pudo publicar el formulario: ${error.message}`);
    } finally { setLoading(false); }
  };

  const deleteForm = async (form) => {
    if (!window.confirm(`¿Eliminar el formulario "${form.titulo}"? Esta acción no elimina las respuestas ya registradas.`)) return;
    setLoading(true);
    try {
      if (form.id) {
        const { error } = await supabase.from('prevencion_formularios').delete().eq('id', form.id);
        if (error) throw error;
      }
      const updated = formularios.filter(item => item !== form && item.id !== form.id);
      setFormularios(updated);
      localStorage.setItem('obraxis_formularios_dinamicos', JSON.stringify(updated.filter(item => !item.id)));
      setSuccessMsg('Formulario eliminado.');
    } catch (error) {
      setErrorMsg(`No se pudo eliminar el formulario: ${error.message}`);
    } finally { setLoading(false); }
  };

  const responseForm = (response) => {
    const form = response.prevencion_formularios || {};
    const storedFields = form.campos;
    const control = storedFields && !Array.isArray(storedFields) ? (storedFields.control_documental || {}) : {};
    const configuredFields = Array.isArray(storedFields) ? storedFields : (storedFields?.items || []);
    // Una respuesta nunca queda "vacía": este respaldo permite leer registros
    // históricos incluso si la relación de Supabase no trae el formulario.
    const fallbackFields = Object.entries(response.respuestas || {}).map(([id, value]) => ({
      id,
      label: id.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
      type: typeof value === 'string' && value.startsWith('data:image') ? 'photo' : 'text'
    }));
    return { ...form, campos: configuredFields.length ? configuredFields : fallbackFields, codigo: control.codigo || form.codigo, revision: control.revision || form.revision, fecha_revision: control.fecha_revision || form.fecha_revision };
  };

  const resolveResponseForm = async (response) => {
    if (response.prevencion_formularios?.campos) return response;
    if (!response.formulario_id) return response;
    const { data, error } = await supabase.from('prevencion_formularios').select('*').eq('id', response.formulario_id).maybeSingle();
    if (error || !data) return response;
    return { ...response, prevencion_formularios: data };
  };

  const reviewResponse = async (response) => {
    setLoading(true);
    try {
      const resolved = await resolveResponseForm(response);
      const form = responseForm(resolved);
      const flattenedAnswers = { ...(resolved.respuestas || {}) };
      const flattenedFields = (form.campos || []).flatMap(field => {
        const groupAnswers = flattenedAnswers[field.id];
        if (field.type !== 'repeater' || !Array.isArray(groupAnswers)) return [field];
        delete flattenedAnswers[field.id];
        return groupAnswers.flatMap((instance, instanceIndex) => Object.entries(instance || {}).map(([subId, value]) => {
          const subField = field.subFields?.find(sub => sub.id === subId) || { label: subId, type: 'text' };
          const displayId = `${field.id}__${instanceIndex}__${subId}`;
          flattenedAnswers[displayId] = value;
          return { ...subField, id: displayId, label: `${field.label} · ${subField.label}` };
        }));
      });
      (flattenedFields || []).filter(field => field.type === 'signature' && !flattenedAnswers[field.id]).forEach(field => { if (resolved.firma_url) flattenedAnswers[field.id] = resolved.firma_url; });
      setViewingResponse({ ...resolved, respuestas: flattenedAnswers, prevencion_formularios: { ...form, campos: flattenedFields } });
    } finally {
      setLoading(false);
    }
  };

  const downloadResponsePdf = async (response) => {
    const resolved = await resolveResponseForm(response);
    const form = responseForm(resolved);
    const base64 = generateFormPdf({ form, metadata: { proyecto_nombre: response.proyecto_nombre || '', inspector: response.inspector || '' }, answers: response.respuestas || {}, mainSignature: response.firma_url, companyLogo: companyBranding?.logo_base64 });
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a'); link.href = url; link.download = `${(form.titulo || 'Formulario').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(response.created_at || Date.now()).toISOString().slice(0, 10)}.pdf`; link.click(); URL.revokeObjectURL(url);
  };

  const renderResponseAnswer = (field, response) => {
    const value = response.respuestas?.[field.id] || (field.type === 'signature' ? response.firma_url : null);
    if (field.type === 'repeater') {
      if (!Array.isArray(value) || !value.length) return <p className="mt-1 text-sm text-slate-500">Sin registros</p>;
      return <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200">{value.map((instance, index) => <div key={index} className="space-y-3 p-3">{Object.entries(instance || {}).map(([subId, subValue]) => { const subField = field.subFields?.find(sub => sub.id === subId) || { label: subId, type: 'text' }; return <div key={subId}><p className="text-[10px] font-black uppercase text-slate-500">{subField.label}</p>{(subField.type === 'signature' || subField.type === 'photo') && subValue ? <img src={subValue} alt={subField.label} className={subField.type === 'photo' ? 'mt-1 max-h-64 rounded-lg border border-slate-200' : 'mt-1 max-h-24'} /> : <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{Array.isArray(subValue) ? subValue.join(', ') : (subValue || 'Sin respuesta')}</p>}</div>; })}</div>)}</div>;
    }
    if ((field.type === 'photo' || field.type === 'signature') && value) return <img src={value} alt={field.label} className={field.type === 'photo' ? 'mt-2 max-h-64 rounded-lg border border-slate-200' : 'mt-2 max-h-24'} />;
    return <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{Array.isArray(value) ? value.join(', ') : (typeof value === 'object' && value ? JSON.stringify(value) : (value || 'Sin respuesta'))}</p>;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 font-sans">
      {/* Header Estándar de Obraxis */}
      <ModuleHeader className="mb-6" title="Formularios y Capacitaciones" subtitle="Crea formularios, listas de chequeo y capacitaciones asignables a los módulos de la empresa." Icon={ClipboardCheck} onBack={() => { if (activeTab !== 'menu') { setActiveTab('menu'); setSuccessMsg(''); setErrorMsg(''); } else { onBack(); } }} />

      {/* Alertas Estándar */}
      {successMsg && <div className="mb-6 bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold border border-emerald-250 animate-in fade-in duration-150">{successMsg}</div>}
      {errorMsg && <div className="mb-6 bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-semibold border border-red-250 animate-in fade-in duration-150">{errorMsg}</div>}

      {/* TAB 1: MENU PRINCIPAL DE TARJETAS (ESTILO ESTÁNDAR OBRAXIS) */}
      {activeTab === 'menu' && (
        <>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-6 mb-4">
            SUBMÓDULOS DE FORMULARIOS Y CAPACITACIONES
          </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
          
          {/* Card 1: Diseñador */}
          <div 
            onClick={() => setActiveTab('designer')}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">Crear</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Diseñador de Formularios
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Crea encuestas, inspecciones y check-lists personalizados y asígnalos a cualquier módulo.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-extrabold text-primary group-hover:text-primary-hover">
              <span>Crear Nuevo</span>
              <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>

          {/* Card 2: Mis Formularios */}
          <div 
            onClick={() => setActiveTab('forms_list')}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">{formularios.length} Activos</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Biblioteca de Formularios
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Administra plantillas activas, genera enlaces públicos de llenado y edita sus asignaciones.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-extrabold text-primary group-hover:text-primary-hover">
              <span>Ver Listado</span>
              <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>

          {/* Card 3: Charlas y Capacitaciones */}
          <div 
            onClick={() => setActiveTab('capacitaciones')}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">{capacitaciones.length} Charlas</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Charlas y Capacitaciones
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Registra capacitaciones, charlas de 5 minutos, evaluación de conocimientos y control de asistencia.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-extrabold text-primary group-hover:text-primary-hover">
              <span>Gestionar Charlas</span>
              <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>

          {/* Card 4: Respuestas */}
          <div 
            onClick={() => setActiveTab('respuestas')}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <CheckSquare className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">{respuestas.length} Envíos</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Registros y Respuestas
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Inspecciona y exporta los registros de respuestas completadas por trabajadores y contratistas.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-extrabold text-primary group-hover:text-primary-hover">
              <span>Revisar Respuestas</span>
              <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        </div>
        </>
      )}

      {/* TAB 2: DISEÑADOR DE FORMULARIOS */}
      {activeTab === 'designer' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">{editingForm ? 'Editar Formulario' : 'Crear Formulario Dinámico'}</h2>
              <p className="text-xs text-slate-500">Configura preguntas y define en qué módulo estará disponible.</p>
            </div>
          </div>

          <form onSubmit={handleSaveForm} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="md:col-span-2 space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Título del Formulario *</label>
                <input
                  type="text"
                  placeholder="Ej: Check-list de Entrega de EPP o Inspección de Herramientas"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Asignar a Módulo *</label>
                <select
                  value={formModulo}
                  onChange={(e) => setFormModulo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-primary"
                >
                  {modulosAsignables.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Código documental</label>
                <input type="text" placeholder="Ej: PR-INS-001" value={formCodigo} onChange={(e) => setFormCodigo(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-primary" />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Versión</label>
                <input type="text" inputMode="numeric" placeholder="Ej: 1" value={formRevision} onChange={(e) => setFormRevision(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-primary" />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Fecha de versión</label>
                <input type="date" value={formFechaRevision} onChange={(e) => setFormFechaRevision(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-primary" />
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Correos de difusión del formulario</label>
                <div className="space-y-2">{formEmails.map((email, index) => <div key={index} className="flex gap-2"><input type="email" placeholder="Ej: prevencion@empresa.cl" value={email} onChange={(e) => setFormEmails(values => values.map((value, position) => position === index ? e.target.value : value))} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-primary" />{formEmails.length > 1 && <button type="button" onClick={() => setFormEmails(values => values.filter((_, position) => position !== index))} className="rounded-xl px-3 text-[10px] font-black text-rose-700 hover:bg-rose-50">Quitar</button>}</div>)}</div>
                <button type="button" onClick={() => setFormEmails(values => [...values, ''])} className="mt-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-[11px] font-black text-primary">+ Agregar correo</button>
                <p className="text-[10px] text-slate-400">Al recibir una respuesta, se enviará el registro y PDF a estos destinatarios.</p>
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Descripción u Objetivo</label>
                <textarea
                  rows="2"
                  placeholder="Instrucciones para la persona que responderá este formulario..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:border-primary"
                ></textarea>
              </div>
              <div className="md:col-span-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <label className="block text-[10.5px] font-extrabold uppercase text-slate-600">Cargos autorizados para responder</label>
                  <p className="mt-1 text-[10px] text-slate-400">Selecciona uno o más cargos. Sin selección, el formulario estará disponible para todo el personal.</p>
                </div>
                {availableCargos.length ? <div className="flex flex-wrap gap-2">{availableCargos.map(cargo => <label key={cargo} className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${formAllowedCargos.includes(cargo) ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-primary/50'}`}><input type="checkbox" className="sr-only" checked={formAllowedCargos.includes(cargo)} onChange={() => setFormAllowedCargos(current => current.includes(cargo) ? current.filter(item => item !== cargo) : [...current, cargo])} />{cargo}</label>)}</div> : <p className="text-[10px] text-amber-700">Aún no hay cargos creados en el maestro de personal.</p>}
              </div>
            </div>

            {/* Barra de herramientas para agregar campos */}
            <div className="space-y-3">
              <label className="block text-xs font-extrabold uppercase text-slate-700">Diseño de Campos y Preguntas</label>
              <p className="text-[11px] text-slate-500">Cada respuesta registra obra y usuario responsable desde el encabezado del formulario.</p>
              <div className="flex flex-wrap gap-2">
                {[['text','Texto corto'],['textarea','Texto largo'],['date','Fecha'],['time','Hora'],['select','Lista desplegable'],['radio','Selección múltiple · una respuesta'],['checkbox','Checkbox · varias respuestas'],['rating','Nivel de valoración'],['photo','Subir imágenes'],['signature','Dibujar firma'],['repeater','Grupo repetible']].map(([type,label]) => <button key={type} type="button" onClick={() => handleAddField(type)} className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">+ {label}</button>)}
              </div>
            </div>

            {/* Lista de Campos */}
            <div className="space-y-3">
              {formFields.map((field, index) => (
                <div key={field.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3 relative">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-wider">Campo #{index + 1} ({field.type})</span>
                    {isProtectedField(field) ? <span className="rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-800">Campo base bloqueado</span> : <button type="button" onClick={() => handleRemoveField(field.id)} className="text-slate-400 hover:text-rose-600 transition cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-[9.5px] font-bold text-slate-500 uppercase">Etiqueta de la Pregunta</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleUpdateField(field.id, 'label', e.target.value)}
                        readOnly={isProtectedField(field)}
                        className={`w-full border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 ${isProtectedField(field) ? 'bg-slate-50 text-slate-500' : ''}`}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => handleUpdateField(field.id, 'required', e.target.checked)}
                          disabled={isProtectedField(field)}
                          className="w-4 h-4 text-primary rounded"
                        />
                        <span>Obligatorio</span>
                      </label>
                    </div>
                  </div>
                  {['select', 'radio', 'checkbox'].includes(field.type) && <div className="space-y-2"><label className="block text-[9.5px] font-bold text-slate-500 uppercase">Alternativas</label>{(field.options || []).map((option, optionIndex) => <div key={optionIndex} className="flex gap-2"><input value={option} onChange={e => handleUpdateOption(field.id, optionIndex, e.target.value)} className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-medium"/><button type="button" onClick={() => removeOption(field.id, optionIndex)} className="rounded-lg px-2 text-[10px] font-black text-rose-700 hover:bg-rose-50">Quitar</button></div>)}<button type="button" onClick={() => addOption(field.id)} className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-[11px] font-black text-primary">+ Agregar opción</button></div>}
                  {field.type === 'rating' && <div className="space-y-1"><label className="block text-[9.5px] font-bold text-slate-500 uppercase">Máximo de la escala</label><select value={field.maxRating || 5} onChange={e => handleUpdateField(field.id, 'maxRating', Number(e.target.value))} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold"><option value="3">1 a 3</option><option value="5">1 a 5</option><option value="10">1 a 10</option></select></div>}
                  {field.type === 'repeater' && <div className="space-y-2 rounded-xl bg-amber-50 p-3"><p className="text-[11px] font-semibold text-amber-900">Campos dentro del grupo. Arrastra ⠿ para ordenar:</p><div className="flex flex-wrap gap-2">{[['text','Texto corto'],['select','Lista'],['radio','Selección múltiple · una respuesta'],['checkbox','Checkbox · varias respuestas'],['photo','Imagen'],['signature','Firma']].map(([type,label])=><button key={type} type="button" onClick={()=>addRepeaterField(field.id,type)} className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-[10px] font-black text-amber-900">+ {label}</button>)}</div>{(field.subFields || []).map((sub, subIndex)=><div key={sub.id} draggable onDragStart={event=>event.dataTransfer.setData('text/plain', String(subIndex))} onDragOver={event=>event.preventDefault()} onDrop={event=>{ event.preventDefault(); moveRepeaterField(field.id, Number(event.dataTransfer.getData('text/plain')), subIndex); }} className="cursor-grab rounded-lg bg-white p-3 text-xs active:cursor-grabbing"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><b className="text-slate-400">⠿</b><b className="text-slate-400">({sub.type})</b></span><button type="button" onClick={()=>removeRepeaterField(field.id,sub.id)} className="text-[10px] font-black text-rose-700">Quitar</button></div><input value={sub.label} onChange={e=>updateRepeaterSubField(field.id,sub.id,'label',e.target.value)} className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold"/>{['select','radio','checkbox'].includes(sub.type) && <div className="mt-2 space-y-1">{(sub.options || []).map((option, index)=><input key={index} value={option} onChange={e=>updateRepeaterOption(field.id,sub.id,index,e.target.value)} className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[11px]"/>)}<button type="button" onClick={()=>addRepeaterOption(field.id,sub.id)} className="text-[10px] font-black text-primary">+ Agregar opción</button></div>}</div>)}</div>}
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
                className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-primary hover:bg-primary-hover transition cursor-pointer shadow-sm flex items-center gap-2"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>{loading ? 'Guardando...' : editingForm ? 'Guardar cambios' : 'Guardar y Publicar Formulario'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: LISTADO DE FORMULARIOS CREADOS */}
      {activeTab === 'forms_list' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div><h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Biblioteca de Formularios</h2><p className="mt-1 text-[11px] text-slate-500">{formularios.length} formularios disponibles para publicar y responder.</p></div>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={installOperationalTemplates} disabled={loading} className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-bold cursor-pointer hover:bg-emerald-100 transition">Instalar formularios base</button>
              <button
                onClick={() => setActiveTab('designer')}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm hover:bg-primary-hover transition"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Formulario</span>
              </button>
            </div>
          </div>

          {formularios.length > 0 && <input value={formSearch} onChange={e => setFormSearch(e.target.value)} placeholder="Buscar por título, módulo o descripción…" className="h-10 w-full max-w-md rounded-xl border border-slate-200 px-3 text-xs font-medium outline-none focus:border-primary" />}

          {formularios.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">No hay formularios registrados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {formularios.filter(form => `${form.titulo} ${form.descripcion || ''} ${form.categoria || form.modulo_asignado || ''}`.toLowerCase().includes(formSearch.toLowerCase())).map(form => {
                const publicUrl = `${window.location.origin}/?prevencion_form=${form.publico_token || form.token_publico || form.id}`;
                const modObj = modulosAsignables.find(m => m.id === (form.categoria || form.modulo_asignado)) || { name: 'General' };

                return (
                  <div key={form.id} className="p-5 rounded-3xl border border-slate-200 bg-white hover:border-primary shadow-xs transition flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[9.5px] font-black uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          Módulo: {modObj.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(form.created_at || Date.now()).toLocaleDateString('es-CL')}
                        </span>
                      </div>

                      <h4 className="text-xs font-extrabold text-slate-850 uppercase leading-snug">{form.titulo}</h4>
                      {(form.campos?.control_documental?.codigo || form.campos?.control_documental?.revision) && <p className="mt-1 text-[10px] font-bold text-slate-400">{form.campos.control_documental.codigo || 'Sin código'} · Versión {form.campos.control_documental.revision || '0'}</p>}
                      {form.descripcion && <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{form.descripcion}</p>}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {!form.id && <button onClick={() => publishLocalForm(form)} disabled={loading} className="py-2 px-3 rounded-xl bg-emerald-600 text-white text-[10.5px] font-bold hover:bg-emerald-700">Publicar</button>}
                      <button
                        onClick={() => form.id ? copyToClipboard(publicUrl) : setErrorMsg('Primero publica este formulario para generar un enlace público.')}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                      >
                        <Share2 className="w-3.5 h-3.5 text-primary" />
                        <span>Copiar Enlace</span>
                      </button>
                      <button onClick={() => openFormEditor(form)} className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-[10.5px] font-bold hover:bg-slate-50">Editar</button>
                      <button onClick={() => deleteForm(form)} disabled={loading} className="py-2 px-3 rounded-xl border border-rose-200 text-rose-700 text-[10.5px] font-bold hover:bg-rose-50">Eliminar</button>
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
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Gestor de Charlas y Capacitaciones</h2>
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
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9.5px] font-bold uppercase text-slate-600">Tipo de Contenido</label>
                <select
                  value={capTipo}
                  onChange={(e) => setCapTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:border-primary"
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
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:border-primary"
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <GraduationCap className="w-4 h-4" />
                <span>{loading ? 'Guardando...' : 'Publicar Capacitación'}</span>
              </button>
            </div>
          </form>

          {/* Listado de Capacitaciones */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-850 uppercase">Capacitaciones Publicadas ({capacitaciones.length})</h3>
            
            {capacitaciones.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay capacitaciones registradas.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {capacitaciones.map(cap => (
                  <div key={cap.id} className="p-5 rounded-3xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase">
                        {cap.tipo || 'Charla'}
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(cap.created_at || Date.now()).toLocaleDateString('es-CL')}</span>
                    </div>
                    <h4 className="text-xs font-black text-slate-850 uppercase">{cap.titulo}</h4>
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
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Registros de Respuestas Recibidas</h2>
            <p className="text-xs text-slate-500">Historial completo de formularios completados por personal o subcontratistas.</p>
          </div>

          {respuestas.length > 0 && <input value={responseSearch} onChange={e => setResponseSearch(e.target.value)} placeholder="Buscar formulario, persona o RUT…" className="h-10 w-full max-w-md rounded-xl border border-slate-200 px-3 text-xs font-medium outline-none focus:border-primary" />}

          {respuestas.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">Aún no se registran respuestas en los formularios.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {respuestas.filter(resp => `${resp.prevencion_formularios?.titulo || resp.formulario_titulo || ''} ${resp.inspector || resp.usuario_nombre || ''} ${resp.proyecto_nombre || resp.usuario_rut || ''}`.toLowerCase().includes(responseSearch.toLowerCase())).map(resp => (
                <div key={resp.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-850 uppercase">{resp.prevencion_formularios?.titulo || resp.formulario_titulo || 'Formulario'}</h4>
                    <p className="text-[10.5px] text-slate-500">Respondido por: {resp.inspector || resp.usuario_nombre || 'Anónimo'} · Obra: {resp.proyecto_nombre || 'Sin obra informada'}</p>
                  </div>
                  <div className="flex items-center gap-2"><span className="text-[10px] text-slate-400">{new Date(resp.created_at || Date.now()).toLocaleDateString('es-CL')}</span><button onClick={() => reviewResponse(resp)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-black text-slate-700 hover:bg-slate-50"><Eye className="mr-1 inline h-3.5 w-3.5" />Revisar</button><button onClick={() => downloadResponsePdf(resp)} className="rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-primary-hover"><Download className="mr-1 inline h-3.5 w-3.5" />PDF</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {viewingResponse && (() => { const form = responseForm(viewingResponse); return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4"><div><h3 className="text-sm font-black uppercase text-slate-850">{form.titulo || 'Formulario'}</h3><p className="mt-1 text-xs text-slate-500">{viewingResponse.inspector || 'Anónimo'} · {viewingResponse.proyecto_nombre || 'Sin obra'} · {new Date(viewingResponse.created_at || Date.now()).toLocaleString('es-CL')}</p></div><button onClick={() => setViewingResponse(null)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">Cerrar</button></div><div className="space-y-4">{(form.campos || []).map(field => <div key={field.id} className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-black uppercase text-slate-500">{field.label}</p>{field.type === 'photo' && viewingResponse.respuestas?.[field.id] ? <img src={viewingResponse.respuestas[field.id]} alt="Evidencia" className="mt-2 max-h-64 rounded-lg border border-slate-200" /> : field.type === 'signature' && viewingResponse.respuestas?.[field.id] ? <img src={viewingResponse.respuestas[field.id]} alt="Firma" className="mt-2 max-h-24" /> : <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{Array.isArray(viewingResponse.respuestas?.[field.id]) ? viewingResponse.respuestas[field.id].join(', ') : (typeof viewingResponse.respuestas?.[field.id] === 'object' ? JSON.stringify(viewingResponse.respuestas?.[field.id]) : (viewingResponse.respuestas?.[field.id] || 'Sin respuesta'))}</p>}</div>)}</div></div></div>; })()}
    </div>
  );
}
