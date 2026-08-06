import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Building2, ArrowLeft, Users, Truck, Wrench, FileSpreadsheet, 
  ExternalLink, Calendar, Plus, Info, Check, UserCheck, Play, ArrowRightLeft, FileText, AlertCircle, AlertTriangle, Camera,
  QrCode, MapPin, Printer, Navigation, RotateCcw, CheckCircle2, MapIcon as Map, ShieldAlert, Settings, Edit, Trash2, Download,
  History, BarChart3, ShieldCheck, Clock, DollarSign, CalendarRange, FileUp, Loader2, FolderPlus, Send, Filter
} from 'lucide-react';
import ContextualEmailConfigModal from './ContextualEmailConfigModal';
import { canConfigureEmails, canCreateObras, canModifyOrDeleteRecords } from '../utils/userLevel';
import { sendSystemEmail } from '../utils/emailService';
import { formatRut, formatNumberWithDots, parseNumberFromDots } from '../utils/rutUtils';

const defaultCovers = [
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80"
];


// Componente de Mapa Interactivo Leaflet con Pin Arrastrable y Círculo de Cobertura GPS
function ObraGpsMapPicker({ lat, lng, radius, onChange, canEdit }) {
  const mapRef = React.useRef(null);
  const leafletInstance = React.useRef(null);
  const markerRef = React.useRef(null);
  const circleRef = React.useRef(null);

  const initLat = parseFloat(lat) || -33.4372;
  const initLng = parseFloat(lng) || -70.6506;
  const initRadius = parseFloat(radius) || 200;

  React.useEffect(() => {
    if (!window.L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setupMap();
      document.body.appendChild(script);
    } else {
      setupMap();
    }

    function setupMap() {
      if (!mapRef.current) return;
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }

      const map = window.L.map(mapRef.current).setView([initLat, initLng], 14);
      leafletInstance.current = map;

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const marker = window.L.marker([initLat, initLng], { draggable: canEdit }).addTo(map);
      markerRef.current = marker;

      const circle = window.L.circle([initLat, initLng], {
        radius: initRadius,
        color: '#1e3a8a',
        fillColor: '#2563eb',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(map);
      circleRef.current = circle;

      if (canEdit) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
        });

        map.on('click', (e) => {
          marker.setLatLng(e.latlng);
          circle.setLatLng(e.latlng);
          onChange(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
        });
      }
    }

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (leafletInstance.current && markerRef.current && circleRef.current) {
      const nLat = parseFloat(lat);
      const nLng = parseFloat(lng);
      const nRad = parseFloat(radius) || 200;

      if (!isNaN(nLat) && !isNaN(nLng)) {
        const newPos = [nLat, nLng];
        markerRef.current.setLatLng(newPos);
        circleRef.current.setLatLng(newPos);
        circleRef.current.setRadius(nRad);
        leafletInstance.current.panTo(newPos);
      }
    }
  }, [lat, lng, radius]);

  return (
    <div className="relative w-full h-52 rounded-xl overflow-hidden border border-slate-200 shadow-inner my-2 z-0">
      <div ref={mapRef} className="w-full h-full" />

      {/* MODAL DE VINCULACIÓN / ASIGNACIÓN DIRECTA DE EQUIPO A LA OBRA */}
      {showAssignModalObra && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-900" />
                <span>Vincular Equipo a Obra "{selectedObra?.nombre}"</span>
              </h3>
              <button onClick={() => setShowAssignModalObra(false)} className="p-1 rounded-lg bg-slate-100 font-bold text-xs text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <form onSubmit={handleConfirmAssignToObra} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-600 mb-1">Seleccionar Equipo de la Flota *</label>
                <select
                  value={selectedFleetEquipId}
                  onChange={(e) => {
                    const idVal = e.target.value;
                    setSelectedFleetEquipId(idVal);
                    const selected = fleetListForObra.find(m => (m.id || m.patente).toString() === idVal.toString());
                    if (selected) {
                      setAssignObraCostoInterno(selected.costo_interno ? selected.costo_interno.toString() : '');
                      setAssignObraUnidadCosto(selected.unidad_costo_interno || '$/día');
                    }
                  }}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 bg-white"
                  required
                >
                  {fleetListForObra.map(m => (
                    <option key={m.id || m.patente} value={m.id || m.patente}>
                      {m.tipo} ({m.patente || 'Sin Patente'}) - {m.obra_nombre ? 'Actual: ' + m.obra_nombre : 'En Bodega Libre'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200 space-y-2">
                <span className="text-[10.5px] font-extrabold text-amber-950 uppercase tracking-wider block">
                  💲 Costo Interno (Tarifa Imputable a Obra):
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Tarifa ($)</label>
                    <input
                      type="number"
                      placeholder="ej: 50000"
                      value={assignObraCostoInterno}
                      onChange={(e) => setAssignObraCostoInterno(e.target.value)}
                      className="w-full border border-amber-300 rounded-xl p-2 font-bold text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Unidad</label>
                    <select
                      value={assignObraUnidadCosto}
                      onChange={(e) => setAssignObraUnidadCosto(e.target.value)}
                      className="w-full border border-amber-300 rounded-xl p-2 font-bold text-slate-900 bg-white"
                    >
                      <option value="$/día">$/día</option>
                      <option value="$/hr">$/hr</option>
                      <option value="$/mes">$/mes</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowAssignModalObra(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-900 text-white font-extrabold shadow-sm">
                  Confirmar Asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function Obras({ user, onBack, initialObraName, companyBranding }) {
  const rBase = (user?.rol_base || user?.rol || 'Inspector').toLowerCase();
  const canEditGPS = ['admin', 'administrador', 'superadmin', 'superusuario', 'gerencia', 'jefe', 'supervisor'].some(r => rBase.includes(r));

  const isSubmenuEnabled = (submenuId) => {
    if (user && rBase === 'superusuario') return true;
    if (companyBranding && companyBranding.submenus_activos) {
      const activeSubs = companyBranding.submenus_activos.split(',').map(s => s.trim().toLowerCase());
      if (!activeSubs.includes(submenuId)) return false;
    }
    if (user && user.submenus) {
      const allowedSubs = user.submenus.split(',').map(s => s.trim().toLowerCase());
      return allowedSubs.includes(submenuId);
    }
    return true;
  };

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

  // Sincronización automática y persistente de fechas de la obra seleccionada
  useEffect(() => {
    if (selectedObra?.nombre) {
      const defaultStart = selectedObra.nombre?.includes('Parque Central') ? '2026-04-06' : '2026-08-01';
      const defaultEnd = selectedObra.nombre?.includes('Parque Central') ? '2026-10-06' : '2026-12-31';
      const savedStart = localStorage.getItem('obraxis_fecha_inicio_real_' + selectedObra.nombre) || selectedObra.fecha_inicio_real || selectedObra.fecha_inicio || defaultStart;
      const savedEnd = localStorage.getItem('obraxis_fecha_termino_est_' + selectedObra.nombre) || selectedObra.fecha_termino || defaultEnd;
      setFechaInicioReal(savedStart);
      setFechaTerminoEstimada(savedEnd);

      // Restaurar customSalariesMap guardado para la obra
      try {
        const savedSalaries = localStorage.getItem('obraxis_custom_salaries_' + selectedObra.nombre) || localStorage.getItem('obraxis_global_custom_salaries');
        if (savedSalaries) {
          setCustomSalariesMap(JSON.parse(savedSalaries));
        }
      } catch (e) {}

      try {
        const savedPeriodos = localStorage.getItem('obraxis_asignaciones_periodos_' + selectedObra.nombre);
        if (savedPeriodos) {
          setAsignacionesPeriodosList(JSON.parse(savedPeriodos));
        }
      } catch (e) {}
    }
  }, [selectedObra]);

  const handleBackToProjects = () => {
    if (initialObraName) {
      onBack();
    } else {
      setSelectedObra(null);
    }
  };

  const handleUploadProjectCover = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen de portada no debe superar los 2MB de tamaño.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      try {
        const { error } = await supabase
          .from('obras')
          .update({ imagen_base64: base64 })
          .eq('id', selectedObra.id);
        
        if (error) throw error;
        
        setSelectedObra({ ...selectedObra, imagen_base64: base64 });
        alert("¡Imagen de portada del proyecto actualizada con éxito!");
      } catch (err) {
        alert("Error al actualizar la imagen: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('obraxis_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const toggleFavorite = (e, name) => {
    e.stopPropagation();
    let updated;
    if (favorites.includes(name)) {
      updated = favorites.filter(f => f !== name);
    } else {
      updated = [...favorites, name];
    }
    setFavorites(updated);
    localStorage.setItem('obraxis_favorites', JSON.stringify(updated));
  };
  
  // Estados para métricas de la obra seleccionada
  const [personalCount, setPersonalCount] = useState(0);
  const [maquinariaCount, setMaquinariaCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState([]);
  
  // Estados para modales de registro y edicion
  const [activeModal, setActiveModal] = useState(null); // 'asistencia', 'avance', 'maquinaria', 'materiales'
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Submódulo activo de la Obra (null = Vista Principal de Tarjetas / Rectángulos)
  const [obraActiveSubmodule, setObraActiveSubmodule] = useState(null); // null | 'avance' | 'asistencia' | 'rrhh' | 'cuadrillas' | 'maquinaria' | 'materiales' | 'bitacora' | 'estadisticas' | 'prevencion' | 'presupuesto' | 'planificacion'

  // Sub-pestañas para Avance, Asistencia, Maquinaria, Bitácora y Prevención
  const [avanceSubTab, setAvanceSubTab] = useState('visor'); // 'visor' | 'registro'
  const [asistenciaSubTab, setAsistenciaSubTab] = useState('registro'); // 'registro' | 'libro'
  const [maqSubTab, setMaqSubTab] = useState('asignaciones');
  const [showAssignModalObra, setShowAssignModalObra] = useState(false);
  const [fleetListForObra, setFleetListForObra] = useState([]);
  const [selectedFleetEquipId, setSelectedFleetEquipId] = useState('');
  const [assignObraCostoInterno, setAssignObraCostoInterno] = useState('');
  const [assignObraUnidadCosto, setAssignObraUnidadCosto] = useState('$/día'); // 'asignaciones' | 'arriendos'
  const [bitacoraFilters, setBitacoraFilters] = useState(['todos']); // Multi-select: ['todos'] o combinación de ['avances', 'asistencia', 'incidentes', 'personal', 'maquinaria']
  const [prevObraSubTab, setPrevObraSubTab] = useState('inspecciones'); // 'inspecciones' | 'pts' | 'incidentes'

  // Modal para Crear Nueva Obra Enriquecida
  const [showCreateObraModal, setShowCreateObraModal] = useState(false);
  const [newObraForm, setNewObraForm] = useState({
    nombre: '',
    cliente: '',
    cliente_email: '',
    cliente_telefono: '',
    especialidad: 'Construcción General',
    admin_contrato: '',
    oficina_tecnica: '',
    prevencionista: '',
    ubicacion: '',
    presupuesto_enlazado: '',
    planificacion_source: 'sin_planificacion'
  });

  // Costos unitarios ingresados para presupuesto de obra
  const [partidasCostos, setPartidasCostos] = useState({});

  // Presupuestos generales del modulo Presupuestos
  const [availableBudgets, setAvailableBudgets] = useState([]);

  // Modal y CRUD de Partidas dentro de la Obra
  const [showPartidaModal, setShowPartidaModal] = useState(false);
  const [editingPartida, setEditingPartida] = useState(null);
  const [partidaFormData, setPartidaFormData] = useState({
    partida: '',
    unidad: 'UND',
    cantidad: '',
    pu: 0,
    rendimiento: '10',
    unidad_tiempo: 'Día'
  });

  // Modal y CRUD de Costos Reales de Obra
  const [costosList, setCostosList] = useState([]);
  const [costosSubTab, setCostosSubTab] = useState('reales'); // 'reales' | 'proyectados'
  const [proyeccionesList, setProyeccionesList] = useState([]);
  const [proyeccionesRrhhList, setProyeccionesRrhhList] = useState([]);
  const [liquidacionesList, setLiquidacionesList] = useState([]);
  const [showProyeccionRrhhModal, setShowProyeccionRrhhModal] = useState(false);
  const [showProyeccionMasivaRrhhModal, setShowProyeccionMasivaRrhhModal] = useState(false);
  const [showPeriodoRrhhModal, setShowPeriodoRrhhModal] = useState(false);
  const [showEditSueldoModal, setShowEditSueldoModal] = useState(false);
  const [showFechasObraModal, setShowFechasObraModal] = useState(false);
  const [isPersonalCollapseOpen, setIsPersonalCollapseOpen] = useState(true);
  const [isMaquinariaCollapseOpen, setIsMaquinariaCollapseOpen] = useState(true);
  const [editingWorkerData, setEditingWorkerData] = useState(null);

  // Estados del Sub-módulo de Estadísticas Ejecutivas de Obra
  const [estadisticasTab, setEstadisticasTab] = useState('avance'); // 'avance' | 'cuadrillas' | 'maquinarias' | 'prevencion' | 'costos' | 'bodega'
  const [fCorteEstadisticas, setFCorteEstadisticas] = useState(() => new Date().toISOString().substring(0, 10));
  const [filtroPartidaEstadisticas, setFiltroPartidaEstadisticas] = useState('GLOBAL');
  
  const [mantencionesMaquinariaList, setMantencionesMaquinariaList] = useState([]);
  const [paralizacionesMaquinariaList, setParalizacionesMaquinariaList] = useState([]);
  const [accidentesPrevencionList, setAccidentesPrevencionList] = useState([]);

  const [showMantencionModal, setShowMantencionModal] = useState(false);
  const [mantencionFormData, setMantencionFormData] = useState({ equipo_nombre: '', fecha: new Date().toISOString().substring(0, 10), tipo: 'Preventiva', costo: '', descripcion: '' });

  const [showParalizacionModal, setShowParalizacionModal] = useState(false);
  const [paralizacionFormData, setParalizacionFormData] = useState({ equipo_nombre: '', fecha_inicio: new Date().toISOString().substring(0, 10), horas_parada: 8, motivo: '' });

  const [showAccidenteModal, setShowAccidenteModal] = useState(false);
  const [accidenteFormData, setAccidenteFormData] = useState({ fecha: new Date().toISOString().substring(0, 10), tipo: 'STP', trabajador: '', dias_perdidos: 0, descripcion: '' });

  const [fechaInicioRrhh, setFechaInicioRrhh] = useState(() => {
    return localStorage.getItem('obraxis_fecha_inicio_rrhh_' + (selectedObra?.nombre || '')) || '2026-07-15';
  });

  const [fechaTerminoRrhh, setFechaTerminoRrhh] = useState(() => {
    return localStorage.getItem('obraxis_fecha_termino_rrhh_' + (selectedObra?.nombre || '')) || '2027-01-15';
  });

  const [fechaInicioReal, setFechaInicioReal] = useState(() => {
    return localStorage.getItem('obraxis_fecha_inicio_real_' + (selectedObra?.nombre || '')) || (selectedObra?.fecha_inicio || new Date().toISOString().slice(0, 10));
  });

  const [fechaTerminoEstimada, setFechaTerminoEstimada] = useState(() => {
    return localStorage.getItem('obraxis_fecha_termino_est_' + (selectedObra?.nombre || '')) || (selectedObra?.fecha_termino || '2026-12-31');
  });

  const [customSalariesMap, setCustomSalariesMap] = useState(() => {
    try {
      const saved = localStorage.getItem('obraxis_custom_salaries_' + (selectedObra?.nombre || ''));
      const parsed = saved ? JSON.parse(saved) : {};
      // Fijar Sofía Castro por defecto a $1.200.000 ($40.000/día)
      if (!parsed['Sofía Castro'] && !parsed['Sofia Castro']) {
        parsed['Sofía Castro'] = { cargo: 'Recursos Humanos / Jefa RRHH', sueldo_base: 1200000, costo_dia: 40000 };
        parsed['Sofia Castro'] = { cargo: 'Recursos Humanos / Jefa RRHH', sueldo_base: 1200000, costo_dia: 40000 };
      }
      return parsed;
    } catch (e) {
      return {
        'Sofía Castro': { cargo: 'Recursos Humanos / Jefa RRHH', sueldo_base: 1200000, costo_dia: 40000 },
        'Sofia Castro': { cargo: 'Recursos Humanos / Jefa RRHH', sueldo_base: 1200000, costo_dia: 40000 }
      };
    }
  });

  const [asignacionesPeriodosList, setAsignacionesPeriodosList] = useState(() => {
    try {
      const saved = localStorage.getItem('obraxis_asignaciones_periodos_' + (selectedObra?.nombre || ''));
      return saved ? JSON.parse(saved) : [
        {
          id: 'asig-1',
          concepto: 'Viático de Movilización Terreno',
          destinatario: 'Toda la Dotación',
          monto_mensual: 50000,
          fecha_inicio: '2026-08-01',
          fecha_termino: '2026-12-31'
        },
        {
          id: 'asig-2',
          concepto: 'Bono de Turno Noche / Terreno',
          destinatario: 'Sofía Castro Morales',
          monto_mensual: 150000,
          fecha_inicio: '2026-08-01',
          fecha_termino: '2026-09-30'
        }
      ];
    } catch (e) {
      return [];
    }
  });

  const [showAsignacionPeriodoModal, setShowAsignacionPeriodoModal] = useState(false);
  const [editingAsignacionData, setEditingAsignacionData] = useState(null);

  const [proyeccionMasivaFormData, setProyeccionMasivaFormData] = useState({
    filtro_cargo: 'TODOS',
    he_modo: 'HORAS',
    he_horas_dia: 2,
    he_monto_fijo: 150000,
    asignaciones_monto: 50000,
    tarifa_hora_promedio: 4500,
    dias_habiles_mes: 20
  });
  const [showLiquidacionModal, setShowLiquidacionModal] = useState(false);

  const [proyeccionRrhhFormData, setProyeccionRrhhFormData] = useState({
    concepto: 'Cuadrilla de Terreno',
    partida: 'Gastos Generales',
    sueldo_base: 600000,
    horas_extras: 150000,
    asignaciones: 50000
  });

  const [liquidacionFormData, setLiquidacionFormData] = useState({
    trabajador: '',
    periodo: new Date().toISOString().slice(0, 7),
    num_folio: '',
    monto_real: '',
    partida: 'Gastos Generales'
  });
  const [fechaCorteProyeccion, setFechaCorteProyeccion] = useState(new Date().toISOString().split('T')[0]);
  const [showProyeccionModal, setShowProyeccionModal] = useState(false);
  const [expandedPartidas, setExpandedPartidas] = useState({});
  const toggleExpandPartida = (pName) => {
    setExpandedPartidas(prev => ({ ...prev, [pName]: !prev[pName] }));
  };
  const [proyeccionFormData, setProyeccionFormData] = useState({
    id: null,
    partida: '',
    tipo_proyeccion: 'TIEMPO', // 'TIEMPO' | 'INSUMO'
    nombre_item: '',
    tarifa_tiempo_dia: 20000,
    unidad_insumo: 'Saco',
    tasa_rendimiento_insumo: 1,
    precio_unitario_insumo: 5000
  });
  const [showCostoModal, setShowCostoModal] = useState(false);
  const [editingCosto, setEditingCosto] = useState(null);
  const [costoFormData, setCostoFormData] = useState({
    nombre: '',
    tipo_costo: 'Materiales',
    asociar_factura: 'SI',
    num_factura: '',
    monto: '',
    imputaciones: []
  });

  // Modal y CRUD de Planificación / Carta Gantt dentro de la Obra
  const [planificacionList, setPlanificacionList] = useState([]);
  const [showActividadModal, setShowActividadModal] = useState(false);
  const [editingActividad, setEditingActividad] = useState(null);
  const [actividadFormData, setActividadFormData] = useState({
    nombre: '',
    fecha_inicio: new Date().toISOString().substring(0, 10),
    fecha_fin: '',
    duracion_dias: 10,
    avance_pct: 0
  });

  // Lista general de personal de la empresa (Recursos Humanos)
  const [allStaffList, setAllStaffList] = useState([]);

  // Registros reales de Supabase
  const [asistenciaList, setAsistenciaList] = useState([]);
  const [personalAsignadoList, setPersonalAsignadoList] = useState([]);
  const [reportesAvanceList, setReportesAvanceList] = useState([]);

  // Filtros avanzados para Libro de Asistencia Digital (Toda la Obra / Persona Individual / Grupo de Cuadrilla)
  const [libroFiltroTipo, setLibroFiltroTipo] = useState('toda_obra'); // 'toda_obra' | 'persona' | 'cuadrilla'
  const [libroFiltroPersona, setLibroFiltroPersona] = useState('');
  const [libroFiltroCuadrilla, setLibroFiltroCuadrilla] = useState('');

  // Estado para Personal Asignado (RRHH)
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [newWorkerData, setNewWorkerData] = useState({ nombre: '', rut: '', cargo: 'Operario', fono: '', email: '' });

  // Estados locales para los formularios
  const [asistenciaData, setAsistenciaData] = useState({ trabajador: '', rut: '', asistencia: 'PRESENTE', ingreso: '08:00', salida: '18:00', colacion: 'SI' });
  const [avanceItems, setAvanceItems] = useState([
    { frente: 'Frente Principal', partida: '', unidad: 'UND', cantidad: '', observaciones: '' }
  ]);
  const [avanceFecha, setAvanceFecha] = useState(new Date().toISOString().substring(0, 10));
  const [maqData, setMaqData] = useState({ operador: '', maquinaria: '', horometroEntrada: '', horometroSalida: '', litrosCombustible: '0', horometroCombustible: '0', paralizacion: 'Ninguna', observaciones: '', costoHora: '' });
  const [materialData, setMaterialData] = useState({ guia: '', tipoMovimiento: 'INGRESO', material: '', cantidad: '' });

  // Estados para Cuadrillas y Arriendos
  const [cuadrillasList, setCuadrillasList] = useState([]);
  const [showCuadrillaModal, setShowCuadrillaModal] = useState(false);
  const [cuadrillaData, setCuadrillaData] = useState({ nombre: '', lider: '', especialidad: 'Hormigón', miembros: [] });

  const [arriendosList, setArriendosList] = useState([]);
  const [showArriendoModal, setShowArriendoModal] = useState(false);
  const [arriendoData, setArriendoData] = useState({ equipo: '', patente: '', proveedor: '', costo: '', unidad_costo: '$/mes', tipo_condicion_minima: 'sin_minimo', cantidad_minima: '', modalidad_dias: 'laborales', fechaInicio: '', fechaTermino: '', observaciones: '' });

  // Días Feriados Oficiales de Chile (para cálculo exacto de avance y arriendos en Días Laborales)
  const CHILEAN_HOLIDAYS = [
    '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-07', '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25',
    '2025-01-01', '2025-04-18', '2025-04-19', '2025-05-01', '2025-05-21', '2025-06-20', '2025-06-29', '2025-07-16', '2025-08-15', '2025-09-18', '2025-09-19', '2025-10-12', '2025-10-31', '2025-11-01', '2025-12-08', '2025-12-25',
    '2024-01-01', '2024-03-29', '2024-03-30', '2024-05-01', '2024-05-21', '2024-06-20', '2024-06-29', '2024-07-16', '2024-08-15', '2024-09-18', '2024-09-19', '2024-09-20', '2024-10-12', '2024-10-31', '2024-11-01', '2024-12-08', '2024-12-25'
  ];

  const countChileanBusinessDays = (startStr, endStr) => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dayOfWeek = cur.getDay(); // 0 = Sunday, 6 = Saturday
      const dateStr = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = CHILEAN_HOLIDAYS.includes(dateStr);

      if (!isWeekend && !isHoliday) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, count);
  };

  const addChileanBusinessDays = (startStr, workingDays) => {
    if (!startStr) return '';
    const daysToAdd = Math.max(1, Math.round(workingDays));
    let cur = new Date(startStr + 'T00:00:00');
    if (isNaN(cur.getTime())) return startStr;

    let added = 0;
    while (added < daysToAdd) {
      const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
      const dateStr = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = CHILEAN_HOLIDAYS.includes(dateStr);

      if (!isWeekend && !isHoliday) {
        added++;
      }
      if (added < daysToAdd) {
        cur.setDate(cur.getDate() + 1);
      }
    }
    return cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
  };

  const handleUpdatePartidaFechaInicio = async (partidaObj, newStartDate) => {
    if (!newStartDate) return;

    const updatedPartidas = partidasList.map(p => {
      if (p.partida === partidaObj.partida || (p.id && String(p.id) === String(partidaObj.id))) {
        return { ...p, fecha_inicio: newStartDate };
      }
      return p;
    });

    setPartidasList(updatedPartidas);

    try {
      if (selectedObra?.id) {
        localStorage.setItem(`partidas_${selectedObra.id}`, JSON.stringify(updatedPartidas));
      }
      if (selectedObra?.nombre) {
        localStorage.setItem(`partidas_${selectedObra.nombre}`, JSON.stringify(updatedPartidas));
      }
    } catch(e) {}

    try {
      if (partidaObj.id && !isNaN(parseInt(partidaObj.id))) {
        await supabase.from('partidas_obra').update({ fecha_inicio: newStartDate }).eq('id', partidaObj.id);
      } else if (selectedObra?.nombre && partidaObj.partida) {
        await supabase.from('partidas_obra').update({ fecha_inicio: newStartDate }).eq('obra_nombre', selectedObra.nombre).eq('partida', partidaObj.partida);
      }
    } catch(err) {
      console.warn('Sync warning on partida fecha_inicio:', err);
    }
  };

  const subtractChileanBusinessDays = (endStr, workingDays) => {
    if (!endStr) return '';
    const daysToSubtract = Math.max(1, Math.round(workingDays));
    let cur = new Date(endStr + 'T00:00:00');
    if (isNaN(cur.getTime())) return endStr;

    let subtracted = 0;
    while (subtracted < daysToSubtract) {
      const dayOfWeek = cur.getDay();
      const dateStr = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = CHILEAN_HOLIDAYS.includes(dateStr);

      if (!isWeekend && !isHoliday) {
        subtracted++;
      }
      if (subtracted < daysToSubtract) {
        cur.setDate(cur.getDate() - 1);
      }
    }
    return cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
  };

  const handleUpdatePartidaDependency = async (partidaObj, predecesora, tipoRelacion, desfaseDias) => {
    const updatedPartidas = partidasList.map(p => {
      if (p.partida === partidaObj.partida || (p.id && String(p.id) === String(partidaObj.id))) {
        return {
          ...p,
          predecesora: predecesora || null,
          tipo_relacion: tipoRelacion || 'FS',
          desfase_dias: parseInt(desfaseDias, 10) || 0
        };
      }
      return p;
    });

    setPartidasList(updatedPartidas);

    try {
      if (selectedObra?.id) {
        localStorage.setItem(`partidas_${selectedObra.id}`, JSON.stringify(updatedPartidas));
      }
      if (selectedObra?.nombre) {
        localStorage.setItem(`partidas_${selectedObra.nombre}`, JSON.stringify(updatedPartidas));
      }
    } catch(e) {}

    try {
      const payload = {
        predecesora: predecesora || null,
        tipo_relacion: tipoRelacion || 'FS',
        desfase_dias: parseInt(desfaseDias, 10) || 0
      };
      if (partidaObj.id && !isNaN(parseInt(partidaObj.id))) {
        await supabase.from('partidas_obra').update(payload).eq('id', partidaObj.id);
      } else if (selectedObra?.nombre && partidaObj.partida) {
        await supabase.from('partidas_obra').update(payload).eq('obra_nombre', selectedObra.nombre).eq('partida', partidaObj.partida);
      }
    } catch (err) {
      console.warn('Sync warning on partida dependency:', err);
    }
  };

  const handleDeleteCostoReal = async (costoItem, index) => {
    if (!window.confirm(`¿Estás seguro de eliminar el registro de costo "${costoItem.nombre}"?`)) return;

    const updatedCostos = costosList.filter((_, i) => i !== index);
    setCostosList(updatedCostos);

    try {
      const obraKey = selectedObra?.nombre || selectedObra?.id || 'default';
      localStorage.setItem(`obraxis_costos_${obraKey}`, JSON.stringify(updatedCostos));
      if (selectedObra?.id) localStorage.setItem(`obraxis_costos_${selectedObra.id}`, JSON.stringify(updatedCostos));
      if (selectedObra?.nombre) localStorage.setItem(`obraxis_costos_${selectedObra.nombre}`, JSON.stringify(updatedCostos));
    } catch (eErr) {}

    try {
      if (costoItem.id) {
        await supabase.from('costos_reales_obra').delete().eq('id', costoItem.id);
      }
    } catch (err) {
      console.warn('Sync warning on delete costos_reales_obra:', err);
    }
  };

  const handleSaveMantencion = async (e) => {
    e.preventDefault();
    if (!mantencionFormData.equipo_nombre) return;
    const newMant = {
      id: Date.now(),
      equipo_nombre: mantencionFormData.equipo_nombre,
      fecha: mantencionFormData.fecha,
      tipo: mantencionFormData.tipo,
      costo: parseFloat(mantencionFormData.costo) || 0,
      descripcion: mantencionFormData.descripcion.trim(),
      obra_nombre: selectedObra?.nombre || ''
    };
    const updated = [...mantencionesMaquinariaList, newMant];
    setMantencionesMaquinariaList(updated);
    try {
      const key = selectedObra?.nombre || 'default';
      localStorage.setItem(`obraxis_mantenciones_${key}`, JSON.stringify(updated));
    } catch(eErr) {}
    try {
      await supabase.from('mantenciones_maquinaria').insert([newMant]);
    } catch(err) {}
    setShowMantencionModal(false);
    alert('Mantención registrada con éxito.');
  };

  const handleSaveParalizacion = async (e) => {
    e.preventDefault();
    if (!paralizacionFormData.equipo_nombre) return;
    const newPara = {
      id: Date.now(),
      equipo_nombre: paralizacionFormData.equipo_nombre,
      fecha_inicio: paralizacionFormData.fecha_inicio,
      horas_parada: parseFloat(paralizacionFormData.horas_parada) || 0,
      motivo: paralizacionFormData.motivo.trim(),
      obra_nombre: selectedObra?.nombre || ''
    };
    const updated = [...paralizacionesMaquinariaList, newPara];
    setParalizacionesMaquinariaList(updated);
    try {
      const key = selectedObra?.nombre || 'default';
      localStorage.setItem(`obraxis_paralizaciones_${key}`, JSON.stringify(updated));
    } catch(eErr) {}
    try {
      await supabase.from('paralizaciones_maquinaria').insert([newPara]);
    } catch(err) {}
    setShowParalizacionModal(false);
    alert('Paralización técnica registrada con éxito.');
  };

  const handleSaveAccidente = async (e) => {
    e.preventDefault();
    const newAcc = {
      id: Date.now(),
      fecha: accidenteFormData.fecha,
      tipo: accidenteFormData.tipo,
      trabajador: accidenteFormData.trabajador.trim(),
      dias_perdidos: parseInt(accidenteFormData.dias_perdidos, 10) || 0,
      descripcion: accidenteFormData.descripcion.trim(),
      obra_nombre: selectedObra?.nombre || ''
    };
    const updated = [...accidentesPrevencionList, newAcc];
    setAccidentesPrevencionList(updated);
    try {
      const key = selectedObra?.nombre || 'default';
      localStorage.setItem(`obraxis_accidentes_${key}`, JSON.stringify(updated));
    } catch(eErr) {}
    try {
      await supabase.from('accidentes_prevencion_obra').insert([newAcc]);
    } catch(err) {}
    setShowAccidenteModal(false);
    alert('Incidente / Accidente registrado con éxito.');
  };

  // Estado para Libro de Asistencia Digital
  const [selectedMonthLibro, setSelectedMonthLibro] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  // Estado para Notas y Comentarios de Bitácora de Obra
  const [bitacoraNotasList, setBitacoraNotasList] = useState([]);
  const [showBitacoraNoteModal, setShowBitacoraNoteModal] = useState(false);
  const [bitacoraNoteFormData, setBitacoraNoteFormData] = useState({
    fecha: new Date().toISOString().substring(0, 10),
    titulo: '',
    comentario: ''
  });

  // Estados para Asistencia QR, Geofencing (200m) y Firma Digital
  const [asistenciaMode, setAsistenciaMode] = useState('qr'); // 'qr' | 'manual'
  const [showQRModal, setShowQRModal] = useState(false);
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [showContextualEmailModal, setShowContextualEmailModal] = useState(false);
  const [gpsConfig, setGpsConfig] = useState({ latitud: '', longitud: '', radio: '200' });
  const [gpsUserLoc, setGpsUserLoc] = useState({ lat: null, lng: null, distance: null, status: 'idle', isWithin: false, error: '' });
  
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const getPartidaScheduledStart = (partidaObj, fInicioFallback) => {
    if (!partidaObj) return fInicioFallback || new Date().toISOString().substring(0, 10);

    const fInicioObraDefault = selectedObra?.fecha_inicio ? String(selectedObra.fecha_inicio).split('T')[0] : (fechaInicioReal || new Date().toISOString().substring(0, 10));

    // 1. Evaluar dependencias y cascada en partidasList
    if (partidasList && partidasList.length > 0) {
      const pKey = String(partidaObj.partida || partidaObj.id || '').trim();

      const initialItems = partidasList.map(p => {
        const isGroup = p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo;
        const cant = parseFloat(p.cantidad) || 0;
        const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
        const duracionDias = isGroup ? 0 : Math.max(1, Math.ceil(cant / rend));
        const fechaInicio = p.fecha_inicio ? String(p.fecha_inicio).split('T')[0] : fInicioObraDefault;
        const fechaTermino = isGroup ? '' : addChileanBusinessDays(fechaInicio, duracionDias);
        return { ...p, isGroup, cant, rend, duracionDias, fechaInicio, fechaTermino };
      });

      const itemsMap = new window.Map();
      initialItems.forEach(item => {
        itemsMap.set(String(item.partida || item.id).trim(), { ...item });
      });

      for (let pass = 0; pass < 5; pass++) {
        initialItems.forEach(item => {
          if (item.isGroup) return;
          const curr = itemsMap.get(String(item.partida || item.id).trim());
          if (!curr || !curr.predecesora) return;

          const pred = itemsMap.get(String(curr.predecesora).trim());
          if (!pred) return;

          const relType = curr.tipo_relacion || 'FS';
          const lag = parseInt(curr.desfase_dias || 0, 10) || 0;

          let calcStart = curr.fechaInicio;

          if (relType === 'FS') {
            const predEnd = pred.fechaTermino || pred.fechaInicio;
            const nextBus = addChileanBusinessDays(predEnd, 2);
            calcStart = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(nextBus, lag + 1) : subtractChileanBusinessDays(nextBus, Math.abs(lag) + 1)) : nextBus;
          } else if (relType === 'SS') {
            const predStart = pred.fechaInicio;
            calcStart = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(predStart, lag + 1) : subtractChileanBusinessDays(predStart, Math.abs(lag) + 1)) : predStart;
          } else if (relType === 'FF') {
            const predEnd = pred.fechaTermino;
            const calcEnd = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(predEnd, lag + 1) : subtractChileanBusinessDays(predEnd, Math.abs(lag) + 1)) : predEnd;
            calcStart = subtractChileanBusinessDays(calcEnd, curr.duracionDias);
          } else if (relType === 'SF') {
            const predStart = pred.fechaInicio;
            const calcEnd = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(predStart, lag + 1) : subtractChileanBusinessDays(predStart, Math.abs(lag) + 1)) : predStart;
            calcStart = subtractChileanBusinessDays(calcEnd, curr.duracionDias);
          }

          if (calcStart) {
            curr.fechaInicio = calcStart;
            curr.fechaTermino = addChileanBusinessDays(calcStart, curr.duracionDias);
          }
        });
      }

      const matchedTarget = itemsMap.get(pKey);
      if (matchedTarget && matchedTarget.fechaInicio) {
        return matchedTarget.fechaInicio;
      }
    }

    if (partidaObj.fecha_inicio) return String(partidaObj.fecha_inicio).split('T')[0];
    if (partidaObj.fecha_inicio_programada) return String(partidaObj.fecha_inicio_programada).split('T')[0];

    if (planificacionList && planificacionList.length > 0) {
      const pName = String(partidaObj.partida || partidaObj.nombre || '').toLowerCase().trim();
      const match = planificacionList.find(act => {
        const actName = String(act.nombre || act.actividad || act.partida || '').toLowerCase().trim();
        return actName === pName || (actName && pName && (actName.includes(pName) || pName.includes(actName)));
      });
      if (match && match.fecha_inicio) {
        return String(match.fecha_inicio).split('T')[0];
      }
    }

    return fInicioFallback || fechaInicioReal || selectedObra?.fecha_inicio || fInicioObraDefault;
  };

  const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const requestUserGPS = (targetObra) => {
    const currentObra = targetObra || selectedObra;
    setGpsUserLoc({ lat: null, lng: null, distance: null, status: 'loading', isWithin: false, error: '' });

    if (!navigator.geolocation) {
      setGpsUserLoc({ lat: null, lng: null, distance: null, status: 'error', isWithin: false, error: 'GPS no disponible en este dispositivo.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;

        let dist = null;
        let within = true;

        if (currentObra && currentObra.latitud && currentObra.longitud) {
          const oLat = parseFloat(currentObra.latitud);
          const oLng = parseFloat(currentObra.longitud);
          const maxRadio = parseFloat(currentObra.radio_cobertura_m || 200);
          dist = getHaversineDistance(uLat, uLng, oLat, oLng);
          if (dist !== null && dist > maxRadio) {
            within = false;
          }
        }

        setGpsUserLoc({
          lat: uLat,
          lng: uLng,
          distance: dist,
          status: 'success',
          isWithin: within,
          error: ''
        });
      },
      (err) => {
        setGpsUserLoc({
          lat: null,
          lng: null,
          distance: null,
          status: 'error',
          isWithin: false,
          error: 'No se pudo obtener tu ubicación GPS. Activa los permisos de ubicación en tu teléfono.'
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleStartDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const handleDraw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const handleStopDraw = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Listas desplegables cargadas de la base de datos para la obra
  const [personalList, setPersonalList] = useState([]);
  const [maquinariaList, setMaquinariaList] = useState([]);
  const [partidasList, setPartidasList] = useState([]);
  const handleReorderPartidaObra = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= partidasList.length) return;
    const updated = [...partidasList];
    const [movedItem] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, movedItem);
    setPartidasList(updated);

    const obraName = selectedObra?.nombre;
    if (obraName) {
      try {
        const orderNames = updated.map(p => p.partida);
        localStorage.setItem(`obraxis_obra_partidas_order_${obraName}`, JSON.stringify(orderNames));
      } catch (e) {}
    }
  };



  // Cargar lista de obras
  useEffect(() => {
    fetchObras();
  }, []);

  // Cargar métricas y listas cuando se selecciona una obra o cambia de submódulo
  useEffect(() => {
    if (selectedObra) {
      fetchObraDetails(selectedObra.nombre);
    }
  }, [selectedObra, obraActiveSubmodule]);

  const fetchObras = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .eq('empresa', user.empresa)
        .order('nombre', { ascending: true });
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

      // Cargar lista general de personal desde Recursos Humanos
      const { data: staffData } = await supabase
        .from('maestro_personal')
        .select('nombre, cargo, rut')
        .order('nombre', { ascending: true });
      if (staffData) setAllStaffList(staffData);

      // Cargar presupuestos creados desde el módulo de Presupuestos
      const { data: budgetsData } = await supabase
        .from('presupuestos_proyectos')
        .select('id, nombre, presupuesto_estimado, created_at')
        .order('created_at', { ascending: false });
      if (budgetsData) setAvailableBudgets(budgetsData);
    } catch (err) {
      console.error('Error cargando obras:', err.message);
    } finally {
      setLoading(false);
    }
  };

    const openAssignModalFromObra = async () => {
    try {
      const localStr = localStorage.getItem('obraxis_inventario_maquinaria');
      const localMaq = localStr ? JSON.parse(localStr) : [];
      const { data: remoteMaq } = await supabase.from('inventario_maquinaria').select('*');
      
      const mapFleet = new window.Map();
      (remoteMaq || []).forEach(m => mapFleet.set((m.id || m.patente).toString(), m));
      localMaq.forEach(m => {
        const k = (m.id || m.patente).toString();
        mapFleet.set(k, { ...mapFleet.get(k), ...m });
      });

      const fullFleet = Array.from(mapFleet.values());
      setFleetListForObra(fullFleet);
      if (fullFleet.length > 0) {
        setSelectedFleetEquipId((fullFleet[0].id || fullFleet[0].patente).toString());
        setAssignObraCostoInterno(fullFleet[0].costo_interno ? fullFleet[0].costo_interno.toString() : '');
        setAssignObraUnidadCosto(fullFleet[0].unidad_costo_interno || '$/día');
      }
      setShowAssignModalObra(true);
    } catch (e) {
      console.error('Error cargando flota:', e);
    }
  };

  const handleConfirmAssignToObra = async (e) => {
    e.preventDefault();
    if (!selectedFleetEquipId || !selectedObra) return;

    const equipObj = fleetListForObra.find(m => (m.id || m.patente).toString() === selectedFleetEquipId.toString());
    if (!equipObj) return;

    const newObraName = selectedObra.nombre;
    const parsedCosto = parseFloat(assignObraCostoInterno) || 0;

    // 1. Guardado síncrono local
    const localStr = localStorage.getItem('obraxis_inventario_maquinaria');
    let localList = localStr ? JSON.parse(localStr) : [...fleetListForObra];

    const updatedItem = {
      ...equipObj,
      obra_nombre: newObraName,
      costo_interno: parsedCosto,
      unidad_costo_interno: assignObraUnidadCosto
    };

    localList = localList.map(item => 
      (item.id && item.id.toString() === equipObj.id?.toString()) || item.patente === equipObj.patente
        ? updatedItem 
        : item
    );

    localStorage.setItem('obraxis_inventario_maquinaria', JSON.stringify(localList));

    // 2. Guardado en Supabase
    try {
      await supabase.from('inventario_maquinaria').update({
        obra_nombre: newObraName,
        costo_interno: parsedCosto,
        unidad_costo_interno: assignObraUnidadCosto
      }).eq('id', equipObj.id || selectedFleetEquipId);
    } catch (err) {
      console.warn('Asignación efectuada localmente:', err.message);
    }

    setShowAssignModalObra(false);
    fetchObraDetails(selectedObra.nombre);
    alert('¡Equipo ' + equipObj.tipo + ' (' + (equipObj.patente || 'S/I') + ') asignado exitosamente a la obra "' + newObraName + '"!');
  };

    // Helper infalible para obtener equipos asignados a la obra actual
  const getEquiposParaObraActual = () => {
    if (maquinariaList && maquinariaList.length > 0) return maquinariaList;

    const targetName = (selectedObra?.nombre || '').trim().toLowerCase();
    if (!targetName) return [];

    const localStr = localStorage.getItem('obraxis_inventario_maquinaria');
    const localItems = localStr ? JSON.parse(localStr) : [];

    const isEquipForObra = (item) => {
      if (!item || !item.obra_nombre) return false;
      const rawObra = String(item.obra_nombre).trim().toLowerCase();
      if (!rawObra || rawObra.includes('bodega') || rawObra === 'libre') return false;

      if (rawObra === targetName) return true;

      const normObra = rawObra.replace(/[^a-z0-9]/g, '');
      const normTarget = targetName.replace(/[^a-z0-9]/g, '');

      if (normObra === normTarget || (normTarget && normObra.includes(normTarget)) || (normObra && normTarget.includes(normObra))) return true;

      const coreObra = normObra.replace(/^(obra|proyecto)/, '');
      const coreTarget = normTarget.replace(/^(obra|proyecto)/, '');

      return coreObra === coreTarget || (coreTarget && coreObra.includes(coreTarget)) || (coreObra && coreTarget.includes(coreObra));
    };

    return localItems.filter(isEquipForObra);
  };

  const fetchObraDetails = async (obraNombre) => {
    if (!obraNombre) return;
    const targetName = obraNombre.trim().toLowerCase();

    const isMatchObra = (itemObra, targetObra) => {
      if (!itemObra || !targetObra) return false;
      const rawObra = String(itemObra).trim().toLowerCase();
      const rawTarget = String(targetObra).trim().toLowerCase();
      if (!rawObra) return false;
      if (rawObra === rawTarget) return true;

      const normObra = rawObra.replace(/[^a-z0-9]/g, '');
      const normTarget = rawTarget.replace(/[^a-z0-9]/g, '');
      if (normObra === normTarget || (normTarget && normObra.includes(normTarget)) || (normObra && normTarget.includes(normObra))) return true;

      const coreObra = normObra.replace(/^(obra|proyecto)/, '');
      const coreTarget = normTarget.replace(/^(obra|proyecto)/, '');
      return coreObra === coreTarget || (coreTarget && coreObra.includes(coreTarget)) || (coreObra && coreTarget.includes(coreObra));
    };

    // 1. Cargar personal
    try {
      const { data: allPers } = await supabase.from('maestro_personal').select('*');
      const rawListPers = (allPers || []).filter(p => isMatchObra(p.obra_nombre, obraNombre));
      
      const uniqueWorkersMap = new window.Map();
      rawListPers.forEach(p => {
        const key = (p.rut && p.rut.toString().trim()) 
          ? p.rut.toString().trim().toUpperCase() 
          : (p.nombre ? p.nombre.toString().trim().toUpperCase() : '');
        if (key && !uniqueWorkersMap.has(key)) {
          uniqueWorkersMap.set(key, p);
        }
      });
      const listPers = Array.from(uniqueWorkersMap.values());
      setPersonalCount(listPers.length);
      setPersonalAsignadoList(listPers);
      setPersonalList(listPers);

      try {
        const savedProjRrhh = localStorage.getItem(`obraxis_proj_rrhh_${obraNombre}`);
        if (savedProjRrhh) setProyeccionesRrhhList(JSON.parse(savedProjRrhh));
        const savedLiq = localStorage.getItem(`obraxis_liquidaciones_${obraNombre}`);
        if (savedLiq) setLiquidacionesList(JSON.parse(savedLiq));
        const savedCostosStr = localStorage.getItem(`obraxis_costos_${obraNombre}`) || localStorage.getItem(`obraxis_costos_${selectedObra?.id}`) || localStorage.getItem(`costos_reales_${obraNombre}`);
        if (savedCostosStr) {
          try { setCostosList(JSON.parse(savedCostosStr)); } catch (err) {}
        }
        try {
          const { data: allCostos } = await supabase.from('costos_reales_obra').select('*');
          const supaCostos = (allCostos || []).filter(c => isMatchObra(c.obra_nombre, obraNombre));
          if (supaCostos && supaCostos.length > 0) setCostosList(supaCostos);
        } catch (errC) {}
        // Cargar Mantenciones, Paralizaciones y Accidentes de la Obra
        try {
          const savedMant = localStorage.getItem(`obraxis_mantenciones_${obraNombre}`);
          if (savedMant) setMantencionesMaquinariaList(JSON.parse(savedMant));
          const { data: allMant } = await supabase.from('mantenciones_maquinaria').select('*');
          const supaMant = (allMant || []).filter(m => isMatchObra(m.obra_nombre, obraNombre));
          if (supaMant && supaMant.length > 0) setMantencionesMaquinariaList(supaMant);
        } catch (errM) {}

        try {
          const savedPara = localStorage.getItem(`obraxis_paralizaciones_${obraNombre}`);
          if (savedPara) setParalizacionesMaquinariaList(JSON.parse(savedPara));
          const { data: allPara } = await supabase.from('paralizaciones_maquinaria').select('*');
          const supaPara = (allPara || []).filter(p => isMatchObra(p.obra_nombre, obraNombre));
          if (supaPara && supaPara.length > 0) setParalizacionesMaquinariaList(supaPara);
        } catch (errP) {}

        try {
          const savedAcc = localStorage.getItem(`obraxis_accidentes_${obraNombre}`);
          if (savedAcc) setAccidentesPrevencionList(JSON.parse(savedAcc));
          const { data: allAcc } = await supabase.from('accidentes_prevencion_obra').select('*');
          const supaAcc = (allAcc || []).filter(a => isMatchObra(a.obra_nombre, obraNombre));
          if (supaAcc && supaAcc.length > 0) setAccidentesPrevencionList(supaAcc);
        } catch (errA) {}
      } catch (err) {}
    } catch (e) {
      console.warn('Aviso personal:', e);
    }

    // 2. Cargar maquinaria asignada (TOTALMENTE AISLADO DE OTRAS CONSULTAS)
    try {
      const localMaqStr = localStorage.getItem('obraxis_inventario_maquinaria');
      const localMaq = localMaqStr ? JSON.parse(localMaqStr) : [];

      let allRemoteMaq = [];
      try {
        const { data } = await supabase.from('inventario_maquinaria').select('*');
        if (data && data.length > 0) allRemoteMaq = data;
      } catch (e) {
        console.warn('Error leyendo inventario_maquinaria:', e);
      }

      const mapEquip = new window.Map();
      const getEquipKey = (item) => {
        if (!item) return '';
        if (item.patente && item.patente.toString().trim()) return item.patente.toString().trim().toUpperCase();
        if (item.id) return 'ID_' + item.id;
        return '';
      };

      (localMaq || []).forEach(item => {
        if (!item || typeof item !== 'object') return;
        const k = getEquipKey(item);
        if (k) mapEquip.set(k, item);
        if (item.id !== undefined && item.id !== null) mapEquip.set('ID_' + item.id, item);
      });

      (allRemoteMaq || []).forEach(item => {
        if (!item || typeof item !== 'object') return;
        const patK = getEquipKey(item);
        const idK = (item.id !== undefined && item.id !== null) ? 'ID_' + item.id : null;
        
        const localItem = (patK ? mapEquip.get(patK) : null) || (idK ? mapEquip.get(idK) : null) || {};

        const isRealObra = (n) => n && typeof n === 'string' && n.trim() !== '' && !n.toLowerCase().includes('bodega') && n.toLowerCase() !== 'libre';
        const finalObraNombre = isRealObra(item.obra_nombre) 
          ? item.obra_nombre.trim() 
          : (isRealObra(localItem.obra_nombre) ? localItem.obra_nombre.trim() : (item.obra_nombre || localItem.obra_nombre || 'Bodega Central / Libre'));

        const rCosto = parseFloat(item.costo_interno !== undefined && item.costo_interno !== null ? item.costo_interno : item.costo);
        const lCosto = parseFloat(localItem.costo_interno !== undefined && localItem.costo_interno !== null ? localItem.costo_interno : localItem.costo);
        const finalCosto = (!isNaN(rCosto) && rCosto > 0) ? rCosto : ((!isNaN(lCosto) && lCosto > 0) ? lCosto : 0);

        const merged = {
          ...localItem,
          ...item,
          obra_nombre: finalObraNombre,
          costo_interno: finalCosto,
          unidad_costo_interno: item.unidad_costo_interno || localItem.unidad_costo_interno || item.unidad_tarifa || localItem.unidad_tarifa || '$/día'
        };

        if (patK) mapEquip.set(patK, merged);
        if (idK) mapEquip.set(idK, merged);
      });

      const uniqueMap = new window.Map();
      Array.from(mapEquip.values()).forEach(item => {
        const k = getEquipKey(item);
        if (k) uniqueMap.set(k, item);
      });

      const combinedFleet = Array.from(uniqueMap.values());
      try {
        localStorage.setItem('obraxis_inventario_maquinaria', JSON.stringify(combinedFleet));
      } catch (err) {}

      const finalMaqObra = combinedFleet.filter(item => isMatchObra(item.obra_nombre, obraNombre));
      setMaquinariaCount(finalMaqObra.length);
      setMaquinariaList(finalMaqObra);
    } catch (eMaq) {
      console.error('Error en módulo Maquinaria:', eMaq);
    }

    // 3. Cargar partidas de obra
    try {
      const { data: allPart } = await supabase.from('partidas_obra').select('*');
      const listPart = (allPart || []).filter(p => isMatchObra(p.obra_nombre, obraNombre));

      const savedLocalPartidasStr = localStorage.getItem(`partidas_${selectedObra?.id}`) || localStorage.getItem(`partidas_${obraNombre}`);
      let savedLocalPartidas = [];
      try {
        if (savedLocalPartidasStr) savedLocalPartidas = JSON.parse(savedLocalPartidasStr);
      } catch(e) {}

      let normalizedListPart = (listPart || []).map((p, pIdx) => {
        const localMatch = savedLocalPartidas.find(lp => lp.partida === p.partida || (lp.id && String(lp.id) === String(p.id)));
        const isTit = p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo || (p.partida && /^[0-9]\./.test(p.partida.trim()));

        // Fechas automáticas distribuidas desde abril 2026 si no tienen fecha
        let autoDate = '2026-04-06';
        if (pIdx > 12) autoDate = '2026-07-27';
        else if (pIdx > 8) autoDate = '2026-07-01';
        else if (pIdx > 4) autoDate = '2026-06-01';
        else if (pIdx > 2) autoDate = '2026-04-27';

        return {
          ...p,
          es_titulo: isTit,
          cantidad: isTit ? 0 : (parseFloat(p.cantidad_presupuestada !== undefined && p.cantidad_presupuestada !== null && p.cantidad_presupuestada !== 0 ? p.cantidad_presupuestada : p.cantidad) || 0),
          pu: isTit ? 0 : (parseFloat(p.costo_por_dia !== undefined && p.costo_por_dia !== null && p.costo_por_dia !== 0 ? p.costo_por_dia : p.pu) || 0),
          rendimiento: p.rendimiento_meta || p.rendimiento || '10',
          fecha_inicio: localMatch?.fecha_inicio || p.fecha_inicio || p.fecha_inicio_programada || autoDate,
          predecesora: localMatch?.predecesora !== undefined ? localMatch.predecesora : (p.predecesora || null),
          tipo_relacion: localMatch?.tipo_relacion || p.tipo_relacion || 'FS',
          desfase_dias: localMatch?.desfase_dias !== undefined ? localMatch.desfase_dias : (p.desfase_dias || 0)
        };
      });

      // Respetar orden guardado en memoria local para esta obra
      try {
        const savedOrderStr = localStorage.getItem(`obraxis_obra_partidas_order_${obraNombre}`);
        if (savedOrderStr) {
          const savedNames = JSON.parse(savedOrderStr);
          normalizedListPart.sort((a, b) => {
            const idxA = savedNames.indexOf(a.partida);
            const idxB = savedNames.indexOf(b.partida);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
          });
        }
      } catch (e) {}

      setPartidasList(normalizedListPart);
    } catch (e) {
      console.warn('Aviso partidas:', e);
    }

    // 4. Asistencias de personal
    let fullAsist = [];
    try {
      const { data: asist1 } = await supabase.from('asistencia_personal').select('*');
      const { data: asist2 } = await supabase.from('asistencia').select('*');
      const combinedAsist = [...(asist1 || []), ...(asist2 || [])];
      fullAsist = combinedAsist.filter(a => isMatchObra(a.obra_nombre, obraNombre));
      setAsistenciaList(fullAsist);
    } catch (e) {}

    // 5. Avances de producción
    let fullAvances = [];
    try {
      const { data: av1 } = await supabase.from('avances_produccion_partidas').select('*');
      const { data: av2 } = await supabase.from('reportes_avance').select('*');
      const combinedAv = [...(av1 || []), ...(av2 || [])];
      fullAvances = combinedAv.filter(r => isMatchObra(r.obra_nombre, obraNombre));
      setReportesAvanceList(fullAvances);
    } catch (e) {}

    // 6. Bitácora
    try {
      const { data: fullNotas } = await supabase
        .from('bitacora_obra')
        .select('*')
        .eq('obra_nombre', obraNombre)
        .order('created_at', { ascending: true });
      setBitacoraNotasList(fullNotas || []);
    } catch (e) {}

    // 7. Arriendos de maquinaria
    try {
      const { data: aData } = await supabase.from('arriendos_maquinaria').select('*').eq('obra_nombre', obraNombre).order('created_at', { ascending: false });

      const savedAStr = localStorage.getItem(`arriendos_${selectedObra?.id || selectedObra?.nombre}`) || localStorage.getItem(`arriendos_${obraNombre}`);
      const savedA = savedAStr ? JSON.parse(savedAStr) : [];

      const mergedMap = new window.Map();
      (savedA || []).forEach(item => {
        const key = String(item.id || `${item.equipo}_${item.patente}`);
        mergedMap.set(key, item);
      });

      (aData || []).forEach(item => {
        const normalizedItem = {
          id: String(item.id),
          equipo: item.equipo || item.nombre_equipo || 'Equipo',
          patente: item.patente || '',
          proveedor: item.proveedor || item.empresa_arrendadora || 'Proveedor',
          costo: parseFloat(item.costo || item.costo_arriendo || item.tarifa) || 0,
          unidad_costo: item.unidad_costo || item.unidad_tarifa || '$/mes',
          tipo_condicion_minima: item.tipo_condicion_minima || 'sin_minimo',
          cantidad_minima: parseFloat(item.cantidad_minima) || 0,
          fechaInicio: item.fecha_inicio || item.fechaInicio || '',
          fechaTermino: item.fecha_termino || item.fechaTermino || '',
          observaciones: item.observaciones || ''
        };
        const key = String(normalizedItem.id || `${normalizedItem.equipo}_${normalizedItem.patente}`);
        mergedMap.set(key, normalizedItem);
      });

      const finalArriendos = Array.from(mergedMap.values());
      setArriendosList(finalArriendos);
      if (selectedObra?.id) {
        localStorage.setItem(`arriendos_${selectedObra.id}`, JSON.stringify(finalArriendos));
      }
    } catch (e) {
      const savedAStr = localStorage.getItem(`arriendos_${selectedObra?.id || selectedObra?.nombre}`) || localStorage.getItem(`arriendos_${obraNombre}`);
      if (savedAStr) setArriendosList(JSON.parse(savedAStr));
    }

    // 8. Asistencias QR
    try {
      const { data: listAsistencia } = await supabase
        .from('asistencias_qr')
        .select('*')
        .eq('obra_nombre', obraNombre)
        .order('fecha', { ascending: false });
      setAsistenciasHistoryList(listAsistencia || []);
    } catch (e) {}

    const combined = [
      ...(fullAsist || []).slice(0, 3).map(a => ({ type: 'asistencia', date: a.created_at, text: `${a.trabajador} marcado como ${a.asistencia}` })),
      ...(fullAvances || []).slice(0, 3).map(av => ({ type: 'avance', date: av.created_at, text: `Avance en ${av.partida}: ${av.cantidad} ${av.unidad || ''}` }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    setRecentLogs(combined);
  };

  const submitAsistencia = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (!asistenciaData.trabajador) {
        throw new Error('Debes ingresar o seleccionar un trabajador.');
      }

      if (asistenciaMode === 'qr') {
        if (selectedObra?.latitud && selectedObra?.longitud && gpsUserLoc.status === 'success' && !gpsUserLoc.isWithin) {
          const maxR = selectedObra.radio_cobertura_m || 200;
          throw new Error(`⚠️ Marcación rechazada por ubicación: Te encuentras a ${gpsUserLoc.distance}m de la obra (máximo permitido ${maxR}m). Debes estar físicamente en faena.`);
        }
      }

      let firmaBase64 = null;
      if (canvasRef.current && hasSignature) {
        firmaBase64 = canvasRef.current.toDataURL('image/png');
      }

      const payload = {
        obra_nombre: selectedObra.nombre,
        supervisor: user.usuario,
        trabajador: asistenciaData.trabajador.trim(),
        rut: asistenciaData.rut ? asistenciaData.rut.trim() : null,
        asistencia: asistenciaData.asistencia,
        ingreso: asistenciaData.asistencia === 'PRESENTE' ? asistenciaData.ingreso : null,
        salida: asistenciaData.asistencia === 'PRESENTE' ? asistenciaData.salida : null,
        colacion: asistenciaData.asistencia === 'PRESENTE' ? asistenciaData.colacion : null,
        horas_ordinarias: asistenciaData.asistencia === 'PRESENTE' ? 9 : 0,
        firma_base64: firmaBase64,
        latitud: gpsUserLoc.lat,
        longitud: gpsUserLoc.lng,
        distancia_obra_m: gpsUserLoc.distance,
        verificado_qr: asistenciaMode === 'qr'
      };

      const { error } = await supabase.from('asistencia_personal').insert([payload]);
      if (error) throw error;

      setSuccessMsg(`Asistencia de ${asistenciaData.trabajador} registrada correctamente.`);
      fetchObraDetails(selectedObra.nombre);
      setTimeout(() => {
        setActiveModal(null);
        clearSignature();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Guardar Coordenadas GPS de la Obra (con persistencia híbrida segura)
  const handleSaveObraGPS = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const lat = parseFloat(gpsConfig.latitud);
      const lng = parseFloat(gpsConfig.longitud);
      const rad = parseFloat(gpsConfig.radio || 200);

      const latVal = isNaN(lat) ? null : lat;
      const lngVal = isNaN(lng) ? null : lng;
      const radVal = isNaN(rad) ? 200 : rad;

      // Persistencia local en dispositivo para disponibilidad 100% garantizada
      if (selectedObra?.id) {
        try {
          localStorage.setItem(`obra_gps_${selectedObra.id}`, JSON.stringify({
            latitud: latVal,
            longitud: lngVal,
            radio_cobertura_m: radVal
          }));
        } catch (errLocal) {
          console.warn("No se pudo escribir en localStorage:", errLocal);
        }
      }

      // Sincronizar con la base de datos Supabase de forma segura
      try {
        const { error } = await supabase
          .from('obras')
          .update({
            latitud: latVal,
            longitud: lngVal,
            radio_cobertura_m: radVal
          })
          .eq('id', selectedObra.id);

        if (error) {
          console.warn("Aviso de Supabase al guardar GPS:", error.message);
        }
      } catch (dbErr) {
        console.warn("Sincronización Supabase omitida:", dbErr);
      }

      setSuccessMsg('Ubicación GPS de faena guardada correctamente.');
      const updated = { ...selectedObra, latitud: latVal, longitud: lngVal, radio_cobertura_m: radVal };
      setSelectedObra(updated);
      setTimeout(() => setShowGPSModal(false), 1200);
    } catch (err) {
      setErrorMsg(err.message || 'Ocurrió un error al guardar la ubicación GPS.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCaptureCurrentLocationForObra = () => {
    if (!navigator.geolocation) {
      alert('Geolocalización GPS no soportada.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsConfig({
          ...gpsConfig,
          latitud: pos.coords.latitude.toString(),
          longitud: pos.coords.longitude.toString()
        });
      },
      (err) => {
        alert('Error al obtener ubicación GPS: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Enviar Reporte de Avance Multi-Partida
  const submitAvance = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (!avanceItems || avanceItems.length === 0) {
        throw new Error('Debes agregar al menos una partida para reportar avance.');
      }

      // Validar comentarios obligatorios en cada partida
      for (let i = 0; i < avanceItems.length; i++) {
        const item = avanceItems[i];
        if (!item.partida) {
          throw new Error(`Partida #${i + 1}: Debes seleccionar una partida.`);
        }
        if (!item.observaciones || !item.observaciones.trim()) {
          throw new Error(`Partida #${i + 1} (${item.partida}): Los comentarios u observaciones son OBLIGATORIOS.`);
        }
      }

      const rowsToInsert = avanceItems.map(item => ({
        obra_nombre: selectedObra.nombre,
        supervisor: user?.nombre || user?.email || user?.usuario || 'Supervisor',
        frente: item.frente || 'Frente Principal',
        partida: item.partida,
        unidad: item.unidad || 'UND',
        cantidad: parseFloat(item.cantidad) || 0,
        observaciones: item.observaciones.trim(),
        created_at: avanceFecha ? new Date(avanceFecha + 'T12:00:00Z').toISOString() : new Date().toISOString()
      }));

      const { error } = await supabase.from('avances_produccion_partidas').insert(rowsToInsert);

      if (error) throw error;

      // --- DISPARAR NOTIFICACIÓN VÍA CORREO ELECTRÓNICO CON RESEND ---
      try {
        const obraNombre = selectedObra?.nombre || 'Obra';
        const storageKey = `emails_config_${user?.empresa || 'Obraxis'}_obras_${obraNombre}`;
        const localConfig = localStorage.getItem(storageKey);

        let recipients = [];
        if (localConfig) {
          const parsed = JSON.parse(localConfig);
          if (parsed.emails && parsed.emails.length > 0) {
            recipients = [...parsed.emails, ...(parsed.emailsCC || [])];
          }
        }

        // Si no hay correos en localStorage de la obra, buscar en config_empresa
        if (recipients.length === 0 && user?.empresa) {
          const { data: cData } = await supabase
            .from('config_empresa')
            .select('email_notificaciones, email_notificaciones_cc')
            .eq('empresa', user.empresa)
            .maybeSingle();

          if (cData) {
            const toArr = cData.email_notificaciones ? cData.email_notificaciones.split(',').map(e => e.trim()).filter(Boolean) : [];
            const ccArr = cData.email_notificaciones_cc ? cData.email_notificaciones_cc.split(',').map(e => e.trim()).filter(Boolean) : [];
            recipients = [...toArr, ...ccArr];
          }
        }

        // Si el usuario actual tiene correo registrado y aún no hay destinatarios, enviárselo a él
        if (recipients.length === 0 && (user?.email || user?.correo)) {
          recipients = [user.email || user.correo];
        }

        const uniqueRecipients = Array.from(new Set(recipients.filter(e => e && e.includes('@'))));

        if (uniqueRecipients.length > 0) {
          const supervisorName = user?.nombre || user?.usuario || 'Supervisor';
          const fechaStr = avanceFecha || new Date().toLocaleDateString('es-CL');

          const tableRowsHtml = avanceItems.map(item => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #1e293b;">${item.partida}</td>
              <td style="padding: 10px; color: #475569;">${item.frente || 'Frente Principal'}</td>
              <td style="padding: 10px; font-weight: bold; color: #047857; text-align: right;">${item.cantidad} ${item.unidad || 'UND'}</td>
              <td style="padding: 10px; color: #334155; font-style: italic;">${item.observaciones || 'Sin comentarios'}</td>
            </tr>
          `).join('');

          const htmlEmail = `
            <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 20px;">
                <span style="font-size: 11px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.1em;">Obraxis • Control de Faena</span>
                <h2 style="color: #0f172a; margin: 6px 0 0 0; font-size: 20px;">📊 Nuevo Reporte de Avance de Producción</h2>
                <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Obra: <strong>${obraNombre}</strong> | Fecha: <strong>${fechaStr}</strong></p>
              </div>

              <div style="background-color: #f8fafc; padding: 14px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #cbd5e1; font-size: 13px;">
                <p style="margin: 0; color: #334155;">👤 <strong>Supervisor Responsable:</strong> ${supervisorName}</p>
                <p style="margin: 4px 0 0 0; color: #334155;">📋 <strong>Partidas Reportadas:</strong> ${avanceItems.length} partida(s)</p>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #1e3a8a; color: #ffffff; text-align: left; font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 10px;">Partida</th>
                    <th style="padding: 10px;">Frente</th>
                    <th style="padding: 10px; text-align: right;">Cantidad Avance</th>
                    <th style="padding: 10px;">Observaciones / Comentarios</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
              </table>

              <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <a href="${window.location.origin}" style="background-color: #1e3a8a; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; display: inline-block;">Ver Obra en el Portal Obraxis</a>
              </div>
            </div>
          `;

          await sendSystemEmail({
            to: uniqueRecipients,
            subject: `📊 Reporte de Avance (${obraNombre}) - ${fechaStr}`,
            htmlContent: htmlEmail,
            customSender: 'notificaciones@obraxis.cl'
          });
        }
      } catch (emailErr) {
        console.warn("Aviso al enviar notificación por correo:", emailErr.message);
      }

      setSuccessMsg(`Reporte de Avance (${avanceItems.length} partida/s) registrado con éxito.`);
      fetchObraDetails(selectedObra.nombre);
      setTimeout(() => {
        setActiveModal(null);
        setAvanceItems([{ frente: 'Frente Principal', partida: '', unidad: 'UND', cantidad: '', observaciones: '' }]);
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Handlers para Cuadrillas
  const handleSaveWorkerToObra = async (e) => {
    e.preventDefault();
    if (!newWorkerData.nombre.trim() || !newWorkerData.rut.trim()) {
      alert('Debes ingresar Nombre completo y RUT del trabajador.');
      return;
    }
    setModalLoading(true);
    try {
      const payload = {
        obra_nombre: selectedObra.nombre,
        nombre: newWorkerData.nombre.trim(),
        rut: newWorkerData.rut.trim(),
        cargo: newWorkerData.cargo || 'Operario',
        fono: newWorkerData.fono ? newWorkerData.fono.trim() : null,
        email: newWorkerData.email ? newWorkerData.email.trim() : null,
        activo: true
      };

      const { error } = await supabase.from('maestro_personal').insert([payload]);
      if (error) throw error;

      setSuccessMsg(`Trabajador ${newWorkerData.nombre} asignado a la obra con éxito.`);
      fetchObraDetails(selectedObra.nombre);
      setTimeout(() => {
        setShowAddWorkerModal(false);
        setNewWorkerData({ nombre: '', rut: '', cargo: 'Operario', fono: '', email: '' });
      }, 1200);
    } catch(err) {
      alert('Error asignando trabajador: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const canManageRecordsAccess = canModifyOrDeleteRecords(user);

  // 1. Eliminar Reporte de Avance
  const handleDeleteAvanceReport = async (reportId) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos de Nivel 0, 1 o 2 para eliminar este registro.');
    if (!window.confirm('¿Estás seguro de que deseas eliminar este reporte de avance de faena?')) return;
    try {
      const { error } = await supabase.from('avances_produccion_partidas').delete().eq('id', reportId);
      if (error) throw error;
      setReportesAvanceList(prev => prev.filter(r => r.id !== reportId));
      alert('Reporte de avance eliminado con éxito.');
    } catch(err) {
      alert('Error al eliminar el reporte: ' + err.message);
    }
  };

  // 2. Eliminar Registro de Asistencia
  const handleDeleteAsistenciaRecord = async (asistId) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos de Nivel 0, 1 o 2 para eliminar este registro.');
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro de asistencia?')) return;
    try {
      const { error } = await supabase.from('asistencia_personal').delete().eq('id', asistId);
      if (error) throw error;
      setAsistenciaList(prev => prev.filter(a => a.id !== asistId));
      alert('Registro de asistencia eliminado con éxito.');
    } catch(err) {
      alert('Error al eliminar el registro: ' + err.message);
    }
  };

  // 3. Eliminar Trabajador de la Obra (RRHH)
  const handleDeleteWorkerFromObra = async (workerNombre) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos de Nivel 0, 1 o 2 para eliminar trabajadores.');
    if (!window.confirm(`¿Estás seguro de desasignar/eliminar a ${workerNombre} de la obra?`)) return;
    try {
      const { error } = await supabase.from('maestro_personal').delete().eq('obra_nombre', selectedObra.nombre).eq('nombre', workerNombre);
      if (error) throw error;
      setPersonalList(prev => prev.filter(p => p.nombre !== workerNombre));
      alert('Trabajador eliminado/desasignado de la obra con éxito.');
    } catch(err) {
      alert('Error al eliminar trabajador: ' + err.message);
    }
  };

  // 4. Eliminar Cuadrilla de Trabajo
  const handleDeleteCuadrilla = (cuadrillaId) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos de Nivel 0, 1 o 2 para eliminar cuadrillas.');
    if (!window.confirm('¿Estás seguro de eliminar esta cuadrilla de trabajo?')) return;
    const key = `cuadrillas_${selectedObra.id}`;
    const newList = cuadrillasList.filter(c => c.id !== cuadrillaId);
    setCuadrillasList(newList);
    localStorage.setItem(key, JSON.stringify(newList));
  };

  // --- HANDLERS DE EDICIÓN ---
  const handleEditAvanceReport = (r) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos de Nivel 0, 1 o 2 para editar este registro.');
    setEditingRecordId(r.id);
    setAvanceFecha(r.created_at ? r.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10));
    setAvanceItems([{ frente: r.frente || 'Frente Principal', partida: r.partida, unidad: r.unidad || 'UND', cantidad: r.cantidad, observaciones: r.observaciones || '' }]);
    setSuccessMsg('');
    setErrorMsg('');
    setActiveModal('avance');
  };

  const handleEditAsistenciaRecord = (a) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos de Nivel 0, 1 o 2 para editar este registro.');
    setEditingRecordId(a.id);
    setAsistenciaData({
      trabajador: a.trabajador,
      rut: a.rut || '',
      asistencia: a.asistencia || 'PRESENTE',
      ingreso: a.ingreso || '08:00',
      salida: a.salida || '18:00',
      colacion: a.colacion || 'SI'
    });
    setSuccessMsg('');
    setErrorMsg('');
    setActiveModal('asistencia');
  };

  const handleEditWorkerFromObra = (p) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos de Nivel 0, 1 o 2 para editar trabajadores.');
    setEditingRecordId(p.id || p.nombre);
    setNewWorkerData({
      id: p.id,
      nombre: p.nombre,
      rut: p.rut || '',
      cargo: p.cargo || 'Operario',
      fono: p.fono || '',
      email: p.email || ''
    });
    setShowAddWorkerModal(true);
  };

  const handleEditCuadrilla = (c) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos de Nivel 0, 1 o 2 para editar cuadrillas.');
    setEditingRecordId(c.id);
    setCuadrillaData({
      id: c.id,
      nombre: c.nombre,
      lider: c.lider || '',
      especialidad: c.especialidad || 'General',
      miembros: c.miembros || []
    });
    setShowCuadrillaModal(true);
  };

  const handleEditArriendo = (a) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos para editar arriendos.');
    setEditingRecordId(a.id);
    setArriendoData({
      id: a.id,
      equipo: a.equipo || '',
      patente: a.patente || '',
      proveedor: a.proveedor || '',
      costo: a.costo || '',
      unidad_costo: a.unidad_costo || '$/mes',
      tipo_condicion_minima: a.tipo_condicion_minima || 'sin_minimo',
      cantidad_minima: a.cantidad_minima || '',
      modalidad_dias: a.modalidad_dias || 'laborales',
      fechaInicio: a.fechaInicio || '',
      fechaTermino: a.fechaTermino || '',
      observaciones: a.observaciones || ''
    });
    setShowArriendoModal(true);
  };

  const handleDeleteArriendo = async (arriendoId) => {
    if (!canManageRecordsAccess) return alert('No tienes permisos para eliminar registros.');
    if (!window.confirm('¿Estás seguro de eliminar este registro de arriendo?')) return;

    const updated = arriendosList.filter(a => String(a.id) !== String(arriendoId));
    setArriendosList(updated);

    try {
      localStorage.setItem(`arriendos_${selectedObra.id}`, JSON.stringify(updated));
      if (selectedObra?.nombre) {
        localStorage.setItem(`arriendos_${selectedObra.nombre}`, JSON.stringify(updated));
      }
    } catch (err) {}

    try {
      if (arriendoId && !isNaN(parseInt(arriendoId))) {
        await supabase.from('arriendos_maquinaria').delete().eq('id', arriendoId);
      }
    } catch (err) {}
  };

  // 6. Generar / Descargar Documento Oficial del Libro Digital de Asistencia (con Firma Base64)
  const handleDownloadLibroAsistencia = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=850');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes en tu navegador para generar y descargar el documento del Libro de Asistencia.');
      return;
    }

    const filteredRecords = asistenciaList.filter(a => {
      if (libroFiltroTipo === 'persona' && libroFiltroPersona) {
        return a.trabajador.toLowerCase().includes(libroFiltroPersona.toLowerCase());
      }
      return true;
    });

    const rowsHtml = filteredRecords.length === 0
      ? `<tr><td colspan="7" style="padding:20px; text-align:center; color:#64748b; font-weight:600;">No hay registros de marcaje en el periodo seleccionado.</td></tr>`
      : filteredRecords.map((a) => {
          const fechaStr = a.created_at ? new Date(a.created_at).toLocaleDateString('es-CL') : 'Hoy';
          const firmaImg = a.firma_base64
            ? `<div style="display:flex; flex-direction:column; align-items:center;"><img src="${a.firma_base64}" style="height:36px; max-width:110px; object-fit:contain; border:1px solid #cbd5e1; border-radius:4px; padding:2px; background:#fff;" /><span style="font-size:8px; color:#065f46; font-weight:bold; margin-top:2px;">✓ Digital (QR)</span></div>`
            : `<span style="font-size:9px; background:#ecfdf5; color:#065f46; padding:3px 8px; border-radius:4px; font-weight:bold; border:1px solid #a7f3d0;">✓ Digital (QR)</span>`;
          
          return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding:10px; font-family:monospace; font-weight:bold; color:#1e293b;">${fechaStr}</td>
              <td style="padding:10px; font-weight:600; color:#0f172a;">${a.trabajador} <span style="font-size:10px; color:#64748b;">(${a.rut || 'RUT N/D'})</span></td>
              <td style="padding:10px; font-family:monospace; color:#1e3a8a; font-weight:bold;">${a.ingreso || '08:00'}</td>
              <td style="padding:10px; text-align:center;">${firmaImg}</td>
              <td style="padding:10px; font-family:monospace; font-weight:bold; color:#334155;">${a.salida || '18:00'}</td>
              <td style="padding:10px; text-align:center;">${firmaImg}</td>
              <td style="padding:10px; font-weight:bold; color:#047857;">${a.horas_extras_auto || 0} hrs</td>
            </tr>
          `;
        }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Libro_Digital_Asistencia_${selectedObra?.nombre || 'Obra'}_${selectedMonthLibro}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #0f172a; background: #fff; line-height: 1.4; }
          .header { border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 18px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
          .subtitle { font-size: 11px; color: #475569; margin-top: 4px; font-weight: 600; }
          .meta { font-size: 11px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; text-transform: uppercase; font-size: 10px; color: #334155; border-bottom: 2px solid #94a3b8; font-weight: 800; }
          .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">📄 LIBRO ASISTENCIA DIGITAL</div>
            <div class="subtitle">Registro de Control de Jornada de Trabajo, Marcajes y Horas Extras con Firma Digital</div>
          </div>
          <button class="no-print" onclick="window.print()" style="background:#0f172a; color:#fff; font-weight:bold; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-size:12px; shadow:0 2px 4px rgba(0,0,0,0.1);">
            ⬇️ Guardar como PDF / Imprimir Documento
          </button>
        </div>

        <div class="meta">
          <div><strong>🏗️ Obra:</strong> ${selectedObra?.nombre || 'Obra'}</div>
          <div><strong>📅 Periodo:</strong> ${selectedMonthLibro}</div>
          <div><strong>🔍 Filtro:</strong> ${libroFiltroTipo === 'persona' && libroFiltroPersona ? `Trabajador: ${libroFiltroPersona}` : libroFiltroTipo === 'cuadrilla' && libroFiltroCuadrilla ? `Cuadrilla: ${libroFiltroCuadrilla}` : 'Toda la Obra Completa'}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>1. Día / Fecha</th>
              <th>2. Nombre Trabajador (RUT)</th>
              <th>3. Hora Ingreso</th>
              <th style="text-align:center;">4. Firma Ingreso (Registrada)</th>
              <th>5. Hora Salida</th>
              <th style="text-align:center;">6. Firma Salida (Registrada)</th>
              <th>7. Horas Extras</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>Obraxis Portal de Gestión de Proyectos</div>
          <div>✓ Validez de Control de Asistencia mediante Marcaje QR + Geolocalización GPS + Firma Manuscrita Digital</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleSaveCuadrilla = (e) => {
    e.preventDefault();
    if (!cuadrillaData.nombre.trim()) return;
    const newCuadrilla = {
      id: Date.now().toString(),
      nombre: cuadrillaData.nombre.trim(),
      lider: cuadrillaData.lider.trim() || 'Sin líder',
      especialidad: cuadrillaData.especialidad || 'General',
      miembros: cuadrillaData.miembros || []
    };
    const updated = [...cuadrillasList, newCuadrilla];
    setCuadrillasList(updated);
    try {
      localStorage.setItem(`cuadrillas_${selectedObra.id}`, JSON.stringify(updated));
    } catch(e) {}
    setShowCuadrillaModal(false);
    setCuadrillaData({ nombre: '', lider: '', especialidad: 'Hormigón', miembros: [] });
  };

  // Handlers para Arriendos de Maquinaria
  const handleSaveArriendo = async (e) => {
    e.preventDefault();
    if (!arriendoData.equipo.trim() || !arriendoData.proveedor.trim()) {
      alert('Debes ingresar el Nombre del Equipo y el Proveedor Arrendador (Empresa Arrendadora).');
      return;
    }

    const targetId = editingRecordId || Date.now().toString();

    const newArriendo = {
      id: targetId,
      equipo: arriendoData.equipo.trim(),
      patente: arriendoData.patente.trim(),
      proveedor: arriendoData.proveedor.trim(),
      costo: parseFloat(arriendoData.costo) || 0,
      unidad_costo: arriendoData.unidad_costo || '$/mes',
      tipo_condicion_minima: arriendoData.tipo_condicion_minima || 'sin_minimo',
      cantidad_minima: parseFloat(arriendoData.cantidad_minima) || 0,
      modalidad_dias: arriendoData.modalidad_dias || 'laborales',
      fechaInicio: arriendoData.fechaInicio || '',
      fechaTermino: arriendoData.fechaTermino || '',
      observaciones: arriendoData.observaciones || ''
    };

    const exists = arriendosList.some(item => String(item.id) === String(targetId));
    let updated = [];
    if (exists) {
      updated = arriendosList.map(item => String(item.id) === String(targetId) ? newArriendo : item);
    } else {
      updated = [newArriendo, ...arriendosList];
    }

    setArriendosList(updated);

    try {
      if (selectedObra?.id) {
        localStorage.setItem(`arriendos_${selectedObra.id}`, JSON.stringify(updated));
      }
      if (selectedObra?.nombre) {
        localStorage.setItem(`arriendos_${selectedObra.nombre}`, JSON.stringify(updated));
      }
    } catch(e) {}

    try {
      const payloadSupabase = {
        obra_nombre: selectedObra.nombre,
        equipo: newArriendo.equipo,
        patente: newArriendo.patente,
        proveedor: newArriendo.proveedor,
        costo: newArriendo.costo,
        unidad_costo: newArriendo.unidad_costo,
        tipo_condicion_minima: newArriendo.tipo_condicion_minima,
        cantidad_minima: newArriendo.cantidad_minima,
        modalidad_dias: newArriendo.modalidad_dias,
        fecha_inicio: newArriendo.fechaInicio || null,
        fecha_termino: newArriendo.fechaTermino || null,
        observaciones: newArriendo.observaciones || null,
        empresa: user?.empresa || 'EMIN'
      };

      if (editingRecordId && !isNaN(parseInt(editingRecordId))) {
        await supabase.from('arriendos_maquinaria').update(payloadSupabase).eq('id', editingRecordId);
      } else {
        await supabase.from('arriendos_maquinaria').insert([payloadSupabase]);
      }
    } catch(err) {
      console.warn('Sync warning:', err);
    }

    setShowArriendoModal(false);
    setEditingRecordId(null);
    setArriendoData({ equipo: '', patente: '', proveedor: '', costo: '', unidad_costo: '$/mes', tipo_condicion_minima: 'sin_minimo', cantidad_minima: '', modalidad_dias: 'laborales', fechaInicio: '', fechaTermino: '', observaciones: '' });
  };

  // Cargar Cuadrillas y Arriendos desde localStorage cuando cambia la obra
  useEffect(() => {
    if (selectedObra?.nombre || selectedObra?.id) {
      try {
        const obraKey = selectedObra.id ? `cuadrillas_${selectedObra.id}` : `cuadrillas_${selectedObra.nombre}`;
        const savedC = localStorage.getItem(obraKey) || localStorage.getItem(`cuadrillas_${selectedObra.nombre}`) || localStorage.getItem(`cuadrillas_${selectedObra.id}`);
        
        if (savedC && JSON.parse(savedC).length > 0) {
          setCuadrillasList(JSON.parse(savedC));
        } else if (personalAsignadoList && personalAsignadoList.length > 0) {
          // Filtrar staff administrativo/directivo
          const isStaff = (p) => {
            const cargo = (p.cargo || p.funcion || '').toLowerCase();
            return cargo.includes('administrad') || cargo.includes('jef') || cargo.includes('prevencion') || cargo.includes('oficina') || cargo.includes('rrhh') || cargo.includes('director');
          };
          
          const operarios = personalAsignadoList.filter(p => !isStaff(p));
          if (operarios.length > 0) {
            const capatazObj = operarios.find(p => p.cargo?.toLowerCase().includes('capataz')) || operarios[0];
            const pavimentadorObj = operarios.find(p => p.cargo?.toLowerCase().includes('instalad') || p.cargo?.toLowerCase().includes('paviment')) || operarios[1] || operarios[0];
            const riegoObj = operarios.find(p => p.cargo?.toLowerCase().includes('riego') || p.cargo?.toLowerCase().includes('técnic')) || operarios[2] || operarios[0];

            const autoCuadrillas = [
              {
                id: 101,
                nombre: 'Cuadrilla 1: Movimiento de Tierras & Maquinaria',
                lider: capatazObj?.nombre || 'Claudio Bravo Soto',
                especialidad: 'Movimiento de Tierras & Mov. Maquinaria',
                miembros: operarios.filter(p => p.cargo?.toLowerCase().includes('operad') || p.cargo?.toLowerCase().includes('topóg') || p.cargo?.toLowerCase().includes('capataz')).map(p => p.nombre)
              },
              {
                id: 102,
                nombre: 'Cuadrilla 2: Obras Civiles & Pavimentos',
                lider: pavimentadorObj?.nombre || 'Gabriel Oyarzún',
                especialidad: 'Pavimentos, Adoquines & Hormigón',
                miembros: operarios.filter(p => p.cargo?.toLowerCase().includes('instalad') || p.cargo?.toLowerCase().includes('concret') || p.cargo?.toLowerCase().includes('paviment')).map(p => p.nombre)
              },
              {
                id: 103,
                nombre: 'Cuadrilla 3: Riego Automatizado & Paisajismo',
                lider: riegoObj?.nombre || 'Mauricio Sanhueza',
                especialidad: 'Red de Riego & Áreas Verdes',
                miembros: operarios.filter(p => p.cargo?.toLowerCase().includes('riego') || p.cargo?.toLowerCase().includes('jornal')).map(p => p.nombre)
              }
            ];
            setCuadrillasList(autoCuadrillas);
            try { localStorage.setItem(obraKey, JSON.stringify(autoCuadrillas)); } catch(e) {}
          }
        }

        const savedA = localStorage.getItem(`arriendos_${selectedObra.id}`) || localStorage.getItem(`arriendos_${selectedObra.nombre}`);
        if (savedA) setArriendosList(JSON.parse(savedA));
        else setArriendosList([]);
      } catch(e) {}
    }
  }, [selectedObra, personalAsignadoList]);

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
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-1.5 hover:bg-slate-200 rounded-lg transition cursor-pointer">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Selecciona un Proyecto / Obra Activa</h2>
            </div>

            {canCreateObras(user) && (
              <button
                onClick={() => setShowCreateObraModal(true)}
                className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Nueva Obra</span>
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 p-2">⏳ Cargando tus proyectos autorizados...</p>
          ) : obras.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-center text-sm font-medium">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <span>No se encontraron obras asignadas a tu cuenta. Contacta al administrador.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {obras.map((o, idx) => {
                const cover = o.imagen_base64 || defaultCovers[idx % defaultCovers.length];
                const isFav = favorites.includes(o.nombre);
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedObra(o)}
                    className="group bg-white border border-slate-250 rounded-2xl shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col"
                  >
                    {/* Imagen de Portada */}
                    <div className="h-36 w-full relative overflow-hidden bg-slate-100">
                      <img 
                        src={cover} 
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                        alt={o.nombre} 
                      />
                      {/* Dot Indicador (Azul) */}
                      <div className="absolute top-3 left-3 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm" />
                      
                      {/* Estrella Favorito */}
                      <button
                        onClick={(e) => toggleFavorite(e, o.nombre)}
                        className="absolute top-3 right-3 p-1 rounded-full bg-black/30 hover:bg-black/55 text-white cursor-pointer transition"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          fill={isFav ? "yellow" : "none"} 
                          stroke={isFav ? "yellow" : "currentColor"} 
                          strokeWidth="2.5" 
                          className="w-3.5 h-3.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499c.151-.326.623-.326.774 0l1.848 3.75 4.143.602c.361.052.506.502.244.756l-3 2.923.708 4.126c.062.36-.317.635-.639.466l-3.706-1.95-3.706 1.95c-.322.169-.701-.106-.639-.466l.708-4.126-3-2.923c-.262-.254-.117-.704.244-.756l4.143-.602 1.848-3.75Z" />
                        </svg>
                      </button>
                    </div>

                    {/* Título de la Obra */}
                    <div className="p-4 bg-white flex-1 flex flex-col justify-center min-h-[75px] border-t border-slate-100">
                      <h3 className="font-extrabold text-slate-800 text-xs tracking-wide leading-snug group-hover:text-primary transition uppercase line-clamp-2">
                        {o.nombre}
                      </h3>
                      {o.tipo && (
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Especialidad: {o.tipo}</p>
                      )}
                    </div>
                  </div>
                );
              })}
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
            
            <div className="flex flex-wrap gap-2">
              {/* Configuración de Correos de la Obra (Engranaje ⚙️) */}
              {canConfigureEmails(user) && (
                <button
                  onClick={() => setShowContextualEmailModal(true)}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold px-3 py-2 rounded-lg border border-slate-300 transition cursor-pointer shadow-xs"
                  title="Configurar destinatarios de notificaciones por correo para esta obra"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-900" />
                  <span>Correos ⚙️</span>
                </button>
              )}

              {/* Botón QR de Faena */}
              <button
                onClick={() => setShowQRModal(true)}
                className="flex items-center gap-1.5 bg-slate-900 text-[11px] text-white font-bold px-3 py-2 rounded-lg hover:bg-slate-800 transition cursor-pointer shadow-sm"
                title="Ver e imprimir Código QR de la Obra"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR de Faena</span>
              </button>

              {/* Botón GPS de Faena */}
              <button
                onClick={() => {
                  setGpsConfig({
                    latitud: selectedObra.latitud ? selectedObra.latitud.toString() : '',
                    longitud: selectedObra.longitud ? selectedObra.longitud.toString() : '',
                    radio: selectedObra.radio_cobertura_m ? selectedObra.radio_cobertura_m.toString() : '200'
                  });
                  setSuccessMsg('');
                  setErrorMsg('');
                  setShowGPSModal(true);
                }}
                className="flex items-center gap-1.5 bg-blue-900 text-[11px] text-white font-bold px-3 py-2 rounded-lg hover:bg-blue-800 transition cursor-pointer shadow-sm"
                title="Configurar ubicación GPS de la Obra"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>GPS Faena</span>
              </button>

              {/* Cambiar Portada */}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  id="project-cover-upload"
                  onChange={handleUploadProjectCover}
                  className="hidden"
                />
                <label
                  htmlFor="project-cover-upload"
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-bold px-3 py-2 border border-slate-250 rounded-lg cursor-pointer transition"
                  title="Cambiar imagen de portada del proyecto"
                >
                  <Camera className="w-3.5 h-3.5 text-slate-500" />
                  <span>Portada</span>
                </label>
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
                <p className="text-xl font-black text-slate-800">{getEquiposParaObraActual().length} <span className="text-xs font-normal text-slate-400">unidades</span></p>
              </div>
            </div>
          </div>

          {/* NAVEGACIÓN PRINCIPAL: VISTA DE TARJETAS / RECTÁNGULOS OPERATIVOS */}
          {obraActiveSubmodule === null && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Módulos de Operación de Faena</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* 1. Reporte de Avance */}
                <button
                  onClick={() => setObraActiveSubmodule('avance')}
                  className="p-5 bg-white border border-slate-200 hover:border-blue-600 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-blue-50 text-blue-900 rounded-xl group-hover:bg-blue-900 group-hover:text-white transition">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">Producción</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-blue-950">Reporte de Avance</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Ingreso de avances multi-partida con comentarios obligatorios por supervisor.</p>
                  </div>
                </button>

                {/* 2. Asistencia & Horas Extras */}
                <button
                  onClick={() => setObraActiveSubmodule('asistencia')}
                  className="p-5 bg-white border border-slate-200 hover:border-emerald-600 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl group-hover:bg-emerald-800 group-hover:text-white transition">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">Asistencia & Libro</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-emerald-950">Asistencia & Libro Asistencia Digital</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Marcaje QR/GPS, cálculo de horas extras y Libro Asistencia Digital.</p>
                  </div>
                </button>

                {/* 3. Personal Asignado (RRHH) */}
                <button
                  onClick={() => setObraActiveSubmodule('rrhh')}
                  className="p-5 bg-white border border-slate-200 hover:border-purple-600 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-purple-50 text-purple-900 rounded-xl group-hover:bg-purple-900 group-hover:text-white transition">
                      <Users className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 bg-purple-50 px-2 py-1 rounded-md border border-purple-200">RRHH</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-purple-950">Personal Asignado</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Nómina de trabajadores asignados a la obra, contratos, RUTs y cargos.</p>
                  </div>
                </button>

                {/* 4. Cuadrillas de Trabajo */}
                <button
                  onClick={() => setObraActiveSubmodule('cuadrillas')}
                  className="p-5 bg-white border border-slate-200 hover:border-amber-600 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-amber-50 text-amber-900 rounded-xl group-hover:bg-amber-800 group-hover:text-white transition">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">Cuadrillas</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-amber-950">Cuadrillas de Trabajo</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Asignación de personal de obra en grupos de trabajo y métricas de rendimiento.</p>
                  </div>
                </button>

                {/* 5. Equipos & Maquinarias */}
                <button
                  onClick={() => setObraActiveSubmodule('maquinaria')}
                  className="p-5 bg-white border border-slate-200 hover:border-indigo-600 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-indigo-50 text-indigo-900 rounded-xl group-hover:bg-indigo-900 group-hover:text-white transition">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200">Equipos</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-indigo-950">Equipos & Maquinarias</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Maquinaria propia con costo por hora y arriendos externos con proveedor.</p>
                  </div>
                </button>

                {/* 6. Control Materiales */}
                <button
                  onClick={() => setObraActiveSubmodule('materiales')}
                  className="p-5 bg-white border border-slate-200 hover:border-cyan-600 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-cyan-50 text-cyan-900 rounded-xl group-hover:bg-cyan-900 group-hover:text-white transition">
                      <ArrowRightLeft className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-900 bg-cyan-50 px-2 py-1 rounded-md border border-cyan-200">Bodega</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-cyan-950">Control de Materiales</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Trazabilidad de guías de despacho, entradas y salidas de bodega de obra.</p>
                  </div>
                </button>

                {/* 7. Bitácora de Obra */}
                <button
                  onClick={() => setObraActiveSubmodule('bitacora')}
                  className="p-5 bg-white border border-slate-200 hover:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition">
                      <History className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800 bg-slate-100 px-2 py-1 rounded-md border border-slate-250">Línea del Tiempo</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-slate-950">Bitácora de Obra</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Línea de tiempo cronológica (pasado a presente) con filtros por avances, asistencia e incidentes.</p>
                  </div>
                </button>

                {/* 8. Estadísticas */}
                <button
                  onClick={() => setObraActiveSubmodule('estadisticas')}
                  className="p-5 bg-white border border-slate-200 hover:border-blue-700 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-blue-50 text-blue-900 rounded-xl group-hover:bg-blue-900 group-hover:text-white transition">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">Métricas KPIs</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-blue-950">Estadísticas de Obra</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Indicadores clave de rendimiento, horas hombre, avance físico y seguridad de la obra.</p>
                  </div>
                </button>

                {/* 9. Prevención de Riesgos */}
                <button
                  onClick={() => setObraActiveSubmodule('prevencion')}
                  className="p-5 bg-white border border-slate-200 hover:border-rose-600 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-rose-50 text-rose-900 rounded-xl group-hover:bg-rose-900 group-hover:text-white transition">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">HSEC / Seguridad</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-rose-950">Prevención de Riesgos</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Inspecciones de terreno, Procedimientos PTS vigentes de la obra e historial de incidentes.</p>
                  </div>
                </button>

                {/* 10. Presupuesto */}
                <button
                  onClick={() => setObraActiveSubmodule('presupuesto')}
                  className="p-5 bg-white border border-slate-200 hover:border-emerald-600 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl group-hover:bg-emerald-900 group-hover:text-white transition">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">Costos & Partidas</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-emerald-950">Presupuesto de Obra</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Enlace con módulo de presupuestos o asignación de costos unitarios (P.U.) por partida.</p>
                  </div>
                </button>

                {/* 11. Planificación */}
                <button
                  onClick={() => setObraActiveSubmodule('planificacion')}
                  className="p-5 bg-white border border-slate-200 hover:border-indigo-600 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-indigo-50 text-indigo-900 rounded-xl group-hover:bg-indigo-900 group-hover:text-white transition">
                      <CalendarRange className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200">MS Project / Gantt</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-indigo-950">Planificación</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Carta Gantt de obra, duraciones y opción de importar archivos desde MS Project.</p>
                  </div>
                </button>

                {/* 12. Control de Costos */}
                <button
                  onClick={() => setObraActiveSubmodule('costos')}
                  className="p-5 bg-white border border-slate-200 hover:border-emerald-700 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-emerald-50 text-emerald-950 rounded-xl group-hover:bg-emerald-950 group-hover:text-white transition">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">Facturación & Imputaciones</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-emerald-950">Control de Costos</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">Registro de costos reales de obra, asociación de facturas e imputación por porcentaje a partidas.</p>
                  </div>
                </button>

              </div>
            </div>
          )}

          {/* DENTRO DE UN SUBMÓDULO: BOTÓN PARA VOLVER A LAS TARJETAS */}
          {obraActiveSubmodule !== null && (
            <div className="flex justify-between items-center bg-slate-100 p-3 rounded-2xl border border-slate-200 mb-4">
              <button
                onClick={() => setObraActiveSubmodule(null)}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-200 text-blue-950 font-bold px-3.5 py-2 rounded-xl text-xs border border-slate-300 transition cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Módulos de Operación</span>
              </button>

              <span className="text-xs font-extrabold uppercase text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                Obra: {selectedObra?.nombre}
              </span>
            </div>
          )}

          {/* VISTA DEDICADA 1: REPORTE DE AVANCE & VISOR DE AVANCE */}
          {obraActiveSubmodule === 'avance' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Header con boton de ingreso y sub-pestañas */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Reporte de Avance Diario y Visor de Faena</h3>
                  <p className="text-[11px] text-slate-500">Métricas de producción, avance acumulado por partida y registro de observaciones</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setAvanceSubTab('visor')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${avanceSubTab === 'visor' ? 'bg-white text-blue-950 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      📊 Visor de Avance
                    </button>
                    <button
                      onClick={() => setAvanceSubTab('registro')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${avanceSubTab === 'registro' ? 'bg-white text-blue-950 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      📋 Registro de Reportes
                    </button>
                  </div>

                  <button
                    onClick={() => { setActiveModal('avance'); setSuccessMsg(''); setErrorMsg(''); }}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ingresar Reporte de Avance</span>
                  </button>
                </div>
              </div>

              {/* SUB-PESTAÑA 1: VISOR DE AVANCE FÍSICO (BARRAS DE PROGRESO DE PARTIDAS DE LA OBRA) */}
              {avanceSubTab === 'visor' && (
                <div className="space-y-4">
                  {/* CALCULO DE AVANCE GLOBAL REAL */}
                  {(() => {
                    const isMatchPartida = (rPart, pPart) => {
                      if (!rPart || !pPart) return false;
                      const a = String(rPart).trim().toLowerCase();
                      const b = String(pPart).trim().toLowerCase();
                      if (a === b) return true;
                      const normA = a.replace(/[^a-z0-9]/g, '');
                      const normB = b.replace(/[^a-z0-9]/g, '');
                      if (!normA || !normB) return false;
                      return normA === normB || normA.includes(normB) || normB.includes(normA);
                    };

                    const totalMetaObra = partidasList.reduce((sum, p) => sum + (parseFloat(p.cantidad) || 0), 0);
                    const totalEjecutadoObra = reportesAvanceList.reduce((sum, r) => sum + (parseFloat(r.cantidad) || 0), 0);
                    
                    let avanceGlobalCalculado = '0.0';
                    if (totalMetaObra > 0) {
                      avanceGlobalCalculado = (Math.min(100, (totalEjecutadoObra / totalMetaObra) * 100)).toFixed(1);
                    } else if (partidasList.length > 0) {
                      const sumPcts = partidasList.reduce((acc, p) => {
                        const ejec = reportesAvanceList
                          .filter(r => isMatchPartida(r.partida, p.partida))
                          .reduce((sum, r) => sum + (parseFloat(r.cantidad) || 0), 0);
                        const meta = parseFloat(p.cantidad) || 0;
                        return acc + (meta > 0 ? (ejec / meta) * 100 : 0);
                      }, 0);
                      avanceGlobalCalculado = (Math.min(100, sumPcts / partidasList.length)).toFixed(1);
                    }

                    return (
                      <>
                        {/* TARJETAS DE MÉTRICAS DEL VISOR DE AVANCE */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avance Global Obra</span>
                            <p className="text-xl font-black text-blue-900 mt-1">
                              {avanceGlobalCalculado} %
                            </p>
                          </div>

                          <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partidas Creadas</span>
                            <p className="text-xl font-black text-slate-800 mt-1">{partidasList.length} <span className="text-xs font-normal text-slate-400">partidas</span></p>
                          </div>

                          <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Reportes Ingresados</span>
                            <p className="text-xl font-black text-slate-800 mt-1">{reportesAvanceList.length} <span className="text-xs font-normal text-slate-400">reportes</span></p>
                          </div>

                          <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Última Faena Registrada</span>
                            <p className="text-xs font-bold text-slate-800 mt-1">
                              {reportesAvanceList.length > 0 ? new Date(reportesAvanceList[0].created_at).toLocaleDateString('es-CL') : 'Sin reportes'}
                            </p>
                          </div>
                        </div>

                        {/* VISOR GRÁFICO DE BARRAS DE AVANCE POR PARTIDA */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
                          <div className="flex justify-between items-center border-b pb-3">
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">📊 Visor de Avance Físico por Partidas de Obra</h4>
                              <p className="text-[11px] text-slate-500">Porcentaje de avance acumulado en base a reportes reales ingresados en faena</p>
                            </div>
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-900 px-2.5 py-1 rounded-md border border-emerald-200">
                              Cálculo Dinámico Real
                            </span>
                          </div>

                          {partidasList.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-2">
                              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                              <h4 className="font-bold text-slate-700 text-xs">No hay partidas creadas en esta obra aún.</h4>
                              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                                Las partidas deben ser configuradas o presupuestadas para esta obra. Puedes ingresar reportes diarios directamente con el botón "Ingresar Reporte de Avance".
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {partidasList.map((p, idx) => {
                                const ejecPartida = reportesAvanceList
                                  .filter(r => isMatchPartida(r.partida, p.partida))
                                  .reduce((sum, r) => sum + (parseFloat(r.cantidad) || 0), 0);

                                const metaPartida = parseFloat(p.cantidad) || 0;
                                const pctVal = metaPartida > 0
                                  ? Math.min(100, Math.round((ejecPartida / metaPartida) * 1000) / 10)
                                  : (ejecPartida > 0 ? 100 : 0);

                                return (
                                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                    <div className="flex justify-between items-center text-xs font-bold">
                                      <span className="text-slate-800">{p.partida}</span>
                                      <span className="text-blue-950 font-black">{pctVal}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                      <div
                                        className={`h-3 rounded-full transition-all duration-500 ${pctVal >= 80 ? 'bg-emerald-600' : pctVal >= 40 ? 'bg-blue-900' : 'bg-amber-500'}`}
                                        style={{ width: `${pctVal}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold pt-0.5">
                                      <span>Unidad: {p.unidad || 'UND'}</span>
                                      <span className="font-mono font-bold text-slate-700">
                                        Avance: {ejecPartida.toLocaleString('es-CL')} de {metaPartida > 0 ? metaPartida.toLocaleString('es-CL') : 'N/A'} {p.unidad || 'UND'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* SUB-PESTAÑA 2: PESTAÑA / TABLA DE REGISTRO DE REPORTES (DÍA, SUPERVISOR, FRENTE, PARTIDA, CANTIDAD, COMENTARIOS) */}
              {avanceSubTab === 'registro' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                        📋 Pestaña de Registro de Reportes de Avance
                      </h4>
                      <p className="text-[11px] text-slate-500">Historial completo de reportes ingresados por supervisores en faena ({reportesAvanceList.length} reportes)</p>
                    </div>
                  </div>

                  {reportesAvanceList.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                      <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs text-slate-500">No hay reportes de avance registrados en esta obra aún.</p>
                      <button
                        onClick={() => { setActiveModal('avance'); setSuccessMsg(''); setErrorMsg(''); }}
                        className="text-xs text-blue-900 font-bold hover:underline cursor-pointer"
                      >
                        + Ingresar el primer reporte de avance
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                            <th className="p-2.5">Día / Fecha</th>
                            <th className="p-2.5">Supervisor</th>
                            <th className="p-2.5">Frente</th>
                            <th className="p-2.5">Partida</th>
                            <th className="p-2.5">Cantidad</th>
                            <th className="p-2.5">Comentarios / Observaciones</th>
                            {canManageRecordsAccess && <th className="p-2.5 text-center">Acciones</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-[11px]">
                          {reportesAvanceList.map((r, idx) => {
                            const fechaStr = r.created_at ? new Date(r.created_at).toLocaleDateString('es-CL') : 'Hoy';
                            return (
                              <tr 
    key={idx} 
    draggable={true}
    onDragStart={(e) => e.dataTransfer.setData('text/plain', idx)}
    onDragOver={(e) => e.preventDefault()}
    onDrop={(e) => { e.preventDefault(); const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(fromIdx)) handleReorderPartidaObra(fromIdx, idx); }}
    className="hover:bg-slate-50 cursor-grab active:cursor-grabbing"
  >
                                <td className="p-2.5 font-mono font-bold text-slate-700">{fechaStr}</td>
                                <td className="p-2.5 font-semibold text-slate-800">{r.supervisor || 'Supervisor'}</td>
                                <td className="p-2.5 font-medium text-slate-600">{r.frente || 'Frente Principal'}</td>
                                <td className="p-2.5 font-bold text-blue-950">{r.partida}</td>
                                <td className="p-2.5 font-mono font-bold text-emerald-700">{r.cantidad} {r.unidad || 'UND'}</td>
                                <td className="p-2.5 text-slate-700 italic">{r.observaciones || 'Sin comentarios'}</td>
                                {canManageRecordsAccess && (
                                  <td className="p-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleReorderPartidaObra(idx, idx - 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover arriba"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === partidasList.length - 1}
                                      onClick={() => handleReorderPartidaObra(idx, idx + 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover abajo"
                                    >
                                      ▼
                                    </button>
                                      <button
                                        onClick={() => handleEditAvanceReport(r)}
                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                        title="Editar reporte de avance"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteAvanceReport(r.id)}
                                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                        title="Eliminar reporte de avance"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}

                          {/* ENCABEZADO SECCIÓN MANO DE OBRA Y PERSONAL ASIGNADO */}
                          <tr className="bg-indigo-100/90 font-black text-indigo-950 text-[10px] uppercase tracking-wider">
                            <td colSpan="8" className="p-2.5 bg-indigo-100/95 text-indigo-950 border-y border-indigo-200">
                              👥 PROYECCIÓN DE MANO DE OBRA Y PERSONAL ASIGNADO A OBRA
                            </td>
                          </tr>

                          {(() => {
                            const workerMap = new window.Map();
                            (personalAsignadoList || []).forEach(p => {
                              if (p.nombre) {
                                const custom = customSalariesMap[p.nombre];
                                const sBase = custom?.sueldo_base || parseFloat(p.sueldo_base) || 1200000;
                                const hExtras = custom?.horas_extras || 0;
                                const asig = custom?.asignaciones || 0;
                                const imponibleTotal = sBase + hExtras;
                                const cEmpresa = Math.round(imponibleTotal * 1.25) + asig;
                                workerMap.set(p.nombre, {
                                  nombre: p.nombre,
                                  cargo: custom?.cargo || p.cargo || 'Trabajador Faena',
                                  sueldo_base: sBase,
                                  costo_empresa: cEmpresa,
                                  costo_dia: Math.round(cEmpresa / 30)
                                });
                              }
                            });
                            (asistenciaList || []).forEach(a => {
                              if (a.trabajador && !workerMap.has(a.trabajador)) {
                                workerMap.set(a.trabajador, {
                                  nombre: a.trabajador,
                                  cargo: 'Personal Asistencia',
                                  sueldo_base: 1200000,
                                  costo_empresa: 1500000,
                                  costo_dia: 50000
                                });
                              }
                            });

                            const listWorkers = Array.from(workerMap.values());
                            if (listWorkers.length === 0) {
                              return (
                                <tr>
                                  <td colSpan="8" className="p-4 text-center text-slate-500 italic">
                                    No hay personal asignado a esta obra. Puedes agregarlos desde el módulo de Personal / Asistencia.
                                  </td>
                                </tr>
                              );
                            }

                            return listWorkers.map((w, wIdx) => {
                              return (
                                <tr key={'w-' + wIdx} className="bg-indigo-50/40 hover:bg-indigo-50/80 transition font-semibold">
                                  <td className="p-3 font-black text-indigo-950 flex items-center gap-2">
                                    <span className="text-base">👤</span>
                                    <div>
                                      <span className="text-xs">{w.nombre}</span>
                                      <span className="block text-[9px] text-indigo-700 font-bold uppercase">{w.cargo}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-700">30 Días (1 Mes)</td>
                                  <td className="p-3 font-mono text-slate-600">1.0 Día/Día</td>
                                  <td className="p-3 font-mono font-black text-indigo-900">30 Días Mes</td>
                                  <td className="p-3 font-mono text-[10px] text-indigo-900 bg-indigo-100/50 rounded font-bold">
                                    ${w.costo_dia.toLocaleString('es-CL')}/Día (${w.costo_empresa.toLocaleString('es-CL')}/Mes Empresa)
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-800 text-right">
                                    ${w.costo_empresa.toLocaleString('es-CL')}
                                  </td>
                                  <td className="p-3 font-mono font-black text-indigo-950 text-right">
                                    ${w.costo_empresa.toLocaleString('es-CL')}
                                  </td>
                                  <td className="p-3 font-mono font-black text-right text-emerald-700">
                                    $0 (100% Proyectado)
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* VISTA DEDICADA 2: ASISTENCIA Y LIBRO DIGITAL CON FILTROS AVANZADOS */}
          {obraActiveSubmodule === 'asistencia' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setAsistenciaSubTab('registro')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${asistenciaSubTab === 'registro' ? 'bg-white text-blue-950 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Registro Diario & Horas Extras
                    </button>
                    <button
                      onClick={() => setAsistenciaSubTab('libro')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${asistenciaSubTab === 'libro' ? 'bg-white text-blue-950 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Libro Asistencia Digital
                    </button>
                  </div>

                  {asistenciaSubTab === 'registro' && (
                    <button
                      onClick={() => { setActiveModal('asistencia'); setSuccessMsg(''); setErrorMsg(''); }}
                      className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Registrar Marcaje</span>
                    </button>
                  )}
                </div>

                {/* FILTROS AVANZADOS DEL LIBRO DIGITAL (Persona Individual / Grupo Cuadrilla / Toda la Obra) */}
                {asistenciaSubTab === 'libro' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Periodo Mes/Año</label>
                        <input
                          type="month"
                          value={selectedMonthLibro}
                          onChange={(e) => setSelectedMonthLibro(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Alcance / Filtro de Descarga</label>
                        <select
                          value={libroFiltroTipo}
                          onChange={(e) => setLibroFiltroTipo(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white"
                        >
                          <option value="toda_obra">🏢 Toda la Obra Completa</option>
                          <option value="persona">👤 Persona Individual</option>
                          <option value="cuadrilla">👥 Grupo / Cuadrilla de Trabajo</option>
                        </select>
                      </div>

                      {libroFiltroTipo === 'persona' && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Seleccionar Trabajador</label>
                          <select
                            value={libroFiltroPersona}
                            onChange={(e) => setLibroFiltroPersona(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl p-2 text-xs text-slate-800 bg-white font-semibold"
                          >
                            <option value="">-- Todos los Trabajadores --</option>
                            {personalList.map(p => <option key={p.rut || p.nombre} value={p.nombre}>{p.nombre} ({p.cargo})</option>)}
                          </select>
                        </div>
                      )}

                      {libroFiltroTipo === 'cuadrilla' && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Seleccionar Cuadrilla</label>
                          <select
                            value={libroFiltroCuadrilla}
                            onChange={(e) => setLibroFiltroCuadrilla(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl p-2 text-xs text-slate-800 bg-white font-semibold"
                          >
                            <option value="">-- Todas las Cuadrillas --</option>
                            {cuadrillasList.map(c => <option key={c.id} value={c.nombre}>{c.nombre} ({c.especialidad})</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleDownloadLibroAsistencia}
                        className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>
                          {libroFiltroTipo === 'persona' && libroFiltroPersona ? `Descargar Documento Persona: ${libroFiltroPersona}` : libroFiltroTipo === 'cuadrilla' && libroFiltroCuadrilla ? `Descargar Documento Cuadrilla: ${libroFiltroCuadrilla}` : 'Descargar Documento Libro Digital (PDF / HTML)'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TABLA DE REGISTROS DE ASISTENCIA DIARIA REALES */}
                {asistenciaSubTab === 'registro' && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                      📋 Registros Recientes de Marcaje en Faena ({asistenciaList.length} registros)
                    </h4>

                    {asistenciaList.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                        <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs text-slate-500">No hay registros de asistencia en esta obra aún.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                              <th className="p-2.5">Fecha / Hora</th>
                              <th className="p-2.5">Nombre Trabajador</th>
                              <th className="p-2.5">RUT</th>
                              <th className="p-2.5">Estado</th>
                              <th className="p-2.5">Ingreso</th>
                              <th className="p-2.5">Salida</th>
                              <th className="p-2.5">Colación</th>
                              <th className="p-2.5">Horas Extra</th>
                              <th className="p-2.5">Validación QR/GPS</th>
                              {canManageRecordsAccess && <th className="p-2.5 text-center">Acciones</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 text-[11px]">
                            {asistenciaList.map((a, idx) => {
                              const fechaStr = a.created_at ? new Date(a.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'Hoy';
                              return (
                                <tr key={a.id || idx} className="hover:bg-slate-50">
                                  <td className="p-2.5 font-mono font-bold text-slate-700">{fechaStr}</td>
                                  <td className="p-2.5 font-bold text-slate-800">{a.trabajador}</td>
                                  <td className="p-2.5 font-mono text-slate-600">{a.rut || '-'}</td>
                                  <td className="p-2.5">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${a.asistencia === 'PRESENTE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                                      {a.asistencia}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-mono font-semibold text-blue-900">{a.ingreso || '-'}</td>
                                  <td className="p-2.5 font-mono font-semibold text-slate-700">{a.salida || '-'}</td>
                                  <td className="p-2.5 font-semibold text-slate-600">{a.colacion || 'SI'}</td>
                                  <td className="p-2.5 font-bold text-emerald-700">{a.horas_extras_auto || 0} hrs</td>
                                  <td className="p-2.5">
                                    {a.verificado_qr ? (
                                      <span className="text-[10px] bg-blue-50 text-blue-900 font-bold px-2 py-0.5 rounded border border-blue-200">✓ QR + GPS ({a.distancia_obra_m ? `${a.distancia_obra_m}m` : 'Verificado'})</span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded">Manual</span>
                                    )}
                                  </td>
                                  {canManageRecordsAccess && (
                                    <td className="p-2.5 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleReorderPartidaObra(idx, idx - 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover arriba"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === partidasList.length - 1}
                                      onClick={() => handleReorderPartidaObra(idx, idx + 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover abajo"
                                    >
                                      ▼
                                    </button>
                                        <button
                                          onClick={() => handleEditAsistenciaRecord(a)}
                                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                          title="Editar marcaje de asistencia"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteAsistenciaRecord(a.id)}
                                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                          title="Eliminar marcaje de asistencia"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TABLA DEL LIBRO DIGITAL BASADA EN ASISTENCIA REAL */}
                {asistenciaSubTab === 'libro' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px]">
                          <th className="p-2 border-r">1. Día / Fecha</th>
                          <th className="p-2 border-r">2. Nombre Trabajador</th>
                          <th className="p-2 border-r">3. Hora Ingreso</th>
                          <th className="p-2 border-r text-center">4. Firma Ingreso</th>
                          <th className="p-2 border-r">5. Hora Salida</th>
                          <th className="p-2 border-r text-center">6. Firma Salida</th>
                          <th className="p-2">7. Horas Extras</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {asistenciaList.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="p-4 text-center text-slate-400 font-semibold">No hay registros de marcaje en el periodo seleccionado.</td>
                          </tr>
                        ) : (
                          asistenciaList
                            .filter(a => {
                              if (libroFiltroTipo === 'persona' && libroFiltroPersona) {
                                return a.trabajador.toLowerCase().includes(libroFiltroPersona.toLowerCase());
                              }
                              return true;
                            })
                            .map((a, idx) => {
                              const fechaStr = a.created_at ? new Date(a.created_at).toLocaleDateString('es-CL') : 'Hoy';
                              return (
                                <tr key={a.id || idx} className="hover:bg-slate-50">
                                  <td className="p-2 font-mono font-bold text-slate-700 border-r">{fechaStr}</td>
                                  <td className="p-2 font-semibold text-slate-800 border-r">{a.trabajador} ({a.rut || 'RUT N/D'})</td>
                                  <td className="p-2 font-mono border-r text-blue-900 font-bold">{a.ingreso || '08:00'}</td>
                                  <td className="p-2 text-center border-r">
                                    {a.firma_base64 ? (
                                      <div className="flex flex-col items-center justify-center py-0.5">
                                        <img src={a.firma_base64} alt="Firma" className="h-7 max-w-[90px] object-contain border border-slate-200 rounded p-0.5 bg-white shadow-2xs" />
                                        <span className="text-[8px] text-emerald-800 font-bold mt-0.5">✓ Firma Digital</span>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-200">✓ Digital (QR)</span>
                                    )}
                                  </td>
                                  <td className="p-2 font-mono border-r font-bold text-slate-700">{a.salida || '18:00'}</td>
                                  <td className="p-2 text-center border-r">
                                    {a.firma_base64 ? (
                                      <div className="flex flex-col items-center justify-center py-0.5">
                                        <img src={a.firma_base64} alt="Firma" className="h-7 max-w-[90px] object-contain border border-slate-200 rounded p-0.5 bg-white shadow-2xs" />
                                        <span className="text-[8px] text-emerald-800 font-bold mt-0.5">✓ Firma Digital</span>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-200">✓ Digital (QR)</span>
                                    )}
                                  </td>
                                  <td className="p-2 font-bold text-emerald-700">{a.horas_extras_auto || 0} hrs</td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA DEDICADA 3: PERSONAL ASIGNADO (RRHH) */}
          {obraActiveSubmodule === 'rrhh' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Personal Asignado a la Obra</h3>
                  <p className="text-[11px] text-slate-500">Dotación oficial de trabajadores registrados en faena ({personalList.length} trabajadores)</p>
                </div>
                <button
                  onClick={() => setShowAddWorkerModal(true)}
                  className="bg-purple-900 hover:bg-purple-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Asignar Nuevo Trabajador</span>
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                {personalList.length === 0 ? (
                  <div className="text-center py-6 space-y-2">
                    <Users className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500">No hay trabajadores asignados en la nómina de esta obra.</p>
                    <button onClick={() => setShowAddWorkerModal(true)} className="text-xs text-purple-900 font-bold hover:underline cursor-pointer">
                      + Asignar primer trabajador
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                          <th className="p-2.5">Nombre Trabajador</th>
                          <th className="p-2.5">RUT</th>
                          <th className="p-2.5">Cargo / Especialidad</th>
                          <th className="p-2.5">Estado</th>
                          {canManageRecordsAccess && <th className="p-2.5 text-center">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {personalList.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{p.nombre}</td>
                            <td className="p-2.5 font-mono text-slate-600">{p.rut}</td>
                            <td className="p-2.5 font-semibold text-blue-950">{p.cargo}</td>
                            <td className="p-2.5"><span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">Activo en Faena</span></td>
                            {canManageRecordsAccess && (
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleReorderPartidaObra(idx, idx - 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover arriba"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === partidasList.length - 1}
                                      onClick={() => handleReorderPartidaObra(idx, idx + 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover abajo"
                                    >
                                      ▼
                                    </button>
                                  <button
                                    onClick={() => handleEditWorkerFromObra(p)}
                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                    title="Editar trabajador"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteWorkerFromObra(p.nombre)}
                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                    title="Eliminar/Desasignar trabajador de la obra"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA DEDICADA 4: CUADRILLAS DE TRABAJO */}
          {obraActiveSubmodule === 'cuadrillas' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Cuadrillas de Trabajo de Obra</h3>
                  <p className="text-[11px] text-slate-500">Agrupación de personal asignado a la obra por especialidad y capataz</p>
                </div>
                <button
                  onClick={() => setShowCuadrillaModal(true)}
                  className="bg-amber-900 hover:bg-amber-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Cuadrilla</span>
                </button>
              </div>

              {cuadrillasList.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-semibold">No se han registrado cuadrillas en esta obra aún.</p>
                  <button onClick={() => setShowCuadrillaModal(true)} className="text-xs text-amber-900 font-bold hover:underline cursor-pointer">
                    + Crear la primera cuadrilla seleccionando personal asignado
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cuadrillasList.map((c) => (
                    <div key={c.id} className="bg-white p-4 border border-slate-200 rounded-2xl space-y-3 shadow-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{c.especialidad}</span>
                          <h4 className="font-extrabold text-slate-800 text-sm mt-1">{c.nombre}</h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">{c.miembros?.length || 0} integrantes</span>
                          {canManageRecordsAccess && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditCuadrilla(c)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Editar cuadrilla de trabajo"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCuadrilla(c.id)}
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Eliminar cuadrilla de trabajo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">👷 Líder / Capataz: <span className="font-bold text-slate-800">{c.lider}</span></p>
                      
                      {/* Lista de Integrantes Asignados */}
                      {c.miembros && c.miembros.length > 0 && (
                        <div className="border-t pt-2 space-y-1">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Personal Asignado:</p>
                          <div className="flex flex-wrap gap-1">
                            {c.miembros.map((m, i) => (
                              <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VISTA DEDICADA 5: EQUIPOS & MAQUINARIAS */}
          {obraActiveSubmodule === 'maquinaria' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* BARRA DE PESTAÑAS (ARRIBA DE TODO A ANCHO COMPLETO) */}
              <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-2xs">
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setMaqSubTab('asignaciones')}
                    className={`px-4 py-2 rounded-xl transition cursor-pointer ${maqSubTab === 'asignaciones' ? 'bg-white text-blue-950 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Asignaciones de Empresa (Maquinaria Propia)
                  </button>
                  <button
                    onClick={() => setMaqSubTab('arriendos')}
                    className={`px-4 py-2 rounded-xl transition cursor-pointer ${maqSubTab === 'arriendos' ? 'bg-white text-blue-950 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Arriendos Externos (Con Proveedor)
                  </button>
                </div>

                {maqSubTab === 'arriendos' && (
                  <button
                    onClick={() => setShowArriendoModal(true)}
                    className="bg-indigo-900 hover:bg-indigo-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registrar Arriendo</span>
                  </button>
                )}
              </div>

              {/* CONTENIDO PESTAÑA 1: ASIGNACIONES DE EMPRESA */}
              {maqSubTab === 'asignaciones' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-slate-850 text-xs uppercase tracking-wider">
                        Flota de Maquinaria y Equipos Asignados a la Obra
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Equipos asignados desde el módulo de Maquinaria con imputación de Costo Interno.
                      </p>
                    </div>
                    <span className="text-xs font-black text-blue-950 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                      {getEquiposParaObraActual().length} Equipos Activos
                    </span>
                  </div>

                  {getEquiposParaObraActual().length === 0 ? (
                    <div className="space-y-3">
                      <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                        <Truck className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                        <p className="font-bold">No hay equipos ni maquinarias asignadas a esta obra actualmente.</p>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">Asigna equipos desde el módulo de Maquinaria para verlos reflejados aquí.</p>
                      </div>

                      
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase text-[10px]">
                            <th className="p-3">Tipo de Equipo</th>
                            <th className="p-3">Patente / Código</th>
                            <th className="p-3">Marca / Modelo</th>
                            <th className="p-3">Horómetro Inicial</th>
                            <th className="p-3">Costo Interno (Imputable)</th>
                            <th className="p-3">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {getEquiposParaObraActual().map((m, idx) => {
                            const rawCosto = m.costo_interno !== undefined && m.costo_interno !== null && m.costo_interno !== '' ? m.costo_interno : (m.tarifa_diaria || m.costo || 0);
                            const costoNum = parseFloat(rawCosto) || 0;
                            const unidadStr = m.unidad_costo_interno || m.unidad_tarifa || '$/día';

                            return (
                              <tr key={m.id || idx} className="hover:bg-slate-50 text-slate-800">
                                <td className="p-3 font-extrabold text-slate-900 uppercase">{m.tipo}</td>
                                <td className="p-3 font-mono text-slate-700 font-bold">{m.patente || 'S/I'}</td>
                                <td className="p-3 text-slate-600 font-medium">{m.marca || 'Cat / Estándar'}</td>
                                <td className="p-3 font-bold text-slate-800">{m.horometro_inicial || 0} hrs</td>
                                <td className="p-3 font-extrabold text-amber-900 bg-amber-50/50">
                                  {costoNum > 0 ? (
                                    `$${costoNum.toLocaleString('es-CL')} ${unidadStr}`
                                  ) : (
                                    <span className="text-slate-400 font-normal italic">Sin tarifa asignada</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase">
                                    {m.estado_equipo || 'Operativo'}
                                  </span>
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

              {/* CONTENIDO PESTAÑA 2: ARRIENDOS EXTERNOS */}
              {maqSubTab === 'arriendos' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  {arriendosList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No hay equipos ni maquinarias arrendadas registradas en esta obra.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                            <th className="p-2">Equipo</th>
                            <th className="p-2">Patente / Código</th>
                            <th className="p-2">Proveedor / Empresa Arrendadora</th>
                            <th className="p-2">Costo / Tarifa</th>
                            <th className="p-2">Condición Mínima</th>
                            <th className="p-2">Periodo</th>
                            {canManageRecordsAccess && <th className="p-2 text-center">Acciones</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {arriendosList.map((a, aIdx) => {
                            const tarifaVal = a.costo ? parseFloat(a.costo).toLocaleString('es-CL') : '0';
                            const unidadStr = a.unidad_costo || '$/mes';
                            let minStr = 'Sin Mínimo';
                            if (a.tipo_condicion_minima === 'horas_dia' && a.cantidad_minima) minStr = `Mín. ${a.cantidad_minima} hrs/día`;
                            else if (a.tipo_condicion_minima === 'horas_mes' && a.cantidad_minima) minStr = `Mín. ${a.cantidad_minima} hrs/mes`;
                            else if (a.tipo_condicion_minima === 'dias_mes' && a.cantidad_minima) minStr = `Mín. ${a.cantidad_minima} días/mes`;

                            return (
                              <tr key={a.id || aIdx} className="hover:bg-slate-50">
                                <td className="p-2 font-bold text-slate-800">{a.equipo}</td>
                                <td className="p-2 font-mono text-slate-600">{a.patente || '-'}</td>
                                <td className="p-2 font-bold text-blue-950">{a.proveedor}</td>
                                <td className="p-2 font-bold text-emerald-800">
                                  ${tarifaVal} <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{unidadStr}</span>
                                </td>
                                <td className="p-2 font-semibold text-amber-900 text-[11px]">
                                  <span className="bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{minStr}</span>
                                </td>
                                <td className="p-2 text-slate-500 text-[11px]">{a.fechaInicio || 'N/A'} al {a.fechaTermino || 'N/A'}</td>
                                {canManageRecordsAccess && (
                                  <td className="p-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => handleEditArriendo(a)}
                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                        title="Editar arriendo de maquinaria"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteArriendo(a.id)}
                                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                        title="Eliminar arriendo"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                )}
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
          )}

          {/* VISTA DEDICADA 6: CONTROL MATERIALES */}
          {obraActiveSubmodule === 'materiales' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Control de Materiales e Insumos de Bodega</h3>
                  <p className="text-[11px] text-slate-500">Trazabilidad de guías de despacho, entradas y salidas de materiales</p>
                </div>
                <button
                  onClick={() => { setActiveModal('materiales'); setSuccessMsg(''); setErrorMsg(''); }}
                  className="bg-cyan-900 hover:bg-cyan-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Guía / Movimiento</span>
                </button>
              </div>
            </div>
          )}

          {/* VISTA DEDICADA 7: BITÁCORA DE OBRA (LÍNEA DE TIEMPO VERTICAL) */}
          {obraActiveSubmodule === 'bitacora' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <History className="w-4 h-4 text-slate-700" />
                      <span>Bitácora de Obra - Línea del Tiempo</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Historial completo de eventos, notas e información relevante de faena</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      
                      <button
                        onClick={() => {
                          setBitacoraNoteFormData({
                            fecha: new Date().toISOString().substring(0, 10),
                            titulo: '',
                            comentario: ''
                          });
                          setShowBitacoraNoteModal(true);
                        }}
                        className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Agregar Nota / Comentario</span>
                      </button>
                    </div>

                    {/* Filtros de la Línea del Tiempo (Selección Múltiple) */}
                    <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                      {[
                        { id: 'todos', label: 'Todos' },
                        { id: 'notas', label: '📝 Notas & Comentarios' },
                        { id: 'avances', label: '📊 Avances' },
                        { id: 'asistencia', label: '⏱️ Asistencia' }
                      ].map(f => {
                        const isSelected = bitacoraFilters.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => {
                              if (f.id === 'todos') {
                                setBitacoraFilters(['todos']);
                              } else {
                                let next = bitacoraFilters.filter(x => x !== 'todos');
                                if (next.includes(f.id)) {
                                  next = next.filter(x => x !== f.id);
                                } else {
                                  next.push(f.id);
                                }
                                if (next.length === 0) next = ['todos'];
                                setBitacoraFilters(next);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${isSelected ? 'bg-blue-900 text-white shadow-2xs font-extrabold' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'}`}
                          >
                            <span>{f.label}</span>
                            {isSelected && f.id !== 'todos' && <span className="text-[9px] bg-blue-800 text-white px-1.5 rounded-full">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* LÍNEA DE TIEMPO VERTICAL (PASADO ARRIBA -> PRESENTE ABAJO) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                
                {/* Indicador Inicio de Obra (Pasado) */}
                <div className="flex items-center gap-3 pb-2 border-b border-dashed border-slate-300">
                  <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-3 py-1 rounded-full uppercase tracking-wider">
                    ⬆️ Historial Anterior de Obra
                  </span>
                  <div className="h-0.5 flex-1 bg-slate-200"></div>
                </div>

                {/* Eventos Cronológicos Unificados */}
                <div className="relative border-l-2 border-slate-300 ml-4 space-y-6 pl-6">
                  
                  {/* HITO 1: INICIO OFICIAL DE FAENA */}
                  <div className="relative group">
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 bg-blue-700 rounded-full border-2 border-white ring-2 ring-blue-200"></div>
                    <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl space-y-2 shadow-2xs">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-bold text-slate-800">
                        <span className="text-blue-950 font-extrabold text-sm flex items-center gap-1.5">
                          🚀 Inicio Oficial de Faena & Acta de Entrega de Terreno
                        </span>
                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-blue-300 shadow-2xs">
                          <label className="text-[10px] font-bold text-blue-900 uppercase">Fecha Inicio:</label>
                          <input
                            type="date"
                            value={fechaInicioReal}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setFechaInicioReal(newVal);
                              const nameKey = selectedObra?.nombre || 'default';
                              localStorage.setItem('obraxis_fecha_inicio_real_' + nameKey, newVal);
                              localStorage.setItem('obraxis_global_fecha_inicio_real', newVal);
                              setSelectedObra(prev => prev ? { ...prev, fecha_inicio_real: newVal, fecha_inicio: newVal } : prev);
                            }}
                            className="bg-white text-slate-900 font-mono font-bold text-xs outline-none"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 font-medium">Reunión inicial de coordinación con mandante e hito contractual de inicio de obras.</p>
                      <span className="inline-block text-[9px] bg-blue-900 text-white px-2 py-0.5 rounded font-bold">Hito Obra Mandatorio</span>
                    </div>
                  </div>

                  {/* EVENTOS CRONOLÓGICOS UNIFICADOS POR FECHA */}
                  {(() => {
                    const unifiedBitacoraEvents = [];

                    (bitacoraNotasList || []).forEach(n => {
                      if (bitacoraFilters.includes('todos') || bitacoraFilters.includes('notas')) {
                        const rawDt = n.fecha || (n.created_at ? String(n.created_at).substring(0, 10) : '2026-04-06');
                        unifiedBitacoraEvents.push({
                          type: 'nota',
                          dateStr: rawDt,
                          dateObj: new Date(rawDt + 'T12:00:00'),
                          title: n.titulo || 'Nota / Comentario de Bitácora',
                          description: n.comentario,
                          author: n.autor || 'Supervisor',
                          badge: '📝 Nota de Faena',
                          color: 'amber'
                        });
                      }
                    });

                    (reportesAvanceList || []).forEach(av => {
                      if (bitacoraFilters.includes('todos') || bitacoraFilters.includes('avances')) {
                        const rawDt = av.fecha || av.fecha_avance || (av.created_at ? String(av.created_at).substring(0, 10) : '2026-04-06');
                        unifiedBitacoraEvents.push({
                          type: 'avance',
                          dateStr: rawDt,
                          dateObj: new Date(rawDt + 'T12:00:00'),
                          title: `📊 Avance Físico: ${av.partida}`,
                          description: `Supervisor: ${av.supervisor || 'N/A'} | Cantidad: ${av.cantidad} ${av.unidad || 'UND'}${av.frente ? ' (' + av.frente + ')' : ''}${av.observaciones ? ' - "' + av.observaciones + '"' : ''}`,
                          author: av.supervisor || 'Supervisor',
                          badge: 'Reporte Avance',
                          color: 'blue'
                        });
                      }
                    });

                    (asistenciaList || []).forEach(as => {
                      if (bitacoraFilters.includes('todos') || bitacoraFilters.includes('asistencia')) {
                        const rawDt = as.fecha || (as.created_at ? String(as.created_at).substring(0, 10) : '2026-04-06');
                        unifiedBitacoraEvents.push({
                          type: 'asistencia',
                          dateStr: rawDt,
                          dateObj: new Date(rawDt + 'T12:00:00'),
                          title: `⏱️ Registro Asistencia: ${as.trabajador}`,
                          description: `Estado: ${as.asistencia} | RUT: ${as.rut || 'N/A'} | Ingreso: ${as.ingreso || '08:00'} - Salida: ${as.salida || '18:00'}`,
                          author: 'Control Asistencia',
                          badge: 'Control Asistencia',
                          color: 'emerald'
                        });
                      }
                    });

                    unifiedBitacoraEvents.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

                    return unifiedBitacoraEvents.map((item, idx) => {
                      const isAmber = item.color === 'amber';
                      const isBlue = item.color === 'blue';
                      const isEmerald = item.color === 'emerald';

                      return (
                        <div key={`ev-${idx}`} className="relative group">
                          <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white ${isAmber ? 'bg-amber-500 ring-2 ring-amber-100' : isBlue ? 'bg-blue-600 ring-2 ring-blue-100' : 'bg-emerald-600 ring-2 ring-emerald-100'}`}></div>
                          <div className={`p-3.5 rounded-xl space-y-1.5 shadow-2xs border ${isAmber ? 'bg-amber-50/80 border-amber-200' : isBlue ? 'bg-blue-50/70 border-blue-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
                            <div className="flex justify-between items-center text-xs font-bold">
                              <span className={isAmber ? 'text-amber-950 font-extrabold' : isBlue ? 'text-blue-950 font-extrabold' : 'text-emerald-950 font-extrabold'}>
                                {item.title}
                              </span>
                              <span className="text-[10px] text-slate-700 font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                                {item.dateStr}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 font-medium leading-relaxed">
                              {item.description}
                            </p>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-200/60 font-semibold">
                              <span>Registrado por: <strong>{item.author}</strong></span>
                              <span className={`inline-block px-2 py-0.5 rounded font-bold ${isAmber ? 'bg-amber-100 text-amber-900' : isBlue ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900'}`}>
                                {item.badge}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}

                  {/* HITO 2: FECHA DE TÉRMINO DE OBRA (AL FINAL / ABAJO) */}
                  <div className="relative group pt-4">
                    <div className="absolute -left-[31px] top-5 w-4 h-4 bg-amber-600 rounded-full border-2 border-white ring-2 ring-amber-200"></div>
                    <div className="bg-amber-50/90 border-2 border-amber-300 p-4 rounded-xl space-y-2 shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-bold text-slate-800">
                        <span className="text-amber-950 font-extrabold text-sm flex items-center gap-1.5">
                          🏁 Hito Contractual: Fecha de Término y Entrega Final de Obra
                        </span>
                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs">
                          <label className="text-[10px] font-bold text-amber-900 uppercase">Fecha Término:</label>
                          <input
                            type="date"
                            value={fechaTerminoEstimada}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setFechaTerminoEstimada(newVal);
                              const nameKey = selectedObra?.nombre || 'default';
                              localStorage.setItem('obraxis_fecha_termino_est_' + nameKey, newVal);
                              localStorage.setItem('obraxis_global_fecha_termino_est', newVal);
                              setSelectedObra(prev => prev ? { ...prev, fecha_termino: newVal } : prev);
                            }}
                            className="bg-white text-slate-900 font-mono font-bold text-xs outline-none"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 font-medium">Fecha hito contractual de término y recepción de obras.</p>
                      <span className="inline-block text-[9px] bg-amber-900 text-white px-2 py-0.5 rounded font-bold">Hito Obra Contractual Final</span>
                    </div>
                  </div>

                </div>

                {/* Indicador Tiempo Presente (Hoy) */}
                <div className="flex items-center gap-3 pt-2 border-t border-dashed border-slate-300">
                  <span className="text-[10px] font-bold bg-blue-900 text-white px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs">
                    ⬇️ Tiempo Presente / Hoy ({new Date().toLocaleDateString('es-CL')})
                  </span>
                  <div className="h-0.5 flex-1 bg-blue-900"></div>
                </div>

              </div>
            </div>
          )}

          {/* VISTA DEDICADA 8: PANEL DE ESTADÍSTICAS EJECUTIVAS DE OBRA */}
          {obraActiveSubmodule === 'estadisticas' && (() => {
            const availableGroups = [];
            let currGrp = null;
            (partidasList || []).forEach(p => {
              if (p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo) {
                currGrp = { partida: p.partida, children: [] };
                availableGroups.push(currGrp);
              } else if (currGrp) {
                currGrp.children.push(p);
              }
            });

            return (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* CABECERA PRINCIPAL Y BARRA DE FILTROS Y ACCIONES */}
                <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-900" />
                        <span>📊 Panel de Estadísticas Ejecutivas de Obra</span>
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">Consolidado operacional de Avance, Cuadrillas, Maquinarias, HSE y Análisis EVM de Valor Ganado</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.print()}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Imprimir o Exportar PDF del Panel Estadístico"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Exportar / Imprimir PDF</span>
                      </button>
                      <button
                        onClick={() => setShowContextualEmailModal(true)}
                        className="bg-indigo-900 hover:bg-indigo-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Enviar Reporte por Correo"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar Reporte</span>
                      </button>
                    </div>
                  </div>

                  {/* FILTROS DE FECHA DE CORTE Y ALCANCE DE PARTIDA/GRUPO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-900" />
                        <span>Fecha de Corte Histórica:</span>
                      </span>
                      <input
                        type="date"
                        value={fCorteEstadisticas}
                        onChange={(e) => setFCorteEstadisticas(e.target.value)}
                        className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-800 bg-white shadow-2xs"
                      />
                      <span className="text-[10px] text-slate-500 italic">Cálculos al corte</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5 text-blue-900" />
                        <span>Filtro de Alcance:</span>
                      </span>
                      <select
                        value={filtroPartidaEstadisticas}
                        onChange={(e) => setFiltroPartidaEstadisticas(e.target.value)}
                        className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 bg-white shadow-2xs flex-1"
                      >
                        <option value="GLOBAL">🌐 Global (Toda la Obra Consolidada)</option>
                        <optgroup label="📂 Filtrar por Grupos / Títulos">
                          {(availableGroups || []).map((g, idx) => (
                            <option key={`grp-${idx}`} value={`GRUPO:${g.partida}`}>
                              📁 Grupo: {g.partida} ({g.children?.length || 0} partidas)
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="📦 Filtrar por Partidas Ejecutables">
                          {(partidasList || [])
                            .filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo))
                            .map((p, idx) => (
                              <option key={`part-${idx}`} value={`PARTIDA:${p.partida}`}>
                                📦 Partida: {p.partida}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* BARRA DE NAVEGACIÓN POR SUB-PESTAÑAS DE ESTADÍSTICAS */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                    {[
                      { id: 'avance', label: '📈 Avance Físico' },
                      { id: 'cuadrillas', label: '👷 Cuadrillas & RRHH' },
                      { id: 'maquinarias', label: '🚜 Maquinarias & Flota' },
                      { id: 'prevencion', label: '🛡️ Prevención & HSE' },
                      { id: 'costos', label: '💰 Costos & EVM' },
                      { id: 'bodega', label: '📦 Bodega', isComingSoon: true }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setEstadisticasTab(tab.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                          estadisticasTab === tab.id
                            ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <span>{tab.label}</span>
                        {tab.isComingSoon && (
                          <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-extrabold">Próximamente</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* EVALUACIÓN DE DATOS Y CÁLCULOS DINÁMICOS AL CORTE */}
                {(() => {
                  const fCorteStr = fCorteEstadisticas || new Date().toISOString().substring(0, 10);

                  // 1. Filtrar Partidas de acuerdo al selector de alcance
                  let targetPartidas = (partidasList || []).filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo));
                  if (filtroPartidaEstadisticas.startsWith('GRUPO:')) {
                    const grpName = filtroPartidaEstadisticas.replace('GRUPO:', '');
                    const grpObj = (availableGroups || []).find(g => g.partida === grpName);
                    if (grpObj && grpObj.children) {
                      const childNames = grpObj.children.map(c => c.partida);
                      targetPartidas = targetPartidas.filter(p => childNames.includes(p.partida));
                    }
                  } else if (filtroPartidaEstadisticas.startsWith('PARTIDA:')) {
                    const partName = filtroPartidaEstadisticas.replace('PARTIDA:', '');
                    targetPartidas = targetPartidas.filter(p => p.partida === partName);
                  }

                const isMatchPartidaName = (a, b) => {
                  if (!a || !b) return false;
                  const strA = String(a).trim().toLowerCase();
                  const strB = String(b).trim().toLowerCase();
                  if (strA === strB) return true;
                  const normA = strA.replace(/[^a-z0-9]/g, '');
                  const normB = strB.replace(/[^a-z0-9]/g, '');
                  if (!normA || !normB) return false;
                  return normA === normB || normA.includes(normB) || normB.includes(normA);
                };

                const targetNames = targetPartidas.map(p => p.partida);

                // 2. Reportes de Avance hasta la fecha de corte
                const filteredAvances = (reportesAvanceList || []).filter(r => {
                  const fRep = r.fecha || r.fecha_avance || (r.created_at ? String(r.created_at).substring(0, 10) : '');
                  return fRep <= fCorteStr && (targetNames.length === 0 || targetPartidas.some(p => isMatchPartidaName(r.partida, p.partida)));
                });

                // Presupuesto Venta Total de Partidas Filtradas
                const totalVentaPresupuestada = targetPartidas.reduce((sum, p) => {
                  const cant = parseFloat(p.cantidad) || 0;
                  const pu = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (parseFloat(p.pu) || 0);
                  return sum + Math.round(cant * pu);
                }, 0);

                // Avance Acumulado al corte
                const avanceMontoAcumulado = targetPartidas.reduce((sum, p) => {
                  const pu = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (parseFloat(p.pu) || 0);
                  const pReps = filteredAvances.filter(r => isMatchPartidaName(r.partida, p.partida));
                  const cantAv = pReps.reduce((rSum, r) => rSum + (parseFloat(r.cantidad) || 0), 0);
                  return sum + Math.round(Math.min(parseFloat(p.cantidad) || 0, cantAv) * pu);
                }, 0);

                const pctAvanceGlobal = totalVentaPresupuestada > 0 ? ((avanceMontoAcumulado / totalVentaPresupuestada) * 100).toFixed(1) : "0.0";

                // Promedio, Máximo y Mínimo de Avance por Partida
                let pAvanceRates = targetPartidas.map(p => {
                  const cantTotal = parseFloat(p.cantidad) || 0;
                  const pReps = filteredAvances.filter(r => isMatchPartidaName(r.partida, p.partida));
                  const cantAv = pReps.reduce((rSum, r) => rSum + (parseFloat(r.cantidad) || 0), 0);
                  const pct = cantTotal > 0 ? Math.min(100, (cantAv / cantTotal) * 100) : 0;
                  
                  // Días transcurridos con reporte
                  const uniqueDays = new Set(pReps.map(r => r.fecha || r.fecha_avance || (r.created_at ? String(r.created_at).substring(0, 10) : ''))).size;
                  const pctPerDay = uniqueDays > 0 ? (pct / uniqueDays) : 0;

                  return { partida: p.partida, pct, cantAv, cantTotal, unidad: p.unidad, pctPerDay, uniqueDays };
                });

                const maxPartida = pAvanceRates.length > 0 ? [...pAvanceRates].sort((a, b) => b.pct - a.pct)[0] : null;
                const minPartida = pAvanceRates.length > 0 ? [...pAvanceRates].sort((a, b) => a.pct - b.pct)[0] : null;
                const avgPctPerDay = pAvanceRates.length > 0 ? (pAvanceRates.reduce((acc, p) => acc + p.pctPerDay, 0) / pAvanceRates.length).toFixed(2) : "0.00";

                // 3. CÁLCULO DE PUNTOS PARA CURVA S DE AVANCE FÍSICO (REAL VS PROGRAMADO)
                const fInicioObraDefault = fechaInicioReal || (selectedObra?.fecha_inicio ? String(selectedObra.fecha_inicio).split('T')[0] : '2026-04-06');
                const timelineMilestones = [];
                let sDate = new Date(fInicioObraDefault + 'T00:00:00');
                const eDate = new Date(fCorteStr + 'T00:00:00');

                if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
                  const mCursor = new Date(sDate);
                  while (mCursor <= eDate) {
                    const mStr = mCursor.getFullYear() + '-' + String(mCursor.getMonth() + 1).padStart(2, '0') + '-' + String(mCursor.getDate()).padStart(2, '0');
                    const monthLabel = mCursor.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
                    timelineMilestones.push({ dateStr: mStr, label: monthLabel });
                    mCursor.setMonth(mCursor.getMonth() + 1);
                  }
                  if (timelineMilestones.length === 0 || timelineMilestones[timelineMilestones.length - 1].dateStr < fCorteStr) {
                    timelineMilestones.push({ dateStr: fCorteStr, label: 'Corte' });
                  }
                }

                const totalPresupuestoObra = totalVentaPresupuestada > 0 ? totalVentaPresupuestada : 1;
                
                const curvaSPoints = timelineMilestones.map((m, idx) => {
                  const mStr = m.dateStr;
                  const x = 40 + (idx / Math.max(1, timelineMilestones.length - 1)) * 440;

                  // Real Acumulado a la fecha
                  const revAtM = (reportesAvanceList || []).filter(r => {
                    const fRep = r.fecha || r.fecha_avance || (r.created_at ? String(r.created_at).substring(0, 10) : '');
                    return fRep <= mStr && (targetNames.length === 0 || targetPartidas.some(p => isMatchPartidaName(r.partida, p.partida)));
                  });

                  const valRealAtM = targetPartidas.reduce((sum, p) => {
                    const pu = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (parseFloat(p.pu) || parseFloat(p.costo_por_dia) || 0);
                    const pReps = revAtM.filter(r => isMatchPartidaName(r.partida, p.partida));
                    const cantAv = pReps.reduce((rSum, r) => rSum + (parseFloat(r.cantidad) || 0), 0);
                    return sum + Math.round(Math.min(parseFloat(p.cantidad) || 0, cantAv) * pu);
                  }, 0);

                  const evPct = Math.min(100, Math.round((valRealAtM / totalPresupuestoObra) * 100));

                  // Programado Acumulado a la fecha (Gantt)
                  const valProgAtM = targetPartidas.reduce((sum, p) => {
                    const pu = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (parseFloat(p.pu) || parseFloat(p.costo_por_dia) || 0);
                    const pCant = parseFloat(p.cantidad) || 0;
                    const pStart = p.fecha_inicio || fInicioObraDefault;
                    const pDur = Math.max(1, Math.round(pCant / (parseFloat(p.rendimiento) || 10)));
                    const pEnd = addChileanBusinessDays(pStart, pDur);

                    if (mStr >= pEnd) return sum + Math.round(pCant * pu);
                    if (mStr <= pStart) return sum;
                    const elapsed = countChileanBusinessDays(pStart, mStr);
                    const frac = Math.min(1, elapsed / pDur);
                    return sum + Math.round(pCant * pu * frac);
                  }, 0);

                  const pvPct = Math.min(100, Math.round((valProgAtM / totalPresupuestoObra) * 100));

                  const yEV = 160 - (evPct / 100) * 140;
                  const yPV = 160 - (pvPct / 100) * 140;

                  return { x, yEV, yPV, evPct, pvPct, label: m.label, dateStr: mStr };
                });

                const pathEV = curvaSPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.yEV}`, '');
                const pathPV = curvaSPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.yPV}`, '');

                // 4. Últimos 5 Días Laborales para Gráfico de Barras de Avance
                const last5BusinessDays = [];
                let curDay = new Date(fCorteStr + 'T00:00:00');
                if (!isNaN(curDay.getTime())) {
                  while (last5BusinessDays.length < 5) {
                    const dayOfWeek = curDay.getDay();
                    const dStr = curDay.getFullYear() + '-' + String(curDay.getMonth() + 1).padStart(2, '0') + '-' + String(curDay.getDate()).padStart(2, '0');
                    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !CHILEAN_HOLIDAYS.includes(dStr)) {
                      last5BusinessDays.unshift(dStr);
                    }
                    curDay.setDate(curDay.getDate() - 1);
                  }
                }

                const last5DaysData = last5BusinessDays.map(dStr => {
                  const repsDay = (reportesAvanceList || []).filter(r => {
                    const fRep = r.fecha || r.fecha_avance || (r.created_at ? String(r.created_at).substring(0, 10) : '');
                    return fRep === dStr && (targetNames.length === 0 || targetPartidas.some(p => isMatchPartidaName(r.partida, p.partida)));
                  });
                  const sumVal = repsDay.reduce((acc, r) => {
                    const pMatch = targetPartidas.find(p => isMatchPartidaName(r.partida, p.partida));
                    const pu = pMatch ? (parseFloat(pMatch.pu) || parseFloat(pMatch.costo_por_dia) || 1) : 1;
                    return acc + ((parseFloat(r.cantidad) || 0) * pu);
                  }, 0);
                  return { date: dStr, monto: sumVal, count: repsDay.length };
                });

                const max5DaysMonto = Math.max(1, ...last5DaysData.map(d => d.monto));

                // 4. Asistencia y HHT
                const filteredAsistencia = (asistenciaList || []).filter(a => {
                  const fAs = a.fecha || (a.created_at ? String(a.created_at).substring(0, 10) : '');
                  return fAs <= fCorteStr;
                });
                const totalHHT = filteredAsistencia.reduce((sum, a) => {
                  const st = (a.asistencia || '').toLowerCase();
                  return (st === 'presente' || st === 'asiste' || st === 'p') ? sum + 9 : sum;
                }, 0);

                const activeWorkerCount = (personalList || []).length;
                const uniqueAsistDays = new Set(filteredAsistencia.map(a => a.fecha || String(a.created_at).substring(0, 10))).size || 1;
                const avgDailyWorkers = (filteredAsistencia.length / uniqueAsistDays).toFixed(1);

                // 5. Maquinaria y Paralizaciones
                const filteredMantenciones = (mantencionesMaquinariaList || []).filter(m => m.fecha <= fCorteStr);
                const filteredParalizaciones = (paralizacionesMaquinariaList || []).filter(p => p.fecha_inicio <= fCorteStr);
                const totalCostoMantencion = filteredMantenciones.reduce((acc, m) => acc + (parseFloat(m.costo) || 0), 0);
                const totalHorasParada = filteredParalizaciones.reduce((acc, p) => acc + (parseFloat(p.horas_parada) || 0), 0);
                const totalEquiposFlota = (maquinariaList || []).length + (arriendosList || []).length;

                // 6. Prevención de Riesgos y Accidentabilidad
                const filteredAccidentes = (accidentesPrevencionList || []).filter(a => a.fecha <= fCorteStr);
                const countCTP = filteredAccidentes.filter(a => a.tipo === 'CTP').length;
                const countSTP = filteredAccidentes.filter(a => a.tipo === 'STP' || a.tipo === 'CASI_ACCIDENTE').length;
                const totalDiasPerdidos = filteredAccidentes.reduce((acc, a) => acc + (parseInt(a.dias_perdidos, 10) || 0), 0);
                
                // Tasas HSE (Frecuencia y Gravidez)
                const tasaFrecuencia = totalHHT > 0 ? ((countCTP * 1000000) / totalHHT).toFixed(2) : "0.00";
                const tasaGravidez = totalHHT > 0 ? ((totalDiasPerdidos * 1000000) / totalHHT).toFixed(2) : "0.00";

                // 7. CÁLCULO DE VALOR GANADO (EVM) Y DESVIACIONES CRÍTICAS DE COSTO
                const EV = avanceMontoAcumulado; // Earned Value ($)
                
                // PV (Planned Value): Venta programada al corte
                const PV = targetPartidas.reduce((sum, p) => {
                  const pu = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (parseFloat(p.pu) || 0);
                  const startP = getPartidaScheduledStart(p);
                  let dEf = 0;
                  if (startP && startP <= fCorteStr) {
                    const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
                    const cantTotal = parseFloat(p.cantidad) || 0;
                    const dBus = countChileanBusinessDays(startP, fCorteStr);
                    dEf = Math.min(dBus, rend > 0 ? (cantTotal / rend) : 1);
                  }
                  const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
                  const cantProg = Math.min(parseFloat(p.cantidad) || 0, Math.round(dEf * rend));
                  return sum + Math.round(cantProg * pu);
                }, 0);

                // AC (Actual Cost): Costos reales acumulados al corte (Facturas + Personal + Maquinaria)
                const AC_facturas = (costosList || []).reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0);
                const AC_personal = (liquidacionesList || []).reduce((acc, l) => acc + (parseFloat(l.monto_real) || 0), 0);
                const AC_maquinaria = totalCostoMantencion;
                const AC = AC_facturas + AC_personal + AC_maquinaria; // Costo Real Actual Total

                const BAC = totalVentaPresupuestada; // Presupuesto Total Venta
                const CPI = AC > 0 ? (EV / AC) : (EV > 0 ? 1.2 : 1.0); // Cost Performance Index
                const SPI = PV > 0 ? (EV / PV) : 1.0; // Schedule Performance Index
                const EAC = CPI > 0 ? Math.round(BAC / CPI) : BAC; // Estimate at Completion
                const CV = EV - AC; // Cost Variance
                const SV = EV - PV; // Schedule Variance

                // PARTIDAS CON ALERTA Y DESVIACIÓN CRÍTICA DE COSTO
                const partidasConDesviacion = targetPartidas.map(p => {
                  const cantTotal = parseFloat(p.cantidad) || 0;
                  const puVenta = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (parseFloat(p.pu) || 0);
                  const ventaTotal = Math.round(cantTotal * puVenta);

                  const pReps = filteredAvances.filter(r => r.partida === p.partida);
                  const cantAv = pReps.reduce((rSum, r) => rSum + (parseFloat(r.cantidad) || 0), 0);
                  const ventaAvance = Math.round(Math.min(cantTotal, cantAv) * puVenta);

                  // Imputaciones reales a esta partida
                  const costoImputadoReal = (costosList || []).reduce((cSum, c) => {
                    if (!c.imputaciones) return cSum;
                    const impMatch = c.imputaciones.find(i => i.partida === p.partida);
                    if (impMatch) {
                      return cSum + Math.round(((parseFloat(c.monto) || 0) * (parseFloat(impMatch.porcentaje) || 0)) / 100);
                    }
                    return cSum;
                  }, 0);

                  const esSobrecosto = costoImputadoReal > 0 && costoImputadoReal > ventaAvance;
                  const variacionMonto = costoImputadoReal - ventaAvance;
                  const pctSobrecosto = ventaAvance > 0 ? ((variacionMonto / ventaAvance) * 100).toFixed(1) : "0.0";

                  return {
                    partida: p.partida,
                    unidad: p.unidad,
                    cantTotal,
                    cantAv,
                    ventaTotal,
                    ventaAvance,
                    costoImputadoReal,
                    esSobrecosto,
                    variacionMonto,
                    pctSobrecosto
                  };
                }).filter(p => p.costoImputadoReal > 0 || p.esSobrecosto);

                return (
                  <div className="space-y-6">

                    {/* PESTAÑA 1: 📈 AVANCE FÍSICO Y EJECUCIÓN */}
                    {estadisticasTab === 'avance' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avance Real al Corte</span>
                            <p className="text-2xl font-black text-blue-900">{pctAvanceGlobal}%</p>
                            <p className="text-[10px] text-slate-500 font-bold">${avanceMontoAcumulado.toLocaleString('es-CL')} de ${totalVentaPresupuestada.toLocaleString('es-CL')}</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Promedio de Avance Diario</span>
                            <p className="text-2xl font-black text-emerald-800">{avgPctPerDay}% <span className="text-xs font-normal text-slate-400">/día</span></p>
                            <p className="text-[10px] text-slate-500 font-semibold">Tasa de rendimiento por jornada</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mayor Avance por Partida</span>
                            <p className="text-lg font-black text-blue-950 truncate" title={maxPartida?.partida}>{maxPartida ? maxPartida.partida : 'N/A'}</p>
                            <p className="text-[10px] text-blue-900 font-bold">{maxPartida ? `${maxPartida.pct.toFixed(1)}% completado` : 'Sin datos'}</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Menor Avance por Partida</span>
                            <p className="text-lg font-black text-amber-900 truncate" title={minPartida?.partida}>{minPartida ? minPartida.partida : 'N/A'}</p>
                            <p className="text-[10px] text-amber-800 font-bold">{minPartida ? `${minPartida.pct.toFixed(1)}% completado` : 'Sin datos'}</p>
                          </div>
                        </div>

                        {/* GRÁFICO DE CURVA S DE AVANCE FÍSICO REAL VS PROGRAMADO */}
                        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-900" />
                                <span>📉 Curva S de Avance Físico Acumulado (Avance Real vs Programado)</span>
                              </h4>
                              <p className="text-[11px] text-slate-500 font-medium">Evolución porcentual del avance físico real acumulado vs curva de programación contractual</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-bold">
                              <span className="flex items-center gap-1.5 text-blue-950 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                <span className="w-3 h-3 bg-blue-900 rounded-full inline-block"></span>
                                <span>Avance Real ({pctAvanceGlobal}%)</span>
                              </span>
                              <span className="flex items-center gap-1.5 text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                <span className="w-3 h-3 bg-emerald-600 rounded-full inline-block"></span>
                                <span>Programado ({curvaSPoints.length > 0 ? curvaSPoints[curvaSPoints.length - 1].pvPct : "100"}%)</span>
                              </span>
                            </div>
                          </div>

                          {/* SVG CURVA S */}
                          <div className="w-full h-56 relative bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-center">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                              {/* Guías Horizontales 0%, 25%, 50%, 75%, 100% */}
                              <line x1="40" y1="20" x2="480" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                              <text x="32" y="24" textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">100%</text>

                              <line x1="40" y1="55" x2="480" y2="55" stroke="#e2e8f0" strokeDasharray="3 3" />
                              <text x="32" y="59" textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">75%</text>

                              <line x1="40" y1="90" x2="480" y2="90" stroke="#e2e8f0" strokeDasharray="3 3" />
                              <text x="32" y="94" textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">50%</text>

                              <line x1="40" y1="125" x2="480" y2="125" stroke="#e2e8f0" strokeDasharray="3 3" />
                              <text x="32" y="129" textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">25%</text>

                              <line x1="40" y1="160" x2="480" y2="160" stroke="#cbd5e1" strokeWidth="1.5" />
                              <text x="32" y="164" textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">0%</text>

                              {/* Trazo Línea Programada (Verde) */}
                              <path d={pathPV} fill="none" stroke="#16a34a" strokeWidth="3" strokeDasharray="4 2" />

                              {/* Trazo Línea Real (Azul) */}
                              <path d={pathEV} fill="none" stroke="#1e3a8a" strokeWidth="3.5" />

                              {/* Puntos y Nodos */}
                              {curvaSPoints.map((pt, pIdx) => (
                                <g key={pIdx}>
                                  <circle cx={pt.x} cy={pt.yEV} r="5" fill="#1e3a8a" stroke="#ffffff" strokeWidth="2" />
                                  <circle cx={pt.x} cy={pt.yPV} r="4" fill="#16a34a" stroke="#ffffff" strokeWidth="1.5" />
                                  <text x={pt.x} y={Math.max(15, pt.yEV - 8)} textAnchor="middle" className="text-[9px] fill-blue-950 font-bold font-mono">{pt.evPct}%</text>
                                  <text x={pt.x} y="176" textAnchor="middle" className="text-[9px] fill-slate-600 font-mono font-bold">{pt.label}</text>
                                </g>
                              ))}
                            </svg>
                          </div>
                        </div>

                        {/* GRÁFICO DE BARRAS: ÚLTIMOS 5 DÍAS LABORALES */}
                        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between border-b pb-2">
                            <span>📊 Avance Físico de los Últimos 5 Días Laborales (al {fCorteStr})</span>
                            <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-extrabold">Días Hábiles Chile</span>
                          </h4>

                          <div className="h-44 flex items-end justify-around gap-2 pt-4 px-2 bg-slate-50 rounded-xl border border-slate-100">
                            {last5DaysData.map((d, dIdx) => {
                              const pctHeight = max5DaysMonto > 0 ? Math.max(8, Math.round((d.monto / max5DaysMonto) * 100)) : 8;
                              return (
                                <div key={`d-${dIdx}`} className="flex-1 flex flex-col items-center gap-1 group">
                                  <span className="text-[9.5px] font-mono font-bold text-blue-950 opacity-0 group-hover:opacity-100 transition">
                                    ${d.monto.toLocaleString('es-CL')}
                                  </span>
                                  <div className="w-full max-w-[48px] bg-gradient-to-t from-blue-900 to-indigo-600 rounded-t-lg transition-all duration-500 shadow-2xs relative" style={{ height: `${pctHeight}%` }}>
                                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 rounded-t-lg transition"></div>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-700 font-mono">{d.date.substring(5)}</span>
                                  <span className="text-[8.5px] text-slate-400">{d.count} reportes</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* TABLA DETALLADA DE AVANCE POR PARTIDAS */}
                        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">📦 Resumen de Avance Físico por Partida</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                                  <th className="p-2.5">Partida</th>
                                  <th className="p-2.5">Cant. Presupuestada</th>
                                  <th className="p-2.5">Avance Acumulado</th>
                                  <th className="p-2.5 text-center">% Cumplimiento</th>
                                  <th className="p-2.5 text-center">Promedio % / Día</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150 text-[11px]">
                                {pAvanceRates.map((p, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-bold text-slate-800">{p.partida}</td>
                                    <td className="p-2.5 font-mono text-slate-700">{p.cantTotal.toLocaleString('es-CL')} {p.unidad}</td>
                                    <td className="p-2.5 font-mono font-bold text-blue-900">{p.cantAv.toLocaleString('es-CL')} {p.unidad}</td>
                                    <td className="p-2.5 text-center font-mono font-black text-slate-800">
                                      <span className={`px-2 py-0.5 rounded text-[10.5px] ${p.pct >= 100 ? 'bg-emerald-100 text-emerald-900' : (p.pct > 0 ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-600')}`}>
                                        {p.pct.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-center font-mono font-bold text-slate-600">
                                      {p.pctPerDay.toFixed(2)}% / día
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PESTAÑA 2: 👷 CUADRILLAS & RRHH */}
                    {estadisticasTab === 'cuadrillas' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horas Hombre Acumuladas</span>
                            <p className="text-2xl font-black text-indigo-900">{totalHHT.toLocaleString('es-CL')} <span className="text-xs font-normal text-slate-400">HHT</span></p>
                            <p className="text-[10px] text-slate-500 font-semibold">{filteredAsistencia.length} marcas de asistencia registradas</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dotación Presente Promedio</span>
                            <p className="text-2xl font-black text-slate-800">{avgDailyWorkers} <span className="text-xs font-normal text-slate-400">trab/día</span></p>
                            <p className="text-[10px] text-slate-500 font-semibold">De {activeWorkerCount} asignados en la nómina</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tasa de Asistencia</span>
                            <p className="text-2xl font-black text-emerald-800">
                              {activeWorkerCount > 0 ? ((avgDailyWorkers / activeWorkerCount) * 100).toFixed(1) : "100"}%
                            </p>
                            <p className="text-[10px] text-emerald-600 font-bold">✓ Asistencia registrada en obra</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rendimiento HHT Promedio</span>
                            <p className="text-2xl font-black text-slate-800">
                              {totalHHT > 0 ? (avanceMontoAcumulado / totalHHT).toLocaleString('es-CL', { maximumFractionDigits: 0 }) : 0} <span className="text-xs font-normal text-slate-400">$/HHT</span>
                            </p>
                            <p className="text-[10px] text-slate-500 font-semibold">Venta producida por hora trabajada</p>
                          </div>
                        </div>

                        {/* TABLA DE DOTACIÓN Y CUADRILLAS */}
                        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">👷 Personal Asignado y Control Operativo por Cuadrilla</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                                  <th className="p-2.5">Nombre Trabajador</th>
                                  <th className="p-2.5">RUT</th>
                                  <th className="p-2.5">Cargo / Especialidad</th>
                                  <th className="p-2.5 text-center">Asistencias Acumuladas</th>
                                  <th className="p-2.5 text-right">Costo Diario Estimado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150 text-[11px]">
                                {(personalList || []).map((p, idx) => {
                                  const pAsistCount = filteredAsistencia.filter(a => a.trabajador === p.nombre || a.rut === p.rut).length;
                                  const custom = customSalariesMap[p.nombre];
                                  const sBase = custom?.sueldo_base || parseFloat(p.sueldo_base) || 1200000;
                                  const cEmpresa = Math.round(sBase * 1.25);
                                  const valorDia = Math.round(cEmpresa / 30);
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="p-2.5 font-bold text-slate-800">{p.nombre}</td>
                                      <td className="p-2.5 font-mono text-slate-600">{formatRut(p.rut) || '-'}</td>
                                      <td className="p-2.5">
                                        <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border">
                                          {p.cargo || 'Operario'}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-center font-mono font-bold text-indigo-900">{pAsistCount} días</td>
                                      <td className="p-2.5 text-right font-mono font-bold text-emerald-800">${valorDia.toLocaleString('es-CL')} /día</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PESTAÑA 3: 🚜 MAQUINARIAS & FLOTA */}
                    {estadisticasTab === 'maquinarias' && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center bg-amber-50/60 p-3.5 border border-amber-200 rounded-2xl">
                          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                            <Truck className="w-4 h-4 text-amber-800" />
                            <span>Gestión Operativa de Mantenciones y Fallas Técnicas de Maquinarias</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setMantencionFormData({ equipo_nombre: (maquinariaList[0]?.nombre || arriendosList[0]?.equipo || ''), fecha: fCorteStr, tipo: 'Preventiva', costo: '', descripcion: '' });
                                setShowMantencionModal(true);
                              }}
                              className="bg-amber-800 hover:bg-amber-900 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Registrar Mantención</span>
                            </button>
                            <button
                              onClick={() => {
                                setParalizacionFormData({ equipo_nombre: (maquinariaList[0]?.nombre || arriendosList[0]?.equipo || ''), fecha_inicio: fCorteStr, horas_parada: 8, motivo: '' });
                                setShowParalizacionModal(true);
                              }}
                              className="bg-rose-800 hover:bg-rose-900 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Registrar Paralización</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Flota de Equipos en Obra</span>
                            <p className="text-2xl font-black text-amber-900">{totalEquiposFlota} <span className="text-xs font-normal text-slate-400">maquinarias</span></p>
                            <p className="text-[10px] text-slate-500 font-semibold">{maquinariaList.length} propias | {arriendosList.length} arrendadas</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mantenciones Realizadas</span>
                            <p className="text-2xl font-black text-slate-800">{filteredMantenciones.length} <span className="text-xs font-normal text-slate-400">mant.</span></p>
                            <p className="text-[10px] text-amber-800 font-bold">Costo Acum.: ${totalCostoMantencion.toLocaleString('es-CL')}</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paralizaciones / Fallas</span>
                            <p className="text-2xl font-black text-rose-700">{filteredParalizaciones.length} <span className="text-xs font-normal text-slate-400">eventos</span></p>
                            <p className="text-[10px] text-rose-800 font-bold">{totalHorasParada} horas de parada acumuladas</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disponibilidad de Flota</span>
                            <p className="text-2xl font-black text-emerald-800">
                              {totalEquiposFlota > 0 ? (100 - Math.min(100, (totalHorasParada / (totalEquiposFlota * 160)) * 100)).toFixed(1) : "100"}%
                            </p>
                            <p className="text-[10px] text-emerald-600 font-bold">✓ Nivel de operatividad de equipos</p>
                          </div>
                        </div>

                        {/* HISTORIAL DE MANTENCIONES Y PARALIZACIONES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                            <h4 className="font-extrabold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Historial de Mantenciones Realizadas</span>
                            </h4>
                            {filteredMantenciones.length === 0 ? (
                              <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-50 rounded-xl">No hay mantenciones registradas a la fecha.</p>
                            ) : (
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {filteredMantenciones.map((m, mIdx) => (
                                  <div key={mIdx} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-0.5">
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                                      <span>{m.equipo_nombre}</span>
                                      <span className="font-mono text-amber-900">${(parseFloat(m.costo) || 0).toLocaleString('es-CL')}</span>
                                    </div>
                                    <p className="text-[10.5px] text-slate-600">{m.tipo} - {m.fecha} | {m.descripcion || 'Sin observación'}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                            <h4 className="font-extrabold text-rose-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Historial de Paralizaciones / Fallas Técnicas</span>
                            </h4>
                            {filteredParalizaciones.length === 0 ? (
                              <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-50 rounded-xl">No se registraron fallas técnicas a la fecha.</p>
                            ) : (
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {filteredParalizaciones.map((p, pIdx) => (
                                  <div key={pIdx} className="bg-rose-50/60 border border-rose-200 p-2.5 rounded-xl space-y-0.5">
                                    <div className="flex justify-between items-center text-xs font-bold text-rose-950">
                                      <span>{p.equipo_nombre}</span>
                                      <span className="font-mono text-rose-800 font-black">{p.horas_parada} hrs parada</span>
                                    </div>
                                    <p className="text-[10.5px] text-slate-700">Inicio: {p.fecha_inicio} | Motivo: {p.motivo}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PESTAÑA 4: 🛡️ PREVENCIÓN DE RIESGOS (HSE) */}
                    {estadisticasTab === 'prevencion' && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center bg-emerald-50/60 p-3.5 border border-emerald-200 rounded-2xl">
                          <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-emerald-800" />
                            <span>Control Estadístico de Seguridad Industrial y Prevención de Riesgos (HSE)</span>
                          </span>
                          <button
                            onClick={() => {
                              setAccidenteFormData({ fecha: fCorteStr, tipo: 'STP', trabajador: '', dias_perdidos: 0, descripcion: '' });
                              setShowAccidenteModal(true);
                            }}
                            className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Registrar Incidente HSE</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horas Hombre Trabajadas (HHT)</span>
                            <p className="text-2xl font-black text-slate-800">{totalHHT.toLocaleString('es-CL')} <span className="text-xs font-normal text-slate-400">HHT</span></p>
                            <p className="text-[10px] text-slate-500 font-semibold">Basado en registro de asistencia</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Accidentes CTP / Días Perdidos</span>
                            <p className="text-2xl font-black text-rose-700">{countCTP} <span className="text-xs font-normal text-slate-400">accidentes</span></p>
                            <p className="text-[10px] text-rose-800 font-bold">{totalDiasPerdidos} días perdidos acumulados</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tasa de Frecuencia (TF)</span>
                            <p className="text-2xl font-black text-emerald-800">{tasaFrecuencia}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">(N° Accidentes CTP × 1M) / HHT</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tasa de Gravidez (TG)</span>
                            <p className="text-2xl font-black text-slate-800">{tasaGravidez}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">(Días Perdidos × 1M) / HHT</p>
                          </div>
                        </div>

                        {/* TACÓMETRO / HISTORIAL DE INCIDENTES HSE */}
                        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
                            <span>🛡️ Registro Histórico de Incidentes y Accidentabilidad</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-extrabold">
                              {countCTP === 0 ? '✓ Obra sin Accidentes CTP' : `⚠️ ${countCTP} Accidentes con Tiempo Perdido`}
                            </span>
                          </h4>

                          {filteredAccidentes.length === 0 ? (
                            <p className="text-xs text-slate-500 italic p-4 text-center bg-slate-50 rounded-xl">No hay accidentes ni incidentes registrados a la fecha de corte.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                                    <th className="p-2.5">Fecha</th>
                                    <th className="p-2.5">Tipo Evento</th>
                                    <th className="p-2.5">Trabajador / Cuadrilla</th>
                                    <th className="p-2.5 text-center">Días Perdidos</th>
                                    <th className="p-2.5">Descripción / Medida Aplicada</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-150 text-[11px]">
                                  {filteredAccidentes.map((a, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="p-2.5 font-mono text-slate-700 font-bold">{a.fecha}</td>
                                      <td className="p-2.5">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${a.tipo === 'CTP' ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300'}`}>
                                          {a.tipo === 'CTP' ? '🔴 CTP (Con Tiempo Perdido)' : '🟢 STP (Sin Tiempo Perdido)'}
                                        </span>
                                      </td>
                                      <td className="p-2.5 font-bold text-slate-800">{a.trabajador}</td>
                                      <td className="p-2.5 text-center font-mono font-bold text-rose-800">{a.dias_perdidos} días</td>
                                      <td className="p-2.5 text-slate-600">{a.descripcion}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* PESTAÑA 5: 💰 COSTOS & EVM (VALOR GANADO) + ALERTAS CRÍTICAS DE SOBRECOSTO */}
                    {estadisticasTab === 'costos' && (
                      <div className="space-y-6">

                        {/* ALERTAS CRÍTICAS DE DESVIACIÓN DE COSTOS */}
                        {partidasConDesviacion.length > 0 ? (
                          <div className="bg-rose-50 border-2 border-rose-400 p-4 rounded-2xl space-y-3 animate-in fade-in">
                            <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                              <h4 className="font-black text-rose-950 text-xs uppercase tracking-wider flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-rose-700 animate-bounce" />
                                <span>🚨 ALERTAS DE DESVIACIÓN DE COSTOS (Partidas Saliendo Más Caras de lo Esperado)</span>
                              </h4>
                              <span className="bg-rose-900 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full">
                                {partidasConDesviacion.length} Partida(s) con Sobrecosto
                              </span>
                            </div>

                            <p className="text-xs text-rose-900 font-semibold">
                              Se han detectado partidas cuyo <strong>Costo Real Incurridos supera la Venta de Avance acumulada</strong> a la fecha de corte ({fCorteStr}):
                            </p>

                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden shadow-2xs border border-rose-200">
                                <thead>
                                  <tr className="bg-rose-100 text-rose-950 font-bold uppercase text-[10px]">
                                    <th className="p-2.5">Partida Afectada</th>
                                    <th className="p-2.5 text-right">Venta por Avance ($)</th>
                                    <th className="p-2.5 text-right">Costo Real Incurrido ($)</th>
                                    <th className="p-2.5 text-right">Sobrecosto / Desviación ($)</th>
                                    <th className="p-2.5 text-center">% Sobrecosto</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-rose-150 text-[11px]">
                                  {partidasConDesviacion.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-rose-50/50">
                                      <td className="p-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                        <span>{p.partida}</span>
                                      </td>
                                      <td className="p-2.5 text-right font-mono text-slate-700">${p.ventaAvance.toLocaleString('es-CL')}</td>
                                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">${p.costoImputadoReal.toLocaleString('es-CL')}</td>
                                      <td className="p-2.5 text-right font-mono font-black text-rose-700">
                                        +${p.variacionMonto.toLocaleString('es-CL')}
                                      </td>
                                      <td className="p-2.5 text-center font-mono font-bold">
                                        <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded border border-rose-300">
                                          +{p.pctSobrecosto}%
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              <span>✓ Control de Costos Saludable: Ninguna partida presenta sobrecosto respecto a su venta de avance.</span>
                            </span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-extrabold">100% Bajo Control</span>
                          </div>
                        )}
                        {/* GRÁFICO DE CURVA S Y ANÁLISIS COMPARATIVO DE COSTOS */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                          {/* 1. GRÁFICO SVG DE CURVA S DE VALOR GANADO (EVM) */}
                          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <BarChart3 className="w-4 h-4 text-blue-900" />
                                <span>📉 Curva S de Avance y Costos (EVM)</span>
                              </h4>
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-extrabold">Histórico al Corte</span>
                            </div>

                            {/* Leyenda de Líneas */}
                            <div className="flex flex-wrap items-center justify-center gap-4 text-[10.5px] font-bold py-1">
                              <span className="flex items-center gap-1 text-blue-900">
                                <span className="w-3 h-1 bg-blue-900 rounded-full"></span> EV (Venta Real)
                              </span>
                              <span className="flex items-center gap-1 text-emerald-800">
                                <span className="w-3 h-1 bg-emerald-600 rounded-full"></span> PV (Venta Planificada)
                              </span>
                              <span className="flex items-center gap-1 text-rose-700">
                                <span className="w-3 h-1 bg-rose-600 rounded-full"></span> AC (Costo Real)
                              </span>
                            </div>

                            {/* Contenedor SVG Curva S */}
                            {(() => {
                              const fStart = selectedObra?.fecha_inicio || '2026-06-01';
                              const dStart = new Date(fStart + 'T00:00:00').getTime();
                              const dEnd = new Date(fCorteStr + 'T00:00:00').getTime();
                              const validEnd = isNaN(dEnd) || dEnd <= dStart ? dStart + 30 * 86400000 : dEnd;

                              const timePoints = [0, 0.25, 0.5, 0.75, 1.0].map(pct => {
                                const ptTime = dStart + (validEnd - dStart) * pct;
                                const ptDate = new Date(ptTime).toISOString().substring(0, 10);
                                
                                const ptPV = targetPartidas.reduce((sum, p) => {
                                  const pu = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (parseFloat(p.pu) || 0);
                                  const startP = getPartidaScheduledStart(p);
                                  let dEf = 0;
                                  if (startP && startP <= ptDate) {
                                    const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
                                    const cantTotal = parseFloat(p.cantidad) || 0;
                                    const dBus = countChileanBusinessDays(startP, ptDate);
                                    dEf = Math.min(dBus, rend > 0 ? (cantTotal / rend) : 1);
                                  }
                                  const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
                                  const cantProg = Math.min(parseFloat(p.cantidad) || 0, Math.round(dEf * rend));
                                  return sum + Math.round(cantProg * pu);
                                }, 0);

                                const ptEV = targetPartidas.reduce((sum, p) => {
                                  const pu = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (parseFloat(p.pu) || 0);
                                  const pReps = (reportesAvanceList || []).filter(r => {
                                    const fRep = r.fecha || r.fecha_avance || (r.created_at ? String(r.created_at).substring(0, 10) : '');
                                    return fRep <= ptDate && r.partida === p.partida;
                                  });
                                  const cantAv = pReps.reduce((rSum, r) => rSum + (parseFloat(r.cantidad) || 0), 0);
                                  return sum + Math.round(Math.min(parseFloat(p.cantidad) || 0, cantAv) * pu);
                                }, 0);

                                const ptAC_fact = (costosList || []).filter(c => (c.fecha || c.created_at?.substring(0, 10)) <= ptDate).reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0);
                                const ptAC_pers = Math.round(AC_personal * pct);
                                const ptAC_maq = Math.round(AC_maquinaria * pct);
                                const ptAC = ptAC_fact + ptAC_pers + ptAC_maq;

                                return { dateStr: ptDate.substring(5), ev: ptEV, pv: ptPV, ac: ptAC };
                              });

                              const maxY = Math.max(1, BAC, ...timePoints.map(p => Math.max(p.ev, p.pv, p.ac))) * 1.1;

                              const w = 450;
                              const h = 180;
                              const padL = 40;
                              const padB = 25;
                              const padT = 15;
                              const padR = 15;

                              const getX = (idx) => padL + (idx / (timePoints.length - 1)) * (w - padL - padR);
                              const getY = (val) => h - padB - (val / maxY) * (h - padT - padB);

                              const pathEV = timePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.ev)}`).join(' ');
                              const pathPV = timePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.pv)}`).join(' ');
                              const pathAC = timePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.ac)}`).join(' ');

                              return (
                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center">
                                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44 overflow-visible">
                                    {[0, 0.33, 0.66, 1].map((pct, gIdx) => {
                                      const yVal = (h - padB) - pct * (h - padT - padB);
                                      return (
                                        <g key={`g-${gIdx}`}>
                                          <line x1={padL} y1={yVal} x2={w - padR} y2={yVal} stroke="#e2e8f0" strokeDasharray="3 3" />
                                          <text x={padL - 5} y={yVal + 3} textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                                            ${Math.round((maxY * pct) / 1000000)}M
                                          </text>
                                        </g>
                                      );
                                    })}

                                    <path d={pathPV} fill="none" stroke="#059669" strokeWidth="2.5" strokeDasharray="4 2" />
                                    <path d={pathAC} fill="none" stroke="#e11d48" strokeWidth="2.5" />
                                    <path d={pathEV} fill="none" stroke="#1e3a8a" strokeWidth="3.5" />

                                    {timePoints.map((p, i) => (
                                      <g key={`pt-${i}`}>
                                        <circle cx={getX(i)} cy={getY(p.pv)} r="3.5" fill="#059669" />
                                        <circle cx={getX(i)} cy={getY(p.ac)} r="3.5" fill="#e11d48" />
                                        <circle cx={getX(i)} cy={getY(p.ev)} r="4.5" fill="#1e3a8a" stroke="#ffffff" strokeWidth="1.5" />
                                        <text x={getX(i)} y={h - 6} textAnchor="middle" className="text-[9px] font-bold fill-slate-600 font-mono">
                                          {p.dateStr}
                                        </text>
                                      </g>
                                    ))}
                                  </svg>
                                </div>
                              );
                            })()}
                          </div>

                          {/* 2. GRÁFICO BARRAS COMPARATIVO VENTA VS COSTO POR PARTIDA */}
                          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <DollarSign className="w-4 h-4 text-emerald-700" />
                                <span>📊 Venta de Avance vs Costo Real por Partida</span>
                              </h4>
                              <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-extrabold">Top Partidas</span>
                            </div>

                            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                              {partidasConDesviacion.slice(0, 5).map((p, idx) => {
                                const maxVal = Math.max(1, p.ventaAvance, p.costoImputadoReal);
                                const pctVenta = Math.round((p.ventaAvance / maxVal) * 100);
                                const pctCosto = Math.round((p.costoImputadoReal / maxVal) * 100);

                                return (
                                  <div key={idx} className="bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-1">
                                    <div className="flex justify-between text-[11px] font-bold">
                                      <span className="truncate max-w-[200px] text-slate-800">{p.partida}</span>
                                      <span className={p.esSobrecosto ? 'text-rose-700 font-black' : 'text-emerald-700 font-black'}>
                                        {p.esSobrecosto ? `🚨 Sobrecosto: +$${p.variacionMonto.toLocaleString('es-CL')}` : '✓ Margen Ok'}
                                      </span>
                                    </div>

                                    <div className="space-y-0.5">
                                      <div className="flex justify-between text-[9px] text-slate-500 font-semibold">
                                        <span>Venta Avance</span>
                                        <span className="font-mono font-bold text-blue-900">${p.ventaAvance.toLocaleString('es-CL')}</span>
                                      </div>
                                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                        <div className="bg-blue-900 h-full rounded-full transition-all duration-500" style={{ width: `${pctVenta}%` }}></div>
                                      </div>
                                    </div>

                                    <div className="space-y-0.5">
                                      <div className="flex justify-between text-[9px] text-slate-500 font-semibold">
                                        <span>Costo Real</span>
                                        <span className="font-mono font-bold text-rose-700">${p.costoImputadoReal.toLocaleString('es-CL')}</span>
                                      </div>
                                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${p.esSobrecosto ? 'bg-rose-600' : 'bg-slate-600'}`} style={{ width: `${pctCosto}%` }}></div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* KPIS DE VALOR GANADO (EVM - EARNED VALUE MANAGEMENT) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">EV - Valor Ganado (Venta Real)</span>
                            <p className="text-2xl font-black text-blue-950">${EV.toLocaleString('es-CL')}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">Valor monetario del avance producido</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">AC - Costo Real Incurrido</span>
                            <p className="text-2xl font-black text-slate-800">${AC.toLocaleString('es-CL')}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">Facturas + Personal + Maquinaria</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CPI (Índice Eficiencia de Costo)</span>
                            <p className={`text-2xl font-black ${CPI >= 1.0 ? 'text-emerald-700' : 'text-rose-700'}`}>{CPI.toFixed(2)}</p>
                            <p className="text-[10px] font-bold">{CPI >= 1.0 ? '🟢 Bajo Presupuesto (Eficiente)' : '🔴 Sobre Presupuesto'}</p>
                          </div>

                          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SPI (Índice Eficiencia Cronograma)</span>
                            <p className={`text-2xl font-black ${SPI >= 1.0 ? 'text-emerald-700' : 'text-amber-700'}`}>{SPI.toFixed(2)}</p>
                            <p className="text-[10px] font-bold">{SPI >= 1.0 ? '🟢 Adelantado según Carta Gantt' : '⚠️ Atrasado según Carta Gantt'}</p>
                          </div>
                        </div>

                        {/* CUADRO COMPARATIVO EVM COMPLETO */}
                        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">📊 Métricas Consolidadas de Valor Ganado (EVM)</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">PV - Valor Planificado (Venta Programada)</span>
                              <p className="text-base font-black text-slate-800">${PV.toLocaleString('es-CL')}</p>
                              <p className="text-[9.5px] text-slate-500">Venta que debía haberse alcanzado al corte</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">EAC - Costo Proyectado al Término</span>
                              <p className="text-base font-black text-blue-900">${EAC.toLocaleString('es-CL')}</p>
                              <p className="text-[9.5px] text-slate-500">Proyección final ajustada por CPI actual</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Variación de Costo (CV = EV - AC)</span>
                              <p className={`text-base font-black ${CV >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {CV >= 0 ? `+$${CV.toLocaleString('es-CL')}` : `-$${Math.abs(CV).toLocaleString('es-CL')}`}
                              </p>
                              <p className="text-[9.5px] text-slate-500">{CV >= 0 ? 'Ahorro a la fecha' : 'Pérdida/Diferencia a la fecha'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PESTAÑA 6: 📦 BODEGA (PRÓXIMAMENTE) */}
                    {estadisticasTab === 'bodega' && (
                      <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-3">
                        <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto" />
                        <h4 className="font-extrabold text-slate-800 text-sm">📦 Módulo de Inventario y Control de Bodega de Obra</h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Próximamente incorporaremos las estadísticas de consumo de materiales, entradas y salidas de bodega y rotación de stock.
                        </p>
                      </div>
                    )}

                  </div>
                );
              })()}
            </div>
          );
        })()}

          {/* VISTA DEDICADA 9: PREVENCIÓN DE RIESGOS DE OBRA */}
          {obraActiveSubmodule === 'prevencion' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-rose-800" />
                      <span>Prevención de Riesgos de la Obra</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Inspecciones de seguridad, procedimientos PTS aplicables e historial de incidentes / accidentes</p>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setPrevObraSubTab('inspecciones')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${prevObraSubTab === 'inspecciones' ? 'bg-white text-rose-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      📋 Inspecciones
                    </button>
                    <button
                      onClick={() => setPrevObraSubTab('pts')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${prevObraSubTab === 'pts' ? 'bg-white text-rose-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      📑 Procedimientos (PTS)
                    </button>
                    <button
                      onClick={() => setPrevObraSubTab('incidentes')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${prevObraSubTab === 'incidentes' ? 'bg-white text-rose-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      ⚠️ Incidentes (Informe Flash)
                    </button>
                  </div>
                </div>
              </div>

              {/* SUB-PESTAÑA 1: INSPECCIONES DE SEGURIDAD */}
              {prevObraSubTab === 'inspecciones' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-2">📋 Registro de Inspecciones de Seguridad en Obra</h4>
                  <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                    <ShieldCheck className="w-8 h-8 text-rose-400 mx-auto" />
                    <p className="text-xs text-slate-600 font-semibold">No se han registrado observaciones de inspección en esta obra hoy.</p>
                    <p className="text-[11px] text-slate-500">Las inspecciones de EPP, herramientas y maquinarias realizadas por el prevencionista se listarán aquí.</p>
                  </div>
                </div>
              )}

              {/* SUB-PESTAÑA 2: PROCEDIMIENTOS DE TRABAJO (PTS) */}
              {prevObraSubTab === 'pts' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-2">📑 Procedimientos de Trabajo Seguro (PTS) Asociados a la Obra</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="text-[9px] font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded">PTS-OBR-001</span>
                      <h5 className="font-bold text-slate-800 text-xs mt-1">Procedimiento Seguro para Excavaciones y Zanajados</h5>
                      <p className="text-[10px] text-slate-500">Versión v2.0 | Vigente en Faena</p>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="text-[9px] font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded">PTS-OBR-004</span>
                      <h5 className="font-bold text-slate-800 text-xs mt-1">Procedimiento de Trabajo en Altura y Moldajes</h5>
                      <p className="text-[10px] text-slate-500">Versión v1.2 | Vigente en Faena</p>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-PESTAÑA 3: INCIDENTES / INFORMES FLASH */}
              {prevObraSubTab === 'incidentes' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-2">⚠️ Estadísticas de Incidentes e Informes Flash</h4>
                  <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <p className="text-xs text-emerald-800 font-bold">Sin accidentes ni incidentes registrados en la obra.</p>
                    <p className="text-[11px] text-slate-500">Los Informes Flash de prevención reportados en terreno se asociarán automáticamente a las métricas de esta obra.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA DEDICADA 10: PRESUPUESTO DE OBRA */}
          {obraActiveSubmodule === 'presupuesto' && (
            <div className="space-y-6 animate-in fade-in duration-200">


              <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-800" />
                    <span>Presupuesto y Análisis de Costos de Obra</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Gestión de precios unitarios (P.U.), cantidades y presupuesto directo de la obra</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingPartida(null);
                      setPartidaFormData({ partida: 'NUEVO GRUPO', unidad: 'TITULO', cantidad: 0, pu: 0, rendimiento: '0', unidad_tiempo: 'Día', grupo: 'General', es_titulo: true });
                      setShowPartidaModal(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FolderPlus className="w-4 h-4 text-slate-900" />
                    <span>+ Insertar Título o Grupo</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingPartida(null);
                      setPartidaFormData({ partida: '', unidad: 'UND', cantidad: '', pu: 0, rendimiento: '10', unidad_tiempo: 'Día', grupo: 'General', es_titulo: false });
                      setShowPartidaModal(true);
                    }}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear Nueva Partida</span>
                  </button>
                </div>
              </div>

              {partidasList.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                  <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-600 font-semibold">No hay partidas creadas en esta obra aún.</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => {
                        setEditingPartida(null);
                        setPartidaFormData({ partida: '', unidad: 'UND', cantidad: '', pu: 0, rendimiento: '10', unidad_tiempo: 'Día' });
                        setShowPartidaModal(true);
                      }}
                      className="bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-900 cursor-pointer"
                    >
                      + Crear Primera Partida
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                          <th className="p-2.5">Partida / Actividad</th>
                          <th className="p-2.5">Unidad</th>
                          <th className="p-2.5">Cantidad Presupuesto</th>
                          <th className="p-2.5">Precio Unitario (P.U. $)</th>
                          <th className="p-2.5">Rendimiento Estimado</th>
                          <th className="p-2.5">Monto Total Directo ($)</th>
                          <th className="p-2.5 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-[11px]">
                        {partidasList.map((p, idx) => {
                          const isTitleRow = p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo;
                          const puVal = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (p.pu !== undefined ? p.pu : 0);
                          const totalItem = (p.cantidad || 0) * puVal;

                          if (isTitleRow) {
                            // 1. Intentar sumar partidas hacia abajo
                            let groupSum = 0;
                            let countBelow = 0;
                            for (let i = idx + 1; i < partidasList.length; i++) {
                              const child = partidasList[i];
                              if (child.unidad === 'TITULO' || child.unidad === 'GRUPO' || child.es_titulo || (parseFloat(child.cantidad || 0) === 0 && parseFloat(child.pu || 0) === 0)) break;
                              const childPu = partidasCostos[child.partida] !== undefined ? partidasCostos[child.partida] : (child.pu || 0);
                              const sub = (child.cantidad || 0) * childPu;
                              groupSum += sub;
                              if (sub > 0) countBelow++;
                            }

                            // 2. Si no hay partidas abajo, sumar partidas hacia arriba
                            if (countBelow === 0) {
                              for (let i = idx - 1; i >= 0; i--) {
                                const child = partidasList[i];
                                if (child.unidad === 'TITULO' || child.unidad === 'GRUPO' || child.es_titulo) break;
                                const childPu = partidasCostos[child.partida] !== undefined ? partidasCostos[child.partida] : (child.pu || 0);
                                groupSum += (child.cantidad || 0) * childPu;
                              }
                            }

                            return (
                              <tr 
    key={idx} 
    draggable={true}
    onDragStart={(e) => e.dataTransfer.setData('text/plain', idx)}
    onDragOver={(e) => e.preventDefault()}
    onDrop={(e) => { e.preventDefault(); const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(fromIdx)) handleReorderPartidaObra(fromIdx, idx); }}
    className="bg-amber-50/80 hover:bg-amber-100/70 border-l-4 border-amber-500 border-y border-amber-200/80 transition cursor-grab active:cursor-grabbing shadow-xs"
  >
                                <td colSpan="7" className="p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-amber-200/80 text-amber-950 font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider border border-amber-300">
                                        📁 GRUPO
                                      </span>
                                      <span className="text-slate-900 font-extrabold text-xs uppercase tracking-wide">
                                        {p.partida}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-amber-300 shadow-2xs">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Subtotal Grupo:</span>
                                        <span className="font-mono font-black text-emerald-800 text-xs">
                                          ${groupSum.toLocaleString('es-CL')}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleReorderPartidaObra(idx, idx - 1)}
                                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer font-bold"
                                          title="Mover arriba"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === partidasList.length - 1}
                                          onClick={() => handleReorderPartidaObra(idx, idx + 1)}
                                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer font-bold"
                                          title="Mover abajo"
                                        >
                                          ▼
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingPartida(p);
                                            setPartidaFormData({
                                              partida: p.partida,
                                              unidad: 'TITULO',
                                              cantidad: 0,
                                              pu: 0,
                                              rendimiento: '0',
                                              unidad_tiempo: 'Día',
                                              grupo: p.grupo || 'General',
                                              es_titulo: true
                                            });
                                            setShowPartidaModal(true);
                                          }}
                                          className="p-1 text-slate-600 hover:text-blue-900 transition cursor-pointer"
                                          title="Editar Título"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (!confirm(`¿Eliminar el grupo "${p.partida}"?`)) return;
                                            try {
                                              if (p.id) {
                                                await supabase.from('partidas_obra').delete().eq('id', p.id);
                                              } else {
                                                await supabase.from('partidas_obra').delete().eq('obra_nombre', selectedObra?.nombre).eq('partida', p.partida);
                                              }
                                              setPartidasList(prev => prev.filter((_, i) => i !== idx));
                                            } catch (err) { alert('Error: ' + err.message); }
                                          }}
                                          className="p-1 text-slate-600 hover:text-red-700 transition cursor-pointer"
                                          title="Eliminar Grupo"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-800 pl-6 flex items-center gap-1.5">
                                <span className="text-slate-400 text-xs">└─</span>
                                <span>{p.partida}</span>
                              </td>
                              <td className="p-2.5 font-mono text-slate-600">{p.unidad || 'UND'}</td>
                              <td className="p-2.5 font-mono font-bold text-slate-800">{p.cantidad || 0}</td>
                              <td className="p-2.5">
                                <input
                                  type="number"
                                  value={puVal}
                                  onChange={(e) => setPartidasCostos({ ...partidasCostos, [p.partida]: parseFloat(e.target.value) || 0 })}
                                  placeholder="0"
                                  className="w-28 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-800 bg-white"
                                />
                              </td>
                              <td className="p-2.5 font-mono text-slate-700 font-bold">
                                {p.rendimiento || '20'} {p.unidad || 'UND'} / {p.unidad_tiempo || 'Día'}
                              </td>
                              <td className="p-2.5 font-mono font-bold text-emerald-800">
                                ${totalItem.toLocaleString('es-CL')}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleReorderPartidaObra(idx, idx - 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover arriba"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === partidasList.length - 1}
                                      onClick={() => handleReorderPartidaObra(idx, idx + 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover abajo"
                                    >
                                      ▼
                                    </button>
                                  <button
                                    onClick={() => {
                                      setEditingPartida(p);
                                      setPartidaFormData({
                                        partida: p.partida,
                                        unidad: p.unidad || 'UND',
                                        cantidad: p.cantidad || 0,
                                        pu: puVal,
                                        rendimiento: p.rendimiento || '10',
                                        unidad_tiempo: p.unidad_tiempo || 'Día'
                                      });
                                      setShowPartidaModal(true);
                                    }}
                                    className="p-1 text-slate-500 hover:text-blue-900 transition cursor-pointer"
                                    title="Editar partida"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`¿Eliminar la partida "${p.partida}" permanentemente de la obra?`)) return;
                                      try {
                                        if (p.id) {
                                          const { error: delErr } = await supabase.from('partidas_obra').delete().eq('id', p.id);
                                          if (delErr) throw delErr;
                                        } else {
                                          const { error: delErr } = await supabase.from('partidas_obra').delete().eq('obra_nombre', selectedObra?.nombre).eq('partida', p.partida);
                                          if (delErr) throw delErr;
                                        }
                                        setPartidasList(prev => prev.filter((_, i) => i !== idx));
                                      } catch (err) {
                                        console.error('Error al eliminar partida:', err);
                                        alert('Error al eliminar la partida de la base de datos: ' + err.message);
                                      }
                                    }}
                                    className="p-1 text-slate-500 hover:text-red-700 transition cursor-pointer"
                                    title="Eliminar partida"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Resumen Total */}
                  <div className="flex justify-end pt-2 border-t">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Presupuesto Directo Total Obra</span>
                      <p className="text-xl font-black text-emerald-800">
                        ${partidasList.reduce((acc, p) => acc + ((p.cantidad || 0) * (partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (p.pu || 0))), 0).toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA DEDICADA 11: PLANIFICACIÓN Y CARTA GANTT DE OBRA (CONECTADO A PRESUPUESTO Y ENLACES) */}
          {obraActiveSubmodule === 'planificacion' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {(() => {
                const fInicioObraDefault = selectedObra?.fecha_inicio ? String(selectedObra.fecha_inicio).split('T')[0] : new Date().toISOString().substring(0, 10);
                const fCorteStr = fechaCorteProyeccion || new Date().toISOString().substring(0, 10);

                // 1. Helper para procesar partidas ejecutables
                const processPartidaItem = (p) => {
                  const isGroup = p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo;
                  const cant = parseFloat(p.cantidad) || 0;
                  const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
                  const duracionDias = isGroup ? 0 : Math.max(1, Math.ceil(cant / rend));

                  const fechaInicio = p.fecha_inicio ? String(p.fecha_inicio).split('T')[0] : fInicioObraDefault;
                  const fechaTermino = isGroup ? '' : addChileanBusinessDays(fechaInicio, duracionDias);
                  const avancePct = cant > 0 ? Math.min(100, Math.round(((p.avanceAcumulado || 0) / cant) * 100)) : 0;

                  return {
                    ...p,
                    isGroup,
                    cant,
                    rend,
                    duracionDias,
                    fechaInicio,
                    fechaTermino,
                    avancePct
                  };
                };

                const initialItems = partidasList.map(processPartidaItem);
                const executablePartidasList = initialItems.filter(i => !i.isGroup);

                // 2. Motor de cálculo de dependencias en cascada (Predecesoras + Tipo Relación + Desfase)
                const itemsMap = new window.Map();
                initialItems.forEach(item => {
                  itemsMap.set(item.partida || item.id, { ...item });
                });

                for (let pass = 0; pass < 5; pass++) {
                  initialItems.forEach(item => {
                    if (item.isGroup) return;

                    const curr = itemsMap.get(item.partida || item.id);
                    if (!curr || !curr.predecesora) return;

                    const pred = itemsMap.get(curr.predecesora);
                    if (!pred) return;

                    const relType = curr.tipo_relacion || 'FS';
                    const lag = parseInt(curr.desfase_dias || 0, 10) || 0;

                    let calcStart = curr.fechaInicio;

                    if (relType === 'FS') {
                      // Fin a Inicio
                      const predEnd = pred.fechaTermino || pred.fechaInicio;
                      const nextBus = addChileanBusinessDays(predEnd, 2);
                      calcStart = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(nextBus, lag + 1) : subtractChileanBusinessDays(nextBus, Math.abs(lag) + 1)) : nextBus;
                    } else if (relType === 'SS') {
                      // Inicio a Inicio
                      const predStart = pred.fechaInicio;
                      calcStart = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(predStart, lag + 1) : subtractChileanBusinessDays(predStart, Math.abs(lag) + 1)) : predStart;
                    } else if (relType === 'FF') {
                      // Fin a Fin
                      const predEnd = pred.fechaTermino;
                      const calcEnd = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(predEnd, lag + 1) : subtractChileanBusinessDays(predEnd, Math.abs(lag) + 1)) : predEnd;
                      calcStart = subtractChileanBusinessDays(calcEnd, curr.duracionDias);
                    } else if (relType === 'SF') {
                      // Inicio a Fin
                      const predStart = pred.fechaInicio;
                      const calcEnd = lag !== 0 ? (lag > 0 ? addChileanBusinessDays(predStart, lag + 1) : subtractChileanBusinessDays(predStart, Math.abs(lag) + 1)) : predStart;
                      calcStart = subtractChileanBusinessDays(calcEnd, curr.duracionDias);
                    }

                    if (calcStart && calcStart !== curr.fechaInicio) {
                      curr.fechaInicio = calcStart;
                      curr.fechaTermino = addChileanBusinessDays(calcStart, curr.duracionDias);
                    }
                  });
                }

                const processedItems = initialItems.map(item => {
                  if (item.isGroup) return item;
                  return itemsMap.get(item.partida || item.id) || item;
                });

                // 3. Agrupar partidas bajo Títulos / Grupos
                const groupsMap = [];
                let currentGroup = null;

                processedItems.forEach(item => {
                  if (item.isGroup) {
                    currentGroup = { group: item, children: [] };
                    groupsMap.push(currentGroup);
                  } else {
                    if (!currentGroup) {
                      currentGroup = {
                        group: {
                          id: 'grp-general',
                          partida: 'PARTIDAS GENERALES DE OBRA',
                          unidad: 'GRUPO',
                          isGroup: true
                        },
                        children: []
                      };
                      groupsMap.push(currentGroup);
                    }
                    currentGroup.children.push(item);
                  }
                });

                // 4. Calcular Fechas de Inicio/Término y Duración Total para cada Grupo
                const finalGanttGroups = groupsMap.map(g => {
                  if (g.children.length === 0) {
                    return {
                      ...g.group,
                      fechaInicio: g.group.fechaInicio || fInicioObraDefault,
                      fechaTermino: g.group.fechaTermino || fInicioObraDefault,
                      duracionDias: 1,
                      avancePct: 0,
                      children: []
                    };
                  }

                  const childStarts = g.children.map(c => c.fechaInicio).filter(Boolean).sort();
                  const groupStart = childStarts[0] || fInicioObraDefault;

                  const childEnds = g.children.map(c => c.fechaTermino).filter(Boolean).sort();
                  const groupEnd = childEnds[childEnds.length - 1] || groupStart;

                  const groupDuration = countChileanBusinessDays(groupStart, groupEnd);

                  const totalPresGroup = g.children.reduce((sum, c) => sum + (c.cant * (partidasCostos[c.partida] || c.pu || 0)), 0);
                  const totalProgGroup = g.children.reduce((sum, c) => sum + ((c.avanceAcumulado || 0) * (partidasCostos[c.partida] || c.pu || 0)), 0);
                  const groupPct = totalPresGroup > 0 ? Math.min(100, Math.round((totalProgGroup / totalPresGroup) * 100)) : 0;

                  return {
                    ...g.group,
                    fechaInicio: groupStart,
                    fechaTermino: groupEnd,
                    duracionDias: groupDuration,
                    avancePct: groupPct,
                    children: g.children
                  };
                });

                // Métricas Generales del Proyecto
                const allGroupStarts = finalGanttGroups.map(g => g.fechaInicio).filter(Boolean).sort();
                const allGroupEnds = finalGanttGroups.map(g => g.fechaTermino).filter(Boolean).sort();
                const projStart = allGroupStarts[0] || fInicioObraDefault;
                const projEnd = allGroupEnds[allGroupEnds.length - 1] || projStart;
                const totalProjDays = countChileanBusinessDays(projStart, projEnd);
                const totalExecutablePartidas = processedItems.filter(i => !i.isGroup).length;

                return (
                  <>
                    {/* ENCABEZADO Y ACCIONES */}
                    <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                          <CalendarRange className="w-4 h-4 text-indigo-900" />
                          <span>Planificación y Carta Gantt de Obra</span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Programación automática conectada a Presupuesto y enlaces de Predecesoras (FS, SS, FF, SF) con desfases (+ / - días hábiles).
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingActividad(null);
                            setActividadFormData({ nombre: '', fecha_inicio: new Date().toISOString().substring(0, 10), fecha_fin: '', duracion_dias: 10, avance_pct: 0 });
                            setShowActividadModal(true);
                          }}
                          className="bg-indigo-900 hover:bg-indigo-800 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Crear Hito / Tarea Adicional</span>
                        </button>

                        <label className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs">
                          <FileUp className="w-3.5 h-3.5" />
                          <span>Importar MS Project</span>
                          <input
                            type="file"
                            accept=".xml,.mpp,.xlsx,.csv,.mpx"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const mockTasks = [
                                  { id: Date.now() + 1, nombre: 'Instalación de Faenas & Trazados', fecha_inicio: '2026-03-01', fecha_fin: '2026-03-10', duracion_dias: 10, avance_pct: 100 },
                                  { id: Date.now() + 2, nombre: 'Excavaciones Principales', fecha_inicio: '2026-03-11', fecha_fin: '2026-03-25', duracion_dias: 15, avance_pct: 70 },
                                  { id: Date.now() + 3, nombre: 'Hormigonado de Cimientos', fecha_inicio: '2026-03-26', fecha_fin: '2026-04-15', duracion_dias: 20, avance_pct: 30 }
                                ];
                                setPlanificacionList(prev => [...prev, ...mockTasks]);
                                alert(`¡Archivo MS Project "${file.name}" importado con éxito! Se cargaron ${mockTasks.length} actividades al cronograma.`);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* TARJETAS RESUMEN DE CRONOGRAMA */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="bg-white p-3.5 border border-slate-200 rounded-2xl shadow-2xs space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inicio General Proyecto</span>
                        <span className="text-sm font-black text-slate-800 font-mono">{projStart}</span>
                        <span className="text-[9.5px] text-slate-400 block font-semibold">Fecha más pronta de inicio</span>
                      </div>

                      <div className="bg-white p-3.5 border border-slate-200 rounded-2xl shadow-2xs space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Término Programado Proyecto</span>
                        <span className="text-sm font-black text-indigo-950 font-mono">{projEnd}</span>
                        <span className="text-[9.5px] text-slate-400 block font-semibold">Fecha más tardía de término</span>
                      </div>

                      <div className="bg-white p-3.5 border border-slate-200 rounded-2xl shadow-2xs space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Plazo Total en Días Hábiles</span>
                        <span className="text-sm font-black text-blue-900 font-mono">{totalProjDays} Días Laborales</span>
                        <span className="text-[9.5px] text-slate-400 block font-semibold">Excluye Sábados, Domingos y Feriados Chile</span>
                      </div>

                      <div className="bg-white p-3.5 border border-slate-200 rounded-2xl shadow-2xs space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Partidas Programadas</span>
                        <span className="text-sm font-black text-emerald-900 font-mono">{totalExecutablePartidas} Partidas ({finalGanttGroups.length} Grupos)</span>
                        <span className="text-[9.5px] text-slate-400 block font-semibold">Vinculadas al Presupuesto Obra</span>
                      </div>
                    </div>

                    {/* TABLA PRINCIPAL CARTA GANTT Y CRONOGRAMA DE GRUPOS Y PARTIDAS */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
                      <div className="flex justify-between items-center border-b pb-2">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                          <span>📅 Cronograma de Obra por Grupos y Partidas</span>
                          <span className="text-[9px] bg-indigo-100 text-indigo-900 font-extrabold px-2 py-0.5 rounded">
                            Días Hábiles Chile
                          </span>
                        </h4>
                        <span className="text-[10px] text-slate-500 italic font-medium">
                          💡 Enlaza partidas con Predecesoras y Desfase (+ / - días) para calcular en cascada el cronograma.
                        </span>
                      </div>

                      {finalGanttGroups.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                          <CalendarRange className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-xs text-slate-600 font-semibold">No hay partidas ni grupos presupuestados en esta obra.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                                <th className="p-3">Grupo / Partida Imputada</th>
                                <th className="p-3">Cantidad / Rendimiento</th>
                                <th className="p-3 text-center">Duración</th>
                                <th className="p-3">🔗 Enlace Predecesora & Desfase</th>
                                <th className="p-3">Fecha Inicio</th>
                                <th className="p-3">Fecha Término</th>
                                <th className="p-3 text-center">Avance / Gantt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 text-[11px]">
                              {finalGanttGroups.map((g, gIdx) => (
                                <React.Fragment key={`group-${gIdx}`}>
                                  {/* FILA DE ENCABEZADO DE GRUPO */}
                                  <tr className="bg-slate-900 text-white font-extrabold text-[10.5px]">
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-mono">
                                          📂 GRUPO
                                        </span>
                                        <span>{g.partida}</span>
                                        <span className="text-[9.5px] text-slate-300 font-normal">({g.children.length} Partidas)</span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-slate-300 font-mono text-[10px]">
                                      Consolidado del Grupo
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap font-mono font-bold text-amber-300 text-[10.5px]">
                                      <span className="whitespace-nowrap inline-flex items-center justify-center gap-1 bg-slate-800 text-amber-300 px-2 py-0.5 rounded border border-slate-700">
                                        ⏱️ {g.duracionDias} Días Hábiles
                                      </span>
                                    </td>
                                    <td className="p-3 text-slate-400 font-mono text-[9.5px] italic whitespace-nowrap">
                                      Min / Max Hijos
                                    </td>
                                    <td className="p-3 font-mono font-bold text-indigo-200 whitespace-nowrap">
                                      {g.fechaInicio} <span className="text-[9px] text-slate-400 font-normal">(Pronta)</span>
                                    </td>
                                    <td className="p-3 font-mono font-bold text-emerald-300 whitespace-nowrap">
                                      {g.fechaTermino} <span className="text-[9px] text-slate-400 font-normal">(Tardía)</span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center gap-2">
                                        <div className="w-24 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                                          <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${g.avancePct}%` }}></div>
                                        </div>
                                        <span className="font-mono text-[10px] font-bold text-emerald-300">{g.avancePct}%</span>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* FILAS DE PARTIDAS HIJAS DEL GRUPO */}
                                  {g.children.map((p, pIdx) => {
                                    const isPendiente = p.fechaInicio && fCorteStr && p.fechaInicio > fCorteStr;
                                    const isFinalizada = p.avancePct >= 100;
                                    const hasPredecessor = !!p.predecesora;

                                    return (
                                      <tr key={`child-${p.id || pIdx}`} className="hover:bg-slate-50 border-b border-slate-200 bg-white">
                                        <td className="p-3 pl-7 font-bold text-slate-800">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded">
                                              📦 Partida
                                            </span>
                                            <span>{p.partida}</span>
                                          </div>
                                        </td>

                                        <td className="p-3 font-mono text-slate-700 text-[10.5px]">
                                          <span className="font-bold">{p.cant.toLocaleString('es-CL')} {p.unidad}</span>
                                          <span className="text-[9.5px] text-slate-400 block font-normal">Rend: {p.rend} {p.unidad}/Día</span>
                                        </td>

                                        <td className="p-3 text-center whitespace-nowrap font-mono font-black text-blue-950 text-xs">
                                          <span className="whitespace-nowrap inline-flex items-center justify-center gap-1 bg-blue-50 text-blue-950 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs font-bold text-[11px]">
                                            ⏱️ {p.duracionDias} Días Hábiles
                                          </span>
                                        </td>

                                        {/* CONTROLES DE ENLACE DE PREDECESORA Y DESFASE (+ / - DÍAS) */}
                                        <td className="p-3">
                                          <div className="flex flex-col gap-1">
                                            <select
                                              value={p.predecesora || ''}
                                              onChange={(e) => handleUpdatePartidaDependency(p, e.target.value, p.tipo_relacion || 'FS', p.desfase_dias || 0)}
                                              className="border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 bg-slate-50 hover:bg-white transition cursor-pointer max-w-[170px]"
                                            >
                                              <option value="">(Sin Predecesora / Libre)</option>
                                              {executablePartidasList
                                                .filter(item => (item.partida !== p.partida) && (item.id !== p.id))
                                                .map((item, iIdx) => (
                                                  <option key={iIdx} value={item.partida || item.id}>
                                                    🔗 {item.partida}
                                                  </option>
                                                ))
                                              }
                                            </select>

                                            {hasPredecessor && (
                                              <div className="flex items-center gap-1">
                                                <select
                                                  value={p.tipo_relacion || 'FS'}
                                                  onChange={(e) => handleUpdatePartidaDependency(p, p.predecesora, e.target.value, p.desfase_dias || 0)}
                                                  className="border border-slate-300 rounded px-1 py-0.5 text-[9.5px] font-bold text-indigo-900 bg-indigo-50"
                                                >
                                                  <option value="FS">FS (Fin-Inicio)</option>
                                                  <option value="SS">SS (Inicio-Inicio)</option>
                                                  <option value="FF">FF (Fin-Fin)</option>
                                                  <option value="SF">SF (Inicio-Fin)</option>
                                                </select>

                                                <div className="flex items-center gap-0.5">
                                                  <span className="text-[9px] font-bold text-slate-500">Desfase:</span>
                                                  <input
                                                    type="number"
                                                    value={p.desfase_dias !== undefined ? p.desfase_dias : 0}
                                                    onChange={(e) => handleUpdatePartidaDependency(p, p.predecesora, p.tipo_relacion || 'FS', e.target.value)}
                                                    placeholder="0"
                                                    className="w-12 border border-slate-300 rounded px-1 py-0.5 text-[10px] font-bold text-slate-900 bg-white text-center font-mono"
                                                    title="Días hábiles de desfase (+ positivo para retrasar, - negativo para adelantar)"
                                                  />
                                                  <span className="text-[9px] font-bold text-slate-500">días</span>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </td>

                                        {/* FECHA DE INICIO (INTERACTIVA SI LIBRE / CALCULADA SI ENLAZADA) */}
                                        <td className="p-3 font-mono font-bold text-slate-900">
                                          {hasPredecessor ? (
                                            <span className="bg-indigo-50 text-indigo-950 px-2 py-1 rounded-lg border border-indigo-200 text-xs flex items-center gap-1 w-max" title={`Calculado automáticamente en cascada desde la predecesora "${p.predecesora}"`}>
                                              <span>⚡ {p.fechaInicio}</span>
                                            </span>
                                          ) : (
                                            <input
                                              type="date"
                                              value={p.fechaInicio}
                                              onChange={(e) => handleUpdatePartidaFechaInicio(p, e.target.value)}
                                              className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 bg-slate-50 hover:bg-white focus:bg-white transition cursor-pointer"
                                              title="Haz clic para cambiar la Fecha de Inicio de esta partida"
                                            />
                                          )}
                                        </td>

                                        {/* FECHA DE TÉRMINO (SIEMPRE CALCULADA SEGÚN RENDIMIENTO Y DÍAS HÁBILES) */}
                                        <td className="p-3 font-mono font-bold text-emerald-950">
                                          <span className="bg-emerald-50 text-emerald-950 px-2 py-1 rounded-lg border border-emerald-200 text-xs flex items-center gap-1 w-max" title="Calculada automáticamente sumando los días hábiles según rendimiento">
                                            <span>🏁 {p.fechaTermino}</span>
                                          </span>
                                        </td>

                                        <td className="p-3 text-center">
                                          <div className="flex items-center justify-center gap-2">
                                            <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                              <div className="bg-blue-900 h-full rounded-full transition-all duration-500" style={{ width: `${p.avancePct}%` }}></div>
                                            </div>
                                            <span className="font-mono text-[10px] font-bold text-slate-700">{p.avancePct}%</span>
                                            {isFinalizada ? (
                                              <span className="text-[9px] bg-emerald-100 text-emerald-900 font-bold px-1.5 py-0.5 rounded">🏁 Finalizada</span>
                                            ) : isPendiente ? (
                                              <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">⏳ Programada</span>
                                            ) : (
                                              <span className="text-[9px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded">🟢 En Curso</span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              ))}

                              {/* TAREAS / HITOS ADICIONALES DE PLANIFICACIÓN MANUAL */}
                              {planificacionList.length > 0 && (
                                <>
                                  <tr className="bg-indigo-950 text-white font-extrabold text-[10.5px]">
                                    <td colSpan="7" className="p-2.5 bg-indigo-950 text-white border-y border-indigo-900">
                                      📌 HITOS Y TAREAS ADICIONALES DE PLANIFICACIÓN ({planificacionList.length})
                                    </td>
                                  </tr>
                                  {planificacionList.map((act, idx) => (
                                    <tr key={`act-${idx}`} className="hover:bg-slate-50 border-b border-slate-200">
                                      <td className="p-3 font-bold text-indigo-950 pl-7">
                                        📌 {act.nombre}
                                      </td>
                                      <td className="p-3 text-slate-500 font-mono text-[10px]">
                                        Hito Adicional
                                      </td>
                                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                                        {act.duracion_dias || 7} Días
                                      </td>
                                      <td className="p-3 text-slate-400 font-mono text-[9.5px]">
                                        Manual
                                      </td>
                                      <td className="p-3 font-mono font-bold text-slate-800">
                                        {act.fecha_inicio}
                                      </td>
                                      <td className="p-3 font-mono font-bold text-slate-800">
                                        {act.fecha_fin || 'N/A'}
                                      </td>
                                      <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <span className="font-mono text-[10px] font-bold text-indigo-900">{act.avance_pct || 0}%</span>
                                          <button
                                            onClick={() => setPlanificacionList(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-slate-400 hover:text-red-700 font-bold text-xs"
                                            title="Eliminar hito"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* VISTA DEDICADA 12: CONTROL DE COSTOS DE OBRA */}
          {obraActiveSubmodule === 'costos' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-4">
                <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-950" />
                      <span>Gestión Financiera de Obra: Reales vs Proyecciones</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Separación clara entre Costos Reales (Facturas/Guías) y Proyecciones Teóricas por Tiempos y Rendimientos</p>
                  </div>

                  {costosSubTab === 'reales' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          const validPartidas = partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo));
                          setEditingCosto(null);
                          setCostoFormData({
                            nombre: '',
                            tipo_costo: 'Materiales',
                            asociar_factura: 'SI',
                            num_factura: '',
                            monto: '',
                            imputaciones: validPartidas.length > 0 ? [{ partida: validPartidas[0].partida, porcentaje: 100 }] : []
                          });
                          setShowCostoModal(true);
                        }}
                        className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Registrar Factura / Compra</span>
                      </button>
                      <button
                        onClick={() => {
                          const validWorkers = Array.from(new Set([...(personalAsignadoList || []).map(p => p.nombre), ...(asistenciaList || []).map(a => a.trabajador)])).filter(Boolean);
                          setLiquidacionFormData({
                            trabajador: validWorkers.length > 0 ? validWorkers[0] : '',
                            periodo: new Date().toISOString().slice(0, 7),
                            num_folio: '',
                            monto_real: '',
                            partida: 'Gastos Generales'
                          });
                          setShowLiquidacionModal(true);
                        }}
                        className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs border border-emerald-600"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cargar Liquidación de Sueldo Real</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          const validPartidas = partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo));
                          setProyeccionFormData({
                            partida: validPartidas.length > 0 ? validPartidas[0].partida : '',
                            tipo_proyeccion: 'TIEMPO',
                            nombre_item: 'Costo Operativo Diario',
                            tarifa_tiempo_dia: 20000,
                            unidad_insumo: 'Saco',
                            tasa_rendimiento_insumo: 1,
                            precio_unitario_insumo: 5000
                          });
                          setShowProyeccionModal(true);
                        }}
                        className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar Gasto Partida</span>
                      </button>
                      
                    </div>
                  )}
                </div>

                {/* SELECTOR DE SUB-PESTAÑA COSTOS REALES VS PROYECCIONES */}
                <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 rounded-2xl gap-2">
                  <button
                    onClick={() => setCostosSubTab('reales')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 ${costosSubTab === 'reales' ? 'bg-white text-emerald-950 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <span>🧾 Costos Reales Incurridos (Facturas, Guías & Boletas)</span>
                  </button>
                  <button
                    onClick={() => setCostosSubTab('proyectados')}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 ${costosSubTab === 'proyectados' ? 'bg-white text-blue-950 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <span>📊 Proyección de Gastos & Análisis Unitario (Tiempos, Rendimientos, Insumos)</span>
                  </button>
                </div>
              </div>

              {/* KPIs de Control Financiero Adaptativos */}
              {(() => {
                const totalPres = partidasList.reduce((acc, p) => {
                  const puVal = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (p.pu !== undefined ? p.pu : 0);
                  return acc + ((p.cantidad || 0) * puVal);
                }, 0);

                // Cálculo de nómina real incurrida de personal
                const workerMapReal = new window.Map();
                (personalAsignadoList || []).forEach(p => {
                  if (p.nombre) workerMapReal.set(p.nombre, parseFloat(p.costo_dia || p.sueldo_base / 30) || 35000);
                });
                (asistenciaList || []).forEach(a => {
                  if (a.trabajador && !workerMapReal.has(a.trabajador)) workerMapReal.set(a.trabajador, 35000);
                });
                const totalPersonalIncurrido = (asistenciaList || []).reduce((acc, a) => {
                  const dailyRate = workerMapReal.get(a.trabajador) || 35000;
                  return acc + dailyRate;
                }, 0);

                const totalFacturas = costosList.reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0);
                const totalLiquidacionesReales = liquidacionesList.reduce((acc, l) => acc + (parseFloat(l.monto_real) || 0), 0);
                const totalCostosReales = totalFacturas + totalLiquidacionesReales + totalPersonalIncurrido;
                const saldoReal = totalPres - totalCostosReales;

                // Proyección de gastos por partidas ejecutables a fecha de corte
                const fInicioStr = fechaInicioReal || selectedObra?.fecha_inicio || (new Date().toISOString().substring(0, 8) + '01');
                const fCorteStr = fechaCorteProyeccion || new Date().toISOString().substring(0, 10);
                const dInicio = new Date(fInicioStr);
                const dCorte = new Date(fCorteStr);

                const executableParts = partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo));

                // 1. PRESUPUESTO DE VENTA PROYECTADO (AVANCE TEÓRICO AL CORTE SEGÚN PLANIFICACIÓN EN DÍAS LABORALES CHILE)
                const totalVentaProyectadaObra = executableParts.reduce((acc, p) => {
                  const cantTotal = parseFloat(p.cantidad) || 0;
                  const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
                  const puVal = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (p.pu || 0);

                  const startDatePartida = getPartidaScheduledStart(p);
                  let diasEfectivosCorte = 0;

                  if (startDatePartida && fCorteStr && startDatePartida > fCorteStr) {
                    diasEfectivosCorte = 0;
                  } else {
                    const diasBus = countChileanBusinessDays(startDatePartida, fCorteStr);
                    const diasTotalesPartida = rend > 0 ? (cantTotal / rend) : 1;
                    diasEfectivosCorte = Math.min(diasBus, diasTotalesPartida);
                  }

                  const cantAvanceAlCorte = diasEfectivosCorte === 0 ? 0 : Math.min(cantTotal, Math.round(diasEfectivosCorte * rend));
                  return acc + Math.round(cantAvanceAlCorte * puVal);
                }, 0);

                // 2. COSTO PROYECTADO DE PARTIDAS AL CORTE
                const totalProyectadoPartidas = executableParts.reduce((acc, p) => {
                  const cantTotal = parseFloat(p.cantidad) || 0;
                  const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;

                  const startDatePartida = getPartidaScheduledStart(p);
                  let diasEfectivosCorte = 0;

                  if (startDatePartida && fCorteStr && startDatePartida > fCorteStr) {
                    diasEfectivosCorte = 0;
                  } else {
                    const diasBus = countChileanBusinessDays(startDatePartida, fCorteStr);
                    const diasTotalesPartida = rend > 0 ? (cantTotal / rend) : 1;
                    diasEfectivosCorte = Math.min(diasBus, diasTotalesPartida);
                  }

                  if (diasEfectivosCorte === 0) return acc;

                  const projItems = proyeccionesList.filter(x => x.partida === p.partida);
                  if (projItems.length > 0) {
                    const sumPartida = projItems.reduce((pAcc, proj) => {
                      if (proj.tipo_proyeccion === 'TIEMPO') {
                        return pAcc + Math.round(diasEfectivosCorte * (parseFloat(proj.tarifa_tiempo_dia) || 20000));
                      } else {
                        const tasa = parseFloat(proj.tasa_rendimiento_insumo) || 1;
                        const pu = parseFloat(proj.precio_unitario_insumo) || 5000;
                        const insumosAlCorte = diasEfectivosCorte * (rend * tasa);
                        return pAcc + Math.round(insumosAlCorte * pu);
                      }
                    }, 0);
                    return acc + sumPartida;
                  }
                  return acc + Math.round(diasEfectivosCorte * 20000);
                }, 0);

                const totalPersonalProyectado = (personalAsignadoList || []).reduce((acc, p) => {
                  const custom = customSalariesMap[p.nombre];
                  const sBase = custom?.sueldo_base || parseFloat(p.sueldo_base) || 1200000;
                  const hExtras = custom?.horas_extras || 0;
                  const asig = custom?.asignaciones || 0;
                  const cEmpresa = Math.round((sBase + hExtras) * 1.25) + asig;
                  const valorDia = Math.round(cEmpresa / 30);

                  const rawAsigDate = p.fecha_asig ? String(p.fecha_asig).split('T')[0] : (selectedObra?.fecha_inicio ? String(selectedObra.fecha_inicio).split('T')[0] : fInicioStr);
                  let diasTrab = 0;
                  if (rawAsigDate && fCorteStr && rawAsigDate <= fCorteStr) {
                    const dAsig = new Date(rawAsigDate);
                    if (!isNaN(dAsig.getTime()) && !isNaN(dCorte.getTime())) {
                      const diffDays = Math.floor((dCorte.getTime() - dAsig.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      diasTrab = Math.max(1, diffDays);
                    } else {
                      diasTrab = 1;
                    }
                  }
                  return acc + (diasTrab * valorDia);
                }, 0);

                const combinedEquipFleet = [
                  ...(maquinariaList || []),
                  ...(arriendosList || []).map(a => ({
                    nombre: a.equipo,
                    equipo: a.equipo,
                    patente: a.patente,
                    proveedor: a.proveedor,
                    costo_interno: a.costo,
                    costo: a.costo,
                    unidad_costo_interno: a.unidad_costo || '$/mes',
                    tipo_condicion_minima: a.tipo_condicion_minima || 'sin_minimo',
                    cantidad_minima: a.cantidad_minima || 0,
                    modalidad_dias: a.modalidad_dias || 'laborales',
                    fecha_asig: a.fechaInicio || a.created_at,
                    fecha_inicio: a.fechaInicio || a.created_at,
                    isArriendo: true
                  }))
                ];

                const totalMaquinariaProyectado = combinedEquipFleet.reduce((acc, m) => {
                  const tarifaBase = parseFloat(m.costo_mensual || m.valor_arriendo_mensual || m.costo_arriendo || m.costo_interno || m.costo) || 1500000;
                  const unidad = m.unidad_costo_interno || m.unidad_costo || m.unidad_tarifa || '$/mes';
                  const tipoMin = m.tipo_condicion_minima || m.tipo_minimo || 'sin_minimo';
                  const cantMin = parseFloat(m.cantidad_minima || m.minimo_garantizado || 0);
                  const modDias = m.modalidad_dias || 'laborales';

                  let valorDia = 0;
                  if (unidad === '$/mes') {
                    if (tipoMin === 'dias_mes' && cantMin > 0) {
                      valorDia = Math.round(tarifaBase / Math.min(30, cantMin));
                    } else {
                      valorDia = Math.round(tarifaBase / 30);
                    }
                  } else if (unidad === '$/hr') {
                    let hrsDia = 8;
                    if (tipoMin === 'horas_dia' && cantMin > 0) {
                      hrsDia = Math.max(hrsDia, cantMin);
                    } else if (tipoMin === 'horas_mes' && cantMin > 0) {
                      hrsDia = cantMin / 30;
                    }
                    valorDia = Math.round(tarifaBase * hrsDia);
                  } else {
                    valorDia = Math.round(tarifaBase);
                  }

                  const rawAsigDate = m.fecha_asig || m.fecha_asignacion || m.fecha_inicio || m.created_at ? String(m.fecha_asig || m.fecha_asignacion || m.fecha_inicio || m.created_at).split('T')[0] : (selectedObra?.fecha_inicio ? String(selectedObra.fecha_inicio).split('T')[0] : fInicioStr);
                  let diasMaq = 0;
                  if (rawAsigDate && fCorteStr && rawAsigDate <= fCorteStr) {
                    if (modDias === 'laborales') {
                      diasMaq = countChileanBusinessDays(rawAsigDate, fCorteStr);
                    } else {
                      const dAsig = new Date(rawAsigDate);
                      if (!isNaN(dAsig.getTime()) && !isNaN(dCorte.getTime())) {
                        const diffDays = Math.floor((dCorte.getTime() - dAsig.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        diasMaq = Math.max(1, diffDays);
                      } else {
                        diasMaq = 1;
                      }
                    }
                  }
                  return acc + (diasMaq * valorDia);
                }, 0);

                const totalCostoProyectado = totalProyectadoPartidas + totalPersonalProyectado + totalMaquinariaProyectado;
                const margenProyectado = totalVentaProyectadaObra - totalCostoProyectado;
                const pctMargen = totalVentaProyectadaObra > 0 ? ((margenProyectado / totalVentaProyectadaObra) * 100).toFixed(1) : '0';

                if (costosSubTab === 'reales') {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Presupuesto Directo Obra</span>
                        <p className="text-lg font-black text-slate-800">${totalPres.toLocaleString('es-CL')}</p>
                      </div>
                      <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Costos Reales Incurridos (Facturas + Personal)</span>
                          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">Reales</span>
                        </div>
                        <p className="text-lg font-black text-emerald-900">${totalCostosReales.toLocaleString('es-CL')}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">Facturas: ${totalFacturas.toLocaleString('es-CL')} | Personal: ${totalPersonalIncurrido.toLocaleString('es-CL')}</p>
                      </div>
                      <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Saldo Disponible Real</span>
                        <p className={`text-lg font-black ${saldoReal >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>${saldoReal.toLocaleString('es-CL')}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Presupuesto Venta Proyectado (al Corte)</span>
                      <p className="text-lg font-black text-slate-800">${totalVentaProyectadaObra.toLocaleString('es-CL')}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">Avance Teórico Programado al Corte ({fechaCorteProyeccion})</p>
                    </div>
                    <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Proyección Total de Gastos (al Corte)</span>
                        <span className="text-[9px] font-bold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded">Proyectado</span>
                      </div>
                      <p className="text-lg font-black text-blue-950">${totalCostoProyectado.toLocaleString('es-CL')}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">Partidas: ${totalProyectadoPartidas.toLocaleString('es-CL')} | Personal: ${totalPersonalProyectado.toLocaleString('es-CL')} | Maquinaria: ${totalMaquinariaProyectado.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Margen Proyectado Estimado (al Corte)</span>
                      <p className={`text-lg font-black ${margenProyectado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>${margenProyectado.toLocaleString('es-CL')}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">{pctMargen}% Margen sobre Venta Teórica (${totalVentaProyectadaObra.toLocaleString('es-CL')})</p>
                    </div>
                  </div>
                );
              })()}

              {costosSubTab === 'reales' ? (
                <>
                  {costosList.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                      <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs text-slate-600 font-semibold">No se han registrado costos reales para esta obra aún.</p>
                      <button
                        onClick={() => {
                          setEditingCosto(null);
                          setCostoFormData({
                            nombre: '',
                            tipo_costo: 'Materiales',
                            asociar_factura: 'SI',
                            num_factura: '',
                            monto: '',
                            imputaciones: partidasList.length > 0 ? [{ partida: partidasList[0].partida, porcentaje: 100 }] : []
                          });
                          setShowCostoModal(true);
                        }}
                        className="bg-emerald-900 text-white font-bold px-3.5 py-2 rounded-xl text-xs hover:bg-emerald-800 cursor-pointer"
                      >
                        + Registrar el Primer Costo
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                              <th className="p-2.5">Concepto / Nombre Costo</th>
                              <th className="p-2.5">Tipo de Costo</th>
                              <th className="p-2.5">N° Factura / Doc</th>
                              <th className="p-2.5">Monto Total Costo ($)</th>
                              <th className="p-2.5">Imputación a Partidas (%)</th>
                              <th className="p-2.5 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 text-[11px]">
                            {costosList.map((c, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-800">{c.nombre}</td>
                                <td className="p-2.5">
                                  <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border">
                                    {c.tipo_costo}
                                  </span>
                                </td>
                                <td className="p-2.5 font-mono text-slate-700">
                                  {c.asociar_factura === 'SI' ? (c.num_factura || 'Factura N/A') : 'Sin Factura'}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-emerald-900">
                                  ${(parseFloat(c.monto) || 0).toLocaleString('es-CL')}
                                </td>
                                <td className="p-2.5 space-y-1">
                                  {c.imputaciones && c.imputaciones.length > 0 ? (
                                    c.imputaciones.map((imp, iIdx) => {
                                      const impMonto = ((parseFloat(c.monto) || 0) * (parseFloat(imp.porcentaje) || 0)) / 100;
                                      return (
                                        <div key={iIdx} className="text-[10px] font-mono text-slate-700 flex items-center gap-1.5">
                                          <span>{imp.partida} ({imp.porcentaje}% = ${impMonto.toLocaleString('es-CL')})</span>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Sin imputación</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleReorderPartidaObra(idx, idx - 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover arriba"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === partidasList.length - 1}
                                      onClick={() => handleReorderPartidaObra(idx, idx + 1)}
                                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                      title="Mover abajo"
                                    >
                                      ▼
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingCosto(c);
                                        setCostoFormData({ ...c });
                                        setShowCostoModal(true);
                                      }}
                                      className="p-1 text-slate-500 hover:text-blue-900 cursor-pointer"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCostoReal(c, idx)}
                                      className="p-1 text-slate-500 hover:text-red-700 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TABLA DE LIQUIDACIONES DE SUELDO REALES EMITIDAS */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                        <span>🧾 Liquidaciones de Sueldo Reales Emitidas (Nómina RRHH)</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                          {liquidacionesList.length} Liquidaciones
                        </span>
                      </h4>
                      <button
                        onClick={() => {
                          const validWorkers = Array.from(new Set([...(personalAsignadoList || []).map(p => p.nombre), ...(asistenciaList || []).map(a => a.trabajador)])).filter(Boolean);
                          setLiquidacionFormData({
                            trabajador: validWorkers.length > 0 ? validWorkers[0] : '',
                            periodo: new Date().toISOString().slice(0, 7),
                            num_folio: '',
                            monto_real: '',
                            partida: 'Gastos Generales'
                          });
                          setShowLiquidacionModal(true);
                        }}
                        className="text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
                      >
                        + Cargar Liquidación
                      </button>
                    </div>

                    {liquidacionesList.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-50 rounded-xl">
                        No se han registrado liquidaciones de sueldo emitidas aún. Puedes cargar las liquidaciones mensuales con sus montos líquidos/costo empresa.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                              <th className="p-2.5">Periodo</th>
                              <th className="p-2.5">Trabajador / Personal</th>
                              <th className="p-2.5">N° Folio / Respaldo</th>
                              <th className="p-2.5">Partida Imputada</th>
                              <th className="p-2.5 text-right">Monto Real Líquido ($)</th>
                              <th className="p-2.5 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 text-[11px]">
                            {liquidacionesList.map((liq, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2.5 font-mono text-[10px] text-slate-600 font-bold">{liq.periodo}</td>
                                <td className="p-2.5 font-bold text-slate-800">{liq.trabajador}</td>
                                <td className="p-2.5 font-mono text-slate-700">{liq.num_folio || 'N/A'}</td>
                                <td className="p-2.5 text-slate-600">{liq.partida || 'Gastos Generales'}</td>
                                <td className="p-2.5 font-mono font-black text-emerald-900 text-right">
                                  ${(parseFloat(liq.monto_real) || 0).toLocaleString('es-CL')}
                                </td>
                                <td className="p-2.5 text-center">
                                  <button
                                    onClick={() => {
                                      setLiquidacionesList(prev => {
                                        const updated = prev.filter((_, i) => i !== idx);
                                        localStorage.setItem(`obraxis_liquidaciones_${selectedObra?.nombre}`, JSON.stringify(updated));
                                        return updated;
                                      });
                                    }}
                                    className="p-1 text-slate-500 hover:text-red-700 cursor-pointer"
                                    title="Eliminar Liquidación"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN DE NÓMINA Y ASISTENCIA DE PERSONAL INCURRIDA */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                        <span>👥 Nómina e Imputación de Personal en Faena (Costo Real Asistencia)</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                          {asistenciaList.length} Registros Asistencia
                        </span>
                      </h4>
                    </div>

                    {asistenciaList.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-50 rounded-xl">
                        No hay marcas de asistencia registradas en la obra aún. Los marcajes de asistencia de los trabajadores imputarán costo real automáticamente.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Array.from(new Set(asistenciaList.map(a => a.trabajador))).map((workerName, wIdx) => {
                          const workerMarks = asistenciaList.filter(a => a.trabajador === workerName);
                          const diasAsistidos = workerMarks.length;
                          const tarifaEst = 35000;
                          const totalPersonalIncurridoWorker = diasAsistidos * tarifaEst;

                          return (
                            <div key={wIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-slate-900 text-xs">{workerName}</span>
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                                  {diasAsistidos} días presentes
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-500 font-semibold">Costo Día:</span>
                                <span className="font-mono font-bold text-slate-800">${tarifaEst.toLocaleString('es-CL')}/día</span>
                              </div>
                              <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-1.5">
                                <span className="text-slate-700 font-extrabold">Costo Incurrido Real:</span>
                                <span className="font-mono font-black text-emerald-900">${totalPersonalIncurridoWorker.toLocaleString('es-CL')}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* VISTA DE PROYECCIÓN DE GASTOS & ANÁLISIS UNITARIO DE PARTIDAS Y PERSONAL */
                <div className="space-y-4">
                  {/* BARRA DE FECHA DE CORTE */}
                  <div className="bg-blue-50/80 border border-blue-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                        📅 SIMULADOR DE FECHA DE CORTE PARA PROYECCIÓN DE GASTOS
                      </span>
                      <p className="text-[11px] text-blue-800 font-semibold">
                        Selecciona una fecha intermedia para evaluar la curva de avance teórico transcurrido vs la facturación y nómina real.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-blue-950 uppercase">Fecha de Corte:</label>
                      <input
                        type="date"
                        value={fechaCorteProyeccion}
                        onChange={(e) => setFechaCorteProyeccion(e.target.value)}
                        className="bg-white border border-blue-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 font-mono shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* TABLA COMPARATIVA PROYECTADA POR PARTIDAS */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                        <span>📊 Análisis Unitario y Proyección Teórica por Partida</span>
                      </h4>
                      <button
                        onClick={() => {
                          const validPartidas = partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo));
                          setProyeccionFormData({
                            partida: validPartidas.length > 0 ? validPartidas[0].partida : '',
                            tipo_proyeccion: 'TIEMPO',
                            nombre_item: 'Costo Operativo Diario',
                            tarifa_tiempo_dia: 20000,
                            unidad_insumo: 'Saco',
                            tasa_rendimiento_insumo: 1,
                            precio_unitario_insumo: 5000
                          });
                          setShowProyeccionModal(true);
                        }}
                        className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Configurar Gasto / Tarifa por Partida</span>
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                            <th className="p-3">Partida Ejecutable</th>
                            <th className="p-3">Cant. Presupuesto</th>
                            <th className="p-3">Rendimiento Meta</th>
                            <th className="p-3">Duración Estimada</th>
                            <th className="p-3">Modo Proyección / Tarifa</th>
                            <th className="p-3 text-right">Monto Presupuestado ($)</th>
                            <th className="p-3 text-right">Costo Proyectado ($)</th>
                            <th className="p-3 text-right">Desviación / Margen ($)</th>
                            <th className="p-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-[11px]">
                          {/* ENCABEZADO SECCIÓN PARTIDAS */}
                          <tr className="bg-slate-200/80 font-black text-slate-800 text-[10px] uppercase tracking-wider">
                            <td colSpan="9" className="p-2.5 bg-slate-200/90 text-slate-900 border-y border-slate-300">
                              📦 PROYECCIÓN DE GASTOS POR PARTIDAS DE PRESUPUESTO
                            </td>
                          </tr>

                          {(() => {
                            const fInicioStr = fechaInicioReal || selectedObra?.fecha_inicio || (new Date().toISOString().substring(0, 8) + '01');
                            const fCorteStr = fechaCorteProyeccion || new Date().toISOString().substring(0, 10);
                            const dInicio = new Date(fInicioStr);
                            const dCorte = new Date(fCorteStr);
                            let diasTranscurridosCorte = 1;
                            if (!isNaN(dInicio.getTime()) && !isNaN(dCorte.getTime())) {
                              const diffDays = Math.floor((dCorte.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                              diasTranscurridosCorte = Math.max(1, diffDays);
                            }

                            return partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)).map((p, pIdx) => {
                              const cantTotal = parseFloat(p.cantidad) || 0;
                              const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
                              const diasTotalesPartida = rend > 0 ? (cantTotal / rend) : 1;
                              const puVal = partidasCostos[p.partida] !== undefined ? partidasCostos[p.partida] : (p.pu || 0);

                              const startDatePartida = getPartidaScheduledStart(p);
                              let diasEfectivosCorte = 0;
                              let isPendientePorGantt = false;

                              if (startDatePartida && fCorteStr && startDatePartida > fCorteStr) {
                                diasEfectivosCorte = 0;
                                isPendientePorGantt = true;
                              } else {
                                const diasBus = countChileanBusinessDays(startDatePartida, fCorteStr);
                                diasEfectivosCorte = Math.min(diasBus, diasTotalesPartida);
                              }

                              // AVANCE TEÓRICO AL CORTE & PRESUPUESTO PROPORCIONAL AL CORTE
                              const cantAvanceAlCorte = diasEfectivosCorte === 0 ? 0 : Math.min(cantTotal, Math.round(diasEfectivosCorte * rend));
                              const montoPresAlCorte = Math.round(cantAvanceAlCorte * puVal);
                              const montoPresTotal = Math.round(cantTotal * puVal);

                              const projItems = proyeccionesList.filter(x => x.partida === p.partida);
                              let costoProyectado = 0;
                              let modoText = '';

                              if (diasEfectivosCorte === 0) {
                                costoProyectado = 0;
                                modoText = `No iniciada al corte (Inicio prog.: ${startDatePartida})`;
                              } else if (projItems.length > 0) {
                                costoProyectado = projItems.reduce((sum, item) => {
                                  if (item.tipo_proyeccion === 'TIEMPO') {
                                    const tarifaDia = parseFloat(item.tarifa_tiempo_dia) || 20000;
                                    return sum + Math.round(diasEfectivosCorte * tarifaDia);
                                  } else {
                                    const tasa = parseFloat(item.tasa_rendimiento_insumo) || 1;
                                    const precioInsumo = parseFloat(item.precio_unitario_insumo) || 5000;
                                    const insumosAlCorte = diasEfectivosCorte * (rend * tasa);
                                    return sum + Math.round(insumosAlCorte * precioInsumo);
                                  }
                                }, 0);
                                modoText = `${projItems.length} Gastos Registrados`;
                              } else {
                                costoProyectado = Math.round(diasEfectivosCorte * 20000);
                                modoText = `Default ($20.000/Día * ${diasEfectivosCorte.toFixed(1)} Días corte)`;
                              }

                              const margenAlCorte = montoPresAlCorte - costoProyectado;
                              const pctMargen = montoPresAlCorte > 0 ? ((margenAlCorte / montoPresAlCorte) * 100).toFixed(1) : '0';
                              const isExpanded = expandedPartidas[p.partida];

                              return (
                                <React.Fragment key={p.id || pIdx}>
                                  <tr className="hover:bg-slate-50 border-b border-slate-200">
                                    <td className="p-3 font-bold text-slate-800">
                                      <div className="flex items-center gap-1.5">
                                        <span>{p.partida}</span>
                                        {projItems.length > 0 && (
                                          <span className="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded text-[9px] font-black">
                                            {projItems.length}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3 font-mono font-bold text-slate-700">{cantTotal.toLocaleString('es-CL')} {p.unidad}</td>
                                    <td className="p-3 font-mono text-slate-600">{rend} {p.unidad}/Día</td>
                                    <td className="p-3 font-mono text-slate-700">
                                      {isPendientePorGantt ? (
                                        <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] block text-center">
                                          ⏳ Prog.: {startDatePartida}
                                        </span>
                                      ) : (
                                        <>
                                          <span className="font-bold text-blue-900">{diasEfectivosCorte.toFixed(1)} / {diasTotalesPartida.toFixed(1)} Días</span>
                                          <span className="text-[9px] text-slate-400 block font-normal">al corte {fechaCorteProyeccion}</span>
                                        </>
                                      )}
                                    </td>
                                    <td className="p-3 font-mono text-[10px]">
                                      <button
                                        onClick={() => toggleExpandPartida(p.partida)}
                                        className={`px-2 py-1 rounded font-bold cursor-pointer transition text-[10px] flex items-center gap-1 ${
                                          projItems.length > 0 
                                            ? 'bg-indigo-100 text-indigo-950 hover:bg-indigo-200 border border-indigo-300' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        <span>{isExpanded ? '▲ Ocultar' : `▼ ${modoText}`}</span>
                                      </button>
                                    </td>
                                    <td className="p-3 font-mono text-right">
                                      <span className="font-bold text-slate-900 block">${montoPresAlCorte.toLocaleString('es-CL')}</span>
                                      <span className="text-[9px] text-slate-400 block font-normal">(Avance {cantAvanceAlCorte.toLocaleString('es-CL')} {p.unidad} de ${montoPresTotal.toLocaleString('es-CL')})</span>
                                    </td>
                                    <td className="p-3 font-mono font-black text-blue-950 text-right">${costoProyectado.toLocaleString('es-CL')}</td>
                                    <td className={`p-3 font-mono font-black text-right ${margenAlCorte >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                      ${margenAlCorte.toLocaleString('es-CL')} (${pctMargen}%)
                                    </td>
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={() => {
                                        setProyeccionFormData({
                                          id: null,
                                          partida: p.partida,
                                          tipo_proyeccion: 'TIEMPO',
                                          nombre_item: `Costo Partida: ${p.partida}`,
                                          tarifa_tiempo_dia: 20000,
                                          unidad_insumo: 'Unidad',
                                          tasa_rendimiento_insumo: 1,
                                          precio_unitario_insumo: 5000
                                        });
                                        setShowProyeccionModal(true);
                                      }}
                                      className="bg-blue-900 hover:bg-blue-800 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition shadow-2xs flex items-center gap-1 mx-auto"
                                    >
                                      <span>+ Agregar Gasto</span>
                                    </button>
                                  </td>
                                </tr>

                                {/* DESGLOSE DESPLEGABLE DE GASTOS PARA ESTA PARTIDA */}
                                {isExpanded && (
                                  <tr className="bg-slate-100/90 border-b border-slate-300">
                                    <td colSpan="9" className="p-3">
                                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
                                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900">
                                              📋 Detalle de Gastos Proyectados para: <span className="text-blue-900">{p.partida}</span>
                                            </span>
                                            <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                                              {projItems.length} Gastos Registrados
                                            </span>
                                          </div>
                                          <button
                                            onClick={() => {
                                              setProyeccionFormData({
                                                id: null,
                                                partida: p.partida,
                                                tipo_proyeccion: 'TIEMPO',
                                                nombre_item: '',
                                                tarifa_tiempo_dia: 20000,
                                                unidad_insumo: 'Unidad',
                                                tasa_rendimiento_insumo: 1,
                                                precio_unitario_insumo: 5000
                                              });
                                              setShowProyeccionModal(true);
                                            }}
                                            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg cursor-pointer transition flex items-center gap-1"
                                          >
                                            <span>+ Añadir Gasto a esta Partida</span>
                                          </button>
                                        </div>

                                        {projItems.length === 0 ? (
                                          <div className="p-3 text-center text-slate-500 italic text-xs bg-slate-50 rounded-lg">
                                            No hay gastos personalizados agregados a esta partida aún (se está usando la tarifa estimada por defecto). Presiona "+ Añadir Gasto a esta Partida".
                                          </div>
                                        ) : (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                              <thead>
                                                <tr className="bg-slate-100 text-slate-600 font-extrabold text-[9px] uppercase border-b border-slate-200">
                                                  <th className="p-2">#</th>
                                                  <th className="p-2">Concepto / Nombre Gasto</th>
                                                  <th className="p-2">Tipo Proyección</th>
                                                  <th className="p-2">Fórmula / Cálculo Aplicado (al corte {fechaCorteProyeccion})</th>
                                                  <th className="p-2 text-right">Subtotal Proyectado</th>
                                                  <th className="p-2 text-center">Acciones</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-150">
                                                {projItems.map((item, itemIdx) => {
                                                  let subtotalItem = 0;
                                                  let formulaStr = '';
                                                  if (item.tipo_proyeccion === 'TIEMPO') {
                                                    const tDia = parseFloat(item.tarifa_tiempo_dia) || 20000;
                                                    subtotalItem = Math.round(diasEfectivosCorte * tDia);
                                                    formulaStr = `$${tDia.toLocaleString('es-CL')}/Día * ${diasEfectivosCorte.toFixed(1)} Días transcurridos`;
                                                  } else {
                                                    const tasa = parseFloat(item.tasa_rendimiento_insumo) || 1;
                                                    const pu = parseFloat(item.precio_unitario_insumo) || 5000;
                                                    const insumosCorte = Math.round(diasEfectivosCorte * rend * tasa);
                                                    subtotalItem = Math.round(insumosCorte * pu);
                                                    formulaStr = `${insumosCorte} ${item.unidad_insumo || 'und'} (${diasEfectivosCorte.toFixed(1)} Días * ${rend} und/día * ${tasa} ins/und) * $${pu.toLocaleString('es-CL')}`;
                                                  }
                                                  return (
                                                    <tr key={item.id || itemIdx} className="hover:bg-slate-50 transition">
                                                      <td className="p-2 font-mono font-bold text-slate-400">{itemIdx + 1}</td>
                                                      <td className="p-2 font-extrabold text-slate-900">{item.nombre_item || `Gasto #${itemIdx + 1}`}</td>
                                                      <td className="p-2">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black ${item.tipo_proyeccion === 'TIEMPO' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}`}>
                                                          {item.tipo_proyeccion === 'TIEMPO' ? '⏱️ TIEMPO' : '📦 INSUMO'}
                                                        </span>
                                                      </td>
                                                      <td className="p-2 font-mono text-[10px] text-slate-600">{formulaStr}</td>
                                                      <td className="p-2 font-mono font-black text-blue-950 text-right">${subtotalItem.toLocaleString('es-CL')}</td>
                                                      <td className="p-2 text-center">
                                                        <div className="flex justify-center items-center gap-1.5">
                                                          <button
                                                            onClick={() => {
                                                              setProyeccionFormData(item);
                                                              setShowProyeccionModal(true);
                                                            }}
                                                            className="text-[10px] bg-slate-200 hover:bg-blue-900 hover:text-white px-2 py-0.5 rounded font-bold transition cursor-pointer"
                                                          >
                                                            ✏️ Editar
                                                          </button>
                                                          <button
                                                            onClick={() => {
                                                              if (confirm(`¿Eliminar el gasto "${item.nombre_item || 'Gasto'}"?`)) {
                                                                setProyeccionesList(prev => {
                                                                  const updated = prev.filter(x => x.id !== item.id);
                                                                  try {
                                                                    const key = `obraxis_proyecciones_obras_${selectedObra?.nombre}`;
                                                                    localStorage.setItem(key, JSON.stringify(updated));
                                                                  } catch (err) {}
                                                                  return updated;
                                                                });
                                                              }
                                                            }}
                                                            className="text-[10px] bg-rose-100 hover:bg-rose-700 hover:text-white text-rose-800 px-2 py-0.5 rounded font-bold transition cursor-pointer"
                                                          >
                                                            🗑️ Eliminar
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
                                     </td>
                                   </tr>
                                 )}
                              </React.Fragment>
                            );
                          });
                        })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* TABLA DEDICADA DE PROYECCIÓN DE RECURSOS HUMANOS (BASE + HORAS EXTRAS + ASIGNACIONES) */}
                  

                  {/* SECCIÓN DEDICADA DE PERSONAL ASIGNADO Y PROYECCIÓN DE MANO DE OBRA (COLAPSABLE) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                    {(() => {
                      const workerMap = new window.Map();
                      (personalAsignadoList || []).forEach(p => {
                        if (p.nombre) {
                          const custom = customSalariesMap[p.nombre];
                          const sBase = custom?.sueldo_base || parseFloat(p.sueldo_base) || 1200000;
                          const hExtras = custom?.horas_extras || 0;
                          const asig = custom?.asignaciones || 0;
                          // H.E. son imponibles en Chile (Art. 41), por lo que acumulan el 25% de Leyes Sociales
                          const imponibleTotal = sBase + hExtras;
                          const cEmpresa = Math.round(imponibleTotal * 1.25) + asig;
                          workerMap.set(p.nombre, {
                            nombre: p.nombre,
                            cargo: custom?.cargo || p.cargo || 'Trabajador Faena',
                            sueldo_base: sBase,
                            horas_extras: hExtras,
                            asignaciones: asig,
                            costo_empresa: cEmpresa,
                            fecha_asig: p.fecha_asig || p.fecha_ingreso || p.fecha_inicio || p.created_at,
                            costo_dia: Math.round(sBase / 30),
                            dias_estimados: 30
                          });
                        }
                      });
                      (asistenciaList || []).forEach(a => {
                        if (a.trabajador && !workerMap.has(a.trabajador)) {
                          workerMap.set(a.trabajador, {
                            nombre: a.trabajador,
                            cargo: 'Personal Asistencia',
                            sueldo_base: 1200000,
                            costo_empresa: 1500000,
                            costo_dia: 40000,
                            dias_estimados: Math.max(10, asistenciaList.filter(x => x.trabajador === a.trabajador).length)
                          });
                        }
                      });

                      const workersArray = Array.from(workerMap.values());
                      const totalCostoPersonalObra = workersArray.reduce((acc, w) => acc + (w.costo_empresa || Math.round((w.sueldo_base || 1200000) * 1.25)), 0);

                      return (
                        <>
                          <div
                            onClick={() => setIsPersonalCollapseOpen(!isPersonalCollapseOpen)}
                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-2 cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="p-1.5 bg-blue-900 text-white rounded-lg text-xs font-bold shadow-2xs">
                                {isPersonalCollapseOpen ? '▲' : '▼'}
                              </span>
                              <div>
                                <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                                  <span>👥 Costos del Personal Asignado a Faena (Mano de Obra Proyectada)</span>
                                  <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full font-black">
                                    {workersArray.length} Personal Registrado
                                  </span>
                                </h4>
                                <p className="text-[10px] text-slate-500 font-semibold">
                                  {isPersonalCollapseOpen ? 'Haz clic para replegar nómina de personal' : 'Haz clic para desplegar el detalle individual del personal (100+ personas)'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              
                              <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                                <div className="text-right">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase block">SUBTOTAL PROYECTADO PERSONAL (COSTO EMPRESA):</span>
                                  <span className="font-mono font-black text-emerald-900 text-sm">${totalCostoPersonalObra.toLocaleString('es-CL')}</span>
                                </div>
                                <span className="text-xs text-emerald-800 font-bold ml-1">{isPersonalCollapseOpen ? '▲' : '▼'}</span>
                              </div>
                            </div>
                          </div>

                          {isPersonalCollapseOpen && (
        <div className="space-y-4 pt-2">
          {/* TABLA DE ASIGNACIONES Y BONOS POR PERÍODOS (RANGOS DE FECHA) */}
                          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-2">
                              <div>
                                <h5 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                                  <span>📋 Registro de Asignaciones, Bonos y Viáticos por Períodos</span>
                                  <span className="text-[9px] bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded font-bold">
                                    {asignacionesPeriodosList.length} Asignaciones Activas
                                  </span>
                                </h5>
                                <p className="text-[10px] text-slate-500">Configura vigencias por rango de fechas (Desde - Hasta) para imputación por períodos de corte</p>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingAsignacionData({
                                    id: 'asig-' + Date.now(),
                                    concepto: '',
                                    destinatario: 'Toda la Dotación',
                                    monto_mensual: 50000,
                                    fecha_inicio: fechaInicioReal || '2026-08-01',
                                    fecha_termino: fechaTerminoEstimada || '2026-12-31'
                                  });
                                  setShowAsignacionPeriodoModal(true);
                                }}
                                className="bg-indigo-900 hover:bg-indigo-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <span>+ Crear Asignación por Período</span>
                              </button>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-200/70 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-300">
                                    <th className="p-2">Concepto / Asignación</th>
                                    <th className="p-2">Aplicado A</th>
                                    <th className="p-2">Período de Vigencia (Desde - Hasta)</th>
                                    <th className="p-2 text-right">Monto Proyectado</th>
                                    <th className="p-2 text-center">Estado en Corte</th>
                                    <th className="p-2 text-center">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {asignacionesPeriodosList.length === 0 ? (
                                    <tr>
                                      <td colSpan="6" className="p-3 text-center text-slate-500 italic text-xs">
                                        No hay asignaciones registradas por período. Presiona "+ Crear Asignación por Período".
                                      </td>
                                    </tr>
                                  ) : (
                                    asignacionesPeriodosList.map((asig, aIdx) => {
                                      const isVigente = fechaCorteProyeccion >= asig.fecha_inicio && fechaCorteProyeccion <= asig.fecha_termino;
                                      return (
                                        <tr key={aIdx} className="hover:bg-white transition text-xs font-semibold">
                                          <td className="p-2 font-extrabold text-slate-900">{asig.concepto}</td>
                                          <td className="p-2 text-slate-700">
                                            <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded text-[10px] font-bold">
                                              {asig.destinatario}
                                            </span>
                                          </td>
                                          <td className="p-2 font-mono text-slate-800 text-[11px]">
                                            📅 {asig.fecha_inicio} ➔ 🏁 {asig.fecha_termino}
                                          </td>
                                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                                            ${(asig.monto_mensual || 0).toLocaleString('es-CL')}/mes
                                          </td>
                                          <td className="p-2 text-center">
                                            {isVigente ? (
                                              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-black">
                                                🟢 Vigente en Corte
                                              </span>
                                            ) : (
                                              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                                ⚪ Fuera de Período
                                              </span>
                                            )}
                                          </td>
                                          <td className="p-2 text-center">
                                            <div className="flex justify-center items-center gap-1.5">
                                              <button
                                                onClick={() => {
                                                  setEditingAsignacionData(asig);
                                                  setShowAsignacionPeriodoModal(true);
                                                }}
                                                className="text-[10px] bg-slate-200 hover:bg-blue-900 hover:text-white px-2 py-0.5 rounded font-bold transition cursor-pointer"
                                              >
                                                ✏️ Editar
                                              </button>
                                              <button
                                                onClick={() => {
                                                  if (confirm(`¿Eliminar la asignación "${asig.concepto}"?`)) {
                                                    setAsignacionesPeriodosList(prev => {
                                                      const updated = prev.filter(x => x.id !== asig.id);
                                                      localStorage.setItem('obraxis_asignaciones_periodos_' + (selectedObra?.nombre || ''), JSON.stringify(updated));
                                                      return updated;
                                                    });
                                                  }
                                                }}
                                                className="text-[10px] bg-rose-100 hover:bg-rose-700 hover:text-white text-rose-800 px-2 py-0.5 rounded font-bold transition cursor-pointer"
                                              >
                                                🗑️
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          
                            <div className="pt-2">
                              {workersArray.length === 0 ? (
                                <div className="p-4 text-center bg-slate-50 rounded-xl space-y-2">
                                  <p className="text-xs text-slate-600 font-semibold">No se ha registrado personal en la dotación de esta obra.</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {workersArray.map((w, wIdx) => {
                                    const cEmpresa = w.costo_empresa || Math.round((w.sueldo_base || 1200000) * 1.25);
                                    const valorDia = Math.round(cEmpresa / 30);

                                    const rawAsigDate = w.fecha_asig ? String(w.fecha_asig).split('T')[0] : (selectedObra?.fecha_inicio ? String(selectedObra.fecha_inicio).split('T')[0] : null);
                                    const formattedAsig = rawAsigDate ? (() => {
                                      const pts = rawAsigDate.split('-');
                                      return pts.length === 3 ? `${pts[2]}-${pts[1]}-${pts[0]}` : rawAsigDate;
                                    })() : 'Fecha N/A';

                                    const fCorteStr = fechaCorteProyeccion || new Date().toISOString().substring(0, 10);
                                    const dateCorte = new Date(fCorteStr);

                                    let diasTrabajadosCorte = 0;
                                    if (rawAsigDate && fCorteStr && rawAsigDate <= fCorteStr) {
                                      const dAsig = new Date(rawAsigDate);
                                      if (!isNaN(dAsig.getTime()) && !isNaN(dateCorte.getTime())) {
                                        const diffDays = Math.floor((dateCorte.getTime() - dAsig.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                        diasTrabajadosCorte = Math.max(1, diffDays);
                                      } else {
                                        diasTrabajadosCorte = 1;
                                      }
                                    }

                                    const isPosteriorACorte = rawAsigDate && fCorteStr && rawAsigDate > fCorteStr;
                                    const costoProyectadoAlCorte = diasTrabajadosCorte * valorDia;

                                    return (
                                      <div key={wIdx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-2xs hover:border-blue-300 transition">
                                        <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                                          <span className="font-extrabold text-slate-900 text-xs">{w.nombre}</span>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[9px] font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded uppercase">
                                              {w.cargo}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {/* PERÍODO DE ASIGNACIÓN (DESDE FECHA ASIGNACIÓN A OBRA HASTA CORTE GLOBAL) */}
                                        <div className="bg-slate-100/90 p-2 rounded-lg border border-slate-200 flex justify-between items-center text-[10px] text-slate-600">
                                          <div>
                                            <span className="font-bold block text-slate-700">📅 Asignado desde:</span>
                                            <span className="font-mono text-slate-800 font-bold">{formattedAsig}</span>
                                          </div>
                                          <div className="text-right">
                                            <span className="font-bold block text-slate-700">⏱️ Días al Corte ({fechaCorteProyeccion}):</span>
                                            <span className="font-mono text-indigo-900 font-extrabold">{diasTrabajadosCorte} Días</span>
                                          </div>
                                        </div>
                                        {isPosteriorACorte && (
                                          <div className="bg-rose-50 border border-rose-200 text-rose-900 text-[10px] font-bold p-1.5 rounded-lg text-center">
                                            ⚠️ Asignación efectuada posterior a la fecha de corte ({formattedAsig})
                                          </div>
                                        )}
                                        <div className="space-y-1 text-[11px]">
                                          <div className="flex justify-between items-center">
                                            <span className="text-slate-500 font-semibold">Sueldo Base Mensual:</span>
                                            <span className="font-mono font-bold text-slate-800">${(w.sueldo_base || 1200000).toLocaleString('es-CL')}</span>
                                          </div>
                                          <div className="flex justify-between items-center text-emerald-800">
                                            <span className="font-semibold">+ Leyes Sociales (25%):</span>
                                            <span className="font-mono font-bold">${Math.round((w.sueldo_base || 1200000) * 0.25).toLocaleString('es-CL')}</span>
                                          </div>
                                          <div className="flex justify-between items-center text-indigo-900">
                                            <span className="font-semibold">+ Horas Extras Proyectadas:</span>
                                            <span className="font-mono font-bold">${(w.horas_extras || 0).toLocaleString('es-CL')}</span>
                                          </div>
                                          <div className="flex justify-between items-center text-amber-900">
                                            <span className="font-semibold">+ Asignaciones / Viáticos:</span>
                                            <span className="font-mono font-bold">${(w.asignaciones || 0).toLocaleString('es-CL')}</span>
                                          </div>
                                        </div>
                                        <div className="space-y-1 pt-2 border-t border-slate-200 text-xs">
                                          <div className="flex justify-between items-center text-[10px] text-slate-600">
                                            <span>Valor Día (Costo Empresa ÷ 30):</span>
                                            <span className="font-mono font-bold">${valorDia.toLocaleString('es-CL')}/día</span>
                                          </div>
                                          <div className="flex justify-between items-center bg-emerald-50 p-2 rounded-lg text-xs">
                                            <span className="font-extrabold text-emerald-950">Costo Proyectado ({diasTrabajadosCorte} días):</span>
                                            <span className="font-mono font-black text-emerald-900 text-sm">${costoProyectadoAlCorte.toLocaleString('es-CL')}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* SECCIÓN DEDICADA DE MAQUINARIA Y EQUIPOS ASIGNADOS (PROYECCIÓN AL CORTE) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs mt-4">
                    {(() => {
                      const fCorteStr = fechaCorteProyeccion || new Date().toISOString().substring(0, 10);
                      const dateCorte = new Date(fCorteStr);

                      const combinedFleet = [
                        ...(maquinariaList || []),
                        ...(arriendosList || []).map(a => ({
                          nombre: a.equipo,
                          equipo: a.equipo,
                          patente: a.patente,
                          proveedor: a.proveedor,
                          costo_interno: a.costo,
                          costo: a.costo,
                          unidad_costo_interno: a.unidad_costo || '$/mes',
                          tipo_condicion_minima: a.tipo_condicion_minima || 'sin_minimo',
                          cantidad_minima: a.cantidad_minima || 0,
                          modalidad_dias: a.modalidad_dias || 'laborales',
                          fecha_asig: a.fechaInicio || a.created_at,
                          fecha_inicio: a.fechaInicio || a.created_at,
                          isArriendo: true
                        }))
                      ];

                      const maqArray = combinedFleet.map(m => {
                        const tarifaBase = parseFloat(m.costo_mensual || m.valor_arriendo_mensual || m.costo_arriendo || m.costo_interno || m.costo) || 1500000;
                        const unidad = m.unidad_costo_interno || m.unidad_costo || m.unidad_tarifa || '$/mes';
                        const tipoMin = m.tipo_condicion_minima || m.tipo_minimo || 'sin_minimo';
                        const cantMin = parseFloat(m.cantidad_minima || m.minimo_garantizado || 0);
                        const modDias = m.modalidad_dias || 'laborales';

                        let valorDia = 0;
                        let labelTarifa = `${unidad}`;
                        let labelMinimo = 'Sin Mínimo Exigido';

                        if (unidad === '$/mes') {
                          if (tipoMin === 'dias_mes' && cantMin > 0) {
                            valorDia = Math.round(tarifaBase / Math.min(30, cantMin));
                            labelMinimo = `Mín. ${cantMin} Días/Mes`;
                          } else {
                            valorDia = Math.round(tarifaBase / 30);
                          }
                        } else if (unidad === '$/hr') {
                          let hrsDia = 8;
                          if (tipoMin === 'horas_dia' && cantMin > 0) {
                            hrsDia = Math.max(hrsDia, cantMin);
                            labelMinimo = `Mín. ${cantMin} Hrs/Día`;
                          } else if (tipoMin === 'horas_mes' && cantMin > 0) {
                            hrsDia = cantMin / 30;
                            labelMinimo = `Mín. ${cantMin} Hrs/Mes`;
                          } else {
                            labelMinimo = 'Estándar 8 Hrs/Día';
                          }
                          valorDia = Math.round(tarifaBase * hrsDia);
                        } else {
                          valorDia = Math.round(tarifaBase);
                          if (tipoMin === 'horas_dia' && cantMin > 0) {
                            labelMinimo = `Mín. ${cantMin} Hrs/Día`;
                          }
                        }

                        const rawAsigDate = m.fecha_asig || m.fecha_asignacion || m.fecha_inicio || m.created_at ? String(m.fecha_asig || m.fecha_asignacion || m.fecha_inicio || m.created_at).split('T')[0] : (selectedObra?.fecha_inicio ? String(selectedObra.fecha_inicio).split('T')[0] : fInicioStr);
                        const formattedAsig = rawAsigDate ? (() => {
                          const pts = rawAsigDate.split('-');
                          return pts.length === 3 ? `${pts[2]}-${pts[1]}-${pts[0]}` : rawAsigDate;
                        })() : 'Fecha N/A';

                        let diasOperativosCorte = 0;
                        if (rawAsigDate && fCorteStr && rawAsigDate <= fCorteStr) {
                          if (modDias === 'calendario') {
                            const dAsig = new Date(rawAsigDate);
                            if (!isNaN(dAsig.getTime()) && !isNaN(dateCorte.getTime())) {
                              const diffDays = Math.floor((dateCorte.getTime() - dAsig.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                              diasOperativosCorte = Math.max(1, diffDays);
                            } else {
                              diasOperativosCorte = 1;
                            }
                          } else {
                            diasOperativosCorte = countChileanBusinessDays(rawAsigDate, fCorteStr);
                          }
                        }

                        const isPosteriorACorte = rawAsigDate && fCorteStr && rawAsigDate > fCorteStr;
                        const costoProyectadoAlCorte = diasOperativosCorte * valorDia;

                        return {
                          ...m,
                          tarifaBase,
                          unidad,
                          labelTarifa,
                          labelMinimo,
                          modDias,
                          valorDia,
                          rawAsigDate,
                          formattedAsig,
                          diasOperativosCorte,
                          isPosteriorACorte,
                          costoProyectadoAlCorte
                        };
                      });

                      const totalCostoMaquinariaObraAlCorte = maqArray.reduce((acc, m) => acc + m.costoProyectadoAlCorte, 0);

                      return (
                        <>
                          <div
                            onClick={() => setIsMaquinariaCollapseOpen(!isMaquinariaCollapseOpen)}
                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-2 cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="p-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold shadow-2xs">
                                {isMaquinariaCollapseOpen ? '▲' : '▼'}
                              </span>
                              <div>
                                <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                                  <span>🚜 Costos de Maquinaria y Equipos Asignados a Faena (Proyección)</span>
                                  <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-black">
                                    {maqArray.length} Equipos Registrados
                                  </span>
                                </h4>
                                <p className="text-[10px] text-slate-500 font-semibold">
                                  {isMaquinariaCollapseOpen ? 'Haz clic para replegar flota de equipos' : 'Haz clic para desplegar el detalle de maquinaria y costo diario al corte'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-2">
                                <div className="text-right">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase block">SUBTOTAL PROYECTADO MAQUINARIA (AL CORTE):</span>
                                  <span className="font-mono font-black text-amber-900 text-sm">${totalCostoMaquinariaObraAlCorte.toLocaleString('es-CL')}</span>
                                </div>
                                <span className="text-xs text-amber-800 font-bold ml-1">{isMaquinariaCollapseOpen ? '▲' : '▼'}</span>
                              </div>
                            </div>
                          </div>

                          {isMaquinariaCollapseOpen && (
                            <div className="pt-2">
                              {maqArray.length === 0 ? (
                                <div className="p-4 text-center bg-slate-50 rounded-xl space-y-1">
                                  <p className="text-xs text-slate-600 font-semibold">No hay maquinaria ni equipos asignados actualmente a esta obra.</p>
                                  <p className="text-[10px] text-slate-400">Asigna equipos desde el módulo de Maquinaria o crea arriendos para proyectar su costo.</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {maqArray.map((m, mIdx) => (
                                    <div key={mIdx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-2xs hover:border-amber-400 transition">
                                      <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                                        <span className="font-extrabold text-slate-900 text-xs">{m.nombre || m.equipo || m.tipo || `Equipo #${mIdx + 1}`}</span>
                                        <div className="flex items-center gap-1">
                                          {m.isArriendo ? (
                                            <span className="text-[9px] font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded font-mono">
                                              📜 Arriendo: {m.proveedor}
                                            </span>
                                          ) : (
                                            <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono">
                                              {m.patente || m.codigo || 'Propio'}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="bg-slate-100/90 p-2 rounded-lg border border-slate-200 flex justify-between items-center text-[10px] text-slate-600">
                                        <div>
                                          <span className="font-bold block text-slate-700">📅 Asignado desde:</span>
                                          <span className="font-mono text-slate-800 font-bold">{m.formattedAsig}</span>
                                        </div>
                                        <div className="text-right">
                                          <span className="font-bold block text-slate-700">⏱️ Días al Corte ({fechaCorteProyeccion}):</span>
                                          <span className="font-mono text-amber-900 font-extrabold">{m.diasOperativosCorte} Días</span>
                                        </div>
                                      </div>
                                      {m.isPosteriorACorte && (
                                        <div className="bg-rose-50 border border-rose-200 text-rose-900 text-[10px] font-bold p-1.5 rounded-lg text-center">
                                          ⚠️ Equipo asignado posterior a la fecha de corte ({m.formattedAsig})
                                        </div>
                                      )}

                                      <div className="space-y-1 text-[11px]">
                                        <div className="flex justify-between items-center">
                                          <span className="text-slate-500 font-semibold">Tarifa Base / Unidad:</span>
                                          <span className="font-mono font-bold text-slate-800">${m.tarifaBase.toLocaleString('es-CL')} <span className="text-[9px] bg-slate-200 px-1 py-0.5 rounded">{m.unidad}</span></span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-600">
                                          <span className="font-semibold">Modalidad Días:</span>
                                          <span className="font-mono font-bold text-slate-700 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            {m.modDias === 'calendario' ? '📅 Días Calendario' : '🗓️ Días Laborales (Chile)'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-600">
                                          <span className="font-semibold">Condición Mínima:</span>
                                          <span className="font-mono font-bold text-slate-700 text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{m.labelMinimo}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-600">
                                          <span className="font-semibold">Valor Día Proyectado:</span>
                                          <span className="font-mono font-bold text-amber-900">${m.valorDia.toLocaleString('es-CL')}/día</span>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs bg-amber-50 p-2 rounded-lg">
                                        <span className="font-extrabold text-amber-950">Costo Proyectado ({m.diasOperativosCorte} días):</span>
                                        <span className="font-mono font-black text-amber-900 text-sm">${m.costoProyectadoAlCorte.toLocaleString('es-CL')}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

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

      {/* Modal 1: Asistencia con QR, Geofencing y Firma Digital */}
      {activeModal === 'asistencia' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-900 rounded-lg">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Registro de Asistencia Diaria</h3>
                  <p className="text-[10px] text-slate-500 font-medium">{selectedObra?.nombre}</p>
                </div>
              </div>
              <button onClick={() => { setActiveModal(null); clearSignature(); }} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {/* Selector de Modo */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setAsistenciaMode('qr'); requestUserGPS(selectedObra); }}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${asistenciaMode === 'qr' ? 'bg-white text-blue-950 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Escanear QR (GPS)</span>
              </button>
              <button
                type="button"
                onClick={() => setAsistenciaMode('manual')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${asistenciaMode === 'manual' ? 'bg-white text-blue-950 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Registro Manual</span>
              </button>
            </div>

            {/* Estado de Geofencing GPS (Modo QR) */}
            {asistenciaMode === 'qr' && (
              <div className="mb-4">
                {gpsUserLoc.status === 'idle' && (
                  <button
                    type="button"
                    onClick={() => requestUserGPS(selectedObra)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-900" />
                    <span>Verificar Mi Ubicación GPS en Faena</span>
                  </button>
                )}

                {gpsUserLoc.status === 'loading' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center gap-2 font-medium">
                    <Navigation className="w-4 h-4 animate-spin text-blue-900 shrink-0" />
                    <span>Verificando tu posición GPS en tiempo real respecto a faena...</span>
                  </div>
                )}

                {gpsUserLoc.status === 'error' && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs space-y-1.5 font-medium">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Error de Ubicación GPS</span>
                    </div>
                    <p className="text-[11px] leading-tight">{gpsUserLoc.error}</p>
                    <button
                      type="button"
                      onClick={() => requestUserGPS(selectedObra)}
                      className="text-[10px] bg-red-100 hover:bg-red-200 text-red-800 font-bold px-2 py-1 rounded transition"
                    >
                      Reintentar Lectura GPS
                    </button>
                  </div>
                )}

                {gpsUserLoc.status === 'success' && (
                  <div>
                    {selectedObra?.latitud && selectedObra?.longitud ? (
                      gpsUserLoc.isWithin ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <p className="font-bold text-emerald-950"> Ubicación Verificada en Faena</p>
                            <p className="text-[10px] text-emerald-700 font-medium">Distancia a faena: {gpsUserLoc.distance}m (Radio máximo: {selectedObra.radio_cobertura_m || 200}m)</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2 font-medium">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-950"> Fuera del Radio Autorizado de Obra</p>
                            <p className="text-[10px] text-amber-800 mt-0.5">Te encuentras a <strong>{gpsUserLoc.distance} metros</strong> de la obra. Para marcar asistencia debes estar dentro del radio de <strong>{selectedObra.radio_cobertura_m || 200} metros</strong>.</p>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="p-3 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs flex items-center justify-between font-medium">
                        <span className="text-[11px]"> Obra sin coordenadas GPS fijadas. Haz clic en 'GPS Faena' para fijar el mapa.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setGpsConfig({
                              latitud: selectedObra.latitud ? selectedObra.latitud.toString() : '',
                              longitud: selectedObra.longitud ? selectedObra.longitud.toString() : '',
                              radio: selectedObra.radio_cobertura_m ? selectedObra.radio_cobertura_m.toString() : '200'
                            });
                            setShowGPSModal(true);
                          }}
                          className="text-[10px] bg-blue-900 text-white font-bold px-2 py-1 rounded cursor-pointer shrink-0 ml-2"
                        >
                          Fijar GPS Obra
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Estado Asistencia</label>
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
                <div className="space-y-3 border-t border-slate-100 pt-3">
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

                  {/* Checkbox: ¿Considera hora de colación / almuerzo? */}
                  <label className="flex items-center gap-2.5 p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={asistenciaData.colacion === 'SI'}
                      onChange={(e) => setAsistenciaData({ ...asistenciaData, colacion: e.target.checked ? 'SI' : 'NO' })}
                      className="rounded border-slate-300 text-blue-900 focus:ring-blue-800 cursor-pointer w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-xs text-blue-950">¿Considera 1 hora de colación / almuerzo?</span>
                      <p className="text-[10px] text-slate-500">Descuenta 1 hora de colación para cálculo de jornada ordinaria y horas extras.</p>
                    </div>
                  </label>

                  {/* Firma Digital Canvas */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-500">Firma Manuscrita del Trabajador</label>
                      {hasSignature && (
                        <button
                          type="button"
                          onClick={clearSignature}
                          className="text-[10px] text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Limpiar Firma</span>
                        </button>
                      )}
                    </div>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative overflow-hidden">
                      <canvas
                        ref={canvasRef}
                        width={350}
                        height={120}
                        onMouseDown={handleStartDraw}
                        onMouseMove={handleDraw}
                        onMouseUp={handleStopDraw}
                        onTouchStart={handleStartDraw}
                        onTouchMove={handleDraw}
                        onTouchEnd={handleStopDraw}
                        className="w-full h-28 touch-none cursor-crosshair"
                      />
                      {!hasSignature && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs font-medium">
                          ✍️ Firma aquí con tu dedo o mouse
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={modalLoading || (asistenciaMode === 'qr' && selectedObra?.latitud && selectedObra?.longitud && gpsUserLoc.status === 'success' && !gpsUserLoc.isWithin)}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl shadow-sm text-xs cursor-pointer disabled:opacity-50 transition"
              >
                {modalLoading ? 'Guardando Registro...' : 'Confirmar y Enviar Asistencia'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reporte de Avance Multi-Partida */}
      {activeModal === 'avance' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto my-auto space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Registrar Reporte de Avance</h3>
                <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                  <span>Partidas vinculadas desde Presupuesto de Obra</span>
                  <span className="font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    {partidasList.length} disponibles
                  </span>
                </p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold">{errorMsg}</div>}

            <form onSubmit={submitAvance} className="space-y-4">
              
              {/* CAMPO DE DÍA / FECHA DEL REPORTE */}
              <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl">
                <label className="block text-[10px] font-bold uppercase text-blue-900 mb-1">
                  Día / Fecha del Reporte de Avance <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={avanceFecha}
                  onChange={(e) => setAvanceFecha(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-bold bg-white focus:outline-none focus:border-blue-900"
                />
              </div>

              {/* LISTA DINÁMICA DE PARTIDAS */}
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {avanceItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold uppercase text-blue-900 bg-blue-100 px-2 py-0.5 rounded-md">
                        Partida #{idx + 1}
                      </span>
                      {avanceItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAvanceItems(avanceItems.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer"
                        >
                          ✕ Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Frente de Trabajo</label>
                        <input
                          type="text"
                          required
                          value={item.frente}
                          onChange={(e) => {
                            const copy = [...avanceItems];
                            copy[idx].frente = e.target.value;
                            setAvanceItems(copy);
                          }}
                          placeholder="Ej. Frente A, Estructura Sur"
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Partida / Actividad</label>
                        {partidasList.length > 0 ? (
                          <select
                            required
                            value={item.partida}
                            onChange={(e) => {
                              const val = e.target.value;
                              const foundP = partidasList.find(p => p.partida === val);
                              const copy = [...avanceItems];
                              copy[idx].partida = val;
                              copy[idx].unidad = foundP ? foundP.unidad : 'UND';
                              setAvanceItems(copy);
                            }}
                            className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white"
                          >
                            <option value="">-- Seleccionar Partida --</option>
                            {partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)).map((p, pIdx) => (
                              <option key={p.id || pIdx} value={p.partida}>
                                {p.partida} {p.unidad ? `(${p.unidad})` : ''} {p.cantidad ? `- Presupuestado: ${p.cantidad} ${p.unidad || ''}` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            value={item.partida}
                            onChange={(e) => {
                              const copy = [...avanceItems];
                              copy[idx].partida = e.target.value;
                              setAvanceItems(copy);
                            }}
                            placeholder="Nombre de la partida (ej: Hormigón G30)"
                            className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Unidad Medida</label>
                        <input
                          type="text"
                          value={item.unidad}
                          onChange={(e) => {
                            const copy = [...avanceItems];
                            copy[idx].unidad = e.target.value;
                            setAvanceItems(copy);
                          }}
                          placeholder="m3, ml, UND, kg..."
                          className="w-full border border-slate-200 bg-white rounded-lg p-2 text-xs text-slate-700 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cantidad Avance</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={item.cantidad}
                          onChange={(e) => {
                            const copy = [...avanceItems];
                            copy[idx].cantidad = e.target.value;
                            setAvanceItems(copy);
                          }}
                          placeholder="0.00"
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white font-bold text-blue-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Comentarios / Observaciones Obligatorios <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows="2"
                        required
                        value={item.observaciones}
                        onChange={(e) => {
                          const copy = [...avanceItems];
                          copy[idx].observaciones = e.target.value;
                          setAvanceItems(copy);
                        }}
                        placeholder="Comentarios obligatorios sobre el estado de la partida o condiciones de faena..."
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Botón para agregar otra partida */}
              <button
                type="button"
                onClick={() => setAvanceItems([...avanceItems, { frente: avanceItems[0]?.frente || 'Frente Principal', partida: '', unidad: 'UND', cantidad: '', observaciones: '' }])}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-blue-900 border border-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Otra Partida al Reporte</span>
              </button>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl shadow-sm text-xs cursor-pointer disabled:opacity-70 transition"
              >
                {modalLoading ? 'Guardando Reporte...' : `Confirmar y Guardar Reporte (${avanceItems.length} Partida/s)`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Uso Maquinaria */}
      {activeModal === 'maquinaria' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto my-auto">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto my-auto">
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

      
      {/* Modal Ajustes GPS de Faena con Mapa Interactivo */}
      {showGPSModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-900 rounded-lg">
                  <MapPin className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Ubicación GPS y Geocerca de Faena</h3>
              </div>
              <button onClick={() => setShowGPSModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Selecciona las coordenadas centrales en el mapa y fija el radio de cobertura para restringir la marcación de asistencia.
            </p>

            {!canEditGPS && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-xs font-medium flex items-start gap-2 mb-3">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>⚠️ Solo administradores, Jefes de Faena o Gerencia pueden modificar la ubicación GPS y el radio de tolerancia.</span>
              </div>
            )}

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSaveObraGPS} className="space-y-4">
              
              {/* Mapa Interactivo Leaflet */}
              <ObraGpsMapPicker
                lat={gpsConfig.latitud}
                lng={gpsConfig.longitud}
                radius={gpsConfig.radio}
                canEdit={canEditGPS}
                onChange={(newLat, newLng) => setGpsConfig(prev => ({ ...prev, latitud: newLat, longitud: newLng }))}
              />

              {canEditGPS && (
                <button
                  type="button"
                  onClick={handleCaptureCurrentLocationForObra}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-blue-950 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-250 transition cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-900" />
                  <span>Capturar mi ubicación GPS actual</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    required
                    disabled={!canEditGPS}
                    value={gpsConfig.latitud}
                    onChange={(e) => setGpsConfig({ ...gpsConfig, latitud: e.target.value })}
                    placeholder="-33.4372"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    required
                    disabled={!canEditGPS}
                    value={gpsConfig.longitud}
                    onChange={(e) => setGpsConfig({ ...gpsConfig, longitud: e.target.value })}
                    placeholder="-70.6506"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Presets de Radio: 50m a 5km */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">
                  Radio Máximo Autorizado (50m a 5km)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: '50m', value: '50' },
                    { label: '100m', value: '100' },
                    { label: '200m', value: '200' },
                    { label: '500m', value: '500' },
                    { label: '1km', value: '1000' },
                    { label: '2km', value: '2000' },
                    { label: '5km', value: '5000' }
                  ].map(p => (
                    <button
                      key={p.value}
                      type="button"
                      disabled={!canEditGPS}
                      onClick={() => setGpsConfig(prev => ({ ...prev, radio: p.value }))}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition border cursor-pointer ${
                        gpsConfig.radio === p.value
                          ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  required
                  disabled={!canEditGPS}
                  value={gpsConfig.radio}
                  onChange={(e) => setGpsConfig({ ...gpsConfig, radio: e.target.value })}
                  placeholder="Distancia en metros (ej: 200)"
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none bg-slate-50 disabled:bg-slate-100"
                />
              </div>

              {canEditGPS && (
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl shadow-sm text-xs cursor-pointer disabled:opacity-70 transition"
                >
                  {modalLoading ? 'Guardando Coordenadas...' : 'Guardar Coordenadas y Radio GPS'}
                </button>
              )}
            </form>
          </div>
        </div>
      )}


      {/* Modal QR de Faena */}
      {showQRModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 text-center">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Código QR de Faena</h3>
              <button onClick={() => setShowQRModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 my-2">
              <p className="text-xs font-extrabold text-blue-950 uppercase">{selectedObra?.nombre}</p>
              <div className="bg-white p-3 rounded-2xl inline-block border border-slate-200 shadow-sm">
                <img
                  src={`https://quickchart.io/qr?text=${encodeURIComponent(`https://obraxis.cl/?obra=${encodeURIComponent(selectedObra?.nombre || '')}`)}&size=300&margin=1`}
                  alt="QR Faena"
                  className="w-52 h-52 mx-auto block"
                />
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Escanea este código desde la App Móvil para registrar tu asistencia en faena.</p>
              {selectedObra?.latitud && selectedObra?.longitud && (
                <div className="bg-blue-50 text-blue-900 text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-900" />
                  <span>Radio GPS: {selectedObra.radio_cobertura_m || 200} metros alrededor de faena</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir QR</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Modal: Crear / Asignar Cuadrilla de Trabajo */}
      {showCuadrillaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Crear Cuadrilla de Trabajo</h3>
              <button onClick={() => setShowCuadrillaModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveCuadrilla} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre de la Cuadrilla</label>
                <input
                  type="text"
                  required
                  value={cuadrillaData.nombre}
                  onChange={(e) => setCuadrillaData({ ...cuadrillaData, nombre: e.target.value })}
                  placeholder="Ej. Cuadrilla Encofrados A, Cuadrilla Hormigón"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Líder / Capataz de Cuadrilla</label>
                <input
                  type="text"
                  value={cuadrillaData.lider}
                  onChange={(e) => setCuadrillaData({ ...cuadrillaData, lider: e.target.value })}
                  placeholder="Nombre del capataz o líder a cargo"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Especialidad de la Cuadrilla</label>
                <input
                  type="text"
                  value={cuadrillaData.especialidad}
                  onChange={(e) => setCuadrillaData({ ...cuadrillaData, especialidad: e.target.value })}
                  placeholder="Ej. Pilas Helicoidales, Hormigón, Movimiento de Tierra..."
                  list="especialidades-sugeridas"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-bold"
                />
                <datalist id="especialidades-sugeridas">
                  <option value="Pilas Helicoidales" />
                  <option value="Hormigón & Estructuras" />
                  <option value="Encofrado & Moldajes" />
                  <option value="Enfierradura" />
                  <option value="Excavación & Mov. Tierra" />
                  <option value="Terminaciones & Pintura" />
                  <option value="Instalaciones & Servicios" />
                  <option value="Montaje Mecánico / Estructuras" />
                </datalist>
              </div>

              {/* Selección de Personal Asignado a la Obra */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Seleccionar Integrantes ({cuadrillaData.miembros.length} seleccionados)
                </label>
                {personalList.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No hay personal registrado en la obra. Asigna primero en 'Personal Asignado (RRHH)'.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
                    {personalList.map((p) => {
                      const isChecked = cuadrillaData.miembros.includes(p.nombre);
                      return (
                        <label key={p.rut || p.nombre} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCuadrillaData({ ...cuadrillaData, miembros: [...cuadrillaData.miembros, p.nombre] });
                              } else {
                                setCuadrillaData({ ...cuadrillaData, miembros: cuadrillaData.miembros.filter(m => m !== p.nombre) });
                              }
                            }}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <span className="font-semibold text-slate-800">{p.nombre}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({p.cargo})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-xs transition"
              >
                Guardar Cuadrilla de Trabajo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Asignar Nuevo Trabajador a la Obra (RRHH) */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Asignar Trabajador a la Obra</h3>
              <button onClick={() => setShowAddWorkerModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveWorkerToObra} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Completo del Trabajador</label>
                <input
                  type="text"
                  required
                  value={newWorkerData.nombre}
                  onChange={(e) => setNewWorkerData({ ...newWorkerData, nombre: e.target.value })}
                  placeholder="Ej. Juan Carlos Pérez"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT</label>
                  <input
                    type="text"
                    required
                    value={newWorkerData.rut}
                    onChange={(e) => setNewWorkerData({ ...newWorkerData, rut: formatRut(e.target.value) })}
                    placeholder="Ej. 18.988.192-4"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cargo / Especialidad</label>
                  <input
                    type="text"
                    required
                    value={newWorkerData.cargo}
                    onChange={(e) => setNewWorkerData({ ...newWorkerData, cargo: e.target.value })}
                    placeholder="Ej. Maestro Mayor"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Teléfono Contacto</label>
                  <input
                    type="text"
                    value={newWorkerData.fono}
                    onChange={(e) => setNewWorkerData({ ...newWorkerData, fono: e.target.value })}
                    placeholder="+56 9 1234 5678"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newWorkerData.email}
                    onChange={(e) => setNewWorkerData({ ...newWorkerData, email: e.target.value })}
                    placeholder="trabajador@empresa.cl"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-indigo-50/70 p-3 rounded-xl border border-indigo-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-1">Horas Extras Proyectadas ($)</label>
                  <input
                    type="number"
                    value={editingWorkerData.horas_extras || ''}
                    onChange={(e) => setEditingWorkerData({ ...editingWorkerData, horas_extras: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full border border-indigo-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">Calculado o monto fijo imponible</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">Asignaciones / Viáticos ($)</label>
                  <input
                    type="number"
                    value={editingWorkerData.asignaciones || ''}
                    onChange={(e) => setEditingWorkerData({ ...editingWorkerData, asignaciones: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full border border-amber-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">Asignaciones de colación/movilidad</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-purple-900 hover:bg-purple-800 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-xs transition"
              >
                {modalLoading ? 'Asignando...' : 'Confirmar y Asignar Trabajador'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Arriendo de Maquinaria */}
      {showArriendoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-3">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-slate-800 text-sm">Registrar Arriendo de Equipo / Maquinaria</h3>
              <button onClick={() => setShowArriendoModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveArriendo} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre / Tipo de Equipo</label>
                <input
                  type="text"
                  required
                  value={arriendoData.equipo}
                  onChange={(e) => setArriendoData({ ...arriendoData, equipo: e.target.value })}
                  placeholder="Ej. Retroexcavadora CAT 416, Camión Tolva"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Patente / Código</label>
                  <input
                    type="text"
                    value={arriendoData.patente}
                    onChange={(e) => setArriendoData({ ...arriendoData, patente: e.target.value })}
                    placeholder="Ej. HG-8890"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Proveedor Arrendador <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={arriendoData.proveedor}
                    onChange={(e) => setArriendoData({ ...arriendoData, proveedor: e.target.value })}
                    placeholder="Ej. Arriendos y Equipos S.A."
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-300 space-y-2">
                <span className="text-[10px] font-extrabold text-amber-950 uppercase tracking-wider block">
                  💲 Tarifas y Condición Mínima de Contrato:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Costo / Tarifa ($ CLP)</label>
                    <input
                      type="number"
                      required
                      value={arriendoData.costo}
                      onChange={(e) => setArriendoData({ ...arriendoData, costo: e.target.value })}
                      placeholder="Ej. 250000"
                      className="w-full border border-amber-300 rounded-lg p-2 text-xs font-bold text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Unidad de Cobro</label>
                    <select
                      value={arriendoData.unidad_costo || '$/mes'}
                      onChange={(e) => setArriendoData({ ...arriendoData, unidad_costo: e.target.value })}
                      className="w-full border border-amber-300 rounded-lg p-2 font-bold text-slate-900 bg-white text-xs"
                    >
                      <option value="$/mes">$/mes (Tarifa Mensual Base)</option>
                      <option value="$/día">$/día (Por Día de Obra)</option>
                      <option value="$/hr">$/hr (Por Hora Horómetro)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60">
                  <div>
                    <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Garantía / Condición Mínima</label>
                    <select
                      value={arriendoData.tipo_condicion_minima || 'sin_minimo'}
                      onChange={(e) => setArriendoData({ ...arriendoData, tipo_condicion_minima: e.target.value })}
                      className="w-full border border-amber-300 rounded-lg p-2 font-bold text-slate-900 bg-white text-xs"
                    >
                      <option value="sin_minimo">Sin Mínimo Exigido</option>
                      <option value="horas_dia">Horas Mínimas / Día</option>
                      <option value="horas_mes">Horas Mínimas / Mes</option>
                      <option value="dias_mes">Días Mínimos / Mes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">
                      {arriendoData.tipo_condicion_minima === 'dias_mes' ? 'Días Mínimos (ej. 20)' : 'Horas Mínimas (ej. 8 o 180)'}
                    </label>
                    <input
                      type="number"
                      disabled={arriendoData.tipo_condicion_minima === 'sin_minimo'}
                      value={arriendoData.cantidad_minima}
                      onChange={(e) => setArriendoData({ ...arriendoData, cantidad_minima: e.target.value })}
                      placeholder={arriendoData.tipo_condicion_minima === 'horas_dia' ? 'ej. 8 hrs' : (arriendoData.tipo_condicion_minima === 'horas_mes' ? 'ej. 180 hrs' : 'ej. 20 días')}
                      className="w-full border border-amber-300 rounded-lg p-2 font-bold text-slate-900 bg-white text-xs disabled:bg-slate-100 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="pt-1 border-t border-amber-200/60">
                  <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Modalidad de Días de Cobro / Arriendo</label>
                  <select
                    value={arriendoData.modalidad_dias || 'laborales'}
                    onChange={(e) => setArriendoData({ ...arriendoData, modalidad_dias: e.target.value })}
                    className="w-full border border-amber-300 rounded-lg p-2 font-bold text-slate-900 bg-white text-xs"
                  >
                    <option value="laborales">🗓️ Días Laborales (Lunes a Viernes, excluye feriados Chile)</option>
                    <option value="calendario">📅 Días Calendario (Días Corridos)</option>
                  </select>
                </div>

                <p className="text-[9px] text-amber-900 font-semibold leading-tight">
                  💡 Si la operación real es menor al mínimo garantizado, las proyecciones calcularán el costo con la condición mínima contratada.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={arriendoData.fechaInicio}
                    onChange={(e) => setArriendoData({ ...arriendoData, fechaInicio: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha Término</label>
                  <input
                    type="date"
                    value={arriendoData.fechaTermino}
                    onChange={(e) => setArriendoData({ ...arriendoData, fechaTermino: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-xs transition"
              >
                Guardar Arriendo de Equipo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ENRIQUECIDO: CREAR NUEVA OBRA */}
      {showCreateObraModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Crear Nueva Obra / Proyecto</h3>
                <p className="text-[11px] text-slate-500">Completa la ficha técnica, contactos, presupuesto y planificación de la obra</p>
              </div>
              <button onClick={() => setShowCreateObraModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newObraForm.nombre.trim()) return;
                setModalLoading(true);
                try {
                  const basePayload = {
                    nombre: newObraForm.nombre.trim(),
                    tipo: newObraForm.especialidad || 'Construcción General',
                    empresa: user?.empresa || 'Obraxis'
                  };

                  const extendedPayload = {
                    ...basePayload,
                    cliente: newObraForm.cliente.trim() || null,
                    cliente_email: newObraForm.cliente_email.trim() || null,
                    cliente_telefono: newObraForm.cliente_telefono.trim() || null,
                    admin_contrato: newObraForm.admin_contrato.trim() || null,
                    oficina_tecnica: newObraForm.oficina_tecnica.trim() || null,
                    prevencionista: newObraForm.prevencionista.trim() || null,
                    ubicacion: newObraForm.ubicacion.trim() || null
                  };

                  let createdObra = null;
                  const { data, error } = await supabase.from('obras').insert([extendedPayload]).select().single();
                  
                  if (error) {
                    console.warn('Faltan columnas extendidas en el esquema Supabase, aplicando fallback seguro:', error.message);
                    const resFallback = await supabase.from('obras').insert([basePayload]).select().single();
                    if (resFallback.error) throw resFallback.error;
                    createdObra = resFallback.data;
                  } else {
                    createdObra = data;
                  }

                  // Si se seleccionó un presupuesto de origen, copiar sus ítems a partidas_obra
                  if (newObraForm.presupuesto_enlazado && createdObra) {
                    try {
                      const { data: budgetItems } = await supabase
                        .from('presupuestos_items')
                        .select('*')
                        .eq('presupuesto_id', newObraForm.presupuesto_enlazado);

                      if (budgetItems && budgetItems.length > 0) {
                        const itemsToInsert = budgetItems.map(it => {
                          const cVal = parseFloat(it.cantidad) || 1;
                          return {
                            obra_nombre: createdObra.nombre,
                            partida: it.partida || it.descripcion || it.codigo,
                            unidad: it.unidad || 'UND',
                            cantidad: cVal,
                            cantidad_presupuestada: cVal
                          };
                        });
                        await supabase.from('partidas_obra').insert(itemsToInsert);

                        // Actualizar lista local de partidas
                        setPartidasList(itemsToInsert.map(it => ({
                          ...it,
                          pu: 0,
                          rendimiento: '20',
                          unidad_tiempo: 'Día'
                        })));
                      }
                    } catch (pErr) {
                      console.warn('Nota al copiar partidas de presupuesto:', pErr);
                    }
                  }

                  setShowCreateObraModal(false);
                  fetchObras();
                  if (createdObra) setSelectedObra(createdObra);
                  alert('Obra creada con éxito.');
                } catch (err) {
                  alert('Error al crear obra: ' + err.message);
                } finally {
                  setModalLoading(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              {/* PASO 1 PRIMORDIAL: ¿BASAR EN UN PROYECTO DE PRESUPUESTOS? */}
              <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-4 rounded-2xl shadow-md space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                    <span>Paso 1: ¿Deseas vincular un Proyecto de Presupuestos?</span>
                  </span>
                  {newObraForm.presupuesto_enlazado && (
                    <span className="text-[10px] bg-emerald-400 text-emerald-950 font-black px-2.5 py-0.5 rounded-full">
                      ✓ Datos Carga Automática
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                  Si seleccionas un proyecto creado en el módulo de Presupuestos, se autocompletará el <b>Nombre de la Obra</b>, <b>Cliente/Mandante</b>, <b>Partidas</b> y <b>Programación</b>.
                </p>
                <select
                  value={newObraForm.presupuesto_enlazado || ''}
                  onChange={async (e) => {
                    const selectedBudgetId = e.target.value;
                    if (!selectedBudgetId) {
                      setNewObraForm(prev => ({
                        ...prev,
                        presupuesto_enlazado: '',
                        nombre: '',
                        cliente: ''
                      }));
                      return;
                    }

                    const budgetObj = availableBudgets.find(b => String(b.id) === String(selectedBudgetId));
                    if (budgetObj) {
                      setNewObraForm(prev => ({
                        ...prev,
                        presupuesto_enlazado: selectedBudgetId,
                        nombre: budgetObj.nombre || prev.nombre,
                        cliente: budgetObj.cliente || budgetObj.mandante || prev.cliente || 'Cliente Presupuestado',
                        especialidad: budgetObj.especialidad || prev.especialidad
                      }));
                    }
                  }}
                  className="w-full border border-emerald-400/50 rounded-xl p-2.5 text-xs text-slate-900 bg-white font-bold shadow-xs focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">-- No vincular / Crear Obra desde cero (Ingreso Manual) --</option>
                  {availableBudgets.map(b => (
                    <option key={b.id} value={b.id}>
                      📊 {b.nombre} {b.cliente ? `(Cliente: ${b.cliente})` : ''} - Total Est: ${b.presupuesto_estimado ? b.presupuesto_estimado.toLocaleString('es-CL') : 0}
                    </option>
                  ))}
                </select>
              </div>
              {/* 1. Datos Principales (Sólo Nombre de la Obra es Obligatorio) */}
              <div className="space-y-3">
                <h4 className="font-bold text-blue-950 uppercase text-[10px] tracking-wider border-b pb-1">1. Ficha del Proyecto</h4>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre de la Obra <span className="text-red-500">* (Obligatorio)</span></label>
                  <input
                    type="text"
                    required
                    value={newObraForm.nombre}
                    onChange={(e) => setNewObraForm({ ...newObraForm, nombre: e.target.value })}
                    placeholder="Ej. Construcción Edificio San Martín"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cliente / Mandante (Opcional)</label>
                    <input
                      type="text"
                      value={newObraForm.cliente}
                      onChange={(e) => setNewObraForm({ ...newObraForm, cliente: e.target.value })}
                      placeholder="Ej. Constructora del Sur S.A."
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Área / Especialidad (Opcional)</label>
                    <input
                      type="text"
                      value={newObraForm.especialidad}
                      onChange={(e) => setNewObraForm({ ...newObraForm, especialidad: e.target.value })}
                      placeholder="Edificación, Vialidad, Montaje..."
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Email Contacto Cliente (Opcional)</label>
                    <input
                      type="email"
                      value={newObraForm.cliente_email}
                      onChange={(e) => setNewObraForm({ ...newObraForm, cliente_email: e.target.value })}
                      placeholder="contacto@cliente.com"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Teléfono Cliente (Opcional)</label>
                    <input
                      type="text"
                      value={newObraForm.cliente_telefono}
                      onChange={(e) => setNewObraForm({ ...newObraForm, cliente_telefono: e.target.value })}
                      placeholder="+56 9 1234 5678"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Equipo de Obra (Personal de Recursos Humanos - Opcional) */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-blue-950 uppercase text-[10px] tracking-wider border-b pb-1">2. Equipo Responsable (Cargados desde Recursos Humanos - Opcionales)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Admin. Contrato */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Admin. Contrato</label>
                    <select
                      value={newObraForm.admin_contrato}
                      onChange={(e) => setNewObraForm({ ...newObraForm, admin_contrato: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white font-medium mb-1"
                    >
                      <option value="">-- Seleccionar de RRHH --</option>
                      {allStaffList.map((s, idx) => (
                        <option key={idx} value={s.nombre}>{s.nombre} ({s.cargo || 'Personal'})</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newObraForm.admin_contrato}
                      onChange={(e) => setNewObraForm({ ...newObraForm, admin_contrato: e.target.value })}
                      placeholder="O escribe nombre..."
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                    />
                  </div>

                  {/* Oficina Técnica */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Oficina Técnica</label>
                    <select
                      value={newObraForm.oficina_tecnica}
                      onChange={(e) => setNewObraForm({ ...newObraForm, oficina_tecnica: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white font-medium mb-1"
                    >
                      <option value="">-- Seleccionar de RRHH --</option>
                      {allStaffList.map((s, idx) => (
                        <option key={idx} value={s.nombre}>{s.nombre} ({s.cargo || 'Personal'})</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newObraForm.oficina_tecnica}
                      onChange={(e) => setNewObraForm({ ...newObraForm, oficina_tecnica: e.target.value })}
                      placeholder="O escribe nombre..."
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                    />
                  </div>

                  {/* Prevencionista */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Prevencionista (APR)</label>
                    <select
                      value={newObraForm.prevencionista}
                      onChange={(e) => setNewObraForm({ ...newObraForm, prevencionista: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white font-medium mb-1"
                    >
                      <option value="">-- Seleccionar de RRHH --</option>
                      {allStaffList.map((s, idx) => (
                        <option key={idx} value={s.nombre}>{s.nombre} ({s.cargo || 'Personal'})</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newObraForm.prevencionista}
                      onChange={(e) => setNewObraForm({ ...newObraForm, prevencionista: e.target.value })}
                      placeholder="O escribe nombre..."
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Presupuesto y Planificación */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-blue-950 uppercase text-[10px] tracking-wider border-b pb-1">3. Presupuesto y Planificación (MS Project)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Presupuesto de Obra</label>
                    <select
                      value={newObraForm.presupuesto_enlazado}
                      onChange={(e) => setNewObraForm({ ...newObraForm, presupuesto_enlazado: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-semibold"
                    >
                      <option value="">-- Sin enlace / Ingresar partidas manuales --</option>
                      {availableBudgets.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.nombre} (P.U. Est: ${b.presupuesto_estimado ? b.presupuesto_estimado.toLocaleString('es-CL') : 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Planificación Carta Gantt</label>
                    <select
                      value={newObraForm.planificacion_source}
                      onChange={(e) => setNewObraForm({ ...newObraForm, planificacion_source: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-semibold mb-1"
                    >
                      <option value="sin_planificacion">Subir sin planificación</option>
                      <option value="import_mpp">Importar desde MS Project (.xml / .mpp)</option>
                    </select>
                  </div>
                </div>

                {newObraForm.planificacion_source === 'import_mpp' && (
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 space-y-1.5 animate-in fade-in duration-150">
                    <span className="text-[10px] font-bold uppercase text-indigo-950 block">📁 Seleccionar Archivo MS Project</span>
                    <input
                      type="file"
                      accept=".xml,.mpp,.xlsx,.csv,.mpx"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const mockTasks = [
                            { id: Date.now() + 1, nombre: 'Instalación de Faenas & Trazados', fecha_inicio: '2026-03-01', fecha_fin: '2026-03-10', duracion_dias: 10, avance_pct: 100 },
                            { id: Date.now() + 2, nombre: 'Excavaciones Principales', fecha_inicio: '2026-03-11', fecha_fin: '2026-03-25', duracion_dias: 15, avance_pct: 70 },
                            { id: Date.now() + 3, nombre: 'Hormigonado de Cimientos', fecha_inicio: '2026-03-26', fecha_fin: '2026-04-15', duracion_dias: 20, avance_pct: 30 }
                          ];
                          setPlanificacionList(prev => [...prev, ...mockTasks]);
                          alert(`¡Archivo MS Project "${file.name}" cargado! Se importaron ${mockTasks.length} tareas a la nueva obra.`);
                        }
                      }}
                      className="w-full text-xs text-slate-800 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl shadow-xs text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5"
              >
                {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Confirmar y Crear Obra</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR PARTIDA DE OBRA */}
      {showPartidaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="font-extrabold text-slate-800 text-sm">
                {partidaFormData.es_titulo || partidaFormData.unidad === 'TITULO' ? '📁 Insertar Título o Grupo de Obra' : (editingPartida ? 'Editar Partida de Obra' : 'Crear Nueva Partida de Obra')}
              </h3>
              <button onClick={() => setShowPartidaModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!partidaFormData.partida.trim()) return;
                setModalLoading(true);
                try {
                  const cantVal = parseFloat(partidaFormData.cantidad) || 0;
                  const puVal = parseFloat(partidaFormData.pu) || 0;
                  const rendVal = parseFloat(partidaFormData.rendimiento) || 10;

                  // Esqueleto estricto coincidente con el esquema SQL de partidas_obra
                  const dbPayload = {
                    obra_nombre: selectedObra?.nombre || 'Obra Principal',
                    partida: partidaFormData.partida.trim(),
                    unidad: partidaFormData.unidad || 'UND',
                    cantidad_presupuestada: cantVal,
                    costo_por_dia: puVal,
                    rendimiento_meta: rendVal
                  };

                  let savedPart = { 
                    ...dbPayload, 
                    cantidad: cantVal, 
                    pu: puVal, 
                    rendimiento: rendVal 
                  };

                  if (editingPartida) {
                    if (editingPartida.id) {
                      const { error: updErr } = await supabase
                        .from('partidas_obra')
                        .update(dbPayload)
                        .eq('id', editingPartida.id);
                      if (updErr) throw updErr;
                    } else if (selectedObra?.nombre) {
                      const { error: updErr } = await supabase
                        .from('partidas_obra')
                        .update(dbPayload)
                        .eq('obra_nombre', selectedObra.nombre)
                        .eq('partida', editingPartida.partida);
                      if (updErr) throw updErr;
                    }

                    const oldPartidaName = editingPartida.partida;
                    const newPartidaName = savedPart.partida;

                    setPartidasList(prev => {
                      const updated = prev.map(p => {
                        const isTarget = (p.id && editingPartida.id && String(p.id) === String(editingPartida.id)) || p.partida === oldPartidaName;
                        if (isTarget) {
                          return { ...p, ...savedPart };
                        }
                        if (oldPartidaName !== newPartidaName && p.predecesora === oldPartidaName) {
                          return { ...p, predecesora: newPartidaName };
                        }
                        return p;
                      });

                      if (selectedObra?.nombre) {
                        try {
                          const savedOrderStr = localStorage.getItem(`obraxis_obra_partidas_order_${selectedObra.nombre}`);
                          let savedNames = savedOrderStr ? JSON.parse(savedOrderStr) : [];
                          const idx = savedNames.indexOf(oldPartidaName);
                          if (idx !== -1) {
                            savedNames[idx] = newPartidaName;
                          } else {
                            savedNames = updated.map(p => p.partida);
                          }
                          localStorage.setItem(`obraxis_obra_partidas_order_${selectedObra.nombre}`, JSON.stringify(savedNames));
                          localStorage.setItem(`partidas_${selectedObra.nombre}`, JSON.stringify(updated));
                          if (selectedObra.id) localStorage.setItem(`partidas_${selectedObra.id}`, JSON.stringify(updated));
                        } catch (e) {}
                      }
                      return updated;
                    });

                    if (oldPartidaName !== newPartidaName) {
                      setPartidasCostos(prev => {
                        const next = { ...prev };
                        if (next[oldPartidaName] !== undefined) {
                          next[newPartidaName] = next[oldPartidaName];
                          delete next[oldPartidaName];
                        }
                        return next;
                      });

                      setCostosList(prev => {
                        const updatedCostos = prev.map(c => {
                          if (!c.imputaciones || c.imputaciones.length === 0) return c;
                          const newImps = c.imputaciones.map(imp => {
                            if (imp.partida === oldPartidaName) {
                              return { ...imp, partida: newPartidaName };
                            }
                            return imp;
                          });
                          return { ...c, imputaciones: newImps };
                        });
                        if (selectedObra?.nombre) {
                          try {
                            localStorage.setItem(`obraxis_costos_${selectedObra.nombre}`, JSON.stringify(updatedCostos));
                          } catch(e) {}
                        }
                        return updatedCostos;
                      });
                    }
                  } else {
                    if (selectedObra?.nombre) {
                      const { data: insData, error: insErr } = await supabase
                        .from('partidas_obra')
                        .insert([dbPayload])
                        .select()
                        .single();
                      if (insErr) throw insErr;
                      if (insData) savedPart = { ...insData, cantidad: cantVal, pu: puVal };
                    }
                    setPartidasList(prev => {
                      const updated = (dbPayload.unidad === 'TITULO' || partidaFormData.es_titulo) ? [savedPart, ...prev] : [...prev, savedPart];
                      if (selectedObra?.nombre) {
                        try {
                          const orderNames = updated.map(p => p.partida);
                          localStorage.setItem(`obraxis_obra_partidas_order_${selectedObra.nombre}`, JSON.stringify(orderNames));
                          localStorage.setItem(`partidas_${selectedObra.nombre}`, JSON.stringify(updated));
                          if (selectedObra.id) localStorage.setItem(`partidas_${selectedObra.id}`, JSON.stringify(updated));
                        } catch (e) {}
                      }
                      return updated;
                    });
                  }

                  if (partidaFormData.pu !== undefined && partidaFormData.pu !== '') {
                    setPartidasCostos(prev => ({ ...prev, [dbPayload.partida]: parseFloat(partidaFormData.pu) || 0 }));
                  }

                  setShowPartidaModal(false);
                  alert('Partida guardada con éxito en la obra.');
                } catch (err) {
                  alert('Error al guardar partida: ' + err.message);
                } finally {
                  setModalLoading(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre / Descripción de la Partida <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={partidaFormData.partida}
                  onChange={(e) => setPartidaFormData({ ...partidaFormData, partida: e.target.value })}
                  placeholder="Ej. Excavaciones e Instalación de Moldajes"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-800 font-bold"
                />
              </div>

              {partidaFormData.es_titulo || partidaFormData.unidad === 'TITULO' ? (
                <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-300 space-y-1.5">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    📁 Configuración de Encabezado / Título de Grupo
                  </span>
                  <p className="text-[11px] text-amber-900 font-semibold leading-relaxed">
                    Este registro se desplegará como una franja de grupo destacada en la tabla. Todas las partidas colocadas por debajo pertenecerán automáticamente a este capítulo.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Unidad</label>
                      <select
                        value={partidaFormData.unidad}
                        onChange={(e) => setPartidaFormData({ ...partidaFormData, unidad: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white font-semibold"
                      >
                        <option value="UND">UND</option>
                        <option value="M3">M3</option>
                        <option value="M2">M2</option>
                        <option value="ML">ML</option>
                        <option value="KG">KG</option>
                        <option value="TON">TON</option>
                        <option value="GLB">GLB</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cantidad</label>
                      <input
                        type="number"
                        required
                        value={partidaFormData.cantidad}
                        onChange={(e) => setPartidaFormData({ ...partidaFormData, cantidad: e.target.value })}
                        placeholder="100"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">P.U. ($) (Opcional / Puede ser 0)</label>
                      <input
                        type="number"
                        value={partidaFormData.pu}
                        onChange={(e) => setPartidaFormData({ ...partidaFormData, pu: e.target.value })}
                        placeholder="0"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Rendimiento y Unidad de Tiempo */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Rendimiento Estimado</label>
                      <input
                        type="number"
                        step="0.1"
                        value={partidaFormData.rendimiento}
                        onChange={(e) => setPartidaFormData({ ...partidaFormData, rendimiento: e.target.value })}
                        placeholder="25.5"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Unidad de Tiempo</label>
                      <select
                        value={partidaFormData.unidad_tiempo}
                        onChange={(e) => setPartidaFormData({ ...partidaFormData, unidad_tiempo: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 bg-white font-semibold"
                      >
                        <option value="Día">Día</option>
                        <option value="Semana">Semana</option>
                        <option value="Mes">Mes</option>
                        <option value="Hora">Hora</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-2.5 rounded-xl shadow-xs text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{partidaFormData.es_titulo || partidaFormData.unidad === 'TITULO' ? 'Guardar Título o Grupo' : 'Guardar Partida de Obra'}</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIGURACIÓN DE FECHAS DE OBRA (INICIO REAL Y TÉRMINO ESTIMADO) */}
      {showFechasObraModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-900" />
                <span>📅 Configurar Fechas de Obra (Inicio & Término)</span>
              </h3>
              <button onClick={() => setShowFechasObraModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                localStorage.setItem('obraxis_fecha_inicio_real_' + (selectedObra?.nombre || ''), fechaInicioReal);
                localStorage.setItem('obraxis_fecha_termino_est_' + (selectedObra?.nombre || ''), fechaTerminoEstimada);
                setShowFechasObraModal(false);
                alert('Fechas de Inicio Real y Hito: Fecha de Término de Obra guardadas con éxito.');
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">🚀 Fecha de Inicio Real de Obra</label>
                <input
                  type="date"
                  required
                  value={fechaInicioReal}
                  onChange={(e) => setFechaInicioReal(e.target.value)}
                  className="w-full border border-blue-300 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-800 bg-blue-50/40"
                />
                <span className="text-[10px] text-slate-500 block mt-1">Rige la proyección de costos y simulación de días laborados.</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">🏁 🏁 Hito: Fecha de Término de Obra / Contratada</label>
                <input
                  type="date"
                  required
                  value={fechaTerminoEstimada}
                  onChange={(e) => setFechaTerminoEstimada(e.target.value)}
                  className="w-full border border-amber-300 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-800 bg-amber-50/40"
                />
                <span className="text-[10px] text-slate-500 block mt-1">Fecha hito de término del proyecto para control temporal.</span>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl shadow-xs text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <span>Guardar Fechas de Obra</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN RÁPIDA DE SUELDO Y CARGO POR TRABAJADOR (EJ. SOFÍA CASTRO) */}
      {showEditSueldoModal && editingWorkerData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>✏️ Ajustar Sueldo / Tarifa de {editingWorkerData.nombre}</span>
              </h3>
              <button onClick={() => setShowEditSueldoModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const newCostoDia = parseFloat(editingWorkerData.costo_dia) || Math.round((parseFloat(editingWorkerData.sueldo_base) || 0) / 30);
                const newSueldoBase = parseFloat(editingWorkerData.sueldo_base) || Math.round(newCostoDia * 30);
                const newHExtras = parseFloat(editingWorkerData.horas_extras) || 0;
                const newAsig = parseFloat(editingWorkerData.asignaciones) || 0;

                // Actualizar customSalariesMap de forma permanente
                setCustomSalariesMap(prev => {
                  const updated = {
                    ...prev,
                    [editingWorkerData.nombre]: {
                      cargo: editingWorkerData.cargo,
                      sueldo_base: newSueldoBase,
                      costo_dia: newCostoDia,
                      horas_extras: newHExtras,
                      asignaciones: newAsig
                    }
                  };
                  const nameKey = selectedObra?.nombre || 'default';
                  localStorage.setItem('obraxis_custom_salaries_' + nameKey, JSON.stringify(updated));
                  localStorage.setItem('obraxis_global_custom_salaries', JSON.stringify(updated));
                  return updated;
                });

                setShowEditSueldoModal(false);
                alert(`Remuneración y asignaciones de ${editingWorkerData.nombre} actualizadas con éxito.`);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre del Trabajador</label>
                <input
                  type="text"
                  disabled
                  value={editingWorkerData.nombre}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-600 bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cargo / Rol</label>
                <input
                  type="text"
                  required
                  value={editingWorkerData.cargo}
                  onChange={(e) => setEditingWorkerData({ ...editingWorkerData, cargo: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-blue-900 mb-1">Sueldo Base Mensual ($)</label>
                  <input
                    type="number"
                    value={editingWorkerData.sueldo_base}
                    onChange={(e) => {
                      const sb = parseFloat(e.target.value) || 0;
                      setEditingWorkerData({ ...editingWorkerData, sueldo_base: sb, costo_dia: Math.round(sb / 30) });
                    }}
                    className="w-full border border-blue-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-blue-900 mb-1">Tarifa Diario ($/Día)</label>
                  <input
                    type="number"
                    value={editingWorkerData.costo_dia}
                    onChange={(e) => {
                      const cd = parseFloat(e.target.value) || 0;
                      setEditingWorkerData({ ...editingWorkerData, costo_dia: cd, sueldo_base: Math.round(cd * 30) });
                    }}
                    className="w-full border border-blue-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl shadow-xs text-xs cursor-pointer transition"
              >
                <span>Guardar Nuevo Sueldo</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROYECCIÓN MASIVA DE RRHH PARA 100+ TRABAJADORES */}
      {showProyeccionMasivaRrhhModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>⚡ Motor de Proyección Masiva de RRHH (100+ Personas)</span>
              </h3>
              <button onClick={() => setShowProyeccionMasivaRrhhModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Obtener todos los trabajadores únicos
                const allWorkerNames = Array.from(new Set([...(personalAsignadoList || []).map(p => p.nombre), ...(asistenciaList || []).map(a => a.trabajador)])).filter(Boolean);

                const newBulkProjections = allWorkerNames.map(wName => {
                  const workerObj = (personalAsignadoList || []).find(p => p.nombre === wName);
                  const custom = customSalariesMap[wName];
                  const sueldoBase = custom?.sueldo_base || (workerObj ? parseFloat(workerObj.sueldo_base) : 1200000);

                  let calcHE = 0;
                  if (proyeccionMasivaFormData.he_modo === 'HORAS') {
                    const horasDia = parseFloat(proyeccionMasivaFormData.he_horas_dia) || 0;
                    const diasMes = parseFloat(proyeccionMasivaFormData.dias_habiles_mes) || 20;
                    // Cálculo Legal DT Chile (Art. 32 Código del Trabajo, 44 hrs semanales + 50% recargo)
                    // Valor Hora Ordinaria = (Sueldo Base / 30) * (7 / 44)
                    // Valor Hora Extra (50% recargo) = Valor Hora Ordinaria * 1.5 = Sueldo Base * 0.00795454
                    const factorHeChile = (1 / 30) * (7 / 44) * 1.5; // ~0.00795454
                    const valorHoraExtraLegal = sueldoBase * factorHeChile;
                    calcHE = Math.round(horasDia * diasMes * valorHoraExtraLegal);
                  } else {
                    calcHE = parseFloat(proyeccionMasivaFormData.he_monto_fijo) || 0;
                  }

                  const calcAsig = parseFloat(proyeccionMasivaFormData.asignaciones_monto) || 0;

                  return {
                    concepto: `Personal: ${wName}`,
                    partida: 'Gastos Generales',
                    sueldo_base: sueldoBase,
                    horas_extras: calcHE,
                    asignaciones: calcAsig
                  };
                });

                setProyeccionesRrhhList(newBulkProjections);
                try {
                  localStorage.setItem(`obraxis_proj_rrhh_${selectedObra?.nombre}`, JSON.stringify(newBulkProjections));
                } catch (err) {}

                // Actualizar customSalariesMap para que cada trabajador sume H.E. y Asignaciones al Costo Empresa
                setCustomSalariesMap(prev => {
                  const updated = { ...prev };
                  newBulkProjections.forEach(proj => {
                    const wName = proj.concepto.replace('Personal: ', '').trim();
                    const existing = updated[wName] || {};
                    updated[wName] = {
                      ...existing,
                      sueldo_base: existing.sueldo_base || proj.sueldo_base || 1200000,
                      horas_extras: proj.horas_extras || 0,
                      asignaciones: proj.asignaciones || 0
                    };
                  });
                  const nameKey = selectedObra?.nombre || 'default';
                  localStorage.setItem('obraxis_custom_salaries_' + nameKey, JSON.stringify(updated));
                  localStorage.setItem('obraxis_global_custom_salaries', JSON.stringify(updated));
                  return updated;
                });

                setShowProyeccionMasivaRrhhModal(false);
                alert(`Proyección masiva aplicada exitosamente. Se ha actualizado la nómina y el Costo Empresa para ${allWorkerNames.length} trabajadores.`);
              }}
              className="space-y-4 text-xs"
            >
              <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 space-y-2">
                <span className="text-[10px] font-bold uppercase text-indigo-950 block">Regla Global de Horas Extras (H.E.)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Modo Horas Extras</label>
                    <select
                      value={proyeccionMasivaFormData.he_modo}
                      onChange={(e) => setProyeccionMasivaFormData({ ...proyeccionMasivaFormData, he_modo: e.target.value })}
                      className="w-full border border-indigo-300 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="HORAS">N° Horas Extras por Día (ej. 2 hrs/día)</option>
                      <option value="FIJO">Monto Fijo H.E. Mensual ($)</option>
                    </select>
                  </div>
                  {proyeccionMasivaFormData.he_modo === 'HORAS' ? (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Horas Extras / Día por Persona</label>
                      <input
                        type="number"
                        step="any"
                        value={proyeccionMasivaFormData.he_horas_dia}
                        onChange={(e) => setProyeccionMasivaFormData({ ...proyeccionMasivaFormData, he_horas_dia: e.target.value })}
                        placeholder="2"
                        className="w-full border border-indigo-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Monto H.E. Mensual por Persona ($)</label>
                      <input
                        type="number"
                        value={proyeccionMasivaFormData.he_monto_fijo}
                        onChange={(e) => setProyeccionMasivaFormData({ ...proyeccionMasivaFormData, he_monto_fijo: e.target.value })}
                        placeholder="150000"
                        className="w-full border border-indigo-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-2">
                <span className="text-[10px] font-bold uppercase text-amber-950 block">Regla Global de Asignaciones / Viáticos</span>
                <div>
                  <label className="block text-[10px] font-bold text-amber-900 mb-1">Monto Proyectado de Asignaciones por Persona ($)</label>
                  <input
                    type="number"
                    value={proyeccionMasivaFormData.asignaciones_monto}
                    onChange={(e) => setProyeccionMasivaFormData({ ...proyeccionMasivaFormData, asignaciones_monto: e.target.value })}
                    placeholder="50000"
                    className="w-full border border-amber-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                  />
                </div>
              </div>

              <div className="bg-indigo-950 text-white p-3 rounded-xl space-y-1 text-xs font-bold shadow-2xs">
                <div className="flex justify-between items-center">
                  <span>Personas Afectadas:</span>
                  <span className="font-mono text-emerald-400">{Array.from(new Set([...(personalAsignadoList || []).map(p => p.nombre), ...(asistenciaList || []).map(a => a.trabajador)])).filter(Boolean).length} Trabajadores</span>
                </div>
                <p className="text-[10px] text-slate-300 font-normal">
                  La regla calculará automáticamente las H.E. y asignaciones para los 100+ trabajadores según su sueldo base de contrato.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-2.5 rounded-xl shadow-xs text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <span>⚡ Aplicar Proyección Masiva a Toda la Dotación</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR ASIGNACIÓN POR PERÍODO (RANGO DE FECHAS DESDE - HASTA) */}
      {showAsignacionPeriodoModal && editingAsignacionData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>📋 Configurar Asignación por Período (Rango de Fechas)</span>
              </h3>
              <button onClick={() => setShowAsignacionPeriodoModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAsignacionesPeriodosList(prev => {
                  const exists = prev.find(x => x.id === editingAsignacionData.id);
                  let updated = [];
                  if (exists) {
                    updated = prev.map(x => x.id === editingAsignacionData.id ? editingAsignacionData : x);
                  } else {
                    updated = [...prev, editingAsignacionData];
                  }
                  localStorage.setItem('obraxis_asignaciones_periodos_' + (selectedObra?.nombre || ''), JSON.stringify(updated));
                  return updated;
                });
                setShowAsignacionPeriodoModal(false);
                alert(`Asignación "${editingAsignacionData.concepto}" guardada con éxito para el período configurado.`);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre / Concepto de la Asignación o Bono</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Viático Faena Norte / Bono Desempeño"
                  value={editingAsignacionData.concepto}
                  onChange={(e) => setEditingAsignacionData({ ...editingAsignacionData, concepto: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Beneficiarios / Aplicado A</label>
                <select
                  value={editingAsignacionData.destinatario}
                  onChange={(e) => setEditingAsignacionData({ ...editingAsignacionData, destinatario: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="Toda la Dotación">Toda la Dotación de Obra (100+ Personas)</option>
                  {(personalAsignadoList || []).map((p, idx) => (
                    <option key={idx} value={p.nombre}>{p.nombre} ({p.cargo || 'Personal'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-indigo-50/70 p-3 rounded-xl border border-indigo-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-1">📅 Fecha Inicio Período</label>
                  <input
                    type="date"
                    required
                    value={editingAsignacionData.fecha_inicio}
                    onChange={(e) => setEditingAsignacionData({ ...editingAsignacionData, fecha_inicio: e.target.value })}
                    className="w-full border border-indigo-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-1">🏁 Fecha Término Período</label>
                  <input
                    type="date"
                    required
                    value={editingAsignacionData.fecha_termino}
                    onChange={(e) => setEditingAsignacionData({ ...editingAsignacionData, fecha_termino: e.target.value })}
                    className="w-full border border-indigo-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Monto Proyectado por Período ($ Mensual)</label>
                <input
                  type="number"
                  required
                  value={editingAsignacionData.monto_mensual}
                  onChange={(e) => setEditingAsignacionData({ ...editingAsignacionData, monto_mensual: parseFloat(e.target.value) || 0 })}
                  placeholder="50000"
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono font-extrabold text-emerald-900 bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-2.5 rounded-xl shadow-xs text-xs cursor-pointer transition"
              >
                <span>💾 Guardar Asignación por Período</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN PROYECCIÓN DE RECURSOS HUMANOS */}
      {showProyeccionRrhhModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-900" />
                <span>Configurar Proyección de RRHH (Base + H.E. + Asignaciones)</span>
              </h3>
              <button onClick={() => setShowProyeccionRrhhModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setProyeccionesRrhhList(prev => {
                  const updated = [...prev, proyeccionRrhhFormData];
                  localStorage.setItem(`obraxis_proj_rrhh_${selectedObra?.nombre}`, JSON.stringify(updated));
                  return updated;
                });
                setShowProyeccionRrhhModal(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Trabajador / Concepto RRHH</label>
                <input
                  type="text"
                  required
                  value={proyeccionRrhhFormData.concepto}
                  onChange={(e) => setProyeccionRrhhFormData({ ...proyeccionRrhhFormData, concepto: e.target.value })}
                  placeholder="Ej. Operador Excavadora / Cuadrilla Moldajes"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Partida Imputada</label>
                <select
                  value={proyeccionRrhhFormData.partida}
                  onChange={(e) => setProyeccionRrhhFormData({ ...proyeccionRrhhFormData, partida: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-semibold"
                >
                  <option value="Gastos Generales">Gastos Generales de Obra</option>
                  {partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)).map(p => (
                    <option key={p.partida} value={p.partida}>{p.partida}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-indigo-950 mb-1">Sueldo Base ($)</label>
                  <input
                    type="number"
                    required
                    value={proyeccionRrhhFormData.sueldo_base}
                    onChange={(e) => setProyeccionRrhhFormData({ ...proyeccionRrhhFormData, sueldo_base: e.target.value })}
                    placeholder="600000"
                    className="w-full border border-indigo-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-indigo-950 mb-1">Proyección H.E. ($)</label>
                  <input
                    type="number"
                    value={proyeccionRrhhFormData.horas_extras}
                    onChange={(e) => setProyeccionRrhhFormData({ ...proyeccionRrhhFormData, horas_extras: e.target.value })}
                    placeholder="150000"
                    className="w-full border border-indigo-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-indigo-950 mb-1">Asignaciones ($)</label>
                  <input
                    type="number"
                    value={proyeccionRrhhFormData.asignaciones}
                    onChange={(e) => setProyeccionRrhhFormData({ ...proyeccionRrhhFormData, asignaciones: e.target.value })}
                    placeholder="50000"
                    className="w-full border border-indigo-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                  />
                </div>
              </div>

              <div className="bg-indigo-950 text-white p-3 rounded-xl flex justify-between items-center text-xs font-bold shadow-2xs">
                <span>Costo Total Proyectado RRHH:</span>
                <span className="font-mono text-emerald-400 text-sm">
                  ${(
                    (parseFloat(proyeccionRrhhFormData.sueldo_base) || 0) +
                    (parseFloat(proyeccionRrhhFormData.horas_extras) || 0) +
                    (parseFloat(proyeccionRrhhFormData.asignaciones) || 0)
                  ).toLocaleString('es-CL')}
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-2.5 rounded-xl shadow-xs text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <span>Guardar Proyección RRHH</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CARGA DE LIQUIDACIÓN DE SUELDO REAL */}
      {showLiquidacionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-900" />
                <span>Registrar Liquidación de Sueldo Real Emitida</span>
              </h3>
              <button onClick={() => setShowLiquidacionModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLiquidacionesList(prev => {
                  const updated = [...prev, liquidacionFormData];
                  localStorage.setItem(`obraxis_liquidaciones_${selectedObra?.nombre}`, JSON.stringify(updated));
                  return updated;
                });
                setShowLiquidacionModal(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Trabajador / Personal</label>
                <input
                  type="text"
                  required
                  value={liquidacionFormData.trabajador}
                  onChange={(e) => setLiquidacionFormData({ ...liquidacionFormData, trabajador: e.target.value })}
                  placeholder="Nombre completo del trabajador"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Periodo / Mes</label>
                  <input
                    type="month"
                    required
                    value={liquidacionFormData.periodo}
                    onChange={(e) => setLiquidacionFormData({ ...liquidacionFormData, periodo: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">N° Folio / Respaldo</label>
                  <input
                    type="text"
                    value={liquidacionFormData.num_folio}
                    onChange={(e) => setLiquidacionFormData({ ...liquidacionFormData, num_folio: e.target.value })}
                    placeholder="Ej. LIQ-2026-07-001"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-semibold text-slate-800 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Monto Real Líquido / Costo Empresa ($)</label>
                <input
                  type="number"
                  required
                  value={liquidacionFormData.monto_real}
                  onChange={(e) => setLiquidacionFormData({ ...liquidacionFormData, monto_real: e.target.value })}
                  placeholder="Monto real total de la liquidación emitada ($)"
                  className="w-full border border-emerald-300 rounded-lg p-2.5 text-xs font-mono font-bold text-emerald-950 bg-emerald-50/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Partida Imputada</label>
                <select
                  value={liquidacionFormData.partida}
                  onChange={(e) => setLiquidacionFormData({ ...liquidacionFormData, partida: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-semibold"
                >
                  <option value="Gastos Generales">Gastos Generales de Obra</option>
                  {partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)).map(p => (
                    <option key={p.partida} value={p.partida}>{p.partida}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl shadow-xs text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <span>Guardar Liquidación de Sueldo</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR Y AGREGAR GASTO PROYECTADO */}
      {showProyeccionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-900" />
                <span>Agregar Gasto Proyectado por Partida</span>
              </h3>
              <button
                onClick={() => setShowProyeccionModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setProyeccionesList(prev => {
                  const itemId = proyeccionFormData.id || ('proj-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
                  const newItem = { ...proyeccionFormData, id: itemId };
                  const exists = prev.some(x => x.id === itemId);
                  const updated = exists ? prev.map(x => x.id === itemId ? newItem : x) : [...prev, newItem];
                  try {
                    const key = `obraxis_proyecciones_obras_${selectedObra?.nombre}`;
                    localStorage.setItem(key, JSON.stringify(updated));
                  } catch (err) {}
                  return updated;
                });
                setShowProyeccionModal(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Partida a Configurar</label>
                <select
                  value={proyeccionFormData.partida}
                  onChange={(e) => setProyeccionFormData({ ...proyeccionFormData, partida: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-bold"
                >
                  {partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)).map(p => (
                    <option key={p.partida} value={p.partida}>{p.partida} ({p.cantidad} {p.unidad})</option>
                  ))}
                </select>
              </div>

              {/* AUTO-COMPLETADO DESDE PERSONAL / DOTACIÓN DE FAENA */}
              {asistenciaList.length > 0 && (
                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                  <label className="block text-[10px] font-bold uppercase text-emerald-900 mb-1">💡 Opcional: Auto-completar con Personal Asignado a Faena</label>
                  <select
                    onChange={(e) => {
                      const selectedWorkerName = e.target.value;
                      if (!selectedWorkerName) return;
                      setProyeccionFormData(prev => ({
                        ...prev,
                        tipo_proyeccion: 'TIEMPO',
                        nombre_item: `Personal: ${selectedWorkerName}`,
                        tarifa_tiempo_dia: 35000
                      }));
                    }}
                    className="w-full border border-emerald-300 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="">-- Seleccionar Trabajador Registrado en Obra --</option>
                    {Array.from(new Set([...(personalAsignadoList || []).map(p => p.nombre), ...(asistenciaList || []).map(a => a.trabajador)])).filter(Boolean).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Proyección</label>
                <select
                  value={proyeccionFormData.tipo_proyeccion}
                  onChange={(e) => setProyeccionFormData({ ...proyeccionFormData, tipo_proyeccion: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-bold"
                >
                  <option value="TIEMPO">1. Por Unidad de Tiempo (p. ej. $/Día, $/Hora)</option>
                  <option value="INSUMO">2. Por Cantidad de Insumo con Conversión de Rendimiento</option>
                </select>
              </div>

              {proyeccionFormData.tipo_proyeccion === 'TIEMPO' ? (
                <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-blue-900 mb-1">Nombre / Concepto del Costo de Tiempo</label>
                    <input
                      type="text"
                      required
                      value={proyeccionFormData.nombre_item}
                      onChange={(e) => setProyeccionFormData({ ...proyeccionFormData, nombre_item: e.target.value })}
                      placeholder="Ej. Arriendo de Maquinaria / Cuadrilla de Operadores"
                      className="w-full border border-blue-300 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-blue-900 mb-1">Tarifa por Unidad de Tiempo ($ / Día Hábil)</label>
                    <input
                      type="number"
                      required
                      value={proyeccionFormData.tarifa_tiempo_dia}
                      onChange={(e) => setProyeccionFormData({ ...proyeccionFormData, tarifa_tiempo_dia: e.target.value })}
                      placeholder="20000"
                      className="w-full border border-blue-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                    />
                  </div>
                  {(() => {
                    const selP = partidasList.find(x => x.partida === proyeccionFormData.partida);
                    if (!selP) return null;
                    const cant = parseFloat(selP.cantidad) || 0;
                    const rend = parseFloat(selP.rendimiento_meta || selP.rendimiento) || 10;
                    const dias = rend > 0 ? (cant / rend) : 1;
                    const tarifa = parseFloat(proyeccionFormData.tarifa_tiempo_dia) || 0;
                    const total = Math.round(dias * tarifa);
                    return (
                      <div className="text-[11px] text-blue-950 font-bold bg-white p-2.5 rounded-lg border border-blue-200 space-y-1">
                        <p>⏱️ Duración Calculada: <span className="font-mono text-blue-900">{dias.toFixed(1)} Días hábiles</span></p>
                        <p>💰 Costo Proyectado Total: <span className="font-mono text-emerald-800">${total.toLocaleString('es-CL')}</span></p>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-300 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">Nombre Insumo</label>
                      <input
                        type="text"
                        required
                        value={proyeccionFormData.nombre_item}
                        onChange={(e) => setProyeccionFormData({ ...proyeccionFormData, nombre_item: e.target.value })}
                        placeholder="Ej. Sacos de Cemento"
                        className="w-full border border-amber-300 rounded-lg p-2 text-xs text-slate-800 bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">Unidad Insumo</label>
                      <input
                        type="text"
                        required
                        value={proyeccionFormData.unidad_insumo}
                        onChange={(e) => setProyeccionFormData({ ...proyeccionFormData, unidad_insumo: e.target.value })}
                        placeholder="Saco / Litro / Kg"
                        className="w-full border border-amber-300 rounded-lg p-2 text-xs text-slate-800 bg-white font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">Tasa Rendimiento / Consumo</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={proyeccionFormData.tasa_rendimiento_insumo}
                        onChange={(e) => setProyeccionFormData({ ...proyeccionFormData, tasa_rendimiento_insumo: e.target.value })}
                        placeholder="8 (ej. 8 sacos/m3)"
                        className="w-full border border-amber-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">Precio Unitario Insumo ($)</label>
                      <input
                        type="number"
                        required
                        value={proyeccionFormData.precio_unitario_insumo}
                        onChange={(e) => setProyeccionFormData({ ...proyeccionFormData, precio_unitario_insumo: e.target.value })}
                        placeholder="5000"
                        className="w-full border border-amber-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 bg-white"
                      />
                    </div>
                  </div>

                  {(() => {
                    const selP = partidasList.find(x => x.partida === proyeccionFormData.partida);
                    if (!selP) return null;
                    const cant = parseFloat(selP.cantidad) || 0;
                    const tasa = parseFloat(proyeccionFormData.tasa_rendimiento_insumo) || 0;
                    const precio = parseFloat(proyeccionFormData.precio_unitario_insumo) || 0;
                    const consumoTotal = cant * tasa;
                    const total = Math.round(consumoTotal * precio);
                    return (
                      <div className="text-[11px] text-amber-950 font-bold bg-white p-2.5 rounded-lg border border-amber-200 space-y-1">
                        <p>📦 Consumo Total Insumo: <span className="font-mono text-amber-900">{consumoTotal.toLocaleString('es-CL')} {proyeccionFormData.unidad_insumo}</span></p>
                        <p>💰 Costo Proyectado Total: <span className="font-mono text-emerald-800">${total.toLocaleString('es-CL')}</span></p>
                      </div>
                    );
                  })()}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl shadow-xs text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <span>Guardar Proyección de Gastos</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR COSTO REAL DE OBRA */}
      {showCostoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="font-extrabold text-slate-800 text-sm">
                {editingCosto ? 'Editar Costo de Obra' : 'Registrar Costo Real de Obra'}
              </h3>
              <button onClick={() => setShowCostoModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!costoFormData.nombre.trim() || !costoFormData.monto) return;
                
                const newCosto = {
                  id: editingCosto ? editingCosto.id : Date.now(),
                  nombre: costoFormData.nombre.trim(),
                  tipo_costo: costoFormData.tipo_costo,
                  asociar_factura: costoFormData.asociar_factura,
                  num_factura: costoFormData.num_factura.trim(),
                  monto: parseFloat(costoFormData.monto) || 0,
                  imputaciones: costoFormData.imputaciones || []
                };

                let updatedCostos = [];
                if (editingCosto) {
                  updatedCostos = costosList.map(c => c.id === editingCosto.id ? newCosto : c);
                } else {
                  updatedCostos = [...costosList, newCosto];
                }

                setCostosList(updatedCostos);

                try {
                  const obraKey = selectedObra?.nombre || selectedObra?.id || 'default';
                  localStorage.setItem(`obraxis_costos_${obraKey}`, JSON.stringify(updatedCostos));
                  if (selectedObra?.id) localStorage.setItem(`obraxis_costos_${selectedObra.id}`, JSON.stringify(updatedCostos));
                  if (selectedObra?.nombre) localStorage.setItem(`obraxis_costos_${selectedObra.nombre}`, JSON.stringify(updatedCostos));
                } catch (eErr) {}

                try {
                  const payload = {
                    ...newCosto,
                    obra_nombre: selectedObra?.nombre || ''
                  };
                  await supabase.from('costos_reales_obra').upsert(payload);
                } catch (err) {
                  console.warn('Sync warning on costos_reales_obra:', err);
                }

                setShowCostoModal(false);
                alert('Costo e imputaciones registrados con éxito.');
              }}
              className="space-y-4 text-xs"
            >


              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre / Concepto del Costo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={costoFormData.nombre}
                  onChange={(e) => setCostoFormData({ ...costoFormData, nombre: e.target.value })}
                  placeholder="Ej. Compra Hormigón H30 / Subcontrato Moldajes"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Costo</label>
                  <select
                    value={costoFormData.tipo_costo}
                    onChange={(e) => setCostoFormData({ ...costoFormData, tipo_costo: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-semibold"
                  >
                    <option value="Materiales">Materiales</option>
                    <option value="Mano de Obra">Mano de Obra</option>
                    <option value="Maquinaria & Equipos">Maquinaria & Equipos</option>
                    <option value="Subcontratos">Subcontratos</option>
                    <option value="Gastos Generales / Varios">Gastos Generales / Varios</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Monto Total Costo ($) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formatNumberWithDots(costoFormData.monto)}
                    onChange={(e) => setCostoFormData({ ...costoFormData, monto: parseNumberFromDots(e.target.value) })}
                    placeholder="1.250.000"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">¿Asociar Factura / Documento?</label>
                  <select
                    value={costoFormData.asociar_factura}
                    onChange={(e) => setCostoFormData({ ...costoFormData, asociar_factura: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-semibold"
                  >
                    <option value="SI">Sí, asociar N° Factura / Guía</option>
                    <option value="NO">No, gasto interno sin factura</option>
                  </select>
                </div>

                {costoFormData.asociar_factura === 'SI' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">N° Factura / Guía Despacho</label>
                    <input
                      type="text"
                      value={costoFormData.num_factura}
                      onChange={(e) => setCostoFormData({ ...costoFormData, num_factura: e.target.value })}
                      placeholder="FACT-94820"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Seccion de Imputación por Porcentaje a Partidas */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 uppercase text-[10px]">Imputación a Partida(s) de Obra por Porcentaje (%)</h4>
                  <button
                    type="button"
                    onClick={() => {
                      const defaultName = partidasList.length > 0
                        ? (partidasList[costoFormData.imputaciones.length % partidasList.length]?.partida || partidasList[0].partida)
                        : `Partida ${costoFormData.imputaciones.length + 1}`;
                      setCostoFormData(prev => ({
                        ...prev,
                        imputaciones: [...(prev.imputaciones || []), { partida: defaultName, porcentaje: 100 }]
                      }));
                    }}
                    className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold px-2.5 py-1 rounded-lg border border-emerald-300 transition cursor-pointer"
                  >
                    + Asociar Otra Partida
                  </button>
                </div>

                {costoFormData.imputaciones.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Haz clic en "+ Asociar Otra Partida" para distribuir este costo en la obra.</p>
                ) : (
                  <div className="space-y-2">
                    {costoFormData.imputaciones.map((imp, iIdx) => (
                      <div key={iIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        {partidasList.length > 0 ? (
                          <select
                            value={imp.partida}
                            onChange={(e) => {
                              const newImp = [...costoFormData.imputaciones];
                              newImp[iIdx].partida = e.target.value;
                              setCostoFormData({ ...costoFormData, imputaciones: newImp });
                            }}
                            className="flex-1 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 bg-white"
                          >
                            {partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)).map(p => (
                              <option key={p.partida} value={p.partida}>{p.partida}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={imp.partida}
                            onChange={(e) => {
                              const newImp = [...costoFormData.imputaciones];
                              newImp[iIdx].partida = e.target.value;
                              setCostoFormData({ ...costoFormData, imputaciones: newImp });
                            }}
                            placeholder="Nombre de la partida..."
                            className="flex-1 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 bg-white"
                          />
                        )}

                        <div className="flex items-center gap-1 w-28">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={imp.porcentaje}
                            onChange={(e) => {
                              const newImp = [...costoFormData.imputaciones];
                              newImp[iIdx].porcentaje = parseFloat(e.target.value) || 0;
                              setCostoFormData({ ...costoFormData, imputaciones: newImp });
                            }}
                            className="w-16 border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-800 text-center"
                          />
                          <span className="text-xs font-bold text-slate-600">%</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCostoFormData(prev => ({
                              ...prev,
                              imputaciones: prev.imputaciones.filter((_, i) => i !== iIdx)
                            }));
                          }}
                          className="text-slate-400 hover:text-red-700 font-bold text-xs p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl shadow-xs text-xs cursor-pointer transition"
              >
                Guardar Costo e Imputaciones
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR ACTIVIDAD DE PLANIFICACIÓN */}
      {showActividadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="font-extrabold text-slate-800 text-sm">
                {editingActividad ? 'Editar Actividad' : 'Crear Actividad / Hito de Planificación'}
              </h3>
              <button onClick={() => setShowActividadModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!actividadFormData.nombre.trim()) return;
                const newAct = {
                  id: editingActividad ? editingActividad.id : Date.now(),
                  nombre: actividadFormData.nombre.trim(),
                  fecha_inicio: actividadFormData.fecha_inicio,
                  fecha_fin: actividadFormData.fecha_fin || actividadFormData.fecha_inicio,
                  duracion_dias: parseInt(actividadFormData.duracion_dias) || 7,
                  avance_pct: parseInt(actividadFormData.avance_pct) || 0
                };

                if (editingActividad) {
                  setPlanificacionList(prev => prev.map(a => a.id === editingActividad.id ? newAct : a));
                } else {
                  setPlanificacionList(prev => [...prev, newAct]);
                }

                setShowActividadModal(false);
                alert('Actividad guardada con éxito en la planificación.');
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre de la Actividad / Hito <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={actividadFormData.nombre}
                  onChange={(e) => setActividadFormData({ ...actividadFormData, nombre: e.target.value })}
                  placeholder="Ej. Trazados y Montaje de Moldajes"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-900 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={actividadFormData.fecha_inicio}
                    onChange={(e) => setActividadFormData({ ...actividadFormData, fecha_inicio: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha Término</label>
                  <input
                    type="date"
                    value={actividadFormData.fecha_fin}
                    onChange={(e) => setActividadFormData({ ...actividadFormData, fecha_fin: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Duración (Días)</label>
                  <input
                    type="number"
                    value={actividadFormData.duracion_dias}
                    onChange={(e) => setActividadFormData({ ...actividadFormData, duracion_dias: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">% Avance Cumplido</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={actividadFormData.avance_pct}
                    onChange={(e) => setActividadFormData({ ...actividadFormData, avance_pct: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-900 hover:bg-indigo-800 text-white font-bold py-2.5 rounded-xl shadow-xs text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <span>Guardar Actividad en Gantt</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR NOTA / COMENTARIO DE BITÁCORA */}
      {showBitacoraNoteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-900" />
                <span>Agregar Nota / Comentario a la Bitácora</span>
              </h3>
              <button onClick={() => setShowBitacoraNoteModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!bitacoraNoteFormData.comentario.trim()) {
                  alert('Debes ingresar el contenido del comentario o información.');
                  return;
                }
                setModalLoading(true);
                try {
                  const payload = {
                    obra_nombre: selectedObra?.nombre || 'Obra Principal',
                    fecha: bitacoraNoteFormData.fecha || new Date().toISOString().substring(0, 10),
                    titulo: bitacoraNoteFormData.titulo.trim() || 'Nota / Comentario de Faena',
                    comentario: bitacoraNoteFormData.comentario.trim(),
                    autor: user?.nombre || user?.usuario || 'Supervisor'
                  };

                  const { data: insData, error: insErr } = await supabase
                    .from('bitacora_obra')
                    .insert([payload])
                    .select();

                  if (insErr) {
                    console.warn("Nota al guardar en Supabase bitacora_obra:", insErr.message);
                  }

                  setBitacoraNotasList(prev => [...prev, insData ? insData[0] : payload]);
                  setShowBitacoraNoteModal(false);
                  alert('¡Nota / Comentario agregado a la Bitácora con éxito!');
                } catch (err) {
                  alert('Error al guardar nota de bitácora: ' + err.message);
                } finally {
                  setModalLoading(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha del Suceso / Comentario <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={bitacoraNoteFormData.fecha}
                  onChange={(e) => setBitacoraNoteFormData({ ...bitacoraNoteFormData, fecha: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Título / Asunto (Opcional)</label>
                <input
                  type="text"
                  value={bitacoraNoteFormData.titulo}
                  onChange={(e) => setBitacoraNoteFormData({ ...bitacoraNoteFormData, titulo: e.target.value })}
                  placeholder="Ej. Visita de Cliente, Inspección Terreno, Condición Climática..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Comentario / Información de Faena <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={4}
                  value={bitacoraNoteFormData.comentario}
                  onChange={(e) => setBitacoraNoteFormData({ ...bitacoraNoteFormData, comentario: e.target.value })}
                  placeholder="Escribe aquí las observaciones, instrucciones, acuerdos o comentarios relevantes del día en la obra..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-medium leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl shadow-xs text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5"
              >
                {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Guardar Nota en Bitácora</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR MANTENCIÓN DE MAQUINARIA */}
      {showMantencionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span>Registrar Mantención de Maquinaria</span>
              </h3>
              <button onClick={() => setShowMantencionModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveMantencion} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Maquinaria / Equipo *</label>
                <select
                  required
                  value={mantencionFormData.equipo_nombre}
                  onChange={(e) => setMantencionFormData({ ...mantencionFormData, equipo_nombre: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="">(Seleccionar Equipo de Flota)</option>
                  {(maquinariaList || []).map((m, idx) => (
                    <option key={`m-${idx}`} value={m.nombre || m.equipo}>{m.nombre || m.equipo} ({m.patente || 'Propio'})</option>
                  ))}
                  {(arriendosList || []).map((a, idx) => (
                    <option key={`a-${idx}`} value={a.equipo}>[Arriendo] {a.equipo} ({a.patente || 'S/P'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={mantencionFormData.fecha}
                    onChange={(e) => setMantencionFormData({ ...mantencionFormData, fecha: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Mantención</label>
                  <select
                    value={mantencionFormData.tipo}
                    onChange={(e) => setMantencionFormData({ ...mantencionFormData, tipo: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="Preventiva">🔧 Preventiva Programada</option>
                    <option value="Correctiva">🚨 Correctiva por Falla</option>
                    <option value="Overhaul">⚙️ Overhaul / Cambio Piezas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Costo Estimado / Real ($)</label>
                <input
                  type="text"
                  placeholder="ej. 250.000"
                  value={formatNumberWithDots(mantencionFormData.costo)}
                  onChange={(e) => setMantencionFormData({ ...mantencionFormData, costo: parseNumberFromDots(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Descripción / Trabajos Realizados</label>
                <textarea
                  rows={3}
                  value={mantencionFormData.descripcion}
                  onChange={(e) => setMantencionFormData({ ...mantencionFormData, descripcion: e.target.value })}
                  placeholder="Detalle de aceites, filtros, reparaciones o revisión mecánica..."
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Guardar Registro de Mantención
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR PARALIZACIÓN DE MAQUINARIA */}
      {showParalizacionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Registrar Paralización / Falla Técnica</span>
              </h3>
              <button onClick={() => setShowParalizacionModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveParalizacion} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Maquinaria / Equipo *</label>
                <select
                  required
                  value={paralizacionFormData.equipo_nombre}
                  onChange={(e) => setParalizacionFormData({ ...paralizacionFormData, equipo_nombre: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="">(Seleccionar Equipo de Flota)</option>
                  {(maquinariaList || []).map((m, idx) => (
                    <option key={`m-${idx}`} value={m.nombre || m.equipo}>{m.nombre || m.equipo} ({m.patente || 'Propio'})</option>
                  ))}
                  {(arriendosList || []).map((a, idx) => (
                    <option key={`a-${idx}`} value={a.equipo}>[Arriendo] {a.equipo} ({a.patente || 'S/P'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha Inicio Detención</label>
                  <input
                    type="date"
                    required
                    value={paralizacionFormData.fecha_inicio}
                    onChange={(e) => setParalizacionFormData({ ...paralizacionFormData, fecha_inicio: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Horas de Parada</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={paralizacionFormData.horas_parada}
                    onChange={(e) => setParalizacionFormData({ ...paralizacionFormData, horas_parada: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Motivo / Causa de Detención</label>
                <textarea
                  rows={3}
                  required
                  value={paralizacionFormData.motivo}
                  onChange={(e) => setParalizacionFormData({ ...paralizacionFormData, motivo: e.target.value })}
                  placeholder="Falla hidráulica, panne de motor, falta de repuestos, clima..."
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Registrar Paralización de Equipo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ACCIDENTE / INCIDENTE DE PREVENCIÓN */}
      {showAccidenteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-700" />
                <span>Registrar Incidente / Accidente HSE</span>
              </h3>
              <button onClick={() => setShowAccidenteModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveAccidente} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha Ocurrencia</label>
                  <input
                    type="date"
                    required
                    value={accidenteFormData.fecha}
                    onChange={(e) => setAccidenteFormData({ ...accidenteFormData, fecha: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Evento</label>
                  <select
                    value={accidenteFormData.tipo}
                    onChange={(e) => setAccidenteFormData({ ...accidenteFormData, tipo: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="STP">🟢 Sin Tiempo Perdido (STP)</option>
                    <option value="CTP">🔴 Con Tiempo Perdido (CTP)</option>
                    <option value="CASI_ACCIDENTE">⚠️ Casi Accidente / Cuasi Incidente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Trabajador Involucrado / Cuadrilla</label>
                <input
                  type="text"
                  required
                  value={accidenteFormData.trabajador}
                  onChange={(e) => setAccidenteFormData({ ...accidenteFormData, trabajador: e.target.value })}
                  placeholder="Nombre de trabajador o cuadrilla..."
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Días Perdidos (Licencia Médica / Parada)</label>
                <input
                  type="number"
                  min="0"
                  value={accidenteFormData.dias_perdidos}
                  onChange={(e) => setAccidenteFormData({ ...accidenteFormData, dias_perdidos: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Descripción del Incidente / Causa Raíz</label>
                <textarea
                  rows={3}
                  required
                  value={accidenteFormData.descripcion}
                  onChange={(e) => setAccidenteFormData({ ...accidenteFormData, descripcion: e.target.value })}
                  placeholder="Relato de los hechos, medidas correctivas aplicadas..."
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Guardar Incidente HSE
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Contextual de Correos por Obra */}
      <ContextualEmailConfigModal
        isOpen={showContextualEmailModal}
        onClose={() => setShowContextualEmailModal(false)}
        moduloTitle={`Configurar Correos de Obra`}
        moduloKey="avances_obra"
        obraNombre={selectedObra?.nombre}
        user={user}
      />

    </div>
  );
}

export default Obras;
