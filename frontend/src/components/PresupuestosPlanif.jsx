import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, FileSpreadsheet, Calendar, Plus, Save, Trash2, 
  Layers, Upload, Check, AlertCircle, RefreshCw, LayoutGrid, HelpCircle, 
  ChevronRight, ChevronDown, ListCollapse, ChevronLeft, CalendarDays
} from 'lucide-react';

export default function PresupuestosPlanif({ user, onBack }) {
  const [obras, setObras] = useState([]);
  const [selectedObraName, setSelectedObraName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('presupuesto'); // 'presupuesto' o 'planificacion'

  // Presupuesto (Presto-like Spreadsheet state)
  const [partidas, setPartidas] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(false);
  
  // Planificación (Project-like state)
  const [tareas, setTareas] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Estados generales de respuesta
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Gantt Chart timeframe control (e.g., select start date for Gantt scale)
  const [ganttStartDate, setGanttStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [ganttScale, setGanttScale] = useState(30); // 30 días de escala

  useEffect(() => {
    fetchObras();
  }, []);

  useEffect(() => {
    if (selectedObraName) {
      fetchBudget(selectedObraName);
      fetchTasks(selectedObraName);
    } else {
      setPartidas([]);
      setTareas([]);
    }
  }, [selectedObraName]);

  const fetchObras = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('nombre', { ascending: true });
      
      if (error) throw error;

      // Filtrar según permisos de obras del usuario
      const permisoStr = user.obras ? user.obras.toString().trim().toLowerCase() : '';
      const obrasPermitidasArr = permisoStr.split(',').map(item => item.trim());
      const esTodas = obrasPermitidasArr.includes('todas') || user.rol.toLowerCase() === 'superusuario';

      const filtradas = (data || []).filter(o => {
        if (!o.nombre) return false;
        return esTodas || obrasPermitidasArr.includes(o.nombre.toString().trim().toLowerCase());
      });

      setObras(filtradas);
      if (filtradas.length > 0) {
        setSelectedObraName(filtradas[0].nombre);
      }
    } catch (err) {
      console.error('Error al cargar obras:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBudget = async (obraName) => {
    setBudgetLoading(true);
    try {
      const { data, error } = await supabase
        .from('partidas_obra')
        .select('*')
        .eq('obra_nombre', obraName)
        .order('codigo', { ascending: true });
      if (error) throw error;
      
      // Ordenar de forma natural por código de nivel (ej: 01, 01.01, 01.02, 02...)
      const sorted = (data || []).sort((a, b) => {
        const codA = a.codigo || '';
        const codB = b.codigo || '';
        return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
      });

      setPartidas(sorted);
    } catch (err) {
      console.error('Error cargando presupuesto:', err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  const fetchTasks = async (obraName) => {
    setTasksLoading(true);
    try {
      const { data, error } = await supabase
        .from('planificacion_tareas')
        .select('*')
        .eq('obra_nombre', obraName);
      if (error) throw error;

      const sorted = (data || []).sort((a, b) => {
        const codA = a.codigo || '';
        const codB = b.codigo || '';
        return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
      });

      setTareas(sorted);

      // Si hay tareas, setear el ganttStartDate a la menor fecha de inicio
      if (sorted.length > 0) {
        const startDates = sorted.map(t => t.fecha_inicio).filter(Boolean);
        if (startDates.length > 0) {
          const minDate = startDates.reduce((min, d) => d < min ? d : min, startDates[0]);
          setGanttStartDate(minDate);
        }
      }
    } catch (err) {
      console.error('Error cargando planificación:', err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  // --- MÉTODOS AUXILIARES JERARQUÍA (PRESTO) ---
  const isChapter = (item, list) => {
    if (!item.codigo) return false;
    // Si existe otra fila cuyo código empieza con este código seguido de un punto
    return list.some(other => other.codigo && other.codigo !== item.codigo && other.codigo.startsWith(item.codigo + '.'));
  };

  const getChapterTotal = (chapterCode, list) => {
    // Suma todos los sub-ítems que pertenezcan a este capítulo (y no sean sub-capítulos)
    return list
      .filter(item => {
        if (!item.codigo || item.codigo === chapterCode) return false;
        const starts = item.codigo.startsWith(chapterCode + '.');
        return starts && !isChapter(item, list);
      })
      .reduce((sum, item) => {
        const qty = parseFloat(item.cantidad_presupuestada) || 0;
        const cost = parseFloat(item.costo_por_dia) || 0;
        return sum + (qty * cost);
      }, 0);
  };

  // --- OPERACIONES PRESUPUESTO ---
  const handleAddBudgetRow = () => {
    // Determinar siguiente código tentativo
    let nextCode = '01';
    if (partidas.length > 0) {
      const last = partidas[partidas.length - 1];
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
      obra_nombre: selectedObraName,
      codigo: nextCode,
      partida: 'NUEVA PARTIDA',
      unidad: 'm3',
      cantidad_presupuestada: 0,
      costo_por_dia: 0,
      rendimiento_meta: 0
    };
    setPartidas([...partidas, newRow]);
  };

  const handleUpdateBudgetField = (id, field, value) => {
    setPartidas(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleDeleteBudgetRow = (id) => {
    setPartidas(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveBudget = async () => {
    setBudgetLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Separar registros existentes de los nuevos
      const toUpdate = partidas.filter(p => typeof p.id === 'number');
      const toInsert = partidas
        .filter(p => typeof p.id === 'string' && p.id.startsWith('temp-'))
        .map(p => {
          const { id, ...rest } = p;
          return { ...rest, obra_nombre: selectedObraName };
        });

      // Primero, obtener todos los IDs actuales en la base de datos para este proyecto
      const { data: dbCurrent, error: dbErr } = await supabase
        .from('partidas_obra')
        .select('id')
        .eq('obra_nombre', selectedObraName);

      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      // 1. Eliminar partidas borradas
      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('partidas_obra')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      // 2. Actualizar modificadas
      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from('partidas_obra')
          .update({
            codigo: item.codigo,
            partida: item.partida,
            unidad: item.unidad,
            cantidad_presupuestada: parseFloat(item.cantidad_presupuestada) || 0,
            costo_por_dia: parseFloat(item.costo_por_dia) || 0,
            rendimiento_meta: parseFloat(item.rendimiento_meta) || 0
          })
          .eq('id', item.id);
        if (updErr) throw updErr;
      }

      // 3. Insertar nuevas
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('partidas_obra')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Presupuesto guardado exitosamente en base de datos.');
      fetchBudget(selectedObraName);
    } catch (err) {
      setErrorMsg('Error al guardar presupuesto: ' + err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  // --- OPERACIONES PLANIFICACIÓN (PROJECT-LIKE) ---
  const handleAddPlanningRow = () => {
    let nextCode = '1';
    if (tareas.length > 0) {
      const last = tareas[tareas.length - 1];
      if (last.codigo) {
        const num = parseInt(last.codigo, 10);
        if (!isNaN(num)) nextCode = String(num + 1);
      }
    }

    const newRow = {
      id: 'temp-' + Date.now() + Math.random(),
      obra_nombre: selectedObraName,
      codigo: nextCode,
      tarea: 'Nueva Tarea de Planificación',
      fecha_inicio: new Date().toISOString().split('T')[0],
      duracion: 5,
      fecha_fin: calculateEndDate(new Date().toISOString().split('T')[0], 5),
      predecesora: '',
      porcentaje_avance: 0,
      responsable: '',
      estado: 'Pendiente'
    };
    setTareas([...tareas, newRow]);
  };

  const calculateEndDate = (startDateStr, durationDays) => {
    if (!startDateStr || !durationDays) return '';
    const date = new Date(startDateStr + 'T00:00:00');
    date.setDate(date.getDate() + parseInt(durationDays, 10) - 1); // finaliza el día (inicio + duracion - 1)
    return date.toISOString().split('T')[0];
  };

  const handleUpdatePlanningField = (id, field, value) => {
    setTareas(prev => prev.map(t => {
      if (t.id === id) {
        let updated = { ...t, [field]: value };
        
        // Recalcular fin si cambia inicio o duración
        if (field === 'fecha_inicio' || field === 'duracion') {
          const start = field === 'fecha_inicio' ? value : t.fecha_inicio;
          const dur = field === 'duracion' ? value : t.duracion;
          updated.fecha_fin = calculateEndDate(start, dur);
        }

        // Si se define una predecesora válida, podemos recomendar re-programar
        if (field === 'predecesora' && value) {
          const predTask = tareas.find(x => x.codigo === value.trim());
          if (predTask && predTask.fecha_fin) {
            // Empieza al día siguiente del término de la predecesora
            const pFinishDate = new Date(predTask.fecha_fin + 'T00:00:00');
            pFinishDate.setDate(pFinishDate.getDate() + 1);
            updated.fecha_inicio = pFinishDate.toISOString().split('T')[0];
            updated.fecha_fin = calculateEndDate(updated.fecha_inicio, updated.duracion);
          }
        }

        // Determinar estado basado en avance
        if (field === 'porcentaje_avance') {
          const pct = parseFloat(value) || 0;
          if (pct === 100) updated.estado = 'Completado';
          else if (pct > 0) updated.estado = 'En Progreso';
          else updated.estado = 'Pendiente';
        }

        return updated;
      }
      return t;
    }));
  };

  const handleDeletePlanningRow = (id) => {
    setTareas(prev => prev.filter(t => t.id !== id));
  };

  const handleSavePlanning = async () => {
    setTasksLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const toUpdate = tareas.filter(t => typeof t.id === 'number');
      const toInsert = tareas
        .filter(t => typeof t.id === 'string' && t.id.startsWith('temp-'))
        .map(t => {
          const { id, ...rest } = t;
          return { ...rest, obra_nombre: selectedObraName };
        });

      // Obtener IDs de DB
      const { data: dbCurrent, error: dbErr } = await supabase
        .from('planificacion_tareas')
        .select('id')
        .eq('obra_nombre', selectedObraName);

      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      // 1. Borrar eliminadas
      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('planificacion_tareas')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      // 2. Actualizar
      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from('planificacion_tareas')
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

      // 3. Insertar
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('planificacion_tareas')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Planificación y diagrama Gantt guardados exitosamente.');
      fetchTasks(selectedObraName);
    } catch (err) {
      setErrorMsg('Error al guardar tareas: ' + err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  // --- RENDER CALENDARIO GANTT ---
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

    // Diferencia en días desde el inicio del Gantt
    const diffStart = Math.round((start - base) / (1000 * 60 * 60 * 24));
    const diffEnd = Math.round((end - base) / (1000 * 60 * 60 * 24)) + 1; // inclusivo

    // Si está fuera de los límites de visualización
    if (diffEnd <= 0 || diffStart >= ganttScale) return null;

    const gridStart = Math.max(0, diffStart) + 1; // grid es 1-indexed
    const gridEnd = Math.min(ganttScale, diffEnd) + 1;

    return {
      gridColumnStart: gridStart,
      gridColumnEnd: gridEnd
    };
  };

  // Helpers de formateo
  const formatCLP = (num) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);
  };

  const totalCost = partidas.reduce((acc, curr) => {
    if (isChapter(curr, partidas)) return acc; // No duplicar sumando capítulos
    return acc + ((parseFloat(curr.cantidad_presupuestada) || 0) * (parseFloat(curr.costo_por_dia) || 0));
  }, 0);

  return (
    <div className="space-y-6">
      
      {/* Cabecera Principal con Selector de Obra en la misma línea */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Presupuesto y Planificación</h2>
            <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">Control Financiero (Presto) & Tiempos (MS Project)</p>
          </div>
        </div>

        {/* SELECTOR DE OBRA DIRECTO */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full md:w-auto">
          <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Obra Actual:</span>
          {loading ? (
            <span className="text-xs text-slate-400">Cargando...</span>
          ) : (
            <select
              value={selectedObraName}
              onChange={(e) => setSelectedObraName(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-850 focus:outline-none cursor-pointer uppercase border-0 p-0"
            >
              {obras.map(o => (
                <option key={o.id} value={o.nombre}>{o.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Selector de Pestaña Principal */}
      <div className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-150">
          <button
            onClick={() => setActiveTab('presupuesto')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'presupuesto'
                ? 'bg-white text-primary shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Presupuestos (Presto)</span>
          </button>
          <button
            onClick={() => setActiveTab('planificacion')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'planificacion'
                ? 'bg-white text-primary shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Planificación Gantt (Project)</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'presupuesto' ? (
            <button
              onClick={handleSaveBudget}
              disabled={budgetLoading}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{budgetLoading ? 'Guardando...' : 'Guardar Todo'}</span>
            </button>
          ) : (
            <button
              onClick={handleSavePlanning}
              disabled={tasksLoading}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{tasksLoading ? 'Guardando...' : 'Guardar Planificación'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mensajes de feedback */}
      {successMsg && <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold border border-emerald-250 animate-in fade-in duration-150">{successMsg}</div>}
      {errorMsg && <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-semibold border border-red-250 animate-in fade-in duration-150">{errorMsg}</div>}

      {/* ================= PESTAÑA 1: PRESUPUESTO (ESTILO PRESTO) ================= */}
      {activeTab === 'presupuesto' && (
        <div className="space-y-4">
          
          {/* Tarjeta de Resumen Costo */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Costo Presupuestado Total de la Obra</h4>
              <p className="text-2xl font-black text-slate-850 mt-1">{formatCLP(totalCost)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddBudgetRow}
                className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-primary" />
                <span>Agregar Ítem</span>
              </button>
            </div>
          </div>

          {/* Grilla Presto */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[9px] uppercase tracking-wider select-none">
                    <th className="p-3.5 w-24">Código</th>
                    <th className="p-3.5">Concepto / Partida</th>
                    <th className="p-3.5 w-20">Unidad</th>
                    <th className="p-3.5 w-28">Cantidad</th>
                    <th className="p-3.5 w-32">Costo Unit. ($)</th>
                    <th className="p-3.5 w-36">Importe ($)</th>
                    <th className="p-3.5 w-28">Rend. Meta</th>
                    <th className="p-3.5 w-16 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {partidas.map((item, index) => {
                    const ch = isChapter(item, partidas);
                    const totalVal = ch 
                      ? getChapterTotal(item.codigo, partidas) 
                      : (parseFloat(item.cantidad_presupuestada) || 0) * (parseFloat(item.costo_por_dia) || 0);

                    // Estilo si es capítulo o nivel raíz
                    const isIndent = item.codigo && item.codigo.includes('.');

                    return (
                      <tr 
                        key={item.id} 
                        className={`transition ${
                          ch 
                            ? 'bg-slate-50 font-bold' 
                            : 'hover:bg-slate-50/50'
                        }`}
                      >
                        {/* Código */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.codigo || ''}
                            onChange={(e) => handleUpdateBudgetField(item.id, 'codigo', e.target.value)}
                            placeholder="01.01"
                            className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 ${
                              ch ? 'font-black' : ''
                            }`}
                          />
                        </td>

                        {/* Partida / Concepto */}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            {isIndent && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />}
                            <input
                              type="text"
                              value={item.partida || ''}
                              onChange={(e) => handleUpdateBudgetField(item.id, 'partida', e.target.value)}
                              placeholder="ej: Obras Preliminares"
                              className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 uppercase ${
                                ch ? 'font-extrabold text-slate-900' : 'text-slate-700'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Unidad */}
                        <td className="p-2">
                          {!ch && (
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
                          {!ch && (
                            <input
                              type="number"
                              step="any"
                              value={item.cantidad_presupuestada ?? ''}
                              onChange={(e) => handleUpdateBudgetField(item.id, 'cantidad_presupuestada', e.target.value)}
                              placeholder="0"
                              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 font-semibold"
                            />
                          )}
                        </td>

                        {/* Costo Unitario */}
                        <td className="p-2">
                          {!ch && (
                            <input
                              type="number"
                              step="any"
                              value={item.costo_por_dia ?? ''}
                              onChange={(e) => handleUpdateBudgetField(item.id, 'costo_por_dia', e.target.value)}
                              placeholder="0"
                              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700"
                            />
                          )}
                        </td>

                        {/* Importe (Total) */}
                        <td className="p-3.5 font-bold text-slate-800">
                          {formatCLP(totalVal)}
                        </td>

                        {/* Rendimiento Meta */}
                        <td className="p-2">
                          {!ch && (
                            <input
                              type="number"
                              step="any"
                              value={item.rendimiento_meta ?? ''}
                              onChange={(e) => handleUpdateBudgetField(item.id, 'rendimiento_meta', e.target.value)}
                              placeholder="0"
                              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-600"
                            />
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeleteBudgetRow(item.id)}
                            className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Eliminar Fila"
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

            {partidas.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                Presupuesto en blanco. Haz clic en "Agregar Ítem" para definir la estructura de Presto.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= PESTAÑA 2: PLANIFICACIÓN (ESTILO MS PROJECT) ================= */}
      {activeTab === 'planificacion' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* LADO IZQUIERDO: Hoja de Tareas (Editable, tipo Project) (7 columnas) */}
          <div className="xl:col-span-6 space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex justify-between items-center">
              <div>
                <h3 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">Hoja de Tareas</h3>
                <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">Control de predecesoras y duraciones</p>
              </div>
              <button
                onClick={handleAddPlanningRow}
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
                      <th className="p-3 w-16">Nº</th>
                      <th className="p-3">Nombre Tarea</th>
                      <th className="p-3 w-20">Inicio</th>
                      <th className="p-3 w-16">Dur.</th>
                      <th className="p-3 w-16">Pred.</th>
                      <th className="p-3 w-20">Avance</th>
                      <th className="p-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {tareas.map((task) => {
                      // Validar conflicto de predecesora
                      let alertConflict = false;
                      if (task.predecesora) {
                        const pred = tareas.find(x => x.codigo === task.predecesora.trim());
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
                              onChange={(e) => handleUpdatePlanningField(task.id, 'codigo', e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-800 font-bold text-center"
                            />
                          </td>

                          {/* Nombre de Tarea */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={task.tarea || ''}
                              onChange={(e) => handleUpdatePlanningField(task.id, 'tarea', e.target.value)}
                              placeholder="Nueva Tarea"
                              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-800 uppercase font-semibold"
                            />
                          </td>

                          {/* Fecha Inicio */}
                          <td className="p-2">
                            <div className="relative flex items-center">
                              {alertConflict && (
                                <span className="absolute -left-2.5 text-amber-500" title="Conflicto: Inicia antes de que termine su predecesora">⚠️</span>
                              )}
                              <input
                                type="date"
                                value={task.fecha_inicio || ''}
                                onChange={(e) => handleUpdatePlanningField(task.id, 'fecha_inicio', e.target.value)}
                                className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-[11px] text-slate-700"
                              />
                            </div>
                          </td>

                          {/* Duración */}
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={task.duracion ?? ''}
                              onChange={(e) => handleUpdatePlanningField(task.id, 'duracion', e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-700 font-bold text-center"
                            />
                          </td>

                          {/* Predecesora */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={task.predecesora || ''}
                              onChange={(e) => handleUpdatePlanningField(task.id, 'predecesora', e.target.value)}
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
                              onChange={(e) => handleUpdatePlanningField(task.id, 'porcentaje_avance', e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-slate-700 text-center font-semibold"
                            />
                          </td>

                          {/* Eliminar */}
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleDeletePlanningRow(task.id)}
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
              {tareas.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  Carta Gantt vacía. Haz clic en "Agregar Tarea" para programar.
                </div>
              )}
            </div>
          </div>

          {/* LADO DERECHO: Gantt Chart Escala de Tiempo (MS Project visual) (5 columnas) */}
          <div className="xl:col-span-6 space-y-4">
            
            {/* Controles de visualización del Gantt */}
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

            {/* Panel Gantt */}
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
                  {/* Fila Calendario Header (Días) */}
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

                  {/* Filas de barra Gantt por Tarea */}
                  {tareas.map((task) => {
                    const span = getGanttSpan(task.fecha_inicio, task.fecha_fin);
                    let barColor = 'bg-yellow-500 hover:bg-yellow-600';
                    if (task.estado === 'En Progreso') barColor = 'bg-blue-600 hover:bg-blue-700';
                    else if (task.estado === 'Completado') barColor = 'bg-emerald-600 hover:bg-emerald-700';

                    return (
                      <React.Fragment key={task.id}>
                        {/* Render de la barra de la tarea en la grilla */}
                        <div 
                          className="h-9 relative border-t border-l border-slate-200 flex items-center bg-slate-50/20"
                          style={{ gridColumn: `1 / span ${ganttScale}` }}
                        >
                          {/* El track transparente de fondo para ubicar la barra absoluta */}
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
                                {/* Barra Pintada */}
                                <div 
                                  className={`w-full h-5 ${barColor} text-white rounded-lg flex items-center justify-between px-2 text-[9px] font-black shadow-xs transition-all cursor-pointer truncate`}
                                  title={`${task.tarea}: ${task.fecha_inicio} a ${task.fecha_fin} (${task.duracion} días, Avance: ${task.porcentaje_avance}%)`}
                                >
                                  <span className="truncate uppercase">{task.tarea}</span>
                                  <span>{task.porcentaje_avance}%</span>
                                </div>
                              </div>
                            )}

                            {/* Render de lineas verticales los fines de semana */}
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
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
