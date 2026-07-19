import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, FileSpreadsheet, Calendar, Plus, Save, Trash2, 
  Layers, Upload, Check, AlertCircle, RefreshCw, LayoutGrid, HelpCircle, 
  ChevronRight, ChevronDown, ListCollapse, ChevronLeft, CalendarDays,
  FolderPlus, DollarSign, Hammer, Briefcase, FileText
} from 'lucide-react';

export default function PresupuestosPlanif({ user, onBack }) {
  // Lista de proyectos/presupuestos independientes
  const [proyectos, setProyectos] = useState([]);
  const [selectedProyectoId, setSelectedProyectoId] = useState('');
  const [loadingProyectos, setLoadingProyectos] = useState(true);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ nombre: '', descripcion: '' });

  // Pestaña activa: 'crear', 'ingresar', 'planificacion', 'recursos'
  const [activeTab, setActiveTab] = useState('crear');

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

  // Mensajes generales
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cargar proyectos independientes al iniciar
  useEffect(() => {
    fetchProyectos();
  }, []);

  // Cargar datos cuando cambia el proyecto activo
  useEffect(() => {
    if (selectedProyectoId) {
      fetchBudgetItems(selectedProyectoId);
      fetchCronograma(selectedProyectoId);
      fetchRecursos(selectedProyectoId);
    } else {
      setItemsPresupuesto([]);
      setCronograma([]);
      setRecursos([]);
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
      console.error('Error al cargar proyectos de presupuesto:', err.message);
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

      // Ordenar por código jerárquico de forma natural
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

  // --- CREAR NUEVO PROYECTO DESDE CERO ---
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
            descripcion: newProjectData.descripcion.trim()
          }
        ])
        .select();

      if (error) throw error;

      setSuccessMsg('Proyecto de presupuesto creado con éxito.');
      setNewProjectData({ nombre: '', descripcion: '' });
      setShowCreateProjectModal(false);
      
      // Recargar lista y seleccionar el nuevo
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

  // --- TABS: ACCIONES PRESUPUESTO (CREAR) ---
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
      rendimiento_meta: 0
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

      // 1. Eliminar
      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('presupuestos_items')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      // 2. Actualizar
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

      // 3. Insertar
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

  // --- TAB: INGRESAR PRESUPUESTO (IMPORTAR MASIVO) ---
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
      if (parts.length < 2) continue; // Al menos Código y Concepto

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
      setActiveTab('crear'); // Volver a la planilla principal
      fetchBudgetItems(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al importar: ' + err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  // --- TAB: PLANIFICACIÓN (CRONOGRAMA GANTT) ---
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
      tarea: 'Nueva Etapa / Tarea',
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
      cantidad_estimada: 0
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
            cantidad_estimada: parseFloat(item.cantidad_estimada) || 0
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

  // Helpers de Formato e Importes Totales
  const formatCLP = (num) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);
  };

  const totalBudgetCost = itemsPresupuesto.reduce((acc, curr) => {
    if (isChapterRow(curr, itemsPresupuesto)) return acc;
    return acc + ((parseFloat(curr.cantidad) || 0) * (parseFloat(curr.costo_unitario) || 0));
  }, 0);

  const totalResourceCost = recursos.reduce((acc, curr) => {
    return acc + ((parseFloat(curr.cantidad_estimada) || 0) * (parseFloat(curr.costo_unitario) || 0));
  }, 0);

  // Costos por Tipo de Recurso
  const materialCost = recursos.filter(r => r.tipo === 'Material').reduce((sum, r) => sum + (r.cantidad_estimada * r.costo_unitario), 0);
  const laborCost = recursos.filter(r => r.tipo === 'Mano de Obra').reduce((sum, r) => sum + (r.cantidad_estimada * r.costo_unitario), 0);
  const machineryCost = recursos.filter(r => r.tipo === 'Maquinaria').reduce((sum, r) => sum + (r.cantidad_estimada * r.costo_unitario), 0);

  return (
    <div className="space-y-6">
      
      {/* 1. Cabecera Principal e Independiente con Selector de Presupuesto/Proyecto */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Presupuesto y Planificación</h2>
            <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">Módulo de control de costos, cronograma y recursos independientes</p>
          </div>
        </div>

        {/* Controles de Selección y Creación de Proyectos */}
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
                onChange={(e) => setSelectedProyectoId(e.target.value)}
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

      {/* 2. Barra de Navegación de Sub-menús (Pestañas Independientes) */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-3 border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-150 gap-0.5">
          <button
            onClick={() => setActiveTab('crear')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'crear' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Crear Presupuesto</span>
          </button>
          <button
            onClick={() => setActiveTab('ingresar')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'ingresar' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Ingresar Presupuesto</span>
          </button>
          <button
            onClick={() => setActiveTab('planificacion')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'planificacion' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Planificación</span>
          </button>
          <button
            onClick={() => setActiveTab('recursos')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'recursos' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Hammer className="w-4 h-4" />
            <span>Recursos</span>
          </button>
        </div>

        {/* Botón Guardar Dinámico */}
        <div className="flex items-center">
          {activeTab === 'crear' && (
            <button
              onClick={handleSaveBudget}
              disabled={budgetLoading || !selectedProyectoId}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{budgetLoading ? 'Guardando...' : 'Guardar Presupuesto'}</span>
            </button>
          )}
          {activeTab === 'planificacion' && (
            <button
              onClick={handleSaveCronograma}
              disabled={tasksLoading || !selectedProyectoId}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{tasksLoading ? 'Guardando...' : 'Guardar Planificación'}</span>
            </button>
          )}
          {activeTab === 'recursos' && (
            <button
              onClick={handleSaveResources}
              disabled={resourcesLoading || !selectedProyectoId}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{resourcesLoading ? 'Guardando...' : 'Guardar Recursos'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {successMsg && <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold border border-emerald-250 animate-in fade-in duration-150">{successMsg}</div>}
      {errorMsg && <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-semibold border border-red-250 animate-in fade-in duration-150">{errorMsg}</div>}

      {proyectos.length === 0 ? (
        // Mensaje si no hay proyectos
        <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl text-center space-y-4 shadow-xs">
          <p className="text-xs text-slate-500 italic">No has creado ningún proyecto de presupuesto independiente todavía.</p>
          <button
            onClick={() => setShowCreateProjectModal(true)}
            className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary-hover transition cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Crear mi Primer Proyecto</span>
          </button>
        </div>
      ) : (
        // Contenido del Tab Activo
        <div className="space-y-6">
          
          {/* ================= TAB 1: CREAR PRESUPUESTO (PLANILLA EDITABLE) ================= */}
          {activeTab === 'crear' && (
            <div className="space-y-4">
              
              {/* Tarjeta resumen presupuesto */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Costo Presupuestado Total</h4>
                  <p className="text-2xl font-black text-slate-850 mt-1">{formatCLP(totalBudgetCost)}</p>
                </div>
                <button
                  onClick={handleAddBudgetRow}
                  className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-primary" />
                  <span>Añadir Ítem / Partida</span>
                </button>
              </div>

              {/* Grilla de Presupuesto */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-650 font-bold text-[9px] uppercase tracking-wider select-none">
                        <th className="p-3.5 w-24">Código</th>
                        <th className="p-3.5">Concepto / Partida</th>
                        <th className="p-3.5 w-20">Unidad</th>
                        <th className="p-3.5 w-24">Cantidad</th>
                        <th className="p-3.5 w-28">Precio Unit. ($)</th>
                        <th className="p-3.5 w-32">Importe ($)</th>
                        <th className="p-3.5 w-24">Rend. Meta</th>
                        <th className="p-3.5 w-16 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {itemsPresupuesto.map((item) => {
                        const isChapter = isChapterRow(item, itemsPresupuesto);
                        const importeVal = isChapter
                          ? getChapterSum(item.codigo, itemsPresupuesto)
                          : (parseFloat(item.cantidad) || 0) * (parseFloat(item.costo_unitario) || 0);

                        const isIndent = item.codigo && item.codigo.includes('.');

                        return (
                          <tr 
                            key={item.id}
                            className={`transition ${isChapter ? 'bg-slate-50/70 font-bold' : 'hover:bg-slate-50/35'}`}
                          >
                            {/* Código */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.codigo || ''}
                                onChange={(e) => handleUpdateBudgetField(item.id, 'codigo', e.target.value)}
                                placeholder="01.01"
                                className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 ${
                                  isChapter ? 'font-black' : ''
                                }`}
                              />
                            </td>

                            {/* Concepto / Partida */}
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                {isIndent && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />}
                                <input
                                  type="text"
                                  value={item.partida || ''}
                                  onChange={(e) => handleUpdateBudgetField(item.id, 'partida', e.target.value)}
                                  placeholder="ej: Fundación de concreto"
                                  className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 uppercase ${
                                    isChapter ? 'font-extrabold text-slate-900' : 'text-slate-700'
                                  }`}
                                />
                              </div>
                            </td>

                            {/* Unidad */}
                            <td className="p-2">
                              {!isChapter && (
                                <input
                                  type="text"
                                  value={item.unidad || ''}
                                  onChange={(e) => handleUpdateBudgetField(item.id, 'unidad', e.target.value)}
                                  placeholder="m3"
                                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-600 text-center uppercase"
                                />
                              )}
                            </td>

                            {/* Cantidad */}
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

                            {/* Precio Unitario */}
                            <td className="p-2">
                              {!isChapter && (
                                <input
                                  type="number"
                                  step="any"
                                  value={item.costo_unitario ?? ''}
                                  onChange={(e) => handleUpdateBudgetField(item.id, 'costo_unitario', e.target.value)}
                                  placeholder="0"
                                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700"
                                />
                              )}
                            </td>

                            {/* Importe */}
                            <td className="p-3.5 font-bold text-slate-800">
                              {formatCLP(importeVal)}
                            </td>

                            {/* Rendimiento Meta */}
                            <td className="p-2">
                              {!isChapter && (
                                <input
                                  type="number"
                                  step="any"
                                  value={item.rendimiento_meta ?? ''}
                                  onChange={(e) => handleUpdateBudgetField(item.id, 'rendimiento_meta', e.target.value)}
                                  placeholder="0"
                                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-650"
                                />
                              )}
                            </td>

                            {/* Eliminar */}
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleDeleteBudgetRow(item.id)}
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

                {itemsPresupuesto.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    Presupuesto vacío. Comienza agregando partidas.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 2: INGRESAR PRESUPUESTO (CSV IMPORT) ================= */}
          {activeTab === 'ingresar' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Carga Masiva de Presupuestos</h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Ingresa o copia las partidas de presupuesto desde una hoja de cálculo o archivo externo. Formato de carga:
              </p>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-[10px] font-semibold text-slate-500 space-y-2">
                <span className="font-bold text-slate-800 block">Formato requerido:</span>
                <code className="bg-white px-2 py-1 rounded border font-mono block text-slate-800">
                  Código, Concepto, Unidad, Cantidad, CostoUnitario, RendimientoMeta
                </code>
                <span className="font-bold text-slate-850 block mt-2">Ejemplo:</span>
                <code className="bg-white px-2 py-1 rounded border font-mono block text-slate-800 whitespace-pre">
                  01, Obras Preliminares, gl, 1, 500000, 0{"\n"}
                  01.01, Limpieza de Terreno, m2, 450, 1500, 100{"\n"}
                  01.02, Instalación de Faenas, un, 1, 250000, 0
                </code>
              </div>

              <textarea
                rows="8"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Pega las líneas separadas por coma aquí..."
                className="w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-primary font-mono bg-slate-50/50"
              />

              <div className="flex justify-end">
                <button
                  onClick={handleImportCSV}
                  disabled={budgetLoading || !importText.trim()}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition shadow-xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Validar e Importar</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= TAB 3: PLANIFICACIÓN (GANTT & CRONOGRAMA) ================= */}
          {activeTab === 'planificacion' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* Hoja de Tareas (Tabla izquierda) */}
              <div className="xl:col-span-6 space-y-4">
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">Hoja de Planificación</h3>
                    <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">Control de tareas y fechas</p>
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
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[9px] uppercase tracking-wider select-none">
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
                              {/* Código de Tarea */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={task.codigo || ''}
                                  onChange={(e) => handleUpdateCronogramaField(task.id, 'codigo', e.target.value)}
                                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-800 font-bold text-center"
                                />
                              </td>

                              {/* Tarea */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={task.tarea || ''}
                                  onChange={(e) => handleUpdateCronogramaField(task.id, 'tarea', e.target.value)}
                                  placeholder="Nueva Tarea"
                                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-800 uppercase font-semibold"
                                />
                              </td>

                              {/* Inicio */}
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

                              {/* Duración */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={task.duracion ?? ''}
                                  onChange={(e) => handleUpdateCronogramaField(task.id, 'duracion', e.target.value)}
                                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-700 font-bold text-center"
                                />
                              </td>

                              {/* Predecesora */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={task.predecesora || ''}
                                  onChange={(e) => handleUpdateCronogramaField(task.id, 'predecesora', e.target.value)}
                                  placeholder="nº"
                                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-600 text-center font-bold"
                                />
                              </td>

                              {/* Avance (%) */}
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

                              {/* Eliminar */}
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => handleDeleteCronogramaRow(task.id)}
                                  className="p-1 text-red-650 hover:bg-red-50 rounded-lg transition"
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

                  {cronograma.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                      No hay tareas de planificación. Haz clic en "Agregar Tarea" para empezar.
                    </div>
                  )}
                </div>
              </div>

              {/* Diagrama Gantt (Lado derecho) */}
              <div className="xl:col-span-6 space-y-4">
                
                {/* Filtro Escala */}
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

                {/* Gráfico Gantt */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Diagrama Gantt de Cronograma</span>
                    <div className="flex gap-3 text-[9px] font-bold uppercase">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-500 rounded-xs" /> Pendiente</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded-xs" /> En Curso</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-600 rounded-xs" /> Completado</span>
                    </div>
                  </div>

                  <div className="p-4 overflow-x-auto">
                    <div 
                      className="grid border-r border-b border-slate-200 select-none min-w-[700px]"
                      style={{ gridTemplateColumns: `repeat(${ganttScale}, minmax(28px, 1fr))` }}
                    >
                      {/* Cabeceras de Días */}
                      {ganttDays.map((day, idx) => (
                        <div 
                          key={idx}
                          className={`text-center py-2 border-t border-l border-slate-200 flex flex-col justify-center items-center ${
                            day.isWeekend ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-650'
                          }`}
                        >
                          <span className="text-[8px] font-bold uppercase tracking-wider">{day.monthStr}</span>
                          <span className="text-[10px] font-black">{day.dayNum}</span>
                        </div>
                      ))}

                      {/* Barras de Tareas */}
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
                              style={{ gridTemplateColumns: `repeat(${ganttScale}, minmax(28px, 1fr))` }}
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
                                    className={`w-full h-5 ${barColor} text-white rounded-lg flex items-center justify-between px-2 text-[9px] font-black shadow-xs transition-all truncate`}
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

          {/* ================= TAB 4: RECURSOS ================= */}
          {activeTab === 'recursos' && (
            <div className="space-y-4">
              
              {/* Tarjetas resumen de recursos */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                  <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Costo Estimado de Recursos</h4>
                  <p className="text-xl font-black text-slate-850 mt-1">{formatCLP(totalResourceCost)}</p>
                </div>
                <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                  <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Materiales</h4>
                  <p className="text-xl font-bold text-slate-700 mt-1">{formatCLP(materialCost)}</p>
                </div>
                <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                  <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Mano de Obra</h4>
                  <p className="text-xl font-bold text-slate-700 mt-1">{formatCLP(laborCost)}</p>
                </div>
                <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                  <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Maquinaria</h4>
                  <p className="text-xl font-bold text-slate-700 mt-1">{formatCLP(machineryCost)}</p>
                </div>
              </div>

              {/* Botón Añadir Recurso */}
              <div className="flex justify-end">
                <button
                  onClick={handleAddResourceRow}
                  className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-primary" />
                  <span>Añadir Recurso</span>
                </button>
              </div>

              {/* Grilla Recursos */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none">
                        <th className="p-3.5">Nombre Recurso</th>
                        <th className="p-3.5 w-32">Tipo</th>
                        <th className="p-3.5 w-24">Unidad</th>
                        <th className="p-3.5 w-32">Costo Unit. ($)</th>
                        <th className="p-3.5 w-32">Cant. Estimada</th>
                        <th className="p-3.5 w-36">Costo Total ($)</th>
                        <th className="p-3.5 w-16 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {recursos.map((item) => {
                        const totalRow = (parseFloat(item.cantidad_estimada) || 0) * (parseFloat(item.costo_unitario) || 0);

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition">
                            {/* Nombre */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.recurso || ''}
                                onChange={(e) => handleUpdateResourceField(item.id, 'recurso', e.target.value)}
                                placeholder="ej: Cemento Gris"
                                className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 uppercase font-semibold"
                              />
                            </td>

                            {/* Tipo */}
                            <td className="p-2">
                              <select
                                value={item.tipo || 'Material'}
                                onChange={(e) => handleUpdateResourceField(item.id, 'tipo', e.target.value)}
                                className="w-full border-0 bg-transparent focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700"
                              >
                                <option value="Material">Material</option>
                                <option value="Mano de Obra">Mano de Obra</option>
                                <option value="Maquinaria">Maquinaria</option>
                              </select>
                            </td>

                            {/* Unidad */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.unidad || ''}
                                onChange={(e) => handleUpdateResourceField(item.id, 'unidad', e.target.value)}
                                placeholder="bolsas"
                                className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-600 text-center uppercase"
                              />
                            </td>

                            {/* Costo Unitario */}
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

                            {/* Cantidad Estimada */}
                            <td className="p-2">
                              <input
                                type="number"
                                step="any"
                                value={item.cantidad_estimada ?? ''}
                                onChange={(e) => handleUpdateResourceField(item.id, 'cantidad_estimada', e.target.value)}
                                placeholder="0"
                                className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 font-semibold"
                              />
                            </td>

                            {/* Costo Total */}
                            <td className="p-3.5 font-bold text-slate-800">
                              {formatCLP(totalRow)}
                            </td>

                            {/* Eliminar */}
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

                {recursos.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    No se han registrado recursos. Haz clic en "Añadir Recurso" para comenzar.
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}

      {/* ================= MODAL: CREAR NUEVO PROYECTO ================= */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <FolderPlus className="w-4.5 h-4.5 text-primary" />
                <span>Nuevo Proyecto de Presupuesto</span>
              </h3>
              <button 
                onClick={() => setShowCreateProjectModal(false)} 
                className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Nombre del Proyecto</label>
                <input
                  type="text"
                  required
                  value={newProjectData.nombre}
                  onChange={(e) => setNewProjectData({ ...newProjectData, nombre: e.target.value })}
                  placeholder="ej: Edificio Costanera Norte"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary uppercase"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Descripción / Notas</label>
                <textarea
                  rows="3"
                  value={newProjectData.descripcion}
                  onChange={(e) => setNewProjectData({ ...newProjectData, descripcion: e.target.value })}
                  placeholder="ej: Planificación de costos para licitación"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loadingProyectos}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" />
                <span>Crear e Iniciar Presupuesto</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
