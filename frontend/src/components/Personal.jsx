import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ModuleHeader from './ModuleHeader';
import { formatRut } from '../utils/rutUtils';
import useUserPermissions from '../utils/useUserPermissions';
import { can } from '../utils/permissionsCatalog';
import { 
  Users, Search, Plus, Edit, Trash2, Loader2, UserPlus,
  FileText, DollarSign, Upload, FileUp, Sparkles, RefreshCw, Calculator, BookOpen, Download, Printer, BarChart3, CalendarRange
} from 'lucide-react';
import { HrStatistics } from './OperationalStatistics';
import WorkforceProjection from './WorkforceProjection';
import PayrollAutomation from './PayrollAutomation';
import WorkerBulkImport from './WorkerBulkImport';
import WorkerDocumentsPanel from './WorkerDocumentsPanel';

const afpCommissionRates = {
  'Habitat': { fondo: 10.00, comision: 1.27, total: 11.27 },
  'Capital': { fondo: 10.00, comision: 1.44, total: 11.44 },
  'Cuprum': { fondo: 10.00, comision: 1.44, total: 11.44 },
  'Modelo': { fondo: 10.00, comision: 0.58, total: 10.58 },
  'PlanVital': { fondo: 10.00, comision: 1.16, total: 11.16 },
  'ProVida': { fondo: 10.00, comision: 1.45, total: 11.45 },
  'Uno': { fondo: 10.00, comision: 0.49, total: 10.49 },
  'Sin Previsión': { fondo: 0.00, comision: 0.00, total: 0.00 }
};

const getAFPDetails = (afpName) => {
  if (!afpName) return afpCommissionRates['Habitat'];
  const clean = afpName.replace('AFP ', '').trim();
  return afpCommissionRates[clean] || afpCommissionRates['Habitat'];
};

const INDICADORES_OFICIALES_CHILE = {
  version: '2026-08-13',
  uf: 40850.06,
  utm: 71649,
  topeAfpUf: 90,
  topeCesantiaUf: 135.2,
  apvMaxUf: 50,
  salarioMinimo: 553553,
  salarioMinimoMenorMayor: 412938,
  ingresoMinimoNoRemuneracional: 356815,
  vigenciaSalarioMinimo: '01-05-2026',
  fuentes: 'SII · Dirección del Trabajo · Superintendencia de Pensiones'
};

