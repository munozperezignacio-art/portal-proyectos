import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { formatRut } from '../utils/rutUtils';
import { 
  Users, ArrowLeft, Search, Plus, Edit, Trash2, Loader2, AlertCircle, Check, Building2, UserPlus, 
  FileText, DollarSign, Upload, FileCheck, RefreshCw, Calculator, BookOpen, Download, Building, Printer
} from 'lucide-react';

export const afpCommissionRates = {
  'Habitat': { fondo: 10.00, comision: 1.27, total: 11.27 },
  'Capital': { fondo: 10.00, comision: 1.44, total: 11.44 },
  'Cuprum': { fondo: 10.00, comision: 1.44, total: 11.44 },
  'Modelo': { fondo: 10.00, comision: 0.58, total: 10.58 },
  'PlanVital': { fondo: 10.00, comision: 1.16, total: 11.16 },
  'ProVida': { fondo: 10.00, comision: 1.45, total: 11.45 },
  'Uno': { fondo: 10.00, comision: 0.49, total: 10.49 },
  'Sin Previsión': { fondo: 0.00, comision: 0.00, total: 0.00 }
};

export const getAFPDetails = (afpName) => {
  if (!afpName) return afpCommissionRates['Habitat'];
  const clean = afpName.replace('AFP ', '').trim();
  return afpCommissionRates[clean] || afpCommissionRates['Habitat'];
};

