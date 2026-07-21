import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, FileSpreadsheet, Calendar, Plus, Save, Trash2, 
  Upload, Check, AlertCircle, RefreshCw, ChevronRight, CalendarDays,
  FolderPlus, DollarSign, Hammer, Briefcase, FileText, MapPin, Clock, ChevronLeft,
  Settings, Percent, Coins, Sliders, Info, Store, Building2
} from 'lucide-react';
import { comunasChile } from '../utils/comunas';

export default function PresupuestosPlanif({ user, onBack }) {
  // Lista de proyectos/presupuestos independientes
  const [proyectos, setProyectos] = useState([]);
  const [selectedProyectoId, setSelectedProyectoId] = useState('');
  const [loadingProyectos, setLoadingProyectos] = useState(true);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  
  // Datos del nuevo proyecto
  const [newProjectData, setNewProjectData] = useState({ 
    nombre: '', 
    descripcion: '',
    cliente: '',
    ubicacion: '',
    plazo_estimado: '',
    presupuesto_estimado: '',
    tipo_proyecto: 'Privado',
    comuna: ''
  });

  // Apartado activo: '' (Menú principal de apartados), 'crear', 'ingresar', 'gantt', 'recursos', 'mis_presupuestos'
  const [activeSection, setActiveSection] = useState('');

  // Estados del Presupuesto (Crear/Detalle)
  const [itemsPresupuesto, setItemsPresupuesto] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Estados de Planificación
  const [cronograma, setCronograma] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [ganttStartDate, setGanttStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [ganttScale, setGanttScale] = useState(30);

  // Estados de Recursos
  const [recursos, setRecursos] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // Importador Masivo (Ingresar Presupuesto)
  const [importText, setImportText] = useState('');

  // Estados de Costos Indirectos / Generales
  const [indirectCosts, setIndirectCosts] = useState([]);
  const [indirectLoading, setIndirectLoading] = useState(false);
  const [showIndirectModal, setShowIndirectModal] = useState(false);

  // Estados de APU / Análisis de Partida
  const [showApuModal, setShowApuModal] = useState(false);
  const [apuItem, setApuItem] = useState(null);
  const [apuResources, setApuResources] = useState([]);
  const [apuLoading, setApuLoading] = useState(false);
  const [selectedAddResourceId, setSelectedAddResourceId] = useState('');
  
  // Tab interna para añadir recursos en APU: 'existente' o 'nuevo'
  const [addResourceMode, setAddResourceMode] = useState('existente');
  const [newResourceForm, setNewResourceForm] = useState({
    recurso: '',
    tipo: 'Material',
    unidad: 'un',
    costo_unitario: '',
    ciudad: '',
    proveedor: ''
  });

  const [apuForm, setApuForm] = useState({
    tipo_metodologia: 'Precio Unitario',
    leyes_sociales_pct: 0,
    imponderables_pct: 0,
    rendimiento_meta: 0,
    tiempo_estimado: 0,
    costo_materiales: 0,
    costo_mano_obra: 0,
    costo_maquinaria: 0
  });

  // Mensajes generales
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cargar proyectos al iniciar
  useEffect(() => {
    fetchProyectos();
  }, []);

  // Cargar datos cuando cambia el proyecto activo
  useEffect(() => {
    if (selectedProyectoId) {
      fetchBudgetItems(selectedProyectoId);
      fetchCronograma(selectedProyectoId);
      fetchRecursos(selectedProyectoId);
      fetchIndirectCosts(selectedProyectoId);
    } else {
      setItemsPresupuesto([]);
      setCronograma([]);
      setRecursos([]);
      setIndirectCosts([]);
    }
  }, [selectedProyectoId]);

  const fetchProyectos = async () => {
    setLoadingProyectos(true);
    try {
      const { data, error } = await supabase
        .from('presupuestos_proyectos')
        .select('*')
        .order('nombre', { ascending: true });
      if (error) throw error;
      setProyectos(data || []);
      if (data && data.length > 0) {
        setSelectedProyectoId(data[0].id);
      }
    } catch (err) {
      console.error('Error al cargar proyectos:', err.message);
    } finally {
      setLoadingProyectos(false);
    }
  };

  const fetchBudgetItems = async (projId) => {
    setBudgetLoading(true);
    try {
      const { data, error } = await supabase
        .from('presupuestos_items')
        .select('*')
        .eq('presupuesto_id', projId);
      if (error) throw error;

      const sorted = (data || []).sort((a, b) => {
        const codA = a.codigo || '';
        const codB = b.codigo || '';
        return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
      });
      setItemsPresupuesto(sorted);
    } catch (err) {
      console.error('Error cargando ítems de presupuesto:', err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  const fetchCronograma = async (projId) => {
    setTasksLoading(true);
    try {
      const { data, error } = await supabase
        .from('planificacion_cronogramas')
        .select('*')
        .eq('presupuesto_id', projId);
      if (error) throw error;

      const sorted = (data || []).sort((a, b) => {
        const codA = a.codigo || '';
        const codB = b.codigo || '';
        return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
      });
      setCronograma(sorted);

      if (sorted.length > 0) {
        const startDates = sorted.map(t => t.fecha_inicio).filter(Boolean);
        if (startDates.length > 0) {
          const minDate = startDates.reduce((min, d) => d < min ? d : min, startDates[0]);
          setGanttStartDate(minDate);
        }
      }
    } catch (err) {
      console.error('Error cargando cronograma:', err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchRecursos = async (projId) => {
    setResourcesLoading(true);
    try {
      const { data, error } = await supabase
        .from('recursos_presupuesto')
        .select('*')
        .eq('presupuesto_id', projId)
        .order('recurso', { ascending: true });
      if (error) throw error;
      setRecursos(data || []);
    } catch (err) {
      console.error('Error cargando recursos:', err.message);
    } finally {
      setResourcesLoading(false);
    }
  };

  const fetchIndirectCosts = async (projId) => {
    setIndirectLoading(true);
    try {
      const { data, error } = await supabase
        .from('presupuestos_costos_indirectos')
        .select('*')
        .eq('presupuesto_id', projId)
        .order('id', { ascending: true });
      if (error) throw error;
      setIndirectCosts(data || []);
    } catch (err) {
      console.error('Error cargando costos indirectos:', err.message);
    } finally {
      setIndirectLoading(false);
    }
  };

  // --- CREAR NUEVO PROYECTO ---
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectData.nombre.trim()) return;
    setLoadingProyectos(true);
    try {
      const { data, error } = await supabase
        .from('presupuestos_proyectos')
        .insert([
          {
            nombre: newProjectData.nombre.trim(),
            descripcion: newProjectData.descripcion.trim(),
            cliente: newProjectData.cliente.trim(),
            ubicacion: newProjectData.ubicacion.trim(),
            plazo_estimado: parseInt(newProjectData.plazo_estimado, 10) || 0,
            presupuesto_estimado: parseFloat(newProjectData.presupuesto_estimado) || 0,
            tipo_proyecto: newProjectData.tipo_proyecto,
            comuna: newProjectData.comuna
          }
        ])
        .select();

      if (error) throw error;

      setSuccessMsg('Proyecto creado con éxito.');
      setNewProjectData({ 
        nombre: '', 
        descripcion: '',
        cliente: '',
        ubicacion: '',
        plazo_estimado: '',
        presupuesto_estimado: '',
        tipo_proyecto: 'Privado',
        comuna: ''
      });
      setShowCreateProjectModal(false);
      
      // Recargar y seleccionar
      const { data: list } = await supabase
        .from('presupuestos_proyectos')
        .select('*')
        .order('nombre', { ascending: true });
      setProyectos(list || []);
      if (data && data.length > 0) {
        setSelectedProyectoId(data[0].id);
      }
    } catch (err) {
      setErrorMsg('Error al crear proyecto: ' + err.message);
    } finally {
      setLoadingProyectos(false);
    }
  };

  // --- LÓGICA DE JERARQUÍAS ---
  const isChapterRow = (item, list) => {
    if (!item.codigo) return false;
    return list.some(other => other.codigo && other.codigo !== item.codigo && other.codigo.startsWith(item.codigo + '.'));
  };

  const getChapterSum = (chapterCode, list) => {
    return list
      .filter(item => {
        if (!item.codigo || item.codigo === chapterCode) return false;
        const starts = item.codigo.startsWith(chapterCode + '.');
        return starts && !isChapterRow(item, list);
      })
      .reduce((sum, item) => {
        const qty = parseFloat(item.cantidad) || 0;
        const price = parseFloat(item.costo_unitario) || 0;
        return sum + (qty * price);
      }, 0);
  };

  // --- ACCIONES PRESUPUESTO (CREAR) ---
  const handleAddBudgetRow = () => {
    let nextCode = '01';
    if (itemsPresupuesto.length > 0) {
      const last = itemsPresupuesto[itemsPresupuesto.length - 1];
      if (last.codigo) {
        const parts = last.codigo.split('.');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          parts[parts.length - 1] = String(lastNum + 1).padStart(2, '0');
          nextCode = parts.join('.');
        }
      }
    }

    const newRow = {
      id: 'temp-' + Date.now() + Math.random(),
      presupuesto_id: selectedProyectoId,
      codigo: nextCode,
      partida: 'NUEVA PARTIDA',
      unidad: 'un',
      cantidad: 0,
      costo_unitario: 0,
      rendimiento_meta: 0,
      tipo_metodologia: 'Precio Unitario',
      leyes_sociales_pct: 0,
      imponderables_pct: 0,
      tiempo_estimado: 0,
      costo_materiales: 0,
      costo_mano_obra: 0,
      costo_maquinaria: 0
    };
    setItemsPresupuesto([...itemsPresupuesto, newRow]);
  };

  const handleUpdateBudgetField = (id, field, value) => {
    setItemsPresupuesto(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteBudgetRow = (id) => {
    setItemsPresupuesto(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveBudget = async () => {
    if (!selectedProyectoId) return;
    setBudgetLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const toUpdate = itemsPresupuesto.filter(p => typeof p.id === 'number');
      const toInsert = itemsPresupuesto
        .filter(p => typeof p.id === 'string' && p.id.startsWith('temp-'))
        .map(p => {
          const { id, ...rest } = p;
          return { ...rest, presupuesto_id: selectedProyectoId };
        });

      const { data: dbCurrent, error: dbErr } = await supabase
        .from('presupuestos_items')
        .select('id')
        .eq('presupuesto_id', selectedProyectoId);

      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('presupuestos_items')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from('presupuestos_items')
          .update({
            codigo: item.codigo,
            partida: item.partida,
            unidad: item.unidad,
            cantidad: parseFloat(item.cantidad) || 0,
            costo_unitario: parseFloat(item.costo_unitario) || 0,
            rendimiento_meta: parseFloat(item.rendimiento_meta) || 0
          })
          .eq('id', item.id);
        if (updErr) throw updErr;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('presupuestos_items')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Presupuesto guardado exitosamente.');
      fetchBudgetItems(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar presupuesto: ' + err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  // --- TAB: INGRESAR PRESUPUESTO ---
  const handleImportCSV = async () => {
    if (!selectedProyectoId || !importText.trim()) return;
    setBudgetLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const lines = importText.split('\n');
    const records = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 2) continue;

      records.push({
        presupuesto_id: selectedProyectoId,
        codigo: parts[0].trim(),
        partida: parts[1].trim(),
        unidad: parts[2] ? parts[2].trim() : 'un',
        cantidad: parts[3] ? parseFloat(parts[3].trim()) || 0 : 0,
        costo_unitario: parts[4] ? parseFloat(parts[4].trim()) || 0 : 0,
        rendimiento_meta: parts[5] ? parseFloat(parts[5].trim()) || 0 : 0
      });
    }

    if (records.length === 0) {
      setErrorMsg('No se encontraron registros válidos para importar.');
      setBudgetLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('presupuestos_items')
        .insert(records);

      if (error) throw error;

      setSuccessMsg(`Se ingresaron e importaron ${records.length} partidas al presupuesto.`);
      setImportText('');
      setActiveSection('crear');
      fetchBudgetItems(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al importar: ' + err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  // --- TAB: DIAGRAMA GANTT ---
  const handleAddCronogramaRow = () => {
    let nextCode = '1';
    if (cronograma.length > 0) {
      const last = cronograma[cronograma.length - 1];
      if (last.codigo) {
        const num = parseInt(last.codigo, 10);
        if (!isNaN(num)) nextCode = String(num + 1);
      }
    }

    const newRow = {
      id: 'temp-' + Date.now() + Math.random(),
      presupuesto_id: selectedProyectoId,
      codigo: nextCode,
      tarea: 'Nueva Tarea',
      fecha_inicio: new Date().toISOString().split('T')[0],
      duracion: 5,
      fecha_fin: calculateEndDate(new Date().toISOString().split('T')[0], 5),
      predecesora: '',
      porcentaje_avance: 0,
      responsable: '',
      estado: 'Pendiente'
    };
    setCronograma([...cronograma, newRow]);
  };

  const calculateEndDate = (startDateStr, durationDays) => {
    if (!startDateStr || !durationDays) return '';
    const date = new Date(startDateStr + 'T00:00:00');
    date.setDate(date.getDate() + parseInt(durationDays, 10) - 1);
    return date.toISOString().split('T')[0];
  };

  const handleUpdateCronogramaField = (id, field, value) => {
    setCronograma(prev => prev.map(task => {
      if (task.id === id) {
        let updated = { ...task, [field]: value };

        if (field === 'fecha_inicio' || field === 'duracion') {
          const start = field === 'fecha_inicio' ? value : task.fecha_inicio;
          const dur = field === 'duracion' ? value : task.duracion;
          updated.fecha_fin = calculateEndDate(start, dur);
        }

        if (field === 'predecesora' && value) {
          const predTask = cronograma.find(x => x.codigo === value.trim());
          if (predTask && predTask.fecha_fin) {
            const pFinishDate = new Date(predTask.fecha_fin + 'T00:00:00');
            pFinishDate.setDate(pFinishDate.getDate() + 1);
            updated.fecha_inicio = pFinishDate.toISOString().split('T')[0];
            updated.fecha_fin = calculateEndDate(updated.fecha_inicio, updated.duracion);
          }
        }

        if (field === 'porcentaje_avance') {
          const pct = parseFloat(value) || 0;
          if (pct === 100) updated.estado = 'Completado';
          else if (pct > 0) updated.estado = 'En Progreso';
          else updated.estado = 'Pendiente';
        }

        return updated;
      }
      return task;
    }));
  };

  const handleDeleteCronogramaRow = (id) => {
    setCronograma(prev => prev.filter(t => t.id !== id));
  };

  const handleSaveCronograma = async () => {
    if (!selectedProyectoId) return;
    setTasksLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const toUpdate = cronograma.filter(t => typeof t.id === 'number');
      const toInsert = cronograma
        .filter(t => typeof t.id === 'string' && t.id.startsWith('temp-'))
        .map(t => {
          const { id, ...rest } = t;
          return { ...rest, presupuesto_id: selectedProyectoId };
        });

      const { data: dbCurrent, error: dbErr } = await supabase
        .from('planificacion_cronogramas')
        .select('id')
        .eq('presupuesto_id', selectedProyectoId);

      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('planificacion_cronogramas')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from('planificacion_cronogramas')
          .update({
            codigo: item.codigo,
            tarea: item.tarea,
            fecha_inicio: item.fecha_inicio,
            fecha_fin: item.fecha_fin,
            duracion: parseInt(item.duracion, 10) || 1,
            predecesora: item.predecesora,
            porcentaje_avance: parseFloat(item.porcentaje_avance) || 0,
            responsable: item.responsable,
            estado: item.estado
          })
          .eq('id', item.id);
        if (updErr) throw updErr;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('planificacion_cronogramas')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Planificación guardada con éxito.');
      fetchCronograma(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar planificación: ' + err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  // --- TAB: RECURSOS ---
  const handleAddResourceRow = () => {
    const newRow = {
      id: 'temp-' + Date.now() + Math.random(),
      presupuesto_id: selectedProyectoId,
      recurso: 'NUEVO RECURSO',
      tipo: 'Material',
      unidad: 'un',
      costo_unitario: 0,
      cantidad_estimada: 0,
      ciudad: '',
      proveedor: ''
    };
    setRecursos([...recursos, newRow]);
  };

  const handleUpdateResourceField = (id, field, value) => {
    setRecursos(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteResourceRow = (id) => {
    setRecursos(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveResources = async () => {
    if (!selectedProyectoId) return;
    setResourcesLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const toUpdate = recursos.filter(r => typeof r.id === 'number');
      const toInsert = recursos
        .filter(r => typeof r.id === 'string' && r.id.startsWith('temp-'))
        .map(r => {
          const { id, ...rest } = r;
          return { ...rest, presupuesto_id: selectedProyectoId };
        });

      const { data: dbCurrent, error: dbErr } = await supabase
        .from('recursos_presupuesto')
        .select('id')
        .eq('presupuesto_id', selectedProyectoId);

      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('recursos_presupuesto')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from('recursos_presupuesto')
          .update({
            recurso: item.recurso,
            tipo: item.tipo,
            unidad: item.unidad,
            costo_unitario: parseFloat(item.costo_unitario) || 0,
            cantidad_estimada: parseFloat(item.cantidad_estimada) || 0,
            ciudad: item.ciudad,
            proveedor: item.proveedor
          })
          .eq('id', item.id);
        if (updErr) throw updErr;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('recursos_presupuesto')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Recursos guardados exitosamente.');
      fetchRecursos(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar recursos: ' + err.message);
    } finally {
      setResourcesLoading(false);
    }
  };

  // --- LÓGICA DE COSTOS INDIRECTOS ---
  const handleAddIndirectCostRow = () => {
    const newRow = {
      id: 'temp-' + Date.now() + Math.random(),
      presupuesto_id: selectedProyectoId,
      concepto: 'NUEVO COSTO INDIRECTO',
      tipo: 'Porcentaje',
      valor: 0
    };
    setIndirectCosts([...indirectCosts, newRow]);
  };

  const handleUpdateIndirectCostField = (id, field, value) => {
    setIndirectCosts(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteIndirectCostRow = (id) => {
    setIndirectCosts(prev => prev.filter(c => c.id !== id));
  };

  const handleSaveIndirectCosts = async () => {
    if (!selectedProyectoId) return;
    setIndirectLoading(true);
    try {
      const toUpdate = indirectCosts.filter(c => typeof c.id === 'number');
      const toInsert = indirectCosts
        .filter(c => typeof c.id === 'string' && c.id.startsWith('temp-'))
        .map(c => {
          const { id, ...rest } = c;
          return { ...rest, presupuesto_id: selectedProyectoId };
        });

      const { data: dbCurrent, error: dbErr } = await supabase
        .from('presupuestos_costos_indirectos')
        .select('id')
        .eq('presupuesto_id', selectedProyectoId);
      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('presupuestos_costos_indirectos')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from('presupuestos_costos_indirectos')
          .update({
            concepto: item.concepto,
            tipo: item.tipo,
            valor: parseFloat(item.valor) || 0
          })
          .eq('id', item.id);
        if (updErr) throw updErr;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('presupuestos_costos_indirectos')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Costos indirectos actualizados correctamente.');
      setShowIndirectModal(false);
      fetchIndirectCosts(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar costos indirectos: ' + err.message);
    } finally {
      setIndirectLoading(false);
    }
  };

  // --- MÉTODOS DE CÁLCULO GANTT ---
  const generateGanttDays = () => {
    const days = [];
    const base = new Date(ganttStartDate + 'T00:00:00');
    for (let i = 0; i < ganttScale; i++) {
      const current = new Date(base);
      current.setDate(base.getDate() + i);
      days.push({
        dateStr: current.toISOString().split('T')[0],
        dayNum: current.getDate(),
        monthStr: current.toLocaleDateString('es-CL', { month: 'short' }),
        isWeekend: current.getDay() === 0 || current.getDay() === 6
      });
    }
    return days;
  };

  const ganttDays = generateGanttDays();

  const getGanttSpan = (taskStart, taskEnd) => {
    if (!taskStart || !taskEnd) return null;
    const base = new Date(ganttStartDate + 'T00:00:00');
    const start = new Date(taskStart + 'T00:00:00');
    const end = new Date(taskEnd + 'T00:00:00');

    const diffStart = Math.round((start - base) / (1000 * 60 * 60 * 24));
    const diffEnd = Math.round((end - base) / (1000 * 60 * 60 * 24)) + 1;

    if (diffEnd <= 0 || diffStart >= ganttScale) return null;

    return {
      gridColumnStart: Math.max(0, diffStart) + 1,
      gridColumnEnd: Math.min(ganttScale, diffEnd) + 1
    };
  };

  // Helpers de Formato
  const formatCLP = (num) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num || 0);
  };

  // Encontrar el proyecto activo actual
  const currentProyecto = proyectos.find(p => p.id === parseInt(selectedProyectoId, 10));

  // Totales
  const totalDirectCost = itemsPresupuesto.reduce((acc, curr) => {
    if (isChapterRow(curr, itemsPresupuesto)) return acc;
    return acc + ((parseFloat(curr.cantidad) || 0) * (parseFloat(curr.costo_unitario) || 0));
  }, 0);

  const calculateIndirectCostValue = (cost) => {
    if (cost.tipo === 'Porcentaje') {
      return totalDirectCost * (parseFloat(cost.valor) || 0) / 100;
    }
    return parseFloat(cost.valor) || 0;
  };

  const totalIndirectCostValue = indirectCosts.reduce((acc, curr) => {
    return acc + calculateIndirectCostValue(curr);
  }, 0);

  const totalProjectCost = totalDirectCost + totalIndirectCostValue;

  const totalResourceCost = recursos.reduce((acc, curr) => {
    return acc + ((parseFloat(curr.cantidad_estimada) || 0) * (parseFloat(curr.costo_unitario) || 0));
  }, 0);

  const materialCost = recursos.filter(r => r.tipo === 'Material').reduce((sum, r) => sum + (r.cantidad_estimada * r.costo_unitario), 0);
  const laborCost = recursos.filter(r => r.tipo === 'Mano de Obra').reduce((sum, r) => sum + (r.cantidad_estimada * r.costo_unitario), 0);
  const machineryCost = recursos.filter(r => r.tipo === 'Maquinaria').reduce((sum, r) => sum + (r.cantidad_estimada * r.costo_unitario), 0);

  // --- ACCIONES DE APU MODAL ---
  const openApuModal = async (item) => {
    if (typeof item.id !== 'number') {
      alert("Por favor, guarda el presupuesto primero para poder analizar esta partida en detalle.");
      return;
    }
    setApuItem(item);
    setApuLoading(true);
    setShowApuModal(true);
    setAddResourceMode('existente');
    setNewResourceForm({
      recurso: '',
      tipo: 'Material',
      unidad: 'un',
      costo_unitario: '',
      ciudad: '',
      proveedor: ''
    });

    // Rellenar formulario APU
    setApuForm({
      tipo_metodologia: item.tipo_metodologia || 'Precio Unitario',
      leyes_sociales_pct: item.leyes_sociales_pct || 0,
      imponderables_pct: item.imponderables_pct || 0,
      rendimiento_meta: item.rendimiento_meta || 0,
      tiempo_estimado: item.tiempo_estimado || 0,
      costo_materiales: item.costo_materiales || 0,
      costo_mano_obra: item.costo_mano_obra || 0,
      costo_maquinaria: item.costo_maquinaria || 0
    });

    try {
      if (selectedProyectoId) {
        await fetchRecursos(selectedProyectoId);
      }
      const { data, error } = await supabase
        .from('presupuestos_items_recursos')
        .select('*')
        .eq('item_id', item.id);
      if (error) throw error;
      setApuResources(data || []);
    } catch (err) {
      console.error('Error cargando recursos de partida:', err.message);
    } finally {
      setApuLoading(false);
    }
  };

  const handleAddResourceToApu = () => {
    if (!selectedAddResourceId) return;
    const resourceId = parseInt(selectedAddResourceId, 10);
    if (apuResources.some(r => String(r.recurso_id) === String(resourceId))) {
      alert("Este recurso ya está añadido en el análisis de esta partida.");
      return;
    }

    const newLink = {
      id: 'temp-apu-' + Date.now() + Math.random(),
      item_id: apuItem.id,
      recurso_id: resourceId,
      cantidad_unidad: 1,
      rendimiento: 1
    };
    setApuResources([...apuResources, newLink]);
    setSelectedAddResourceId('');
  };

  // CREACIÓN RÁPIDA DE RECURSO CON CIUDAD Y PROVEEDOR
  const handleCreateAndLinkNewResource = async (e) => {
    e.preventDefault();
    if (!newResourceForm.recurso.trim() || !selectedProyectoId) return;
    setApuLoading(true);

    try {
      const { data, error } = await supabase
        .from('recursos_presupuesto')
        .insert([
          {
            presupuesto_id: selectedProyectoId,
            recurso: newResourceForm.recurso.trim(),
            tipo: newResourceForm.tipo,
            unidad: newResourceForm.unidad.trim() || 'un',
            costo_unitario: parseFloat(newResourceForm.costo_unitario) || 0,
            cantidad_estimada: 1,
            ciudad: newResourceForm.ciudad,
            proveedor: newResourceForm.proveedor.trim()
          }
        ])
        .select();

      if (error) throw error;

      // Recargar la lista global de recursos del proyecto
      await fetchRecursos(selectedProyectoId);

      if (data && data.length > 0) {
        const createdRes = data[0];
        // Vincular de inmediato al APU de la partida
        const newLink = {
          id: 'temp-apu-' + Date.now() + Math.random(),
          item_id: apuItem.id,
          recurso_id: createdRes.id,
          cantidad_unidad: 1,
          rendimiento: 1
        };
        setApuResources([...apuResources, newLink]);
      }

      setNewResourceForm({
        recurso: '',
        tipo: 'Material',
        unidad: 'un',
        costo_unitario: '',
        ciudad: '',
        proveedor: ''
      });
      setAddResourceMode('existente');
      setSuccessMsg('Nuevo recurso registrado y vinculado al presupuesto.');
    } catch (err) {
      alert('Error creando recurso: ' + err.message);
    } finally {
      setApuLoading(false);
    }
  };

  const handleUpdateApuResourceField = (id, field, value) => {
    setApuResources(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteApuResource = (id) => {
    setApuResources(prev => prev.filter(r => r.id !== id));
  };

  // CÁLCULO DE COSTO UNITARIO / ARRIENDO DE LA PARTIDA
  const calculateApuCost = () => {
    if (apuForm.tipo_metodologia === 'Costo-Tiempo') {
      // Costo-Tiempo: Cobro por tiempo (arriendo/tarifa).
      // Se suman los costos directos de recursos sin factor de rendimiento.
      let totalTimeCost = 0;
      apuResources.forEach(link => {
        const res = recursos.find(r => String(r.id) === String(link.recurso_id));
        if (res) {
          const qty = parseFloat(link.cantidad_unidad) || 0;
          const cost = parseFloat(res.costo_unitario) || 0;
          totalTimeCost += cost * qty;
        }
      });

      // Si además ingresaron montos directos manuales:
      const manualCost = (parseFloat(apuForm.costo_materiales) || 0) + 
                         (parseFloat(apuForm.costo_mano_obra) || 0) + 
                         (parseFloat(apuForm.costo_maquinaria) || 0);
      
      return totalTimeCost + manualCost;
    } else {
      // Precio Unitario (APU): Cobra por cantidad de obra.
      // El precio es factor de rendimiento.
      let matSum = 0;
      let laborSum = 0;
      let machSum = 0;
      
      apuResources.forEach(link => {
        const res = recursos.find(r => String(r.id) === String(link.recurso_id));
        if (res) {
          const qty = parseFloat(link.cantidad_unidad) || 0;
          const rend = parseFloat(link.rendimiento) || 1;
          const cost = parseFloat(res.costo_unitario) || 0;
          const subtotal = cost * qty * rend;
          
          if (res.tipo === 'Material') matSum += subtotal;
          else if (res.tipo === 'Mano de Obra') laborSum += subtotal;
          else if (res.tipo === 'Maquinaria') machSum += subtotal;
        }
      });
      
      const laborConLeyes = laborSum * (1 + (parseFloat(apuForm.leyes_sociales_pct) || 0) / 100);
      const subtotalDirecto = matSum + machSum + laborConLeyes;
      const totalUnitario = subtotalDirecto * (1 + (parseFloat(apuForm.imponderables_pct) || 0) / 100);
      return totalUnitario;
    }
  };

  const handleSaveApu = async () => {
    if (!apuItem) return;
    setApuLoading(true);
    try {
      const finalUnitCost = calculateApuCost();
      
      let autoTiempo = apuForm.tiempo_estimado;
      if (apuForm.tipo_metodologia === 'Costo-Tiempo' && apuForm.rendimiento_meta > 0) {
        autoTiempo = (parseFloat(apuItem.cantidad) || 0) / parseFloat(apuForm.rendimiento_meta);
      }

      // 1. Guardar en presupuestos_items
      const { error: itemErr } = await supabase
        .from('presupuestos_items')
        .update({
          tipo_metodologia: apuForm.tipo_metodologia,
          rendimiento_meta: parseFloat(apuForm.rendimiento_meta) || 0,
          tiempo_estimado: autoTiempo,
          costo_materiales: parseFloat(apuForm.costo_materiales) || 0,
          costo_mano_obra: parseFloat(apuForm.costo_mano_obra) || 0,
          costo_maquinaria: parseFloat(apuForm.costo_maquinaria) || 0,
          leyes_sociales_pct: parseFloat(apuForm.leyes_sociales_pct) || 0,
          imponderables_pct: parseFloat(apuForm.imponderables_pct) || 0,
          costo_unitario: finalUnitCost
        })
        .eq('id', apuItem.id);
      if (itemErr) throw itemErr;

      // 2. Guardar recursos vinculados (Limpiar viejos e insertar lista actual)
      const { error: delErr } = await supabase
        .from('presupuestos_items_recursos')
        .delete()
        .eq('item_id', apuItem.id);
      if (delErr) throw delErr;

      if (apuResources.length > 0) {
        const recordsToInsert = apuResources.map(r => ({
          item_id: apuItem.id,
          recurso_id: parseInt(r.recurso_id, 10),
          cantidad_unidad: parseFloat(r.cantidad_unidad) || 0,
          rendimiento: apuForm.tipo_metodologia === 'Costo-Tiempo' ? 1 : (parseFloat(r.rendimiento) || 1)
        }));

        const { error: insErr } = await supabase
          .from('presupuestos_items_recursos')
          .insert(recordsToInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Análisis de partida guardado correctamente.');
      setShowApuModal(false);
      fetchBudgetItems(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar APU: ' + err.message);
    } finally {
      setApuLoading(false);
    }
  };

  // --- GESTIÓN DE PANTALLA OBLIGATORIA DE SELECCIÓN ---
  const isWorkspaceActive = activeSection !== '' && activeSection !== 'mis_presupuestos';
  const showBlockerGate = isWorkspaceActive && !selectedProyectoId;

  return (
    <div className="space-y-6">
      
      {/* 1. Cabecera Principal y selector de Proyecto */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight font-sans">Presupuestos</h2>
            <p className="text-[10px] text-slate-455 font-bold uppercase mt-0.5">Control de costos, diagramas Gantt y asignación de recursos independientes</p>
          </div>
        </div>

        {/* Controles de Selección */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Proyecto Activo:</span>
            {loadingProyectos ? (
              <span className="text-xs text-slate-400">Cargando...</span>
            ) : proyectos.length === 0 ? (
              <span className="text-xs text-slate-400 italic">Ninguno</span>
            ) : (
              <select
                value={selectedProyectoId}
                onChange={(e) => {
                  setSelectedProyectoId(e.target.value);
                  setActiveSection(''); // Resetear al menú de apartados
                }}
                className="bg-transparent text-xs font-bold text-slate-850 focus:outline-none cursor-pointer uppercase border-0 p-0"
              >
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => setShowCreateProjectModal(true)}
            className="flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary-hover transition cursor-pointer shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Nuevo Proyecto</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {successMsg && <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold border border-emerald-250 animate-in fade-in duration-150">{successMsg}</div>}
      {errorMsg && <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-semibold border border-red-250 animate-in fade-in duration-150">{errorMsg}</div>}

      <div className="space-y-6">
        
        {/* Ficha Resumen de Información Básica del Proyecto Activo */}
        {currentProyecto && !showBlockerGate && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Cliente / Mandante</span>
              <p className="text-xs font-extrabold text-slate-800 truncate uppercase">{currentProyecto.cliente || 'No asignado'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Dirección / Faena</span>
              <p className="text-xs font-extrabold text-slate-800 truncate uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{currentProyecto.ubicacion || 'No asignada'}</span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Comuna (Chile)</span>
              <p className="text-xs font-extrabold text-slate-850 uppercase">{currentProyecto.comuna || 'No asignada'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Tipo Proyecto</span>
              <p className="text-xs font-extrabold text-slate-850 uppercase flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${currentProyecto.tipo_proyecto === 'Público' ? 'bg-blue-650' : 'bg-emerald-650'}`} />
                <span>{currentProyecto.tipo_proyecto || 'Privado'}</span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Plazo de Entrega</span>
              <p className="text-xs font-extrabold text-slate-800 truncate flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{currentProyecto.plazo_estimado ? `${currentProyecto.plazo_estimado} Días` : 'Sin límite'}</span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Presupuesto Límite</span>
              <p className="text-xs font-extrabold text-slate-850 truncate">
                {currentProyecto.presupuesto_estimado ? formatCLP(currentProyecto.presupuesto_estimado) : 'Sin límite'}
              </p>
            </div>
          </div>
        )}

        {/* ================= GALAXY GATE BLOCKER: FORZAR PROYECTO ================= */}
        {showBlockerGate ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-xs max-w-xl mx-auto space-y-5 py-12 animate-in fade-in duration-200">
            <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Requiere Proyecto Activo</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Para poder interactuar con las planillas, importar presupuestos o planificar etapas de trabajo, primero debes seleccionar o crear un proyecto de construcción.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {proyectos.length > 0 && (
                <div className="w-full sm:w-auto">
                  <select
                    value={selectedProyectoId}
                    onChange={(e) => setSelectedProyectoId(e.target.value)}
                    className="border border-slate-250 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 uppercase focus:outline-none focus:border-primary bg-white cursor-pointer w-full"
                  >
                    <option value="">Selecciona Proyecto...</option>
                    {proyectos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={() => setShowCreateProjectModal(true)}
                className="flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-primary-hover transition w-full sm:w-auto cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Crear Nuevo Proyecto</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ================= VISTA A: MENÚ PRINCIPAL DE APARTADOS (RECTÁNGULOS) ================= */}
            {activeSection === '' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Card 1: Mis Presupuestos */}
                <div 
                  onClick={() => { setActiveSection('mis_presupuestos'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Mis Presupuestos
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Visualiza el listado completo de presupuestos creados, controla su estado de avance y cárgalos para seguir editando.
                    </p>
                  </div>
                </div>

                {/* Card 2: Crear Presupuesto */}
                <div 
                  onClick={() => { setActiveSection('crear'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Crear Presupuesto
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Estructura y edita la planilla de partidas bajo metodologías de Precio Unitario (con rendimientos) o Costo-Tiempo (arriendos).
                    </p>
                  </div>
                </div>

                {/* Card 3: Ingresar Presupuesto */}
                <div 
                  onClick={() => { setActiveSection('ingresar'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Ingresar Presupuesto (Carga Masiva)
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Importa rápidamente tu presupuesto estructurado pegando textos y datos tabulados o separados por comas.
                    </p>
                  </div>
                </div>

                {/* Card 4: Diagrama Gantt */}
                <div 
                  onClick={() => { setActiveSection('gantt'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Diagrama Gantt
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Programa etapas de trabajo, asigna predecesoras para encadenamiento automático y visualiza el cronograma mediante diagrama Gantt.
                    </p>
                  </div>
                </div>

                {/* Card 5: Recursos */}
                <div 
                  onClick={() => { setActiveSection('recursos'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <Hammer className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Recursos
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Controla y desglosa los insumos necesarios para el proyecto clasificados con su Comuna/Ciudad y Proveedor.
                    </p>
                  </div>
                </div>

              </div>
            ) : (
              // ================= VISTA B: APARTADO INDIVIDUAL DETALLADO =================
              <div className="space-y-6">
                
                {/* Barra superior de Apartado */}
                <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                  <button
                    onClick={() => { setActiveSection(''); setErrorMsg(''); setSuccessMsg(''); }}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-850 font-bold cursor-pointer transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Volver al menú de apartados</span>
                  </button>

                  <div className="flex items-center gap-3">
                    {activeSection === 'crear' && (
                      <>
                        <button
                          onClick={() => setShowIndirectModal(true)}
                          className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Sliders className="w-4 h-4 text-primary" />
                          <span>Costos Generales</span>
                        </button>
                        <button
                          onClick={handleSaveBudget}
                          disabled={budgetLoading}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>{budgetLoading ? 'Guardando...' : 'Guardar Presupuesto'}</span>
                        </button>
                      </>
                    )}
                    {activeSection === 'gantt' && (
                      <button
                        onClick={handleSaveCronograma}
                        disabled={tasksLoading}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{tasksLoading ? 'Guardando...' : 'Guardar Planificación'}</span>
                      </button>
                    )}
                    {activeSection === 'recursos' && (
                      <button
                        onClick={handleSaveResources}
                        disabled={resourcesLoading}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{resourcesLoading ? 'Guardando...' : 'Guardar Recursos'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* APARTADO: CREAR PRESUPUESTO */}
                {activeSection === 'crear' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Costo Directo Subtotal</h4>
                        <p className="text-2xl font-black text-slate-850 mt-1">{formatCLP(totalDirectCost)}</p>
                      </div>
                      <button
                        onClick={handleAddBudgetRow}
                        className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-primary" />
                        <span>Añadir Partida</span>
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none">
                              <th className="p-3.5 w-24">Código</th>
                              <th className="p-3.5">Concepto / Partida</th>
                              <th className="p-3.5 w-20">Unidad</th>
                              <th className="p-3.5 w-28">Cant. / Tiempo</th>
                              <th className="p-3.5 w-32">Precio / Tarifa ($)</th>
                              <th className="p-3.5 w-36">Importe ($)</th>
                              <th className="p-3.5 w-36 text-center">Metodología</th>
                              <th className="p-3.5 w-24 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150">
                            {itemsPresupuesto.map((item) => {
                              const isChapter = isChapterRow(item, itemsPresupuesto);
                              const importeVal = isChapter
                                ? getChapterSum(item.codigo, itemsPresupuesto)
                                : (parseFloat(item.cantidad) || 0) * (parseFloat(item.costo_unitario) || 0);
                              const isIndent = item.codigo && item.codigo.includes('.');
                              const isCostoTiempo = item.tipo_metodologia === 'Costo-Tiempo';

                              return (
                                <tr 
                                  key={item.id}
                                  className={`transition ${isChapter ? 'bg-slate-100/80 font-bold' : 'hover:bg-slate-50/40'}`}
                                >
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.codigo || ''}
                                      onChange={(e) => handleUpdateBudgetField(item.id, 'codigo', e.target.value)}
                                      placeholder="01.01"
                                      className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 ${isChapter ? 'font-black' : ''}`}
                                    />
                                  </td>
                                  <td className="p-2">
                                    <div className="flex items-center gap-1">
                                      {isIndent && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />}
                                      <input
                                        type="text"
                                        value={item.partida || ''}
                                        onChange={(e) => handleUpdateBudgetField(item.id, 'partida', e.target.value)}
                                        placeholder="ej: Fundaciones"
                                        className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 uppercase ${isChapter ? 'font-extrabold text-slate-900' : 'text-slate-700'}`}
                                      />
                                    </div>
                                  </td>
                                  <td className="p-2">
                                    {!isChapter && (
                                      <input
                                        type="text"
                                        value={item.unidad || ''}
                                        onChange={(e) => handleUpdateBudgetField(item.id, 'unidad', e.target.value)}
                                        placeholder={isCostoTiempo ? 'días' : 'm3'}
                                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-600 text-center uppercase"
                                      />
                                    )}
                                  </td>
                                  <td className="p-2">
                                    {!isChapter && (
                                      <input
                                        type="number"
                                        step="any"
                                        value={item.cantidad ?? ''}
                                        onChange={(e) => handleUpdateBudgetField(item.id, 'cantidad', e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 font-semibold"
                                      />
                                    )}
                                  </td>
                                  <td className="p-2">
                                    {!isChapter && (
                                      <input
                                        type="number"
                                        step="any"
                                        value={item.costo_unitario ?? ''}
                                        onChange={(e) => handleUpdateBudgetField(item.id, 'costo_unitario', e.target.value)}
                                        placeholder="0"
                                        disabled={typeof item.id === 'number'}
                                        className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs font-semibold ${typeof item.id === 'number' ? 'text-slate-500 cursor-not-allowed bg-slate-50/50' : 'text-slate-700'}`}
                                      />
                                    )}
                                  </td>
                                  <td className="p-3.5 font-bold text-slate-800">
                                    {formatCLP(importeVal)}
                                  </td>
                                  <td className="p-2 text-center">
                                    {!isChapter && (
                                      <span className={`inline-flex items-center gap-1 text-[9.5px] font-extrabold px-2.5 py-1 rounded-full border uppercase ${
                                        isCostoTiempo 
                                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}>
                                        {isCostoTiempo ? 'Costo-Tiempo' : 'Precio Unitario'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      {!isChapter && (
                                        <button
                                          onClick={() => openApuModal(item)}
                                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition"
                                          title="Análisis de Partida / Recursos"
                                        >
                                          <Settings className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteBudgetRow(item.id)}
                                        className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* COSTOS GENERALES / PIE DE PÁGINA */}
                            {itemsPresupuesto.length > 0 && (
                              <>
                                <tr className="bg-slate-50/50 font-bold border-t-2 border-slate-300">
                                  <td colSpan="5" className="p-3.5 text-right uppercase text-[10px] text-slate-500 font-extrabold tracking-wider">Costo Directo Total:</td>
                                  <td className="p-3.5 text-slate-850 font-black text-sm">{formatCLP(totalDirectCost)}</td>
                                  <td colSpan="2"></td>
                                </tr>
                                
                                {indirectCosts.map((cost) => {
                                  const costVal = calculateIndirectCostValue(cost);
                                  return (
                                    <tr key={cost.id} className="bg-slate-50/30 text-slate-600 font-semibold border-t border-slate-200">
                                      <td colSpan="5" className="p-3 text-right uppercase text-[9px] font-bold text-slate-450 tracking-wider">
                                        {cost.concepto} ({cost.tipo === 'Porcentaje' ? `${cost.valor}%` : 'Monto Fijo'}):
                                      </td>
                                      <td className="p-3 text-slate-800 font-bold">{formatCLP(costVal)}</td>
                                      <td colSpan="2"></td>
                                    </tr>
                                  );
                                })}

                                <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
                                  <td colSpan="5" className="p-3.5 text-right uppercase text-xs text-slate-700 tracking-wider">Total General del Presupuesto:</td>
                                  <td className="p-3.5 text-primary font-black text-base">{formatCLP(totalProjectCost)}</td>
                                  <td colSpan="2"></td>
                                </tr>
                              </>
                            )}

                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* APARTADO: INGRESAR PRESUPUESTO */}
                {activeSection === 'ingresar' && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Upload className="w-5 h-5 text-primary" />
                      <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Ingresar Presupuesto (Carga Masiva)</h3>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Copia y pega partidas directamente desde otro sistema o planilla de cálculo en el cuadro de texto.
                    </p>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-[10px] font-semibold text-slate-500 space-y-2">
                      <span className="font-bold text-slate-850 block">Formato aceptado:</span>
                      <code className="bg-white px-2 py-1 rounded border font-mono block text-slate-800">
                        Código, Concepto, Unidad, Cantidad, CostoUnitario, RendimientoMeta
                      </code>
                      <span className="font-bold text-slate-850 block mt-2">Ejemplo:</span>
                      <code className="bg-white px-2 py-1 rounded border font-mono block text-slate-800 whitespace-pre">
                        01, Obras Preliminares, gl, 1, 600000, 0{"\n"}
                        01.01, Trazados y niveles, m2, 350, 1200, 150
                      </code>
                    </div>

                    <textarea
                      rows="8"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Pega las líneas aquí..."
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-primary font-mono bg-slate-50/50"
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={handleImportCSV}
                        disabled={budgetLoading || !importText.trim()}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>Procesar e Importar</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* APARTADO: DIAGRAMA GANTT */}
                {activeSection === 'gantt' && (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
                    
                    {/* Hoja de Planificación (Izquierda) */}
                    <div className="xl:col-span-6 space-y-4">
                      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex justify-between items-center">
                        <div>
                          <h3 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">Hoja de Planificación</h3>
                          <p className="text-[10px] text-slate-455 font-bold uppercase mt-0.5">Listado de etapas y plazos</p>
                        </div>
                        <button
                          onClick={handleAddCronogramaRow}
                          className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-primary" />
                          <span>Agregar Tarea</span>
                        </button>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-660 font-bold text-[9px] uppercase tracking-wider select-none">
                                <th className="p-3 w-16 text-center">Código</th>
                                <th className="p-3">Tarea</th>
                                <th className="p-3 w-20">Inicio</th>
                                <th className="p-3 w-16 text-center">Días</th>
                                <th className="p-3 w-16 text-center">Pred.</th>
                                <th className="p-3 w-20 text-center">Avance</th>
                                <th className="p-3 w-12"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                              {cronograma.map((task) => {
                                let alertConflict = false;
                                if (task.predecesora) {
                                  const pred = cronograma.find(x => x.codigo === task.predecesora.trim());
                                  if (pred && pred.fecha_fin && task.fecha_inicio) {
                                    alertConflict = task.fecha_inicio < pred.fecha_fin;
                                  }
                                }

                                return (
                                  <tr key={task.id} className="hover:bg-slate-50/50 transition">
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={task.codigo || ''}
                                        onChange={(e) => handleUpdateCronogramaField(task.id, 'codigo', e.target.value)}
                                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-800 font-bold text-center"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={task.tarea || ''}
                                        onChange={(e) => handleUpdateCronogramaField(task.id, 'tarea', e.target.value)}
                                        placeholder="Nueva Tarea"
                                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-800 uppercase font-semibold"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <div className="relative flex items-center">
                                        {alertConflict && (
                                          <span className="absolute -left-2.5 text-amber-500 cursor-help" title="Conflicto: Inicia antes del término de la predecesora">⚠️</span>
                                        )}
                                        <input
                                          type="date"
                                          value={task.fecha_inicio || ''}
                                          onChange={(e) => handleUpdateCronogramaField(task.id, 'fecha_inicio', e.target.value)}
                                          className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-[11px] text-slate-700 font-medium"
                                        />
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        min="1"
                                        value={task.duracion ?? ''}
                                        onChange={(e) => handleUpdateCronogramaField(task.id, 'duracion', e.target.value)}
                                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-700 font-bold text-center"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={task.predecesora || ''}
                                        onChange={(e) => handleUpdateCronogramaField(task.id, 'predecesora', e.target.value)}
                                        placeholder="nº"
                                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-655 text-center font-bold"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={task.porcentaje_avance ?? ''}
                                        onChange={(e) => handleUpdateCronogramaField(task.id, 'porcentaje_avance', e.target.value)}
                                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-700 text-center font-semibold"
                                      />
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        onClick={() => handleDeleteCronogramaRow(task.id)}
                                        className="p-1 text-red-655 hover:bg-red-50 rounded-lg transition"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {cronograma.length === 0 && (
                        <div className="p-8 text-center text-xs text-slate-400 italic">
                          No hay tareas de planificación. Haz clic en "Agregar Tarea" para empezar.
                        </div>
                      )}
                    </div>

                    {/* Diagrama Gantt (Derecha) */}
                    <div className="xl:col-span-6 space-y-4">
                      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Fecha Escala:</span>
                          <input
                            type="date"
                            value={ganttStartDate}
                            onChange={(e) => setGanttStartDate(e.target.value)}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Límites:</span>
                          <select
                            value={ganttScale}
                            onChange={(e) => setGanttScale(parseInt(e.target.value, 10))}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 bg-white"
                          >
                            <option value={15}>15 días</option>
                            <option value={30}>30 días (Mes)</option>
                            <option value={60}>60 días (Trimestre)</option>
                          </select>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Diagrama Gantt de Actividades</span>
                          <div className="flex gap-3 text-[9px] font-bold uppercase">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-500 rounded-xs" /> Pendiente</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded-xs" /> En Curso</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-600 rounded-xs" /> Completado</span>
                          </div>
                        </div>

                        <div className="p-4 overflow-x-auto">
                          <div 
                            className="grid border-r border-b border-slate-200 select-none min-w-[650px]"
                            style={{ gridTemplateColumns: `repeat(${ganttScale}, minmax(26px, 1fr))` }}
                          >
                            {ganttDays.map((day, idx) => (
                              <div 
                                key={idx}
                                className={`text-center py-2 border-t border-l border-slate-200 flex flex-col justify-center items-center ${
                                  day.isWeekend ? 'bg-slate-100/70 text-slate-400' : 'bg-slate-50 text-slate-655'
                                }`}
                              >
                                <span className="text-[7.5px] font-bold uppercase tracking-wider">{day.monthStr}</span>
                                <span className="text-[10px] font-black">{day.dayNum}</span>
                              </div>
                            ))}

                            {cronograma.map((task) => {
                              const span = getGanttSpan(task.fecha_inicio, task.fecha_fin);
                              let barColor = 'bg-yellow-500';
                              if (task.estado === 'En Progreso') barColor = 'bg-blue-600';
                              else if (task.estado === 'Completado') barColor = 'bg-emerald-600';

                              return (
                                <div 
                                  key={task.id}
                                  className="h-9 relative border-t border-l border-slate-200 flex items-center bg-slate-50/20"
                                  style={{ gridColumn: `1 / span ${ganttScale}` }}
                                >
                                  <div 
                                    className="grid h-full w-full absolute top-0 left-0"
                                    style={{ gridTemplateColumns: `repeat(${ganttScale}, minmax(26px, 1fr))` }}
                                  >
                                    {span && (
                                      <div 
                                        className="relative flex items-center h-full px-1"
                                        style={{
                                          gridColumnStart: span.gridColumnStart,
                                          gridColumnEnd: span.gridColumnEnd
                                        }}
                                      >
                                        <div 
                                          className={`w-full h-5 ${barColor} text-white rounded-lg flex items-center justify-between px-2 text-[9px] font-bold shadow-xs truncate`}
                                          title={`${task.tarea}: ${task.fecha_inicio} a ${task.fecha_fin}`}
                                        >
                                          <span className="truncate uppercase">{task.tarea}</span>
                                          <span>{task.porcentaje_avance}%</span>
                                        </div>
                                      </div>
                                    )}

                                    {ganttDays.map((day, idx) => (
                                      <div 
                                        key={idx} 
                                        className={`border-r border-slate-100/50 h-full pointer-events-none ${
                                          day.isWeekend ? 'bg-slate-100/10' : ''
                                        }`} 
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* APARTADO: RECURSOS */}
                {activeSection === 'recursos' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Costo Estimado de Recursos</h4>
                        <p className="text-xl font-black text-slate-850 mt-1">{formatCLP(totalResourceCost)}</p>
                      </div>
                      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Materiales</h4>
                        <p className="text-xl font-bold text-slate-700 mt-1">{formatCLP(materialCost)}</p>
                      </div>
                      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Mano de Obra</h4>
                        <p className="text-xl font-bold text-slate-700 mt-1">{formatCLP(laborCost)}</p>
                      </div>
                      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Maquinaria</h4>
                        <p className="text-xl font-bold text-slate-700 mt-1">{formatCLP(machineryCost)}</p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleAddResourceRow}
                        className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-primary" />
                        <span>Añadir Recurso</span>
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-650 font-bold text-[9px] uppercase tracking-wider select-none">
                              <th className="p-3.5">Nombre Recurso</th>
                              <th className="p-3.5 w-32">Tipo</th>
                              <th className="p-3.5 w-20">Unidad</th>
                              <th className="p-3.5 w-28">Costo Unit. ($)</th>
                              <th className="p-3.5 w-24">Cant. Est.</th>
                              <th className="p-3.5 w-36">Comuna / Ciudad</th>
                              <th className="p-3.5 w-36">Proveedor</th>
                              <th className="p-3.5 w-32">Costo Total ($)</th>
                              <th className="p-3.5 w-14 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150">
                            {recursos.map((item) => {
                              const totalRow = (parseFloat(item.cantidad_estimada) || 0) * (parseFloat(item.costo_unitario) || 0);

                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition">
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.recurso || ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'recurso', e.target.value)}
                                      placeholder="ej: Cemento Gris"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 uppercase font-semibold"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <select
                                      value={item.tipo || 'Material'}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'tipo', e.target.value)}
                                      className="w-full border-0 bg-transparent focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-705"
                                    >
                                      <option value="Material">Material</option>
                                      <option value="Mano de Obra">Mano de Obra</option>
                                      <option value="Maquinaria">Maquinaria</option>
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.unidad || ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'unidad', e.target.value)}
                                      placeholder="bolsas"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-600 text-center uppercase"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      step="any"
                                      value={item.costo_unitario ?? ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'costo_unitario', e.target.value)}
                                      placeholder="0"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      step="any"
                                      value={item.cantidad_estimada ?? ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'cantidad_estimada', e.target.value)}
                                      placeholder="0"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 font-semibold text-center"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <select
                                      value={item.ciudad || ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'ciudad', e.target.value)}
                                      className="w-full border-0 bg-transparent focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 uppercase"
                                    >
                                      <option value="">Seleccione Ciudad...</option>
                                      {comunasChile.map((c, idx) => (
                                        <option key={idx} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.proveedor || ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'proveedor', e.target.value)}
                                      placeholder="ej: Sodimac"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 uppercase"
                                    />
                                  </td>
                                  <td className="p-3.5 font-bold text-slate-800">
                                    {formatCLP(totalRow)}
                                  </td>
                                  <td className="p-2 text-center">
                                    <button
                                      onClick={() => handleDeleteResourceRow(item.id)}
                                      className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* APARTADO: MIS PRESUPUESTOS */}
                {activeSection === 'mis_presupuestos' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-primary" />
                          <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Presupuestos Registrados</h3>
                        </div>
                      </div>

                      {proyectos.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 italic">
                          No hay ningún presupuesto registrado en el sistema. Crea uno nuevo para comenzar.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none">
                                <th className="p-3.5">Proyecto / Presupuesto</th>
                                <th className="p-3.5">Cliente</th>
                                <th className="p-3.5">Ubicación</th>
                                <th className="p-3.5 w-32 text-center">Plazo</th>
                                <th className="p-3.5 w-40 text-right">Límite Estimado ($)</th>
                                <th className="p-3.5 w-32 text-center">Estado</th>
                                <th className="p-3.5 w-52 text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                              {proyectos.map((p) => {
                                const isActive = p.id === parseInt(selectedProyectoId, 10);
                                return (
                                  <tr key={p.id} className={`hover:bg-slate-50/50 transition ${isActive ? 'bg-primary/5' : ''}`}>
                                    <td className="p-3.5 font-bold text-slate-800 uppercase">
                                      <div className="flex items-center gap-1.5">
                                        <span>{p.nombre}</span>
                                        <span className={`text-[8.5px] px-1.5 py-0.5 rounded-md font-extrabold ${p.tipo_proyecto === 'Público' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                                          {p.tipo_proyecto || 'Privado'}
                                        </span>
                                      </div>
                                      {p.descripcion && (
                                        <span className="block text-[10px] text-slate-455 font-normal normal-case mt-0.5">{p.descripcion}</span>
                                      )}
                                    </td>
                                    <td className="p-3.5 text-slate-650 uppercase font-semibold">{p.cliente || '-'}</td>
                                    <td className="p-3.5 text-slate-600 uppercase font-semibold">
                                      <span>{p.comuna || '-'}</span>
                                      {p.ubicacion && (
                                        <span className="block text-[10px] text-slate-455 font-normal normal-case mt-0.5">{p.ubicacion}</span>
                                      )}
                                    </td>
                                    <td className="p-3.5 text-center font-bold text-slate-700">{p.plazo_estimado ? `${p.plazo_estimado} días` : '-'}</td>
                                    <td className="p-3.5 text-right font-bold text-slate-850">
                                      {p.presupuesto_estimado ? formatCLP(p.presupuesto_estimado) : '-'}
                                    </td>
                                    <td className="p-3.5 text-center">
                                      {isActive ? (
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border border-emerald-200">
                                          <Check className="w-3 h-3" /> Activo
                                        </span>
                                      ) : (
                                        <span className="inline-flex bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">
                                          Guardado
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3.5">
                                      <div className="flex items-center justify-center gap-2">
                                        {!isActive && (
                                          <button
                                            onClick={() => {
                                              setSelectedProyectoId(p.id);
                                              setSuccessMsg(`Proyecto "${p.nombre}" cargado exitosamente.`);
                                              setActiveSection('');
                                            }}
                                            className="bg-primary hover:bg-primary-hover text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                                          >
                                            Cargar Proyecto
                                          </button>
                                        )}
                                        {isActive && (
                                          <span className="text-[10px] text-emerald-650 font-bold px-3 py-1.5 italic">Cargado</span>
                                        )}
                                        <button
                                          onClick={async () => {
                                            if (confirm(`¿Estás seguro de eliminar el proyecto "${p.nombre}"? Se borrarán todos sus ítems de presupuesto, tareas del diagrama Gantt y recursos asignados.`)) {
                                              try {
                                                await supabase.from('presupuestos_items').delete().eq('presupuesto_id', p.id);
                                                await supabase.from('planificacion_cronogramas').delete().eq('presupuesto_id', p.id);
                                                await supabase.from('recursos_presupuesto').delete().eq('presupuesto_id', p.id);
                                                await supabase.from('presupuestos_costos_indirectos').delete().eq('presupuesto_id', p.id);
                                                
                                                const { error } = await supabase
                                                  .from('presupuestos_proyectos')
                                                  .delete()
                                                  .eq('id', p.id);
                                                if (error) throw error;
                                                
                                                setSuccessMsg(`Proyecto "${p.nombre}" eliminado con éxito.`);
                                                fetchProyectos();
                                              } catch (err) {
                                                setErrorMsg('Error al eliminar: ' + err.message);
                                              }
                                            }
                                          }}
                                          className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                          title="Eliminar Proyecto"
                                        >
                                          <Trash2 className="w-4 h-4" />
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
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {/* ================= MODAL: ANÁLISIS DE PARTIDA / APU ================= */}
      {showApuModal && apuItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-4.5 h-4.5 text-primary" />
                  <span>Análisis de Partida: {apuItem.partida}</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Código: {apuItem.codigo || 'S/N'}</p>
              </div>
              <button 
                onClick={() => setShowApuModal(false)} 
                className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Unidad</span>
                <p className="text-xs font-black text-slate-700 uppercase">{apuItem.unidad || 'Sin unidad'}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Cantidad de Obra / Tiempo</span>
                <p className="text-xs font-black text-slate-700">{apuItem.cantidad || 0}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Precio / Tarifa Resultante</span>
                <p className="text-sm font-black text-primary">{formatCLP(calculateApuCost())}</p>
              </div>
            </div>

            <div className="space-y-6">
              
              {/* Selección de Metodología */}
              <div>
                <span className="block text-[9px] font-bold uppercase text-slate-450 mb-2">Metodología de Presupuestación</span>
                <div className="flex flex-wrap gap-4">
                  <label className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border cursor-pointer transition ${
                    apuForm.tipo_metodologia === 'Precio Unitario' ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="tipo_metodologia"
                      value="Precio Unitario"
                      checked={apuForm.tipo_metodologia === 'Precio Unitario'}
                      onChange={(e) => setApuForm({ ...apuForm, tipo_metodologia: e.target.value })}
                      className="text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>Precio Unitario (Cobra por Cantidad + Factor Rendimiento)</span>
                  </label>
                  <label className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border cursor-pointer transition ${
                    apuForm.tipo_metodologia === 'Costo-Tiempo' ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="tipo_metodologia"
                      value="Costo-Tiempo"
                      checked={apuForm.tipo_metodologia === 'Costo-Tiempo'}
                      onChange={(e) => setApuForm({ ...apuForm, tipo_metodologia: e.target.value })}
                      className="text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>Costo-Tiempo (Arriendo / Tarifa por Tiempo sin Rendimiento)</span>
                  </label>
                </div>
              </div>

              {/* MODO ADICIÓN DE RECURSOS (SELECCIONAR O CREAR AL INSTANTE) */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-700 tracking-wider">Insumos y Recursos de la Partida</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAddResourceMode('existente')}
                      className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition ${addResourceMode === 'existente' ? 'bg-white text-primary shadow-xs border border-slate-200' : 'text-slate-500'}`}
                    >
                      Seleccionar Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddResourceMode('nuevo')}
                      className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition ${addResourceMode === 'nuevo' ? 'bg-primary text-white shadow-xs' : 'text-slate-500'}`}
                    >
                      ➕ Crear Nuevo Recurso
                    </button>
                  </div>
                </div>

                {/* OPCIÓN 1: SELECCIONAR EXISTENTE */}
                {addResourceMode === 'existente' && (
                  <div className="flex flex-col sm:flex-row items-end gap-3 pt-1">
                    <div className="flex-1">
                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Catálogo de Recursos del Proyecto</label>
                      <select
                        value={selectedAddResourceId}
                        onChange={(e) => setSelectedAddResourceId(e.target.value)}
                        className="w-full border border-slate-250 rounded-lg p-2 text-xs font-semibold text-slate-700 bg-white"
                      >
                        <option value="">Selecciona un Recurso...</option>
                        {recursos.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.recurso} [{r.tipo}] - {formatCLP(r.costo_unitario)} / {r.unidad} {r.ciudad ? `(${r.ciudad})` : ''} {r.proveedor ? `- Prov: ${r.proveedor}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddResourceToApu}
                      className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary-hover transition cursor-pointer shrink-0"
                    >
                      Vincular Recurso
                    </button>
                  </div>
                )}

                {/* OPCIÓN 2: CREAR NUEVO RECURSO DESDE PRESUPUESTO */}
                {addResourceMode === 'nuevo' && (
                  <form onSubmit={handleCreateAndLinkNewResource} className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Nombre Recurso / Insumo *</label>
                        <input
                          type="text"
                          required
                          value={newResourceForm.recurso}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, recurso: e.target.value })}
                          placeholder="ej: Arriendo Retroexcavadora CAT"
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 focus:outline-none focus:border-primary uppercase bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Tipo de Recurso</label>
                        <select
                          value={newResourceForm.tipo}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, tipo: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 bg-white"
                        >
                          <option value="Material">Material</option>
                          <option value="Mano de Obra">Mano de Obra</option>
                          <option value="Maquinaria">Maquinaria</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Unidad de Medida / Tiempo</label>
                        <input
                          type="text"
                          value={newResourceForm.unidad}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, unidad: e.target.value })}
                          placeholder="ej: día, mes, m3"
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 uppercase bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Costo / Tarifa ($) *</label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={newResourceForm.costo_unitario}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, costo_unitario: e.target.value })}
                          placeholder="ej: 120000"
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Comuna / Ciudad origen</label>
                        <select
                          value={newResourceForm.ciudad}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, ciudad: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 uppercase bg-white"
                        >
                          <option value="">Seleccione Ciudad...</option>
                          {comunasChile.map((c, idx) => (
                            <option key={idx} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Proveedor / Contratista</label>
                        <input
                          type="text"
                          value={newResourceForm.proveedor}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, proveedor: e.target.value })}
                          placeholder="ej: Caterpillar Chile"
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 uppercase bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardar en Recursos y Vincular</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* TABLA DE ANÁLISIS DE RECURSOS VINCULADOS */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none">
                      <th className="p-3">Recurso / Insumo</th>
                      <th className="p-3 w-28">Tipo</th>
                      <th className="p-3 w-32">Ciudad & Proveedor</th>
                      <th className="p-3 w-24 text-right">Tarifa ($)</th>
                      <th className="p-3 w-24 text-center">Cantidad</th>
                      {apuForm.tipo_metodologia === 'Precio Unitario' && (
                        <th className="p-3 w-24 text-center">Rendimiento</th>
                      )}
                      <th className="p-3 w-32 text-right">Subtotal ($)</th>
                      <th className="p-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {apuResources.map((link) => {
                      const res = recursos.find(r => String(r.id) === String(link.recurso_id));
                      if (!res) return null;
                      const isPU = apuForm.tipo_metodologia === 'Precio Unitario';
                      const rendVal = isPU ? (parseFloat(link.rendimiento) || 1) : 1;
                      const sub = (parseFloat(res.costo_unitario) || 0) * (parseFloat(link.cantidad_unidad) || 0) * rendVal;

                      return (
                        <tr key={link.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-2 font-bold text-slate-800 uppercase">{res.recurso}</td>
                          <td className="p-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              res.tipo === 'Material' ? 'bg-blue-50 text-blue-700' :
                              res.tipo === 'Mano de Obra' ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'
                            }`}>
                              {res.tipo}
                            </span>
                          </td>
                          <td className="p-2 text-[10px] text-slate-600 uppercase">
                            <span className="font-bold text-slate-800 block">{res.ciudad || '-'}</span>
                            <span className="text-slate-450 block">{res.proveedor || '-'}</span>
                          </td>
                          <td className="p-2 text-right font-medium text-slate-700">{formatCLP(res.costo_unitario)}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              value={link.cantidad_unidad ?? ''}
                              onChange={(e) => handleUpdateApuResourceField(link.id, 'cantidad_unidad', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-center text-xs text-slate-800 font-semibold"
                            />
                          </td>
                          {isPU && (
                            <td className="p-2">
                              <input
                                type="number"
                                step="any"
                                value={link.rendimiento ?? ''}
                                onChange={(e) => handleUpdateApuResourceField(link.id, 'rendimiento', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-center text-xs text-slate-800 font-semibold"
                              />
                            </td>
                          )}
                          <td className="p-3.5 text-right font-bold text-slate-800">{formatCLP(sub)}</td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteApuResource(link.id)}
                              className="p-1 text-red-655 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {apuResources.length === 0 && (
                      <tr>
                        <td colSpan={apuForm.tipo_metodologia === 'Precio Unitario' ? 8 : 7} className="p-8 text-center text-xs text-slate-400 italic">
                          No has vinculado recursos a esta partida. Selecciona uno del catálogo o crea uno nuevo arriba.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* FACTORES ADICIONALES PARA PRECIO UNITARIO */}
              {apuForm.tipo_metodologia === 'Precio Unitario' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-slate-500" />
                      <span>Leyes Sociales (%) — Aplica sobre Mano de Obra</span>
                    </label>
                    <input
                      type="number"
                      value={apuForm.leyes_sociales_pct ?? ''}
                      onChange={(e) => setApuForm({ ...apuForm, leyes_sociales_pct: parseFloat(e.target.value) || 0 })}
                      placeholder="ej: 35"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-primary bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-slate-500" />
                      <span>Imponderables / Margen (%) — Aplica sobre subtotal</span>
                    </label>
                    <input
                      type="number"
                      value={apuForm.imponderables_pct ?? ''}
                      onChange={(e) => setApuForm({ ...apuForm, imponderables_pct: parseFloat(e.target.value) || 0 })}
                      placeholder="ej: 5"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-primary bg-white"
                    />
                  </div>
                </div>
              )}

            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowApuModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleSaveApu}
                disabled={apuLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{apuLoading ? 'Guardando...' : 'Aplicar Análisis de Partida'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: COSTOS GENERALES / INDIRECTOS ================= */}
      {showIndirectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4.5 h-4.5 text-primary" />
                <span>Configuración de Costos Indirectos</span>
              </h3>
              <button 
                onClick={() => setShowIndirectModal(false)} 
                className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-normal mb-4">
              Añade costos indirectos del proyecto como gastos generales, utilidades e imprevistos globales que afecten al presupuesto total.
            </p>

            <div className="space-y-4 max-h-[350px] overflow-y-auto">
              {indirectCosts.map((cost) => (
                <div key={cost.id} className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={cost.concepto || ''}
                    onChange={(e) => handleUpdateIndirectCostField(cost.id, 'concepto', e.target.value)}
                    placeholder="ej: GASTOS GENERALES"
                    className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-850 focus:outline-none uppercase font-bold"
                  />
                  <select
                    value={cost.tipo}
                    onChange={(e) => handleUpdateIndirectCostField(cost.id, 'tipo', e.target.value)}
                    className="w-28 border border-slate-200 rounded-lg p-1.5 text-xs bg-white focus:outline-none font-semibold text-slate-700"
                  >
                    <option value="Porcentaje">Porcentaje (%)</option>
                    <option value="Monto Fijo">Monto Fijo ($)</option>
                  </select>
                  <input
                    type="number"
                    value={cost.valor ?? ''}
                    onChange={(e) => handleUpdateIndirectCostField(cost.id, 'valor', e.target.value)}
                    placeholder="0"
                    className="w-24 bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 text-center font-bold"
                  />
                  <button
                    onClick={() => handleDeleteIndirectCostRow(cost.id)}
                    className="p-1.5 text-red-650 hover:bg-red-50 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {indirectCosts.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No hay costos indirectos. Añade uno con el botón de abajo.
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-6 border-t border-slate-100 pt-4">
              <button
                onClick={handleAddIndirectCostRow}
                className="flex items-center gap-1 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Añadir Fila</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowIndirectModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveIndirectCosts}
                  disabled={indirectLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{indirectLoading ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREAR NUEVO PROYECTO CON INFO BÁSICA ================= */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <FolderPlus className="w-4.5 h-4.5 text-primary" />
                <span>Nuevo Proyecto de Presupuesto</span>
              </h3>
              <button 
                onClick={() => setShowCreateProjectModal(false)} 
                className="text-slate-400 hover:text-slate-655 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Nombre del Proyecto / Faena *</label>
                <input
                  type="text"
                  required
                  value={newProjectData.nombre}
                  onChange={(e) => setNewProjectData({ ...newProjectData, nombre: e.target.value })}
                  placeholder="ej: Edificio Costanera"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary uppercase"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Cliente / Mandante</label>
                <input
                  type="text"
                  value={newProjectData.cliente}
                  onChange={(e) => setNewProjectData({ ...newProjectData, cliente: e.target.value })}
                  placeholder="ej: Constructora Alerce Ltda."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Comuna (Chile)</label>
                  <select
                    value={newProjectData.comuna}
                    onChange={(e) => setNewProjectData({ ...newProjectData, comuna: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-707 focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="">Seleccione Comuna...</option>
                    {comunasChile.map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Dirección / Faena</label>
                  <input
                    type="text"
                    value={newProjectData.ubicacion}
                    onChange={(e) => setNewProjectData({ ...newProjectData, ubicacion: e.target.value })}
                    placeholder="ej: Av. Ossa 235"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Tipo de Proyecto</label>
                  <select
                    value={newProjectData.tipo_proyecto}
                    onChange={(e) => setNewProjectData({ ...newProjectData, tipo_proyecto: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-705 focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="Privado">Privado</option>
                    <option value="Público">Público</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Plazo de Entrega (Días)</label>
                  <input
                    type="number"
                    value={newProjectData.plazo_estimado}
                    onChange={(e) => setNewProjectData({ ...newProjectData, plazo_estimado: e.target.value })}
                    placeholder="ej: 120"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Presupuesto Inicial Límite ($)</label>
                <input
                  type="number"
                  value={newProjectData.presupuesto_estimado}
                  onChange={(e) => setNewProjectData({ ...newProjectData, presupuesto_estimado: e.target.value })}
                  placeholder="ej: 150000000"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Descripción del Proyecto</label>
                <textarea
                  rows="2"
                  value={newProjectData.descripcion}
                  onChange={(e) => setNewProjectData({ ...newProjectData, descripcion: e.target.value })}
                  placeholder="ej: Planificación para licitación de fundaciones"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loadingProyectos}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" />
                <span>Crear Proyecto e Iniciar</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
