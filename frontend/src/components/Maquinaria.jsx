import React, { useState, useEffect } from 'react';
import { obraxisLogoBase64 } from '../obraxisLogoBase64';
import { supabase } from '../supabaseClient';
import { 
  Truck, ArrowLeft, Search, Plus, Edit, Trash2, Loader2, AlertCircle, Check, QrCode, 
  Building2, Eye, Camera, Image, Calendar, Clock, Gauge, Fuel, CheckCircle2, 
  ChevronRight, Wrench, ShieldCheck, MapPin, CalendarDays, RefreshCw, Send, Handshake, DollarSign,
  Filter, SlidersHorizontal, List, Grid, AlertTriangle
} from 'lucide-react';


// Listado de feriados nacionales en Chile (MM-DD)
const feriadosChile = [
  '01-01', '05-01', '05-21', '06-20', '06-29', '07-16', '08-15',
  '09-18', '09-19', '09-20', '10-12', '10-31', '11-01', '12-08', '12-25'
];

const esDiaNoLaboral = (fechaObj) => {
  const dayOfWeek = fechaObj.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  const monthDay = fechaObj.toISOString().slice(5, 10);
  return feriadosChile.includes(monthDay);
};

const calcularDiasLaborablesArriendo = (fDesdeStr, fHastaStr, logsContrato) => {
  if (!fDesdeStr || !fHastaStr) return { diasLaborables: 0, diasNoLaborablesUso: 0, diasCobrados: 0, diasTotales: 0 };

  const start = new Date(fDesdeStr + 'T00:00:00');
  const end = new Date(fHastaStr + 'T00:00:00');

  let diasLaborables = 0;
  let diasNoLaborablesSinUso = 0;
  let diasNoLaborablesConUso = 0;
  let diasTotales = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    diasTotales++;
    const fechaISO = d.toISOString().split('T')[0];
    const noLaboral = esDiaNoLaboral(d);
    
    const usoEnFecha = logsContrato.filter(l => l.fecha === fechaISO);
    const hrsEnFecha = usoEnFecha.reduce((acc, curr) => acc + (parseFloat(curr.horas_trabajadas) || 0), 0);

    if (!noLaboral) {
      diasLaborables++;
    } else {
      if (hrsEnFecha > 0) {
        diasNoLaborablesConUso++;
      } else {
        diasNoLaborablesSinUso++;
      }
    }
  }

  return {
    diasTotales,
    diasLaborables,
    diasNoLaborablesSinUso,
    diasNoLaborablesConUso,
    diasCobrados: diasLaborables + diasNoLaborablesConUso
  };
};