function Personal({ user, onBack }) {
  const { permissions, loading: permissionsLoading } = useUserPermissions(user);
  const canView = can(user, permissions, 'rrhh.personal.ver');
  const canCreate = can(user, permissions, 'rrhh.personal.crear');
  const canEdit = can(user, permissions, 'rrhh.personal.editar');
  const canDelete = can(user, permissions, 'rrhh.personal.eliminar');
  const canImport = can(user, permissions, 'rrhh.personal.importar');
  const canViewStatistics = can(user, permissions, 'rrhh.estadisticas.ver');
  const canDownloadStatistics = can(user, permissions, 'rrhh.estadisticas.descargar');
  const canViewProjection = can(user, permissions, 'rrhh.proyeccion.ver');
  const canCreateProjection = can(user, permissions, 'rrhh.proyeccion.crear');
  const canEditProjection = can(user, permissions, 'rrhh.proyeccion.editar');
  const canDeleteProjection = can(user, permissions, 'rrhh.proyeccion.eliminar');
  // Submódulo activo: null (Menú de Rectángulos), 'personal_empresa', 'asignar_obra', 'remuneraciones'
  const [activeSubmodule, setActiveSubmodule] = useState(null);

  const [personal, setPersonal] = useState([]);
  const [obras, setObras] = useState([]);
  const [centrosGestion, setCentrosGestion] = useState([]);
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
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [rrhhAIEnabled, setRrhhAIEnabled] = useState(false);

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
    centro_gestion_id: '',
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

  // Indicadores previsionales oficiales vigentes en Chile.
  const [indicadores, setIndicadores] = useState(() => {
    const saved = localStorage.getItem('indicadores_previsionales_chile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migra los valores legales antiguos que hayan quedado guardados en el navegador.
        if (parsed.version !== INDICADORES_OFICIALES_CHILE.version) {
          const migrated = {
            ...parsed,
            ...INDICADORES_OFICIALES_CHILE,
            ultimaActualizacion: '13-08-2026 (fuentes oficiales)'
          };
          localStorage.setItem('indicadores_previsionales_chile', JSON.stringify(migrated));
          return migrated;
        }
        return { ...INDICADORES_OFICIALES_CHILE, ...parsed };
      } catch {}
    }
    return {
      ...INDICADORES_OFICIALES_CHILE,
      ultimaActualizacion: '13-08-2026 (fuentes oficiales)'
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
  const [templateForm, setTemplateForm] = useState({ titulo: '', tipo: 'Contrato Indefinido', contenido: '', archivo_nombre: '', variables: [], advertencias: [] });
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateMessage, setTemplateMessage] = useState('');

  const [selectedWorkerForContract, setSelectedWorkerForContract] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('1');
  const [generatedContractText, setGeneratedContractText] = useState('');

  // Estado para emisión de Liquidación de Sueldo PDF
  const [showLiquidacionPDFModal, setShowLiquidacionPDFModal] = useState(false);
  const [selectedWorkerLiquidacion, setSelectedWorkerLiquidacion] = useState(null);

  const initializePersonal = React.useEffectEvent(() => {
    fetchData();
    fetchContractTemplates();
    fetchAIConfiguration();
  });
  useEffect(() => { initializePersonal(); }, []);

  const fetchAIConfiguration = async () => {
    const { data } = await supabase.from('ia_config_empresas').select('habilitada,funciones').eq('empresa', user?.empresa).maybeSingle();
    setRrhhAIEnabled(Boolean(data?.habilitada && data?.funciones?.rrhh));
  };

  const fetchContractTemplates = async () => {
    const { data, error } = await supabase.from('rrhh_formatos_documentos').select('*').eq('empresa', user?.empresa || 'Obraxis').order('titulo');
    if (!error && data?.length) {
      setPlantillasContrato(data);
      setSelectedTemplateId(String(data[0].id));
    } else if (error && !String(error.message).includes('rrhh_formatos_documentos')) {
      console.warn('No fue posible cargar formatos laborales:', error.message);
    }
  };

  const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const [assignmentReport, setAssignmentReport] = useState({
    desde: `${new Date().getFullYear()}-01-01`,
    hasta: new Date().toISOString().substring(0, 10),
    trabajadorId: ''
  });
  const [downloadingAssignments, setDownloadingAssignments] = useState(false);

  const analyzeContractFile = async file => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(extension)) {
      setTemplateMessage('Usa un archivo PDF, DOCX o TXT. Los archivos DOC antiguos deben guardarse primero como DOCX.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { setTemplateMessage('El archivo supera el máximo de 10 MB.'); return; }
    setTemplateBusy(true);
    setTemplateMessage('La IA está leyendo el documento y detectando las variables reutilizables…');
    try {
      let body;
      if (extension === 'docx') {
        const { loadWordTextEngine } = await import('../services/documentEngines');
        const mammoth = await loadWordTextEngine();
        const extracted = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        if (!extracted.value.trim()) throw new Error('El documento Word no contiene texto legible.');
        body = { text: extracted.value, file_name: file.name, mime_type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', empresa: user?.empresa };
      } else if (extension === 'txt') {
        body = { text: await file.text(), file_name: file.name, mime_type: 'text/plain', empresa: user?.empresa };
      } else {
        body = { file_base64: await fileToBase64(file), file_name: file.name, mime_type: file.type || 'application/pdf', empresa: user?.empresa };
      }
      const { data, error } = await supabase.functions.invoke('analizar-formato-laboral-ia', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const analyzed = data?.data;
      setTemplateForm(current => ({ ...current, titulo: current.titulo || analyzed.titulo || file.name.replace(/\.[^.]+$/, ''), tipo: analyzed.tipo || current.tipo, contenido: analyzed.contenido || '', archivo_nombre: file.name, variables: analyzed.variables || [], advertencias: analyzed.advertencias || [] }));
      setTemplateMessage(`Documento procesado. Se detectaron ${(analyzed.variables || []).length} variables. Revisa el texto antes de guardarlo.`);
    } catch (error) {
      setTemplateMessage(`No fue posible analizar el documento: ${error.message}`);
    } finally { setTemplateBusy(false); }
  };

  const saveContractTemplate = async event => {
    event.preventDefault();
    if (!templateForm.titulo.trim() || !templateForm.contenido.trim()) return;
    setTemplateBusy(true);
    const payload = { empresa: user?.empresa || 'Obraxis', titulo: templateForm.titulo.trim(), tipo: templateForm.tipo, contenido: templateForm.contenido, archivo_nombre: templateForm.archivo_nombre || null, variables: templateForm.variables || [], advertencias: templateForm.advertencias || [], actualizado_por: user?.nombre || user?.email || user?.usuario || 'Usuario' };
    const response = editingTemplate?.created_at
      ? await supabase.from('rrhh_formatos_documentos').update(payload).eq('id', editingTemplate.id).select().single()
      : await supabase.from('rrhh_formatos_documentos').insert(payload).select().single();
    setTemplateBusy(false);
    if (response.error) { setTemplateMessage(`No fue posible guardar: ${response.error.message}`); return; }
    await fetchContractTemplates();
    setShowTemplateModal(false);
  };

  const deleteContractTemplate = async template => {
    if (!window.confirm(`¿Eliminar el formato “${template.titulo}”?`)) return;
    if (!template.created_at) { setPlantillasContrato(current => current.filter(item => item.id !== template.id)); return; }
    const { error } = await supabase.from('rrhh_formatos_documentos').delete().eq('id', template.id);
    if (error) { alert(`No fue posible eliminar el formato: ${error.message}`); return; }
    await fetchContractTemplates();
  };

  const renderContractTemplate = (template, worker) => {
    if (!template || !worker) return '';
    const values = {
      nombre_trabajador: worker.nombre || '', rut: worker.rut || '', cargo: worker.cargo || '',
      sueldo_base: Number(worker.sueldo_base || 0).toLocaleString('es-CL'), obra_nombre: worker.obra_nombre || 'Sin obra asignada',
      fecha_inicio: worker.fecha_inicio_contrato || worker.inicio || new Date().toISOString().slice(0, 10),
      fecha_termino: worker.fecha_vencimiento_contrato || worker.termino || '', email: worker.email || '', fono: worker.fono || '',
      centro_trabajo: worker.centro_trabajo || '', area: worker.area || '', empresa: user?.empresa || 'Obraxis',
      ciudad: 'Santiago', fecha_documento: new Date().toLocaleDateString('es-CL')
    };
    return String(template.contenido || '').replace(/{{\s*([a-z_]+)\s*}}/gi, (match, key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match);
  };

  const printPayrollSlip = worker => {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
    const money = value => `$${Math.round(Number(value || 0)).toLocaleString('es-CL')}`;
    const payroll = worker.payroll || {};
    const base = payroll.base ?? (parseFloat(worker.sueldo_base) || 0);
    const gratuityCap = Math.round((4.75 * (indicadores.salarioMinimo || INDICADORES_OFICIALES_CHILE.salarioMinimo)) / 12);
    const hasGratuity = worker.gratificacion !== 'Sin Gratificación';
    const gratuity = payroll.gratification ?? (hasGratuity ? Math.min(Math.round(base * .25), gratuityCap) : 0);
    const taxable = payroll.taxableGross ?? (base + gratuity);
    const collation = payroll.collation ?? (parseFloat(worker.colacion) || 0);
    const transport = payroll.transport ?? (parseFloat(worker.movilizacion) || 0);
    const assets = payroll.totalAssets ?? (taxable + collation + transport);
    const afp = getAFPDetails(worker.afp);
    const afpAmount = payroll.afp ?? Math.round(taxable * afp.total / 100);
    const health = payroll.health ?? Math.round(taxable * .07);
    const indefinite = (worker.tipo_contrato || 'Indefinido') === 'Indefinido';
    const afc = payroll.afc ?? (indefinite ? Math.round(taxable * .006) : 0);
    const tax = payroll.tax ?? 0;
    const otherDiscounts = payroll.otherDiscounts ?? 0;
    const discounts = payroll.legalDiscounts ? payroll.legalDiscounts + otherDiscounts : afpAmount + health + afc + tax + otherDiscounts;
    const net = payroll.net ?? (assets - discounts);
    const periodValue = worker.periodo || new Date().toISOString().slice(0, 7);
    const [year, month] = periodValue.split('-');
    const period = month ? new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, 1)) : periodValue;
    const rows = (items, totalLabel, total) => `${items.filter(item => item[1] !== 0 || item[2]).map(item => `<tr><td>${escape(item[0])}</td><td class="amount">${item[3] ? '-' : ''}${money(item[1])}</td></tr>`).join('')}<tr class="total"><td>${totalLabel}</td><td class="amount">${totalLabel.includes('DESCUENTOS') ? '-' : ''}${money(total)}</td></tr>`;
    const employerRut = user?.empresa_rut || user?.rut_empresa || 'No informado';
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) { alert('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para Obraxis.'); return; }
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Liquidación ${escape(worker.nombre)} · ${escape(period)}</title><style>
      @page{size:letter portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;line-height:1.35}.sheet{width:100%;max-width:190mm;margin:auto}.top{display:grid;grid-template-columns:1.3fr .7fr;border:1.4px solid #172033}.brand{padding:14px}.brand h1{margin:0;font-size:17px;text-transform:uppercase;letter-spacing:.5px}.brand p{margin:4px 0 0;color:#536176}.control{border-left:1px solid #172033;padding:12px}.control div{display:flex;justify-content:space-between;gap:8px;margin:3px 0}.title{text-align:center;font-weight:800;font-size:15px;letter-spacing:1px;margin:18px 0 10px;text-transform:uppercase}.worker{width:100%;border-collapse:collapse;border:1px solid #9aa5b5;margin-bottom:14px}.worker th{width:18%;background:#eef1f5;text-align:left;color:#39465b}.worker th,.worker td{border:1px solid #c8ced8;padding:6px 8px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.block{border:1px solid #9aa5b5}.block h2{margin:0;padding:7px 9px;background:#172033;color:white;font-size:10px;letter-spacing:.4px;text-transform:uppercase}.block table{width:100%;border-collapse:collapse}.block td{padding:6px 9px;border-bottom:1px solid #e2e6eb}.amount{text-align:right;font-family:'Courier New',monospace;font-weight:700;white-space:nowrap}.total td{border-top:1.5px solid #172033;border-bottom:0;background:#eef1f5;font-weight:800}.bases{display:flex;gap:18px;margin:12px 0;padding:7px 9px;border:1px solid #c8ced8;background:#f7f8fa}.bases b{margin-right:4px}.net{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:12px 14px;border:2px solid #172033}.net span{font-size:12px;font-weight:800;text-transform:uppercase}.net strong{font-family:'Courier New',monospace;font-size:20px}.legal{margin-top:10px;color:#536176;font-size:9px;text-align:justify}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:65px;margin-top:60px}.signature{border-top:1px solid #172033;text-align:center;padding-top:6px;font-weight:700}.signature small{display:block;color:#68758a;font-weight:400;margin-top:2px}.footer{display:flex;justify-content:space-between;border-top:1px solid #c8ced8;margin-top:22px;padding-top:6px;color:#68758a;font-size:8.5px}.actions{text-align:center;margin:18px}.actions button{background:#172033;color:white;border:0;border-radius:7px;padding:11px 20px;font-weight:700;cursor:pointer}@media print{.actions{display:none}.sheet{max-width:none}}
    </style></head><body><div class="sheet"><section class="top"><div class="brand"><h1>${escape(user?.empresa || 'Empresa')}</h1><p>RUT empresa: ${escape(employerRut)}</p></div><div class="control"><div><b>Documento</b><span>Liquidación de remuneraciones</span></div><div><b>Período</b><span>${escape(period)}</span></div><div><b>Folio</b><span>LIQ-${escape(periodValue)}-${escape(worker.id || worker.rut || '')}</span></div></div></section><div class="title">Liquidación de sueldo</div>
      <table class="worker"><tr><th>Trabajador</th><td>${escape(worker.nombre)}</td><th>RUT</th><td>${escape(worker.rut || 'No informado')}</td></tr><tr><th>Cargo</th><td>${escape(worker.cargo || '')}</td><th>Centro de gestión</th><td>${escape(worker.payroll?.centroGestion || worker.centro_gestion_nombre || worker.centro_trabajo || worker.obra_nombre || 'Sin asignar')}</td></tr><tr><th>Contrato</th><td>${escape(worker.tipo_contrato || 'Indefinido')}</td><th>Fecha ingreso</th><td>${escape(worker.fecha_inicio_contrato || worker.inicio || 'No informada')}</td></tr><tr><th>AFP</th><td>${escape(worker.afp || 'No informada')} (${afp.total}%)</td><th>Salud</th><td>${escape(worker.prevision_salud || 'No informada')} (7%)</td></tr></table>
      <div class="columns"><section class="block"><h2>Haberes</h2><table>${rows([['Sueldo base',base,true],['Gratificación legal',gratuity,hasGratuity],['Colación (no imponible)',collation],['Movilización (no imponible)',transport]],'TOTAL HABERES',assets)}</table></section><section class="block"><h2>Descuentos</h2><table>${rows([[`AFP ${worker.afp || ''} (${afp.total}%)`,afpAmount,true,true],[`Salud ${worker.prevision_salud || ''} (7%)`,health,true,true],[`Seguro de cesantía (${indefinite ? '0,6%' : '0%'})`,afc,true,true],['Impuesto único',tax,false,true],['Otros descuentos',otherDiscounts,false,true]],'TOTAL DESCUENTOS',discounts)}</table></section></div>
      <div class="bases"><span><b>Total imponible:</b>${money(taxable)}</span><span><b>Total no imponible:</b>${money(collation + transport)}</span></div><div class="net"><span>Líquido a pagar</span><strong>${money(net)}</strong></div><p class="legal">Declaro recibir conforme la presente liquidación de remuneraciones, sin perjuicio de los derechos que legalmente me correspondan. Este documento fue generado por Obraxis con los antecedentes registrados por la empresa.</p><div class="signatures"><div class="signature">Firma del trabajador<small>${escape(worker.nombre)} · ${escape(worker.rut || '')}</small></div><div class="signature">Firma del empleador<small>${escape(user?.empresa || 'Empresa')}</small></div></div><footer class="footer"><span>Generado mediante sistema Obraxis</span><span>${new Date().toLocaleString('es-CL')}</span></footer></div><div class="actions"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Supabase es la fuente única de la ficha del trabajador.
      const { data: dataPers, error: errPers } = await supabase
        .from('maestro_personal')
        .select('*')
        .eq('empresa', user?.empresa || 'Obraxis')
        .order('nombre', { ascending: true });
      if (errPers) throw errPers;

      setPersonal(dataPers || []);

      // 2. Cargar obras
      const [{ data: dataObras, error: errObras }, { data: dataCentros, error: errCentros }] = await Promise.all([
        supabase.from('obras').select('id,nombre,centro_gestion_id').eq('empresa', user?.empresa || 'Obraxis').order('nombre', { ascending: true }),
        supabase.from('facturacion_centros_gestion').select('id,codigo,nombre,tipo,activo').eq('empresa', user?.empresa || 'Obraxis').eq('activo', true).order('codigo', { ascending: true })
      ]);
      if (errObras) throw errObras;
      if (errCentros) throw errCentros;
      setObras(dataObras || []);
      setCentrosGestion(dataCentros || []);
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
      centro_gestion_id: obras[0]?.centro_gestion_id || centrosGestion[0]?.id || '',
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
      centro_gestion_id: worker.centro_gestion_id || '',
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
    if (!canDelete) { setErrorMsg('Tu perfil no está autorizado para eliminar trabajadores.'); return; }
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

  const recordAssignmentPeriod = async ({ workerId, nombre, rut, cargo, obraNombre, centroGestionId, fechaInicio }) => {
    const assignedCenter = centrosGestion.find(center => String(center.id) === String(centroGestionId));
    const { data: activeHistory, error: historyReadError } = await supabase
      .from('rrhh_asignaciones_personal')
      .select('id,fecha_inicio,obra_nombre,centro_gestion_id')
      .eq('empresa', user?.empresa || 'Obraxis')
      .eq('trabajador_id', workerId)
      .is('fecha_termino', null)
      .maybeSingle();
    if (historyReadError) throw historyReadError;

    const sameDestination = activeHistory
      && (activeHistory.obra_nombre || '') === (obraNombre || '')
      && String(activeHistory.centro_gestion_id || '') === String(centroGestionId || '');

    if (activeHistory && sameDestination) {
      const { error } = await supabase.from('rrhh_asignaciones_personal')
        .update({ fecha_inicio: fechaInicio, trabajador_nombre: nombre, trabajador_rut: rut || null, cargo: cargo || null, updated_at: new Date().toISOString() })
        .eq('id', activeHistory.id);
      if (error) throw error;
      return;
    }

    if (activeHistory) {
      const previousStart = new Date(`${activeHistory.fecha_inicio}T12:00:00`);
      const nextStart = new Date(`${fechaInicio}T12:00:00`);
      if (nextStart <= previousStart) throw new Error(`La nueva asignación debe comenzar después del ${activeHistory.fecha_inicio}, fecha de inicio del destino vigente.`);
      const previousEnd = new Date(nextStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      const { error } = await supabase.from('rrhh_asignaciones_personal')
        .update({ fecha_termino: previousEnd.toISOString().substring(0, 10), updated_at: new Date().toISOString() })
        .eq('id', activeHistory.id);
      if (error) throw error;
    }

    const { error: insertError } = await supabase.from('rrhh_asignaciones_personal').insert({
      empresa: user?.empresa || 'Obraxis', trabajador_id: workerId, trabajador_nombre: nombre,
      trabajador_rut: rut || null, cargo: cargo || null, obra_nombre: obraNombre || null,
      centro_gestion_id: centroGestionId || null,
      destino_nombre: assignedCenter ? `${assignedCenter.codigo} · ${assignedCenter.nombre}` : (obraNombre || 'Sin asignar'),
      fecha_inicio: fechaInicio, creado_por: user?.nombre || user?.usuario || user?.correo || 'Usuario Obraxis'
    });
    if (insertError) throw insertError;
  };

  const handleSaveObraAssignment = async () => {
    if (!canEdit) { setErrorMsg('Tu perfil no está autorizado para asignar personal a obras.'); return; }
    if (!assignModalData.workerId) return;
    try {
      const assignedWork = obras.find(obra => obra.nombre === assignModalData.obraNombre);
      const payload = {
        obra_nombre: assignModalData.obraNombre,
        centro_gestion_id: assignedWork?.centro_gestion_id || null,
        fecha_asig: assignModalData.fechaAsig
      };

      const worker = personal.find(item => item.id === assignModalData.workerId);
      await recordAssignmentPeriod({
        workerId: assignModalData.workerId, nombre: worker?.nombre || assignModalData.workerNombre,
        rut: worker?.rut, cargo: worker?.cargo, obraNombre: payload.obra_nombre,
        centroGestionId: payload.centro_gestion_id, fechaInicio: payload.fecha_asig
      });

      const { error } = await supabase
        .from('maestro_personal')
        .update(payload)
        .eq('id', assignModalData.workerId);
      if (error) throw error;

      setPersonal(prev => prev.map(p => p.id === assignModalData.workerId ? { ...p, ...payload } : p));
      setShowAssignObraModal(false);
    } catch (err) {
      alert('Error asignando trabajador a obra: ' + err.message);
    }
  };

  const handleDownloadAssignmentHistory = async () => {
    if (!assignmentReport.desde || !assignmentReport.hasta) return alert('Selecciona el inicio y término del período.');
    if (assignmentReport.desde > assignmentReport.hasta) return alert('La fecha de inicio no puede ser posterior a la fecha de término.');
    setDownloadingAssignments(true);
    try {
      let query = supabase
        .from('rrhh_asignaciones_personal')
        .select('trabajador_id,trabajador_nombre,trabajador_rut,cargo,obra_nombre,destino_nombre,fecha_inicio,fecha_termino,centro_gestion_id')
        .eq('empresa', user?.empresa || 'Obraxis')
        .lte('fecha_inicio', assignmentReport.hasta)
        .or(`fecha_termino.is.null,fecha_termino.gte.${assignmentReport.desde}`)
        .order('trabajador_nombre')
        .order('fecha_inicio');
      if (assignmentReport.trabajadorId) query = query.eq('trabajador_id', Number(assignmentReport.trabajadorId));
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) return alert('No existen asignaciones dentro del período seleccionado.');

      const reportStart = new Date(`${assignmentReport.desde}T12:00:00`);
      const reportEnd = new Date(`${assignmentReport.hasta}T12:00:00`);
      const daysInclusive = (start, end) => Math.floor((end - start) / 86400000) + 1;
      const rows = data.map(item => {
        const originalStart = new Date(`${item.fecha_inicio}T12:00:00`);
        const originalEnd = item.fecha_termino ? new Date(`${item.fecha_termino}T12:00:00`) : reportEnd;
        const effectiveStart = originalStart > reportStart ? originalStart : reportStart;
        const effectiveEnd = originalEnd < reportEnd ? originalEnd : reportEnd;
        const center = centrosGestion.find(entry => String(entry.id) === String(item.centro_gestion_id));
        return {
          'Trabajador': item.trabajador_nombre,
          'RUT': item.trabajador_rut || '',
          'Cargo': item.cargo || '',
          'Centro de gestión': center ? `${center.codigo} · ${center.nombre}` : item.destino_nombre,
          'Obra': item.obra_nombre || 'Sin obra / administración',
          'Inicio asignación': item.fecha_inicio,
          'Término asignación': item.fecha_termino || 'Vigente',
          'Inicio dentro del período': effectiveStart.toISOString().substring(0, 10),
          'Término dentro del período': effectiveEnd.toISOString().substring(0, 10),
          'Días en el período': daysInclusive(effectiveStart, effectiveEnd)
        };
      });

      const { loadSpreadsheetEngine } = await import('../services/documentEngines');
      const XLSX = await loadSpreadsheetEngine();
      const workbook = XLSX.utils.book_new();
      const summary = XLSX.utils.aoa_to_sheet([
        ['HISTORIAL DE ASIGNACIONES DE PERSONAL'],
        ['Empresa', user?.empresa || 'Obraxis'],
        ['Período', `${assignmentReport.desde} al ${assignmentReport.hasta}`],
        ['Trabajadores incluidos', new Set(rows.map(item => item.RUT || item.Trabajador)).size],
        ['Períodos de asignación', rows.length],
        ['Generado', new Date().toLocaleString('es-CL')]
      ]);
      summary['!cols'] = [{ wch: 28 }, { wch: 42 }];
      const detail = XLSX.utils.json_to_sheet(rows);
      detail['!cols'] = [
        { wch: 32 }, { wch: 16 }, { wch: 25 }, { wch: 34 }, { wch: 34 },
        { wch: 18 }, { wch: 20 }, { wch: 23 }, { wch: 24 }, { wch: 18 }
      ];
      detail['!autofilter'] = { ref: detail['!ref'] };
      XLSX.utils.book_append_sheet(workbook, summary, 'Resumen');
      XLSX.utils.book_append_sheet(workbook, detail, 'Asignaciones');
      const safeCompany = String(user?.empresa || 'Obraxis').replace(/[^a-z0-9]+/gi, '_');
      XLSX.writeFile(workbook, `Historial_Asignaciones_${safeCompany}_${assignmentReport.desde}_${assignmentReport.hasta}.xlsx`);
    } catch (err) {
      alert(`No fue posible generar el historial: ${err.message}`);
    } finally {
      setDownloadingAssignments(false);
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
    if (editingWorker ? !canEdit : !canCreate) { setErrorMsg('Tu perfil no está autorizado para guardar trabajadores.'); return; }
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
      centro_gestion_id: formData.centro_gestion_id ? Number(formData.centro_gestion_id) : null,
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

    try {
      let savedResult = null;
      if (editingWorker) {
        const { data: uData, error: uErr } = await supabase.from('maestro_personal').update(fullDataToSave).eq('id', editingWorker.id).select();
        if (uErr) throw uErr;
        savedResult = uData ? uData[0] : { id: editingWorker.id, ...fullDataToSave };
        setSuccessMsg('Ficha de trabajador actualizada correctamente.');
      } else {
        const { data: iData, error: iErr } = await supabase.from('maestro_personal').insert([fullDataToSave]).select();
        if (iErr) throw iErr;
        savedResult = iData ? iData[0] : { ...fullDataToSave };
        setSuccessMsg('Trabajador registrado en la Ficha Empresa con éxito.');
      }

      await recordAssignmentPeriod({
        workerId: savedResult.id,
        nombre: fullDataToSave.nombre,
        rut: fullDataToSave.rut,
        cargo: fullDataToSave.cargo,
        obraNombre: fullDataToSave.obra_nombre,
        centroGestionId: fullDataToSave.centro_gestion_id,
        fechaInicio: fullDataToSave.fecha_asig
      });

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
      let ufVal = INDICADORES_OFICIALES_CHILE.uf;
      let utmVal = INDICADORES_OFICIALES_CHILE.utm;

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
        ...INDICADORES_OFICIALES_CHILE,
        uf: ufVal,
        utm: utmVal,
        ultimaActualizacion: new Date().toLocaleDateString('es-CL') + ' (fuentes oficiales)'
      };

      setIndicadores(updated);
      localStorage.setItem('indicadores_previsionales_chile', JSON.stringify(updated));
      alert(`¡Indicadores previsionales actualizados!\n\n• UF: $${ufVal.toLocaleString('es-CL')}\n• UTM (agosto): $${utmVal.toLocaleString('es-CL')}\n• Ingreso mínimo general: $${INDICADORES_OFICIALES_CHILE.salarioMinimo.toLocaleString('es-CL')}\n• Tope imponible AFP: ${INDICADORES_OFICIALES_CHILE.topeAfpUf.toLocaleString('es-CL')} UF\n• Tope seguro de cesantía: ${INDICADORES_OFICIALES_CHILE.topeCesantiaUf.toLocaleString('es-CL')} UF`);
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

  if (permissionsLoading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Cargando permisos…</div>;
  if (!canView) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm font-bold text-amber-900">Tu perfil no tiene permiso para ver Recursos Humanos.</div>;
  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <ModuleHeader title="Recursos Humanos (RRHH)" subtitle="Gestión de personal, asignaciones a obra y planillas de remuneraciones." Icon={Users} onBack={activeSubmodule !== null ? () => setActiveSubmodule(null) : onBack} actions={activeSubmodule === 'personal_empresa' && (
          <div className="flex flex-wrap gap-2">
            {canImport && <button onClick={() => setShowBulkImport(true)} className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-xs font-bold text-blue-950 transition hover:bg-blue-50"><Upload className="h-4 w-4"/><span>Importar Excel</span></button>}
            {canCreate && <button onClick={handleOpenAddModal} className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"><Plus className="w-4 h-4"/><span>Crear Ficha Trabajador</span></button>}
          </div>
        )} />

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

            {canViewStatistics && <button
              onClick={() => setActiveSubmodule('estadisticas')}
              className="p-6 bg-white border border-slate-200 hover:border-cyan-700 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-4"
            >
              <div className="flex justify-between items-start"><div className="p-3.5 bg-cyan-50 text-cyan-900 rounded-2xl group-hover:bg-cyan-900 group-hover:text-white transition"><BarChart3 className="w-7 h-7" /></div><span className="text-[10px] font-bold uppercase tracking-wider text-cyan-900 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-200">Gestión</span></div>
              <div><h4 className="font-extrabold text-slate-800 text-sm group-hover:text-cyan-950">Estadísticas de RR.HH.</h4><p className="text-xs text-slate-500 mt-1 leading-relaxed">Dotación, asignaciones, vencimientos, estructura contractual y costo mensual estimado por obra.</p></div>
            </button>}

            {canViewProjection && <button
              onClick={() => setActiveSubmodule('proyeccion')}
              className="p-6 bg-white border border-slate-200 hover:border-indigo-700 rounded-2xl shadow-xs hover:shadow-md transition text-left cursor-pointer group flex flex-col justify-between space-y-4"
            >
              <div className="flex justify-between items-start"><div className="p-3.5 bg-indigo-50 text-indigo-900 rounded-2xl group-hover:bg-indigo-900 group-hover:text-white transition"><CalendarRange className="w-7 h-7" /></div><span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">Planificación</span></div>
              <div><h4 className="font-extrabold text-slate-800 text-sm group-hover:text-indigo-950">Proyección de personal</h4><p className="text-xs text-slate-500 mt-1 leading-relaxed">Planifica dotación futura por obra y cargo, identifica brechas y estima su costo mensual.</p></div>
            </button>}

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
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-900" />
                <span>Asignar Personal a Obras Activas</span>
              </h3>
              <p className="text-[11px] text-slate-500">Selecciona trabajadores del Máster de Empresa y asigna su ficha directamente a la obra o centro de gestión correspondiente.</p>
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Período desde
                <input type="date" value={assignmentReport.desde} onChange={e => setAssignmentReport({ ...assignmentReport, desde: e.target.value })} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Período hasta
                <input type="date" value={assignmentReport.hasta} onChange={e => setAssignmentReport({ ...assignmentReport, hasta: e.target.value })} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-800" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Trabajador
                <select value={assignmentReport.trabajadorId} onChange={e => setAssignmentReport({ ...assignmentReport, trabajadorId: e.target.value })} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800">
                  <option value="">Todos los trabajadores</option>
                  {personal.slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')).map(item => <option key={item.id} value={item.id}>{item.nombre} · {item.rut || 'Sin RUT'}</option>)}
                </select>
              </label>
              <button onClick={handleDownloadAssignmentHistory} disabled={!canDownloadStatistics || downloadingAssignments} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" title={!canDownloadStatistics ? 'Tu perfil no puede descargar informes de RR.HH.' : 'Descargar historial en Excel'}>
                {downloadingAssignments ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Descargar historial
              </button>
            </div>
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
            <><PayrollAutomation user={user} personal={personal} centrosGestion={centrosGestion} indicadores={indicadores} onEmit={(worker) => { setSelectedWorkerLiquidacion(worker); setShowLiquidacionPDFModal(true); }} /><div className="hidden bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
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
                      const topeGratif = Math.round((4.75 * (indicadores.salarioMinimo || INDICADORES_OFICIALES_CHILE.salarioMinimo)) / 12);
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
            </div></>
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
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">📈 Indicadores previsionales oficiales de Chile</h4>
                  <p className="text-[10px] text-slate-500">Última actualización: {indicadores.ultimaActualizacion}</p>
                  <p className="text-[10px] text-slate-400">Fuentes: {indicadores.fuentes || INDICADORES_OFICIALES_CHILE.fuentes}</p>
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
                  <span className="text-[10px] font-bold uppercase text-slate-400">Ingreso mínimo general</span>
                  <p className="text-lg font-black text-slate-800 mt-0.5">${indicadores.salarioMinimo.toLocaleString('es-CL')}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Vigente desde {indicadores.vigenciaSalarioMinimo || '01-05-2026'}</p>
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
                <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Ingreso mínimo menor de 18 / mayor de 65</span>
                  <p className="text-lg font-black text-slate-800 mt-0.5">${(indicadores.salarioMinimoMenorMayor || INDICADORES_OFICIALES_CHILE.salarioMinimoMenorMayor).toLocaleString('es-CL')}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Vigente desde 01-05-2026</p>
                </div>
                <div className="bg-slate-50 p-3 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Ingreso mínimo no remuneracional</span>
                  <p className="text-lg font-black text-slate-800 mt-0.5">${(indicadores.ingresoMinimoNoRemuneracional || INDICADORES_OFICIALES_CHILE.ingresoMinimoNoRemuneracional).toLocaleString('es-CL')}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Vigente desde 01-05-2026</p>
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
                          setGeneratedContractText(renderContractTemplate(t, w));
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
                          setGeneratedContractText(renderContractTemplate(t, w));
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
                    setTemplateForm({ titulo: '', tipo: 'Contrato Indefinido', contenido: '', archivo_nombre: '', variables: [], advertencias: [] });
                    setTemplateMessage('Sube un contrato existente para convertirlo en formato reutilizable, o créalo manualmente.');
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
                      <div className="flex gap-2"><button onClick={() => { setEditingTemplate(t); setTemplateForm({ titulo: t.titulo, tipo: t.tipo, contenido: t.contenido, archivo_nombre: t.archivo_nombre || '', variables: t.variables || [], advertencias: t.advertencias || [] }); setTemplateMessage(''); setShowTemplateModal(true); }} className="text-blue-900 hover:text-blue-950 text-xs font-bold cursor-pointer">Editar</button><button onClick={() => deleteContractTemplate(t)} className="text-red-600 hover:text-red-800 text-xs font-bold cursor-pointer">Eliminar</button></div>
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
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Documentación del Trabajador</h3>
                <p className="text-xs text-slate-500">{selectedWorkerDoc.nombre} ({selectedWorkerDoc.rut || 'Sin RUT'})</p>
              </div>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <WorkerDocumentsPanel user={user} worker={selectedWorkerDoc} documentTypes={docTypes} aiEnabled={rrhhAIEnabled} />

            <div className="hidden space-y-3">
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
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Centro de Gestión</label>
                    <select
                      value={formData.centro_gestion_id || ''}
                      onChange={(e) => {
                        const center = centrosGestion.find(item => String(item.id) === e.target.value);
                        const linkedWork = obras.find(item => String(item.centro_gestion_id) === e.target.value);
                        setFormData({ ...formData, centro_gestion_id: e.target.value, centro_trabajo: center ? `${center.codigo} · ${center.nombre}` : '', obra_nombre: linkedWork?.nombre || formData.obra_nombre });
                      }}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-medium bg-white"
                    >
                      <option value="">Sin centro asignado</option>
                      {centrosGestion.map(center => <option key={center.id} value={center.id}>{center.codigo} · {center.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Obra Asignada</label>
                    <select
                      value={formData.obra_nombre}
                      onChange={(e) => {
                        const work = obras.find(item => item.nombre === e.target.value);
                        const center = centrosGestion.find(item => item.id === work?.centro_gestion_id);
                        setFormData({ ...formData, obra_nombre: e.target.value, centro_gestion_id: work?.centro_gestion_id || formData.centro_gestion_id, centro_trabajo: center ? `${center.codigo} · ${center.nombre}` : formData.centro_trabajo });
                      }}
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

            <form onSubmit={saveContractTemplate} className="space-y-4 text-xs">
              {/* Opción de Carga Automática desde Archivo */}
              <div className="bg-blue-50/60 border border-dashed border-blue-200 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-blue-950 flex items-center gap-1">
                    <FileUp className="w-3.5 h-3.5 text-blue-900" />
                    <span>Convertir contrato existente con IA (.PDF, .DOCX, .TXT)</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">La IA conserva la estructura y reemplaza los datos variables por etiquetas de Obraxis. El resultado siempre debe revisarse antes de guardarlo.</p>
                <input
                  type="file"
                  accept=".txt,.pdf,.docx"
                  disabled={templateBusy}
                  onChange={(e) => { analyzeContractFile(e.target.files?.[0]); e.target.value = ''; }}
                  className="w-full text-xs text-slate-800 cursor-pointer"
                />
                {templateBusy && <div className="flex items-center gap-2 rounded-lg bg-white p-2 text-[10px] font-bold text-violet-800"><Loader2 className="h-3.5 w-3.5 animate-spin"/>Analizando documento…</div>}
                {templateMessage && <p className="rounded-lg bg-white p-2 text-[10px] font-semibold text-slate-700">{templateMessage}</p>}
              </div>

              {templateForm.variables?.length > 0 && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase text-emerald-900">Variables detectadas</p><div className="mt-2 flex flex-wrap gap-1.5">{templateForm.variables.map(variable => <span key={variable} className="rounded-md bg-white px-2 py-1 font-mono text-[10px] font-bold text-emerald-800">{`{{${variable}}}`}</span>)}</div></div>}
              {templateForm.advertencias?.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900"><b>Revisión necesaria:</b> {templateForm.advertencias.join(' ')}</div>}

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
                disabled={templateBusy}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {templateBusy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>}Guardar Formato para la Empresa
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
                  onClick={() => printPayrollSlip(selectedWorkerLiquidacion)}
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
                  <p className="text-[11px] text-slate-600 font-semibold">RUT empresa: {user?.empresa_rut || user?.rut_empresa || 'No informado'}</p>
                  <p className="text-[10px] text-slate-500">Documento laboral emitido mediante Obraxis</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded border border-slate-200 block text-slate-700">
                    PERÍODO: {selectedWorkerLiquidacion.periodo ? new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(`${selectedWorkerLiquidacion.periodo}-01T12:00:00`)) : new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date())}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">Folio N° LIQ-{selectedWorkerLiquidacion.periodo || new Date().toISOString().slice(0, 7)}-{selectedWorkerLiquidacion.id || '01'}</span>
                </div>
              </div>

              <h3 className="text-center font-black text-blue-950 uppercase text-xs tracking-widest my-2 py-1 bg-slate-100 rounded">
                LIQUIDACIÓN DE SUELDO Y REMUNERACIONES
              </h3>

              {/* Ficha e Info del Trabajador */}
              {(() => {
                const payroll = selectedWorkerLiquidacion.payroll;
                const sBase = payroll?.base ?? (parseFloat(selectedWorkerLiquidacion.sueldo_base) || 600000);
                const topeGratif = Math.round((4.75 * (indicadores.salarioMinimo || INDICADORES_OFICIALES_CHILE.salarioMinimo)) / 12);
                const tieneGratif = selectedWorkerLiquidacion.gratificacion !== 'Sin Gratificación';
                const gratifMonto = payroll?.gratification ?? (tieneGratif ? Math.min(Math.round(sBase * 0.25), topeGratif) : 0);
                const imponible = payroll?.taxableGross ?? (sBase + gratifMonto);

                const colacion = payroll?.collation ?? (parseFloat(selectedWorkerLiquidacion.colacion) || 0);
                const movilizacion = payroll?.transport ?? (parseFloat(selectedWorkerLiquidacion.movilizacion) || 0);
                const totalHaberes = payroll?.totalAssets ?? (imponible + colacion + movilizacion);

                const afpInfo = getAFPDetails(selectedWorkerLiquidacion.afp);
                const afpMonto = payroll?.afp ?? Math.round(imponible * (afpInfo.total / 100));
                const saludMonto = payroll?.health ?? Math.round(imponible * 0.07);
                const isIndef = (selectedWorkerLiquidacion.tipo_contrato || 'Indefinido') === 'Indefinido';
                const afcMonto = payroll?.afc ?? (isIndef ? Math.round(imponible * 0.006) : 0);
                const impuestoMonto = payroll?.tax ?? 0;
                const otrosDescuentos = payroll?.otherDiscounts ?? 0;
                const totalDescuentos = payroll?.legalDiscounts ? payroll.legalDiscounts + otrosDescuentos : afpMonto + saludMonto + afcMonto;
                const sueldoLiquido = payroll?.net ?? (totalHaberes - totalDescuentos);

                return (
                  <>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 bg-slate-50 border border-slate-200 p-3 rounded-xl text-[11px]">
                      <div><strong>Nombre Trabajador:</strong> {selectedWorkerLiquidacion.nombre}</div>
                      <div><strong>RUT:</strong> {selectedWorkerLiquidacion.rut || 'Sin RUT'}</div>
                      <div><strong>Cargo / Función:</strong> {selectedWorkerLiquidacion.cargo}</div>
                      <div><strong>Centro de Gestión:</strong> {selectedWorkerLiquidacion.payroll?.centroGestion || selectedWorkerLiquidacion.centro_gestion_nombre || selectedWorkerLiquidacion.centro_trabajo || selectedWorkerLiquidacion.obra_nombre || 'Sin asignar'}</div>
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
                            {impuestoMonto > 0 && <tr><td className="p-1.5">Impuesto Único de Segunda Categoría</td><td className="p-1.5 text-right font-mono text-red-600 font-bold">-${impuestoMonto.toLocaleString('es-CL')}</td></tr>}
                            {otrosDescuentos > 0 && <tr><td className="p-1.5">Otros descuentos autorizados</td><td className="p-1.5 text-right font-mono text-red-600 font-bold">-${otrosDescuentos.toLocaleString('es-CL')}</td></tr>}
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
                  uf: parseFloat(editIndicadoresForm.uf) || INDICADORES_OFICIALES_CHILE.uf,
                  utm: parseFloat(editIndicadoresForm.utm) || INDICADORES_OFICIALES_CHILE.utm,
                  salarioMinimo: parseFloat(editIndicadoresForm.salarioMinimo) || INDICADORES_OFICIALES_CHILE.salarioMinimo,
                  topeAfpUf: parseFloat(editIndicadoresForm.topeAfpUf) || INDICADORES_OFICIALES_CHILE.topeAfpUf,
                  topeCesantiaUf: parseFloat(editIndicadoresForm.topeCesantiaUf) || INDICADORES_OFICIALES_CHILE.topeCesantiaUf,
                  apvMaxUf: parseFloat(editIndicadoresForm.apvMaxUf) || INDICADORES_OFICIALES_CHILE.apvMaxUf,
                  ultimaActualizacion: new Date().toLocaleDateString('es-CL') + ' (ajuste manual)'
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

      {activeSubmodule === 'estadisticas' && <HrStatistics personal={personal} obras={obras} canDownload={canDownloadStatistics} companyName={user?.empresa || 'Empresa'} />}
      {activeSubmodule === 'proyeccion' && <WorkforceProjection user={user} personal={personal} obras={obras} canCreate={canCreateProjection} canEdit={canEditProjection} canDelete={canDeleteProjection} />}

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

      {showBulkImport && <WorkerBulkImport companyName={user?.empresa || 'Obraxis'} personal={personal} obras={obras} onClose={() => setShowBulkImport(false)} onImported={fetchData}/>}
    </div>
  );
}

export default Personal;
