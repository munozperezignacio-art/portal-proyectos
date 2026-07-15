import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Building2, ArrowLeft, Users, Truck, Wrench, FileSpreadsheet, 
  ExternalLink, Calendar, Plus, Info, Check, UserCheck, Play, ArrowRightLeft, FileText, AlertCircle, AlertTriangle 
} from 'lucide-react';

function Obras({ user, onBack, initialObraName }) {
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedObra, setSelectedObra] = useState(null);

  // Si viene una obra preseleccionada por prop, buscarla y marcarla
  useEffect(() => {
    if (initialObraName && obras.length > 0) {
      const matched = obras.find(o => o.nombre.toLowerCase() === initialObraName.toLowerCase());
      if (matched) {
        setSelectedObra(matched);
      }
    }
  }, [initialObraName, obras]);

  const handleBackToProjects = () => {
    if (initialObraName) {
      onBack();
    } else {
      setSelectedObra(null);
    }
  };
  
  // Estados para métricas de la obra seleccionada
  const [personalCount, setPersonalCount] = useState(0);
  const [maquinariaCount, setMaquinariaCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState([]);
  
  // Estados para modales de registro
  const [activeModal, setActiveModal] = useState(null); // 'asistencia', 'avance', 'maquinaria', 'materiales'
  const [modalLoading, setModalLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Estados locales para los formularios
  const [asistenciaData, setAsistenciaData] = useState({ trabajador: '', rut: '', asistencia: 'PRESENTE', ingreso: '08:00', salida: '18:00', colacion: 'SI' });
  const [avanceData, setAvanceData] = useState({ frente: 'Frente A', partida: '', unidad: 'UND', cantidad: '', observaciones: '' });
  const [maqData, setMaqData] = useState({ operador: '', maquinaria: '', horometroEntrada: '', horometroSalida: '', litrosCombustible: '0', horometroCombustible: '0', paralizacion: 'Ninguna', observaciones: '' });
  const [materialData, setMaterialData] = useState({ guia: '', tipoMovimiento: 'INGRESO', material: '', cantidad: '' });

  // Listas desplegables cargadas de la base de datos para la obra
  const [personalList, setPersonalList] = useState([]);
  const [maquinariaList, setMaquinariaList] = useState([]);
  const [partidasList, setPartidasList] = useState([]);

  // Cargar lista de obras
  useEffect(() => {
    fetchObras();
  }, []);

  // Cargar métricas y listas cuando se selecciona una obra
  useEffect(() => {
    if (selectedObra) {
      fetchObraDetails(selectedObra.nombre);
    }
  }, [selectedObra]);

  const fetchObras = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('obras').select('*').order('nombre', { ascending: true });
      if (error) throw error;

      // Filtrar obras según permisos del usuario
      const permisoStr = user.obras ? user.obras.toString().trim().toLowerCase() : '';
      const obrasPermitidasArr = permisoStr.split(',').map(item => item.trim());
      const esTodas = obrasPermitidasArr.includes('todas') || user.rol.toLowerCase() === 'superusuario';

      const filtradas = data.filter(o => {
        if (!o.nombre) return false;
        return esTodas || obrasPermitidasArr.includes(o.nombre.toString().trim().toLowerCase());
      });

      setObras(filtradas);
    } catch (err) {
      console.error('Error cargando obras:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchObraDetails = async (obraNombre) => {
    try {
      // 1. Cargar número de personal asignado
      const { count: countPers } = await supabase
        .from('maestro_personal')
        .select('*', { count: 'exact', head: true })
        .eq('obra_nombre', obraNombre);
      setPersonalCount(countPers || 0);

      // 2. Cargar número de maquinaria asignada
      const { count: countMaq } = await supabase
        .from('inventario_maquinaria')
        .select('*', { count: 'exact', head: true })
        .eq('obra_nombre', obraNombre);
      setMaquinariaCount(countMaq || 0);

      // 3. Cargar listas de ayuda para formularios
      const { data: listPers } = await supabase.from('maestro_personal').select('nombre, rut, cargo').eq('obra_nombre', obraNombre);
      setPersonalList(listPers || []);

      const { data: listMaq } = await supabase.from('inventario_maquinaria').select('tipo, patente, marca').eq('obra_nombre', obraNombre);
      setMaquinariaList(listMaq || []);

      const { data: listPart } = await supabase.from('partidas_obra').select('partida, unidad').eq('obra_nombre', obraNombre);
      setPartidasList(listPart || []);

      // 4. Cargar bitácora de actividad reciente (mezcla de últimos registros)
      const { data: asists } = await supabase.from('asistencia_personal').select('created_at, trabajador, asistencia').eq('obra_nombre', obraNombre).order('created_at', { ascending: false }).limit(3);
      const { data: avances } = await supabase.from('avances_produccion_partidas').select('created_at, partida, cantidad').eq('obra_nombre', obraNombre).order('created_at', { ascending: false }).limit(3);
      
      const combined = [
        ...(asists || []).map(a => ({ type: 'asistencia', date: a.created_at, text: `${a.trabajador} marcado como ${a.asistencia}` })),
        ...(avances || []).map(av => ({ type: 'avance', date: av.created_at, text: `Avance en ${av.partida}: ${av.cantidad} unidades` }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

      setRecentLogs(combined);
    } catch (err) {
      console.error('Error cargando detalles de obra:', err.message);
    }
  };

  // Enviar Asistencia
  const submitAsistencia = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Validar si ya se marcó hoy (en un caso real)
      const { data: insertData, error } = await supabase.from('asistencia_personal').insert([
        {
          obra_nombre: selectedObra.nombre,
          supervisor: user.usuario,
          trabajador: asistenciaData.trabajador,
          rut: asistenciaData.rut,
          asistencia: asistenciaData.asistencia,
          ingreso: asistenciaData.asistencia === 'PRESENTE' ? asistenciaData.ingreso : null,
          salida: asistenciaData.asistencia === 'PRESENTE' ? asistenciaData.salida : null,
          colacion: asistenciaData.asistencia === 'PRESENTE' ? asistenciaData.colacion : null,
          horas_ordinarias: asistenciaData.asistencia === 'PRESENTE' ? 9 : 0 // Cálculo simplificado
        }
      ]);

      if (error) throw error;

      setSuccessMsg(`Asistencia de ${asistenciaData.trabajador} registrada con éxito.`);
      fetchObraDetails(selectedObra.nombre);
      setTimeout(() => setActiveModal(null), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Enviar Avance
  const submitAvance = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.from('avances_produccion_partidas').insert([
        {
          obra_nombre: selectedObra.nombre,
          supervisor: user.usuario,
          frente: avanceData.frente,
          partida: avanceData.partida,
          unidad: avanceData.unidad,
          cantidad: parseFloat(avanceData.cantidad) || 0,
          observaciones: avanceData.observaciones
        }
      ]);

      if (error) throw error;

      setSuccessMsg(`Avance de partida registrada con éxito.`);
      fetchObraDetails(selectedObra.nombre);
      setTimeout(() => setActiveModal(null), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Enviar Uso Maquinaria
  const submitMaquinaria = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.from('reporte_maquinaria').insert([
        {
          obra_nombre: selectedObra.nombre,
          supervisor: user.usuario,
          operador: maqData.operador,
          maquinaria: maqData.maquinaria,
          horometro_entrada: parseFloat(maqData.horometroEntrada) || 0,
          horometro_salida: parseFloat(maqData.horometroSalida) || 0,
          litros_combustible: parseFloat(maqData.litrosCombustible) || 0,
          horometro_combustible: parseFloat(maqData.horometroCombustible) || 0,
          paralizacion: maqData.paralizacion,
          observaciones: maqData.observaciones
        }
      ]);

      if (error) throw error;

      setSuccessMsg(`Parte de maquinaria enviado y guardado con éxito.`);
      fetchObraDetails(selectedObra.nombre);
      setTimeout(() => setActiveModal(null), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Enviar Movimiento Materiales
  const submitMateriales = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.from('inventario_materiales').insert([
        {
          obra_nombre: selectedObra.nombre,
          guia: materialData.guia || 'N/A',
          tipo_movimiento: materialData.tipoMovimiento,
          material: materialData.material,
          cantidad: parseFloat(materialData.cantidad) || 0
        }
      ]);

      if (error) throw error;

      setSuccessMsg(`Movimiento de material registrado con éxito.`);
      fetchObraDetails(selectedObra.nombre);
      setTimeout(() => setActiveModal(null), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Si se selecciona un trabajador, llenar automáticamente su RUT
  const handleTrabajadorSelect = (nombre) => {
    const selected = personalList.find(p => p.nombre === nombre);
    setAsistenciaData({
      ...asistenciaData,
      trabajador: nombre,
      rut: selected ? selected.rut : ''
    });
  };

  // Si se selecciona una partida, llenar su unidad de medida
  const handlePartidaSelect = (partida) => {
    const selected = partidasList.find(p => p.partida === partida);
    setAvanceData({
      ...avanceData,
      partida: partida,
      unidad: selected ? selected.unidad : 'UND'
    });
  };

  return (
    <div className="space-y-4">
      
      {!selectedObra ? (
        // ================= VISTA DE LISTADO DE OBRAS =================
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={onBack} className="p-1.5 hover:bg-slate-200 rounded-lg transition cursor-pointer">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Selecciona un Proyecto</h2>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 p-2">⏳ Cargando tus proyectos autorizados...</p>
          ) : obras.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-center text-sm font-medium">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <span>No se encontraron obras asignadas a tu cuenta. Contacta al administrador.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {obras.map((o) => (
                <div
                  key={o.id}
                  onClick={() => setSelectedObra(o)}
                  className="w-full p-5 bg-white rounded-2xl shadow-sm border border-slate-200 text-left flex justify-between items-center hover:border-blue-600 transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800">{o.nombre}</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Especialidad: {o.tipo || 'N/A'}</p>
                    <p className="text-[9px] text-slate-400">Admin: {o.administrador || 'No asignado'}</p>
                  </div>
                  <span className="text-blue-900 font-bold text-lg">→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ================= VISTA CENTRO DE OBRA (DASHBOARD OBRA) =================
        <div className="space-y-6">
          
          {/* Cabecera */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
              <button 
                onClick={handleBackToProjects} 
                className="text-xs text-blue-900 hover:text-blue-700 font-semibold flex items-center gap-1 mb-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a proyectos</span>
              </button>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">{selectedObra.nombre}</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Especialidad: {selectedObra.tipo || 'General'}</p>
            </div>
            
            {/* Carpeta Drive */}
            {selectedObra.link && (
              <a
                href={selectedObra.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-blue-50 text-[11px] text-blue-900 font-bold px-3 py-2 border border-blue-200 rounded-lg hover:bg-blue-100 transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Planos y Carpetas</span>
              </a>
            )}
          </div>

          {/* Tarjetas de Métricas Rápidas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-950 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dotación Faena</p>
                <p className="text-xl font-black text-slate-800">{personalCount} <span className="text-xs font-normal text-slate-400">personas</span></p>
              </div>
            </div>

            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-950 rounded-lg">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Equipos Activos</p>
                <p className="text-xl font-black text-slate-800">{maquinariaCount} <span className="text-xs font-normal text-slate-400">unidades</span></p>
              </div>
            </div>
          </div>

          {/* Acciones de Operación Diaria */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registros Diarios de Faena</h3>
            
            <div className="grid grid-cols-2 gap-3">
              
              {/* Asistencia */}
              <button
                onClick={() => { setActiveModal('asistencia'); setSuccessMsg(''); setErrorMsg(''); }}
                className="flex items-center gap-2 p-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl hover:shadow-sm transition text-xs font-semibold text-slate-700 text-left cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-blue-900" />
                <span>Asistencia Diario</span>
              </button>

              {/* Avance */}
              <button
                onClick={() => { setActiveModal('avance'); setSuccessMsg(''); setErrorMsg(''); }}
                className="flex items-center gap-2 p-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl hover:shadow-sm transition text-xs font-semibold text-slate-700 text-left cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-900" />
                <span>Avance de Partida</span>
              </button>

              {/* Maquinaria */}
              <button
                onClick={() => { setActiveModal('maquinaria'); setSuccessMsg(''); setErrorMsg(''); }}
                className="flex items-center gap-2 p-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl hover:shadow-sm transition text-xs font-semibold text-slate-700 text-left cursor-pointer"
              >
                <Wrench className="w-4 h-4 text-blue-900" />
                <span>Parte de Equipo</span>
              </button>

              {/* Materiales */}
              <button
                onClick={() => { setActiveModal('materiales'); setSuccessMsg(''); setErrorMsg(''); }}
                className="flex items-center gap-2 p-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl hover:shadow-sm transition text-xs font-semibold text-slate-700 text-left cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4 text-blue-900" />
                <span>Control Materiales</span>
              </button>

            </div>
          </div>

          {/* Historial Reciente */}
          <div className="bg-white p-4 border border-slate-200 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Actividad Reciente (Hoy)</span>
            </h3>
            
            <div className="divide-y divide-slate-100">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">Sin actividad registrada en la fecha actual.</p>
              ) : (
                recentLogs.map((log, idx) => (
                  <div key={idx} className="py-2.5 flex justify-between text-xs">
                    <span className="text-slate-600 font-medium">{log.text}</span>
                    <span className="text-[10px] text-slate-400 font-bold shrink-0">
                      {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ficha Técnica de la Obra */}
          <div className="bg-slate-100 p-4 border border-slate-200 rounded-xl text-xs space-y-2 text-slate-600 font-medium">
            <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">Ficha Técnica Obra</p>
            <p>👷‍♂️ Administrador: <span className="text-slate-800 font-semibold">{selectedObra.administrador || 'Sin asignar'}</span></p>
            <p>📝 Oficina Técnica: <span className="text-slate-800 font-semibold">{selectedObra.oficina_tecnica || 'Sin asignar'}</span></p>
            <p>🦺 Prevencionista: <span className="text-slate-800 font-semibold">{selectedObra.prevencionista || 'Sin asignar'}</span></p>
          </div>

        </div>
      )}

      {/* ================= MODALES DE REGISTRO DIARIO ================= */}

      {/* Modal 1: Asistencia */}
      {activeModal === 'asistencia' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Registro de Asistencia Diaria</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={submitAsistencia} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Trabajador</label>
                <select
                  required
                  value={asistenciaData.trabajador}
                  onChange={(e) => handleTrabajadorSelect(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Selecciona Trabajador --</option>
                  {personalList.map(p => <option key={p.rut || p.nombre} value={p.nombre}>{p.nombre} ({p.cargo})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT</label>
                  <input
                    type="text"
                    disabled
                    value={asistenciaData.rut}
                    className="w-full border border-slate-150 bg-slate-50 rounded-lg p-2.5 text-xs text-slate-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Asistencia</label>
                  <select
                    value={asistenciaData.asistencia}
                    onChange={(e) => setAsistenciaData({ ...asistenciaData, asistencia: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="PRESENTE">Presente</option>
                    <option value="AUSENTE">Ausente</option>
                    <option value="LICENCIA">Licencia médica</option>
                    <option value="VACACIONES">Vacaciones</option>
                  </select>
                </div>
              </div>

              {asistenciaData.asistencia === 'PRESENTE' && (
                <div className="space-y-4 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Hora Ingreso</label>
                      <input
                        type="time"
                        value={asistenciaData.ingreso}
                        onChange={(e) => setAsistenciaData({ ...asistenciaData, ingreso: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Hora Salida</label>
                      <input
                        type="time"
                        value={asistenciaData.salida}
                        onChange={(e) => setAsistenciaData({ ...asistenciaData, salida: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">¿Colación (Almuerzo)?</label>
                    <select
                      value={asistenciaData.colacion}
                      onChange={(e) => setAsistenciaData({ ...asistenciaData, colacion: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="SI">Sí (Descontar 1 hora almuerzo)</option>
                      <option value="NO">No</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70"
              >
                {modalLoading ? 'Guardando...' : 'Registrar Asistencia'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Avance Partida */}
      {activeModal === 'avance' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Registrar Avance Diario de Partida</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={submitAvance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Frente de Trabajo</label>
                <input
                  type="text"
                  required
                  value={avanceData.frente}
                  onChange={(e) => setAvanceData({ ...avanceData, frente: e.target.value })}
                  placeholder="Ej. Frente A, Estructura Sur"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Actividad / Partida</label>
                <select
                  required
                  value={avanceData.partida}
                  onChange={(e) => handlePartidaSelect(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Selecciona Partida --</option>
                  {partidasList.map(p => <option key={p.partida} value={p.partida}>{p.partida}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Unidad</label>
                  <input
                    type="text"
                    disabled
                    value={avanceData.unidad}
                    className="w-full border border-slate-150 bg-slate-50 rounded-lg p-2.5 text-xs text-slate-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cantidad Avance</label>
                  <input
                    type="number"
                    required
                    value={avanceData.cantidad}
                    onChange={(e) => setAvanceData({ ...avanceData, cantidad: e.target.value })}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Observaciones</label>
                <textarea
                  value={avanceData.observaciones}
                  onChange={(e) => setAvanceData({ ...avanceData, observaciones: e.target.value })}
                  placeholder="Comentarios adicionales o incidencias"
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70"
              >
                {modalLoading ? 'Registrando...' : 'Registrar Avance'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Uso Maquinaria */}
      {activeModal === 'maquinaria' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Parte Diario de Maquinaria</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={submitMaquinaria} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Operador</label>
                <select
                  required
                  value={maqData.operador}
                  onChange={(e) => setMaqData({ ...maqData, operador: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                >
                  <option value="">-- Selecciona Operador --</option>
                  {personalList.map(p => <option key={p.rut || p.nombre} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Maquinaria / Equipo</label>
                <select
                  required
                  value={maqData.maquinaria}
                  onChange={(e) => setMaqData({ ...maqData, maquinaria: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                >
                  <option value="">-- Selecciona Equipo --</option>
                  {maquinariaList.map(m => <option key={m.patente} value={`${m.tipo} - ${m.marca}`}>{m.tipo} ({m.patente})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Horómetro Entrada</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={maqData.horometroEntrada}
                    onChange={(e) => setMaqData({ ...maqData, horometroEntrada: e.target.value })}
                    placeholder="0.0"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Horómetro Salida</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={maqData.horometroSalida}
                    onChange={(e) => setMaqData({ ...maqData, horometroSalida: e.target.value })}
                    placeholder="0.0"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Combustible (Lts)</label>
                  <input
                    type="number"
                    value={maqData.litrosCombustible}
                    onChange={(e) => setMaqData({ ...maqData, litrosCombustible: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Horómetro de Carga</label>
                  <input
                    type="number"
                    step="0.1"
                    value={maqData.horometroCombustible}
                    onChange={(e) => setMaqData({ ...maqData, horometroCombustible: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Paralización / Detención</label>
                <input
                  type="text"
                  value={maqData.paralizacion}
                  onChange={(e) => setMaqData({ ...maqData, paralizacion: e.target.value })}
                  placeholder="Ej. Falla mecánica, Lluvia, Ninguna"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70"
              >
                {modalLoading ? 'Enviando...' : 'Enviar Parte de Maquinaria'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Control Materiales */}
      {activeModal === 'materiales' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Registro de Materiales</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={submitMateriales} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Guía / Documento</label>
                  <input
                    type="text"
                    value={materialData.guia}
                    onChange={(e) => setMaterialData({ ...materialData, guia: e.target.value })}
                    placeholder="N/A"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo Movimiento</label>
                  <select
                    value={materialData.tipoMovimiento}
                    onChange={(e) => setMaterialData({ ...materialData, tipoMovimiento: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="INGRESO">Ingreso (Entrada)</option>
                    <option value="USO">Uso / Consumo (Salida)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Material / Insumo</label>
                <input
                  type="text"
                  required
                  value={materialData.material}
                  onChange={(e) => setMaterialData({ ...materialData, material: e.target.value })}
                  placeholder="Ej. Cemento, Fierro 12mm, Combustible"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cantidad</label>
                <input
                  type="number"
                  required
                  value={materialData.cantidad}
                  onChange={(e) => setMaterialData({ ...materialData, cantidad: e.target.value })}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70"
              >
                {modalLoading ? 'Registrando...' : 'Registrar Movimiento'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Obras;
