import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, FileSpreadsheet, Calendar, Plus, Save, Trash2, Edit3, 
  Layers, Upload, Check, AlertCircle, Play, CheckSquare, Clock, User
} from 'lucide-react';

export default function PresupuestosPlanif({ user, onBack }) {
  const [obras, setObras] = useState([]);
  const [selectedObra, setSelectedObra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('presupuesto'); // 'presupuesto' o 'planificacion'

  // Estados para Presupuesto
  const [partidas, setPartidas] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [newPartida, setNewPartida] = useState({
    partida: '',
    unidad: 'm3',
    cantidad_presupuestada: '',
    costo_por_dia: '',
    rendimiento_meta: ''
  });
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Estados para Planificación
  const [tareas, setTareas] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTarea, setNewTarea] = useState({
    tarea: '',
    fecha_inicio: '',
    fecha_fin: '',
    responsable: '',
    estado: 'Pendiente',
    porcentaje_avance: 0
  });
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // Estados generales de respuesta
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchObras();
  }, []);

  useEffect(() => {
    if (selectedObra) {
      fetchBudget(selectedObra.nombre);
      fetchTasks(selectedObra.nombre);
    }
  }, [selectedObra]);

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
        .order('partida', { ascending: true });
      if (error) throw error;
      setPartidas(data || []);
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
        .eq('obra_nombre', obraName)
        .order('fecha_inicio', { ascending: true });
      if (error) throw error;
      setTareas(data || []);
    } catch (err) {
      console.error('Error cargando planificación:', err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  // --- ACCIONES PRESUPUESTO ---
  const handleAddPartida = async (e) => {
    e.preventDefault();
    if (!newPartida.partida) return;
    setBudgetLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('partidas_obra')
        .insert([
          {
            obra_nombre: selectedObra.nombre,
            partida: newPartida.partida.trim(),
            unidad: newPartida.unidad,
            cantidad_presupuestada: parseFloat(newPartida.cantidad_presupuestada) || 0,
            costo_por_dia: parseFloat(newPartida.costo_por_dia) || 0,
            rendimiento_meta: parseFloat(newPartida.rendimiento_meta) || 0
          }
        ]);

      if (error) throw error;

      setSuccessMsg('Partida añadida con éxito al presupuesto.');
      setNewPartida({
        partida: '',
        unidad: 'm3',
        cantidad_presupuestada: '',
        costo_por_dia: '',
        rendimiento_meta: ''
      });
      fetchBudget(selectedObra.nombre);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleDeletePartida = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta partida del presupuesto?')) return;
    setBudgetLoading(true);
    try {
      const { error } = await supabase
        .from('partidas_obra')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSuccessMsg('Partida eliminada con éxito.');
      fetchBudget(selectedObra.nombre);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleImportCSV = async () => {
    if (!importText.trim()) return;
    setBudgetLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    // Formato esperado: Partida, Unidad, Cantidad, CostoDia, RendimientoMeta
    const lines = importText.split('\n');
    const records = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length < 2) continue; // Al menos nombre y unidad
      
      records.push({
        obra_nombre: selectedObra.nombre,
        partida: parts[0].trim(),
        unidad: parts[1] ? parts[1].trim() : 'un',
        cantidad_presupuestada: parts[2] ? parseFloat(parts[2].trim()) || 0 : 0,
        costo_por_dia: parts[3] ? parseFloat(parts[3].trim()) || 0 : 0,
        rendimiento_meta: parts[4] ? parseFloat(parts[4].trim()) || 0 : 0
      });
    }

    if (records.length === 0) {
      setErrorMsg('No se encontraron registros válidos para importar.');
      setBudgetLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('partidas_obra')
        .insert(records);

      if (error) throw error;

      setSuccessMsg(`Se importaron ${records.length} partidas con éxito.`);
      setImportText('');
      setShowImportModal(false);
      fetchBudget(selectedObra.nombre);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  // --- ACCIONES PLANIFICACIÓN ---
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTarea.tarea || !newTarea.fecha_inicio || !newTarea.fecha_fin) {
      alert("Por favor completa los campos de Tarea, Fecha Inicio y Fecha Fin.");
      return;
    }
    setTasksLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('planificacion_tareas')
        .insert([
          {
            obra_nombre: selectedObra.nombre,
            tarea: newTarea.tarea.trim(),
            fecha_inicio: newTarea.fecha_inicio,
            fecha_fin: newTarea.fecha_fin,
            responsable: newTarea.responsable.trim(),
            porcentaje_avance: parseFloat(newTarea.porcentaje_avance) || 0,
            estado: newTarea.estado
          }
        ]);

      if (error) throw error;

      setSuccessMsg('Tarea planificada con éxito.');
      setNewTarea({
        tarea: '',
        fecha_inicio: '',
        fecha_fin: '',
        responsable: '',
        estado: 'Pendiente',
        porcentaje_avance: 0
      });
      setShowAddTaskModal(false);
      fetchTasks(selectedObra.nombre);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleUpdateTaskProgress = async (id, val) => {
    let estado = 'Pendiente';
    const numVal = parseFloat(val);
    if (numVal === 100) estado = 'Completado';
    else if (numVal > 0) estado = 'En Progreso';

    // Actualizar optimísticamente en el cliente
    setTareas(prev => prev.map(t => t.id === id ? { ...t, porcentaje_avance: numVal, estado } : t));

    try {
      const { error } = await supabase
        .from('planificacion_tareas')
        .update({ porcentaje_avance: numVal, estado })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error al actualizar avance de tarea:', err.message);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta tarea de la planificación?')) return;
    setTasksLoading(true);
    try {
      const { error } = await supabase
        .from('planificacion_tareas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSuccessMsg('Tarea eliminada con éxito.');
      fetchTasks(selectedObra.nombre);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  // Auxiliares de formato financiero
  const formatCLP = (num) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);
  };

  const totalCost = partidas.reduce((acc, curr) => acc + (curr.cantidad_presupuestada * curr.costo_por_dia), 0);

  return (
    <div className="space-y-6">
      
      {!selectedObra ? (
        // ================= VISTA SELECCIÓN PROYECTO =================
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-slate-200 rounded-lg transition cursor-pointer">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Presupuestos y Planificación</h2>
              <p className="text-xs text-slate-500 mt-0.5">Selecciona una obra para ver su presupuesto y planificar sus etapas.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 p-2">⏳ Cargando tus proyectos autorizados...</p>
          ) : obras.length === 0 ? (
            <div className="bg-slate-100 p-8 rounded-3xl text-center text-slate-400 text-xs italic border border-dashed border-slate-250">
              No tienes proyectos autorizados o asignados en esta empresa.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {obras.map((o) => (
                <div
                  key={o.id}
                  onClick={() => setSelectedObra(o)}
                  className="group bg-white border border-slate-250 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden flex items-start gap-4 min-h-[110px]"
                >
                  <div className="absolute top-3 left-3 w-2.5 h-2.5 bg-blue-600 rounded-full border border-white shadow-sm" />
                  <div className="p-3.5 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-white transition-all duration-300 mt-1">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1 pl-1">
                    <h3 className="font-extrabold text-slate-800 text-xs tracking-wide leading-snug group-hover:text-primary transition uppercase line-clamp-2">
                      {o.nombre}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Especialidad: {o.tipo || 'General'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ================= VISTA MÓDULO OBRA SELECCIONADA =================
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Cabecera Obra */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
            <div>
              <button 
                onClick={() => setSelectedObra(null)} 
                className="text-xs text-blue-900 hover:text-blue-700 font-semibold flex items-center gap-1 mb-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a Obras</span>
              </button>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">{selectedObra.nombre}</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Control de Costos y Cronograma de Trabajo</p>
            </div>

            {/* Tab switch */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('presupuesto')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeTab === 'presupuesto'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Presupuesto (Ingresar)</span>
              </button>
              <button
                onClick={() => setActiveTab('planificacion')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeTab === 'planificacion'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Planificar Proyecto (Gantt)</span>
              </button>
            </div>
          </div>

          {/* Mensajes */}
          {successMsg && <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold border border-emerald-250">{successMsg}</div>}
          {errorMsg && <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-semibold border border-red-250">{errorMsg}</div>}

          {activeTab === 'presupuesto' ? (
            // ================= PESTAÑA: PRESUPUESTO =================
            <div className="space-y-6">
              
              {/* Tarjetas resumen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Costo Presupuestado Total</h4>
                  <p className="text-xl font-black text-slate-850 mt-1">{formatCLP(totalCost)}</p>
                </div>
                <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Partidas</h4>
                  <p className="text-xl font-black text-slate-850 mt-1">{partidas.length} items</p>
                </div>
                <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
                  <div>
                    <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Importar Masivo</h4>
                    <p className="text-xs text-slate-500 mt-1">Cargar Excel o CSV</p>
                  </div>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="p-2.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl hover:bg-blue-100 transition cursor-pointer"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Crear/Ingresar Nueva Partida Form */}
              <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-xs space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-primary" />
                  <span>Crear Nuevo Ítems / Ingresar Presupuesto</span>
                </h3>
                <form onSubmit={handleAddPartida} className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Nombre Partida</label>
                    <input
                      type="text"
                      required
                      value={newPartida.partida}
                      onChange={(e) => setNewPartida({ ...newPartida, partida: e.target.value })}
                      placeholder="ej: Excavación de Zanja"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Unidad</label>
                    <select
                      value={newPartida.unidad}
                      onChange={(e) => setNewPartida({ ...newPartida, unidad: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white focus:outline-none"
                    >
                      <option value="m3">m³ (Metros Cúbicos)</option>
                      <option value="m2">m² (Metros Cuadrados)</option>
                      <option value="m">ml (Metros Lineales)</option>
                      <option value="un">un (Unidades)</option>
                      <option value="kg">kg (Kilogramos)</option>
                      <option value="ton">ton (Toneladas)</option>
                      <option value="gl">gl (Global)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Cantidad Presup.</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newPartida.cantidad_presupuestada}
                      onChange={(e) => setNewPartida({ ...newPartida, cantidad_presupuestada: e.target.value })}
                      placeholder="ej: 1500"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Costo Unitario ($/Día o un)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newPartida.costo_por_dia}
                      onChange={(e) => setNewPartida({ ...newPartida, costo_por_dia: e.target.value })}
                      placeholder="ej: 25000"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Rendimiento Meta Diario</label>
                    <input
                      type="number"
                      step="any"
                      value={newPartida.rendimiento_meta}
                      onChange={(e) => setNewPartida({ ...newPartida, rendimiento_meta: e.target.value })}
                      placeholder="ej: 50 (opcional)"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={budgetLoading}
                      className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2 rounded-lg cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5 h-[34px]"
                    >
                      <Save className="w-4 h-4" />
                      <span>Ingresar Partida</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Listado de Partidas */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">Detalle del Presupuesto</h3>
                  <span className="text-[10px] text-slate-455 font-bold uppercase">{partidas.length} partidas registradas</span>
                </div>

                {budgetLoading && partidas.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-500">⏳ Cargando presupuesto...</p>
                ) : partidas.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400 italic">No hay partidas de presupuesto registradas en este proyecto.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                          <th className="p-3">Partida</th>
                          <th className="p-3">Unidad</th>
                          <th className="p-3">Cantidad Presupuestada</th>
                          <th className="p-3">Costo Unitario ($)</th>
                          <th className="p-3">Costo Total ($)</th>
                          <th className="p-3">Rendimiento Meta</th>
                          <th className="p-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {partidas.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-3 font-bold text-slate-800 uppercase">{item.partida}</td>
                            <td className="p-3 text-slate-500 uppercase">{item.unidad}</td>
                            <td className="p-3 font-semibold text-slate-700">{item.cantidad_presupuestada}</td>
                            <td className="p-3 text-slate-700">{formatCLP(item.costo_por_dia)}</td>
                            <td className="p-3 font-bold text-slate-800">
                              {formatCLP(item.cantidad_presupuestada * item.costo_por_dia)}
                            </td>
                            <td className="p-3 text-slate-700">
                              {item.rendimiento_meta ? `${item.rendimiento_meta} ${item.unidad}/día` : 'Sin asignar'}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeletePartida(item.id)}
                                className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg cursor-pointer transition"
                                title="Eliminar partida"
                              >
                                <Trash2 className="w-4 h-4" />
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
          ) : (
            // ================= PESTAÑA: PLANIFICACIÓN (GANTT) =================
            <div className="space-y-6">
              
              {/* Resumen de planificación */}
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">Cronograma de Actividades</h3>
                  <p className="text-[10px] text-slate-500">Avance general de las etapas y hitos de la obra.</p>
                </div>
                <button
                  onClick={() => setShowAddTaskModal(true)}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Tarea</span>
                </button>
              </div>

              {/* Vista Gantt Visual / Lista Tareas */}
              {tasksLoading && tareas.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-500">⏳ Cargando planificación...</p>
              ) : tareas.length === 0 ? (
                <div className="bg-slate-100 p-8 rounded-3xl text-center text-slate-400 text-xs italic border border-dashed border-slate-250">
                  No hay tareas planificadas en esta obra. Haz clic en "Crear Tarea" para comenzar.
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Cronograma visual tipo Gantt */}
                  <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-4">
                    <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>Línea de Tiempo del Proyecto</span>
                    </h4>
                    
                    <div className="space-y-4">
                      {tareas.map((task) => {
                        let barColor = 'bg-yellow-500'; // Pendiente
                        if (task.estado === 'En Progreso') barColor = 'bg-blue-600';
                        else if (task.estado === 'Completado') barColor = 'bg-emerald-600';

                        return (
                          <div key={task.id} className="grid grid-cols-1 md:grid-cols-4 items-center gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                            {/* Información de la tarea */}
                            <div className="md:col-span-1 min-w-0 pr-2">
                              <h5 className="font-bold text-slate-800 text-xs truncate uppercase" title={task.tarea}>{task.tarea}</h5>
                              <div className="flex gap-2 text-[9px] text-slate-400 font-semibold uppercase mt-0.5">
                                <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {task.fecha_inicio} a {task.fecha_fin}</span>
                                {task.responsable && <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> {task.responsable}</span>}
                              </div>
                            </div>

                            {/* Barra de progreso interactiva (Gantt representation) */}
                            <div className="md:col-span-2 space-y-1">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] text-white ${
                                  task.estado === 'Completado' ? 'bg-emerald-600' :
                                  task.estado === 'En Progreso' ? 'bg-blue-600' : 'bg-yellow-500'
                                }`}>
                                  {task.estado}
                                </span>
                                <span className="text-slate-650">{task.porcentaje_avance}% completado</span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {/* Slider interactivo */}
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={task.porcentaje_avance || 0}
                                  onChange={(e) => handleUpdateTaskProgress(task.id, e.target.value)}
                                  className="flex-1 accent-primary cursor-pointer h-1.5 bg-slate-150 rounded-lg appearance-none"
                                />
                                
                                {/* Background progress track representation */}
                                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                  <div 
                                    className={`h-full ${barColor} transition-all duration-300`} 
                                    style={{ width: `${task.porcentaje_avance}%` }} 
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Acciones */}
                            <div className="md:col-span-1 flex justify-end gap-2">
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-2 text-red-650 hover:bg-red-50 rounded-lg cursor-pointer transition"
                                title="Eliminar tarea"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* Modal: Importar Presupuesto Masivo */}
          {showImportModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-primary" />
                    <span>Importar Presupuesto Masivo</span>
                  </h3>
                  <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-500 leading-relaxed">
                    <span className="font-bold text-slate-700 block mb-1">Instrucciones de formato:</span>
                    Copia y pega las partidas separadas por coma, una por línea: <br />
                    <code className="bg-white px-1.5 py-0.5 rounded border text-slate-850 font-mono block mt-1">Nombre Partida, Unidad, CantidadPresup, CostoUnitario, RendimientoMeta</code>
                    <span className="font-semibold text-blue-900 mt-2 block">Ejemplo:</span>
                    <code className="bg-white px-1.5 py-0.5 rounded border text-slate-850 font-mono block mt-0.5 whitespace-pre">
                      Excavaciones, m3, 1200, 15000, 45{"\n"}
                      Hormigones, m3, 850, 45000, 15{"\n"}
                      Enfierradura, kg, 5000, 1200, 150
                    </code>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Datos CSV/Excel</label>
                    <textarea
                      rows="6"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Pega las filas aquí..."
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary font-mono bg-slate-50/50"
                    />
                  </div>

                  <button
                    onClick={handleImportCSV}
                    disabled={budgetLoading}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Cargar e Importar</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Crear Nueva Tarea */}
          {showAddTaskModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>Planificar Nueva Tarea</span>
                  </h3>
                  <button onClick={() => setShowAddTaskModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
                </div>

                <form onSubmit={handleAddTask} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Tarea</label>
                    <input
                      type="text"
                      required
                      value={newTarea.tarea}
                      onChange={(e) => setNewTarea({ ...newTarea, tarea: e.target.value })}
                      placeholder="ej: Fundación del Edificio"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha Inicio</label>
                      <input
                        type="date"
                        required
                        value={newTarea.fecha_inicio}
                        onChange={(e) => setNewTarea({ ...newTarea, fecha_inicio: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha Término</label>
                      <input
                        type="date"
                        required
                        value={newTarea.fecha_fin}
                        onChange={(e) => setNewTarea({ ...newTarea, fecha_fin: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Responsable</label>
                    <input
                      type="text"
                      value={newTarea.responsable}
                      onChange={(e) => setNewTarea({ ...newTarea, responsable: e.target.value })}
                      placeholder="ej: Ing. Gómez"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Estado</label>
                      <select
                        value={newTarea.estado}
                        onChange={(e) => setNewTarea({ ...newTarea, estado: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white"
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Progreso">En Progreso</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Avance (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        required
                        value={newTarea.porcentaje_avance}
                        onChange={(e) => setNewTarea({ ...newTarea, porcentaje_avance: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-850 focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={tasksLoading}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar e Iniciar Planificación</span>
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