export default function Maquinaria({ user, onBack }) {
  const [activeSection, setActiveSection] = useState(''); // '', 'inventario', 'asignaciones', 'uso', 'reservas', 'arriendos'
  const [maquinaria, setMaquinaria] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObraFilter, setSelectedObraFilter] = useState('');
  const [selectedTipoFilter, setSelectedTipoFilter] = useState('');
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState('');
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

  // 2. Estados Asignación Directa de Equipos con FECHA HASTA
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedEquipToAssign, setSelectedEquipToAssign] = useState(null);
  const [targetObraName, setTargetObraName] = useState('');
  const [assignFechaHasta, setAssignFechaHasta] = useState('');
  const [assignWarning, setAssignWarning] = useState('');

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

  // 4. Estados Reserva y Disponibilidad Futura (con Edición y Detalles)
  const [reservasList, setReservasList] = useState([]);
  const [reservaModalOpen, setReservaModalOpen] = useState(false);
  const [editingReserva, setEditingReserva] = useState(null);
  const [reservaViewMode, setReservaViewMode] = useState('tabla'); // 'tabla' o 'matriz'
  const [reservaForm, setReservaForm] = useState({
    equipo_id: '',
    obra_destino_custom: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    solicitante: user?.nombre || user?.usuario || 'Administrador Obraxis',
    proposito: ''
  });

  // 5. Estados Arriendos a Terceros
  const [arriendosList, setArriendosList] = useState([]);
  const [arriendoModalOpen, setArriendoModalOpen] = useState(false);
  const [editingArriendo, setEditingArriendo] = useState(null);
  const [estadoPagoModalOpen, setEstadoPagoModalOpen] = useState(false);
  const [viewingBitacoraArriendo, setViewingBitacoraArriendo] = useState(null);
  const [qrModalArriendo, setQrModalArriendo] = useState(null);
  const [selectedArriendoEstadoPago, setSelectedArriendoEstadoPago] = useState(null);
  const [corteDesde, setCorteDesde] = useState('');
  const [corteHasta, setCorteHasta] = useState('');
  const [numEstadoPago, setNumEstadoPago] = useState('1');
  const [extenderModalOpen, setExtenderModalOpen] = useState(false);
  const [extenderArriendo, setExtenderArriendo] = useState(null);
  const [nuevaFechaFin, setNuevaFechaFin] = useState('');
  const [arriendoForm, setArriendoForm] = useState({
    equipo_id: '',
    empresa_arrendataria: '',
    rut_empresa: '',
    obra_cliente: '',
    direccion_obra: '',
    contacto_nombre: '',
    contacto_telefono: '',
    contacto_email: '',
    tarifa_diaria: '0',
    tarifa_monto: '150000',
    unidad_tarifa: '$/día',
    aplica_tarifa_minima: false,
    unidad_tarifa_minima: 'hrs/día',
    monto_tarifa_minima: '5',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
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
    let localItems = [];
    const local = localStorage.getItem('obraxis_maquinaria_reservas');
    if (local) {
      try { localItems = JSON.parse(local); } catch (e) {}
    }

    try {
      const { data, error } = await supabase
        .from('maquinaria_reservas')
        .select('*')
        .order('fecha_inicio', { ascending: true });

      if (!error && data && data.length > 0) {
        const ids = new Set(data.map(d => d.id || d.created_at));
        const missingLocal = localItems.filter(l => !ids.has(l.id || l.created_at));
        const merged = [...data, ...missingLocal];
        setReservasList(merged);
        localStorage.setItem('obraxis_maquinaria_reservas', JSON.stringify(merged));
      } else if (localItems.length > 0) {
        setReservasList(localItems);
      } else {
        setReservasList(data || []);
      }
    } catch (e) {
      setReservasList(localItems);
    }
  };

  const fetchArriendosLogs = async () => {
    let localItems = [];
    const local = localStorage.getItem('obraxis_maquinaria_arriendos');
    if (local) {
      try { localItems = JSON.parse(local); } catch (e) {}
    }

    try {
      const { data, error } = await supabase
        .from('maquinaria_arriendos')
        .select('*')
        .order('fecha_inicio', { ascending: false });

      if (!error && data && data.length > 0) {
        // Combinar datos remotos con locales para no perder arriendos
        const ids = new Set(data.map(d => d.id || d.created_at));
        const missingLocal = localItems.filter(l => !ids.has(l.id || l.created_at));
        const merged = [...data, ...missingLocal];
        setArriendosList(merged);
        localStorage.setItem('obraxis_maquinaria_arriendos', JSON.stringify(merged));
      } else if (localItems.length > 0) {
        setArriendosList(localItems);
      } else {
        setArriendosList(data || []);
      }
    } catch (e) {
      setArriendosList(localItems);
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

  // 2. Handler Asignación Directa de Obra (Con Validación de Fecha Hasta para no chocar con Reservas)
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEquipToAssign) return;

    // Verificar si la fecha de asignación choca con alguna reserva agendada
    if (assignFechaHasta) {
      const equipRes = reservasList.filter(r => r.equipo_id.toString() === selectedEquipToAssign.id.toString());
      const hasConflict = equipRes.some(r => {
        const rInicio = new Date(r.fecha_inicio);
        const aHasta = new Date(assignFechaHasta);
        return aHasta >= rInicio;
      });

      if (hasConflict && !window.confirm('⚠️ ADVERTENCIA: La fecha hasta seleccionada ingresa al periodo de una reserva agendada. ¿Deseas confirmar la asignación de todas formas?')) {
        return;
      }
    }

    setModalLoading(true);
    try {
      const matchedObra = obras.find(o => o.nombre.toLowerCase() === (targetObraName || '').toLowerCase());
      const validTargetName = matchedObra ? matchedObra.nombre : null;

      let updatePayload = { 
        obra_nombre: validTargetName,
        fecha_hasta_estimada: assignFechaHasta || null
      };

      let attempts = 0;
      let success = false;
      let lastError = null;

      while (attempts < 5 && !success) {
        attempts++;
        const res = await supabase.from('inventario_maquinaria').update(updatePayload).eq('id', selectedEquipToAssign.id);
        if (!res.error) {
          success = true;
          break;
        }
        lastError = res.error;
        const msg = res.error.message || '';
        const match = msg.match(/Could not find the '([^']+)' column/i);
        if (match && match[1] && updatePayload[match[1]] !== undefined) {
          delete updatePayload[match[1]];
        } else {
          delete updatePayload.fecha_hasta_estimada;
        }
      }

      if (!success && lastError) throw lastError;

      setSuccessMsg(`¡Equipo ${selectedEquipToAssign.patente} asignado a ${targetObraName || 'Bodega Central / Libre'}${assignFechaHasta ? ` hasta el ${assignFechaHasta}` : ''}!`);
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
      empresa: user?.empresa || 'OBRAXIS',
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

  // 4. Handler Reserva de Equipo Futuro (Con Soporte para Edición y Eliminación)
  const handleReservaSubmit = async (e) => {
    e.preventDefault();
    if (!reservaForm.equipo_id || !reservaForm.obra_destino_custom.trim()) {
      alert('Por favor especifique la obra futura o proyecto en licitación.');
      return;
    }

    const eq = maquinaria.find(m => m.id.toString() === reservaForm.equipo_id.toString());

    const payloadReserva = {
      equipo_id: reservaForm.equipo_id,
      equipo_tipo: eq ? eq.tipo : 'Equipo',
      equipo_patente: eq ? eq.patente : 'N/A',
      obra_destino: reservaForm.obra_destino_custom.trim(),
      fecha_inicio: reservaForm.fecha_inicio,
      fecha_fin: reservaForm.fecha_fin,
      solicitante: reservaForm.solicitante,
      proposito: reservaForm.proposito,
      estado: 'Confirmada',
      empresa: user?.empresa || 'OBRAXIS',
      created_at: new Date().toISOString()
    };

    try {
      if (editingReserva) {
        const { error } = await supabase.from('maquinaria_reservas').update(payloadReserva).eq('id', editingReserva.id);
        if (error) throw error;
        setSuccessMsg('Reserva actualizada exitosamente.');
      } else {
        const { error } = await supabase.from('maquinaria_reservas').insert([payloadReserva]);
        if (error) throw error;
        setSuccessMsg('Reserva agendada exitosamente.');
      }
      fetchReservasLogs();
    } catch (err) {
      let updated;
      if (editingReserva) {
        updated = reservasList.map(r => r.id === editingReserva.id ? { ...r, ...payloadReserva } : r);
      } else {
        updated = [payloadReserva, ...reservasList];
      }
      setReservasList(updated);
      localStorage.setItem('obraxis_maquinaria_reservas', JSON.stringify(updated));
      setSuccessMsg('Reserva guardada.');
    } finally {
      setEditingReserva(null);
      setReservaModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const handleDeleteReserva = async (res) => {
    if (!window.confirm(`¿Deseas cancelar y eliminar la reserva para ${res.equipo_tipo} (${res.equipo_patente})?`)) return;

    try {
      if (res.id) {
        await supabase.from('maquinaria_reservas').delete().eq('id', res.id);
      }
      const updated = reservasList.filter(r => r !== res && r.id !== res.id);
      setReservasList(updated);
      localStorage.setItem('obraxis_maquinaria_reservas', JSON.stringify(updated));
      setSuccessMsg('Reserva eliminada.');
    } catch (e) {
      alert('Error al eliminar reserva: ' + e.message);
    }
  };

  // 5. Handler Arriendos a Terceros
  const handleArriendoSubmit = async (e) => {
    e.preventDefault();
    if (!arriendoForm.equipo_id || !arriendoForm.empresa_arrendataria.trim()) {
      alert('Por favor complete los campos obligatorios del contrato de arriendo.');
      return;
    }

    const eq = maquinaria.find(m => m.id.toString() === arriendoForm.equipo_id.toString());
    if (!eq) {
      alert('Equipo no encontrado.');
      return;
    }

    const aInicio = new Date(arriendoForm.fecha_inicio);
    const aFin = new Date(arriendoForm.fecha_fin);

    if (aFin < aInicio) {
      alert('La fecha de término del arriendo no puede ser anterior a la fecha de inicio.');
      return;
    }

    // VERIFICACIÓN 1: ¿Está actualmente asignado en faena?
    if (eq.obra_nombre && eq.obra_nombre.trim() !== '') {
      const hastaEst = eq.fecha_hasta_estimada ? new Date(eq.fecha_hasta_estimada) : null;
      if (!hastaEst || hastaEst >= aInicio) {
        alert(`❌ NO DISPONIBLE: El equipo ${eq.tipo} (${eq.patente}) está actualmente ASIGNADO a la obra "${eq.obra_nombre}"${eq.fecha_hasta_estimada ? ` hasta el ${eq.fecha_hasta_estimada}` : ''}. Debes desasignarlo o modificar las fechas del arriendo.`);
        return;
      }
    }

    // VERIFICACIÓN 2: ¿Tiene alguna reserva agendada en ese rango de fechas?
    const conflictoReserva = reservasList.find(r => {
      if (r.equipo_id.toString() !== eq.id.toString()) return false;
      const rIni = new Date(r.fecha_inicio);
      const rFin = new Date(r.fecha_fin);
      return (rIni <= aFin && rFin >= aInicio);
    });

    if (conflictoReserva) {
      alert(`❌ SOLAPAMIENTO DE RESERVA: El equipo ${eq.tipo} (${eq.patente}) ya posee una RESERVA AGENDADA para la obra "${conflictoReserva.obra_destino}" desde el ${conflictoReserva.fecha_inicio} hasta el ${conflictoReserva.fecha_fin}.`);
      return;
    }

    // VERIFICACIÓN 3: ¿Tiene otro contrato de arriendo activo en las mismas fechas?
    const conflictoArriendo = arriendosList.find(a => {
      if (a.equipo_id.toString() !== eq.id.toString() || a.estado !== 'Activo') return false;
      const arrIni = new Date(a.fecha_inicio);
      const arrFin = new Date(a.fecha_fin);
      return (arrIni <= aFin && arrFin >= aInicio);
    });

    if (conflictoArriendo) {
      alert(`❌ SOLAPAMIENTO DE ARRIENDO: El equipo ya posee un contrato de arriendo activo con "${conflictoArriendo.empresa_arrendataria}" entre el ${conflictoArriendo.fecha_inicio} y el ${conflictoArriendo.fecha_fin}.`);
      return;
    }

    const tMonto = parseFloat(arriendoForm.tarifa_monto) || parseFloat(arriendoForm.tarifa_diaria) || 0;
    const newArriendo = {
      equipo_id: arriendoForm.equipo_id,
      equipo_tipo: eq.tipo,
      equipo_patente: eq.patente,
      empresa_arrendataria: arriendoForm.empresa_arrendataria.trim(),
      rut_empresa: arriendoForm.rut_empresa.trim(),
      obra_cliente: arriendoForm.obra_cliente.trim(),
      direccion_obra: arriendoForm.direccion_obra.trim(),
      contacto_nombre: arriendoForm.contacto_nombre.trim(),
      contacto_telefono: arriendoForm.contacto_telefono.trim(),
      contacto_email: arriendoForm.contacto_email.trim(),
      tarifa_diaria: tMonto,
      tarifa_monto: tMonto,
      unidad_tarifa: arriendoForm.unidad_tarifa || '$/día',
      aplica_tarifa_minima: Boolean(arriendoForm.aplica_tarifa_minima),
      unidad_tarifa_minima: arriendoForm.unidad_tarifa_minima || 'hrs/día',
      monto_tarifa_minima: parseFloat(arriendoForm.monto_tarifa_minima) || 0,
      fecha_inicio: arriendoForm.fecha_inicio,
      fecha_fin: arriendoForm.fecha_fin,
      observaciones: arriendoForm.observaciones,
      estado: 'Activo',
      empresa: user?.empresa || 'OBRAXIS',
      created_at: new Date().toISOString()
    };

    // Guardar inmediatamente en estado local y localStorage para cero pérdidas
    let updatedLocal;
    if (editingArriendo) {
      updatedLocal = arriendosList.map(a => (a === editingArriendo || a.id === editingArriendo.id) ? { ...a, ...newArriendo } : a);
    } else {
      updatedLocal = [newArriendo, ...arriendosList];
    }
    setArriendosList(updatedLocal);
    localStorage.setItem('obraxis_maquinaria_arriendos', JSON.stringify(updatedLocal));

    try {
      if (editingArriendo && editingArriendo.id) {
        await supabase.from('maquinaria_arriendos').update(newArriendo).eq('id', editingArriendo.id);
      } else {
        await supabase.from('maquinaria_arriendos').insert([newArriendo]);
      }
      setSuccessMsg(editingArriendo ? 'Contrato de arriendo actualizado.' : 'Contrato de arriendo registrado con éxito.');
    } catch (err) {
      console.warn('Guardado en localStorage por falta de tabla remota:', err.message);
      setSuccessMsg('Contrato de arriendo guardado en este dispositivo.');
    } finally {
      setEditingArriendo(null);
      setArriendoModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Handler Extender Contrato con Verificación
  const handleExtenderSubmit = async (e) => {
    e.preventDefault();
    if (!extenderArriendo || !nuevaFechaFin) return;

    const nFin = new Date(nuevaFechaFin);
    const iniArr = new Date(extenderArriendo.fecha_inicio);

    if (nFin <= iniArr) {
      alert('La nueva fecha de término debe ser posterior a la fecha de inicio del arriendo.');
      return;
    }

    // Verificar si en la extensión existe conflicto con reservas futuras
    const conflictoRes = reservasList.find(r => {
      if (r.equipo_id.toString() !== extenderArriendo.equipo_id.toString()) return false;
      const rIni = new Date(r.fecha_inicio);
      return rIni <= nFin;
    });

    if (conflictoRes) {
      if (!window.confirm(`⚠️ ADVERTENCIA DE SOLAPAMIENTO: El equipo ya posee una reserva agendada para "${conflictoRes.obra_destino}" a partir del ${conflictoRes.fecha_inicio}. ¿Deseas extender la fecha de todas formas?`)) {
        return;
      }
    }

    try {
      if (extenderArriendo.id) {
        await supabase.from('maquinaria_arriendos').update({ fecha_fin: nuevaFechaFin }).eq('id', extenderArriendo.id);
      }
      const updated = arriendosList.map(a => a === extenderArriendo || a.id === extenderArriendo.id ? { ...a, fecha_fin: nuevaFechaFin } : a);
      setArriendosList(updated);
      localStorage.setItem('obraxis_maquinaria_arriendos', JSON.stringify(updated));
      setSuccessMsg(`Contrato de ${extenderArriendo.empresa_arrendataria} extendido hasta el ${nuevaFechaFin}.`);
      fetchArriendosLogs();
    } catch (err) {
      alert('Error al extender contrato: ' + err.message);
    } finally {
      setExtenderModalOpen(false);
      setExtenderArriendo(null);
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
    if (isEnUso && isReservado) {
      return { code: 'en_uso', label: `En Uso (${equip.obra_nombre}) + Reservado`, badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200' };
    }
    if (isEnUso) {
      return { code: 'en_uso', label: `En Uso (${equip.obra_nombre})`, badgeClass: 'bg-amber-100 text-amber-900 border-amber-200' };
    }
    if (isReservado) {
      return { code: 'reservado', label: 'Reservado (Futuro)', badgeClass: 'bg-blue-100 text-blue-900 border-blue-200' };
    }
    return { code: 'libre', label: 'Disponible / Sin Reserva', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
  };

  // Filtrado Multicriterio de Flota
  const filteredMaquinaria = maquinaria.filter(m => {
    const matchesSearch = 
      (m.tipo && m.tipo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.patente && m.patente.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.marca && m.marca.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesObra = 
      selectedObraFilter === '' || 
      (m.obra_nombre && m.obra_nombre.toLowerCase() === selectedObraFilter.toLowerCase());

    const matchesTipo = 
      selectedTipoFilter === '' || 
      (m.tipo && m.tipo.toLowerCase() === selectedTipoFilter.toLowerCase());

    const isEnUso = Boolean(m.obra_nombre && m.obra_nombre.trim() !== '');
    const isReservado = reservasList.some(r => r.equipo_id.toString() === m.id.toString());
    const isArrendado = arriendosList.some(a => a.equipo_id.toString() === m.id.toString() && a.estado === 'Activo');
    const isLibre = !isEnUso && !isReservado && !isArrendado;

    let matchesEstado = true;
    if (selectedEstadoFilter === 'en_uso') matchesEstado = isEnUso;
    else if (selectedEstadoFilter === 'reservado') matchesEstado = isReservado;
    else if (selectedEstadoFilter === 'libre') matchesEstado = isLibre;
    else if (selectedEstadoFilter === 'arrendado') matchesEstado = isArrendado;

    return matchesSearch && matchesObra && matchesTipo && matchesEstado;
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
                  Asignación directa y traslados a obras con fecha hasta estimada.
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
                  Agenda de obras futuras, edición de reservas y tabla consolidada de flota.
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
              <p className="text-xs text-slate-500">Catálogo general de flota con filtros y estado operacional.</p>
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
          <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por tipo, patente o marca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-slate-800 font-medium w-full px-3.5 py-2 border rounded-xl border-slate-200 focus:outline-none focus:border-primary transition text-xs"
              />
            </div>

            <div>
              <select
                value={selectedTipoFilter}
                onChange={(e) => setSelectedTipoFilter(e.target.value)}
                className="text-slate-800 font-medium w-full px-3.5 py-2 border rounded-xl border-slate-200 focus:outline-none focus:border-primary transition text-xs bg-white"
              >
                <option value="">Filtrar por Tipo (Todos)</option>
                {tiposMaquinaria.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <select
                value={selectedObraFilter}
                onChange={(e) => setSelectedObraFilter(e.target.value)}
                className="text-slate-800 font-medium w-full px-3.5 py-2 border rounded-xl border-slate-200 focus:outline-none focus:border-primary transition text-xs bg-white"
              >
                <option value="">Filtrar por Obra (Todas)</option>
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
              <p className="text-xs font-bold">No se encontraron equipos con los filtros seleccionados.</p>
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

      {/* 4. SUBMÓDULO 2: ASIGNACIÓN DE EQUIPOS CON FECHA HASTA ESTIMADA */}
      {activeSection === 'asignaciones' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Asignación Directa a Obras Activas</h3>
              <p className="text-xs text-slate-500">Configura la obra de destino y la fecha hasta estimada de asignación para coordinar reservas.</p>
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
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">Obra Actual: <span className="text-primary">{m.obra_nombre || 'Bodega Central / Libre'}</span></p>
                    {m.fecha_hasta_estimada && <p className="text-[10.5px] text-amber-800 font-bold">Asignado Hasta: {m.fecha_hasta_estimada}</p>}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedEquipToAssign(m);
                      setTargetObraName(m.obra_nombre || (obras[0] ? obras[0].nombre : ''));
                      setAssignFechaHasta(m.fecha_hasta_estimada || '');
                      setAssignModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Asignar con Fecha Hasta</span>
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

      {/* 6. SUBMÓDULO 4: RESERVA Y DISPONIBILIDAD (TABLA Y MATRIZ ESCALABLE PARA GRANDES VOLÚMENES) */}
      {activeSection === 'reservas' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Agenda de Reservas y Disponibilidad de Flota</h3>
              <p className="text-xs text-slate-500">Control de disponibilidad operacional para grandes flotas de equipos.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold border border-slate-200">
                <button
                  onClick={() => setReservaViewMode('tabla')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${reservaViewMode === 'tabla' ? 'bg-white text-purple-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Tabla Consolidada</span>
                </button>
                <button
                  onClick={() => setReservaViewMode('matriz')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${reservaViewMode === 'matriz' ? 'bg-white text-purple-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Matriz de Estados</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setEditingReserva(null);
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
                <span>Nueva Reserva Futura</span>
              </button>
            </div>
          </div>

          {/* VISTA 1: TABLA CONSOLIDADA PARA GRANDES FLOTAS */}
          {reservaViewMode === 'tabla' && (
            <div className="space-y-4">
              {/* Filtro rápido por estado */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                  <button
                    onClick={() => setSelectedEstadoFilter('')}
                    className={`px-3 py-1.5 rounded-xl transition ${selectedEstadoFilter === '' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                  >
                    Todos ({maquinaria.length})
                  </button>
                  <button
                    onClick={() => setSelectedEstadoFilter('en_uso')}
                    className={`px-3 py-1.5 rounded-xl transition ${selectedEstadoFilter === 'en_uso' ? 'bg-amber-600 text-white' : 'bg-white text-amber-800 border border-amber-200'}`}
                  >
                    En Uso ({maquinaria.filter(m => Boolean(m.obra_nombre && m.obra_nombre.trim() !== '')).length})
                  </button>
                  <button
                    onClick={() => setSelectedEstadoFilter('reservado')}
                    className={`px-3 py-1.5 rounded-xl transition ${selectedEstadoFilter === 'reservado' ? 'bg-blue-600 text-white' : 'bg-white text-blue-800 border border-blue-200'}`}
                  >
                    Reservados ({reservasList.length})
                  </button>
                  <button
                    onClick={() => setSelectedEstadoFilter('libre')}
                    className={`px-3 py-1.5 rounded-xl transition ${selectedEstadoFilter === 'libre' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-800 border border-emerald-200'}`}
                  >
                    Disponibles / Libres ({maquinaria.filter(m => (!m.obra_nombre || m.obra_nombre.trim() === '') && !reservasList.some(r => r.equipo_id.toString() === m.id.toString())).length})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Buscar máquina o reserva..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 text-xs font-semibold py-1.5 px-3 border border-slate-200 rounded-xl bg-white"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              {/* Tabla Principal */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                      <th className="p-3">Equipo / Patente</th>
                      <th className="p-3">Estado Actual</th>
                      <th className="p-3">Obra / Ubicación Actual</th>
                      <th className="p-3">Asignado Hasta</th>
                      <th className="p-3">Reserva Agendada (Obra Futura)</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMaquinaria.map(m => {
                      const est = getEquipoEstadoDetallado(m);
                      const res = reservasList.find(r => r.equipo_id.toString() === m.id.toString());
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 font-medium text-slate-800">
                          <td className="p-3 font-bold text-slate-900">
                            {m.tipo} <span className="text-slate-500 font-semibold">({m.patente})</span>
                          </td>
                          <td className="p-3">
                            <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border uppercase ${est.badgeClass}`}>
                              {est.label}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 font-semibold">
                            {m.obra_nombre || 'Bodega Central / Libre'}
                          </td>
                          <td className="p-3 text-slate-600">
                            {m.fecha_hasta_estimada ? <span className="font-bold text-amber-800">{m.fecha_hasta_estimada}</span> : '-'}
                          </td>
                          <td className="p-3">
                            {res ? (
                              <div>
                                <p className="font-extrabold text-blue-900 uppercase text-[11px]">{res.obra_destino}</p>
                                <p className="text-[10px] text-slate-500">{res.fecha_inicio} al {res.fecha_fin} ({res.solicitante})</p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Sin reserva agendada</span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1">
                            {res && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingReserva(res);
                                    setReservaForm({
                                      equipo_id: res.equipo_id,
                                      obra_destino_custom: res.obra_destino,
                                      fecha_inicio: res.fecha_inicio,
                                      fecha_fin: res.fecha_fin,
                                      solicitante: res.solicitante || '',
                                      proposito: res.proposito || ''
                                    });
                                    setReservaModalOpen(true);
                                  }}
                                  className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 font-bold text-[10px] text-slate-700 transition"
                                  title="Editar Reserva"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteReserva(res)}
                                  className="px-2 py-1 rounded bg-red-100 hover:bg-red-200 font-bold text-[10px] text-red-700 transition"
                                  title="Cancelar Reserva"
                                >
                                  🗑️ Cancelar
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VISTA 2: MATRIZ POR ESTADOS */}
          {reservaViewMode === 'matriz' && (
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
                      {m.fecha_hasta_estimada && <p className="text-[10px] text-slate-500">Hasta: {m.fecha_hasta_estimada}</p>}
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
                        <div className="space-x-1">
                          <button onClick={() => {
                            setEditingReserva(res);
                            setReservaForm({
                              equipo_id: res.equipo_id,
                              obra_destino_custom: res.obra_destino,
                              fecha_inicio: res.fecha_inicio,
                              fecha_fin: res.fecha_fin,
                              solicitante: res.solicitante || '',
                              proposito: res.proposito || ''
                            });
                            setReservaModalOpen(true);
                          }} className="text-[10px]">✏️</button>
                          <button onClick={() => handleDeleteReserva(res)} className="text-[10px]">🗑️</button>
                        </div>
                      </div>
                      <p className="text-[11px] text-blue-950 font-bold">Obra Futura: {res.obra_destino}</p>
                      <p className="text-[10px] text-slate-500">{res.fecha_inicio} al {res.fecha_fin}</p>
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
          )}
        </div>
      )}

      {/* 7. SUBMÓDULO 5: ARRIENDOS A TERCEROS */}
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
                <div key={idx} className="p-5 rounded-3xl border border-amber-200 bg-amber-50/30 space-y-3 shadow-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 uppercase">
                        {arr.equipo_tipo} ({arr.equipo_patente})
                      </span>
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-lg">{arr.fecha_inicio} al {arr.fecha_fin}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-850 uppercase">{arr.empresa_arrendataria} {arr.rut_empresa ? `(${arr.rut_empresa})` : ''}</h4>
                      <p className="text-[11px] text-amber-900 font-bold">Obra Cliente: {arr.obra_cliente || 'N/A'}</p>
                      {arr.direccion_obra && <p className="text-[10px] text-slate-500">Dirección: {arr.direccion_obra}</p>}
                    </div>
                    <div className="pt-2 border-t border-amber-200/60 flex justify-between items-center text-[11px]">
                      <div>
                        <p className="text-slate-700 font-semibold">Responsable: <b>{arr.contacto_nombre || arr.contacto_responsable || 'S/I'}</b></p>
                        {arr.contacto_telefono && <p className="text-[10px] text-slate-500">Tel: {arr.contacto_telefono} {arr.contacto_email ? `| ${arr.contacto_email}` : ''}</p>}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-amber-800 bg-white px-2.5 py-1 rounded-xl border border-amber-300 block">
                          ${parseFloat(arr.tarifa_monto || arr.tarifa_diaria || 0).toLocaleString('es-CL')} ${arr.unidad_tarifa || '$/día'}
                        </span>
                        {arr.aplica_tarifa_minima && (
                          <span className="text-[9px] font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded mt-1 inline-block">
                            Mín: ${arr.monto_tarifa_minima} ${arr.unidad_tarifa_minima}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones del Contrato */}
                  <div className="pt-3 border-t border-amber-200/80 flex flex-wrap gap-2 justify-end text-xs">
                    <button
                      onClick={() => setQrModalArriendo(arr)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold border border-blue-200 transition cursor-pointer flex items-center gap-1"
                      title="Generar e imprimir Código QR para cabina del equipo"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>📱 QR Terreno</span>
                    </button>

                    <button
                      onClick={() => setViewingBitacoraArriendo(arr)}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold border border-purple-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <span>📋 Bitácora Uso</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingArriendo(arr);
                        setArriendoForm({
                          equipo_id: arr.equipo_id,
                          empresa_arrendataria: arr.empresa_arrendataria || '',
                          rut_empresa: arr.rut_empresa || '',
                          obra_cliente: arr.obra_cliente || '',
                          direccion_obra: arr.direccion_obra || '',
                          contacto_nombre: arr.contacto_nombre || arr.contacto_responsable || '',
                          contacto_telefono: arr.contacto_telefono || '',
                          contacto_email: arr.contacto_email || '',
                          tarifa_diaria: arr.tarifa_diaria ? arr.tarifa_diaria.toString() : '0',
                          tarifa_monto: (arr.tarifa_monto || arr.tarifa_diaria || 0).toString(),
                          unidad_tarifa: arr.unidad_tarifa || '$/día',
                          aplica_tarifa_minima: Boolean(arr.aplica_tarifa_minima),
                          unidad_tarifa_minima: arr.unidad_tarifa_minima || 'hrs/día',
                          monto_tarifa_minima: (arr.monto_tarifa_minima || 5).toString(),
                          fecha_inicio: arr.fecha_inicio,
                          fecha_fin: arr.fecha_fin,
                          observaciones: arr.observaciones || ''
                        });
                        setArriendoModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <span>✏️ Editar Info</span>
                    </button>

                    <button
                      onClick={() => {
                        setExtenderArriendo(arr);
                        setNuevaFechaFin(arr.fecha_fin || '');
                        setExtenderModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold border border-amber-300 transition cursor-pointer flex items-center gap-1"
                    >
                      <span>📅 Extender Termino</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedArriendoEstadoPago(arr);
                        setCorteDesde(arr.fecha_inicio || new Date().toISOString().split('T')[0]);
                        setCorteHasta(arr.fecha_fin || new Date().toISOString().split('T')[0]);
                        setEstadoPagoModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Estado de Pago</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      
      {/* MODAL EXTENDER CONTRATO */}
      {extenderModalOpen && extenderArriendo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              <span>Extender Contrato de Arriendo</span>
            </h3>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs space-y-1">
              <p className="font-bold text-amber-950">{extenderArriendo.empresa_arrendataria} ({extenderArriendo.equipo_tipo} {extenderArriendo.equipo_patente})</p>
              <p className="text-amber-800">Fecha Término Actual: <b>{extenderArriendo.fecha_fin}</b></p>
            </div>

            <form onSubmit={handleExtenderSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Nueva Fecha de Término *</label>
                <input
                  type="date"
                  value={nuevaFechaFin}
                  onChange={(e) => setNuevaFechaFin(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setExtenderModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-600 text-white font-bold shadow-sm">Confirmar Extensión</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DOCUMENTO ESTADO DE PAGO / VALUACIÓN DE ARRIENDO */}
      {estadoPagoModalOpen && selectedArriendoEstadoPago && (() => {
        const arr = selectedArriendoEstadoPago;
        const fDesde = corteDesde || arr.fecha_inicio;
        const fHasta = corteHasta || arr.fecha_fin;

        // Filtrar reportes de uso reales en el periodo
        const logsContrato = usoList.filter(u => 
          u.equipo_id.toString() === arr.equipo_id.toString() &&
          u.fecha >= fDesde && u.fecha <= fHasta
        );

        // Calcular auto-calendario de días hábiles y días no laborales con uso
        const cal = calcularDiasLaborablesArriendo(fDesde, fHasta, logsContrato);
        const diasPactados = cal.diasCobrados;

        const hrsRealesTrabajadas = logsContrato.reduce((acc, curr) => acc + (parseFloat(curr.horas_trabajadas) || 0), 0);

        const tarifaMonto = parseFloat(arr.tarifa_monto || arr.tarifa_diaria || 0);
        const unidadTarifa = arr.unidad_tarifa || '$/día';
        const aplicaMinimo = Boolean(arr.aplica_tarifa_minima);
        const unidadMinimo = arr.unidad_tarifa_minima || 'hrs/día';
        const valorMinimo = parseFloat(arr.monto_tarifa_minima || 0);

        let cantidadCobro = 0;
        let unidadCobroLabel = 'Días';
        let reglaMinimoAplicada = false;

        if (unidadTarifa === '$/hr') {
          unidadCobroLabel = 'Horas';
          let minimoTotalHoras = 0;
          if (aplicaMinimo) {
            if (unidadMinimo === 'hrs/día') minimoTotalHoras = diasPactados * valorMinimo;
            else if (unidadMinimo === 'hrs/mes') minimoTotalHoras = valorMinimo;
            else minimoTotalHoras = valorMinimo;
          }

          if (aplicaMinimo && hrsRealesTrabajadas < minimoTotalHoras) {
            cantidadCobro = minimoTotalHoras;
            reglaMinimoAplicada = true;
          } else {
            cantidadCobro = hrsRealesTrabajadas > 0 ? hrsRealesTrabajadas : diasPactados * 8;
          }
        } else if (unidadTarifa === '$/mes') {
          unidadCobroLabel = 'Meses';
          cantidadCobro = Math.max(1, Math.round((diasPactados / 30) * 10) / 10);
        } else {
          unidadCobroLabel = 'Días';
          let minimoTotalDias = 0;
          if (aplicaMinimo && unidadMinimo === 'días/mes') minimoTotalDias = valorMinimo;

          if (aplicaMinimo && diasPactados < minimoTotalDias) {
            cantidadCobro = minimoTotalDias;
            reglaMinimoAplicada = true;
          } else {
            cantidadCobro = diasPactados;
          }
        }

        const subtotal = cantidadCobro * tarifaMonto;
        const iva = Math.round(subtotal * 0.19);
        const total = subtotal + iva;

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in overflow-y-auto font-sans">
            <div className="printable-pdf-document bg-white rounded-3xl border border-slate-200 p-6 md:p-8 max-w-3xl w-full space-y-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
              
              {/* BARRA SUPERIOR DE ACCIONES (NO IMPRIMIBLE) */}
              <div className="no-print flex flex-wrap justify-between items-center gap-3 border-b border-slate-200 pb-4 bg-slate-50 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-700">N° ESTADO DE PAGO:</span>
                  <input
                    type="number"
                    min="1"
                    value={numEstadoPago}
                    onChange={(e) => setNumEstadoPago(e.target.value)}
                    className="w-20 px-2 py-1 border border-slate-300 rounded-xl text-xs font-black text-slate-900 text-center bg-amber-50 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      alert(`📧 ESTADO DE PAGO N° ${numEstadoPago} ENVIADO: Se ha despachado la valuación por $${total.toLocaleString('es-CL')} (Periodo del ${fDesde} al ${fHasta}) al correo "${arr.contacto_email || arr.contacto_telefono || 'contacto@empresa.cl'}" para facturación.`);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Correo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition cursor-pointer shadow-sm flex items-center gap-1.5 uppercase tracking-wider"
                  >
                    🖨️ Imprimir / PDF
                  </button>

                  <button onClick={() => setEstadoPagoModalOpen(false)} className="p-2 rounded-xl bg-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-300 cursor-pointer">
                    ✕
                  </button>
                </div>
              </div>

              {/* ENCABEZADO CORPORATIVO OFICIAL CON MEMBRETE */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-slate-900 pb-5">
                <div className="flex items-center gap-4">
                  <img src={obraxisLogoBase64} alt="Obraxis Logo" className="h-12 object-contain" />
                  <div>
                    <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">OBRAXIS SPA</h1>
                    <p className="text-[10.5px] font-bold text-slate-600 uppercase">SISTEMAS Y GESTIÓN DE MAQUINARIA EN FAENA</p>
                    <p className="text-[10px] text-slate-500 font-medium">RUT: 76.123.456-7 | Las Condes, Santiago | contacto@obraxis.cl</p>
                  </div>
                </div>

                <div className="text-left sm:text-right border-l-4 sm:border-l-0 pl-3 sm:pl-0 border-amber-600">
                  <div className="bg-slate-900 text-white text-xs font-black px-4 py-1.5 rounded-lg uppercase tracking-wider inline-block">
                    ESTADO DE PAGO N° {numEstadoPago || '1'}
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 mt-1.5">Fecha Emisión: <b>{new Date().toLocaleDateString('es-CL')}</b></p>
                </div>
              </div>

              {/* PERIODO LIQUIDADO EN ESTE DOCUMENTO */}
              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-300">
                <div className="no-print mb-2 pb-2 border-b border-slate-200">
                  <span className="text-[10.5px] font-extrabold text-amber-950 uppercase tracking-wider block mb-1">
                    🗓️ Seleccionar Periodo a Cobrar en este Estado de Pago:
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Fecha Desde *</label>
                      <input
                        type="date"
                        value={corteDesde}
                        onChange={(e) => setCorteDesde(e.target.value)}
                        className="w-full border border-amber-300 rounded-xl p-2 font-bold text-slate-800 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Fecha Hasta *</label>
                      <input
                        type="date"
                        value={corteHasta}
                        onChange={(e) => setCorteHasta(e.target.value)}
                        className="w-full border border-amber-300 rounded-xl p-2 font-bold text-slate-800 bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="text-center font-black text-xs uppercase tracking-wider text-slate-900">
                  PERIODO DE COBRO LIQUIDADO: <span className="bg-amber-200 text-amber-950 px-3 py-1 rounded-md text-xs">{fDesde} AL {fHasta}</span>
                </div>
              </div>

              {/* SECCIÓN 1 Y 2: IDENTIFICACIÓN DE ARRENDATARIO, OBRA Y EQUIPO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                
                {/* 1. INFORMACIÓN DE LA EMPRESA ARRENDATARIA */}
                <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-800 text-white p-2 font-black text-[10.5px] uppercase tracking-wider">
                    1. DATOS DEL CLIENTE ARRENDATARIO
                  </div>
                  <div className="p-3.5 space-y-1.5 text-slate-800 font-medium">
                    <p className="font-extrabold text-slate-900 uppercase text-xs">{arr.empresa_arrendataria}</p>
                    <p className="text-slate-600">RUT: <b className="text-slate-900">{arr.rut_empresa || 'S/I'}</b></p>
                    <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-100">Contacto: <b>{arr.contacto_nombre || arr.contacto_responsable || 'S/I'}</b></p>
                    <p className="text-[11px] text-slate-600">Teléfono: <b>{arr.contacto_telefono || 'S/I'}</b></p>
                    <p className="text-[11px] text-slate-600">Correo: <b>{arr.contacto_email || 'S/I'}</b></p>
                  </div>
                </div>

                {/* 2. DATOS DE LA OBRA Y EQUIPO */}
                <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-800 text-white p-2 font-black text-[10.5px] uppercase tracking-wider">
                    2. DATOS DE LA OBRA Y EQUIPO
                  </div>
                  <div className="p-3.5 space-y-1.5 text-slate-800 font-medium">
                    <p className="font-extrabold text-amber-900 uppercase text-xs">Obra: {arr.obra_cliente || 'N/A'}</p>
                    <p className="text-slate-600 text-[11px]">Dirección: {arr.direccion_obra || 'Sin Dirección Registrada'}</p>
                    <p className="text-[11px] text-slate-800 pt-1 border-t border-slate-100 font-bold">
                      Equipo: <span className="uppercase text-slate-900">{arr.equipo_tipo}</span> ({arr.equipo_patente})
                    </p>
                    <p className="text-[10.5px] text-slate-500">Contrato Vigente: {arr.fecha_inicio} al {arr.fecha_fin}</p>
                  </div>
                </div>

              </div>

              {/* SECCIÓN 3: RESUMEN DE LIQUIDACIÓN DE VALORES */}
              <div className="border border-slate-300 rounded-xl overflow-hidden bg-white text-xs">
                <div className="bg-slate-800 text-white p-2 font-black text-[10.5px] uppercase tracking-wider flex justify-between">
                  <span>3. RESUMEN DE LIQUIDACIÓN DE VALORES</span>
                  <span>UNIDAD TARIFA: {unidadTarifa}</span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] space-y-1 text-slate-700">
                    <div className="flex justify-between">
                      <span>Días Corridos del Periodo:</span>
                      <b>{cal.diasTotales} días</b>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>Días Hábiles / Laborales (Lun-Vie):</span>
                      <span>+{cal.diasLaborables} días cobrables</span>
                    </div>
                    {cal.diasNoLaborablesConUso > 0 && (
                      <div className="flex justify-between font-bold text-purple-900">
                        <span>Feriados / Fines de Semana con Uso Efectivo:</span>
                        <span>+{cal.diasNoLaborablesConUso} días cobrables</span>
                      </div>
                    )}
                    {cal.diasNoLaborablesSinUso > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Fines de Semana / Feriados Sin Uso:</span>
                        <span>{cal.diasNoLaborablesSinUso} días (Excluidos $0)</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 font-medium text-slate-800 pt-1">
                    <div className="flex justify-between items-center">
                      <span>Horas Trabajadas Reales en Faena (Bitácora):</span>
                      <b className="text-purple-900 text-sm">{hrsRealesTrabajadas} hrs</b>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total Unidades a Cobrar ({unidadCobroLabel}):</span>
                      <b className="text-slate-900 text-sm">{cantidadCobro} {unidadCobroLabel.toLowerCase()}</b>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Tarifa Convenida:</span>
                      <b>${tarifaMonto.toLocaleString('es-CL')} {unidadTarifa}</b>
                    </div>

                    {reglaMinimoAplicada && (
                      <div className="p-2 bg-amber-100 text-amber-950 font-bold text-[10.5px] rounded-md border border-amber-300">
                        ⚠️ TARIFA MÍNIMA APLICADA: Se cobró el mínimo convenido de {cantidadCobro} {unidadCobroLabel.toLowerCase()} ({arr.monto_tarifa_minima} {arr.unidad_tarifa_minima}).
                      </div>
                    )}

                    <div className="border-t-2 border-slate-200 pt-2 space-y-1">
                      <div className="flex justify-between items-center font-bold text-slate-900 text-xs">
                        <span>SUBTOTAL NETO:</span>
                        <span>${subtotal.toLocaleString('es-CL')}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 text-xs">
                        <span>IVA (19%):</span>
                        <span>${iva.toLocaleString('es-CL')}</span>
                      </div>
                      <div className="flex justify-between items-center text-base font-black bg-slate-900 text-white p-3 rounded-lg mt-2">
                        <span>TOTAL A PAGAR:</span>
                        <span className="text-lg text-amber-400">${total.toLocaleString('es-CL')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: ANEXO REGISTRO DIARIO DE HORÓMETROS (BITÁCORA EN FAENA) */}
              <div className="border border-slate-300 rounded-xl overflow-hidden bg-white text-xs">
                <div className="bg-slate-800 text-white p-2 font-black text-[10.5px] uppercase tracking-wider">
                  4. ANEXO: DETALLE REGISTRO DIARIO DE HORÓMETROS (${logsContrato.length} partes diarios)
                </div>

                {logsContrato.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 font-medium text-xs">
                    No se registran partes diarios individuales para el periodo seleccionado.
                  </div>
                ) : (
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-200 text-slate-900 font-black uppercase border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">Fecha</th>
                        <th className="p-2 border-r border-slate-300">H. Inicial</th>
                        <th className="p-2 border-r border-slate-300">H. Final</th>
                        <th className="p-2 border-r border-slate-300">Hrs Trabajadas</th>
                        <th className="p-2 border-r border-slate-300">Combustible</th>
                        <th className="p-2 border-r border-slate-300">Operador</th>
                        <th className="p-2">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {logsContrato.map((log, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-2 font-bold text-slate-900 border-r border-slate-200">{log.fecha}</td>
                          <td className="p-2 border-r border-slate-200">{log.horometro_inicial} hrs</td>
                          <td className="p-2 border-r border-slate-200">{log.horometro_final} hrs</td>
                          <td className="p-2 font-black text-slate-900 border-r border-slate-200">+{log.horas_trabajadas} hrs</td>
                          <td className="p-2 border-r border-slate-200">{log.combustible_cargado || 0} Lts</td>
                          <td className="p-2 border-r border-slate-200 text-slate-700">{log.operador}</td>
                          <td className="p-2 text-slate-600 italic">{log.observaciones || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SECCIÓN 5: FIRMAS Y CONFORMIDAD DE LAS PARTES */}
              <div className="pt-8 pb-4">
                <div className="grid grid-cols-2 gap-8 text-center text-xs">
                  <div className="space-y-12">
                    <div className="border-b-2 border-slate-800 w-3/4 mx-auto"></div>
                    <div>
                      <p className="font-black text-slate-900 uppercase">OBRAXIS SPA</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Entregado por / Administración Maquinaria</p>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <div className="border-b-2 border-slate-800 w-3/4 mx-auto"></div>
                    <div>
                      <p className="font-black text-slate-900 uppercase">{arr.empresa_arrendataria}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Conforme Cliente Arrendatario / Receptor Faena</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PIE DE PÁGINA DOCUMENTO OFICIAL */}
              <div className="pt-3 border-t border-slate-300 flex justify-between items-center text-[9.5px] text-slate-400 font-bold uppercase">
                <span>PORTAL OBRAXIS | VALUACIÓN OFICIAL DE ARRIENDO</span>
                <span>PÁGINA 1 DE 1</span>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL BITÁCORA / REPORTES DE USO DEL CONTRATO */}
      {viewingBitacoraArriendo && (() => {
        const arr = viewingBitacoraArriendo;
        const logs = usoList.filter(u => 
          u.equipo_id.toString() === arr.equipo_id.toString() &&
          u.fecha >= arr.fecha_inicio && u.fecha <= arr.fecha_fin
        );

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-purple-600" />
                    <span>Bitácora y Reportes de Uso del Contrato</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {arr.empresa_arrendataria} | Equipo: {arr.equipo_tipo} ({arr.equipo_patente})
                  </p>
                </div>
                <button onClick={() => setViewingBitacoraArriendo(null)} className="p-1.5 bg-slate-100 rounded-xl font-bold text-xs">✕</button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                  <Gauge className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">No se han registrado horómetros ni reportes de uso para este equipo en el periodo del contrato ({arr.fecha_inicio} al {arr.fecha_fin}).</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">H. Inicial</th>
                        <th className="p-3">H. Final</th>
                        <th className="p-3">Hrs Trab.</th>
                        <th className="p-3">Combustible</th>
                        <th className="p-3">Operador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((l, i) => (
                        <tr key={i} className="hover:bg-slate-50 font-medium text-slate-800">
                          <td className="p-3 font-bold text-slate-700">{l.fecha}</td>
                          <td className="p-3">{l.horometro_inicial} hrs</td>
                          <td className="p-3">{l.horometro_final} hrs</td>
                          <td className="p-3 font-black text-purple-900">+{l.horas_trabajadas} hrs</td>
                          <td className="p-3">{l.combustible_cargado || 0} Lts</td>
                          <td className="p-3 text-slate-600">{l.operador}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button onClick={() => setViewingBitacoraArriendo(null)} className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-sm">
                  Cerrar Bitácora
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      
      {/* MODAL IMPRESIÓN / GENERACIÓN DE CÓDIGO QR DEL EQUIPO */}
      {qrModalArriendo && (() => {
        const arr = qrModalArriendo;
        const baseUrl = window.location.origin;
        const qrTargetUrl = `${baseUrl}/?reporte_diario_equipo=${arr.equipo_id}&patente=${encodeURIComponent(arr.equipo_patente)}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrTargetUrl)}`;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-600" />
                  <span>Código QR para Cabina del Equipo</span>
                </h3>
                <button onClick={() => setQrModalArriendo(null)} className="p-1.5 rounded-xl bg-slate-100 font-bold text-xs text-slate-600 hover:bg-slate-200">✕</button>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div>
                  <p className="font-black text-slate-900 text-sm uppercase">{arr.equipo_tipo}</p>
                  <p className="font-extrabold text-blue-900 text-xs">Patente: {arr.equipo_patente}</p>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{arr.empresa_arrendataria} | Obra: {arr.obra_cliente || 'N/A'}</p>
                </div>

                <div className="w-56 h-56 bg-white border border-slate-300 rounded-2xl p-2 mx-auto flex items-center justify-center shadow-inner">
                  <img src={qrApiUrl} alt={`QR ${arr.equipo_patente}`} className="w-full h-full object-contain" />
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-tight">
                  Escanea este código QR con cualquier smartphone para ingresar el **Reporte Diario de Uso u Horómetros** del equipo en faena.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(qrTargetUrl);
                    alert('📋 ¡Enlace del formulario público de reporte diario copiado al portapapeles!');
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition cursor-pointer"
                >
                  📋 Copiar Enlace Directo
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black transition shadow-sm uppercase tracking-wider cursor-pointer"
                >
                  🖨️ Imprimir Cartel / Adhesivo QR
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL RESERVA DE EQUIPO FUTURO (CON CREACIÓN Y EDICIÓN) */}
      {reservaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-purple-600" />
              <span>{editingReserva ? 'Editar Reserva de Obra Futura' : 'Agendar Reserva de Obra Futura'}</span>
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
                <button type="submit" className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold">{editingReserva ? 'Guardar Cambios' : 'Confirmar Reserva'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ARRIENDOS A TERCEROS CON CAMPOS COMPLETOS Y VALIDACIÓN DE DISPONIBILIDAD */}
      {arriendoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <Handshake className="w-5 h-5 text-amber-600" />
              <span>Registrar Contrato de Arriendo a Tercero</span>
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
                    <option key={m.id} value={m.id}>{m.tipo} ({m.patente}) - {m.obra_nombre ? `En Faena: ${m.obra_nombre}` : 'Bodega Central'}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">RUT Empresa Cliente *</label>
                  <input
                    type="text"
                    placeholder="ej: 76.543.210-K"
                    value={arriendoForm.rut_empresa}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, rut_empresa: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Obra / Proyecto Destino *</label>
                  <input
                    type="text"
                    placeholder="ej: Proyecto Edificio Alto Las Condes"
                    value={arriendoForm.obra_cliente}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, obra_cliente: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Dirección de Faena</label>
                  <input
                    type="text"
                    placeholder="ej: Av. Vitacura #9900, Santiago"
                    value={arriendoForm.direccion_obra}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, direccion_obra: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Responsable *</label>
                  <input
                    type="text"
                    placeholder="ej: Carlos Mendoza"
                    value={arriendoForm.contacto_nombre}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, contacto_nombre: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Teléfono *</label>
                  <input
                    type="text"
                    placeholder="+56 9 8765 4321"
                    value={arriendoForm.contacto_telefono}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, contacto_telefono: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="contacto@empresa.cl"
                    value={arriendoForm.contacto_email}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, contacto_email: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Monto Tarifa ($) *</label>
                  <input
                    type="number"
                    placeholder="150000"
                    value={arriendoForm.tarifa_monto}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, tarifa_monto: e.target.value, tarifa_diaria: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Tipo Tarifa *</label>
                  <select
                    value={arriendoForm.unidad_tarifa}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, unidad_tarifa: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2 font-bold text-slate-800"
                  >
                    <option value="$/día">$/día</option>
                    <option value="$/hr">$/hr</option>
                    <option value="$/mes">$/mes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Fecha Desde *</label>
                  <input
                    type="date"
                    value={arriendoForm.fecha_inicio}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Fecha Hasta *</label>
                  <input
                    type="date"
                    value={arriendoForm.fecha_fin}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2 font-bold"
                    required
                  />
                </div>
              </div>

              {/* SECCIÓN TARIFA MÍNIMA GARANTIZADA */}
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk_tarifa_minima"
                    checked={arriendoForm.aplica_tarifa_minima}
                    onChange={(e) => setArriendoForm(prev => ({ ...prev, aplica_tarifa_minima: e.target.checked }))}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="chk_tarifa_minima" className="font-extrabold text-amber-950 text-xs cursor-pointer">
                    Considerar Tarifa Mínima Garantizada (Mínimo de Cobro)
                  </label>
                </div>

                {arriendoForm.aplica_tarifa_minima && (
                  <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in">
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Unidad Mínimo</label>
                      <select
                        value={arriendoForm.unidad_tarifa_minima}
                        onChange={(e) => setArriendoForm(prev => ({ ...prev, unidad_tarifa_minima: e.target.value }))}
                        className="w-full border border-amber-200 rounded-xl p-2 font-bold text-slate-800 bg-white text-xs"
                      >
                        <option value="hrs/día">hrs/día</option>
                        <option value="hrs/mes">hrs/mes</option>
                        <option value="días/mes">días/mes</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-amber-900 mb-1">Mínimo Exigido</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="ej: 5"
                        value={arriendoForm.monto_tarifa_minima}
                        onChange={(e) => setArriendoForm(prev => ({ ...prev, monto_tarifa_minima: e.target.value }))}
                        className="w-full border border-amber-200 rounded-xl p-2 font-bold text-slate-800 bg-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Observaciones / Condiciones</label>
                <textarea
                  rows="2"
                  placeholder="Condiciones de despacho, operador incluido, póliza de seguro..."
                  value={arriendoForm.observaciones}
                  onChange={(e) => setArriendoForm(prev => ({ ...prev, observaciones: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setArriendoModalOpen(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold shadow-sm">Confirmar Contrato</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ASIGNACIÓN DIRECTA CON FECHA HASTA ESTIMADA */}
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

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold uppercase text-slate-600">Fecha Hasta (Término Estimado)</label>
                <input
                  type="date"
                  value={assignFechaHasta}
                  onChange={(e) => setAssignFechaHasta(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800"
                />
                <span className="text-[9.5px] text-slate-400">Permite liberar o coordinar con la agenda de reservas futuras sin solapar periodos.</span>
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
              {viewingEquip.fecha_hasta_estimada && <p><b>Asignado Hasta:</b> <span className="font-bold text-amber-800">{viewingEquip.fecha_hasta_estimada}</span></p>}
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
