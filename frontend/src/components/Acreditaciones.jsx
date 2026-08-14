import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ModuleHeader from './ModuleHeader';
import { formatRut } from '../utils/rutUtils';
import { sendSystemEmail } from '../utils/emailService';
import useUserPermissions from '../utils/useUserPermissions';
import { can } from '../utils/permissionsCatalog';
import AccreditationAIReview from './AccreditationAIReview';
import {
  Store, ShieldCheck, Plus, Send, CheckCircle2,
  Trash2, Eye, Copy, Building2, User, Truck, Pencil, Archive, RotateCcw,
  Check, Clock, Mail, FileUp, Sparkles, Settings2, CheckSquare, XCircle, MessageSquare, FileCheck
} from 'lucide-react';

export default function Acreditaciones({ user, onBack, companyBranding }) {
  const { permissions, loading: permissionsLoading } = useUserPermissions(user);
  const canView = can(user, permissions, 'acreditaciones.subcontratos.ver');
  const canCreate = can(user, permissions, 'acreditaciones.subcontratos.crear');
  const canEdit = can(user, permissions, 'acreditaciones.subcontratos.editar');
  const canDelete = can(user, permissions, 'acreditaciones.subcontratos.eliminar');
  const canSend = can(user, permissions, 'acreditaciones.subcontratos.enviar');
  const canReview = can(user, permissions, 'acreditaciones.subcontratos.revisar');
  const canApprove = can(user, permissions, 'acreditaciones.subcontratos.aprobar');
  const canConfigure = can(user, permissions, 'acreditaciones.subcontratos.configurar');
  // Apartado activo del módulo: '' (Menú Principal), 'acreditarme', 'subcontratos', 'config_docs'
  const [activeSection, setActiveSection] = useState('');

  // Sub-pestañas internas dentro de "Acreditarme"
  const [acreditarmeSubTab, setAcreditarmeSubTab] = useState('enviar'); // 'enviar' | 'docs_personal' | 'historial'

  // Sub-pestañas internas dentro del modal de revisión de Subcontrato
  const [subModalTab, setSubModalTab] = useState('empresa'); // 'empresa' | 'personal' | 'equipos'

  // --- ESTADOS PARA "ACREDITARME" (PERSONAL PROPIO) ---
  const [obrasList, setObrasList] = useState([]);
  const [personalList, setPersonalList] = useState([]);
  const [selectedObra, setSelectedObra] = useState('');
  const [destinatarioEmail, setDestinatarioEmail] = useState('');
  const [asuntoEmail, setAsuntoEmail] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [historialInterno, setHistorialInterno] = useState([]);
  const [, setSelectedHistorialDetail] = useState(null);

  // --- ESTADOS PARA "ACREDITACIÓN SUBCONTRATO" ---
  const [subcontratosList, setSubcontratosList] = useState([]);
  const [proveedoresList, setProveedoresList] = useState([]);
  const [showProvModal, setShowProvModal] = useState(false);
  const [provForm, setProvForm] = useState({ empresa_nombre: '', rut_empresa: '', obra_asociada: '', correo_contacto: '', credencial_pass: '' });
  const [selectedProvDetail, setSelectedProvDetail] = useState(null);
  const [mandatorySupplierDocs, setMandatorySupplierDocs] = useState([
    { key: 'rut_empresa', label: 'E-RUT / RUT Proveedor' },
    { key: 'patente_actividades', label: 'Patente Municipal / Inicio de Actividades' },
    { key: 'antecedentes_comerciales', label: 'Certificado Antecedentes Comerciales' },
    { key: 'seguro_rc', label: 'Póliza Seguro Responsabilidad Civil / Calidad' },
    { key: 'f30_1', label: 'Certificado F30-1 (Cumplimiento Laboral)' }
  ]);
  const [newSupplierDocLabel, setNewSupplierDocLabel] = useState('');
  const [, setLoadingSubcontratos] = useState(false);
  const [sendingSubInvite, setSendingSubInvite] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [showArchivedSubcontracts, setShowArchivedSubcontracts] = useState(false);
  const [colaboracionesObra, setColaboracionesObra] = useState([]);
  const [subForm, setSubForm] = useState({
    empresa_nombre: '',
    rut_empresa: '',
    obra_asociada: '',
    correo_contacto: '',
    credencial_pass: '',
    integrar_en_obraxis: false
  });

  // Modal para Revisar Documentos y Acreditación de Subcontratista
  const [selectedSubDetail, setSelectedSubDetail] = useState(null);
  const [rejectingKey, setRejectingKey] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  // --- CONFIGURACIÓN DE DOCUMENTOS OBLIGATORIOS ---
  // 1. Docs Empresa
  const [mandatoryCompanyDocs, setMandatoryCompanyDocs] = useState([
    { key: 'rut_empresa', label: 'E-RUT / RUT Empresa' },
    { key: 'f30_1', label: 'Certificado F30-1 (Dirección del Trabajo)' },
    { key: 'cotizaciones_previsionales', label: 'Comprobante Cotizaciones Previsionales' },
    { key: 'seguro_rc', label: 'Póliza Seguro Responsabilidad Civil / Accidentes' },
    { key: 'plan_prevencion', label: 'Plan de Prevención / Matriz IPER' }
  ]);
  const [newCompanyDocLabel, setNewCompanyDocLabel] = useState('');

  // 2. Docs Trabajador (Externo e Interno)
  const [mandatoryWorkerDocs, setMandatoryWorkerDocs] = useState([
    { key: 'cedula', label: 'Cédula de Identidad Vigente' },
    { key: 'contrato', label: 'Contrato de Trabajo' },
    { key: 'afp', label: 'Certificado Cotizaciones AFP' },
    { key: 'salud', label: 'Certificado Previsión Salud (FONASA/Isapre)' },
    { key: 'examen', label: 'Examen de Salud / Altura Ocupacional' },
    { key: 'induccion', label: 'Registro de Inducción de Seguridad' },
    { key: 'epp', label: 'Cargo y Registro de Entrega EPP' }
  ]);
  const [newWorkerDocLabel, setNewWorkerDocLabel] = useState('');

  // 3. Docs Maquinarias y Equipos
  const [mandatoryEquipoDocs, setMandatoryEquipoDocs] = useState([
    { key: 'padron', label: 'Padrón / Certificado de Dominio' },
    { key: 'revision', label: 'Revisión Técnica / Homologación Vigente' },
    { key: 'seguro', label: 'Póliza Seguro de Equipo / SOAP' },
    { key: 'checklist', label: 'Check-list Pre-operacional de Seguridad' }
  ]);
  const [newEquipoDocLabel, setNewEquipoDocLabel] = useState('');

  // Toast / Mensajes
  const [successMsg, setSuccessMsg] = useState('');
  const [, setErrorMsg] = useState('');

  useEffect(() => {
    fetchObras();
    fetchPersonal();
    fetchHistorialInterno();
    fetchSubcontratos();
    fetchProveedores();
    fetchColaboracionesObra();
    loadMandatoryDocsConfig();
  }, []);

    const loadMandatoryDocsConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('acreditaciones_config_docs')
        .select('*')
        .eq('empresa', user?.empresa)
        .maybeSingle();

      if (!error && data) {
        if (data.company_docs) {
          setMandatoryCompanyDocs(data.company_docs);
        }
        if (data.worker_docs) {
          setMandatoryWorkerDocs(data.worker_docs);
        }
        if (data.equipo_docs) {
          setMandatoryEquipoDocs(data.equipo_docs);
        }
        if (data.supplier_docs) {
          setMandatorySupplierDocs(data.supplier_docs);
        }
        return;
      }
    } catch (e) {
      setErrorMsg(`No fue posible cargar la configuración documental: ${e.message}`);
    }
  };

  const saveMandatoryDocsConfig = async (compDocs, workDocs, eqDocs, supDocs = mandatorySupplierDocs) => {
    if (!canConfigure) { setErrorMsg('Tu perfil no está autorizado para configurar documentos obligatorios.'); return; }
    try {
      const { error } = await supabase
        .from('acreditaciones_config_docs')
        .upsert([{
          empresa: user?.empresa,
          company_docs: compDocs,
          worker_docs: workDocs,
          equipo_docs: eqDocs,
          supplier_docs: supDocs,
          updated_at: new Date().toISOString()
        }], { onConflict: 'empresa' });
      if (error) throw error;
    } catch (e) {
      setErrorMsg(`No fue posible guardar la configuración documental: ${e.message}`);
      return;
    }

    setSuccessMsg('¡Listado de documentos obligatorios guardado y sincronizado con el Minisitio!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleAddMandatoryCompanyDoc = (e) => {
    e.preventDefault();
    if (!newCompanyDocLabel.trim()) return;
    const key = 'custom_' + Date.now();
    const updated = [...mandatoryCompanyDocs, { key, label: newCompanyDocLabel.trim() }];
    setMandatoryCompanyDocs(updated);
    setNewCompanyDocLabel('');
    saveMandatoryDocsConfig(updated, mandatoryWorkerDocs, mandatoryEquipoDocs);
  };

  const handleAddMandatoryWorkerDoc = (e) => {
    e.preventDefault();
    if (!newWorkerDocLabel.trim()) return;
    const key = 'custom_' + Date.now();
    const updated = [...mandatoryWorkerDocs, { key, label: newWorkerDocLabel.trim() }];
    setMandatoryWorkerDocs(updated);
    setNewWorkerDocLabel('');
    saveMandatoryDocsConfig(mandatoryCompanyDocs, updated, mandatoryEquipoDocs);
  };

  const handleAddMandatoryEquipoDoc = (e) => {
    e.preventDefault();
    if (!newEquipoDocLabel.trim()) return;
    const key = 'custom_' + Date.now();
    const updated = [...mandatoryEquipoDocs, { key, label: newEquipoDocLabel.trim() }];
    setMandatoryEquipoDocs(updated);
    setNewEquipoDocLabel('');
    saveMandatoryDocsConfig(mandatoryCompanyDocs, mandatoryWorkerDocs, updated);
  };

  const handleRemoveMandatoryCompanyDoc = (key) => {
    const updated = mandatoryCompanyDocs.filter(d => d.key !== key);
    setMandatoryCompanyDocs(updated);
    saveMandatoryDocsConfig(updated, mandatoryWorkerDocs, mandatoryEquipoDocs);
  };

  const handleRemoveMandatoryWorkerDoc = (key) => {
    const updated = mandatoryWorkerDocs.filter(d => d.key !== key);
    setMandatoryWorkerDocs(updated);
    saveMandatoryDocsConfig(mandatoryCompanyDocs, updated, mandatoryEquipoDocs);
  };

  
  const handleAddMandatorySupplierDoc = (e) => {
    e.preventDefault();
    if (!newSupplierDocLabel.trim()) return;
    const key = 'custom_' + Date.now();
    const updated = [...mandatorySupplierDocs, { key, label: newSupplierDocLabel.trim() }];
    setMandatorySupplierDocs(updated);
    setNewSupplierDocLabel('');
    saveMandatoryDocsConfig(mandatoryCompanyDocs, mandatoryWorkerDocs, mandatoryEquipoDocs, updated);
  };

  const handleRemoveMandatorySupplierDoc = (key) => {
    const updated = mandatorySupplierDocs.filter(d => d.key !== key);
    setMandatorySupplierDocs(updated);
    saveMandatoryDocsConfig(mandatoryCompanyDocs, mandatoryWorkerDocs, mandatoryEquipoDocs, updated);
  };

  const handleCreateProveedor = async (e) => {
    e.preventDefault();
    if (!canCreate) { setErrorMsg('Tu perfil no está autorizado para crear proveedores.'); return; }
    if (!provForm.empresa_nombre) {
      alert('Ingrese el Nombre de la Empresa Proveedora.');
      return;
    }

    const token = 'prov_' + Math.random().toString(36).substring(2, 9);
    const pass = provForm.credencial_pass || Math.random().toString(36).substring(2, 8).toUpperCase();

    const newProv = {
      empresa: user?.empresa,
      empresa_nombre: provForm.empresa_nombre,
      rut_empresa: formatRut(provForm.rut_empresa) || '77.000.000-0',
      obra_asociada: provForm.obra_asociada || selectedObra || 'Todas las Obras',
      correo_contacto: provForm.correo_contacto,
      token_acceso: token,
      credencial_pass: pass,
      estado_cumplimiento: 0,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from('acreditaciones_proveedores').insert([newProv]).select();
      if (error) throw error;
      setProveedoresList([data[0], ...proveedoresList]);
    } catch (error) {
      setErrorMsg(`No fue posible crear el proveedor: ${error.message}`);
      return;
    }

    setShowProvModal(false);
    setProvForm({ empresa_nombre: '', rut_empresa: '', obra_asociada: '', correo_contacto: '', credencial_pass: '' });
    setSuccessMsg(`¡Proveedor ${newProv.empresa_nombre} creado! Credenciales generadas.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const getSupplierMinisiteUrl = (provItem) => {
    const origin = window.location.origin;
    const cleanName = encodeURIComponent(provItem.empresa_nombre.toLowerCase().replace(/\s+/g, '-'));
    return `${origin}/?acreditacion_proveedor=${cleanName}&token=${provItem.token_acceso}`;
  };

  const openProvDetailModal = async (provItem) => {
    const { data, error } = await supabase.from('acreditaciones_proveedores').select('*').eq('id', provItem.id).single();
    if (error) { setErrorMsg(`No fue posible cargar la acreditación: ${error.message}`); return; }
    setSelectedProvDetail({
      ...data,
      companyDocs: data.companyDocs || {},
      personalList: data.personalList || [],
      equiposList: data.equiposList || []
    });
    setSubModalTab('empresa');
    setRejectingKey(null);
    setRejectReasonInput('');
  };

  const handleUpdateProvDocStatus = async (category, docKey, status, itemIndex = null, reason = '') => {
    if (!selectedProvDetail) return;

    let nextCompanyDocs = { ...(selectedProvDetail.companyDocs || {}) };
    let nextPersonalList = [...(selectedProvDetail.personalList || [])];
    let nextEquiposList = [...(selectedProvDetail.equiposList || [])];

    if (category === 'empresa') {
      if (nextCompanyDocs[docKey]) {
        nextCompanyDocs[docKey] = {
          ...nextCompanyDocs[docKey],
          status: status,
          motivo_rechazo: status === 'Rechazado' ? reason : null,
          reviewedAt: new Date().toLocaleDateString('es-CL')
        };
      }
    } else if (category === 'personal' && itemIndex !== null) {
      if (nextPersonalList[itemIndex] && nextPersonalList[itemIndex].docs && nextPersonalList[itemIndex].docs[docKey]) {
        nextPersonalList[itemIndex].docs[docKey] = {
          ...nextPersonalList[itemIndex].docs[docKey],
          status: status,
          motivo_rechazo: status === 'Rechazado' ? reason : null,
          reviewedAt: new Date().toLocaleDateString('es-CL')
        };
      }
    } else if (category === 'equipos' && itemIndex !== null) {
      if (nextEquiposList[itemIndex] && nextEquiposList[itemIndex].docs && nextEquiposList[itemIndex].docs[docKey]) {
        nextEquiposList[itemIndex].docs[docKey] = {
          ...nextEquiposList[itemIndex].docs[docKey],
          status: status,
          motivo_rechazo: status === 'Rechazado' ? reason : null,
          reviewedAt: new Date().toLocaleDateString('es-CL')
        };
      }
    }

    const empApprovedCount = Object.values(nextCompanyDocs).filter(d => d && d.status === 'Aprobado').length;
    const progressPercent = Math.round((empApprovedCount / mandatorySupplierDocs.length) * 100);

    const updatedProv = {
      ...selectedProvDetail,
      estado_cumplimiento: progressPercent,
      companyDocs: nextCompanyDocs,
      personalList: nextPersonalList,
      equiposList: nextEquiposList
    };

    setSelectedProvDetail(updatedProv);

    const { error } = await supabase.from('acreditaciones_proveedores').update({
      companyDocs: nextCompanyDocs, personalList: nextPersonalList, equiposList: nextEquiposList,
      estado_cumplimiento: progressPercent, updated_at: new Date().toISOString()
    }).eq('id', selectedProvDetail.id);
    if (error) { setErrorMsg(`No fue posible guardar la revisión: ${error.message}`); return; }
    setProveedoresList(current => current.map(item => item.id === selectedProvDetail.id ? updatedProv : item));

    setRejectingKey(null);
    setRejectReasonInput('');
    setSuccessMsg(`Documento de proveedor actualizado a: ${status}`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleRemoveMandatoryEquipoDoc = (key) => {
    const updated = mandatoryEquipoDocs.filter(d => d.key !== key);
    setMandatoryEquipoDocs(updated);
    saveMandatoryDocsConfig(mandatoryCompanyDocs, mandatoryWorkerDocs, updated);
  };

  const fetchObras = async () => {
    try {
      const { data, error } = await supabase.from('obras').select('id, nombre').order('nombre');
      if (error) throw error;
      setObrasList(data || []);
      if (data && data.length > 0) {
        setSelectedObra(data[0].nombre);
      }
    } catch (e) {
      console.error('Error al cargar obras:', e);
    }
  };

  const fetchPersonal = async () => {
    try {
      const { data, error } = await supabase.from('maestro_personal').select('*').order('nombre');
      if (error) throw error;
      setPersonalList(data || []);
    } catch (e) {
      console.error('Error al cargar personal:', e);
    }
  };

  const fetchHistorialInterno = async () => {
    try {
      const { data, error } = await supabase.from('acreditaciones_internas').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        setHistorialInterno(data);
      } else {
        const local = localStorage.getItem('obraxis_acreditaciones_internas');
        if (local) setHistorialInterno(JSON.parse(local));
      }
    } catch (e) {
      const local = localStorage.getItem('obraxis_acreditaciones_internas');
      if (local) setHistorialInterno(JSON.parse(local));
    }
  };

  const fetchProveedores = async () => {
    try {
      const { data, error } = await supabase.from('acreditaciones_proveedores').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProveedoresList(data || []);
    } catch (error) {
      setErrorMsg(`No fue posible cargar proveedores: ${error.message}`);
    }
  };

  const fetchSubcontratos = async () => {
    setLoadingSubcontratos(true);
    try {
      const { data, error } = await supabase.from('acreditaciones_subcontratos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setSubcontratosList(data || []);
    } catch (error) {
      setErrorMsg(`No fue posible cargar subcontratos: ${error.message}`);
    } finally {
      setLoadingSubcontratos(false);
    }
  };

  const handleHeaderBack = () => {
    if (activeSection !== '') {
      setActiveSection('');
      setSuccessMsg('');
      setErrorMsg('');
    } else {
      onBack();
    }
  };

  // Lógica "Acreditarme"
  const toggleWorkerSelection = (rut) => {
    if (selectedWorkers.includes(rut)) {
      setSelectedWorkers(selectedWorkers.filter(r => r !== rut));
    } else {
      setSelectedWorkers([...selectedWorkers, rut]);
    }
  };

  const handleSendAcreditacion = async (e) => {
    e.preventDefault();
    if (!canSend) { setErrorMsg('Tu perfil no está autorizado para enviar acreditaciones.'); return; }
    if (!selectedObra) {
      alert('Por favor seleccione una Obra / Proyecto.');
      return;
    }
    if (selectedWorkers.length === 0) {
      alert('Por favor seleccione al menos un trabajador para acreditar.');
      return;
    }
    if (!destinatarioEmail) {
      alert('Ingrese el correo electrónico del destinatario / mandante.');
      return;
    }

    setSendingEmail(true);

    try {
      const workersData = personalList.filter(w => selectedWorkers.includes(w.rut));
      const fechaHoy = new Date().toLocaleDateString('es-CL');

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; borderRadius: 16px; padding: 24px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0;">Solicitud de Acreditación de Personal</h2>
            <p style="color: #2563eb; font-weight: bold; margin: 4px 0 0 0;">Obraxis - Control Operacional</p>
          </div>

          <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 20px; font-size: 13px;">
            <p style="margin: 4px 0;"><strong>Proyecto / Obra:</strong> ${selectedObra}</p>
            <p style="margin: 4px 0;"><strong>Fecha de Envío:</strong> ${fechaHoy}</p>
            <p style="margin: 4px 0;"><strong>Enviado Por:</strong> ${user?.nombre || user?.usuario || 'Administrador Obraxis'}</p>
            ${observaciones ? `<p style="margin: 4px 0; color: #475569;"><strong>Observaciones:</strong> ${observaciones}</p>` : ''}
          </div>

          <h3 style="color: #1e293b; font-size: 14px; text-transform: uppercase; margin-bottom: 12px;">Trabajadores Presentados (${workersData.length})</h3>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff; text-align: left;">
                <th style="padding: 8px 12px;">Trabajador</th>
                <th style="padding: 8px 12px;">RUT</th>
                <th style="padding: 8px 12px;">Cargo</th>
                <th style="padding: 8px 12px;">AFP / Salud</th>
                <th style="padding: 8px 12px; text-align: center;">Estado Sincro RRHH</th>
              </tr>
            </thead>
            <tbody>
              ${workersData.map(w => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 12px; font-weight: bold;">${w.nombre}</td>
                  <td style="padding: 8px 12px;">${w.rut}</td>
                  <td style="padding: 8px 12px;">${w.cargo || 'Maestro'}</td>
                  <td style="padding: 8px 12px;">${w.afp || 'Habitat'} / ${w.prevision_salud || 'FONASA'}</td>
                  <td style="padding: 8px 12px; text-align: center; color: #16a34a; font-weight: bold;">✓ Sincronizado RRHH</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px; border-radius: 8px; font-size: 12px; color: #1e40af; margin-bottom: 20px;">
            ℹ️ Los antecedentes y respaldos documentales de cada trabajador han sido validados e integrados directamente desde la Ficha de Recursos Humanos del Portal Obraxis.
          </div>
        </div>
      `;

      await sendSystemEmail({
        to: destinatarioEmail,
        subject: asuntoEmail || `[Acreditación Personal] ${selectedObra} - Obraxis`,
        htmlContent: htmlBody,
        permissionKey: 'acreditaciones.subcontratos.enviar'
      });

      const newRecord = {
        obra_nombre: selectedObra,
        destinatario_email: destinatarioEmail,
        asunto: asuntoEmail || `[Acreditación Personal] ${selectedObra}`,
        observaciones: observaciones,
        trabajadores_json: workersData,
        estado: 'Enviado',
        created_at: new Date().toISOString()
      };

      try {
        await supabase.from('acreditaciones_internas').insert([newRecord]);
      } catch (e) {
        console.warn('Fallback a localStorage');
      }

      const updatedHist = [newRecord, ...historialInterno];
      setHistorialInterno(updatedHist);
      localStorage.setItem('obraxis_acreditaciones_internas', JSON.stringify(updatedHist));

      setSuccessMsg('¡Solicitud de Acreditación enviada exitosamente por correo!');
      setSelectedWorkers([]);
      setObservaciones('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      alert('Error al enviar acreditación: ' + (err.message || 'Verifique la configuración de correo'));
    } finally {
      setSendingEmail(false);
    }
  };

  // Lógica Subcontratos
  const handleCreateSubcontrato = async (e) => {
    e.preventDefault();
    if (!canCreate) { setErrorMsg('Tu perfil no está autorizado para crear subcontratos.'); return; }
    if (!subForm.empresa_nombre) {
      alert('Ingrese el Nombre de la Empresa Subcontratista.');
      return;
    }

    if (!normalizarRutEnlace(subForm.rut_empresa)) {
      alert('Ingrese el RUT de la empresa. El RUT es la llave de enlace entre empresas en Obraxis.');
      return;
    }

    if (!subForm.correo_contacto.trim()) {
      alert('Ingrese el correo de contacto. Allí se enviarán las credenciales de acceso al minisitio.');
      return;
    }

    const token = 'sub_' + Math.random().toString(36).substring(2, 9);
    const pass = subForm.credencial_pass || Math.random().toString(36).substring(2, 8).toUpperCase();

    const newSub = {
      empresa: user?.empresa,
      empresa_nombre: subForm.empresa_nombre,
      rut_empresa: formatRut(subForm.rut_empresa),
      obra_asociada: subForm.obra_asociada || selectedObra || 'Todas las Obras',
      correo_contacto: subForm.correo_contacto,
      token_acceso: token,
      credencial_pass: pass,
      estado_cumplimiento: 0,
      created_at: new Date().toISOString()
    };

    setSendingSubInvite(true);
    let createdSub = newSub;
    try {
      const { data, error } = await supabase.from('acreditaciones_subcontratos').insert([newSub]).select();
      if (error) throw error;
      createdSub = { ...newSub, ...data[0] };
      setSubcontratosList([createdSub, ...subcontratosList]);
    } catch (error) {
      setErrorMsg(`No fue posible crear el subcontrato: ${error.message}`);
      setSendingSubInvite(false);
      return;
    }

    let collaborationResult = null;
    if (subForm.integrar_en_obraxis) {
      collaborationResult = await crearColaboracionObra(createdSub);
    }
    const invite = collaborationResult?.success
      ? await sendCollaborationInvite(createdSub, collaborationResult)
      : await sendSubcontractInvite(createdSub);
    setShowSubModal(false);
    setSubForm({ empresa_nombre: '', rut_empresa: '', obra_asociada: '', correo_contacto: '', credencial_pass: '', integrar_en_obraxis: false });
    const collaborationMessage = collaborationResult?.success
      ? ' Invitación de colaboración enviada a su cuenta Obraxis.'
      : collaborationResult?.notFound
        ? ' El RUT no tiene cuenta Obraxis; se enviaron las credenciales del minisitio externo.'
        : '';
    setSuccessMsg(invite.success
      ? `¡${newSub.empresa_nombre} creada!${collaborationMessage}`
      : `¡${newSub.empresa_nombre} creada! Credenciales generadas.`);
    if (!invite.success) {
      alert(`El subcontratista fue creado, pero no se pudo enviar el correo: ${invite.error}. Puedes reenviarlo desde su tarjeta.`);
    }
    setSendingSubInvite(false);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const getMinisiteUrl = (subItem) => {
    const origin = window.location.origin;
    const cleanName = encodeURIComponent(subItem.empresa_nombre.toLowerCase().replace(/\s+/g, '-'));
    return `${origin}/?acreditacion_subcontrato=${cleanName}&token=${subItem.token_acceso}`;
  };

  const normalizarRutEnlace = (rut) => String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();

  const fetchColaboracionesObra = async () => {
    const empresaActual = user?.empresa || companyBranding?.empresa;
    if (!empresaActual) return;
    try {
      const [enviadas, recibidas] = await Promise.all([
        supabase.from('colaboraciones_obra').select('*').eq('empresa_contratista', empresaActual).order('created_at', { ascending: false }),
        supabase.from('colaboraciones_obra').select('*').eq('empresa_colaboradora', empresaActual).order('created_at', { ascending: false })
      ]);
      if (enviadas.error && recibidas.error) return;
      const unicas = [...(enviadas.data || []), ...(recibidas.data || [])]
        .filter((item, index, array) => array.findIndex(candidate => candidate.id === item.id) === index);
      setColaboracionesObra(unicas);
    } catch (error) {
      console.warn('No fue posible cargar las colaboraciones de obra:', error.message);
    }
  };

  const buscarEmpresaObraxisPorRut = async (rut) => {
    const rutNormalizado = normalizarRutEnlace(rut);
    if (!rutNormalizado) return null;
    const { data, error } = await supabase
      .from('config_empresa')
      .select('empresa, razon_social, rut, correo_administrador')
      .not('rut', 'is', null);
    if (error) throw error;
    return (data || []).find(empresa => normalizarRutEnlace(empresa.rut) === rutNormalizado) || null;
  };

  const crearColaboracionObra = async (subItem) => {
    if (!canSend) { setErrorMsg('Tu perfil no está autorizado para enviar invitaciones de colaboración.'); return; }
    const empresaContratista = user?.empresa || companyBranding?.empresa;
    if (!empresaContratista) return { success: false, error: 'No se identificó la empresa contratista activa.' };

    let rutContratista = companyBranding?.rut;
    try {
      if (!rutContratista) {
        const { data } = await supabase.from('config_empresa').select('rut').eq('empresa', empresaContratista).maybeSingle();
        rutContratista = data?.rut;
      }
      if (!normalizarRutEnlace(rutContratista)) {
        return { success: false, error: 'Configura primero el RUT de tu empresa en Configuración.' };
      }

      const empresaColaboradora = await buscarEmpresaObraxisPorRut(subItem.rut_empresa);
      if (!empresaColaboradora) {
        return { success: false, notFound: true, error: 'No existe una empresa Obraxis con ese RUT. Se mantendrá el minisitio externo.' };
      }
      if (normalizarRutEnlace(empresaColaboradora.rut) === normalizarRutEnlace(rutContratista)) {
        return { success: false, error: 'No puedes vincular tu propia empresa como colaboradora.' };
      }

      const payload = {
        empresa_contratista: empresaContratista,
        rut_contratista: formatRut(rutContratista),
        empresa_colaboradora: empresaColaboradora.empresa,
        rut_colaboradora: formatRut(subItem.rut_empresa),
        obra_nombre: subItem.obra_asociada,
        correo_contacto: subItem.correo_contacto,
        estado: 'Pendiente de aceptación',
        invitado_por: user?.nombre || user?.name || user?.usuario || 'Equipo contratista'
      };
      const { data, error } = await supabase
        .from('colaboraciones_obra')
        .upsert(payload, { onConflict: 'rut_contratista,rut_colaboradora,obra_nombre' })
        .select()
        .maybeSingle();
      if (error) throw error;
      setColaboracionesObra(previous => [data, ...previous.filter(item => item.id !== data.id)]);
      return { success: true, collaboration: data, company: empresaColaboradora };
    } catch (error) {
      console.warn('No fue posible crear la colaboración de obra:', error.message);
      return { success: false, error: error.message || 'No fue posible crear la colaboración en Obraxis.' };
    }
  };

  const responderColaboracionObra = async (collaboration, estado) => {
    if (!canApprove) { setErrorMsg('Tu perfil no está autorizado para aprobar o rechazar colaboraciones.'); return; }
    try {
      const { data, error } = await supabase
        .from('colaboraciones_obra')
        .update({
          estado,
          respondido_por: user?.nombre || user?.name || user?.usuario || 'Empresa colaboradora',
          respondido_en: new Date().toISOString()
        })
        .eq('id', collaboration.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      setColaboracionesObra(previous => previous.map(item => item.id === collaboration.id ? data : item));
      setSuccessMsg(estado === 'Activa' ? `Colaboración aceptada para ${collaboration.obra_nombre}.` : `Colaboración rechazada para ${collaboration.obra_nombre}.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error) {
      setErrorMsg(`No fue posible responder la invitación: ${error.message}`);
      setTimeout(() => setErrorMsg(''), 6000);
    }
  };

  const sendSubcontractInvite = async (subItem) => {
    const email = (subItem?.correo_contacto || '').trim();
    if (!email) return { success: false, error: 'El subcontratista no tiene correo de contacto' };

    const minisiteUrl = getMinisiteUrl(subItem);
    return sendSystemEmail({
      to: email,
      subject: `Acreditación de subcontratista · ${subItem.obra_asociada || 'Obraxis'}`,
      htmlContent: `<div style="max-width:650px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;font-family:Arial,sans-serif;color:#1e293b;"><h2 style="margin:0 0 12px;color:#073b76;font-size:22px;">Acceso a acreditación de subcontratista</h2><p>Hola,</p><p>La empresa <strong>${subItem.empresa_nombre}</strong> fue registrada para acreditar documentación de empresa, personal y equipos en la obra <strong>${subItem.obra_asociada || 'asignada'}</strong>.</p><p>Ingresa al minisitio y completa la carga de antecedentes solicitados.</p><div style="margin:24px 0;padding:18px;border-radius:12px;background:#f8fafc;border:1px solid #cbd5e1;"><div style="font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Tus credenciales</div><p style="margin:12px 0 4px;"><strong>Empresa:</strong> ${subItem.empresa_nombre}</p><p style="margin:4px 0;"><strong>Clave de acceso:</strong> <span style="font-family:monospace;font-size:18px;font-weight:bold;letter-spacing:.08em;color:#073b76;">${subItem.credencial_pass}</span></p></div><p style="text-align:center;margin:26px 0;"><a href="${minisiteUrl}" style="display:inline-block;background:#073b76;color:#ffffff;padding:13px 22px;border-radius:10px;font-weight:bold;text-decoration:none;">Ingresar al minisitio</a></p><p style="font-size:12px;color:#64748b;word-break:break-all;">Si el botón no abre, copia este enlace:<br/><a href="${minisiteUrl}" style="color:#073b76;">${minisiteUrl}</a></p><p style="font-size:12px;color:#64748b;margin:20px 0 0;">Guarda esta clave de forma segura. Es necesaria para acceder al portal de acreditación.</p></div>`,
      permissionKey: 'acreditaciones.subcontratos.enviar'
    });
  };

  const sendCollaborationInvite = async (subItem, result) => {
    const email = (result?.company?.correo_administrador || subItem?.correo_contacto || '').trim();
    if (!email) return { success: false, error: 'La empresa colaboradora no tiene correo de contacto' };
    const collaboration = result.collaboration;
    const dashboardUrl = window.location.origin;
    return sendSystemEmail({
      to: email,
      subject: `Invitación a colaboración de obra · ${collaboration.obra_nombre}`,
      htmlContent: `<div style="max-width:650px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;font-family:Arial,sans-serif;color:#1e293b;"><h2 style="margin:0 0 12px;color:#073b76;font-size:22px;">Invitación a obra colaborativa</h2><p>Hola,</p><p>La empresa <strong>${collaboration.empresa_contratista}</strong> invitó a <strong>${collaboration.empresa_colaboradora}</strong> a colaborar en la obra <strong>${collaboration.obra_nombre}</strong>.</p><p>El enlace se realizó mediante el RUT de empresa <strong>${subItem.rut_empresa}</strong>. Inicia sesión en Obraxis para aceptar o rechazar la invitación desde <strong>Acreditaciones</strong>.</p><p style="text-align:center;margin:26px 0;"><a href="${dashboardUrl}" style="display:inline-block;background:#073b76;color:#ffffff;padding:13px 22px;border-radius:10px;font-weight:bold;text-decoration:none;">Ingresar a Obraxis</a></p><p style="font-size:12px;color:#64748b;margin:20px 0 0;">Una vez aceptada, ambas empresas verán la relación asociada a esta obra y quedará trazabilidad de la aceptación.</p></div>`,
      permissionKey: 'acreditaciones.subcontratos.enviar'
    });
  };

  const updateSubcontractInList = (updatedSub) => {
    const next = subcontratosList.map(item => item.token_acceso === updatedSub.token_acceso ? updatedSub : item);
    setSubcontratosList(next);
  };

  const handleSaveSubcontractEdit = async (event) => {
    event.preventDefault();
    if (!canEdit) { setErrorMsg('Tu perfil no está autorizado para editar subcontratos.'); return; }
    if (!editingSub?.empresa_nombre?.trim() || !editingSub?.correo_contacto?.trim()) return;
    const updatedSub = {
      ...editingSub,
      empresa_nombre: editingSub.empresa_nombre.trim(),
      rut_empresa: formatRut(editingSub.rut_empresa) || editingSub.rut_empresa,
      correo_contacto: editingSub.correo_contacto.trim(),
      credencial_pass: (editingSub.credencial_pass || '').trim().toUpperCase(),
      updated_at: new Date().toISOString()
    };
    try {
      if (updatedSub.id) {
        const { error } = await supabase.from('acreditaciones_subcontratos').update({
          empresa_nombre: updatedSub.empresa_nombre, rut_empresa: updatedSub.rut_empresa,
          obra_asociada: updatedSub.obra_asociada, correo_contacto: updatedSub.correo_contacto
        }).eq('id', updatedSub.id);
        if (error) throw error;
        if (updatedSub.credencial_pass) {
          const { error: credentialError } = await supabase.from('acreditaciones_subcontratos').update({ credencial_pass: updatedSub.credencial_pass }).eq('id', updatedSub.id);
          if (credentialError) throw credentialError;
        }
      }
    } catch (error) { setErrorMsg(`No fue posible editar el subcontrato: ${error.message}`); return; }
    updateSubcontractInList(updatedSub);
    if (editingSub.integrar_en_obraxis) {
      const collaborationResult = await crearColaboracionObra(updatedSub);
      if (collaborationResult.success) await sendCollaborationInvite(updatedSub, collaborationResult);
    }
    setEditingSub(null);
    setSuccessMsg('Subcontratista actualizado. Reenvía las credenciales si modificaste el correo o la clave.');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleArchiveSubcontract = async (subItem, archived) => {
    if (!canEdit) { setErrorMsg('Tu perfil no está autorizado para archivar o reactivar subcontratos.'); return; }
    const action = archived ? 'archivar' : 'reactivar';
    if (!window.confirm(`¿Deseas ${action} a ${subItem.empresa_nombre}?`)) return;
    const updatedSub = { ...subItem, estado: archived ? 'Archivado' : 'Pendiente', updated_at: new Date().toISOString() };
    try {
      if (subItem.id) {
        const { error } = await supabase.from('acreditaciones_subcontratos').update({ estado: updatedSub.estado }).eq('id', subItem.id);
        if (error) throw error;
      }
    } catch (error) { setErrorMsg(`No fue posible cambiar el estado: ${error.message}`); return; }
    updateSubcontractInList(updatedSub);
    setSuccessMsg(`${subItem.empresa_nombre} fue ${archived ? 'archivado' : 'reactivado'}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleDeleteSubcontract = async (subItem) => {
    if (!canDelete) { setErrorMsg('Tu perfil no está autorizado para eliminar subcontratos.'); return; }
    if (!window.confirm(`¿Eliminar definitivamente a ${subItem.empresa_nombre}? Esta acción también eliminará sus respaldos locales.`)) return;
    try {
      if (subItem.id) {
        const { error } = await supabase.from('acreditaciones_subcontratos').delete().eq('id', subItem.id);
        if (error) throw error;
      }
    } catch (error) { setErrorMsg(`No fue posible eliminar el subcontrato: ${error.message}`); return; }
    const next = subcontratosList.filter(item => item.token_acceso !== subItem.token_acceso);
    setSubcontratosList(next);
    setSuccessMsg(`${subItem.empresa_nombre} fue eliminado.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const visibleSubcontracts = subcontratosList.filter(sub => showArchivedSubcontracts ? sub.estado === 'Archivado' : sub.estado !== 'Archivado');

  const openSubDetailModal = async (subItem) => {
    const { data, error } = await supabase.from('acreditaciones_subcontratos').select('*').eq('id', subItem.id).single();
    if (error) { setErrorMsg(`No fue posible cargar la acreditación: ${error.message}`); return; }
    setSelectedSubDetail({
      ...data,
      companyDocs: data.companyDocs || {},
      personalList: data.personalList || [],
      equiposList: data.equiposList || []
    });
    setSubModalTab('empresa');
    setRejectingKey(null);
    setRejectReasonInput('');
  };

  // LÓGICA DE APROBACIÓN Y RECHAZO CON MOTIVO
  const handleUpdateDocStatus = async (category, docKey, status, itemIndex = null, reason = '') => {
    if (!selectedSubDetail) return;

    let nextCompanyDocs = { ...(selectedSubDetail.companyDocs || {}) };
    let nextPersonalList = [...(selectedSubDetail.personalList || [])];
    let nextEquiposList = [...(selectedSubDetail.equiposList || [])];

    if (category === 'empresa') {
      if (nextCompanyDocs[docKey]) {
        nextCompanyDocs[docKey] = {
          ...nextCompanyDocs[docKey],
          status: status,
          motivo_rechazo: status === 'Rechazado' ? reason : null,
          reviewedAt: new Date().toLocaleDateString('es-CL')
        };
      }
    } else if (category === 'personal' && itemIndex !== null) {
      if (nextPersonalList[itemIndex] && nextPersonalList[itemIndex].docs && nextPersonalList[itemIndex].docs[docKey]) {
        nextPersonalList[itemIndex].docs[docKey] = {
          ...nextPersonalList[itemIndex].docs[docKey],
          status: status,
          motivo_rechazo: status === 'Rechazado' ? reason : null,
          reviewedAt: new Date().toLocaleDateString('es-CL')
        };
      }
    } else if (category === 'equipos' && itemIndex !== null) {
      if (nextEquiposList[itemIndex] && nextEquiposList[itemIndex].docs && nextEquiposList[itemIndex].docs[docKey]) {
        nextEquiposList[itemIndex].docs[docKey] = {
          ...nextEquiposList[itemIndex].docs[docKey],
          status: status,
          motivo_rechazo: status === 'Rechazado' ? reason : null,
          reviewedAt: new Date().toLocaleDateString('es-CL')
        };
      }
    }

    const empApprovedCount = Object.values(nextCompanyDocs).filter(d => d && d.status === 'Aprobado').length;
    const progressPercent = Math.round((empApprovedCount / mandatoryCompanyDocs.length) * 100);

    const updatedSub = {
      ...selectedSubDetail,
      estado_cumplimiento: progressPercent,
      companyDocs: nextCompanyDocs,
      personalList: nextPersonalList,
      equiposList: nextEquiposList
    };

    setSelectedSubDetail(updatedSub);

    const { error } = await supabase.from('acreditaciones_subcontratos').update({
      companyDocs: nextCompanyDocs, personalList: nextPersonalList, equiposList: nextEquiposList,
      estado_cumplimiento: progressPercent, updated_at: new Date().toISOString()
    }).eq('id', selectedSubDetail.id);
    if (error) { setErrorMsg(`No fue posible guardar la revisión: ${error.message}`); return; }
    updateSubcontractInList(updatedSub);

    setRejectingKey(null);
    setRejectReasonInput('');
    setSuccessMsg(`Documento actualizado a: ${status}`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const openFileViewer = (fileData) => {
    if (!fileData || !fileData.base64) {
      alert('El archivo no está disponible.');
      return;
    }
    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${fileData.base64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  if (permissionsLoading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Cargando permisos…</div>;
  if (!canView) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm font-bold text-amber-900">Tu perfil no tiene permiso para ver Acreditaciones.</div>;
  return (
    <div className="space-y-6 font-sans">
      {/* 1. CABECERA PRINCIPAL */}
      <ModuleHeader title="Acreditaciones" subtitle="Gestión de acreditaciones para faena y control documental de subcontratos." Icon={ShieldCheck} onBack={handleHeaderBack} actions={activeSection !== '' && (
          <button
            onClick={() => setActiveSection('')}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer border border-slate-200"
          >
            <span>← Volver al Menú Principal</span>
          </button>
        )} />

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ================= VISTA PRINCIPAL: MENÚ DE TARJETAS / RECTÁNGULOS ================= */}
      {activeSection === '' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          
          {/* Tarjeta 1: Acreditarme (Personal Propio) */}
          <div
            onClick={() => { setActiveSection('acreditarme'); setAcreditarmeSubTab('enviar'); }}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <User className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">Personal Propio</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                Acreditarme (Personal Propio)
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Selecciona proyecto y trabajadores. Sincroniza automáticamente los respaldos desde Recursos Humanos y envía las acreditaciones a faena.
              </p>
            </div>
          </div>

          {/* Tarjeta 2: Acreditación Subcontrato */}
          <div
            onClick={() => setActiveSection('subcontratos')}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase">Subcontratos ({subcontratosList.length})</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-blue-600 transition">
                Acreditación Subcontrato
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Genera credenciales de acceso por token y minisitio dedicado para recepción, evaluación y aprobación/rechazo de documentos de externos.
              </p>
            </div>
          </div>

          {/* Tarjeta 3: Configurar Documentos Obligatorios */}
          <div
            onClick={() => setActiveSection('config_docs')}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                <Settings2 className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">Configuración</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-emerald-600 transition">
                Documentos Obligatorios Exigidos
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Enlista, modifica y administra la lista obligatoria de documentos solicitados a personal propio, subcontratistas y maquinarias.
              </p>
            </div>
          </div>

        
          {/* Tarjeta 4: Acreditación Proveedores */}
          <div
            onClick={() => setActiveSection('proveedores')}
            className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-amber-500 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex items-start justify-between">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                <Store className="w-6 h-6" />
              </div>
              <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">Proveedores ({proveedoresList.length})</span>
            </div>
            <div className="space-y-1 mt-4">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-amber-600 transition">
                Acreditación Proveedores
              </h3>
              <p className="text-xs text-slate-500 leading-normal">
                Genera credenciales de acceso por token y minisitio dedicado para evaluación y acreditación de proveedores y choferes de entrega.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ================= SUBMÓDULO 1: ACREDITARME (PERSONAL PROPIO) ================= */}
      {activeSection === 'acreditarme' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* PESTAÑAS INTERNAS DE ACREDITARME */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 border border-slate-200 w-fit">
            <button
              onClick={() => setAcreditarmeSubTab('enviar')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${acreditarmeSubTab === 'enviar' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Send className="w-4 h-4" />
              <span>1. Configurar y Enviar Acreditación</span>
            </button>
            <button
              onClick={() => setAcreditarmeSubTab('docs_personal')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${acreditarmeSubTab === 'docs_personal' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FileCheck className="w-4 h-4" />
              <span>2. Documentos Requeridos Personal Propio ({mandatoryWorkerDocs.length})</span>
            </button>
            <button
              onClick={() => setAcreditarmeSubTab('historial')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${acreditarmeSubTab === 'historial' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Clock className="w-4 h-4" />
              <span>3. Historial de Envíos ({historialInterno.length})</span>
            </button>
          </div>

          {/* SUB-PESTAÑA 1: CONFIGURAR Y ENVIAR */}
          {acreditarmeSubTab === 'enviar' && (
            <form onSubmit={handleSendAcreditacion} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <FileUp className="w-4 h-4 text-primary" />
                <span>Configurar Petición de Acreditación de Personal Propio</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Proyecto / Obra de Destino</label>
                  <select
                    value={selectedObra}
                    onChange={(e) => setSelectedObra(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold bg-slate-50"
                    required
                  >
                    <option value="">-- Seleccionar Obra --</option>
                    {obrasList.map((o) => (
                      <option key={o.id} value={o.nombre}>{o.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Correo Electrónico Destinatario / Mandante</label>
                  <input
                    type="email"
                    required
                    placeholder="ej: acreditaciones@minera.cl"
                    value={destinatarioEmail}
                    onChange={(e) => setDestinatarioEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Asunto del Correo (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ej: Acreditación Personal Obraxis - Proyecto Parque Central"
                    value={asuntoEmail}
                    onChange={(e) => setAsuntoEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Observaciones o Instrucciones Especiales</label>
                <textarea
                  rows="2"
                  placeholder="Indique si hay pases de ingreso especiales o requerimientos adicionales..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white"
                ></textarea>
              </div>

              {/* SELECCIÓN DE TRABAJADORES */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span>Seleccionar Trabajadores ({selectedWorkers.length} Seleccionados)</span>
                  </h4>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Sincronización Automática activa con RRHH
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
                  {personalList.map((worker) => {
                    const isSelected = selectedWorkers.includes(worker.rut);
                    return (
                      <div
                        key={worker.id || worker.rut}
                        onClick={() => toggleWorkerSelection(worker.rut)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${isSelected ? 'bg-primary/5 border-primary shadow-2xs' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                      >
                        <div>
                          <div className="font-extrabold text-xs text-slate-900 uppercase">{worker.nombre}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">RUT: {worker.rut} | {worker.cargo || 'Maestro'}</div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${isSelected ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'}`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold py-3.5 rounded-2xl shadow-sm text-xs cursor-pointer flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{sendingEmail ? 'Enviando Solicitud...' : 'Enviar Solicitud de Acreditación por Correo'}</span>
                </button>
              </div>
            </form>
          )}

          {/* SUB-PESTAÑA 2: ENLISTAR Y MODIFICAR DOCUMENTOS DEL PERSONAL PROPIO */}
          {acreditarmeSubTab === 'docs_personal' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Listado de Documentos Requeridos para Personal Propio ({mandatoryWorkerDocs.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Modifique o agregue documentos exigidos. Los documentos existentes en la Ficha de Recursos Humanos se sincronizan automáticamente.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {mandatoryWorkerDocs.map((d) => (
                  <div key={d.key} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      <span>{d.label}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveMandatoryWorkerDoc(d.key)}
                      className="text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg transition cursor-pointer"
                      title="Eliminar de requerimientos"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddMandatoryWorkerDoc} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Agregar nuevo documento requerido para personal propio (Ej: Certificado Inducción Cliente)..."
                  value={newWorkerDocLabel}
                  onChange={(e) => setNewWorkerDocLabel(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-medium"
                />
                <button type="submit" className="bg-primary hover:bg-primary-hover text-white font-extrabold px-5 rounded-xl text-xs transition cursor-pointer">
                  + Agregar Documento
                </button>
              </form>
            </div>
          )}

          {/* SUB-PESTAÑA 3: HISTORIAL INTERNO */}
          {acreditarmeSubTab === 'historial' && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
                Historial de Solicitudes Enviadas ({historialInterno.length})
              </h3>
              {historialInterno.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">No hay solicitudes registradas aún.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-650 font-bold text-[9px] uppercase tracking-wider">
                        <th className="p-3">Obra</th>
                        <th className="p-3">Destinatario</th>
                        <th className="p-3">Trabajadores</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {historialInterno.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-extrabold text-slate-900 uppercase">{item.obra_nombre}</td>
                          <td className="p-3 text-slate-700 font-mono">{item.destinatario_email}</td>
                          <td className="p-3 font-bold">{Array.isArray(item.trabajadores_json) ? item.trabajadores_json.length : 0} Personas</td>
                          <td className="p-3 text-slate-500">{new Date(item.created_at).toLocaleString('es-CL')}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedHistorialDetail(item)}
                              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
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

      {/* ================= SUBMÓDULO 2: ACREDITACIÓN SUBCONTRATO ================= */}
      {activeSection === 'subcontratos' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {showArchivedSubcontracts ? 'Subcontratistas Archivados' : 'Empresas Subcontratistas Habilitadas'} ({visibleSubcontracts.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gestione credenciales y revise/apruebe documentos subidos por cada contratista.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowArchivedSubcontracts(value => !value)} className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold px-3 py-2 rounded-xl text-[11px] flex items-center gap-1.5 transition cursor-pointer">
                  <Archive className="w-3.5 h-3.5" />
                  <span>{showArchivedSubcontracts ? 'Ver activos' : `Archivados (${subcontratosList.filter(sub => sub.estado === 'Archivado').length})`}</span>
                </button>
                <button onClick={() => setShowSubModal(true)} className="bg-primary hover:bg-primary-hover text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                  <Plus className="w-4 h-4" />
                  <span>+ Registrar Subcontrato</span>
                </button>
              </div>
            </div>

            {colaboracionesObra.length > 0 && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-950">Colaboraciones entre empresas Obraxis</h4>
                    <p className="mt-0.5 text-[10px] text-indigo-800">Relaciones vinculadas por RUT de empresa y asociadas a una obra.</p>
                  </div>
                  <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-extrabold text-indigo-800">{colaboracionesObra.length} vinculada{colaboracionesObra.length === 1 ? '' : 's'}</span>
                </div>
                <div className="space-y-2">
                  {colaboracionesObra.map(collaboration => {
                    const soyColaboradora = collaboration.empresa_colaboradora === (user?.empresa || companyBranding?.empresa);
                    const pendienteParaMi = soyColaboradora && collaboration.estado === 'Pendiente de aceptación';
                    const tone = collaboration.estado === 'Activa' ? 'bg-emerald-100 text-emerald-800' : collaboration.estado === 'Rechazada' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
                    return (
                      <div key={collaboration.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[11px] font-extrabold text-slate-800 truncate">{collaboration.obra_nombre}</p>
                          <p className="text-[10px] text-slate-500">{collaboration.empresa_contratista} <span className="mx-1">→</span> {collaboration.empresa_colaboradora}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md px-2 py-1 text-[9px] font-extrabold ${tone}`}>{collaboration.estado}</span>
                          {pendienteParaMi && <>
                            <button type="button" onClick={() => responderColaboracionObra(collaboration, 'Activa')} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-extrabold text-white hover:bg-emerald-700">Aceptar</button>
                            <button type="button" onClick={() => responderColaboracionObra(collaboration, 'Rechazada')} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-extrabold text-rose-700 hover:bg-rose-100">Rechazar</button>
                          </>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {visibleSubcontracts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No hay empresas subcontratistas registradas aún. Haga clic en "+ Registrar Subcontrato" para generar credenciales.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleSubcontracts.map((sub) => {
                  const minisiteUrl = getMinisiteUrl(sub);
                  const collaboration = colaboracionesObra.find(item =>
                    normalizarRutEnlace(item.rut_colaboradora) === normalizarRutEnlace(sub.rut_empresa)
                    && item.obra_nombre === (sub.obra_asociada || 'Todas las Obras')
                  );

                  const empDocs = sub.companyDocs || {};
                  const empApprovedCount = Object.values(empDocs).filter(d => d && d.status === 'Aprobado').length;
                  const percent = Math.round((empApprovedCount / mandatoryCompanyDocs.length) * 100) || 0;
                  const personalRecords = sub.personalList || [];
                  const equiposRecords = sub.equiposList || [];
                  const personalDocs = personalRecords.flatMap(persona => Object.values(persona.docs || {}));
                  const equiposDocs = equiposRecords.flatMap(equipo => Object.values(equipo.docs || {}));
                  const personalApproved = personalDocs.filter(documento => documento && documento.status === 'Aprobado').length;
                  const equiposApproved = equiposDocs.filter(documento => documento && documento.status === 'Aprobado').length;
                  const getDocumentStatus = (records, approved, total) => {
                    if (!records.length) return { label: 'Sin registros', tone: 'text-slate-500 bg-slate-100' };
                    if (approved === total && total > 0) return { label: 'Conforme', tone: 'text-emerald-700 bg-emerald-50' };
                    if (approved > 0) return { label: 'En revisión', tone: 'text-amber-700 bg-amber-50' };
                    return { label: 'Pendiente', tone: 'text-rose-700 bg-rose-50' };
                  };
                  const companyStatus = getDocumentStatus([empDocs], empApprovedCount, mandatoryCompanyDocs.length);
                  const personalStatus = getDocumentStatus(personalRecords, personalApproved, personalDocs.length);
                  const equiposStatus = getDocumentStatus(equiposRecords, equiposApproved, equiposDocs.length);

                  return (
                    <div key={sub.id || sub.token_acceso} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 hover:shadow-sm transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black text-sm text-slate-900 uppercase">{sub.empresa_nombre}</h4>
                          <span className="text-[10px] text-slate-500 font-mono block">RUT: {sub.rut_empresa || 'Sin RUT'}</span>
                        </div>
                        <span className="bg-blue-100 text-blue-900 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                          {sub.obra_asociada || 'Obraxis'}
                        </span>
                      </div>

                      {collaboration && (
                        <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-2 text-[10px]">
                          <span className="font-bold text-indigo-900">Conectada con Obraxis por RUT</span>
                          <span className="font-extrabold text-indigo-700">{collaboration.estado}</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-600">
                          <span>Docs Aprobados:</span>
                          <span className="text-emerald-700 font-mono">{empApprovedCount} de {mandatoryCompanyDocs.length} Aprobados ({percent}%)</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 text-[9px] font-bold">
                          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"><p className="text-slate-500">Docs empresa</p><p className="mt-0.5 text-slate-700">{empApprovedCount}/{mandatoryCompanyDocs.length}</p><span className={`mt-1 inline-flex rounded px-1.5 py-0.5 ${companyStatus.tone}`}>{companyStatus.label}</span></div>
                          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"><p className="text-slate-500">Docs personal</p><p className="mt-0.5 text-slate-700">{personalRecords.length ? `${personalApproved}/${personalDocs.length}` : '0 personas'}</p><span className={`mt-1 inline-flex rounded px-1.5 py-0.5 ${personalStatus.tone}`}>{personalStatus.label}</span></div>
                          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"><p className="text-slate-500">Docs equipos</p><p className="mt-0.5 text-slate-700">{equiposRecords.length ? `${equiposApproved}/${equiposDocs.length}` : '0 equipos'}</p><span className={`mt-1 inline-flex rounded px-1.5 py-0.5 ${equiposStatus.tone}`}>{equiposStatus.label}</span></div>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                        <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Credenciales de Acceso:</div>
                        <div className="flex justify-between items-center text-slate-700 font-mono text-[11px]">
                          <span>Token: <strong>{sub.token_acceso}</strong></span>
                          <span>Clave: <strong>{sub.credencial_pass}</strong></span>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        <button
                          onClick={() => openSubDetailModal(sub)}
                          className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Revisar, Aprobar o Rechazar Documentos</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const result = await sendSubcontractInvite(sub);
                            setSuccessMsg(result.success ? `Credenciales reenviadas a ${sub.correo_contacto}.` : `No se pudo reenviar el correo: ${result.error}`);
                            setTimeout(() => setSuccessMsg(''), 5000);
                          }}
                          disabled={!sub.correo_contacto}
                          className="w-full border border-primary/25 bg-white text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 font-extrabold py-2 rounded-xl text-[11px] flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Reenviar credenciales por correo</span>
                        </button>

                        <div className="grid grid-cols-3 gap-2">
                          <button type="button" onClick={() => setEditingSub({ ...sub })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[10px] font-extrabold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button type="button" onClick={() => handleArchiveSubcontract(sub, sub.estado !== 'Archivado')} className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] font-extrabold text-amber-800 hover:bg-amber-100 flex items-center justify-center gap-1.5">
                            {sub.estado === 'Archivado' ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />} {sub.estado === 'Archivado' ? 'Reactivar' : 'Archivar'}
                          </button>
                          <button type="button" onClick={() => handleDeleteSubcontract(sub)} className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-[10px] font-extrabold text-rose-700 hover:bg-rose-100 flex items-center justify-center gap-1.5">
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={minisiteUrl}
                            className="bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-mono text-slate-600 flex-1 truncate"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(minisiteUrl);
                              setSuccessMsg('Enlace copiado al portapapeles.');
                              setTimeout(() => setSuccessMsg(''), 4000);
                            }}
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition cursor-pointer"
                            title="Copiar enlace"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
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

      
      {/* ================= SUBMÓDULO 4: ACREDITACIÓN PROVEEDORES ================= */}
      {activeSection === 'proveedores' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Empresas Proveedoras Habilitadas ({proveedoresList.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Gestione credenciales y revise/apruebe documentos subidos por cada proveedor comercial o de servicio.
                </p>
              </div>
              <button
                onClick={() => setShowProvModal(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Registrar Proveedor</span>
              </button>
            </div>

            {proveedoresList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No hay empresas proveedoras registradas aún. Haga clic en "+ Registrar Proveedor" para generar credenciales.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {proveedoresList.map((prov) => {
                  const minisiteUrl = getSupplierMinisiteUrl(prov);

                  const empDocs = prov.companyDocs || {};
                  const empApprovedCount = Object.values(empDocs).filter(d => d && d.status === 'Aprobado').length;
                  const percent = Math.round((empApprovedCount / mandatorySupplierDocs.length) * 100) || 0;

                  return (
                    <div key={prov.id || prov.token_acceso} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 hover:shadow-sm transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black text-sm text-slate-900 uppercase">{prov.empresa_nombre}</h4>
                          <span className="text-[10px] text-slate-500 font-mono block">RUT: {formatRut(prov.rut_empresa) || 'Sin RUT'}</span>
                        </div>
                        <span className="bg-amber-100 text-amber-900 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                          {prov.obra_asociada || 'Obraxis'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-600">
                          <span>Docs Aprobados:</span>
                          <span className="text-emerald-700 font-mono">{empApprovedCount} de {mandatorySupplierDocs.length} Aprobados ({percent}%)</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[9.5px] text-slate-500 pt-1 font-semibold">
                          <span>Choferes/Personal: {(prov.personalList || []).length} personas</span>
                          <span>Vehículos: {(prov.equiposList || []).length} camiones</span>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                        <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Credenciales de Acceso Proveedor:</div>
                        <div className="flex justify-between items-center text-slate-700 font-mono text-[11px]">
                          <span>Token: <strong>{prov.token_acceso}</strong></span>
                          <span>Clave: <strong>{prov.credencial_pass}</strong></span>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        <button
                          onClick={() => openProvDetailModal(prov)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Revisar, Aprobar o Rechazar Documentos</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={minisiteUrl}
                            className="bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-mono text-slate-600 flex-1 truncate"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(minisiteUrl);
                              setSuccessMsg('Enlace de proveedor copiado al portapapeles.');
                              setTimeout(() => setSuccessMsg(''), 4000);
                            }}
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition cursor-pointer"
                            title="Copiar enlace"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
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

      {/* ================= SUBMÓDULO 3: CONFIGURACIÓN DE DOCUMENTOS OBLIGATORIOS ================= */}
      {activeSection === 'config_docs' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <span>Configuración Global de Documentos Obligatorios Exigidos</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Administre el catálogo obligatorio de respaldos requeridos para empresas subcontratistas, personal propio/externo y maquinarias.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            
            {/* COLUMNA 1: DOCS EMPRESA */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span>1. Docs. Empresa Subcontratista</span>
              </h4>
              <div className="space-y-2">
                {mandatoryCompanyDocs.map(d => (
                  <div key={d.key} className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-3.5 h-3.5 text-primary" />
                      <span>{d.label}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveMandatoryCompanyDoc(d.key)}
                      className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition cursor-pointer"
                      title="Quitar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddMandatoryCompanyDoc} className="space-y-2 pt-2">
                <input
                  type="text"
                  placeholder="Agregar nuevo documento empresa..."
                  value={newCompanyDocLabel}
                  onChange={(e) => setNewCompanyDocLabel(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
                <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer">
                  + Agregar a Empresa
                </button>
              </form>
            </div>

            {/* COLUMNA 2: DOCS TRABAJADOR */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                <User className="w-4 h-4 text-emerald-600" />
                <span>2. Docs. Trabajadores (Personal)</span>
              </h4>
              <div className="space-y-2">
                {mandatoryWorkerDocs.map(d => (
                  <div key={d.key} className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{d.label}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveMandatoryWorkerDoc(d.key)}
                      className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition cursor-pointer"
                      title="Quitar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddMandatoryWorkerDoc} className="space-y-2 pt-2">
                <input
                  type="text"
                  placeholder="Agregar nuevo documento trabajador..."
                  value={newWorkerDocLabel}
                  onChange={(e) => setNewWorkerDocLabel(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer">
                  + Agregar a Trabajador
                </button>
              </form>
            </div>

            {/* COLUMNA 3: DOCS MAQUINARIAS */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>3. Docs. Maquinarias y Equipos</span>
              </h4>
              <div className="space-y-2">
                {mandatoryEquipoDocs.map(d => (
                  <div key={d.key} className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                      <span>{d.label}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveMandatoryEquipoDoc(d.key)}
                      className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition cursor-pointer"
                      title="Quitar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddMandatoryEquipoDoc} className="space-y-2 pt-2">
                <input
                  type="text"
                  placeholder="Agregar nuevo documento equipo..."
                  value={newEquipoDocLabel}
                  onChange={(e) => setNewEquipoDocLabel(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer">
                  + Agregar a Equipos
                </button>
              </form>
            
            {/* COLUMNA 4: DOCS PROVEEDORES */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                <Store className="w-4 h-4 text-amber-600" />
                <span>4. Docs. Proveedores Comerciales</span>
              </h4>
              <div className="space-y-2">
                {mandatorySupplierDocs.map(d => (
                  <div key={d.key} className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                      <span>{d.label}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveMandatorySupplierDoc(d.key)}
                      className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition cursor-pointer"
                      title="Quitar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddMandatorySupplierDoc} className="space-y-2 pt-2">
                <input
                  type="text"
                  placeholder="Agregar nuevo documento proveedor..."
                  value={newSupplierDocLabel}
                  onChange={(e) => setNewSupplierDocLabel(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer">
                  + Agregar a Proveedores
                </button>
              </form>
            </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL EDITAR SUBCONTRATO */}
      {editingSub && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div><h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Editar subcontratista</h3><p className="text-[10px] text-slate-500 mt-0.5">Los cambios se aplican al minisitio y a sus próximas credenciales.</p></div>
              <button type="button" onClick={() => setEditingSub(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveSubcontractEdit} className="space-y-3">
              <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Empresa *</label><input required value={editingSub.empresa_nombre || ''} onChange={event => setEditingSub({ ...editingSub, empresa_nombre: event.target.value })} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT</label><input value={editingSub.rut_empresa || ''} onChange={event => setEditingSub({ ...editingSub, rut_empresa: event.target.value })} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800" /></div>
                <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Obra</label><select value={editingSub.obra_asociada || ''} onChange={event => setEditingSub({ ...editingSub, obra_asociada: event.target.value })} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 bg-white"><option value="">Todas las obras</option>{obrasList.map(obra => <option key={obra.id} value={obra.nombre}>{obra.nombre}</option>)}</select></div>
              </div>
              <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo de contacto *</label><input type="email" required value={editingSub.correo_contacto || ''} onChange={event => setEditingSub({ ...editingSub, correo_contacto: event.target.value })} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800" /></div>
              <label className="flex cursor-pointer gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                <input type="checkbox" checked={Boolean(editingSub.integrar_en_obraxis)} onChange={event => setEditingSub({ ...editingSub, integrar_en_obraxis: event.target.checked })} className="mt-0.5 h-4 w-4 accent-indigo-700" />
                <span><span className="block text-[11px] font-extrabold text-indigo-950">Empresa colaboradora en Obraxis</span><span className="block mt-0.5 text-[10px] leading-relaxed text-indigo-800">Busca la empresa por su RUT y envía una invitación para esta obra. Si no existe, conserva el minisitio externo.</span></span>
              </label>
              <div><div className="flex justify-between items-center mb-1"><label className="block text-[10px] font-bold uppercase text-slate-500">Clave de acceso</label><button type="button" onClick={() => setEditingSub({ ...editingSub, credencial_pass: Math.random().toString(36).substring(2, 8).toUpperCase() })} className="text-[10px] font-bold text-primary hover:underline">Regenerar clave</button></div><input required value={editingSub.credencial_pass || ''} onChange={event => setEditingSub({ ...editingSub, credencial_pass: event.target.value.toUpperCase() })} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800" /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setEditingSub(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100">Cancelar</button><button type="submit" className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-primary hover:bg-primary-hover">Guardar cambios</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR SUBCONTRATO */}
      {showSubModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                <span>Registrar Subcontratista Externo</span>
              </h3>
              <button onClick={() => setShowSubModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateSubcontrato} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Empresa Subcontratista</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Subcontratos y Montajes SpA"
                  value={subForm.empresa_nombre}
                  onChange={(e) => setSubForm({ ...subForm, empresa_nombre: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT Empresa *</label>
                <input
                  type="text"
                  required
                    placeholder="76.123.456-7"
                    value={subForm.rut_empresa}
                    onChange={(e) => setSubForm({ ...subForm, rut_empresa: e.target.value })}
                    onBlur={(e) => setSubForm({ ...subForm, rut_empresa: formatRut(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Obra Asociada</label>
                  <select
                    value={subForm.obra_asociada}
                    onChange={(e) => setSubForm({ ...subForm, obra_asociada: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold bg-white"
                  >
                    <option value="">-- Seleccionar --</option>
                    {obrasList.map(o => (
                      <option key={o.id} value={o.nombre}>{o.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex cursor-pointer gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                <input
                  type="checkbox"
                  checked={subForm.integrar_en_obraxis}
                  onChange={(e) => setSubForm({ ...subForm, integrar_en_obraxis: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-indigo-700"
                />
                <span>
                  <span className="block text-[11px] font-extrabold text-indigo-950">Empresa colaboradora en Obraxis</span>
                  <span className="block mt-0.5 text-[10px] leading-relaxed text-indigo-800">Usaremos el RUT para encontrar su cuenta Obraxis e invitarla a colaborar en esta obra. Si no existe, se mantiene el acceso por minisitio.</span>
                </span>
              </label>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo Electrónico de Contacto</label>
                <input
                  type="email"
                  required
                  placeholder="contacto@subcontrato.cl"
                  value={subForm.correo_contacto}
                  onChange={(e) => setSubForm({ ...subForm, correo_contacto: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Clave de Acceso (Opcional - Autogenerada si omite)</label>
                <input
                  type="text"
                  placeholder="ej: PASS2026"
                  value={subForm.credencial_pass}
                  onChange={(e) => setSubForm({ ...subForm, credencial_pass: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingSubInvite}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-primary hover:bg-primary-hover transition cursor-pointer shadow-xs"
                >
                  {sendingSubInvite ? 'Creando y enviando…' : subForm.integrar_en_obraxis ? 'Crear e invitar a Obraxis' : 'Crear y enviar credenciales'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE Y REVISIÓN / APROBACIÓN / RECHAZO DE DOCUMENTOS */}
      {selectedSubDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[9.5px] font-extrabold uppercase text-blue-600 tracking-wider">Centro de Evaluación y Acreditación</span>
                <h3 className="font-black text-slate-900 text-sm uppercase">{selectedSubDetail.empresa_nombre}</h3>
                <span className="text-[10.5px] text-slate-500">RUT: {selectedSubDetail.rut_empresa || 'N/A'} | Obra: {selectedSubDetail.obra_asociada}</span>
              </div>
              <button onClick={() => setSelectedSubDetail(null)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => { setSubModalTab('empresa'); setRejectingKey(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${subModalTab === 'empresa' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Docs. Empresa ({Object.keys(selectedSubDetail.companyDocs || {}).length})
              </button>
              <button
                onClick={() => { setSubModalTab('personal'); setRejectingKey(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${subModalTab === 'personal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Personal Externo ({(selectedSubDetail.personalList || []).length})
              </button>
              <button
                onClick={() => { setSubModalTab('equipos'); setRejectingKey(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${subModalTab === 'equipos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Equipos Externos ({(selectedSubDetail.equiposList || []).length})
              </button>
            </div>

            {subModalTab === 'empresa' && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase text-slate-700">Archivos Legales de la Empresa Subcontratista:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mandatoryCompanyDocs.map(item => {
                    const uploaded = selectedSubDetail.companyDocs && selectedSubDetail.companyDocs[item.key];
                    const docStatus = uploaded ? (uploaded.status || 'Pendiente de Revisión') : 'No cargado';
                    const isRejecting = rejectingKey === `empresa_${item.key}`;

                    return (
                      <div key={item.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                        <div className="flex justify-between items-start">
                          <div className="font-extrabold text-slate-800 uppercase">{item.label}</div>
                          {uploaded && (
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                              docStatus === 'Aprobado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              docStatus === 'Rechazado' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {docStatus}
                            </span>
                          )}
                        </div>

                        {uploaded ? (
                          <div className="space-y-2">
                            <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex justify-between items-center text-xs">
                              <span className="truncate text-[11px] font-bold text-slate-700">{uploaded.fileName}</span>
                              <button
                                onClick={() => openFileViewer(uploaded)}
                                className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver Archivo</span>
                              </button>
                            </div>

                            {uploaded.motivo_rechazo && (
                              <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl text-[10px] text-rose-800 flex items-start gap-1.5 font-medium">
                                <MessageSquare className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                <div><strong>Motivo Rechazo:</strong> {uploaded.motivo_rechazo}</div>
                              </div>
                            )}

                            <AccreditationAIReview file={uploaded} empresa={user?.empresa || companyBranding?.empresa} obra={selectedSubDetail.obra_asociada} subcontratista={selectedSubDetail} categoria="empresa" entidad={selectedSubDetail.empresa_nombre} documentKey={item.key} documentName={item.label} canDecide={canReview} user={user} />

                            <div className="flex gap-1.5 pt-1">
                              <button
                                onClick={() => handleUpdateDocStatus('empresa', item.key, 'Aprobado')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${docStatus === 'Aprobado' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aprobar</span>
                              </button>
                              <button
                                onClick={() => setRejectingKey(`empresa_${item.key}`)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${docStatus === 'Rechazado' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'}`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Rechazar</span>
                              </button>
                            </div>

                            {isRejecting && (
                              <div className="bg-white p-3 rounded-xl border border-rose-300 space-y-2 animate-in fade-in">
                                <label className="block text-[9.5px] font-bold text-rose-900 uppercase">Indique el Motivo de Rechazo:</label>
                                <textarea
                                  rows="2"
                                  placeholder="Ej: Documento borroso o certificado vencido..."
                                  value={rejectReasonInput}
                                  onChange={(e) => setRejectReasonInput(e.target.value)}
                                  className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-800"
                                ></textarea>
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => setRejectingKey(null)}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!rejectReasonInput.trim()) return alert('Ingrese el motivo de rechazo.');
                                      handleUpdateDocStatus('empresa', item.key, 'Rechazado', null, rejectReasonInput.trim());
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                                  >
                                    Confirmar Rechazo
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold block text-center">
                            ⚠️ Pendiente de carga por el subcontratista
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {subModalTab === 'personal' && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase text-slate-700">Trabajadores Externos Registrados:</h4>
                {(selectedSubDetail.personalList || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">No hay trabajadores registrados por este subcontratista aún.</div>
                ) : (
                  <div className="space-y-3">
                    {(selectedSubDetail.personalList || []).map((p, pIdx) => (
                      <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                        <div className="flex justify-between font-extrabold text-slate-900">
                          <span>{p.nombre} ({p.rut})</span>
                          <span className="bg-blue-100 text-blue-900 text-[10px] px-2 py-0.5 rounded uppercase">{p.cargo || 'Operario'}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                          {mandatoryWorkerDocs.map(doc => {
                            const file = p.docs && p.docs[doc.key];
                            const docStatus = file ? (file.status || 'Pendiente de Revisión') : 'No cargado';
                            const isRejecting = rejectingKey === `worker_${pIdx}_${doc.key}`;

                            return (
                              <div key={doc.key} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold uppercase text-slate-700">{doc.label}</span>
                                  {file && (
                                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                      docStatus === 'Aprobado' ? 'bg-emerald-50 text-emerald-700' :
                                      docStatus === 'Rechazado' ? 'bg-rose-50 text-rose-700' :
                                      'bg-amber-50 text-amber-700'
                                    }`}>
                                      {docStatus}
                                    </span>
                                  )}
                                </div>

                                {file ? (
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-emerald-800 bg-emerald-50 p-1.5 rounded-md">
                                      <span className="truncate">{file.fileName}</span>
                                      <button onClick={() => openFileViewer(file)} className="text-emerald-700 hover:text-emerald-900 p-0.5" title="Ver">
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {file.motivo_rechazo && (
                                      <div className="text-[9px] text-rose-800 bg-rose-50 p-1 rounded font-medium">
                                        <strong>Motivo:</strong> {file.motivo_rechazo}
                                      </div>
                                    )}

                                    <AccreditationAIReview file={file} empresa={user?.empresa || companyBranding?.empresa} obra={selectedSubDetail.obra_asociada} subcontratista={selectedSubDetail} categoria="personal" entidad={`${p.nombre} · ${p.rut}`} documentKey={doc.key} documentName={doc.label} canDecide={canReview} user={user} />

                                    <div className="flex gap-1 pt-0.5">
                                      <button
                                        onClick={() => handleUpdateDocStatus('personal', doc.key, 'Aprobado', pIdx)}
                                        className="flex-1 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[9.5px] font-bold"
                                      >
                                        ✓ Aprobar
                                      </button>
                                      <button
                                        onClick={() => setRejectingKey(`worker_${pIdx}_${doc.key}`)}
                                        className="flex-1 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-[9.5px] font-bold"
                                      >
                                        ✕ Rechazar
                                      </button>
                                    </div>

                                    {isRejecting && (
                                      <div className="bg-white p-2 rounded border border-rose-300 space-y-1 mt-1">
                                        <textarea
                                          rows="2"
                                          placeholder="Motivo de rechazo..."
                                          value={rejectReasonInput}
                                          onChange={(e) => setRejectReasonInput(e.target.value)}
                                          className="w-full text-[10px] p-1 border rounded"
                                        ></textarea>
                                        <div className="flex justify-end gap-1">
                                          <button onClick={() => setRejectingKey(null)} className="text-[9px] px-2 py-0.5 bg-slate-100 rounded">Cancelar</button>
                                          <button
                                            onClick={() => {
                                              if (!rejectReasonInput.trim()) return alert('Ingrese el motivo.');
                                              handleUpdateDocStatus('personal', doc.key, 'Rechazado', pIdx, rejectReasonInput.trim());
                                            }}
                                            className="text-[9px] px-2 py-0.5 bg-rose-600 text-white rounded font-bold"
                                          >
                                            Confirmar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-slate-400 italic block">No cargado</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {subModalTab === 'equipos' && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase text-slate-700">Maquinarias y Vehículos Externos Registrados:</h4>
                {(selectedSubDetail.equiposList || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">No hay equipos registrados por este subcontratista aún.</div>
                ) : (
                  <div className="space-y-3">
                    {(selectedSubDetail.equiposList || []).map((eq, eIdx) => (
                      <div key={eIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                        <div className="flex justify-between font-extrabold text-slate-900">
                          <span>{eq.tipo_equipo} (Patente: {eq.patente_codigo})</span>
                          <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded uppercase">{eq.marca_modelo || 'Equipo'}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                          {mandatoryEquipoDocs.map(doc => {
                            const file = eq.docs && eq.docs[doc.key];
                            const docStatus = file ? (file.status || 'Pendiente de Revisión') : 'No cargado';
                            const isRejecting = rejectingKey === `equipo_${eIdx}_${doc.key}`;

                            return (
                              <div key={doc.key} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold uppercase text-slate-700">{doc.label}</span>
                                  {file && (
                                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                      docStatus === 'Aprobado' ? 'bg-emerald-50 text-emerald-700' :
                                      docStatus === 'Rechazado' ? 'bg-rose-50 text-rose-700' :
                                      'bg-amber-50 text-amber-700'
                                    }`}>
                                      {docStatus}
                                    </span>
                                  )}
                                </div>

                                {file ? (
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-emerald-800 bg-emerald-50 p-1.5 rounded-md">
                                      <span className="truncate">{file.fileName}</span>
                                      <button onClick={() => openFileViewer(file)} className="text-emerald-700 hover:text-emerald-900 p-0.5" title="Ver">
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {file.motivo_rechazo && (
                                      <div className="text-[9px] text-rose-800 bg-rose-50 p-1 rounded font-medium">
                                        <strong>Motivo:</strong> {file.motivo_rechazo}
                                      </div>
                                    )}

                                    <AccreditationAIReview file={file} empresa={user?.empresa || companyBranding?.empresa} obra={selectedSubDetail.obra_asociada} subcontratista={selectedSubDetail} categoria="equipos" entidad={`${eq.tipo_equipo} · ${eq.patente_codigo}`} documentKey={doc.key} documentName={doc.label} canDecide={canReview} user={user} />

                                    <div className="flex gap-1 pt-0.5">
                                      <button
                                        onClick={() => handleUpdateDocStatus('equipos', doc.key, 'Aprobado', eIdx)}
                                        className="flex-1 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[9.5px] font-bold"
                                      >
                                        ✓ Aprobar
                                      </button>
                                      <button
                                        onClick={() => setRejectingKey(`equipo_${eIdx}_${doc.key}`)}
                                        className="flex-1 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-[9.5px] font-bold"
                                      >
                                        ✕ Rechazar
                                      </button>
                                    </div>

                                    {isRejecting && (
                                      <div className="bg-white p-2 rounded border border-rose-300 space-y-1 mt-1">
                                        <textarea
                                          rows="2"
                                          placeholder="Motivo de rechazo..."
                                          value={rejectReasonInput}
                                          onChange={(e) => setRejectReasonInput(e.target.value)}
                                          className="w-full text-[10px] p-1 border rounded"
                                        ></textarea>
                                        <div className="flex justify-end gap-1">
                                          <button onClick={() => setRejectingKey(null)} className="text-[9px] px-2 py-0.5 bg-slate-100 rounded">Cancelar</button>
                                          <button
                                            onClick={() => {
                                              if (!rejectReasonInput.trim()) return alert('Ingrese el motivo.');
                                              handleUpdateDocStatus('equipos', doc.key, 'Rechazado', eIdx, rejectReasonInput.trim());
                                            }}
                                            className="text-[9px] px-2 py-0.5 bg-rose-600 text-white rounded font-bold"
                                          >
                                            Confirmar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-slate-400 italic block">No cargado</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setSelectedSubDetail(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Cerrar Revisión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PROVEEDOR */}
      {showProvModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-600" />
                <span>Registrar Empresa Proveedora</span>
              </h3>
              <button onClick={() => setShowProvModal(false)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateProveedor} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Empresa Proveedora</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Hormigones y Materiales SpA"
                  value={provForm.empresa_nombre}
                  onChange={(e) => setProvForm({ ...provForm, empresa_nombre: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT Empresa</label>
                  <input
                    type="text"
                    placeholder="77.123.456-7"
                    value={provForm.rut_empresa}
                    onChange={(e) => setProvForm({ ...provForm, rut_empresa: e.target.value })}
                    onBlur={(e) => setProvForm({ ...provForm, rut_empresa: formatRut(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Obra Asociada</label>
                  <select
                    value={provForm.obra_asociada}
                    onChange={(e) => setProvForm({ ...provForm, obra_asociada: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold bg-white"
                  >
                    <option value="">-- Seleccionar --</option>
                    {obrasList.map(o => (
                      <option key={o.id} value={o.nombre}>{o.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo Electrónico de Contacto</label>
                <input
                  type="email"
                  placeholder="contacto@proveedor.cl"
                  value={provForm.correo_contacto}
                  onChange={(e) => setProvForm({ ...provForm, correo_contacto: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Clave de Acceso (Opcional)</label>
                <input
                  type="text"
                  placeholder="ej: PROV2026"
                  value={provForm.credencial_pass}
                  onChange={(e) => setProvForm({ ...provForm, credencial_pass: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProvModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 transition cursor-pointer shadow-xs"
                >
                  Generar Credenciales y Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE Y REVISIÓN PROVEEDOR */}
      {selectedProvDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[9.5px] font-extrabold uppercase text-amber-700 tracking-wider">Centro de Evaluación Proveedor</span>
                <h3 className="font-black text-slate-900 text-sm uppercase">{selectedProvDetail.empresa_nombre}</h3>
                <span className="text-[10.5px] text-slate-500">RUT: {formatRut(selectedProvDetail.rut_empresa) || 'N/A'} | Obra: {selectedProvDetail.obra_asociada}</span>
              </div>
              <button onClick={() => setSelectedProvDetail(null)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => { setSubModalTab('empresa'); setRejectingKey(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${subModalTab === 'empresa' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Docs. Proveedor ({Object.keys(selectedProvDetail.companyDocs || {}).length})
              </button>
              <button
                onClick={() => { setSubModalTab('personal'); setRejectingKey(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${subModalTab === 'personal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Choferes / Personal ({(selectedProvDetail.personalList || []).length})
              </button>
              <button
                onClick={() => { setSubModalTab('equipos'); setRejectingKey(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${subModalTab === 'equipos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Vehículos / Camiones ({(selectedProvDetail.equiposList || []).length})
              </button>
            </div>

            {subModalTab === 'empresa' && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase text-slate-700">Archivos Legales del Proveedor:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mandatorySupplierDocs.map(item => {
                    const uploaded = selectedProvDetail.companyDocs && selectedProvDetail.companyDocs[item.key];
                    const docStatus = uploaded ? (uploaded.status || 'Pendiente de Revisión') : 'No cargado';
                    const isRejecting = rejectingKey === `prov_empresa_${item.key}`;

                    return (
                      <div key={item.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                        <div className="flex justify-between items-start">
                          <div className="font-extrabold text-slate-800 uppercase">{item.label}</div>
                          {uploaded && (
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                              docStatus === 'Aprobado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              docStatus === 'Rechazado' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {docStatus}
                            </span>
                          )}
                        </div>

                        {uploaded ? (
                          <div className="space-y-2">
                            <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex justify-between items-center text-xs">
                              <span className="truncate text-[11px] font-bold text-slate-700">{uploaded.fileName}</span>
                              <button
                                onClick={() => openFileViewer(uploaded)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver Archivo</span>
                              </button>
                            </div>

                            {uploaded.motivo_rechazo && (
                              <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl text-[10px] text-rose-800 flex items-start gap-1.5 font-medium">
                                <MessageSquare className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                <div><strong>Motivo Rechazo:</strong> {uploaded.motivo_rechazo}</div>
                              </div>
                            )}

                            <div className="flex gap-1.5 pt-1">
                              <button
                                onClick={() => handleUpdateProvDocStatus('empresa', item.key, 'Aprobado')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${docStatus === 'Aprobado' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aprobar</span>
                              </button>
                              <button
                                onClick={() => setRejectingKey(`prov_empresa_${item.key}`)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${docStatus === 'Rechazado' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'}`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Rechazar</span>
                              </button>
                            </div>

                            {isRejecting && (
                              <div className="bg-white p-3 rounded-xl border border-rose-300 space-y-2 animate-in fade-in">
                                <label className="block text-[9.5px] font-bold text-rose-900 uppercase">Indique el Motivo de Rechazo:</label>
                                <textarea
                                  rows="2"
                                  placeholder="Ej: Documento no corresponde..."
                                  value={rejectReasonInput}
                                  onChange={(e) => setRejectReasonInput(e.target.value)}
                                  className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-800"
                                ></textarea>
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => setRejectingKey(null)}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!rejectReasonInput.trim()) return alert('Ingrese el motivo de rechazo.');
                                      handleUpdateProvDocStatus('empresa', item.key, 'Rechazado', null, rejectReasonInput.trim());
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                                  >
                                    Confirmar Rechazo
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold block text-center">
                            ⚠️ Pendiente de carga por el proveedor
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setSelectedProvDetail(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Cerrar Revisión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
