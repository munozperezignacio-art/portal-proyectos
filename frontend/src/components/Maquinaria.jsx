import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Truck, ArrowLeft, Search, Plus, Edit, Trash2, Loader2, AlertCircle, Check, 
  Building2, Eye, Camera, Image, Calendar, Clock, Gauge, Fuel, CheckCircle2, 
  ChevronRight, Wrench, ShieldCheck, MapPin, CalendarDays, RefreshCw, Send, Handshake, DollarSign
} from 'lucide-react';

export default function Maquinaria({ user, onBack }) {
  const [activeSection, setActiveSection] = useState(''); // '', 'inventario', 'asignaciones', 'uso', 'reservas', 'arriendos'
  const [maquinaria, setMaquinaria] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObraFilter, setSelectedObraFilter] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Estados Modal Registro / Edición Equipo
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingEquip, setEditingEquip] = useState(null);
  const [viewingEquip, setViewingEquip] = useState(null);

  const [formData, setFormData] = useState({
    tipo: 'Retroexcavadora',
    patente: '',
    marca: '',
    obra_nombre: '',
    horometro_inicial: '0',
    tipo_activo: 'Propio',
    estado_equipo: 'Operativo',
    foto_frontal: '',
    foto_izquierda: '',
    foto_derecha: '',
    foto_posterior: ''
  });

  // 2. Estados Asignación Directa de Equipos
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedEquipToAssign, setSelectedEquipToAssign] = useState(null);
  const [targetObraName, setTargetObraName] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  // 3. Estados Registro de Uso y Horómetros
  const [usoList, setUsoList] = useState([]);
  const [usoModalOpen, setUsoModalOpen] = useState(false);
  const [usoForm, setUsoForm] = useState({
    equipo_id: '',
    equipo_patente: '',
    obra_nombre: '',
    fecha: new Date().toISOString().split('T')[0],
    horometro_inicial: '',
    horometro_final: '',
    combustible_cargado: '0',
    operador: '',
    observaciones: ''
  });

  // 4. Estados Reserva y Disponibilidad Futura (Texto Libre de Obra)
  const [reservasList, setReservasList] = useState([]);
  const [reservaModalOpen, setReservaModalOpen] = useState(false);
  const [reservaForm, setReservaForm] = useState({
    equipo_id: '',
    obra_destino_custom: '', // Permite nombre de obra futura personalizada sin restricción de base de datos
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    solicitante: user?.nombre || user?.usuario || 'Administrador Obraxis',
    proposito: ''
  });

  // 5. Estados Arriendos a Terceros
  const [arriendosList, setArriendosList] = useState([]);
  const [arriendoModalOpen, setArriendoModalOpen] = useState(false);
  const [arriendoForm, setArriendoForm] = useState({
    equipo_id: '',
    empresa_arrendataria: '',
    tarifa_diaria: '0',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    contacto_responsable: '',
    observaciones: ''
  });

  useEffect(() => {
    fetchData();
    fetchUsoLogs();
    fetchReservasLogs();
    fetchArriendosLogs();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dataMaq, error: errMaq } = await supabase
        .from('inventario_maquinaria')
        .select('*')
        .eq('empresa', user.empresa)
        .order('tipo', { ascending: true });
      if (errMaq) throw errMaq;
      setMaquinaria(dataMaq || []);

      const { data: dataObras, error: errObras } = await supabase
        .from('obras')
        .select('nombre')
        .eq('empresa', user.empresa)
        .order('nombre', { ascending: true });
      if (errObras) throw errObras;
      setObras(dataObras || []);
    } catch (err) {
      console.warn('Cargando inventario local:', err.message);
      const local = localStorage.getItem('obraxis_inventario_maquinaria');
      if (local) {
        try { setMaquinaria(JSON.parse(local)); } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUsoLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('maquinaria_uso_diario')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setUsoList(data);
      } else {
        const local = localStorage.getItem('obraxis_maquinaria_uso');
        if (local) setUsoList(JSON.parse(local));
      }
    } catch (e) {
      const local = localStorage.getItem('obraxis_maquinaria_uso');
      if (local) try { setUsoList(JSON.parse(local)); } catch (err) {}
    }
  };

  const fetchReservasLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('maquinaria_reservas')
        .select('*')
        .order('fecha_inicio', { ascending: true });
      if (!error && data) {
        setReservasList(data);
      } else {
        const local = localStorage.getItem('obraxis_maquinaria_reservas');
        if (local) setReservasList(JSON.parse(local));
      }
    } catch (e) {
      const local = localStorage.getItem('obraxis_maquinaria_reservas');
      if (local) try { setReservasList(JSON.parse(local)); } catch (err) {}
    }
  };

  const fetchArriendosLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('maquinaria_arriendos')
        .select('*')
        .order('fecha_inicio', { ascending: false });
      if (!error && data) {
        setArriendosList(data);
      } else {
        const local = localStorage.getItem('obraxis_maquinaria_arriendos');
        if (local) setArriendosList(JSON.parse(local));
      }
    } catch (e) {
      const local = localStorage.getItem('obraxis_maquinaria_arriendos');
      if (local) try { setArriendosList(JSON.parse(local)); } catch (err) {}
    }
  };

  // 1. Handlers Formulario Inventario Equipo
  const handleOpenAddModal = () => {
    setEditingEquip(null);
    setFormData({
      tipo: 'Retroexcavadora',
      patente: '',
      marca: '',
      obra_nombre: obras.length > 0 ? obras[0].nombre : 'Bodega Central / Libre',
      horometro_inicial: '0',
      tipo_activo: 'Propio',
      estado_equipo: 'Operativo',
      foto_frontal: '',
      foto_izquierda: '',
      foto_derecha: '',
      foto_posterior: ''
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (equip) => {
    setEditingEquip(equip);
    setFormData({
      tipo: equip.tipo || 'Retroexcavadora',
      patente: equip.patente || '',
      marca: equip.marca || '',
      obra_nombre: equip.obra_nombre || 'Bodega Central / Libre',
      horometro_inicial: equip.horometro_inicial ? equip.horometro_inicial.toString() : '0',
      tipo_activo: equip.tipo_activo || 'Propio',
      estado_equipo: equip.estado_equipo || 'Operativo',
      foto_frontal: equip.foto_frontal || '',
      foto_izquierda: equip.foto_izquierda || '',
      foto_derecha: equip.foto_derecha || '',
      foto_posterior: equip.foto_posterior || ''
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleDeleteEquip = async (equip) => {
    if (!window.confirm(`¿Estás seguro de eliminar el equipo ${equip.tipo} (${equip.patente})?`)) return;

    try {
      const { error } = await supabase.from('inventario_maquinaria').delete().eq('id', equip.id);
      if (error) throw error;
      setSuccessMsg('Equipo eliminado.');
      fetchData();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const handleSubmitEquip = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    // Validar FK de obra_nombre
    const matchedObra = obras.find(o => o.nombre.toLowerCase() === (formData.obra_nombre || '').toLowerCase());
    const validObraNombre = matchedObra ? matchedObra.nombre : null;

    const dataToSave = {
      tipo: formData.tipo,
      patente: formData.patente.toUpperCase().trim(),
      marca: formData.marca.trim(),
      obra_nombre: validObraNombre,
      horometro_inicial: parseFloat(formData.horometro_inicial) || 0,
      tipo_activo: formData.tipo_activo,
      estado_equipo: formData.estado_equipo,
      foto_frontal: formData.foto_frontal || null,
      foto_izquierda: formData.foto_izquierda || null,
      foto_derecha: formData.foto_derecha || null,
      foto_posterior: formData.foto_posterior || null,
      registrado_por: user.usuario,
      empresa: user.empresa
    };

    try {
      let payload = { ...dataToSave };
      let attempts = 0;
      let success = false;
      let lastError = null;

      while (attempts < 10 && !success) {
        attempts++;
        const res = editingEquip
          ? await supabase.from("inventario_maquinaria").update(payload).eq("id", editingEquip.id)
          : await supabase.from("inventario_maquinaria").insert([payload]);

        if (!res.error) {
          success = true;
          break;
        }

        lastError = res.error;
        const msg = res.error.message || "";

        const match = msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column "([^"]+)"/i);
        if (match && match[1] && payload[match[1]] !== undefined) {
          delete payload[match[1]];
        } else {
          if (payload.registrado_por !== undefined) delete payload.registrado_por;
          else if (payload.tipo_activo !== undefined) delete payload.tipo_activo;
          else if (payload.estado_equipo !== undefined) delete payload.estado_equipo;
          else if (payload.foto_frontal !== undefined) delete payload.foto_frontal;
          else if (payload.foto_izquierda !== undefined) delete payload.foto_izquierda;
          else if (payload.foto_derecha !== undefined) delete payload.foto_derecha;
          else if (payload.foto_posterior !== undefined) delete payload.foto_posterior;
          else break;
        }
      }

      if (!success && lastError) throw lastError;
      setSuccessMsg(editingEquip ? "Ficha de equipo actualizada." : "Equipo registrado exitosamente.");

      fetchData();
      setTimeout(() => setModalOpen(false), 1200);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // 2. Handler Asignación Directa de Obra
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEquipToAssign) return;

    setModalLoading(true);
    try {
      const matchedObra = obras.find(o => o.nombre.toLowerCase() === (targetObraName || '').toLowerCase());
      const validTargetName = matchedObra ? matchedObra.nombre : null;

      let updatePayload = { obra_nombre: validTargetName };
      let { error } = await supabase
        .from('inventario_maquinaria')
        .update(updatePayload)
        .eq('id', selectedEquipToAssign.id);

      if (error) throw error;

      setSuccessMsg(`¡Equipo ${selectedEquipToAssign.patente} asignado a ${targetObraName || 'Bodega Central / Libre'}!`);
      fetchData();
      setAssignModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('Error en asignación: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // 3. Handler Registro de Uso y Horómetros
  const handleUsoSubmit = async (e) => {
    e.preventDefault();
    if (!usoForm.equipo_id) {
      alert('Seleccione un equipo.');
      return;
    }

    const hIni = parseFloat(usoForm.horometro_inicial) || 0;
    const hFin = parseFloat(usoForm.horometro_final) || 0;
    const hrsTrabajadas = Math.max(0, hFin - hIni);

    const eq = maquinaria.find(m => m.id.toString() === usoForm.equipo_id.toString());

    const newLog = {
      equipo_id: usoForm.equipo_id,
      equipo_tipo: eq ? eq.tipo : 'Equipo',
      equipo_patente: eq ? eq.patente : usoForm.equipo_patente,
      obra_nombre: eq ? (eq.obra_nombre || 'Bodega Central / Libre') : usoForm.obra_nombre,
      fecha: usoForm.fecha,
      horometro_inicial: hIni,
      horometro_final: hFin,
      horas_trabajadas: hrsTrabajadas,
      combustible_cargado: parseFloat(usoForm.combustible_cargado) || 0,
      operador: usoForm.operador || user?.nombre || user?.usuario,
      observaciones: usoForm.observaciones,
      empresa: user?.empresa || 'EMIN',
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('maquinaria_uso_diario').insert([newLog]);
      if (error) throw error;
      setSuccessMsg('Registro de uso y horómetro guardado.');
      fetchUsoLogs();
    } catch (err) {
      const updated = [newLog, ...usoList];
      setUsoList(updated);
      localStorage.setItem('obraxis_maquinaria_uso', JSON.stringify(updated));
      setSuccessMsg('Registro de uso guardado localmente.');
    } finally {
      setUsoModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // 4. Handler Reserva de Equipo (Acepta nombre de obra futura personalizada)
  const handleReservaSubmit = async (e) => {
    e.preventDefault();
    if (!reservaForm.equipo_id || !reservaForm.obra_destino_custom.trim()) {
      alert('Por favor especifique la obra futura o proyecto en licitación.');
      return;
    }

    const eq = maquinaria.find(m => m.id.toString() === reservaForm.equipo_id.toString());

    const newReserva = {
      equipo_id: reservaForm.equipo_id,
      equipo_tipo: eq ? eq.tipo : 'Equipo',
      equipo_patente: eq ? eq.patente : 'N/A',
      obra_destino: reservaForm.obra_destino_custom.trim(), // Nombre libre de proyecto futuro
      fecha_inicio: reservaForm.fecha_inicio,
      fecha_fin: reservaForm.fecha_fin,
      solicitante: reservaForm.solicitante,
      proposito: reservaForm.proposito,
      estado: 'Confirmada',
      empresa: user?.empresa || 'EMIN',
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('maquinaria_reservas').insert([newReserva]);
      if (error) throw error;
      setSuccessMsg('Reserva agendada exitosamente.');
      fetchReservasLogs();
    } catch (err) {
      const updated = [newReserva, ...reservasList];
      setReservasList(updated);
      localStorage.setItem('obraxis_maquinaria_reservas', JSON.stringify(updated));
      setSuccessMsg('Reserva de obra futura guardada.');
    } finally {
      setReservaModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // 5. Handler Arriendos a Terceros
  const handleArriendoSubmit = async (e) => {
    e.preventDefault();
    if (!arriendoForm.equipo_id || !arriendoForm.empresa_arrendataria.trim()) {
      alert('Ingrese la empresa arrendataria y seleccione el equipo.');
      return;
    }

    const eq = maquinaria.find(m => m.id.toString() === arriendoForm.equipo_id.toString());

    const newArriendo = {
      equipo_id: arriendoForm.equipo_id,
      equipo_tipo: eq ? eq.tipo : 'Equipo',
      equipo_patente: eq ? eq.patente : 'N/A',
      empresa_arrendataria: arriendoForm.empresa_arrendataria.trim(),
      tarifa_diaria: parseFloat(arriendoForm.tarifa_diaria) || 0,
      fecha_inicio: arriendoForm.fecha_inicio,
      fecha_fin: arriendoForm.fecha_fin,
      contacto_responsable: arriendoForm.contacto_responsable,
      observaciones: arriendoForm.observaciones,
      estado: 'Activo',
      empresa: user?.empresa || 'EMIN',
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('maquinaria_arriendos').insert([newArriendo]);
      if (error) throw error;
      setSuccessMsg('Contrato de arriendo registrado con éxito.');
      fetchArriendosLogs();
    } catch (err) {
      const updated = [newArriendo, ...arriendosList];
      setArriendosList(updated);
      localStorage.setItem('obraxis_maquinaria_arriendos', JSON.stringify(updated));
      setSuccessMsg('Arriendo guardado localmente.');
    } finally {
      setArriendoModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Helper para determinar el estado de disponibilidad real del equipo
  const getEquipoEstadoDetallado = (equip) => {
    const isEnUso = Boolean(equip.obra_nombre && equip.obra_nombre.trim() !== '');
    const isReservado = reservasList.some(r => r.equipo_id.toString() === equip.id.toString());
    const isArrendado = arriendosList.some(a => a.equipo_id.toString() === equip.id.toString() && a.estado === 'Activo');

    if (isArrendado) {
      return { code: 'arrendado', label: 'Arrendado a Tercero', badgeClass: 'bg-purple-100 text-purple-900 border-purple-200' };
    }
    if (isEnUso) {
      return { code: 'en_uso', label: `En Uso (${equip.obra_nombre})`, badgeClass: 'bg-amber-100 text-amber-900 border-amber-200' };
    }
    if (isReservado) {
      return { code: 'reservado', label: 'Reservado (Futuro)', badgeClass: 'bg-blue-100 text-blue-900 border-blue-200' };
    }
    return { code: 'libre', label: 'Disponible / Sin Reserva', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
  };

  // Filtrado de Inventario
  const filteredMaquinaria = maquinaria.filter(m => {
    const matchesSearch = 
      (m.tipo && m.tipo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.patente && m.patente.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.marca && m.marca.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesObra = 
      selectedObraFilter === '' || 
      (m.obra_nombre && m.obra_nombre.toLowerCase() === selectedObraFilter.toLowerCase());

    return matchesSearch && matchesObra;
  });

  const tiposMaquinaria = [
    'Retroexcavadora', 'Excavadora', 'Camión Tolva', 'Cargador Frontal', 
    'Rodillo Compactador', 'Minibuses / Camionetas', 'Generador / Torre Luz', 'Otro'
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 font-sans">
      
      {/* 1. Encabezado Oficial Estándar Obraxis */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-xs mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (activeSection !== '') {
                setActiveSection('');
                setSuccessMsg('');
                setErrorMsg('');
              } else {
                onBack();
              }
            }} 
            className="p-2 hover:bg-slate-100 rounded-xl transition cursor-pointer" 
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Truck className="w-6 h-6 text-primary shrink-0" />
              <span>Gestión de Maquinaria y Equipos</span>
            </h2>
            <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5 tracking-wider">
              INVENTARIO, ASIGNACIONES EN FAENA, HORÓMETROS, RESERVAS DE OBRAS FUTURAS Y ARRIENDOS A TERCEROS
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSection !== '' && (
            <button
              onClick={() => setActiveSection('')}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer border border-slate-200"
            >
              <span>← Menú Principal</span>
            </button>
          )}
          <button
            onClick={handleOpenAddModal}
            className="bg-primary hover:bg-primary-hover text-white text-xs font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Ingresar Nuevo Equipo</span>
          </button>
        </div>
      </div>

      {/* Alertas Globales */}
      {successMsg && <div className="mb-6 bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold border border-emerald-250 animate-in fade-in duration-150">{successMsg}</div>}
      {errorMsg && <div className="mb-6 bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-semibold border border-red-250 animate-in fade-in duration-150">{errorMsg}</div>}

      {/* 2. MENÚ PRINCIPAL DE SUBMÓDULOS DE MAQUINARIA (5 TARJETAS) */}
      {activeSection === '' && (
        <>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            SUBMÓDULOS DE MAQUINARIA Y EQUIPOS
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 animate-in fade-in duration-200">
            
            {/* Tarjeta 1: Maquinarias y Equipos */}
            <div 
              onClick={() => setActiveSection('inventario')}
              className="group bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[190px]"
            >
              <div className="flex items-start justify-between">
                <div className="p-3.5 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <Truck className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">{maquinaria.length} Flota</span>
              </div>
              <div className="space-y-1 mt-3">
                <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wider group-hover:text-primary transition">
                  Maquinarias y Equipos
                </h3>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Catálogo e inventario de flota propia y arrendada con fichas técnicas.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-extrabold text-primary group-hover:text-primary-hover">
                <span>Ver Inventario</span>
                <ChevronRight className="w-3.5 h-3.5 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>

            {/* Tarjeta 2: Asignación de Equipos */}
            <div 
              onClick={() => setActiveSection('asignaciones')}
              className="group bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-blue-600 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[190px]"
            >
              <div className="flex items-start justify-between">
                <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase">Faenas</span>
              </div>
              <div className="space-y-1 mt-3">
                <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wider group-hover:text-blue-600 transition">
                  Asignación de Equipos
                </h3>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Asignación directa y transferencias hacia obras activas.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-extrabold text-blue-600 group-hover:text-blue-700">
                <span>Gestionar Asignación</span>
                <ChevronRight className="w-3.5 h-3.5 text-blue-600 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>

            {/* Tarjeta 3: Uso de Equipos */}
            <div 
              onClick={() => setActiveSection('uso')}
              className="group bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-emerald-600 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[190px]"
            >
              <div className="flex items-start justify-between">
                <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <Gauge className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">{usoList.length} Registros</span>
              </div>
              <div className="space-y-1 mt-3">
                <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wider group-hover:text-emerald-600 transition">
                  Uso de Equipos
                </h3>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Horómetros diarios, horas trabajadas y consumo de combustible.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-extrabold text-emerald-600 group-hover:text-emerald-700">
                <span>Registrar Horómetro</span>
                <ChevronRight className="w-3.5 h-3.5 text-emerald-600 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>

            {/* Tarjeta 4: Reserva y Disponibilidad */}
            <div 
              onClick={() => setActiveSection('reservas')}
              className="group bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-purple-600 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[190px]"
            >
              <div className="flex items-start justify-between">
                <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 uppercase">{reservasList.length} Reservas</span>
              </div>
              <div className="space-y-1 mt-3">
                <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wider group-hover:text-purple-600 transition">
                  Reserva y Disponibilidad
                </h3>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Agenda de obras futuras (proyectos/licitaciones) y estado (*En Uso, Reservado, Libre*).
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-extrabold text-purple-600 group-hover:text-purple-700">
                <span>Agenda Futura</span>
                <ChevronRight className="w-3.5 h-3.5 text-purple-600 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>

            {/* Tarjeta 5: Arriendos a Terceros */}
            <div 
              onClick={() => setActiveSection('arriendos')}
              className="group bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-amber-600 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[190px]"
            >
              <div className="flex items-start justify-between">
                <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                  <Handshake className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">{arriendosList.length} Contratos</span>
              </div>
              <div className="space-y-1 mt-3">
                <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wider group-hover:text-amber-600 transition">
                  Arriendos a Terceros
                </h3>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Gestión de equipos prestados o arrendados a otras empresas y subcontratos.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-extrabold text-amber-600 group-hover:text-amber-700">
                <span>Ver Arriendos</span>
                <ChevronRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>

          </div>
        </>
      )}

      {/* 3. SUBMÓDULO 1: INVENTARIO DE MAQUINARIAS Y EQUIPOS */}
      {activeSection === 'inventario' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Inventario de Equipos y Maquinarias</h3>
              <p className="text-xs text-slate-500">Listado de flota propia y arrendada con fichas operacionales.</p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="bg-primary hover:bg-primary-hover text-white text-xs font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Equipo</span>
            </button>
          </div>

          {/* Filtros */}
          <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por tipo, patente o marca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-slate-800 font-medium w-full px-3.5 py-2.5 border rounded-xl border-slate-200 focus:outline-none focus:border-primary transition text-xs"
              />
            </div>

            <div>
              <select
                value={selectedObraFilter}
                onChange={(e) => setSelectedObraFilter(e.target.value)}
                className="text-slate-800 font-medium w-full px-3.5 py-2.5 border rounded-xl border-slate-200 focus:outline-none focus:border-primary transition text-xs bg-white"
              >
                <option value="">Filtrar por obra (Todas)</option>
                {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Grid de Equipos */}
          {loading ? (
            <p className="text-xs text-slate-500 p-4">⏳ Cargando catálogo de equipos...</p>
          ) : filteredMaquinaria.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-400">
              <Truck className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">No se encontraron equipos registrados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMaquinaria.map((m) => {
                const est = getEquipoEstadoDetallado(m);
                return (
                  <div 
                    key={m.id} 
                    className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-primary transition duration-200"
                  >
                    <div className="p-5 flex gap-4">
                      <div className="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {m.foto_frontal ? (
                          <img src={m.foto_frontal} alt={m.tipo} className="w-full h-full object-cover" />
                        ) : (
                          <Truck className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full inline-block border ${est.badgeClass}`}>
                            {est.label}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Horómetro: {m.horometro_inicial || 0} hrs
                          </span>
                        </div>

                        <h4 className="text-xs font-extrabold text-slate-850 uppercase leading-snug">{m.tipo}</h4>
                        <p className="text-[11px] text-slate-500 font-semibold">{m.marca} | Patente: <span className="text-slate-700 font-bold">{m.patente || 'N/A'}</span></p>
                        
                        <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{m.obra_nombre || 'Bodega Central / Libre'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-between items-center text-xs">
                      <button
                        onClick={() => setViewingEquip(m)}
                        className="text-slate-600 hover:text-primary font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ficha Completa</span>
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEditModal(m)}
                          className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
                          title="Editar Equipo"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEquip(m)}
                          className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition cursor-pointer"
                          title="Eliminar Equipo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. SUBMÓDULO 2: ASIGNACIÓN DE EQUIPOS */}
      {activeSection === 'asignaciones' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Asignación Directa a Obras Activas</h3>
              <p className="text-xs text-slate-500">Selecciona maquinaria y asigna su ubicación en faena.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {maquinaria.map(m => {
              const est = getEquipoEstadoDetallado(m);
              return (
                <div key={m.id} className="p-5 rounded-3xl border border-slate-200 bg-white space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className={`text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase ${est.badgeClass}`}>
                      {est.label}
                    </span>
                    <span className="text-[10.5px] font-bold text-slate-700">Patente: {m.patente || 'S/I'}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Obra Actual: <span className="text-primary">{m.obra_nombre || 'Bodega Central / Libre'}</span></p>
                    <p className="text-[10px] text-slate-400">Tipo: {m.tipo}</p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedEquipToAssign(m);
                      setTargetObraName(m.obra_nombre || (obras[0] ? obras[0].nombre : ''));
                      setAssignModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Transferir / Asignar Obra</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. SUBMÓDULO 3: USO DE EQUIPOS */}
      {activeSection === 'uso' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Registro Operacional de Horómetros y Combustible</h3>
              <p className="text-xs text-slate-500">Bitácora diaria de horas trabajadas y consumo por equipo.</p>
            </div>
            <button
              onClick={() => {
                setUsoForm({
                  equipo_id: maquinaria[0] ? maquinaria[0].id.toString() : '',
                  equipo_patente: maquinaria[0] ? maquinaria[0].patente : '',
                  obra_nombre: maquinaria[0] ? (maquinaria[0].obra_nombre || 'Bodega Central / Libre') : '',
                  fecha: new Date().toISOString().split('T')[0],
                  horometro_inicial: maquinaria[0] ? (maquinaria[0].horometro_inicial || 0).toString() : '0',
                  horometro_final: '',
                  combustible_cargado: '0',
                  operador: user?.nombre || user?.usuario || '',
                  observaciones: ''
                });
                setUsoModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Horómetro / Uso</span>
            </button>
          </div>

          {usoList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Gauge className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">No hay registros de horómetros en la bitácora.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Equipo / Patente</th>
                    <th className="p-3">Obra</th>
                    <th className="p-3">H. Inicial</th>
                    <th className="p-3">H. Final</th>
                    <th className="p-3">Hrs Operativas</th>
                    <th className="p-3">Combustible</th>
                    <th className="p-3">Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usoList.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 font-medium text-slate-800">
                      <td className="p-3 font-bold text-slate-600">{log.fecha}</td>
                      <td className="p-3 font-bold">{log.equipo_tipo} ({log.equipo_patente})</td>
                      <td className="p-3 text-slate-600">{log.obra_nombre || 'Bodega Central'}</td>
                      <td className="p-3">{log.horometro_inicial} hrs</td>
                      <td className="p-3">{log.horometro_final} hrs</td>
                      <td className="p-3 font-black text-emerald-700">+{log.horas_trabajadas} hrs</td>
                      <td className="p-3">{log.combustible_cargado} Lts</td>
                      <td className="p-3 text-slate-600">{log.operador}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. SUBMÓDULO 4: RESERVA Y DISPONIBILIDAD (CON ESTADOS: EN USO, RESERVADO, SIN RESERVA Y OBRA FUTURA LIBRE) */}
      {activeSection === 'reservas' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Agenda de Reservas y Disponibilidad de Flota</h3>
              <p className="text-xs text-slate-500">Agenda de proyectos futuros/licitaciones y control de estados (*En Uso, Reservado, Sin Reserva*).</p>
            </div>
            <button
              onClick={() => {
                setReservaForm({
                  equipo_id: maquinaria[0] ? maquinaria[0].id.toString() : '',
                  obra_destino_custom: '',
                  fecha_inicio: new Date().toISOString().split('T')[0],
                  fecha_fin: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                  solicitante: user?.nombre || user?.usuario || 'Administrador Obraxis',
                  proposito: ''
                });
                setReservaModalOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              <span>Agendar Reserva Futura</span>
            </button>
          </div>

          {/* MATRIZ DE ESTADOS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* ESTADO 1: EN USO */}
            <div className="bg-amber-50/50 border border-amber-200 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                <span className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  <span>En Uso en Faena</span>
                </span>
                <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                  {maquinaria.filter(m => Boolean(m.obra_nombre && m.obra_nombre.trim() !== '')).length}
                </span>
              </div>
              
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {maquinaria.filter(m => Boolean(m.obra_nombre && m.obra_nombre.trim() !== '')).map(m => (
                  <div key={m.id} className="bg-white p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-xs text-slate-850 uppercase">{m.tipo} ({m.patente})</span>
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">EN FAENA</span>
                    </div>
                    <p className="text-[11px] text-amber-900 font-bold">Obra: {m.obra_nombre}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ESTADO 2: RESERVADO */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                <span className="text-xs font-black text-blue-900 uppercase flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-blue-700" />
                  <span>Reservados (Futuro)</span>
                </span>
                <span className="text-[10px] font-black bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full">
                  {reservasList.length}
                </span>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {reservasList.map((res, idx) => (
                  <div key={idx} className="bg-white p-3.5 rounded-2xl border border-blue-200/80 shadow-2xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-xs text-slate-850 uppercase">{res.equipo_tipo} ({res.equipo_patente})</span>
                      <span className="text-[9px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">{res.fecha_inicio}</span>
                    </div>
                    <p className="text-[11px] text-blue-950 font-bold">Proyecto Futuro: {res.obra_destino}</p>
                    <p className="text-[10px] text-slate-500">Solicita: {res.solicitante}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ESTADO 3: DISPONIBLE / SIN RESERVA */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                <span className="text-xs font-black text-emerald-900 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Disponible / Sin Reserva</span>
                </span>
                <span className="text-[10px] font-black bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                  {maquinaria.filter(m => (!m.obra_nombre || m.obra_nombre.trim() === '') && !reservasList.some(r => r.equipo_id.toString() === m.id.toString())).length}
                </span>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {maquinaria
                  .filter(m => (!m.obra_nombre || m.obra_nombre.trim() === '') && !reservasList.some(r => r.equipo_id.toString() === m.id.toString()))
                  .map(m => (
                    <div key={m.id} className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-xs text-slate-850 uppercase">{m.tipo} ({m.patente})</span>
                        <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">LIBRE</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Ubicación: Bodega Central</p>
                    </div>
                  ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 7. NUEVO SUBMÓDULO 5: ARRIENDOS A TERCEROS */}
      {activeSection === 'arriendos' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Gestión de Arriendos a Terceros y Subcontratos</h3>
              <p className="text-xs text-slate-500">Registro de equipos arrendados a empresas externas con cobro de tarifas y plazos.</p>
            </div>
            <button
              onClick={() => {
                setArriendoForm({
                  equipo_id: maquinaria[0] ? maquinaria[0].id.toString() : '',
                  empresa_arrendataria: '',
                  tarifa_diaria: '0',
                  fecha_inicio: new Date().toISOString().split('T')[0],
                  fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                  contacto_responsable: '',
                  observaciones: ''
                });
                setArriendoModalOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Handshake className="w-4 h-4" />
              <span>Nuevo Contrato de Arriendo</span>
            </button>
          </div>

          {arriendosList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Handshake className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">No hay contratos de arriendo registrados a terceros.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {arriendosList.map((arr, idx) => (
                <div key={idx} className="p-5 rounded-3xl border border-amber-200 bg-amber-50/30 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 uppercase">
                      {arr.equipo_tipo} ({arr.equipo_patente})
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">{arr.fecha_inicio} al {arr.fecha_fin}</span>
                  </div>
                  <h4 className="text-xs font-black text-slate-850 uppercase">Empresa Arrendataria: {arr.empresa_arrendataria}</h4>
                  <p className="text-[11px] text-slate-600">Tarifa Diaria: <b className="text-amber-800">${parseFloat(arr.tarifa_diaria || 0).toLocaleString('es-CL')} /día</b></p>
                  {arr.contacto_responsable && <p className="text-[10px] text-slate-500">Contacto: {arr.contacto_responsable}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL RESERVA DE EQUIPO FUTURO (CON TEXTO LIBRE DE OBRA FUTURA) */}
      {reservaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-purple-600" />
              <span>Agendar Reserva de Obra Futura</span>
            </h3>

            <form onSubmit={handleReservaSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Seleccionar Equipo *</label>
                <select
                  value={reservaForm.equipo_id}
                  onChange={(e) => setReservaForm(prev => ({ ...prev, equipo_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                  required
                >
                  {maquinaria.map(m => (
                    <option key={m.id} value={m.id}>{m.tipo} ({m.patente}) - {m.obra_nombre ? `En Uso: ${m.obra_nombre}` : 'En Bodega'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Nombre Obra Futura / Licitación *</label>
                <input
                  type="text"
                  placeholder="ej: Licitación Puente Chacao / Obra Futura Rancagua"
                  value={reservaForm.obra_destino_custom}
                  onChange={(e) => setReservaForm(prev => ({ ...prev, obra_destino_custom: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                  required
                />
                <span className="text-[9.5px] text-slate-400">Puedes escribir cualquier nombre de obra futura sin requerir que exista en sistema.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Desde *</label>
                  <input
                    type="date"
                    value={reservaForm.fecha_inicio}
                    onChange={(e) => setReservaForm(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Hasta *</label>
                  <input
                    type="date"
                    value={reservaForm.fecha_fin}
                    onChange={(e) => setReservaForm(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setReservaModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold">Confirmar Reserva</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ARRIENDOS A TERCEROS */}
      {arriendoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <Handshake className="w-5 h-5 text-amber-600" />
              <span>Registrar Arriendo a Tercero</span>
            </h3>

            <form onSubmit={handleArriendoSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Seleccionar Equipo *</label>
                <select
                  value={arriendoForm.equipo_id}
                  onChange={(e) => setArriendoForm(prev => ({ ...prev, equipo_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                  required
                >
                  {maquinaria.map(m => (
                    <option key={m.id} value={m.id}>{m.tipo} ({m.patente})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Empresa Arrendataria *</label>
                <input
                  type="text"
                  placeholder="ej: Constructora El Bosque SpA"
                  value={arriendoForm.empresa_arrendataria}
                  onChange={(e) => setArriendoForm(prev => ({ ...prev, empresa_arrendataria: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Tarifa Diaria ($)</label>
                  <input
                    type="number"
                    placeholder="150000"
                    value={arriendoForm.tarifa_diaria}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, tarifa_diaria: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Contacto Responsable</label>
                  <input
                    type="text"
                    placeholder="Nombre o Teléfono"
                    value={arriendoForm.contacto_responsable}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, contacto_responsable: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Desde *</label>
                  <input
                    type="date"
                    value={arriendoForm.fecha_inicio}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Hasta *</label>
                  <input
                    type="date"
                    value={arriendoForm.fecha_fin}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setArriendoModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-600 text-white font-bold">Guardar Arriendo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ASIGNACIÓN DIRECTA */}
      {assignModalOpen && selectedEquipToAssign && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span>Asignar Equipo a Obra</span>
            </h3>

            <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-slate-800">{selectedEquipToAssign.tipo} ({selectedEquipToAssign.patente})</p>
              <p className="text-slate-500">Obra Actual: {selectedEquipToAssign.obra_nombre || 'Bodega Central / Libre'}</p>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold uppercase text-slate-600">Obra / Proyecto Destino *</label>
                <select
                  value={targetObraName}
                  onChange={(e) => setTargetObraName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white"
                  required
                >
                  <option value="Bodega Central / Libre">Bodega Central / Libre (Sin Asignar)</option>
                  {obras.map(o => (
                    <option key={o.nombre} value={o.nombre}>{o.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover transition shadow-sm"
                >
                  {modalLoading ? 'Asignando...' : 'Confirmar Asignación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HORÓMETRO / USO */}
      {usoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <Gauge className="w-5 h-5 text-emerald-600" />
              <span>Registrar Horómetro y Uso</span>
            </h3>

            <form onSubmit={handleUsoSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Seleccionar Equipo *</label>
                <select
                  value={usoForm.equipo_id}
                  onChange={(e) => {
                    const selected = maquinaria.find(m => m.id.toString() === e.target.value.toString());
                    setUsoForm(prev => ({
                      ...prev,
                      equipo_id: e.target.value,
                      equipo_patente: selected ? selected.patente : '',
                      obra_nombre: selected ? (selected.obra_nombre || 'Bodega Central') : '',
                      horometro_inicial: selected ? (selected.horometro_inicial || 0).toString() : '0'
                    }));
                  }}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                  required
                >
                  {maquinaria.map(m => (
                    <option key={m.id} value={m.id}>{m.tipo} - Patente: {m.patente} ({m.obra_nombre || 'Bodega Central'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">H. Inicial (hrs) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={usoForm.horometro_inicial}
                    onChange={(e) => setUsoForm(prev => ({ ...prev, horometro_inicial: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">H. Final (hrs) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={usoForm.horometro_final}
                    onChange={(e) => setUsoForm(prev => ({ ...prev, horometro_final: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Combustible (Lts)</label>
                  <input
                    type="number"
                    value={usoForm.combustible_cargado}
                    onChange={(e) => setUsoForm(prev => ({ ...prev, combustible_cargado: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Operador a Cargo</label>
                  <input
                    type="text"
                    value={usoForm.operador}
                    onChange={(e) => setUsoForm(prev => ({ ...prev, operador: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setUsoModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold">Guardar Uso</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO / EDICIÓN EQUIPO */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              <span>{editingEquip ? 'Editar Ficha de Equipo' : 'Ingresar Nuevo Equipo'}</span>
            </h3>

            <form onSubmit={handleSubmitEquip} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Tipo de Equipo *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                    required
                  >
                    {tiposMaquinaria.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Patente / Código *</label>
                  <input
                    type="text"
                    placeholder="ej: BBBB-99"
                    value={formData.patente}
                    onChange={(e) => setFormData(prev => ({ ...prev, patente: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Marca / Modelo</label>
                  <input
                    type="text"
                    placeholder="ej: Caterpillar 416F"
                    value={formData.marca}
                    onChange={(e) => setFormData(prev => ({ ...prev, marca: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Tipo de Propiedad</label>
                  <select
                    value={formData.tipo_activo}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipo_activo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                  >
                    <option value="Propio">Propio (Empresa)</option>
                    <option value="Arrendado">Arrendado / Proveedor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Horómetro Inicial (hrs)</label>
                  <input
                    type="number"
                    value={formData.horometro_inicial}
                    onChange={(e) => setFormData(prev => ({ ...prev, horometro_inicial: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Obra Asignada</label>
                  <select
                    value={formData.obra_nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, obra_nombre: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                  >
                    <option value="Bodega Central / Libre">Bodega Central / Libre</option>
                    {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancelar</button>
                <button type="submit" disabled={modalLoading} className="px-5 py-2 rounded-xl bg-primary text-white font-bold shadow-sm">
                  {modalLoading ? 'Guardando...' : 'Guardar Equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER FICHA COMPLETA */}
      {viewingEquip && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">{viewingEquip.tipo} ({viewingEquip.patente})</h3>
              <button onClick={() => setViewingEquip(null)} className="p-1 rounded-lg bg-slate-100 font-bold text-xs">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <p><b>Marca:</b> {viewingEquip.marca || 'S/I'}</p>
              <p><b>Propiedad:</b> {viewingEquip.tipo_activo || 'Propio'}</p>
              <p><b>Obra Asignada:</b> {viewingEquip.obra_nombre || 'Bodega Central / Libre'}</p>
              <p><b>Horómetro Inicial:</b> {viewingEquip.horometro_inicial || 0} hrs</p>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setViewingEquip(null)} className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-xs">Cerrar Ficha</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
