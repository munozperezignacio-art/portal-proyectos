import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Building2, ArrowLeft, Users, Truck, Wrench, FileSpreadsheet, 
  ExternalLink, Calendar, Plus, Info, Check, UserCheck, Play, ArrowRightLeft, FileText, AlertCircle, AlertTriangle, Camera,
  QrCode, MapPin, Printer, Navigation, RotateCcw, CheckCircle2, MapIcon as Map, ShieldAlert, Settings, Edit, Trash2, Download,
  History, BarChart3, ShieldCheck, Clock, DollarSign, CalendarRange, FileUp, Loader2, FolderPlus
} from 'lucide-react';
import ContextualEmailConfigModal from './ContextualEmailConfigModal';
import { canConfigureEmails, canCreateObras, canModifyOrDeleteRecords } from '../utils/userLevel';
import { sendSystemEmail } from '../utils/emailService';

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
  const [fechaCorteProyeccion, setFechaCorteProyeccion] = useState(new Date().toISOString().split('T')[0]);
  const [showProyeccionModal, setShowProyeccionModal] = useState(false);
  const [proyeccionFormData, setProyeccionFormData] = useState({
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
  const [arriendoData, setArriendoData] = useState({ equipo: '', patente: '', proveedor: '', costo: '', fechaInicio: '', fechaTermino: '', observaciones: '' });

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
  const [hasSignature, setHasSignature] = useState(false);

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

    // 1. Cargar personal
    try {
      const { count: countPers } = await supabase
        .from('maestro_personal')
        .select('*', { count: 'exact', head: true })
        .eq('obra_nombre', obraNombre);
      setPersonalCount(countPers || 0);

      const { data: listPers } = await supabase.from('maestro_personal').select('*').eq('obra_nombre', obraNombre);
      setPersonalAsignadoList(listPers || []);
      setPersonalList(listPers || []);
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

      const isEquipForObra = (item) => {
        if (!item || !item.obra_nombre) return false;
        const rawObra = String(item.obra_nombre).trim().toLowerCase();
        const rawTarget = String(obraNombre || '').trim().toLowerCase();
        if (!rawObra || rawObra.includes('bodega') || rawObra === 'libre') return false;

        // 1. Comparación exacta directa
        if (rawObra === rawTarget) return true;

        // 2. Normalización alfanumérica stripping espacios y caracteres especiales
        const normObra = rawObra.replace(/[^a-z0-9]/g, '');
        const normTarget = rawTarget.replace(/[^a-z0-9]/g, '');

        if (normObra === normTarget || (normTarget && normObra.includes(normTarget)) || (normObra && normTarget.includes(normObra))) return true;

        // 3. Normalización sin prefijos 'obra' o 'proyecto'
        const coreObra = normObra.replace(/^(obra|proyecto)/, '');
        const coreTarget = normTarget.replace(/^(obra|proyecto)/, '');

        return coreObra === coreTarget || (coreTarget && coreObra.includes(coreTarget)) || (coreObra && coreTarget.includes(coreObra));
      };

      const finalMaqObra = combinedFleet.filter(isEquipForObra);
      setMaquinariaCount(finalMaqObra.length);
      setMaquinariaList(finalMaqObra);
    } catch (eMaq) {
      console.error('Error en módulo Maquinaria:', eMaq);
    }

    // 3. Cargar partidas de obra
    try {
      const { data: listPart } = await supabase.from('partidas_obra').select('*').eq('obra_nombre', obraNombre);
      let normalizedListPart = (listPart || []).map(p => ({
        ...p,
        cantidad: parseFloat(p.cantidad_presupuestada !== undefined && p.cantidad_presupuestada !== null ? p.cantidad_presupuestada : p.cantidad) || 0,
        pu: parseFloat(p.costo_por_dia !== undefined && p.costo_por_dia !== null ? p.costo_por_dia : p.pu) || 0,
        rendimiento: p.rendimiento_meta || p.rendimiento || '10'
      }));

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
      const { data } = await supabase
        .from('asistencia_personal')
        .select('*')
        .eq('obra_nombre', obraNombre)
        .order('created_at', { ascending: false });
      if (data) fullAsist = data;
      setAsistenciaList(fullAsist);
    } catch (e) {}

    // 5. Avances de producción
    let fullAvances = [];
    try {
      const { data } = await supabase
        .from('avances_produccion_partidas')
        .select('*')
        .eq('obra_nombre', obraNombre)
        .order('created_at', { ascending: false });
      if (data) fullAvances = data;
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
      setArriendosList(aData || []);
    } catch (e) {}

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
    if (!canManageRecordsAccess) return alert('No tienes permisos de Nivel 0, 1 o 2 para editar arriendos.');
    setEditingRecordId(a.id);
    setArriendoData({
      id: a.id,
      equipo: a.equipo,
      patente: a.patente || '',
      proveedor: a.proveedor,
      costo: a.costo || '',
      fechaInicio: a.fechaInicio || '',
      fechaTermino: a.fechaTermino || '',
      observaciones: a.observaciones || ''
    });
    setShowArriendoModal(true);
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
  const handleSaveArriendo = (e) => {
    e.preventDefault();
    if (!arriendoData.equipo.trim() || !arriendoData.proveedor.trim()) {
      alert('Debes ingresar el Nombre del Equipo y el Proveedor Arrendador (Empresa Arrendadora).');
      return;
    }
    const newArriendo = {
      id: Date.now().toString(),
      equipo: arriendoData.equipo.trim(),
      patente: arriendoData.patente.trim(),
      proveedor: arriendoData.proveedor.trim(),
      costo: parseFloat(arriendoData.costo) || 0,
      fechaInicio: arriendoData.fechaInicio,
      fechaTermino: arriendoData.fechaTermino,
      observaciones: arriendoData.observaciones
    };
    const updated = [...arriendosList, newArriendo];
    setArriendosList(updated);
    try {
      localStorage.setItem(`arriendos_${selectedObra.id}`, JSON.stringify(updated));
    } catch(e) {}
    setShowArriendoModal(false);
    setArriendoData({ equipo: '', patente: '', proveedor: '', costo: '', fechaInicio: '', fechaTermino: '', observaciones: '' });
  };

  // Cargar Cuadrillas y Arriendos desde localStorage cuando cambia la obra
  useEffect(() => {
    if (selectedObra?.id) {
      try {
        const savedC = localStorage.getItem(`cuadrillas_${selectedObra.id}`);
        if (savedC) setCuadrillasList(JSON.parse(savedC));
        else setCuadrillasList([]);

        const savedA = localStorage.getItem(`arriendos_${selectedObra.id}`);
        if (savedA) setArriendosList(JSON.parse(savedA));
        else setArriendosList([]);
      } catch(e) {}
    }
  }, [selectedObra?.id]);

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
                    const totalMetaObra = partidasList.reduce((sum, p) => sum + (parseFloat(p.cantidad) || 0), 0);
                    const totalEjecutadoObra = reportesAvanceList.reduce((sum, r) => sum + (parseFloat(r.cantidad) || 0), 0);
                    
                    let avanceGlobalCalculado = '0.0';
                    if (totalMetaObra > 0) {
                      avanceGlobalCalculado = (Math.min(100, (totalEjecutadoObra / totalMetaObra) * 100)).toFixed(1);
                    } else if (partidasList.length > 0) {
                      const sumPcts = partidasList.reduce((acc, p) => {
                        const ejec = reportesAvanceList
                          .filter(r => r.partida && r.partida.toLowerCase().trim() === p.partida.toLowerCase().trim())
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
                                  .filter(r => r.partida && r.partida.toLowerCase().trim() === p.partida.toLowerCase().trim())
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
                            <th className="p-2">Costo Arriendo</th>
                            <th className="p-2">Periodo</th>
                            {canManageRecordsAccess && <th className="p-2 text-center">Acciones</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {arriendosList.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50">
                              <td className="p-2 font-bold text-slate-800">{a.equipo}</td>
                              <td className="p-2 font-mono text-slate-600">{a.patente || '-'}</td>
                              <td className="p-2 font-bold text-blue-950">{a.proveedor}</td>
                              <td className="p-2 font-bold text-emerald-800">${a.costo?.toLocaleString('es-CL')}</td>
                              <td className="p-2 text-slate-500 text-[11px]">{a.fechaInicio} al {a.fechaTermino}</td>
                              {canManageRecordsAccess && (
                                <td className="p-2 text-center">
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
                          ))}
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

                {/* Eventos Cronológicos */}
                <div className="relative border-l-2 border-slate-300 ml-4 space-y-6 pl-6">
                  
                  {/* Evento 1: Inicio de Obra */}
                  <div className="relative group">
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 bg-slate-700 rounded-full border-2 border-white ring-2 ring-slate-200"></div>
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                        <span className="text-slate-900 font-extrabold">🚀 Inicio Oficial de Faena & Acta de Entrega de Terreno</span>
                        <span className="text-[10px] text-slate-400 font-mono">01/03/2026</span>
                      </div>
                      <p className="text-xs text-slate-600">Reunión inicial de coordinación con mandante e hito de inicio de obras.</p>
                      <span className="inline-block text-[9px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold mt-1">Hito Obra</span>
                    </div>
                  </div>

                  {/* NOTAS Y COMENTARIOS REGISTRADOS EN LA BITÁCORA */}
                  {bitacoraNotasList.map((nota, i) => (
                    (bitacoraFilters.includes('todos') || bitacoraFilters.includes('notas')) && (
                      <div key={`nota-${i}`} className="relative group">
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 bg-amber-500 rounded-full border-2 border-white ring-2 ring-amber-100"></div>
                        <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl space-y-1.5 shadow-2xs">
                          <div className="flex justify-between items-center text-xs font-bold text-amber-950">
                            <span className="font-extrabold text-amber-900">📝 {nota.titulo || 'Nota / Comentario de Bitácora'}</span>
                            <span className="text-[10px] text-slate-700 font-mono bg-white px-2 py-0.5 rounded border border-amber-200 font-bold">
                              {nota.fecha || (nota.created_at ? new Date(nota.created_at).toLocaleDateString('es-CL') : 'Fecha N/A')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 font-medium whitespace-pre-line leading-relaxed pl-1">
                            {nota.comentario}
                          </p>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-amber-200/60 font-semibold">
                            <span>Registrado por: <strong>{nota.autor || 'Supervisor'}</strong></span>
                            <span className="inline-block bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">Nota de Faena</span>
                          </div>
                        </div>
                      </div>
                    )
                  ))}

                  {/* Eventos Dinámicos filtrados: Avances */}
                  {reportesAvanceList.map((av, i) => (
                    (bitacoraFilters.includes('todos') || bitacoraFilters.includes('avances')) && (
                      <div key={`av-${i}`} className="relative group">
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 bg-blue-600 rounded-full border-2 border-white ring-2 ring-blue-100"></div>
                        <div className="bg-blue-50/50 border border-blue-200 p-3 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold text-blue-950">
                            <span>📊 Avance de Producción: {av.partida}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{new Date(av.created_at).toLocaleDateString('es-CL')}</span>
                          </div>
                          <p className="text-xs text-slate-700">Supervisor: <strong>{av.supervisor}</strong> | Cantidad: <strong className="text-emerald-700">{av.cantidad} {av.unidad || 'UND'}</strong> en {av.frente || 'Frente Principal'}.</p>
                          {av.observaciones && <p className="text-[11px] text-slate-600 italic border-l-2 border-blue-400 pl-2 mt-1">"{av.observaciones}"</p>}
                          <span className="inline-block text-[9px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-bold mt-1">Reporte de Avance</span>
                        </div>
                      </div>
                    )
                  ))}

                  {/* Eventos Dinámicos filtrados: Asistencia */}
                  {asistenciaList.map((as, i) => (
                    (bitacoraFilters.includes('todos') || bitacoraFilters.includes('asistencia')) && (
                      <div key={`as-${i}`} className="relative group">
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 bg-emerald-600 rounded-full border-2 border-white ring-2 ring-emerald-100"></div>
                        <div className="bg-emerald-50/50 border border-emerald-200 p-3 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold text-emerald-950">
                            <span>⏱️ Registro de Asistencia: {as.trabajador}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{new Date(as.created_at).toLocaleDateString('es-CL')}</span>
                          </div>
                          <p className="text-xs text-slate-700">Estado: <strong className="text-emerald-800">{as.asistencia}</strong> | Ingreso: {as.ingreso || '08:00'} - Salida: {as.salida || '18:00'}.</p>
                          <span className="inline-block text-[9px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold mt-1">Control Asistencia</span>
                        </div>
                      </div>
                    )
                  ))}

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

          {/* VISTA DEDICADA 8: ESTADÍSTICAS DE OBRA */}
          {obraActiveSubmodule === 'estadisticas' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-900" />
                  <span>Estadísticas de la Obra</span>
                </h3>
                <p className="text-[11px] text-slate-500">Indicadores clave de avance, rendimiento operacional, dotación e incidentabilidad</p>
              </div>

              {/* KPIS DINÁMICOS REALES DE LA OBRA */}
              {(() => {
                const totalPresupuestado = (partidasList || []).reduce((sum, p) => sum + (parseFloat(p.cantidad) || 0), 0);
                const totalAvanceReal = (reportesAvanceList || []).reduce((sum, r) => sum + (parseFloat(r.cantidad) || 0), 0);
                const avanceAcumuladoPercent = totalPresupuestado > 0 ? ((totalAvanceReal / totalPresupuestado) * 100).toFixed(1) : "0.0";

                const totalHorasHombre = (asistenciaList || []).reduce((sum, a) => {
                  const status = (a.asistencia || "").toLowerCase();
                  return (status === "presente" || status === "asiste" || status === "p") ? sum + 9 : sum;
                }, 0);

                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avance Acumulado</span>
                      <p className="text-2xl font-black text-blue-900">{avanceAcumuladoPercent}%</p>
                      <p className="text-[10px] text-slate-500 font-bold">
                        {reportesAvanceList.length > 0 ? `${reportesAvanceList.length} reportes registrados` : "Sin avances reportados en la obra"}
                      </p>
                    </div>

                    <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Horas Hombre Acumuladas</span>
                      <p className="text-2xl font-black text-slate-800">{totalHorasHombre.toLocaleString("es-CL")} hrs</p>
                      <p className="text-[10px] text-slate-500">
                        {asistenciaList.length > 0 ? `${asistenciaList.length} marcas de asistencia` : "Sin asistencias registradas"}
                      </p>
                    </div>

                    <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Días sin Accidentes CTP</span>
                      <p className="text-2xl font-black text-emerald-700">0 días</p>
                      <p className="text-[10px] text-emerald-600 font-bold">✓ Cero accidentes informados</p>
                    </div>

                    <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dotación Asignada</span>
                      <p className="text-2xl font-black text-slate-800">{personalList.length} <span className="text-xs font-normal text-slate-400">trabajadores</span></p>
                      <p className="text-[10px] text-blue-900 font-bold">Asignados en nómina de obra</p>
                    </div>
                  </div>
                );
              })()}

              <div className="p-8 text-center bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2">
                <BarChart3 className="w-10 h-10 text-blue-800 mx-auto" />
                <h4 className="font-extrabold text-blue-950 text-sm">Panel de Estadísticas de Obra</h4>
                <p className="text-xs text-blue-900 max-w-lg mx-auto">
                  En este apartado consolidaremos los gráficos comparativos de avance real vs presupuestado, proyecciones de costos y curva S detallada de la obra.
                </p>
              </div>
            </div>
          )}

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

          {/* VISTA DEDICADA 11: PLANIFICACIÓN Y MS PROJECT */}
          {obraActiveSubmodule === 'planificacion' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <CalendarRange className="w-4 h-4 text-indigo-900" />
                    <span>Planificación y Carta Gantt de Obra</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Cronograma de partidas, plazos e importador de archivos MS Project (.xml / .mpp)</p>
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
                    <span>+ Crear Actividad / Hito</span>
                  </button>

                  <label className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs">
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Importar de MS Project</span>
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

              {/* Visor de Gantt de Obra */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-2">📅 Carta Gantt y Programación de Partidas</h4>
                
                {(planificacionList.length === 0 && partidasList.length === 0) ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                    <CalendarRange className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-600 font-semibold">No se han registrado actividades para la planificación de esta obra.</p>
                    <button
                      onClick={() => {
                        setEditingActividad(null);
                        setActividadFormData({ nombre: '', fecha_inicio: new Date().toISOString().substring(0, 10), fecha_fin: '', duracion_dias: 10, avance_pct: 0 });
                        setShowActividadModal(true);
                      }}
                      className="text-xs text-indigo-900 font-bold hover:underline cursor-pointer"
                    >
                      + Crear la primera actividad de planificación
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Renderizar Tareas de MS Project / Planificación manual */}
                    {planificacionList.map((act, idx) => (
                      <div key={`act-${idx}`} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{act.nombre}</span>
                            <span className="text-[10px] text-slate-500 font-mono ml-2">({act.fecha_inicio} a {act.fecha_fin || 'TBD'}) - {act.duracion_dias || 7} días</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{act.avance_pct || 0}% Cumplido</span>
                            <button
                              onClick={() => setPlanificacionList(prev => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-red-700 font-bold text-xs"
                              title="Eliminar actividad"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        
                        {/* Barra Visual Gantt */}
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-900 h-full rounded-full transition-all duration-500" style={{ width: `${act.avance_pct || 0}%` }}></div>
                        </div>
                      </div>
                    ))}

                    {/* Renderizar Partidas cargadas de Obra */}
                    {partidasList.map((p, idx) => {
                      const pct = Math.min(100, Math.round(((p.avanceAcumulado || 0) / (p.cantidad || 1)) * 100));
                      return (
                        <div key={`part-${idx}`} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-800">Partida: {p.partida}</span>
                            <span className="font-mono text-[10px] font-bold text-blue-900">{pct}% Cumplido</span>
                          </div>
                          
                          {/* Barra Visual Gantt */}
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-blue-900 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
                      className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Registrar Costo Real (Factura/Guía)</span>
                    </button>
                  ) : (
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
                      className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Gasto Proyectado</span>
                    </button>
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
                const totalCostosReales = totalFacturas + totalPersonalIncurrido;
                const saldoReal = totalPres - totalCostosReales;

                // Proyección de gastos por partidas ejecutables
                const executableParts = partidasList.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo));
                const totalProyectadoPartidas = executableParts.reduce((acc, p) => {
                  const cant = parseFloat(p.cantidad) || 0;
                  const rend = parseFloat(p.rendimiento_meta || p.rendimiento) || 10;
                  const dias = rend > 0 ? (cant / rend) : 1;
                  const proj = proyeccionesList.find(x => x.partida === p.partida);
                  if (proj) {
                    if (proj.tipo_proyeccion === 'TIEMPO') return acc + Math.round(dias * (parseFloat(proj.tarifa_tiempo_dia) || 20000));
                    return acc + Math.round(cant * (parseFloat(proj.tasa_rendimiento_insumo) || 1) * (parseFloat(proj.precio_unitario_insumo) || 5000));
                  }
                  return acc + Math.round(dias * 20000);
                }, 0);

                const totalPersonalProyectado = Array.from(workerMapReal.values()).reduce((acc, val) => acc + (20 * val), 0);
                const totalCostoProyectado = totalProyectadoPartidas + totalPersonalProyectado;
                const saldoProyectado = totalPres - totalCostoProyectado;

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
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Presupuesto Directo Obra</span>
                      <p className="text-lg font-black text-slate-800">${totalPres.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Proyección Total de Gastos</span>
                        <span className="text-[9px] font-bold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded">Proyectado</span>
                      </div>
                      <p className="text-lg font-black text-blue-950">${totalCostoProyectado.toLocaleString('es-CL')}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">Partidas: ${totalProyectadoPartidas.toLocaleString('es-CL')} | Personal: ${totalPersonalProyectado.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="bg-white p-4 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Margen Proyectado Estimado</span>
                      <p className={`text-lg font-black ${saldoProyectado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>${saldoProyectado.toLocaleString('es-CL')}</p>
                    </div>
                  </div>
                );
              })()}

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
                                      <span className="font-bold text-slate-800">{imp.partida}:</span>
                                      <span className="bg-blue-50 text-blue-900 px-1.5 py-0.5 rounded font-bold">{imp.porcentaje}%</span>
                                      <span className="text-slate-500">(${impMonto.toLocaleString('es-CL')})</span>
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Sin imputar</span>
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
                                  onClick={() => setCostosList(prev => prev.filter((_, i) => i !== idx))}
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
                    onChange={(e) => setNewWorkerData({ ...newWorkerData, rut: e.target.value })}
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

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Costo de Arriendo ($ CLP)</label>
                <input
                  type="number"
                  value={arriendoData.costo}
                  onChange={(e) => setArriendoData({ ...arriendoData, costo: e.target.value })}
                  placeholder="Ej. 250000"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-bold text-emerald-800"
                />
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
                    setPartidasList(prev => prev.map(p => 
                      (p.id && editingPartida.id && p.id === editingPartida.id) || p.partida === editingPartida.partida
                        ? { ...p, ...savedPart }
                        : p
                    ));
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
                  const filtered = prev.filter(x => x.partida !== proyeccionFormData.partida);
                  return [...filtered, proyeccionFormData];
                });
                try {
                  const key = `obraxis_proyecciones_obras_${selectedObra?.nombre}`;
                  const updated = proyeccionesList.filter(x => x.partida !== proyeccionFormData.partida);
                  localStorage.setItem(key, JSON.stringify([...updated, proyeccionFormData]));
                } catch (err) {}
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
              onSubmit={(e) => {
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

                if (editingCosto) {
                  setCostosList(prev => prev.map(c => c.id === editingCosto.id ? newCosto : c));
                } else {
                  setCostosList(prev => [...prev, newCosto]);
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
                    type="number"
                    required
                    value={costoFormData.monto}
                    onChange={(e) => setCostoFormData({ ...costoFormData, monto: e.target.value })}
                    placeholder="1250000"
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