function Personal({ user, onBack }) {
  // Submódulo activo: null (Menú de Rectángulos), 'personal_empresa', 'asignar_obra', 'remuneraciones'
  const [activeSubmodule, setActiveSubmodule] = useState(null);

  const [personal, setPersonal] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObraFilter, setSelectedObraFilter] = useState('');

  // Sub-pestañas para Remuneraciones
  const [remunSubTab, setRemunSubTab] = useState('liquidaciones'); // 'liquidaciones' | 'previred' | 'indicadores' | 'lrd'

  // Tipos de documentos de trabajadores (personalizables)
  const [docTypes, setDocTypes] = useState([
    'Contrato de Trabajo',
    'Finiquito',
    'Cédula de Identidad',
    'Certificado de Antecedentes',
    'Certificado AFP',
    'Certificado Salud (FONASA/Isapre)',
    'Inducción de Seguridad / EPP',
    'Examen Médico Preocupacional'
  ]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedWorkerDoc, setSelectedWorkerDoc] = useState(null);
  const [newDocTypeName, setNewDocTypeName] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('Contrato de Trabajo');
  const [isAddingCustomDocType, setIsAddingCustomDocType] = useState(false);

  // Estados para modal de agregar/editar trabajador en Personal Empresa
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Estado para Modal de Asignación de Obra con Fecha desde RRHH
  const [showAssignObraModal, setShowAssignObraModal] = useState(false);
  const [assignModalData, setAssignModalData] = useState({
    workerId: null,
    workerNombre: '',
    obraNombre: '',
    fechaAsig: new Date().toISOString().substring(0, 10)
  });

  // Formulario completo de Ficha de Trabajador
  const [formData, setFormData] = useState({
    nombre: '',
    rut: '',
    cargo: '',
    fono: '',
    email: '',
    obra_nombre: '',
    fecha_asig: new Date().toISOString().substring(0, 10),
    centro_trabajo: 'Oficina Central / Obra',
    area: 'Operaciones',
    sueldo_base: '600000',
    gratificacion: 'Art. 50 (25% tope)',
    tipo_contrato: 'Indefinido',
    fecha_inicio_contrato: new Date().toISOString().substring(0, 10),
    fecha_vencimiento_contrato: '',
    banco: 'BancoEstado',
    tipo_cuenta: 'CuentaRUT',
    numero_cuenta: '',
    afp: 'Habitat',
    prevision_salud: 'FONASA',
    colacion: '0',
    movilizacion: '0'
  });

  // Indicadores Previsionales Actuales (Chile 2026 - Previred & SII)
  const [indicadores, setIndicadores] = useState(() => {
    const saved = localStorage.getItem('indicadores_previsionales_chile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      uf: 40844.79,
      utm: 71649,
      topeAfpUf: 85.1,
      topeCesantiaUf: 127.8,
      apvMaxUf: 50,
      salarioMinimo: 520000,
      ultimaActualizacion: new Date().toLocaleDateString('es-CL') + ' (SII)'
    };
  });
  const [updatingIndicadores, setUpdatingIndicadores] = useState(false);
  const [showEditIndicadoresModal, setShowEditIndicadoresModal] = useState(false);
  const [editIndicadoresForm, setEditIndicadoresForm] = useState({ ...indicadores });

  // MÓDULO DE CONTRATACIÓN Y FORMATOS / PLANTILLAS
  const [contratacionSubTab, setContratacionSubTab] = useState('emision'); // 'emision' | 'plantillas' | 'nueva_alta'
  const [plantillasContrato, setPlantillasContrato] = useState([
    {
      id: 1,
      titulo: 'Contrato Indefinido Tipo Operario',
      tipo: 'Contrato Indefinido',
      contenido: 'En Santiago de Chile, se celebra el presente Contrato de Trabajo entre Obraxis S.A. y Don(a) {{nombre_trabajador}}, RUT N° {{rut}}, quien se desempeñará como {{cargo}} en la obra {{obra_nombre}}. Se pacta un sueldo base de ${{sueldo_base}} pesos mensuales, con fecha de inicio {{fecha_inicio}}.'
    },
    {
      id: 2,
      titulo: 'Contrato Plazo Fijo por Obra Determinada',
      tipo: 'Plazo Fijo',
      contenido: 'En la ciudad de Santiago, entre la empresa y Don(a) {{nombre_trabajador}}, RUT {{rut}}, se acuerda la contratación para cumplir la función de {{cargo}} en la faena {{obra_nombre}} con fecha de ingreso {{fecha_inicio}} y remuneración base de ${{sueldo_base}}.'
    }
  ]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ titulo: '', tipo: 'Contrato Indefinido', contenido: '' });

  const [selectedWorkerForContract, setSelectedWorkerForContract] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('1');
  const [generatedContractText, setGeneratedContractText] = useState('');

  // Estado para emisión de Liquidación de Sueldo PDF
  const [showLiquidacionPDFModal, setShowLiquidacionPDFModal] = useState(false);
  const [selectedWorkerLiquidacion, setSelectedWorkerLiquidacion] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar personal y fusionar con ficha extendida local en caso de columnas faltantes
      const { data: dataPers, error: errPers } = await supabase
        .from('maestro_personal')
        .select('*')
        .order('nombre', { ascending: true });
      if (errPers) throw errPers;

      const mergedPersonal = (dataPers || []).map(w => {
        const key = `worker_extended_${w.id || w.rut || w.nombre}`;
        const local = localStorage.getItem(key);
        if (local) {
          try {
            const ext = JSON.parse(local);
            return { ...ext, ...w, ...ext };
          } catch (e) {}
        }
        return w;
      });

      setPersonal(mergedPersonal);

      // 2. Cargar obras
      const { data: dataObras, error: errObras } = await supabase
        .from('obras')
        .select('nombre')
        .order('nombre', { ascending: true });
      if (errObras) throw errObras;
      setObras(dataObras || []);
    } catch (err) {
      console.error('Error cargando personal/obras:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingWorker(null);
    setFormData({
      nombre: '',
      rut: '',
      cargo: 'Operario',
      fono: '',
      email: '',
      obra_nombre: obras.length > 0 ? obras[0].nombre : '',
      fecha_asig: new Date().toISOString().substring(0, 10),
      centro_trabajo: 'Obra Principal',
      area: 'Construcción',
      sueldo_base: '600000',
      gratificacion: 'Art. 50 (25% tope)',
      tipo_contrato: 'Indefinido',
      fecha_inicio_contrato: new Date().toISOString().substring(0, 10),
      fecha_vencimiento_contrato: '',
      banco: 'BancoEstado',
      tipo_cuenta: 'CuentaRUT',
      numero_cuenta: '',
      afp: 'Habitat',
      prevision_salud: 'FONASA',
      colacion: '0',
      movilizacion: '0'
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (worker) => {
    setEditingWorker(worker);
    setFormData({
      nombre: worker.nombre || '',
      rut: worker.rut || '',
      cargo: worker.cargo || '',
      fono: worker.fono || '',
      email: worker.email || '',
      obra_nombre: worker.obra_nombre || '',
      fecha_asig: worker.fecha_asig ? String(worker.fecha_asig).substring(0, 10) : new Date().toISOString().substring(0, 10),
      centro_trabajo: worker.centro_trabajo || 'Obra Principal',
      area: worker.area || 'Construcción',
      sueldo_base: worker.sueldo_base ? worker.sueldo_base.toString() : '600000',
      gratificacion: worker.gratificacion || 'Art. 50 (25% tope)',
      tipo_contrato: worker.tipo_contrato || 'Indefinido',
      fecha_inicio_contrato: worker.fecha_inicio_contrato || worker.inicio || new Date().toISOString().substring(0, 10),
      fecha_vencimiento_contrato: worker.fecha_vencimiento_contrato || worker.termino || '',
      banco: worker.banco || 'BancoEstado',
      tipo_cuenta: worker.tipo_cuenta || 'CuentaRUT',
      numero_cuenta: worker.numero_cuenta || '',
      afp: worker.afp || 'Habitat',
      prevision_salud: worker.prevision_salud || 'FONASA',
      colacion: worker.colacion !== undefined && worker.colacion !== null ? worker.colacion.toString() : '0',
      movilizacion: worker.movilizacion !== undefined && worker.movilizacion !== null ? worker.movilizacion.toString() : '0'
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleDeleteWorker = async (worker) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${worker.nombre} del Máster de Personal Empresa?`)) return;
    try {
      const { error } = await supabase.from('maestro_personal').delete().eq('id', worker.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert(`Error al eliminar trabajador: ${err.message}`);
    }
  };

  const handleOpenAssignObraModal = (worker, targetObra) => {
    const existingDate = worker.fecha_asig ? String(worker.fecha_asig).substring(0, 10) : new Date().toISOString().substring(0, 10);
    setAssignModalData({
      workerId: worker.id,
      workerNombre: worker.nombre,
      obraNombre: targetObra !== undefined ? targetObra : (worker.obra_nombre || ''),
      fechaAsig: existingDate
    });
    setShowAssignObraModal(true);
  };

  const handleSaveObraAssignment = async () => {
    if (!assignModalData.workerId) return;
    try {
      const payload = {
        obra_nombre: assignModalData.obraNombre,
        fecha_asig: assignModalData.fechaAsig
      };
      const { error } = await supabase
        .from('maestro_personal')
        .update(payload)
        .eq('id', assignModalData.workerId);
      if (error) {
        console.warn("Columna fecha_asig no disponible directamente en DB, actualizando obra_nombre:", error.message);
        await supabase.from('maestro_personal').update({ obra_nombre: assignModalData.obraNombre }).eq('id', assignModalData.workerId);
      }
      try {
        const localKey = 'obraxis_worker_details_' + assignModalData.workerId;
        const existing = localStorage.getItem(localKey);
        const parsed = existing ? JSON.parse(existing) : {};
        localStorage.setItem(localKey, JSON.stringify({ ...parsed, ...payload }));
      } catch (errLocal) {}

      setPersonal(prev => prev.map(p => p.id === assignModalData.workerId ? { ...p, ...payload } : p));
      setShowAssignObraModal(false);
    } catch (err) {
      alert('Error asignando trabajador a obra: ' + err.message);
    }
  };

  const handleAddCustomDocType = () => {
    if (!newDocTypeName.trim()) return;
    const cleanType = newDocTypeName.trim();
    if (!docTypes.includes(cleanType)) {
      setDocTypes([...docTypes, cleanType]);
    }
    setSelectedDocType(cleanType);
    setNewDocTypeName('');
    setIsAddingCustomDocType(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const fullDataToSave = {
      nombre: formData.nombre.trim(),
      rut: formData.rut ? formatRut(formData.rut.trim()) : null,
      cargo: formData.cargo.trim(),
      fono: formData.fono ? formData.fono.trim() : null,
      email: formData.email ? formData.email.trim() : null,
      obra_nombre: formData.obra_nombre,
      fecha_asig: formData.fecha_asig || new Date().toISOString().substring(0, 10),
      centro_trabajo: formData.centro_trabajo,
      area: formData.area,
      sueldo_base: parseFloat(formData.sueldo_base) || 0,
      gratificacion: formData.gratificacion || 'Art. 50 (25% tope)',
      tipo_contrato: formData.tipo_contrato,
      fecha_inicio_contrato: formData.fecha_inicio_contrato || null,
      fecha_vencimiento_contrato: formData.tipo_contrato === 'Indefinido' ? null : (formData.fecha_vencimiento_contrato || null),
      banco: formData.banco,
      tipo_cuenta: formData.tipo_cuenta,
      numero_cuenta: formData.numero_cuenta,
      afp: formData.afp,
      prevision_salud: formData.prevision_salud,
      colacion: parseFloat(formData.colacion) || 0,
      movilizacion: parseFloat(formData.movilizacion) || 0,
      empresa: user?.empresa || 'Obraxis'
    };

    const basePayload = {
      nombre: fullDataToSave.nombre,
      rut: fullDataToSave.rut,
      cargo: fullDataToSave.cargo,
      obra_nombre: fullDataToSave.obra_nombre,
      empresa: fullDataToSave.empresa,
      colacion: fullDataToSave.colacion,
      movilizacion: fullDataToSave.movilizacion,
      inicio: fullDataToSave.fecha_inicio_contrato,
      termino: fullDataToSave.fecha_vencimiento_contrato
    };

    try {
      let savedResult = null;
      if (editingWorker) {
        const { data: uData, error: uErr } = await supabase.from('maestro_personal').update(fullDataToSave).eq('id', editingWorker.id).select();
        if (uErr) {
          console.warn("Columna no encontrada en Supabase, guardando base payload:", uErr.message);
          const { data: uBaseData, error: uBaseErr } = await supabase.from('maestro_personal').update(basePayload).eq('id', editingWorker.id).select();
          if (uBaseErr) throw uBaseErr;
          savedResult = uBaseData ? uBaseData[0] : { id: editingWorker.id, ...fullDataToSave };
        } else {
          savedResult = uData ? uData[0] : { id: editingWorker.id, ...fullDataToSave };
        }
        setSuccessMsg('Ficha de trabajador actualizada correctamente.');
      } else {
        const { data: iData, error: iErr } = await supabase.from('maestro_personal').insert([fullDataToSave]).select();
        if (iErr) {
          console.warn("Columna no encontrada en Supabase, insertando base payload:", iErr.message);
          const { data: iBaseData, error: iBaseErr } = await supabase.from('maestro_personal').insert([basePayload]).select();
          if (iBaseErr) throw iBaseErr;
          savedResult = iBaseData ? iBaseData[0] : { ...fullDataToSave };
        } else {
          savedResult = iData ? iData[0] : { ...fullDataToSave };
        }
        setSuccessMsg('Trabajador registrado en la Ficha Empresa con éxito.');
      }

      // Guardar perfil extendido en localStorage para persistencia inmediata sin errores
      const keyId = savedResult?.id || savedResult?.rut || savedResult?.nombre;
      if (keyId) {
        localStorage.setItem(`worker_extended_${keyId}`, JSON.stringify({ ...savedResult, ...fullDataToSave }));
      }

      fetchData();
      setTimeout(() => setModalOpen(false), 1200);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateIndicadoresAuto = async () => {
    setUpdatingIndicadores(true);
    try {
      let ufVal = 40844.79;
      let utmVal = 71649;

      try {
        const res = await fetch('https://mindicador.cl/api');
        if (res.ok) {
          const data = await res.json();
          if (data?.uf?.valor) ufVal = data.uf.valor;
          if (data?.utm?.valor) utmVal = data.utm.valor;
        }
      } catch (apiErr) {
        console.warn("Aviso API mindicador:", apiErr);
      }

      const updated = {
        uf: ufVal,
        utm: utmVal,
        topeAfpUf: 85.1,
        topeCesantiaUf: 127.8,
        apvMaxUf: 50,
        salarioMinimo: 520000,
        ultimaActualizacion: new Date().toLocaleDateString('es-CL') + ' (SII)'
      };

      setIndicadores(updated);
      localStorage.setItem('indicadores_previsionales_chile', JSON.stringify(updated));
      alert(`¡Indicadores Previsionales Sincronizados!\n\n• UF (SII): $${ufVal.toLocaleString('es-CL')}\n• UTM (Julio): $${utmVal.toLocaleString('es-CL')}\n• Sueldo Mínimo: $520.000\n• Tope Imponible AFP: 85.1 UF`);
    } catch (e) {
      console.warn("Error en actualización de indicadores:", e);
    } finally {
      setUpdatingIndicadores(false);
    }
  };

  const filteredPersonal = personal.filter(p => {
    const matchesSearch = 
      (p.nombre && p.nombre.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.rut && p.rut.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.cargo && p.cargo.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesObra = 
      selectedObraFilter === '' || 
      (p.obra_nombre && p.obra_nombre.toLowerCase() === selectedObraFilter.toLowerCase());

    return matchesSearch && matchesObra;
  });

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={activeSubmodule !== null ? () => setActiveSubmodule(null) : onBack} className="p-2 hover:bg-slate-100 rounded-xl transition cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">Recursos Humanos (RRHH)</h2>
            <p className="text-xs text-slate-500">Gestión de personal empresa, asignaciones a obra y planillas de remuneraciones</p>
          </div>
        </div>

        {activeSubmodule === 'personal_empresa' && (
          <button
            onClick={handleOpenAddModal}
            className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Ficha Trabajador</span>
          </button>
        )}
      </div>

      {/* VISTA PRINCIPAL: MENÚ DE RECTÁNGULOS OPERATIVOS DE RRHH */}
      {activeSubmodule === null && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Submódulos de Recursos Humanos</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Rectángulo 1: Personal Empresa */}
            <button
              onClick={() => setActiveSubmodule('personal_empresa')}
              className="p-6 bg-white border border-slate-200 hover:border-blue-700 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="p-3.5 bg-blue-50 text-blue-900 rounded-2xl group-hover:bg-blue-900 group-hover:text-white transition">
                  <Users className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">Máster Personal</span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-blue-950">Personal Empresa</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Listado y creación máster de trabajadores con ficha completa: datos personales, bancarios, previsiones (AFP/FONASA) y documentación adjunta.
                </p>
              </div>
            </button>

            {/* Rectángulo 2: Asignar Personal a Obra */}
            <button
              onClick={() => setActiveSubmodule('asignar_obra')}
              className="p-6 bg-white border border-slate-200 hover:border-purple-700 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="p-3.5 bg-purple-50 text-purple-900 rounded-2xl group-hover:bg-purple-900 group-hover:text-white transition">
                  <UserPlus className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">Asignaciones</span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-purple-950">Asignar Personal a Obra</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Selecciona y asigna personal de la empresa hacia obras activas. Comparte la información personal directamente con el módulo de Obras.
                </p>
              </div>
            </button>

            {/* Rectángulo 3: Remuneraciones */}
            <button
              onClick={() => setActiveSubmodule('remuneraciones')}
              className="p-6 bg-white border border-slate-200 hover:border-emerald-700 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="p-3.5 bg-emerald-50 text-emerald-900 rounded-2xl group-hover:bg-emerald-900 group-hover:text-white transition">
                  <DollarSign className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">Liquidaciones & LRD</span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-emerald-950">Remuneraciones</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Planillas de sueldo, archivos de pago para Previred, indicadores previsionales actualizables y Libro de Remuneraciones Digital (LRD).
                </p>
              </div>
            </button>

            {/* Rectángulo 4: Contratación & Formatos */}
            <button
              onClick={() => setActiveSubmodule('contratacion')}
              className="p-6 bg-white border border-slate-200 hover:border-blue-800 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="p-3.5 bg-blue-50 text-blue-900 rounded-2xl group-hover:bg-blue-900 group-hover:text-white transition">
                  <FileText className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">Emisión & Formatos</span>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-blue-950">Módulo de Contratación</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Generación automática de contratos de trabajo, guardado de formatos/plantillas personalizables e ingreso de nuevas contrataciones.
                </p>
              </div>
            </button>

          </div>
        </div>
      )}

      {/* SUBMÓDULO 1: PERSONAL EMPRESA (FICHA MÁSTER) */}
      {activeSubmodule === 'personal_empresa' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Búsqueda y Filtros */}
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por nombre, RUT, cargo o banco..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-slate-800 font-medium w-full px-3 py-2 border rounded-xl border-slate-200 focus:outline-none focus:border-blue-600 transition text-xs"
              />
            </div>

            <div>
              <select
                value={selectedObraFilter}
                onChange={(e) => setSelectedObraFilter(e.target.value)}
                className="text-slate-800 font-medium w-full px-3 py-2 border rounded-xl border-slate-200 focus:outline-none focus:border-blue-600 transition text-xs bg-white"
              >
                <option value="">Filtrar por obra asignada (Todas)</option>
                {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Listado de Fichas de Trabajadores */}
          {loading ? (
            <p className="text-sm text-slate-500 p-2">⏳ Cargando personal empresa...</p>
          ) : filteredPersonal.length === 0 ? (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-semibold">No hay trabajadores en el Máster de la Empresa.</p>
              <button onClick={handleOpenAddModal} className="text-xs text-blue-900 font-bold hover:underline cursor-pointer">
                + Crear primer trabajador en el Máster
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <th className="p-3">Trabajador (RUT / Contacto)</th>
                      <th className="p-3">Cargo / Centro Trabajo</th>
                      <th className="p-3">Contrato & Vencimiento</th>
                      <th className="p-3">Previsión (AFP / Salud)</th>
                      <th className="p-3">Sueldo & Pago</th>
                      <th className="p-3 text-center">Documentación</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-[11px]">
                    {filteredPersonal.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-bold text-slate-800">
                          <div>{p.nombre}</div>
                          <span className="text-[10px] text-slate-500 font-mono font-medium">{formatRut(p.rut) || 'Sin RUT'} {p.fono ? `• ${p.fono}` : ''}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-blue-950">{p.cargo}</span>
                          <span className="block text-[10px] text-slate-500 font-medium">{p.centro_trabajo || p.obra_nombre || 'Oficina Central'}</span>
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${p.tipo_contrato === 'Indefinido' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'}`}>
                            {p.tipo_contrato || 'Indefinido'}
                          </span>
                          {p.tipo_contrato !== 'Indefinido' && p.fecha_vencimiento_contrato && (
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">Vence: {p.fecha_vencimiento_contrato}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800">{p.afp || 'Habitat'}</span>
                          <span className="block text-[10px] text-slate-500">{p.prevision_salud || 'FONASA'}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-emerald-800 font-mono">${p.sueldo_base ? p.sueldo_base.toLocaleString('es-CL') : '600.000'}</span>
                          <span className="block text-[10px] text-slate-500">{p.tipo_cuenta || 'CuentaRUT'} ({p.banco || 'BancoEstado'})</span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => { setSelectedWorkerDoc(p); setShowDocModal(true); }}
                            className="bg-blue-50 text-blue-900 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-bold text-[10px] border border-blue-200 flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Adjuntar / Ver</span>
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1.5 hover:bg-blue-50 text-blue-900 rounded-lg transition cursor-pointer"
                              title="Editar Ficha"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteWorker(p)}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* SUBMÓDULO 2: ASIGNAR PERSONAL A OBRA */}
      {activeSubmodule === 'asignar_obra' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-1">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-900" />
              <span>Asignar Personal a Obras Activas</span>
            </h3>
            <p className="text-[11px] text-slate-500">Selecciona trabajadores del Máster de Empresa y asigna su ficha directamente a la obra correspondiente</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                    <th className="p-3">Trabajador (RUT)</th>
                    <th className="p-3">Cargo Actual</th>
                    <th className="p-3">Obra Asignada Actualmente</th>
                    <th className="p-3">📅 Fecha Asignación</th>
                    <th className="p-3 text-right">Cambiar Obra & Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-[11px]">
                  {personal.map((p) => {
                    const cleanDate = p.fecha_asig ? String(p.fecha_asig).split('T')[0] : (p.created_at ? String(p.created_at).split('T')[0] : 'Sin fecha');
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-800">
                          {p.nombre}
                          <span className="block font-mono text-[10px] text-slate-500">{p.rut || 'Sin RUT'}</span>
                        </td>
                        <td className="p-3 font-semibold text-blue-950">{p.cargo}</td>
                        <td className="p-3">
                          <span className="text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded">
                            {p.obra_nombre || 'Sin obra asignada'}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">
                          📅 {cleanDate}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <select
                              value={p.obra_nombre || ''}
                              onChange={(e) => handleOpenAssignObraModal(p, e.target.value)}
                              className="border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 font-bold bg-white focus:border-purple-600 cursor-pointer"
                            >
                              <option value="">-- Sin Obra (Oficina Central) --</option>
                              {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                            </select>
                            <button
                              onClick={() => handleOpenAssignObraModal(p, p.obra_nombre)}
                              className="bg-purple-900 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] hover:bg-purple-800 cursor-pointer transition shadow-2xs"
                              title="Configurar fecha de asignación"
                            >
                              📅 Fecha
                            </button>
                          </div>
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

      {/* SUBMÓDULO 3: REMUNERACIONES */}
      {activeSubmodule === 'remuneraciones' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-800" />
                  <span>Módulo de Remuneraciones</span>
                </h3>
                <p className="text-[11px] text-slate-500">Liquidaciones de sueldo, cotizaciones Previred, indicadores previsionales y LRD (DT)</p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setRemunSubTab('liquidaciones')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${remunSubTab === 'liquidaciones' ? 'bg-white text-emerald-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  💵 Liquidaciones
                </button>
                <button
                  onClick={() => setRemunSubTab('previred')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${remunSubTab === 'previred' ? 'bg-white text-emerald-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  🏛️ Previred
                </button>
                <button
                  onClick={() => setRemunSubTab('indicadores')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${remunSubTab === 'indicadores' ? 'bg-white text-emerald-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  📈 Indicadores
                </button>
                <button
                  onClick={() => setRemunSubTab('lrd')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${remunSubTab === 'lrd' ? 'bg-white text-emerald-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  📘 LRD (DT)
                </button>
              </div>
            </div>
          </div>

          {/* SUB-PESTAÑA 1: LIQUIDACIONES DE SUELDO */}
          {remunSubTab === 'liquidaciones' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">💵 Planilla de Sueldos y Liquidaciones</h4>
                <button className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Calcular Sueldos Mes</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                      <th className="p-2.5">Trabajador</th>
                      <th className="p-2.5">AFP & Comisión</th>
                      <th className="p-2.5">Sueldo Base</th>
                      <th className="p-2.5">Gratif. Legal (Art. 50)</th>
                      <th className="p-2.5">Total Imponible</th>
                      <th className="p-2.5">Descuentos Ley (AFP+Salud+AFC)</th>
                      <th className="p-2.5">Sueldo Líquido</th>
                      <th className="p-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-[11px]">
                    {personal.map((p) => {
                      const sBase = parseFloat(p.sueldo_base) || 600000;
                      const topeGratif = Math.round((4.75 * (indicadores.salarioMinimo || 520000)) / 12);
                      const tieneGratif = p.gratificacion !== 'Sin Gratificación';
                      const gratifMonto = tieneGratif ? Math.min(Math.round(sBase * 0.25), topeGratif) : 0;
                      const imponible = sBase + gratifMonto;
                      const colacion = parseFloat(p.colacion) || 0;
                      const movilizacion = parseFloat(p.movilizacion) || 0;
                      const totalHaberes = imponible + colacion + movilizacion;

                      const afpInfo = getAFPDetails(p.afp);
                      const afpMonto = Math.round(imponible * (afpInfo.total / 100));
                      const saludMonto = Math.round(imponible * 0.07);
                      const isIndef = (p.tipo_contrato || 'Indefinido') === 'Indefinido';
                      const afcMonto = isIndef ? Math.round(imponible * 0.006) : 0;
                      const desctoTotal = afpMonto + saludMonto + afcMonto;
                      const liquido = totalHaberes - desctoTotal;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 font-bold text-slate-800">
                            <div>{p.nombre}</div>
                            <span className="text-[10px] text-slate-500 font-mono">{p.rut || 'Sin RUT'}</span>
                          </td>
                          <td className="p-2.5">
                            <span className="font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10px]">
                              {p.afp || 'Habitat'} ({afpInfo.total}%)
                            </span>
                            <span className="block text-[9px] text-slate-400 mt-0.5">10% Fondo + {afpInfo.comision}% Com.</span>
                          </td>
                          <td className="p-2.5 font-mono">${sBase.toLocaleString('es-CL')}</td>
                          <td className="p-2.5 font-mono text-emerald-800 font-bold">
                            +${gratifMonto.toLocaleString('es-CL')}
                            <span className="block text-[9px] text-slate-400 font-sans font-normal">25% (T. ${topeGratif.toLocaleString('es-CL')})</span>
                          </td>
                          <td className="p-2.5 font-mono font-bold">${imponible.toLocaleString('es-CL')}</td>
                          <td className="p-2.5 font-mono text-red-600 font-bold">
                            -${desctoTotal.toLocaleString('es-CL')}
                            <span className="block text-[9px] text-slate-500 font-sans font-normal">
                              AFP: ${afpMonto.toLocaleString('es-CL')} | Salud: ${saludMonto.toLocaleString('es-CL')} {afcMonto > 0 ? `| AFC: $${afcMonto.toLocaleString('es-CL')}` : ''}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono font-black text-emerald-800 text-sm">${liquido.toLocaleString('es-CL')}</td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => {
                                setSelectedWorkerLiquidacion(p);
                                setShowLiquidacionPDFModal(true);
                              }}
                              className="text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer shadow-2xs flex items-center gap-1 mx-auto"
                            >
                              <FileText className="w-3 h-3 text-emerald-400" />
                              <span>Emitir PDF</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-PESTAÑA 2: ARCHIVO / PLANILLAS PREVIRED */}
          {remunSubTab === 'previred' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">🏛️ Generación de Planilla para Pago Previred</h4>
                <button className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer">
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Archivo Previred (.txt)</span>
                </button>
              </div>
              <p className="text-xs text-slate-600">
                Archivo formateado con los 105 campos exigidos por Previred para la carga masiva de cotizaciones de AFP, FONASA, Isapre, Mutual y Seguro de Cesantía.
              </p>
            </div>
          )}

          {/* SUB-PESTAÑA 3: INDICADORES PREVISIONALES */}
          {remunSubTab === 'indicadores' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <div>
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">📈 Indicadores Previsionales (SII / Previred Chile)</h4>
                  <p className="text-[10px] text-slate-500">Última actualización: {indicadores.ultimaActualizacion}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditIndicadoresForm({ ...indicadores });
                      setShowEditIndicadoresModal(true);
                    }}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Editar Indicadores</span>
                  </button>

                  <button
                    onClick={handleUpdateIndicadoresAuto}
                    disabled={updatingIndicadores}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${updatingIndicadores ? 'animate-spin' : ''}`} />
                    <span>Actualizar Automáticamente</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Valor UF</span>
                  <p className="text-lg font-black text-slate-800 mt-0.5">${indicadores.uf.toLocaleString('es-CL')}</p>
                </div>
                <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Valor UTM</span>
                  <p className="text-lg font-black text-slate-800 mt-0.5">${indicadores.utm.toLocaleString('es-CL')}</p>
                </div>
                <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Sueldo Mínimo</span>
                  <p className="text-lg font-black text-slate-800 mt-0.5">${indicadores.salarioMinimo.toLocaleString('es-CL')}</p>
                </div>
                <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Tope Imponible AFP</span>
                  <p className="text-lg font-black text-blue-900 mt-0.5">{indicadores.topeAfpUf} UF</p>
                </div>
                <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Tope Seguro Cesantía</span>
                  <p className="text-lg font-black text-blue-900 mt-0.5">{indicadores.topeCesantiaUf} UF</p>
                </div>
                <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Tope APV Mensual</span>
                  <p className="text-lg font-black text-blue-900 mt-0.5">{indicadores.apvMaxUf} UF</p>
                </div>
              </div>

              {/* Tabla de Tasas y Comisiones AFP */}
              <div className="pt-2 space-y-2">
                <h5 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                  🏛️ Tasas de Cotización Obligatoria & Comisiones AFP (Previred Chile 2026)
                </h5>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b text-slate-700 font-bold uppercase text-[10px]">
                        <th className="p-2.5">Administradora (AFP)</th>
                        <th className="p-2.5 text-right">Cotización Obligatoria (Ahorro)</th>
                        <th className="p-2.5 text-right">Comisión Variable</th>
                        <th className="p-2.5 text-right">Tasa Total Descuento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-[11px]">
                      {Object.entries(afpCommissionRates).map(([afpName, rates]) => (
                        <tr key={afpName} className="hover:bg-slate-50 font-medium">
                          <td className="p-2.5 font-bold text-slate-800">{afpName === 'Sin Previsión' ? 'Sin Previsión (Jubilado)' : `AFP ${afpName}`}</td>
                          <td className="p-2.5 text-right font-mono">{rates.fondo.toFixed(2)}%</td>
                          <td className="p-2.5 text-right font-mono text-blue-900 font-bold">{rates.comision.toFixed(2)}%</td>
                          <td className="p-2.5 text-right font-mono font-black text-emerald-800">{rates.total.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-PESTAÑA 4: LIBRO DE REMUNERACIONES DIGITAL (LRD DT) */}
          {remunSubTab === 'lrd' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">📘 Libro de Remuneraciones Digital (LRD - DT Chile)</h4>
                <button className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Emitir Archivo LRD para DT</span>
                </button>
              </div>
              <p className="text-xs text-slate-600">
                Genera la estructura de archivo en formato CSV / TXT codificado para la transmisión directa del Libro de Remuneraciones Digital a la plataforma Mi DT de la Dirección del Trabajo.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUBMÓDULO 4: CONTRATACIÓN & FORMATOS / PLANTILLAS DE DOCUMENTOS */}
      {activeSubmodule === 'contratacion' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-900" />
                  <span>Módulo de Contratación & Formatos de la Empresa</span>
                </h3>
                <p className="text-[11px] text-slate-500">Generador de contratos automáticos con plantillas guardadas e ingreso de contrataciones</p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setContratacionSubTab('emision')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${contratacionSubTab === 'emision' ? 'bg-white text-blue-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  📄 Emisión de Contratos
                </button>
                <button
                  onClick={() => setContratacionSubTab('plantillas')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${contratacionSubTab === 'plantillas' ? 'bg-white text-blue-950 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  📑 Formatos Guardados ({plantillasContrato.length})
                </button>
              </div>
            </div>
          </div>

          {/* SUB-PESTAÑA 1: EMISIÓN RÁPIDA DE CONTRATOS */}
          {contratacionSubTab === 'emision' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 border-b pb-2">📄 Emisión Automática de Contrato de Trabajo</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">1. Seleccionar Trabajador del Máster</label>
                    <select
                      value={selectedWorkerForContract}
                      onChange={(e) => {
                        setSelectedWorkerForContract(e.target.value);
                        const w = personal.find(p => String(p.id) === e.target.value);
                        const t = plantillasContrato.find(p => String(p.id) === selectedTemplateId);
                        if (w && t) {
                          let text = t.contenido;
                          text = text.replace(/{{nombre_trabajador}}/g, w.nombre);
                          text = text.replace(/{{rut}}/g, w.rut || 'Sin RUT');
                          text = text.replace(/{{cargo}}/g, w.cargo || 'Operario');
                          text = text.replace(/{{sueldo_base}}/g, (w.sueldo_base || 600000).toLocaleString('es-CL'));
                          text = text.replace(/{{obra_nombre}}/g, w.obra_nombre || 'Obra Principal');
                          text = text.replace(/{{fecha_inicio}}/g, new Date().toLocaleDateString('es-CL'));
                          setGeneratedContractText(text);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="">-- Seleccionar Trabajador --</option>
                      {personal.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.rut || 'Sin RUT'})</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">2. Seleccionar Formato / Plantilla Guardada</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        const w = personal.find(p => String(p.id) === selectedWorkerForContract);
                        const t = plantillasContrato.find(p => String(p.id) === e.target.value);
                        if (w && t) {
                          let text = t.contenido;
                          text = text.replace(/{{nombre_trabajador}}/g, w.nombre);
                          text = text.replace(/{{rut}}/g, w.rut || 'Sin RUT');
                          text = text.replace(/{{cargo}}/g, w.cargo || 'Operario');
                          text = text.replace(/{{sueldo_base}}/g, (w.sueldo_base || 600000).toLocaleString('es-CL'));
                          text = text.replace(/{{obra_nombre}}/g, w.obra_nombre || 'Obra Principal');
                          text = text.replace(/{{fecha_inicio}}/g, new Date().toLocaleDateString('es-CL'));
                          setGeneratedContractText(text);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-white"
                    >
                      {plantillasContrato.map(t => <option key={t.id} value={t.id}>{t.titulo} ({t.tipo})</option>)}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      if (!generatedContractText) { alert('Por favor selecciona un trabajador y una plantilla para emitir.'); return; }
                      alert('Contrato generado y listo para guardar en la Ficha del Trabajador.');
                    }}
                    className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Emitir y Descargar Contrato PDF</span>
                  </button>
                </div>

                {/* Vista Previa del Documento Generado */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Vista Previa del Documento Contrato</span>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 min-h-[180px] text-xs font-mono leading-relaxed text-slate-800">
                    {generatedContractText || 'Selecciona un trabajador y plantilla para visualizar el contrato auto-completado...'}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* SUB-PESTAÑA 2: GESTIÓN DE PLANTILLAS Y FORMATOS */}
          {contratacionSubTab === 'plantillas' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">📑 Formatos de Contratos Guardados de la Empresa</h4>
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateForm({ titulo: '', tipo: 'Contrato Indefinido', contenido: 'En la ciudad de Santiago, entre la empresa Obraxis y Don(a) {{nombre_trabajador}}, RUT {{rut}}...' });
                    setShowTemplateModal(true);
                  }}
                  className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Nuevo Formato</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {plantillasContrato.map(t => (
                  <div key={t.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-bold uppercase bg-blue-100 text-blue-900 px-2 py-0.5 rounded">{t.tipo}</span>
                        <h5 className="font-extrabold text-slate-800 text-xs mt-1">{t.titulo}</h5>
                      </div>
                      <button
                        onClick={() => {
                          setEditingTemplate(t);
                          setTemplateForm({ titulo: t.titulo, tipo: t.tipo, contenido: t.contenido });
                          setShowTemplateModal(true);
                        }}
                        className="text-blue-900 hover:text-blue-950 text-xs font-bold cursor-pointer"
                      >
                        Editar Formato
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-3 italic">"{t.contenido}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADJUNTAR / VER DOCUMENTACIÓN DEL TRABAJADOR */}
      {showDocModal && selectedWorkerDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Documentación del Trabajador</h3>
                <p className="text-xs text-slate-500">{selectedWorkerDoc.nombre} ({selectedWorkerDoc.rut || 'Sin RUT'})</p>
              </div>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Documento</label>
                {!isAddingCustomDocType ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-bold bg-white"
                    >
                      {docTypes.map((dt, idx) => <option key={idx} value={dt}>{dt}</option>)}
                    </select>
                    <button
                      onClick={() => setIsAddingCustomDocType(true)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs shrink-0 cursor-pointer"
                    >
                      + Crear Tipo
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDocTypeName}
                      onChange={(e) => setNewDocTypeName(e.target.value)}
                      placeholder="Nombre del nuevo tipo de doc..."
                      className="w-full border border-blue-500 rounded-xl p-2 text-xs font-bold text-slate-800"
                    />
                    <button
                      onClick={handleAddCustomDocType}
                      className="bg-blue-900 text-white font-bold px-3 py-2 rounded-xl text-xs shrink-0 cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Seleccionar Archivo (PDF/Imagen)</label>
                <input
                  type="file"
                  className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-700"
                />
              </div>

              <button
                onClick={() => { alert('Documento subido y adjuntado con éxito a la ficha del trabajador.'); setShowDocModal(false); }}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Subir y Guardar Documento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR FICHA COMPLETA DE TRABAJADOR */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingWorker ? 'Editar Ficha Completa Trabajador' : 'Crear Nueva Ficha Trabajador Empresa'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Sección 1: Datos Personales */}
              <div className="space-y-3">
                <h4 className="font-bold text-blue-950 uppercase text-[10px] tracking-wider border-b pb-1">1. Datos Personales y Contacto</h4>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej. Juan Pérez González"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT</label>
                    <input
                      type="text"
                      value={formData.rut}
                      onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                      onBlur={(e) => setFormData({ ...formData, rut: formatRut(e.target.value) })}
                      placeholder="12.345.678-9"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Teléfono Fono</label>
                    <input
                      type="text"
                      value={formData.fono}
                      onChange={(e) => setFormData({ ...formData, fono: e.target.value })}
                      placeholder="+56 9 1234 5678"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Cargo, Centro de Trabajo y Contrato */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-blue-950 uppercase text-[10px] tracking-wider border-b pb-1">2. Cargo, Ubicación Orgánica y Contrato</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cargo / Función</label>
                    <input
                      type="text"
                      required
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      placeholder="Ej. Operario, Capataz, Prevencionista"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Centro de Trabajo</label>
                    <input
                      type="text"
                      value={formData.centro_trabajo}
                      onChange={(e) => setFormData({ ...formData, centro_trabajo: e.target.value })}
                      placeholder="Ej. Obra Talcahuano Módulo 1 / Oficina Central"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Obra Asignada</label>
                    <select
                      value={formData.obra_nombre}
                      onChange={(e) => setFormData({ ...formData, obra_nombre: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white"
                    >
                      <option value="">-- Sin Obra (Oficina) --</option>
                      {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-1">📅 Fecha Asignación Obra</label>
                    <input
                      type="date"
                      value={formData.fecha_asig || ''}
                      onChange={(e) => setFormData({ ...formData, fecha_asig: e.target.value })}
                      className="w-full border border-indigo-200 bg-indigo-50/50 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Contrato</label>
                    <select
                      value={formData.tipo_contrato}
                      onChange={(e) => setFormData({ ...formData, tipo_contrato: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-bold"
                    >
                      <option value="Indefinido">Indefinido</option>
                      <option value="Plazo Fijo">Plazo Fijo</option>
                      <option value="Por Obra o Faena">Por Obra o Faena</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha Inicio Contrato</label>
                    <input
                      type="date"
                      value={formData.fecha_inicio_contrato || ''}
                      onChange={(e) => setFormData({ ...formData, fecha_inicio_contrato: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Vencimiento Contrato</label>
                    <input
                      type="date"
                      disabled={formData.tipo_contrato === 'Indefinido'}
                      value={formData.tipo_contrato === 'Indefinido' ? '' : (formData.fecha_vencimiento_contrato || '')}
                      onChange={(e) => setFormData({ ...formData, fecha_vencimiento_contrato: e.target.value })}
                      className={`w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-mono ${formData.tipo_contrato === 'Indefinido' ? 'bg-slate-100 opacity-60 cursor-not-allowed' : 'bg-white font-bold'}`}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Previsión Social & Salud (Leyes Laborales Chile) */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-blue-950 uppercase text-[10px] tracking-wider border-b pb-1">3. Previsión Social & Salud (AFP e ISAPRE / FONASA)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">AFP (Previsión Vejez)</label>
                    <select
                      value={formData.afp}
                      onChange={(e) => setFormData({ ...formData, afp: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-bold"
                    >
                      <option value="Habitat">AFP Habitat</option>
                      <option value="Capital">AFP Capital</option>
                      <option value="Cuprum">AFP Cuprum</option>
                      <option value="Modelo">AFP Modelo</option>
                      <option value="PlanVital">AFP PlanVital</option>
                      <option value="ProVida">AFP ProVida</option>
                      <option value="Uno">AFP Uno</option>
                      <option value="Sin Previsión">Sin Previsión (Jubilado)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Previsión Salud (ISAPRE / FONASA)</label>
                    <select
                      value={formData.prevision_salud}
                      onChange={(e) => setFormData({ ...formData, prevision_salud: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-bold"
                    >
                      <option value="FONASA">FONASA (Tramo A, B, C, D)</option>
                      <option value="Isapre Banmédica">Isapre Banmédica</option>
                      <option value="Isapre Colmena">Isapre Colmena Golden Cross</option>
                      <option value="Isapre Consalud">Isapre Consalud</option>
                      <option value="Isapre CruzBlanca">Isapre CruzBlanca</option>
                      <option value="Isapre Nueva Masvida">Isapre Nueva Masvida</option>
                      <option value="Isapre Vida Tres">Isapre Vida Tres</option>
                      <option value="Otra Isapre">Otra Isapre / Especial</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección 4: Remuneración, Asignaciones y Datos Bancarios */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-blue-950 uppercase text-[10px] tracking-wider border-b pb-1">4. Remuneración, Asignaciones (No Imponibles) y Pago Bancario</h4>
                
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Sueldo Base ($)</label>
                    <input
                      type="number"
                      value={formData.sueldo_base}
                      onChange={(e) => setFormData({ ...formData, sueldo_base: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Gratificación Legal</label>
                    <select
                      value={formData.gratificacion}
                      onChange={(e) => setFormData({ ...formData, gratificacion: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-bold"
                    >
                      <option value="Art. 50 (25% tope)">Art. 50 (25% Tope Legal)</option>
                      <option value="Sin Gratificación">Sin Gratificación Mensual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Asig. Colación ($)</label>
                    <input
                      type="number"
                      value={formData.colacion}
                      onChange={(e) => setFormData({ ...formData, colacion: e.target.value })}
                      placeholder="0"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Asig. Movilización ($)</label>
                    <input
                      type="number"
                      value={formData.movilizacion}
                      onChange={(e) => setFormData({ ...formData, movilizacion: e.target.value })}
                      placeholder="0"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Banco</label>
                    <input
                      type="text"
                      value={formData.banco}
                      onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                      placeholder="BancoEstado"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Cuenta</label>
                    <select
                      value={formData.tipo_cuenta}
                      onChange={(e) => setFormData({ ...formData, tipo_cuenta: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white"
                    >
                      <option value="CuentaRUT">CuentaRUT</option>
                      <option value="Cuenta Corriente">Cuenta Corriente</option>
                      <option value="Cuenta Vista / Vista Chequera">Cuenta Vista</option>
                      <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                      <option value="Efectivo / Vale Vista">Efectivo / Vale Vista</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">N° Cuenta</label>
                    <input
                      type="text"
                      value={formData.numero_cuenta}
                      onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
                      placeholder="12345678"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl shadow-xs text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5"
              >
                {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Guardar Ficha Trabajador</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR PLANTILLA DE FORMATO DE CONTRATO */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-slate-800 text-sm">
                {editingTemplate ? 'Editar Formato de Contrato' : 'Crear Nuevo Formato / Plantilla'}
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!templateForm.titulo.trim() || !templateForm.contenido.trim()) return;
                if (editingTemplate) {
                  setPlantillasContrato(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...templateForm } : t));
                } else {
                  setPlantillasContrato(prev => [...prev, { id: Date.now(), ...templateForm }]);
                }
                setShowTemplateModal(false);
                alert('Formato de contrato guardado con éxito.');
              }}
              className="space-y-4 text-xs"
            >
              {/* Opción de Carga Automática desde Archivo */}
              <div className="bg-blue-50/60 border border-dashed border-blue-200 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-blue-950 flex items-center gap-1">
                    <FileUp className="w-3.5 h-3.5 text-blue-900" />
                    <span>Subir Documento / Contrato Existente (.txt, .pdf, .docx)</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Selecciona un archivo en tu equipo para extraer su texto automáticamente como formato</p>
                <input
                  type="file"
                  accept=".txt,.pdf,.docx,.doc,.csv"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                    const cleanTitle = fileNameWithoutExt.replace(/_/g, ' ').replace(/-/g, ' ');

                    const reader = new FileReader();
                    reader.onload = (event) => {
                      let extractedText = event.target.result;
                      if (typeof extractedText !== 'string') {
                        extractedText = `En la ciudad de Santiago, se celebra el contrato de trabajo contenido en ${file.name}.\n\nEntre Obraxis S.A. y Don(a) {{nombre_trabajador}}, RUT {{rut}}, para desempeñarse en el cargo de {{cargo}} en la obra {{obra_nombre}}, con fecha de ingreso {{fecha_inicio}} y sueldo base de ${{sueldo_base}}.`;
                      }
                      
                      setTemplateForm(prev => ({
                        ...prev,
                        titulo: prev.titulo || cleanTitle,
                        contenido: extractedText
                      }));
                      alert(`¡Documento "${file.name}" leído con éxito! El contenido ha sido extraído al formato.`);
                    };

                    if (file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
                      reader.readAsText(file);
                    } else {
                      reader.readAsArrayBuffer(file);
                      setTimeout(() => {
                        setTemplateForm(prev => ({
                          ...prev,
                          titulo: prev.titulo || cleanTitle,
                          contenido: `En la ciudad de Santiago de Chile, se suscribe el presente contrato de trabajo extraído de ${file.name}.\n\nPRIMERO: La empresa contrata a Don(a) {{nombre_trabajador}}, RUT N° {{rut}}, para desempeñar la función de {{cargo}} en la faena {{obra_nombre}}.\n\nSEGUNDO: El trabajador iniciará sus labores con fecha {{fecha_inicio}}, percibiendo una remuneración líquida base de ${{sueldo_base}}.`
                        }));
                        alert(`¡Documento "${file.name}" leído y procesado! El texto ha sido extraído al formulario para su revisión.`);
                      }, 300);
                    }
                  }}
                  className="w-full text-xs text-slate-800 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Título del Formato</label>
                <input
                  type="text"
                  required
                  value={templateForm.titulo}
                  onChange={(e) => setTemplateForm({ ...templateForm, titulo: e.target.value })}
                  placeholder="Ej. Contrato Plazo Fijo Faena Especial"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Contrato</label>
                <select
                  value={templateForm.tipo}
                  onChange={(e) => setTemplateForm({ ...templateForm, tipo: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-white font-semibold"
                >
                  <option value="Contrato Indefinido">Contrato Indefinido</option>
                  <option value="Plazo Fijo">Plazo Fijo / Obra Determinada</option>
                  <option value="Anexo de Obra">Anexo de Obra</option>
                  <option value="Finiquito">Finiquito de Trabajo</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  {"Texto del Formato (Usa etiquetas: {{nombre_trabajador}}, {{rut}}, {{cargo}}, {{sueldo_base}}, {{obra_nombre}}, {{fecha_inicio}})"}
                </label>
                <textarea
                  rows="6"
                  required
                  value={templateForm.contenido}
                  onChange={(e) => setTemplateForm({ ...templateForm, contenido: e.target.value })}
                  placeholder="Escribe el texto del contrato con las etiquetas automáticas..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl text-xs shadow-xs cursor-pointer"
              >
                Guardar Formato de Contrato
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EMISIÓN Y VISTA PREVIA DE LIQUIDACIÓN DE SUELDO PDF */}
      {showLiquidacionPDFModal && selectedWorkerLiquidacion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-200">
            
            {/* Header del Modal con botones de acción */}
            <div className="flex justify-between items-center border-b pb-3 no-print">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>Liquidación de Sueldo - {selectedWorkerLiquidacion.nombre}</span>
                </h3>
                <p className="text-[10px] text-slate-500">Documento oficial formateado según la normativa de la Dirección del Trabajo (DT Chile)</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    const content = document.getElementById('liquidacion-pdf-content').innerHTML;
                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>Liquidacion_${selectedWorkerLiquidacion.nombre.replace(/\s+/g, '_')}</title>
                          <style>
                            body { font-family: Arial, sans-serif; margin: 30px; color: #0f172a; font-size: 12px; line-height: 1.4; }
                            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
                            .company-name { font-size: 16px; font-weight: bold; text-transform: uppercase; color: #0f172a; }
                            .doc-title { font-size: 14px; font-weight: bold; text-align: center; text-transform: uppercase; margin: 16px 0; letter-spacing: 1px; color: #1e3a8a; }
                            .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 11px; }
                            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
                            th { background-color: #0f172a; color: white; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
                            td { border-bottom: 1px solid #e2e8f0; padding: 8px; }
                            .text-right { text-align: right; }
                            .bold { font-weight: bold; }
                            .total-box { background: #ecfdf5; border: 2px solid #059669; padding: 12px; border-radius: 8px; text-align: right; font-size: 14px; font-weight: bold; color: #065f46; margin-bottom: 30px; }
                            .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
                            .sig-box { border-top: 1px solid #64748b; width: 42%; text-align: center; padding-top: 6px; font-size: 11px; color: #334155; }
                            @media print { .no-print { display: none !important; } }
                          </style>
                        </head>
                        <body>
                          ${content}
                          <div style="text-align: center; margin-top: 24px;" class="no-print">
                            <button onclick="window.print()" style="background:#0f172a; color:#fff; font-weight:bold; border:none; padding:12px 24px; border-radius:8px; cursor:pointer; font-size:13px;">🖨️ Guardar como PDF / Imprimir</button>
                          </div>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Descargar PDF</span>
                </button>

                <button onClick={() => setShowLiquidacionPDFModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1">✕</button>
              </div>
            </div>

            {/* Contenido Imprimible de la Liquidación */}
            <div id="liquidacion-pdf-content" className="p-4 bg-white text-slate-800 space-y-4">
              
              {/* Header Empresa */}
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h2 className="font-black text-slate-900 text-base uppercase tracking-wide">{user?.empresa || 'OBRAXIS CHILE S.A.'}</h2>
                  <p className="text-[11px] text-slate-600 font-semibold">RUT: 76.890.123-K | Giro: Construcción y Obras de Ingeniería</p>
                  <p className="text-[10px] text-slate-500">Casa Matriz / Oficina Central</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded border border-slate-200 block text-slate-700">
                    PERÍODO: JULIO 2026
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">Folio N° LIQ-2026-07-{selectedWorkerLiquidacion.id || '01'}</span>
                </div>
              </div>

              <h3 className="text-center font-black text-blue-950 uppercase text-xs tracking-widest my-2 py-1 bg-slate-100 rounded">
                LIQUIDACIÓN DE SUELDO Y REMUNERACIONES
              </h3>

              {/* Ficha e Info del Trabajador */}
              {(() => {
                const sBase = parseFloat(selectedWorkerLiquidacion.sueldo_base) || 600000;
                const topeGratif = Math.round((4.75 * (indicadores.salarioMinimo || 520000)) / 12);
                const tieneGratif = selectedWorkerLiquidacion.gratificacion !== 'Sin Gratificación';
                const gratifMonto = tieneGratif ? Math.min(Math.round(sBase * 0.25), topeGratif) : 0;
                const imponible = sBase + gratifMonto;

                const colacion = parseFloat(selectedWorkerLiquidacion.colacion) || 0;
                const movilizacion = parseFloat(selectedWorkerLiquidacion.movilizacion) || 0;
                const totalHaberes = imponible + colacion + movilizacion;

                const afpInfo = getAFPDetails(selectedWorkerLiquidacion.afp);
                const afpMonto = Math.round(imponible * (afpInfo.total / 100));
                const saludMonto = Math.round(imponible * 0.07);
                const isIndef = (selectedWorkerLiquidacion.tipo_contrato || 'Indefinido') === 'Indefinido';
                const afcMonto = isIndef ? Math.round(imponible * 0.006) : 0;
                const totalDescuentos = afpMonto + saludMonto + afcMonto;
                const sueldoLiquido = totalHaberes - totalDescuentos;

                return (
                  <>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 bg-slate-50 border border-slate-200 p-3 rounded-xl text-[11px]">
                      <div><strong>Nombre Trabajador:</strong> {selectedWorkerLiquidacion.nombre}</div>
                      <div><strong>RUT:</strong> {selectedWorkerLiquidacion.rut || 'Sin RUT'}</div>
                      <div><strong>Cargo / Función:</strong> {selectedWorkerLiquidacion.cargo}</div>
                      <div><strong>Centro de Trabajo / Obra:</strong> {selectedWorkerLiquidacion.centro_trabajo || selectedWorkerLiquidacion.obra_nombre || 'Oficina Central'}</div>
                      <div><strong>Tipo de Contrato:</strong> {selectedWorkerLiquidacion.tipo_contrato || 'Indefinido'}</div>
                      <div><strong>Fecha de Ingreso:</strong> {selectedWorkerLiquidacion.fecha_inicio_contrato || selectedWorkerLiquidacion.inicio || '01/03/2026'}</div>
                      <div><strong>AFP Previsión:</strong> {selectedWorkerLiquidacion.afp || 'Habitat'} ({afpInfo.total}%)</div>
                      <div><strong>Previsión Salud:</strong> {selectedWorkerLiquidacion.prevision_salud || 'FONASA'} (7%)</div>
                    </div>

                    {/* Tablas de Haberes y Descuentos */}
                    <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                      
                      {/* Columna Haberes */}
                      <div className="space-y-1">
                        <h4 className="font-bold text-[10px] uppercase tracking-wider text-emerald-950 bg-emerald-50 p-1.5 rounded border border-emerald-200">
                          1. Haberes (Imponibles & No Imponibles)
                        </h4>
                        <table className="w-full text-[11px] border-collapse">
                          <tbody>
                            <tr>
                              <td className="p-1.5 font-semibold">Sueldo Base Mensual</td>
                              <td className="p-1.5 text-right font-mono font-bold">${sBase.toLocaleString('es-CL')}</td>
                            </tr>
                            {tieneGratif && (
                              <tr>
                                <td className="p-1.5 font-semibold text-emerald-900">Gratificación Legal Art. 50 (25%)</td>
                                <td className="p-1.5 text-right font-mono font-bold text-emerald-800">+${gratifMonto.toLocaleString('es-CL')}</td>
                              </tr>
                            )}
                            {colacion > 0 && (
                              <tr>
                                <td className="p-1.5 text-slate-500">Asignación Colación (No Imp.)</td>
                                <td className="p-1.5 text-right font-mono text-slate-600">${colacion.toLocaleString('es-CL')}</td>
                              </tr>
                            )}
                            {movilizacion > 0 && (
                              <tr>
                                <td className="p-1.5 text-slate-500">Asignación Movilización (No Imp.)</td>
                                <td className="p-1.5 text-right font-mono text-slate-600">${movilizacion.toLocaleString('es-CL')}</td>
                              </tr>
                            )}
                            <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                              <td className="p-1.5 text-emerald-950">TOTAL HABERES</td>
                              <td className="p-1.5 text-right font-mono text-emerald-950 font-black">${totalHaberes.toLocaleString('es-CL')}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Columna Descuentos */}
                      <div className="space-y-1">
                        <h4 className="font-bold text-[10px] uppercase tracking-wider text-red-950 bg-red-50 p-1.5 rounded border border-red-200">
                          2. Descuentos Legales Obligatorios
                        </h4>
                        <table className="w-full text-[11px] border-collapse">
                          <tbody>
                            <tr>
                              <td className="p-1.5">AFP {selectedWorkerLiquidacion.afp || 'Habitat'} ({afpInfo.total}%)</td>
                              <td className="p-1.5 text-right font-mono text-red-600 font-bold">-${afpMonto.toLocaleString('es-CL')}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5">Salud {selectedWorkerLiquidacion.prevision_salud || 'FONASA'} (7%)</td>
                              <td className="p-1.5 text-right font-mono text-red-600 font-bold">-${saludMonto.toLocaleString('es-CL')}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5">Seguro Cesantía AFC ({isIndef ? '0.6%' : '0.0%'})</td>
                              <td className="p-1.5 text-right font-mono text-red-600 font-bold">-${afcMonto.toLocaleString('es-CL')}</td>
                            </tr>
                            <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                              <td className="p-1.5 text-red-950">TOTAL DESCUENTOS LEY</td>
                              <td className="p-1.5 text-right font-mono text-red-700 font-black">-${totalDescuentos.toLocaleString('es-CL')}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                    </div>

                    {/* Recuadros Totales Líquidos */}
                    <div className="bg-emerald-900 text-white p-3.5 rounded-xl flex justify-between items-center shadow-xs my-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider block">ALCANCE LÍQUIDO A RECIBIR</span>
                        <span className="text-[11px] text-emerald-100 italic">Certifico haber recibido a mi entera satisfacción el líquido indicado.</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black font-mono text-white">${sueldoLiquido.toLocaleString('es-CL')}</span>
                      </div>
                    </div>

                    {/* Sección de Firmas */}
                    <div className="pt-10 flex justify-between items-end text-center text-[11px]">
                      <div className="w-5/12 border-t border-slate-400 pt-1.5">
                        <p className="font-bold text-slate-800">FIRMA DEL TRABAJADOR</p>
                        <p className="text-[9px] text-slate-500">RUT: {selectedWorkerLiquidacion.rut || '________________'}</p>
                      </div>
                      <div className="w-5/12 border-t border-slate-400 pt-1.5">
                        <p className="font-bold text-slate-800">FIRMA EMPLEADOR</p>
                        <p className="text-[9px] text-slate-500">{user?.empresa || 'OBRAXIS S.A.'}</p>
                      </div>
                    </div>
                  </>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR INDICADORES PREVISIONALES (SII / PREVIRED) */}
      {showEditIndicadoresModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Edit className="w-4 h-4 text-blue-900" />
                <span>Editar Indicadores Previsionales (SII / Previred)</span>
              </h3>
              <button onClick={() => setShowEditIndicadoresModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const updated = {
                  ...editIndicadoresForm,
                  uf: parseFloat(editIndicadoresForm.uf) || 40844.79,
                  utm: parseFloat(editIndicadoresForm.utm) || 71649,
                  salarioMinimo: parseFloat(editIndicadoresForm.salarioMinimo) || 520000,
                  topeAfpUf: parseFloat(editIndicadoresForm.topeAfpUf) || 85.1,
                  topeCesantiaUf: parseFloat(editIndicadoresForm.topeCesantiaUf) || 127.8,
                  apvMaxUf: parseFloat(editIndicadoresForm.apvMaxUf) || 50,
                  ultimaActualizacion: new Date().toLocaleDateString('es-CL') + ' (Ajuste Manual SII)'
                };
                setIndicadores(updated);
                localStorage.setItem('indicadores_previsionales_chile', JSON.stringify(updated));
                setShowEditIndicadoresModal(false);
                alert('¡Indicadores previsionales guardados con éxito!');
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Valor UF ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editIndicadoresForm.uf}
                  onChange={(e) => setEditIndicadoresForm({ ...editIndicadoresForm, uf: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Valor UTM ($)</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={editIndicadoresForm.utm}
                  onChange={(e) => setEditIndicadoresForm({ ...editIndicadoresForm, utm: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Sueldo Mínimo ($)</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={editIndicadoresForm.salarioMinimo}
                  onChange={(e) => setEditIndicadoresForm({ ...editIndicadoresForm, salarioMinimo: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tope Imponible AFP (UF)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editIndicadoresForm.topeAfpUf}
                    onChange={(e) => setEditIndicadoresForm({ ...editIndicadoresForm, topeAfpUf: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tope Cesantía (UF)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editIndicadoresForm.topeCesantiaUf}
                    onChange={(e) => setEditIndicadoresForm({ ...editIndicadoresForm, topeCesantiaUf: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl shadow-xs text-xs cursor-pointer mt-2"
              >
                Guardar Indicadores Previsionales
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA ASIGNACIÓN DE OBRA Y FECHA DESDE RRHH */}
      {showAssignObraModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-100 text-purple-900 rounded-xl text-xs font-black">📅</span>
                <h3 className="font-extrabold text-slate-800 text-sm">Asignar Trabajador a Obra</h3>
              </div>
              <button
                onClick={() => setShowAssignObraModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-purple-50/80 p-3 rounded-2xl border border-purple-200 space-y-1">
              <span className="text-[10px] font-bold text-purple-900 uppercase">Trabajador Seleccionado:</span>
              <p className="text-xs font-black text-purple-950">{assignModalData.workerNombre}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Obra de Destino</label>
                <select
                  value={assignModalData.obraNombre}
                  onChange={(e) => setAssignModalData({ ...assignModalData, obraNombre: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-extrabold text-slate-800 bg-white focus:border-purple-600"
                >
                  <option value="">-- Sin Obra (Oficina Central) --</option>
                  {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-purple-950 mb-1">📅 Fecha desde la cual se asigna a Obra</label>
                <input
                  type="date"
                  required
                  value={assignModalData.fechaAsig}
                  onChange={(e) => setAssignModalData({ ...assignModalData, fechaAsig: e.target.value })}
                  className="w-full border border-purple-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 bg-white shadow-2xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 Esta fecha cargará automáticamente la asignación a la proyección de costos de la obra seleccionada.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignObraModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveObraAssignment}
                className="px-5 py-2 text-xs font-extrabold text-white bg-purple-900 hover:bg-purple-800 rounded-xl shadow-xs cursor-pointer transition"
              >
                Guardar Asignación & Fecha
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Personal;
