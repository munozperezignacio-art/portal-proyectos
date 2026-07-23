import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, FileSpreadsheet, Calendar, Plus, Save, Trash2, 
  Upload, Check, AlertCircle, RefreshCw, ChevronRight, CalendarDays,
  FolderPlus, DollarSign, Hammer, Briefcase, FileText, MapPin, Clock, ChevronLeft,
  Settings, Percent, Coins, Sliders, Info, Store, Building2, ChevronDown, ChevronUp, Calculator, Fuel, Wrench, PieChart, Download, Globe, TrendingUp, Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { comunasChile } from '../utils/comunas';

// Helpers para compatibilidad de metadatos en columnas existentes
const parseResourceUnitAndCurrency = (unidadStr) => {
  const parts = (unidadStr || '').split('|');
  return {
    unidad: parts[0]?.trim() || 'un',
    moneda: parts[1]?.trim() || 'CLP'
  };
};

const serializeResourceUnitAndCurrency = (unidad, moneda) => {
  return `${unidad || 'un'} | ${moneda || 'CLP'}`;
};

const parseProjectTipoAndCurrency = (tipoStr) => {
  const parts = (tipoStr || '').split('|');
  return {
    tipo: parts[0]?.trim() || 'Privado',
    monedaBase: parts[1]?.trim() || 'CLP'
  };
};

const serializeProjectTipoAndCurrency = (tipo, monedaBase) => {
  return `${tipo || 'Privado'} | ${monedaBase || 'CLP'}`;
};

const parseProjectDescriptionAndCalendar = (descStr) => {
  const parts = (descStr || '').split('|||CALENDAR:');
  const userDesc = parts[0] || '';
  let calendar = {
    trabajaSabado: false,
    trabajaDomingo: false,
    feriados: [],
    eficienciasEspeciales: {},
    turnoHoras: 9
  };
  if (parts[1]) {
    try {
      calendar = JSON.parse(parts[1]);
    } catch (e) {
      console.warn("Failed to parse calendar from description", e);
    }
  }
  return { userDesc, calendar };
};

const serializeProjectDescriptionAndCalendar = (userDesc, calendar) => {
  return `${userDesc || ''}|||CALENDAR:${JSON.stringify(calendar)}`;
};

const calculateEndDateWithCalendar = (startDateStr, durationDays, calendarConfig) => {
  if (!startDateStr || durationDays === undefined) return '';
  let duration = parseFloat(durationDays);
  if (isNaN(duration)) duration = 1;

  // Safe-guards for config properties
  const config = calendarConfig || {};
  const trabajaSabado = !!config.trabajaSabado;
  const trabajaDomingo = !!config.trabajaDomingo;
  const feriados = config.feriados || [];
  const eficiencias = config.eficienciasEspeciales || {};

  let currentDate = new Date(startDateStr + 'T00:00:00');
  if (isNaN(currentDate.getTime())) return startDateStr;
  
  // Si duración es 0 (Hito), la fecha de fin es igual a la de inicio
  if (duration <= 0) return startDateStr;

  let daysWorked = 0;
  let iterations = 0;
  
  while (daysWorked < duration && iterations < 1000) {
    iterations++;
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay(); // 0 = Domingo, 6 = Sábado

    let isWorkingDay = true;
    if (dayOfWeek === 0 && !trabajaDomingo) isWorkingDay = false;
    if (dayOfWeek === 6 && !trabajaSabado) isWorkingDay = false;

    if (feriados.includes(dateStr)) {
      isWorkingDay = false;
    }

    if (isWorkingDay) {
      const efficiency = parseFloat(eficiencias[dateStr] ?? 100) / 100;
      daysWorked += isNaN(efficiency) ? 1.0 : efficiency;
    }

    if (daysWorked < duration) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return currentDate.toISOString().split('T')[0];
};

const normalizeTaskCode = (codeStr) => {
  if (!codeStr) return '';
  return codeStr
    .trim()
    .toUpperCase()
    .split('.')
    .map(part => {
      const normalized = part.replace(/^0+/, '');
      return normalized === '' ? '0' : normalized;
    })
    .join('.');
};

const parsePredecesora = (predStr) => {
  if (!predStr) return null;
  let str = predStr.trim().toUpperCase();
  let lag = 0;
  
  // Extraer desfase al final si existe (ej: +2, -3)
  const lagMatch = str.match(/([+-]\d+)$/);
  if (lagMatch) {
    lag = parseInt(lagMatch[1], 10);
    str = str.substring(0, str.length - lagMatch[1].length);
  }
  
  // Extraer tipo de dependencia (FC o CC)
  let type = 'FC';
  if (str.endsWith('FC')) {
    type = 'FC';
    str = str.substring(0, str.length - 2);
  } else if (str.endsWith('CC')) {
    type = 'CC';
    str = str.substring(0, str.length - 2);
  }
  
  const code = str.trim();
  return { code, type, lag };
};

export default function PresupuestosPlanif({ user, companyBranding, onBack }) {
  // Tipo de cambio del día (UF, USD, UTM, CLP)
  const [exchangeRates, setExchangeRates] = useState({
    CLP: 1,
    USD: 945,  // default fallback
    UF: 38480, // default fallback
    UTM: 66250 // default fallback
  });
  const [loadingRates, setLoadingRates] = useState(true);

  // Lista de proyectos/presupuestos independientes
  const [proyectos, setProyectos] = useState([]);
  const [selectedProyectoId, setSelectedProyectoId] = useState('');
  const [loadingProyectos, setLoadingProyectos] = useState(true);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Visualización y emisión en moneda seleccionada para planilla
  const [displayCurrency, setDisplayCurrency] = useState('CLP');

  // Estados de arrastre interactivo para el Gantt
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartLag, setDragStartLag] = useState(0);
  const [dragStartInicio, setDragStartInicio] = useState('');

  // Estado para el selector de color flotante en las barras del Gantt
  const [showColorPickerTaskId, setShowColorPickerTaskId] = useState(null);

  // Parametrización del Flujo de Caja
  const [cajaAnticipoPct, setCajaAnticipoPct] = useState(10); // % de Anticipo
  const [cajaRetencionPct, setCajaRetencionPct] = useState(5); // % de Retención
  const [cajaRetencionDevoluMes, setCajaRetencionDevoluMes] = useState(1); // Meses tras fin de proyecto para devolución
  const [cajaCobroClientesDias, setCajaCobroClientesDias] = useState(30); // Días de pago de clientes
  
  // Plazos de pago a proveedores por categoría de recursos
  const [cajaPagoMaterialesDias, setCajaPagoMaterialesDias] = useState(30);
  const [cajaPagoManoObraDias, setCajaPagoManoObraDias] = useState(0); // Mano de obra al contado/mismo mes
  const [cajaPagoMaquinariaDias, setCajaPagoMaquinariaDias] = useState(30);
  const [cajaPagoHerramientasDias, setCajaPagoHerramientasDias] = useState(30);
  const [cajaPagoOtrosDias, setCajaPagoOtrosDias] = useState(30);
  const [cajaPagoIndirectosDias, setCajaPagoIndirectosDias] = useState(30);

  // Tab activo de análisis
  const [analisisTab, setAnalisisTab] = useState('distribucion');

  // Enlaces de APU de todo el proyecto para el análisis financiero
  const [allApuLinks, setAllApuLinks] = useState([]);
  const [allApuLinksLoading, setAllApuLinksLoading] = useState(false);

  // Estados del Importador de Presupuestos con IA
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (companyBranding?.gemini_api_key) return companyBranding.gemini_api_key;
    return localStorage.getItem('gemini_api_key') || '';
  });
  const [geminiModel, setGeminiModel] = useState(() => {
    if (companyBranding?.gemini_model) return companyBranding.gemini_model;
    return localStorage.getItem('gemini_model') || 'gemini-3.5-flash';
  });

  useEffect(() => {
    if (companyBranding?.gemini_api_key) {
      setGeminiApiKey(companyBranding.gemini_api_key);
    }
    if (companyBranding?.gemini_model) {
      setGeminiModel(companyBranding.gemini_model);
    }
  }, [companyBranding]);

  const [importAILoading, setImportAILoading] = useState(false);
  const [importAIError, setImportAIError] = useState('');
  const [importAIFile, setImportAIFile] = useState(null);
  const [parsedAIBudget, setParsedAIBudget] = useState(null);

  // Estados editables de la vista previa del proyecto importado por IA
  const [aiProjNombre, setAiProjNombre] = useState('');
  const [aiProjCliente, setAiProjCliente] = useState('');
  const [aiProjComuna, setAiProjComuna] = useState('');
  const [aiProjMoneda, setAiProjMoneda] = useState('CLP');
  const [aiProjPlazo, setAiProjPlazo] = useState(30);



  // Configuración del calendario laboral del proyecto
  const [calendarConfig, setCalendarConfig] = useState({
    trabajaSabado: false,
    trabajaDomingo: false,
    feriados: [],
    eficienciasEspeciales: {},
    turnoHoras: 9
  });
  
  // Datos del nuevo proyecto
  const [newProjectData, setNewProjectData] = useState({ 
    nombre: '', 
    descripcion: '',
    cliente: '',
    ubicacion: '',
    plazo_estimado: '',
    presupuesto_estimado: '',
    tipo_proyecto: 'Privado',
    comuna: '',
    moneda_base: 'CLP'
  });

  // Apartado activo: '' (Menú principal de apartados), 'crear', 'ingresar', 'gantt', 'recursos', 'mis_presupuestos'
  const [activeSection, setActiveSection] = useState('');

  // Estados del Presupuesto (Crear/Detalle)
  const [itemsPresupuesto, setItemsPresupuesto] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Estados de Planificación
  const [cronograma, setCronograma] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [ganttStartDate, setGanttStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [ganttScale, setGanttScale] = useState(30);

  // Estados de Recursos
  const [recursos, setRecursos] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // Importador Masivo (Ingresar Presupuesto)
  const [importText, setImportText] = useState('');

  // Estados de Costos Indirectos / Generales
  const [indirectCosts, setIndirectCosts] = useState([]);
  const [indirectLoading, setIndirectLoading] = useState(false);
  const [showIndirectModal, setShowIndirectModal] = useState(false);

  // Estados de APU / Análisis de Partida
  const [showApuModal, setShowApuModal] = useState(false);
  const [apuItem, setApuItem] = useState(null);
  const [apuResources, setApuResources] = useState([]);
  const [apuLoading, setApuLoading] = useState(false);
  const [selectedAddResourceId, setSelectedAddResourceId] = useState('');
  const [showApuConfigAccordion, setShowApuConfigAccordion] = useState(true);
  
  // Tab interna para añadir recursos en APU: 'existente' o 'nuevo'
  const [addResourceMode, setAddResourceMode] = useState('existente');
  const [newResourceForm, setNewResourceForm] = useState({
    recurso: '',
    tipo: 'Material',
    unidad: 'un',
    moneda: 'CLP',
    costo_unitario: '',
    ciudad: '',
    proveedor: ''
  });

  const [apuForm, setApuForm] = useState({
    tipo_metodologia: 'Precio Unitario',
    rendimiento_meta: 25,
    dias_habiles_mes: 22,
    horas_jornada: 9,
    precio_combustible: 1050,
    leyes_sociales_pct: 35,
    herramientas_menores_pct: 5,
    imponderables_pct: 5,
    tiempo_estimado: 0,
    costo_materiales: 0,
    costo_mano_obra: 0,
    costo_maquinaria: 0,
    costo_herramientas: 0,
    costo_otros: 0
  });

  // Mensajes generales
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cargar indicadores de mindicador.cl al iniciar
  useEffect(() => {
    const fetchRates = async () => {
      setLoadingRates(true);
      try {
        const res = await fetch('https://mindicador.cl/api');
        if (!res.ok) throw new Error('Dificultades de conexión con indicador API');
        const data = await res.json();
        setExchangeRates({
          CLP: 1,
          USD: data.dolar?.valor || 945,
          UF: data.uf?.valor || 38480,
          UTM: data.utm?.valor || 66250
        });
      } catch (err) {
        console.warn('CORS o red no disponible. Usando UF/Dólar referenciales del día.', err.message);
      } finally {
        setLoadingRates(false);
      }
    };
    fetchRates();
  }, []);

  // Cargar proyectos al iniciar
  useEffect(() => {
    fetchProyectos();
  }, []);

  // Cargar datos cuando cambia el proyecto activo
  useEffect(() => {
    if (selectedProyectoId) {
      fetchBudgetItems(selectedProyectoId);
      fetchCronograma(selectedProyectoId);
      fetchRecursos(selectedProyectoId);
      fetchIndirectCosts(selectedProyectoId);
    } else {
      setItemsPresupuesto([]);
      setCronograma([]);
      setRecursos([]);
      setIndirectCosts([]);
    }
  }, [selectedProyectoId]);

  // Sincronizar moneda de visualización con la moneda base del proyecto activo
  const currentProyecto = proyectos.find(p => p.id === parseInt(selectedProyectoId, 10));
  const projectBaseCurrency = currentProyecto 
    ? parseProjectTipoAndCurrency(currentProyecto.tipo_proyecto).monedaBase 
    : 'CLP';

  useEffect(() => {
    if (currentProyecto) {
      const info = parseProjectTipoAndCurrency(currentProyecto.tipo_proyecto);
      setDisplayCurrency(info.monedaBase || 'CLP');
      
      const parsed = parseProjectDescriptionAndCalendar(currentProyecto.descripcion);
      setCalendarConfig(parsed.calendar);
    }
  }, [selectedProyectoId, proyectos]);

  const fetchProjectApuLinks = async () => {
    if (!selectedProyectoId || itemsPresupuesto.length === 0) return;
    setAllApuLinksLoading(true);
    try {
      const itemIds = itemsPresupuesto.filter(i => typeof i.id === 'number').map(i => i.id);
      if (itemIds.length > 0) {
        const { data, error } = await supabase
          .from('presupuestos_items_recursos')
          .select('*')
          .in('item_id', itemIds);
        if (error) throw error;
        setAllApuLinks(data || []);
      } else {
        setAllApuLinks([]);
      }
    } catch (err) {
      console.error("Error fetching all APU links: ", err);
    } finally {
      setAllApuLinksLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'analisis') {
      fetchProjectApuLinks();
    }
  }, [activeSection, selectedProyectoId, itemsPresupuesto]);

  // --- LÓGICA DE IMPORTADOR INTELIGENTE CON IA (GEMINI 2.5 FLASH) ---
  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleProcessAIImport = async () => {
    if (!importAIFile) {
      setImportAIError("Por favor selecciona un archivo.");
      return;
    }
    if (!geminiApiKey.trim()) {
      setImportAIError("Por favor ingresa una API Key de Gemini válida.");
      return;
    }
    setImportAILoading(true);
    setImportAIError("");
    setParsedAIBudget(null);

    try {
      const file = importAIFile;
      const fileType = file.name.split('.').pop().toLowerCase();
      
      let promptPayload = "";
      let inlineData = null;

      if (['xlsx', 'xls', 'csv'].includes(fileType)) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        let textContent = "";
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          textContent += `--- Hoja: ${sheetName} ---\n${csv}\n\n`;
        });
        promptPayload = `Aquí está el contenido del presupuesto en formato de planilla:\n\n${textContent}`;
      } else if (fileType === 'pdf') {
        const base64 = await convertFileToBase64(file);
        inlineData = {
          mimeType: "application/pdf",
          data: base64
        };
        promptPayload = "Analiza el archivo PDF adjunto que contiene un presupuesto de obra.";
      } else if (['png', 'jpg', 'jpeg'].includes(fileType)) {
        const base64 = await convertFileToBase64(file);
        inlineData = {
          mimeType: file.type,
          data: base64
        };
        promptPayload = "Analiza la imagen adjunta que contiene una planilla de presupuesto de obra.";
      } else {
        const text = await file.text();
        promptPayload = `Aquí está el contenido de texto del presupuesto:\n\n${text}`;
      }

      const systemPrompt = `Eres un experto en ingeniería de costos y presupuestos para la construcción.
Tu tarea es leer y extraer estructuradamente la información de la planilla o documento de presupuesto adjunto.
Debes identificar:
1. Nombre del proyecto (sé descriptivo, ej. "Habilitación de Oficinas EMIN", "Pavimentación Calle Larraín").
2. Cliente o Mandante del proyecto.
3. Ubicación o Comuna de Chile sugerida en base a la dirección o contexto del texto (ej. "Santiago", "Las Condes", "Maipú").
4. Moneda base (CLP, USD o UF).
5. Listado jerárquico de partidas y capítulos.

Para cada fila en el presupuesto, clasifícala como:
- Capítulo (is_chapter: true): tiene un código y descripción, pero no tiene unidad, cantidad ni precio unitario.
- Partida (is_chapter: false): tiene un código, descripción, unidad (ej: GL, M3, UN, M2, KG, etc.), cantidad y costo_unitario (precio unitario directo de costo).

IMPORTANTE:
- Mantén la jerarquía utilizando los códigos (ej: "01", "01.01", "01.02"). Si el archivo original no tiene códigos, genéralos en formato correlativo (ej. "01", "01.01", "01.02").
- Si no encuentras la cantidad o el costo unitario para una partida, ponle 0 por defecto.
- No incluyas filas vacías o subtotales de capítulo como partidas individuales. Los subtotales se calculan dinámicamente en nuestra aplicación.
- Proporciona un estimado razonable para el plazo de ejecución en días hábiles (plazo_estimado, def: 30) según la magnitud del proyecto.

Devuelve el resultado estrictamente en formato JSON utilizando el siguiente esquema:
{
  "proyecto": {
    "nombre": "Nombre del proyecto o de la obra",
    "cliente": "Cliente o Mandante",
    "moneda_base": "CLP" (o "USD", o "UF"),
    "comuna": "Comuna de Chile relevante o vacía",
    "plazo_estimado": 30
  },
  "items": [
    {
      "codigo": "Código jerárquico",
      "descripcion": "Descripción del ítem o capítulo",
      "is_chapter": true o false,
      "unidad": "Unidad física si no es capítulo, sino vacía",
      "cantidad": número,
      "costo_unitario": número
    }
  ]
}

IMPORTANTE: Retorna ÚNICAMENTE el objeto JSON válido. No rodees el resultado con bloques de código markdown de tipo \`\`\`json o similar, ni agregues ningún texto explicativo. Solo el objeto JSON.`;

      const parts = [{ text: systemPrompt }];
      if (promptPayload) {
        parts.push({ text: promptPayload });
      }
      if (inlineData) {
        parts.push({ inlineData });
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `Error del servidor Gemini: ${response.status}`);
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("Gemini retornó una respuesta vacía o sin contenido.");
      }

      const parsed = JSON.parse(rawText.trim());
      
      if (!parsed.proyecto || !Array.isArray(parsed.items)) {
        throw new Error("El JSON retornado por la IA no tiene el formato correcto.");
      }

      setParsedAIBudget(parsed);
      setAiProjNombre(parsed.proyecto.nombre || '');
      setAiProjCliente(parsed.proyecto.cliente || '');
      setAiProjComuna(parsed.proyecto.comuna || '');
      setAiProjMoneda(parsed.proyecto.moneda_base || 'CLP');
      setAiProjPlazo(parseInt(parsed.proyecto.plazo_estimado) || 30);
      setSuccessMsg("Archivo procesado con éxito por la Inteligencia Artificial. Revisa el desglose abajo.");
    } catch (err) {
      console.error(err);
      setImportAIError(err.message || "Error procesando el archivo con Gemini.");
    } finally {
      setImportAILoading(false);
    }
  };

  const handleSaveIAConfig = async () => {
    try {
      localStorage.setItem('gemini_api_key', geminiApiKey);
      localStorage.setItem('gemini_model', geminiModel);

      const isPrivileged = user.rol?.toLowerCase() === 'superusuario' || user.rol?.toLowerCase() === 'administrador';
      if (isPrivileged) {
        const { error } = await supabase
          .from('config_empresa')
          .upsert({
            empresa: user.empresa,
            gemini_api_key: geminiApiKey,
            gemini_model: geminiModel
          }, { onConflict: 'empresa' });

        if (error) {
          console.warn("No se pudo guardar la configuración de IA en la base de datos:", error.message);
          alert("Configuración guardada en este navegador de forma local. Para habilitarla para toda la empresa, asegúrate de ejecutar el script SQL de migración en Supabase.");
        } else {
          alert("¡Configuración de IA guardada con éxito en la base de datos para toda la empresa!");
        }
      } else {
        alert("Configuración de IA guardada en este navegador de forma local.");
      }
    } catch (err) {
      console.error("Error al guardar configuración de IA:", err);
      alert("Configuración guardada en este navegador de forma local.");
    }
  };


  const handleConfirmAIImport = async () => {
    if (!parsedAIBudget) return;
    setImportAILoading(true);
    setImportAIError("");
    setSuccessMsg("");

    try {
      let finalProjName = aiProjNombre.trim();
      if (!finalProjName) {
        throw new Error("El nombre del proyecto no puede estar vacío.");
      }

      // Validar si el nombre ya existe
      const { data: existingProjs } = await supabase
        .from('presupuestos_proyectos')
        .select('id')
        .eq('nombre', finalProjName);
      
      if (existingProjs && existingProjs.length > 0) {
        finalProjName += ` (${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL').slice(0,5)})`;
      }

      const items = parsedAIBudget.items;
      const totalDirectCostVal = items
        .filter(item => !item.is_chapter)
        .reduce((sum, item) => sum + ((parseFloat(item.cantidad) || 0) * (parseFloat(item.costo_unitario) || 0)), 0);

      const serializedTipo = serializeProjectTipoAndCurrency('Privado', aiProjMoneda);
      const serializedDesc = `Importado con IA 🧠 desde archivo: ${importAIFile ? importAIFile.name : 'Documento'}|||CALENDAR:${JSON.stringify(calendarConfig)}`;

      const { data: projData, error: projErr } = await supabase
        .from('presupuestos_proyectos')
        .insert([
          {
            nombre: finalProjName,
            descripcion: serializedDesc,
            ubicacion: aiProjComuna || 'Santiago',
            cliente: aiProjCliente || '',
            plazo_estimado: parseInt(aiProjPlazo) || 30,
            presupuesto_estimado: Math.round(totalDirectCostVal),
            tipo_proyecto: serializedTipo,
            comuna: aiProjComuna || 'Santiago',
            metodologia: 'Precio Unitario'
          }
        ])
        .select();

      if (projErr) throw projErr;
      if (!projData || projData.length === 0) {
        throw new Error("No se pudo obtener el ID del proyecto insertado.");
      }

      const newProjId = projData[0].id;

      const itemsToInsert = items.map(item => ({
        presupuesto_id: newProjId,
        codigo: item.codigo || '01',
        partida: item.descripcion || 'Sin descripción',
        unidad: item.is_chapter ? '' : (item.unidad || 'un'),
        cantidad: item.is_chapter ? 0 : (parseFloat(item.cantidad) || 0),
        costo_unitario: item.is_chapter ? 0 : (parseFloat(item.costo_unitario) || 0),
        rendimiento_meta: item.is_chapter ? 0 : 1,
        tipo_metodologia: 'Precio Unitario',
        leyes_sociales_pct: 35,
        imponderables_pct: 5,
        herramientas_menores_pct: 5,
        dias_habiles_mes: 22,
        horas_jornada: 9,
        precio_combustible: 1050
      }));

      const { data: insertedItems, error: itemsErr } = await supabase
        .from('presupuestos_items')
        .insert(itemsToInsert)
        .select();

      if (itemsErr) throw itemsErr;

      const todayStr = new Date().toISOString().split('T')[0];
      const cronoToInsert = insertedItems.map(item => {
        const qty = parseFloat(item.cantidad) || 0;
        const dur = item.unidad === '' ? 0 : Math.max(1, Math.min(30, Math.ceil(qty / 10) || 5));
        const fechaFin = calculateEndDateWithCalendar(todayStr, dur, calendarConfig);

        return {
          presupuesto_id: newProjId,
          codigo: item.codigo,
          tarea: item.partida,
          fecha_inicio: todayStr,
          fecha_fin: fechaFin,
          duracion: dur,
          predecesora: '',
          porcentaje_avance: 0,
          responsable: '',
          estado: 'blue'
        };
      });

      const { error: cronoErr } = await supabase
        .from('planificacion_cronogramas')
        .insert(cronoToInsert);

      if (cronoErr) throw cronoErr;

      setSuccessMsg(`¡Presupuesto "${finalProjName}" creado con éxito con ${insertedItems.length} partidas importadas por IA!`);
      setParsedAIBudget(null);
      setImportAIFile(null);
      
      await fetchProyectos(newProjId);
      setSelectedProyectoId(newProjId);
      setActiveSection('');
    } catch (err) {
      console.error(err);
      setImportAIError(err.message || "Error guardando el presupuesto en la base de datos.");
    } finally {
      setImportAILoading(false);
    }
  };


  // Conversión de Divisas Matemáticas
  const convertCurrency = (amount, from, to) => {
    if (!amount) return 0;
    if (from === to) return amount;
    
    // Primero convertir a pesos (CLP)
    let inCLP = amount;
    if (from === 'USD') inCLP = amount * exchangeRates.USD;
    else if (from === 'UF') inCLP = amount * exchangeRates.UF;
    else if (from === 'UTM') inCLP = amount * exchangeRates.UTM;

    // Convertir de pesos (CLP) a la moneda destino
    if (to === 'CLP') return inCLP;
    if (to === 'USD') return inCLP / exchangeRates.USD;
    if (to === 'UF') return inCLP / exchangeRates.UF;
    if (to === 'UTM') return inCLP / exchangeRates.UTM;
    return amount;
  };

  const formatCurrencyValue = (val, currency) => {
    if (currency === 'CLP') {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val || 0);
    } else if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
    } else if (currency === 'UF') {
      return `UF ${(val || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    return val;
  };

  const fetchProyectos = async () => {
    setLoadingProyectos(true);
    try {
      const { data, error } = await supabase
        .from('presupuestos_proyectos')
        .select('*')
        .order('nombre', { ascending: true });
      if (error) throw error;
      setProyectos(data || []);
      if (data && data.length > 0) {
        setSelectedProyectoId(data[0].id);
      }
    } catch (err) {
      console.error('Error al cargar proyectos:', err.message);
    } finally {
      setLoadingProyectos(false);
    }
  };

  const fetchBudgetItems = async (projId) => {
    setBudgetLoading(true);
    try {
      const { data, error } = await supabase
        .from('presupuestos_items')
        .select('*')
        .eq('presupuesto_id', projId);
      if (error) throw error;

      const sorted = (data || []).sort((a, b) => {
        const codA = a.codigo || '';
        const codB = b.codigo || '';
        return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
      });
      setItemsPresupuesto(sorted);
    } catch (err) {
      console.error('Error cargando ítems de presupuesto:', err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  const fetchCronograma = async (projId) => {
    setTasksLoading(true);
    try {
      const { data: projData, error: projErr } = await supabase
        .from('presupuestos_proyectos')
        .select('descripcion')
        .eq('id', projId)
        .single();
      
      let localCalendar = {
        trabajaSabado: false,
        trabajaDomingo: false,
        feriados: [],
        eficienciasEspeciales: {},
        turnoHoras: 9
      };

      if (!projErr && projData?.descripcion) {
        const parsed = parseProjectDescriptionAndCalendar(projData.descripcion);
        localCalendar = parsed.calendar;
        setCalendarConfig(localCalendar);
      }

      const { data: cronoData, error: cronoErr } = await supabase
        .from('planificacion_cronogramas')
        .select('*')
        .eq('presupuesto_id', projId);
      if (cronoErr) throw cronoErr;

      const { data: budgetData, error: budgetErr } = await supabase
        .from('presupuestos_items')
        .select('*')
        .eq('presupuesto_id', projId);
      if (budgetErr) throw budgetErr;

      const sortedItems = (budgetData || []).sort((a, b) => {
        const codA = a.codigo || '';
        const codB = b.codigo || '';
        return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
      });

      const todayStr = new Date().toISOString().split('T')[0];

      // Fusionar partidas de presupuesto
      const mergedList = sortedItems.map(item => {
        const existing = (cronoData || []).find(c => c.codigo === item.codigo);
        
        const qty = parseFloat(item.cantidad) || 0;
        const rend = parseFloat(item.rendimiento_meta) || 0;
        let calculatedDays = parseFloat(item.tiempo_estimado) || 1;
        if (rend > 0) {
          calculatedDays = qty / rend;
        }
        const finalDuration = existing && existing.duracion !== undefined && existing.duracion !== null
          ? Math.max(1, parseInt(existing.duracion, 10))
          : Math.max(1, Math.ceil(calculatedDays));

        const defaultStart = todayStr;
        const defaultEnd = calculateEndDateWithCalendar(
          existing ? existing.fecha_inicio : defaultStart,
          finalDuration,
          localCalendar
        );

        const rawPred = existing ? (existing.predecesora || '') : '';
        const parsed = parsePredecesora(rawPred) || { code: '', type: 'FC', lag: 0 };

        return {
          id: existing ? existing.id : 'temp-crono-' + item.codigo,
          presupuesto_id: projId,
          codigo: item.codigo,
          tarea: item.partida, // Sincronizado siempre con el nombre actual de la partida
          fecha_inicio: existing ? existing.fecha_inicio : defaultStart,
          fecha_fin: defaultEnd,
          duracion: finalDuration,
          predecesora: rawPred,
          predecesora_code: parsed.code,
          predecesora_tipo: parsed.type,
          predecesora_desfase: parsed.lag,
          porcentaje_avance: 0,
          responsable: existing ? (existing.responsable || '') : '',
          estado: existing ? (existing.estado || 'blue') : 'blue', // Repurposed for color (default blue)
          is_partida: true,
          cantidad: qty,
          rendimiento_meta: rend
        };
      });

      // Agregar hitos (que no coinciden con códigos de partidas de presupuesto)
      (cronoData || []).forEach(c => {
        if (!mergedList.some(m => m.codigo === c.codigo)) {
          const rawPred = c.predecesora || '';
          const parsed = parsePredecesora(rawPred) || { code: '', type: 'FC', lag: 0 };
          mergedList.push({
            ...c,
            predecesora: rawPred,
            predecesora_code: parsed.code,
            predecesora_tipo: parsed.type,
            predecesora_desfase: parsed.lag,
            is_partida: false
          });
        }
      });

      const sortedMergedList = mergedList.sort((a, b) => {
        const codA = a.codigo || '';
        const codB = b.codigo || '';
        return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
      });

      setCronograma(sortedMergedList);

      if (sortedMergedList.length > 0) {
        const startDates = sortedMergedList.map(t => t.fecha_inicio).filter(Boolean);
        if (startDates.length > 0) {
          const minDate = startDates.reduce((min, d) => d < min ? d : min, startDates[0]);
          setGanttStartDate(minDate);
        }
      }
    } catch (err) {
      console.error('Error cargando cronograma unificado:', err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchRecursos = async (projId) => {
    setResourcesLoading(true);
    try {
      const { data, error } = await supabase
        .from('recursos_presupuesto')
        .select('*')
        .eq('presupuesto_id', projId)
        .order('recurso', { ascending: true });
      if (error) throw error;
      setRecursos(data || []);
    } catch (err) {
      console.error('Error cargando recursos:', err.message);
    } finally {
      setResourcesLoading(false);
    }
  };

  const fetchIndirectCosts = async (projId) => {
    setIndirectLoading(true);
    try {
      const { data, error } = await supabase
        .from('presupuestos_costos_indirectos')
        .select('*')
        .eq('presupuesto_id', projId)
        .order('id', { ascending: true });
      if (error) throw error;
      setIndirectCosts(data || []);
    } catch (err) {
      console.error('Error cargando costos indirectos:', err.message);
    } finally {
      setIndirectLoading(false);
    }
  };

  // --- CREAR NUEVO PROYECTO ---
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectData.nombre.trim()) return;
    setLoadingProyectos(true);
    try {
      const tipoWithCurrency = serializeProjectTipoAndCurrency(newProjectData.tipo_proyecto, newProjectData.moneda_base);
      const { data, error } = await supabase
        .from('presupuestos_proyectos')
        .insert([
          {
            nombre: newProjectData.nombre.trim(),
            descripcion: newProjectData.descripcion.trim(),
            cliente: newProjectData.cliente.trim(),
            ubicacion: newProjectData.ubicacion.trim(),
            plazo_estimado: parseInt(newProjectData.plazo_estimado, 10) || 0,
            presupuesto_estimado: parseFloat(newProjectData.presupuesto_estimado) || 0,
            tipo_proyecto: tipoWithCurrency,
            comuna: newProjectData.comuna
          }
        ])
        .select();

      if (error) throw error;

      setSuccessMsg('Proyecto y presupuesto base en ' + newProjectData.moneda_base + ' creado.');
      setNewProjectData({ 
        nombre: '', 
        descripcion: '',
        cliente: '',
        ubicacion: '',
        plazo_estimado: '',
        presupuesto_estimado: '',
        tipo_proyecto: 'Privado',
        comuna: '',
        moneda_base: 'CLP'
      });
      setShowCreateProjectModal(false);
      
      const { data: list } = await supabase
        .from('presupuestos_proyectos')
        .select('*')
        .order('nombre', { ascending: true });
      setProyectos(list || []);
      if (data && data.length > 0) {
        setSelectedProyectoId(data[0].id);
      }
    } catch (err) {
      setErrorMsg('Error al crear proyecto: ' + err.message);
    } finally {
      setLoadingProyectos(false);
    }
  };

  // --- LÓGICA DE JERARQUÍAS ---
  const isChapterRow = (item, list) => {
    if (!item.codigo) return false;
    return list.some(other => other.codigo && other.codigo !== item.codigo && other.codigo.startsWith(item.codigo + '.'));
  };

  const getChapterSum = (chapterCode, list, isProrated = false, factor = 1) => {
    return list
      .filter(item => {
        if (!item.codigo || item.codigo === chapterCode) return false;
        const starts = item.codigo.startsWith(chapterCode + '.');
        return starts && !isChapterRow(item, list);
      })
      .reduce((sum, item) => {
        const qty = parseFloat(item.cantidad) || 0;
        const directPrice = parseFloat(item.costo_unitario) || 0;
        const price = isProrated ? Math.round(directPrice * factor) : directPrice;
        return sum + (qty * price);
      }, 0);
  };

  // --- ACCIONES PRESUPUESTO (CREAR) ---
  const handleAddBudgetRow = () => {
    let nextCode = '01';
    if (itemsPresupuesto.length > 0) {
      const last = itemsPresupuesto[itemsPresupuesto.length - 1];
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
      presupuesto_id: selectedProyectoId,
      codigo: nextCode,
      partida: 'NUEVA PARTIDA',
      unidad: 'un',
      cantidad: 0,
      costo_unitario: 0,
      rendimiento_meta: 25,
      dias_habiles_mes: 22,
      horas_jornada: 9,
      precio_combustible: 1050,
      tipo_metodologia: 'Precio Unitario',
      leyes_sociales_pct: 35,
      herramientas_menores_pct: 5,
      imponderables_pct: 5,
      tiempo_estimado: 0,
      costo_materiales: 0,
      costo_mano_obra: 0,
      costo_maquinaria: 0,
      costo_herramientas: 0,
      costo_otros: 0
    };
    setItemsPresupuesto([...itemsPresupuesto, newRow]);
  };

  const handleUpdateBudgetField = (id, field, value) => {
    setItemsPresupuesto(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteBudgetRow = (id) => {
    setItemsPresupuesto(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveBudget = async () => {
    if (!selectedProyectoId) return;
    setBudgetLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const toUpdate = itemsPresupuesto.filter(p => typeof p.id === 'number');
      const toInsert = itemsPresupuesto
        .filter(p => typeof p.id === 'string' && p.id.startsWith('temp-'))
        .map(p => {
          const { id, ...rest } = p;
          return { ...rest, presupuesto_id: selectedProyectoId };
        });

      const { data: dbCurrent, error: dbErr } = await supabase
        .from('presupuestos_items')
        .select('id')
        .eq('presupuesto_id', selectedProyectoId);

      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('presupuestos_items')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from('presupuestos_items')
          .update({
            codigo: item.codigo,
            partida: item.partida,
            unidad: item.unidad,
            cantidad: parseFloat(item.cantidad) || 0,
            costo_unitario: parseFloat(item.costo_unitario) || 0,
            rendimiento_meta: parseFloat(item.rendimiento_meta) || 0
          })
          .eq('id', item.id);
        if (updErr) throw updErr;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('presupuestos_items')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Presupuesto guardado exitosamente.');
      fetchBudgetItems(selectedProyectoId);
      fetchCronograma(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar presupuesto: ' + err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  // --- EXPORTAR PRESUPUESTO EN EXCEL (CON MONEDA SELECCIONADA) ---
  const handleExportExcel = async () => {
    if (!selectedProyectoId || itemsPresupuesto.length === 0) {
      alert("No hay partidas registradas en el presupuesto actual para exportar.");
      return;
    }

    setExportingExcel(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const itemIds = itemsPresupuesto.filter(i => typeof i.id === 'number').map(i => i.id);
      let allApuLinks = [];
      if (itemIds.length > 0) {
        const { data, error } = await supabase
          .from('presupuestos_items_recursos')
          .select('*')
          .in('item_id', itemIds);
        if (!error && data) {
          allApuLinks = data;
        }
      }

      const wb = XLSX.utils.book_new();

      // -------------------------------------------------------------
      // HOJA 1: RESUMEN DE PRESUPUESTO
      // -------------------------------------------------------------
      const sheet1Data = [];
      const projName = currentProyecto?.nombre || 'Presupuesto de Obra';
      
      sheet1Data.push(['PRESUPUESTO DE OBRA', projName]);
      sheet1Data.push(['Cliente / Mandante:', currentProyecto?.cliente || 'N/A']);
      sheet1Data.push(['Ubicación / Comuna:', `${currentProyecto?.ubicacion || ''} - ${currentProyecto?.comuna || ''}`]);
      sheet1Data.push(['Moneda Base del Proyecto:', projectBaseCurrency]);
      sheet1Data.push(['Moneda de Emisión / Reporte:', displayCurrency]);
      sheet1Data.push(['Fecha Exportación:', new Date().toLocaleDateString('es-CL')]);
      sheet1Data.push([]); // Línea en blanco

      // Encabezados Tabla
      sheet1Data.push([
        'CÓDIGO', 
        'ITEM / PARTIDA', 
        'UNIDAD', 
        'CANTIDAD', 
        `PRECIO UNITARIO (${displayCurrency})`, 
        `PRECIO PARTIDA (${displayCurrency})`
      ]);

      itemsPresupuesto.forEach(item => {
        const isChapter = isChapterRow(item, itemsPresupuesto);
        const directPriceInBase = parseFloat(item.costo_unitario) || 0;
        const isProratedActive = prorateFactor > 1;
        const effectivePriceInBase = isProratedActive ? directPriceInBase * prorateFactor : directPriceInBase;

        // Convertir de Moneda Base a Moneda de Visualización
        const effectivePriceInDisplay = convertCurrency(effectivePriceInBase, projectBaseCurrency, displayCurrency);

        const chapterSumInBase = isChapter ? getChapterSum(item.codigo, itemsPresupuesto, isProratedActive, prorateFactor) : 0;
        const chapterSumInDisplay = convertCurrency(chapterSumInBase, projectBaseCurrency, displayCurrency);

        const importeInDisplay = isChapter 
          ? chapterSumInDisplay 
          : (parseFloat(item.cantidad) || 0) * effectivePriceInDisplay;

        if (isChapter) {
          sheet1Data.push([
            item.codigo || '',
            (item.partida || '').toUpperCase(),
            '',
            '',
            '',
            displayCurrency === 'CLP' ? Math.round(importeInDisplay) : parseFloat(importeInDisplay.toFixed(4))
          ]);
        } else {
          sheet1Data.push([
            item.codigo || '',
            item.partida || '',
            item.unidad || '',
            parseFloat(item.cantidad) || 0,
            displayCurrency === 'CLP' ? Math.round(effectivePriceInDisplay) : parseFloat(effectivePriceInDisplay.toFixed(4)),
            displayCurrency === 'CLP' ? Math.round(importeInDisplay) : parseFloat(importeInDisplay.toFixed(4))
          ]);
        }
      });

      sheet1Data.push([]); // Línea vacía

      const totalDirectCostDisp = convertCurrency(totalDirectCost, projectBaseCurrency, displayCurrency);
      sheet1Data.push(['', 'COSTO DIRECTO TOTAL', '', '', '', displayCurrency === 'CLP' ? Math.round(totalDirectCostDisp) : parseFloat(totalDirectCostDisp.toFixed(4))]);

      if (proratedIndirectCosts.length > 0) {
        const proratedDispVal = convertCurrency(totalProratedIndirectValue, projectBaseCurrency, displayCurrency);
        sheet1Data.push([
          '',
          `COSTOS GENERALES PRORRATEADOS (+${proratePctIncrement}%): ${proratedIndirectCosts.map(c => c.concepto).join(', ')}`,
          '',
          '',
          '',
          displayCurrency === 'CLP' ? Math.round(proratedDispVal) : parseFloat(proratedDispVal.toFixed(4))
        ]);
      }

      nonProratedIndirectCosts.forEach(cost => {
        const costValInBase = calculateIndirectCostValue(cost);
        const costValInDisp = convertCurrency(costValInBase, projectBaseCurrency, displayCurrency);
        sheet1Data.push([
          '',
          `${cost.concepto} (${cost.tipo === 'Porcentaje' ? `${cost.valor}%` : 'Monto Fijo'})`,
          '',
          '',
          '',
          displayCurrency === 'CLP' ? Math.round(costValInDisp) : parseFloat(costValInDisp.toFixed(4))
        ]);
      });

      const totalProjectCostDisp = convertCurrency(totalProjectCost, projectBaseCurrency, displayCurrency);
      sheet1Data.push(['', 'TOTAL GENERAL DEL PRESUPUESTO', '', '', '', displayCurrency === 'CLP' ? Math.round(totalProjectCostDisp) : parseFloat(totalProjectCostDisp.toFixed(4))]);

      const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
      ws1['!cols'] = [
        { wch: 12 },
        { wch: 48 },
        { wch: 10 },
        { wch: 14 },
        { wch: 22 },
        { wch: 22 }
      ];

      XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Presupuesto');

      // -------------------------------------------------------------
      // HOJAS 2 EN ADELANTE: APUs
      // -------------------------------------------------------------
      const usedSheetNames = new Set(['resumen presupuesto']);

      itemsPresupuesto.forEach(item => {
        const isChapter = isChapterRow(item, itemsPresupuesto);
        if (isChapter) return;

        const itemLinks = allApuLinks.filter(l => l.item_id === item.id);
        const sheetName = makeSheetName(item.codigo, item.partida, usedSheetNames);

        const apuSheetData = [];
        apuSheetData.push(['ANÁLISIS DE PRECIOS UNITARIOS (APU)', item.partida || 'PARTIDA']);
        apuSheetData.push(['Código Partida:', item.codigo || 'S/N']);
        apuSheetData.push(['Unidad de Medida:', item.unidad || 'un']);
        apuSheetData.push(['Cantidad de Partida:', parseFloat(item.cantidad) || 0]);
        apuSheetData.push(['Moneda del Análisis:', projectBaseCurrency]);
        apuSheetData.push(['Moneda de Presentación:', displayCurrency]);
        apuSheetData.push(['Metodología:', item.tipo_metodologia || 'Precio Unitario']);
        apuSheetData.push([]);

        apuSheetData.push(['PARÁMETROS DE CONFIGURACIÓN APU']);
        apuSheetData.push(['Rendimiento Meta:', item.rendimiento_meta || 25, 'Días Hábiles Mes:', item.dias_habiles_mes || 22]);
        apuSheetData.push(['Horas por Jornada:', item.horas_jornada || 9, 'Diesel ($/L):', item.precio_combustible || 1050]);
        apuSheetData.push(['Leyes Sociales (%):', item.leyes_sociales_pct || 35, 'Herramientas Menores (%):', item.herramientas_menores_pct || 5]);
        apuSheetData.push(['Imponderables (%):', item.imponderables_pct || 5]);
        apuSheetData.push([]);

        apuSheetData.push([
          'RECURSO / INSUMO', 
          'TIPO', 
          'TARIFA BASE ORIGINAL', 
          'MONEDA',
          'UNIDAD', 
          'CANTIDAD / CONSUMO', 
          'DIESEL (L/hr)', 
          'REND. COEF.', 
          `COSTO UNIT. PARTIDA (${displayCurrency})`
        ]);

        let matSum = 0;
        let laborSum = 0;
        let machSum = 0;
        let herrSum = 0;
        let otrosSum = 0;

        const isPU = (item.tipo_metodologia || 'Precio Unitario') === 'Precio Unitario';
        const rendMeta = item.rendimiento_meta || 25;
        const diasMes = item.dias_habiles_mes || 22;
        const hrsJornada = item.horas_jornada || 9;
        const precioDiesel = item.precio_combustible || 1050;
        const lsPct = item.leyes_sociales_pct !== undefined ? item.leyes_sociales_pct : 35;
        const hmPct = item.herramientas_menores_pct !== undefined ? item.herramientas_menores_pct : 5;
        const impPct = item.imponderables_pct !== undefined ? item.imponderables_pct : 5;

        itemLinks.forEach(link => {
          const res = recursos.find(r => String(r.id) === String(link.recurso_id));
          if (!res) return;

          const qty = parseFloat(link.cantidad_unidad) || 0;
          const resRend = parseFloat(link.rendimiento) || 1;
          const originalCost = parseFloat(res.costo_unitario) || 0;
          const resInfo = parseResourceUnitAndCurrency(res.unidad);
          
          // Costo en Moneda Base del proyecto
          const unitCostInBase = convertCurrency(originalCost, resInfo.moneda, projectBaseCurrency);

          const unitStr = resInfo.unidad.toLowerCase().trim();
          const consumoLh = parseFloat(link.consumo_combustible_lh) || 0;

          let itemSubInBase = 0;
          if (isPU) {
            if (res.tipo === 'Maquinaria') {
              const isTimeUnit = unitStr.includes('mes') || unitStr.includes('mensual') || unitStr.includes('hr') || unitStr.includes('hora') || unitStr.includes('día') || unitStr.includes('dia');
              if (isTimeUnit) {
                let dailyRate = unitCostInBase;
                if (unitStr.includes('mes') || unitStr.includes('mensual')) dailyRate = unitCostInBase / diasMes;
                else if (unitStr.includes('hr') || unitStr.includes('hora')) dailyRate = unitCostInBase * hrsJornada;
                const fuelDaily = consumoLh * hrsJornada * precioDiesel;
                itemSubInBase = ((dailyRate + fuelDaily) * qty) / rendMeta;
              } else {
                const fuelDaily = consumoLh * hrsJornada * precioDiesel;
                const fuelPerUnit = rendMeta > 0 ? (fuelDaily * qty) / rendMeta : 0;
                itemSubInBase = (unitCostInBase * qty * resRend) + fuelPerUnit;
              }
              machSum += itemSubInBase;
            } else if (res.tipo === 'Herramientas') {
              const isTimeUnit = unitStr.includes('mes') || unitStr.includes('mensual') || unitStr.includes('hr') || unitStr.includes('hora') || unitStr.includes('día') || unitStr.includes('dia');
              if (isTimeUnit) {
                let dailyRate = unitCostInBase;
                if (unitStr.includes('mes') || unitStr.includes('mensual')) dailyRate = unitCostInBase / diasMes;
                else if (unitStr.includes('hr') || unitStr.includes('hora')) dailyRate = unitCostInBase * hrsJornada;
                itemSubInBase = (dailyRate * qty) / rendMeta;
              } else {
                itemSubInBase = unitCostInBase * qty * resRend;
              }
              herrSum += itemSubInBase;
            } else if (res.tipo === 'Mano de Obra') {
              if (unitStr.includes('mes') || unitStr.includes('mensual')) {
                itemSubInBase = ((unitCostInBase / diasMes) * qty) / rendMeta;
              } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
                itemSubInBase = ((unitCostInBase * hrsJornada) * qty) / rendMeta;
              } else if (unitStr.includes('día') || unitStr.includes('dia')) {
                itemSubInBase = (unitCostInBase * qty) / rendMeta;
              } else {
                itemSubInBase = unitCostInBase * qty * resRend;
              }
              laborSum += itemSubInBase;
            } else if (res.tipo === 'Otros') {
              itemSubInBase = unitCostInBase * qty * resRend;
              otrosSum += itemSubInBase;
            } else {
              itemSubInBase = unitCostInBase * qty * resRend;
              matSum += itemSubInBase;
            }
          } else {
            let dailyCost = unitCostInBase;
            if (unitStr.includes('mes') || unitStr.includes('mensual')) dailyCost = unitCostInBase / diasMes;
            else if (unitStr.includes('hr') || unitStr.includes('hora')) dailyCost = unitCostInBase * hrsJornada;

            let fuelDaily = 0;
            if (res.tipo === 'Maquinaria' && consumoLh > 0) fuelDaily = consumoLh * hrsJornada * precioDiesel;
            itemSubInBase = (dailyCost + fuelDaily) * qty;

            if (res.tipo === 'Material') matSum += itemSubInBase;
            else if (res.tipo === 'Mano de Obra') laborSum += itemSubInBase;
            else if (res.tipo === 'Maquinaria') machSum += itemSubInBase;
            else if (res.tipo === 'Herramientas') herrSum += itemSubInBase;
            else otrosSum += itemSubInBase;
          }

          const itemSubInDisplay = convertCurrency(itemSubInBase, projectBaseCurrency, displayCurrency);

          apuSheetData.push([
            res.recurso || '',
            res.tipo || '',
            originalCost,
            resInfo.moneda,
            resInfo.unidad,
            qty,
            consumoLh || 0,
            resRend || 1,
            displayCurrency === 'CLP' ? Math.round(itemSubInDisplay) : parseFloat(itemSubInDisplay.toFixed(4))
          ]);
        });

        if (itemLinks.length === 0) {
          apuSheetData.push(['(Sin recursos vinculados en APU)', '', '', '', '', '', '', '', 0]);
        }

        apuSheetData.push([]);
        
        const laborTotal = laborSum * (1 + (lsPct + hmPct) / 100);
        const subtotalDirecto = matSum + machSum + laborTotal + herrSum + otrosSum;
        const totalUnitario = subtotalDirecto * (1 + impPct / 100);

        const matDisp = convertCurrency(matSum, projectBaseCurrency, displayCurrency);
        const laborDisp = convertCurrency(laborTotal, projectBaseCurrency, displayCurrency);
        const machDisp = convertCurrency(machSum, projectBaseCurrency, displayCurrency);
        const herrDisp = convertCurrency(herrSum, projectBaseCurrency, displayCurrency);
        const otrosDisp = convertCurrency(otrosSum, projectBaseCurrency, displayCurrency);
        const impDisp = convertCurrency(subtotalDirecto * (impPct / 100), projectBaseCurrency, displayCurrency);
        const subtotalDisp = convertCurrency(subtotalDirecto, projectBaseCurrency, displayCurrency);
        const totalUnitDisp = convertCurrency(totalUnitario, projectBaseCurrency, displayCurrency);

        apuSheetData.push([`DESGLOSE DE COSTOS Y RESULTADO FINAL (${displayCurrency})`]);
        apuSheetData.push(['Materiales:', displayCurrency === 'CLP' ? Math.round(matDisp) : parseFloat(matDisp.toFixed(4)), 'Mano de Obra (+Leyes):', displayCurrency === 'CLP' ? Math.round(laborDisp) : parseFloat(laborDisp.toFixed(4))]);
        apuSheetData.push(['Maquinaria (+Diesel):', displayCurrency === 'CLP' ? Math.round(machDisp) : parseFloat(machDisp.toFixed(4)), 'Herramientas:', displayCurrency === 'CLP' ? Math.round(herrDisp) : parseFloat(herrDisp.toFixed(4))]);
        apuSheetData.push(['Otros Insumos:', displayCurrency === 'CLP' ? Math.round(otrosDisp) : parseFloat(otrosDisp.toFixed(4)), `Imponderables (${impPct}%):`, displayCurrency === 'CLP' ? Math.round(impDisp) : parseFloat(impDisp.toFixed(4))]);
        apuSheetData.push(['SUBTOTAL DIRECTO:', displayCurrency === 'CLP' ? Math.round(subtotalDisp) : parseFloat(subtotalDisp.toFixed(4)), 'PRECIO UNITARIO FINAL ($):', displayCurrency === 'CLP' ? Math.round(totalUnitDisp) : parseFloat(totalUnitDisp.toFixed(4))]);

        const wsApu = XLSX.utils.aoa_to_sheet(apuSheetData);
        wsApu['!cols'] = [
          { wch: 32 },
          { wch: 16 },
          { wch: 22 },
          { wch: 10 },
          { wch: 12 },
          { wch: 20 },
          { wch: 16 },
          { wch: 12 },
          { wch: 22 }
        ];

        XLSX.utils.book_append_sheet(wb, wsApu, sheetName);
      });

      const safeProjName = projName.replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(wb, `Presupuesto_${safeProjName}_${displayCurrency}.xlsx`);
      setSuccessMsg('Presupuesto y APUs exportados exitosamente a Excel en ' + displayCurrency);
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      setErrorMsg('Error al generar Excel: ' + err.message);
    } finally {
      setExportingExcel(false);
    }
  };

  // --- IMPORTADOR MASIVO ---
  const handleImportCSV = async () => {
    if (!selectedProyectoId || !importText.trim()) return;
    setBudgetLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const lines = importText.split('\n');
    const records = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 2) continue;

      records.push({
        presupuesto_id: selectedProyectoId,
        codigo: parts[0].trim(),
        partida: parts[1].trim(),
        unidad: parts[2] ? parts[2].trim() : 'un',
        cantidad: parts[3] ? parseFloat(parts[3].trim()) || 0 : 0,
        costo_unitario: parts[4] ? parseFloat(parts[4].trim()) || 0 : 0,
        rendimiento_meta: parts[5] ? parseFloat(parts[5].trim()) || 0 : 0
      });
    }

    if (records.length === 0) {
      setErrorMsg('No se encontraron registros válidos para importar.');
      setBudgetLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('presupuestos_items')
        .insert(records);

      if (error) throw error;

      setSuccessMsg(`Se ingresaron e importaron ${records.length} partidas al presupuesto.`);
      setImportText('');
      setActiveSection('crear');
      fetchBudgetItems(selectedProyectoId);
      fetchCronograma(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al importar: ' + err.message);
    } finally {
      setBudgetLoading(false);
    }
  };

  // --- TAB: DIAGRAMA GANTT ---
  const handleAddMilestoneRow = () => {
    let nextCode = 'H-1';
    const existingHitos = cronograma.filter(t => t.codigo && t.codigo.startsWith('H-'));
    if (existingHitos.length > 0) {
      const last = existingHitos[existingHitos.length - 1];
      const num = parseInt(last.codigo.replace('H-', ''), 10);
      if (!isNaN(num)) nextCode = `H-${num + 1}`;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const newRow = {
      id: 'temp-' + Date.now() + Math.random(),
      presupuesto_id: selectedProyectoId,
      codigo: nextCode,
      tarea: 'Nuevo Hito',
      fecha_inicio: todayStr,
      duracion: 0,
      fecha_fin: todayStr,
      predecesora: '',
      predecesora_code: '',
      predecesora_tipo: 'FC',
      predecesora_desfase: 0,
      porcentaje_avance: 0,
      responsable: '',
      estado: 'slate', // default color code for milestone
      is_partida: false
    };
    setCronograma([...cronograma, newRow]);
  };

  const handleUpdateCronogramaField = (id, field, value) => {
    setErrorMsg(''); // Limpiar errores previos
    setCronograma(prev => {
      let list = prev.map(task => {
        if (task.id === id) {
          let updated = { ...task, [field]: value };

          // Mantener sincronizado el string 'predecesora' cuando se editen los subcampos
          if (field === 'predecesora_code' || field === 'predecesora_tipo' || field === 'predecesora_desfase') {
            const code = field === 'predecesora_code' ? value : (task.predecesora_code || '');
            const tipo = field === 'predecesora_tipo' ? value : (task.predecesora_tipo || 'FC');
            const lag = parseInt(field === 'predecesora_desfase' ? value : (task.predecesora_desfase || 0), 10) || 0;
            
            updated.predecesora_code = code;
            updated.predecesora_tipo = tipo;
            updated.predecesora_desfase = lag;
            updated.predecesora = code ? `${code}${tipo}${lag >= 0 ? '+' : ''}${lag}` : '';
          }

          if (field === 'fecha_inicio' || field === 'duracion') {
            const start = field === 'fecha_inicio' ? value : task.fecha_inicio;
            const dur = field === 'duracion' ? value : task.duracion;
            updated.fecha_fin = calculateEndDateWithCalendar(start, dur, calendarConfig);
          }
          return updated;
        }
        return task;
      });

      // Validar si la predecesora ingresada existe
      let hasInvalidPredecessor = false;
      let invalidDetails = '';

      // Transitive predecessors resolution
      let changed = true;
      let passes = 0;
      const maxPasses = 15;
      
      while (changed && passes < maxPasses) {
        changed = false;
        passes++;
        list = list.map(task => {
          if (task.predecesora_code) {
            const targetNormalized = normalizeTaskCode(task.predecesora_code);
            const predTask = list.find(x => normalizeTaskCode(x.codigo) === targetNormalized);
            
            if (predTask) {
              if (predTask.fecha_fin && predTask.fecha_inicio) {
                let baseDate;
                const lag = parseInt(task.predecesora_desfase, 10) || 0;
                if (task.predecesora_tipo === 'CC') {
                  baseDate = new Date(predTask.fecha_inicio + 'T00:00:00');
                  baseDate.setDate(baseDate.getDate() + lag);
                } else {
                  baseDate = new Date(predTask.fecha_fin + 'T00:00:00');
                  baseDate.setDate(baseDate.getDate() + 1 + lag);
                }
                
                const expectedStartStr = baseDate.toISOString().split('T')[0];
                
                if (task.fecha_inicio !== expectedStartStr) {
                  const newEnd = calculateEndDateWithCalendar(expectedStartStr, task.duracion, calendarConfig);
                  changed = true;
                  return {
                    ...task,
                    fecha_inicio: expectedStartStr,
                    fecha_fin: newEnd
                  };
                }
              }
            } else {
              hasInvalidPredecessor = true;
              invalidDetails = `La predecesora '${task.predecesora_code}' de la tarea '${task.tarea}' no existe en este proyecto.`;
            }
          }
          return task;
        });
      }

      if (passes >= maxPasses) {
        setTimeout(() => setErrorMsg('Error: Se ha detectado una dependencia circular o bucle infinito entre las predecesoras. Los plazos no se pudieron recalcular.'), 0);
      } else if (hasInvalidPredecessor) {
        setTimeout(() => setErrorMsg(`Alerta: ${invalidDetails}`), 0);
      }

      return list;
    });
  };

  const handleSaveCalendarConfig = async (newConfig) => {
    if (!selectedProyectoId || !currentProyecto) return;
    setTasksLoading(true);
    try {
      const userDesc = parseProjectDescriptionAndCalendar(currentProyecto.descripcion).userDesc;
      const serializedDesc = serializeProjectDescriptionAndCalendar(userDesc, newConfig);
      
      const { error } = await supabase
        .from('presupuestos_proyectos')
        .update({ descripcion: serializedDesc })
        .eq('id', selectedProyectoId);
      
      if (error) throw error;
      
      setCalendarConfig(newConfig);
      setSuccessMsg('Configuración de calendario guardada y plazos recalculados.');
      
      // Update local projects list to reflect the updated description
      setProyectos(prev => prev.map(p => {
        if (p.id === parseInt(selectedProyectoId, 10)) {
          return { ...p, descripcion: serializedDesc };
        }
        return p;
      }));

      // Force recalculation of all tasks in the cronograma
      setCronograma(prev => prev.map(task => {
        if (task.is_chapter) return task;
        const start = task.fecha_inicio;
        const dur = task.duracion;
        const end = calculateEndDateWithCalendar(start, dur, newConfig);
        return { ...task, fecha_fin: end };
      }));
    } catch (err) {
      setErrorMsg('Error al guardar calendario: ' + err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleDeleteCronogramaRow = (id) => {
    setCronograma(prev => prev.filter(t => t.id !== id));
  };

  const handleSaveCronograma = async () => {
    if (!selectedProyectoId) return;
    setTasksLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const resolveChapterTask = (chapter, list) => {
        const children = list.filter(t => t.codigo && t.codigo !== chapter.codigo && t.codigo.startsWith(chapter.codigo + '.'));
        if (children.length === 0) return { ...chapter, is_chapter: true };
        
        let minStart = null;
        let maxEnd = null;
        let totalAvance = 0;
        let childrenCount = 0;

        children.forEach(c => {
          if (c.fecha_inicio) {
            if (!minStart || c.fecha_inicio < minStart) minStart = c.fecha_inicio;
          }
          if (c.fecha_fin) {
            if (!maxEnd || c.fecha_fin > maxEnd) maxEnd = c.fecha_fin;
          }
          totalAvance += parseFloat(c.porcentaje_avance) || 0;
          childrenCount++;
        });

        const calculatedStart = minStart || chapter.fecha_inicio;
        const calculatedEnd = maxEnd || chapter.fecha_fin;
        
        let calculatedDuration = chapter.duracion;
        if (minStart && maxEnd) {
          const s = new Date(minStart + 'T00:00:00');
          const e = new Date(maxEnd + 'T00:00:00');
          calculatedDuration = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
        }

        const calculatedAvance = childrenCount > 0 ? Math.round(totalAvance / childrenCount) : 0;

        return {
          ...chapter,
          fecha_inicio: calculatedStart,
          fecha_fin: calculatedEnd,
          duracion: calculatedDuration,
          porcentaje_avance: calculatedAvance,
          is_chapter: true
        };
      };

      const resolvedList = cronograma.map(task => {
        const isChapter = isChapterRow(task, cronograma);
        if (isChapter) {
          return resolveChapterTask(task, cronograma);
        }
        return { ...task, is_chapter: false };
      });

      const toUpdate = resolvedList.filter(t => typeof t.id === 'number');
      const toInsert = resolvedList
        .filter(t => typeof t.id === 'string' && t.id.startsWith('temp-'))
        .map(t => {
          const { 
            id, 
            is_partida, 
            is_chapter, 
            cantidad, 
            rendimiento_meta, 
            predecesora_code, 
            predecesora_tipo, 
            predecesora_desfase, 
            ...rest 
          } = t;
          return {
            ...rest,
            presupuesto_id: selectedProyectoId,
            duracion: isNaN(parseInt(rest.duracion, 10)) ? 0 : parseInt(rest.duracion, 10)
          };
        });

      const { data: dbCurrent, error: dbErr } = await supabase
        .from('planificacion_cronogramas')
        .select('id')
        .eq('presupuesto_id', selectedProyectoId);

      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('planificacion_cronogramas')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from('planificacion_cronogramas')
          .update({
            codigo: item.codigo,
            tarea: item.tarea,
            fecha_inicio: item.fecha_inicio,
            fecha_fin: item.fecha_fin,
            duracion: isNaN(parseInt(item.duracion, 10)) ? 0 : parseInt(item.duracion, 10),
            predecesora: item.predecesora,
            porcentaje_avance: parseFloat(item.porcentaje_avance) || 0,
            responsable: item.responsable,
            estado: item.estado
          })
          .eq('id', item.id);
        if (updErr) throw updErr;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('planificacion_cronogramas')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Planificación guardada con éxito.');
      fetchCronograma(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar planificación: ' + err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  // --- TAB: RECURSOS ---
  const handleAddResourceRow = () => {
    const newRow = {
      id: 'temp-' + Date.now() + Math.random(),
      presupuesto_id: selectedProyectoId,
      recurso: 'NUEVO RECURSO',
      tipo: 'Material',
      unidad: serializeResourceUnitAndCurrency('un', 'CLP'),
      costo_unitario: 0,
      cantidad_estimada: 0,
      ciudad: '',
      proveedor: ''
    };
    setRecursos([...recursos, newRow]);
  };

  const handleUpdateResourceField = (id, field, value) => {
    setRecursos(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSaveResources = async () => {
    if (!selectedProyectoId) return;
    setResourcesLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const toUpdate = recursos.filter(r => typeof r.id === 'number');
      const toInsert = recursos
        .filter(r => typeof r.id === 'string' && r.id.startsWith('temp-'))
        .map(r => {
          const { id, ...rest } = r;
          return { ...rest, presupuesto_id: selectedProyectoId };
        });

      const { data: dbCurrent, error: dbErr } = await supabase
        .from('recursos_presupuesto')
        .select('id')
        .eq('presupuesto_id', selectedProyectoId);

      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('recursos_presupuesto')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from('recursos_presupuesto')
          .update({
            recurso: item.recurso,
            tipo: item.tipo,
            unidad: item.unidad,
            costo_unitario: parseFloat(item.costo_unitario) || 0,
            cantidad_estimada: parseFloat(item.cantidad_estimada) || 0,
            ciudad: item.ciudad,
            proveedor: item.proveedor
          })
          .eq('id', item.id);
        if (updErr) throw updErr;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('recursos_presupuesto')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Recursos guardados exitosamente.');
      fetchRecursos(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar recursos: ' + err.message);
    } finally {
      setResourcesLoading(false);
    }
  };

  // --- LÓGICA DE COSTOS INDIRECTOS (CON OPCIÓN PRORRATEAR UNO A UNO) ---
  const handleAddIndirectCostRow = () => {
    const newRow = {
      id: 'temp-' + Date.now() + Math.random(),
      presupuesto_id: selectedProyectoId,
      concepto: 'GASTOS GENERALES',
      tipo: 'Porcentaje',
      valor: 10,
      prorratear: true
    };
    setIndirectCosts([...indirectCosts, newRow]);
  };

  const handleUpdateIndirectCostField = (id, field, value) => {
    setIndirectCosts(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteIndirectCostRow = (id) => {
    setIndirectCosts(prev => prev.filter(c => c.id !== id));
  };

  const handleSaveIndirectCosts = async () => {
    if (!selectedProyectoId) return;
    setIndirectLoading(true);
    try {
      const toUpdate = indirectCosts.filter(c => typeof c.id === 'number');
      const toInsert = indirectCosts
        .filter(c => typeof c.id === 'string' && c.id.startsWith('temp-'))
        .map(c => {
          const { id, ...rest } = c;
          return { 
            ...rest, 
            presupuesto_id: selectedProyectoId,
            prorratear: !!c.prorratear
          };
        });

      const { data: dbCurrent, error: dbErr } = await supabase
        .from('presupuestos_costos_indirectos')
        .select('id')
        .eq('presupuesto_id', selectedProyectoId);
      if (dbErr) throw dbErr;

      const dbIds = (dbCurrent || []).map(x => x.id);
      const keepIds = toUpdate.map(x => x.id);
      const toDeleteIds = dbIds.filter(id => !keepIds.includes(id));

      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('presupuestos_costos_indirectos')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      for (const item of toUpdate) {
        let { error: updErr } = await supabase
          .from('presupuestos_costos_indirectos')
          .update({
            concepto: item.concepto,
            tipo: item.tipo,
            valor: parseFloat(item.valor) || 0,
            prorratear: !!item.prorratear
          })
          .eq('id', item.id);

        if (updErr && updErr.message.includes('prorratear')) {
          const { error: fallbackErr } = await supabase
            .from('presupuestos_costos_indirectos')
            .update({
              concepto: item.concepto,
              tipo: item.tipo,
              valor: parseFloat(item.valor) || 0
            })
            .eq('id', item.id);
          if (fallbackErr) throw fallbackErr;
        } else if (updErr) {
          throw updErr;
        }
      }

      if (toInsert.length > 0) {
        let { error: insErr } = await supabase
          .from('presupuestos_costos_indirectos')
          .insert(toInsert);

        if (insErr && insErr.message.includes('prorratear')) {
          const cleanInsert = toInsert.map(({ prorratear, ...rest }) => rest);
          const { error: fallbackIns } = await supabase
            .from('presupuestos_costos_indirectos')
            .insert(cleanInsert);
          if (fallbackIns) throw fallbackIns;
        } else if (insErr) {
          throw insErr;
        }
      }

      setSuccessMsg('Costos indirectos actualizados correctamente.');
      setShowIndirectModal(false);
      fetchIndirectCosts(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar costos indirectos: ' + err.message);
    } finally {
      setIndirectLoading(false);
    }
  };

  // --- MÉTODOS DE CÁLCULO GANTT ---
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

    const diffStart = Math.round((start - base) / (1000 * 60 * 60 * 24));
    const diffEnd = Math.round((end - base) / (1000 * 60 * 60 * 24)) + 1;

    if (diffEnd <= 0 || diffStart >= ganttScale) return null;

    return {
      gridColumnStart: Math.max(0, diffStart) + 1,
      gridColumnEnd: Math.min(ganttScale, diffEnd) + 1
    };
  };

  // Helpers de Formato
  const formatCLP = (num) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num || 0);
  };

  // Totales
  const totalDirectCost = itemsPresupuesto.reduce((acc, curr) => {
    if (isChapterRow(curr, itemsPresupuesto)) return acc;
    return acc + ((parseFloat(curr.cantidad) || 0) * (parseFloat(curr.costo_unitario) || 0));
  }, 0);

  const calculateIndirectCostValue = (cost) => {
    if (cost.tipo === 'Porcentaje') {
      return totalDirectCost * (parseFloat(cost.valor) || 0) / 100;
    }
    return parseFloat(cost.valor) || 0;
  };

  // SEPARACIÓN DE COSTOS INDIRECTOS PRORRATEADOS VS NO PRORRATEADOS
  const proratedIndirectCosts = indirectCosts.filter(c => c.prorratear);
  const nonProratedIndirectCosts = indirectCosts.filter(c => !c.prorratear);

  const totalProratedIndirectValue = proratedIndirectCosts.reduce((acc, curr) => {
    return acc + calculateIndirectCostValue(curr);
  }, 0);

  const totalNonProratedIndirectValue = nonProratedIndirectCosts.reduce((acc, curr) => {
    return acc + calculateIndirectCostValue(curr);
  }, 0);

  const totalIndirectCostValue = totalProratedIndirectValue + totalNonProratedIndirectValue;
  const totalProjectCost = totalDirectCost + totalIndirectCostValue;

  // CÁLCULO DE FACTOR DE PRORRATEO PONDERADO (Solo para items marcados con prorratear = true)
  const prorateFactor = (totalDirectCost > 0 && totalProratedIndirectValue > 0)
    ? 1 + (totalProratedIndirectValue / totalDirectCost)
    : 1;

  const proratePctIncrement = ((prorateFactor - 1) * 100).toFixed(1);

  const totalResourceCost = recursos.reduce((acc, curr) => {
    const resInfo = parseResourceUnitAndCurrency(curr.unidad);
    const costInBase = convertCurrency(parseFloat(curr.costo_unitario) || 0, resInfo.moneda, projectBaseCurrency);
    return acc + ((parseFloat(curr.cantidad_estimada) || 0) * costInBase);
  }, 0);

  const getCategorizedResourceCost = (type) => {
    return recursos.filter(r => r.tipo === type).reduce((sum, r) => {
      const resInfo = parseResourceUnitAndCurrency(r.unidad);
      const costInBase = convertCurrency(parseFloat(r.costo_unitario) || 0, resInfo.moneda, projectBaseCurrency);
      return sum + ((parseFloat(r.cantidad_estimada) || 0) * costInBase);
    }, 0);
  };

  const materialCost = getCategorizedResourceCost('Material');
  const laborCost = getCategorizedResourceCost('Mano de Obra');
  const machineryCost = getCategorizedResourceCost('Maquinaria');
  const herramientasCost = getCategorizedResourceCost('Herramientas');
  const otrosCost = getCategorizedResourceCost('Otros');

  // --- ACCIONES DE APU MODAL ---
  const openApuModal = async (item) => {
    if (typeof item.id !== 'number') {
      alert("Por favor, guarda el presupuesto primero para poder analizar esta partida en detalle.");
      return;
    }
    setApuItem(item);
    setApuLoading(true);
    setShowApuModal(true);
    setShowApuConfigAccordion(true);
    setAddResourceMode('existente');
    setNewResourceForm({
      recurso: '',
      tipo: 'Material',
      unidad: 'un',
      moneda: 'CLP',
      costo_unitario: '',
      ciudad: '',
      proveedor: ''
    });

    // Rellenar formulario APU con valores guardados o por defecto
    setApuForm({
      tipo_metodologia: item.tipo_metodologia || 'Precio Unitario',
      rendimiento_meta: item.rendimiento_meta || 25,
      dias_habiles_mes: item.dias_habiles_mes || 22,
      horas_jornada: item.horas_jornada || 9,
      precio_combustible: item.precio_combustible || 1050,
      leyes_sociales_pct: item.leyes_sociales_pct !== undefined ? item.leyes_sociales_pct : 35,
      herramientas_menores_pct: item.herramientas_menores_pct !== undefined ? item.herramientas_menores_pct : 5,
      imponderables_pct: item.imponderables_pct !== undefined ? item.imponderables_pct : 5,
      tiempo_estimado: item.tiempo_estimado || 0,
      costo_materiales: item.costo_materiales || 0,
      costo_mano_obra: item.costo_mano_obra || 0,
      costo_maquinaria: item.costo_maquinaria || 0,
      costo_herramientas: item.costo_herramientas || 0,
      costo_otros: item.costo_otros || 0
    });

    try {
      if (selectedProyectoId) {
        await fetchRecursos(selectedProyectoId);
      }
      const { data, error } = await supabase
        .from('presupuestos_items_recursos')
        .select('*')
        .eq('item_id', item.id);
      if (error) throw error;
      setApuResources(data || []);
    } catch (err) {
      console.error('Error cargando recursos de partida:', err.message);
    } finally {
      setApuLoading(false);
    }
  };

  const handleAddResourceToApu = () => {
    if (!selectedAddResourceId) return;
    const resourceId = parseInt(selectedAddResourceId, 10);
    if (apuResources.some(r => String(r.recurso_id) === String(resourceId))) {
      alert("Este recurso ya está añadido en el análisis de esta partida.");
      return;
    }

    const newLink = {
      id: 'temp-apu-' + Date.now() + Math.random(),
      item_id: apuItem.id,
      recurso_id: resourceId,
      cantidad_unidad: 1,
      rendimiento: 1,
      consumo_combustible_lh: 0
    };
    setApuResources([...apuResources, newLink]);
    setSelectedAddResourceId('');
  };

  const handleCreateAndLinkNewResource = async (e) => {
    e.preventDefault();
    if (!newResourceForm.recurso.trim() || !selectedProyectoId) return;
    setApuLoading(true);

    try {
      const serializedUnit = serializeResourceUnitAndCurrency(newResourceForm.unidad, newResourceForm.moneda);
      const { data, error } = await supabase
        .from('recursos_presupuesto')
        .insert([
          {
            presupuesto_id: selectedProyectoId,
            recurso: newResourceForm.recurso.trim(),
            tipo: newResourceForm.tipo,
            unidad: serializedUnit,
            costo_unitario: parseFloat(newResourceForm.costo_unitario) || 0,
            cantidad_estimada: 1,
            ciudad: newResourceForm.ciudad,
            proveedor: newResourceForm.proveedor.trim()
          }
        ])
        .select();

      if (error) throw error;

      await fetchRecursos(selectedProyectoId);

      if (data && data.length > 0) {
        const createdRes = data[0];
        const newLink = {
          id: 'temp-apu-' + Date.now() + Math.random(),
          item_id: apuItem.id,
          recurso_id: createdRes.id,
          cantidad_unidad: 1,
          rendimiento: 1,
          consumo_combustible_lh: 0
        };
        setApuResources([...apuResources, newLink]);
      }

      setNewResourceForm({
        recurso: '',
        tipo: 'Material',
        unidad: 'un',
        moneda: 'CLP',
        costo_unitario: '',
        ciudad: '',
        proveedor: ''
      });
      setAddResourceMode('existente');
      setSuccessMsg('Nuevo recurso registrado y vinculado al presupuesto.');
    } catch (err) {
      alert('Error creando recurso: ' + err.message);
    } finally {
      setApuLoading(false);
    }
  };

  const handleUpdateApuResourceField = (id, field, value) => {
    setApuResources(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteApuResource = (id) => {
    setApuResources(prev => prev.filter(r => r.id !== id));
  };

  // CÁLCULO Y UNIFICACIÓN DE COSTOS DE APU (SOPORTE COSTO-TIEMPO & PRECIO UNITARIO)
  const calculateApuCost = () => {
    const isPU = apuForm.tipo_metodologia === 'Precio Unitario';
    const rend = isPU ? (parseFloat(apuForm.rendimiento_meta) || 1) : 1;
    const diasMes = parseFloat(apuForm.dias_habiles_mes) || 22;
    const hrsJornada = parseFloat(apuForm.horas_jornada) || 9;
    const precioDiesel = parseFloat(apuForm.precio_combustible) || 1050;
    const lsPct = parseFloat(apuForm.leyes_sociales_pct) || 0;
    const hmPct = parseFloat(apuForm.herramientas_menores_pct) || 0;
    const impPct = parseFloat(apuForm.imponderables_pct) || 0;

    let matSum = 0;
    let laborSum = 0;
    let machSum = 0;
    let herrSum = 0;
    let otrosSum = 0;

    apuResources.forEach(link => {
      const res = recursos.find(r => String(r.id) === String(link.recurso_id));
      if (!res) return;

      const qty = parseFloat(link.cantidad_unidad) || 0;
      const resRend = parseFloat(link.rendimiento) || 1;
      const originalCost = parseFloat(res.costo_unitario) || 0;
      
      const resInfo = parseResourceUnitAndCurrency(res.unidad);
      // Convertir de la moneda del recurso a la moneda base del proyecto
      const unitCost = convertCurrency(originalCost, resInfo.moneda, projectBaseCurrency);
      
      const unitStr = resInfo.unidad.toLowerCase().trim();
      const consumoLh = parseFloat(link.consumo_combustible_lh) || 0;

      if (!isPU) {
        // COSTO-TIEMPO (Cobro directo por tiempo de recursos sin rendimiento de obra)
        let fuelCost = 0;
        if (res.tipo === 'Maquinaria' && consumoLh > 0) {
          if (unitStr.includes('mes') || unitStr.includes('mensual')) {
            fuelCost = (consumoLh * hrsJornada * diasMes * precioDiesel) * qty;
          } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
            fuelCost = (consumoLh * precioDiesel) * qty;
          } else {
            fuelCost = (consumoLh * hrsJornada * precioDiesel) * qty;
          }
        }
        
        const sub = (unitCost * qty) + fuelCost;

        if (res.tipo === 'Material') matSum += sub;
        else if (res.tipo === 'Mano de Obra') laborSum += sub;
        else if (res.tipo === 'Maquinaria') machSum += sub;
        else if (res.tipo === 'Herramientas') herrSum += sub;
        else otrosSum += sub;
      } else {
        // PRECIO UNITARIO
        if (res.tipo === 'Maquinaria') {
          const isTimeUnit = unitStr.includes('mes') || unitStr.includes('mensual') || 
                             unitStr.includes('hr') || unitStr.includes('hora') || 
                             unitStr.includes('día') || unitStr.includes('dia') || unitStr.includes('jornada');

          if (isTimeUnit) {
            let dailyRate = unitCost;
            if (unitStr.includes('mes') || unitStr.includes('mensual')) {
              dailyRate = unitCost / diasMes;
            } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
              dailyRate = unitCost * hrsJornada;
            } else {
              dailyRate = unitCost;
            }

            const fuelDaily = consumoLh * hrsJornada * precioDiesel;
            const totalDailyMachineCost = dailyRate + fuelDaily;
            const unitSub = (totalDailyMachineCost * qty) / rend;
            machSum += unitSub;
          } else {
            // Tarifa directa por unidad de obra (ej: $10.200 / M3)
            const fuelDaily = consumoLh * hrsJornada * precioDiesel;
            const fuelPerUnit = rend > 0 ? (fuelDaily * qty) / rend : 0;
            const unitSub = (unitCost * qty * resRend) + fuelPerUnit;
            machSum += unitSub;
          }
        } else if (res.tipo === 'Herramientas') {
          const isTimeUnit = unitStr.includes('mes') || unitStr.includes('mensual') || 
                             unitStr.includes('hr') || unitStr.includes('hora') || 
                             unitStr.includes('día') || unitStr.includes('dia') || unitStr.includes('jornada');

          if (isTimeUnit) {
            let dailyRate = unitCost;
            if (unitStr.includes('mes') || unitStr.includes('mensual')) {
              dailyRate = unitCost / diasMes;
            } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
              dailyRate = unitCost * hrsJornada;
            } else {
              dailyRate = unitCost;
            }
            const unitSub = (dailyRate * qty) / rend;
            herrSum += unitSub;
          } else {
            const unitSub = unitCost * qty * resRend;
            herrSum += unitSub;
          }
        } else if (res.tipo === 'Mano de Obra') {
          if (unitStr.includes('mes') || unitStr.includes('mensual')) {
            const dailyRate = unitCost / diasMes;
            const unitSub = (dailyRate * qty) / rend;
            laborSum += unitSub;
          } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
            const dailyRate = unitCost * hrsJornada;
            const unitSub = (dailyRate * qty) / rend;
            laborSum += unitSub;
          } else if (unitStr.includes('día') || unitStr.includes('dia') || unitStr.includes('jornada')) {
            const unitSub = (unitCost * qty) / rend;
            laborSum += unitSub;
          } else {
            const unitSub = unitCost * qty * resRend;
            laborSum += unitSub;
          }
        } else if (res.tipo === 'Otros') {
          const unitSub = unitCost * qty * resRend;
          otrosSum += unitSub;
        } else {
          // Materiales
          const unitSub = unitCost * qty * resRend;
          matSum += unitSub;
        }
      }
    });

    const laborTotal = laborSum * (1 + (lsPct + hmPct) / 100);
    const subtotalDirecto = matSum + machSum + laborTotal + herrSum + otrosSum;
    const totalUnitario = subtotalDirecto * (1 + impPct / 100);

    return {
      totalUnitario: Math.round(totalUnitario),
      matSum: Math.round(matSum),
      laborSum: Math.round(laborSum),
      laborTotal: Math.round(laborTotal),
      machSum: Math.round(machSum),
      herrSum: Math.round(herrSum),
      otrosSum: Math.round(otrosSum),
      subtotalDirecto: Math.round(subtotalDirecto),
      impValue: Math.round(subtotalDirecto * (impPct / 100))
    };
  };

  const handleSaveApu = async () => {
    if (!apuItem) return;
    setApuLoading(true);
    try {
      const calc = calculateApuCost();
      
      let autoTiempo = parseFloat(apuForm.tiempo_estimado) || 0;
      const parsedRendimiento = parseFloat(apuForm.rendimiento_meta) || 0;
      if (parsedRendimiento > 0) {
        autoTiempo = (parseFloat(apuItem.cantidad) || 0) / parsedRendimiento;
      }

      const fullUpdatePayload = {
        tipo_metodologia: apuForm.tipo_metodologia,
        rendimiento_meta: parseFloat(apuForm.rendimiento_meta) || 0,
        dias_habiles_mes: parseFloat(apuForm.dias_habiles_mes) || 22,
        horas_jornada: parseFloat(apuForm.horas_jornada) || 9,
        precio_combustible: parseFloat(apuForm.precio_combustible) || 1050,
        leyes_sociales_pct: parseFloat(apuForm.leyes_sociales_pct) || 0,
        herramientas_menores_pct: parseFloat(apuForm.herramientas_menores_pct) || 0,
        imponderables_pct: parseFloat(apuForm.imponderables_pct) || 0,
        tiempo_estimado: autoTiempo,
        costo_materiales: calc.matSum,
        costo_mano_obra: calc.laborTotal,
        costo_maquinaria: calc.machSum,
        costo_herramientas: calc.herrSum,
        costo_otros: calc.otrosSum,
        costo_unitario: calc.totalUnitario
      };

      let { error: itemErr } = await supabase
        .from('presupuestos_items')
        .update(fullUpdatePayload)
        .eq('id', apuItem.id);

      if (itemErr && (itemErr.message.includes('schema cache') || itemErr.message.includes('column'))) {
        const { costo_otros, costo_herramientas, herramientas_menores_pct, dias_habiles_mes, horas_jornada, precio_combustible, ...basicPayload } = fullUpdatePayload;
        const { error: fallbackErr } = await supabase
          .from('presupuestos_items')
          .update(basicPayload)
          .eq('id', apuItem.id);
        if (fallbackErr) throw fallbackErr;
      } else if (itemErr) {
        throw itemErr;
      }

      // Guardar recursos vinculados
      const { error: delErr } = await supabase
        .from('presupuestos_items_recursos')
        .delete()
        .eq('item_id', apuItem.id);
      if (delErr) throw delErr;

      if (apuResources.length > 0) {
        const recordsToInsert = apuResources.map(r => ({
          item_id: apuItem.id,
          recurso_id: parseInt(r.recurso_id, 10),
          cantidad_unidad: parseFloat(r.cantidad_unidad) || 0,
          rendimiento: apuForm.tipo_metodologia === 'Costo-Tiempo' ? 1 : (parseFloat(r.rendimiento) || 1),
          consumo_combustible_lh: parseFloat(r.consumo_combustible_lh) || 0
        }));

        const { error: insErr } = await supabase
          .from('presupuestos_items_recursos')
          .insert(recordsToInsert);
        if (insErr) throw insErr;
      }

      setSuccessMsg('Análisis de partida guardado correctamente.');
      setShowApuModal(false);
      fetchBudgetItems(selectedProyectoId);
      fetchCronograma(selectedProyectoId);
    } catch (err) {
      setErrorMsg('Error al guardar APU: ' + err.message);
    } finally {
      setApuLoading(false);
    }
  };

  const handleHeaderBack = () => {
    if (activeSection !== '') {
      setActiveSection('');
      setErrorMsg('');
      setSuccessMsg('');
    } else {
      onBack();
    }
  };

  const makeSheetName = (code, title, usedSet) => {
    let raw = `${code ? code + ' ' : ''}${title || 'Partida'}`.replace(/[:\\/?*\[\]]/g, '');
    if (raw.length > 30) {
      raw = raw.substring(0, 30).trim();
    }
    let finalName = raw;
    let counter = 1;
    while (usedSet.has(finalName.toLowerCase())) {
      const suffix = `_${counter}`;
      const baseLen = 30 - suffix.length;
      finalName = raw.substring(0, baseLen) + suffix;
      counter++;
    }
    usedSet.add(finalName.toLowerCase());
    return finalName;
  };

  const isWorkspaceActive = activeSection !== '' && activeSection !== 'mis_presupuestos';
  const showBlockerGate = isWorkspaceActive && !selectedProyectoId;

  return (
    <div className="space-y-6">
      
      {/* 1. Cabecera Principal */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={handleHeaderBack} className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer" title="Volver">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight font-sans">Presupuestos</h2>
            <p className="text-[10px] text-slate-455 font-bold uppercase mt-0.5">Control de costos, diagramas Gantt y asignación de recursos independientes</p>
          </div>
        </div>

        {/* Controles de Selección */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Proyecto Activo:</span>
            {loadingProyectos ? (
              <span className="text-xs text-slate-400">Cargando...</span>
            ) : proyectos.length === 0 ? (
              <span className="text-xs text-slate-400 italic">Ninguno</span>
            ) : (
              <select
                value={selectedProyectoId}
                onChange={(e) => {
                  setSelectedProyectoId(e.target.value);
                  setActiveSection('');
                }}
                className="bg-transparent text-xs font-bold text-slate-850 focus:outline-none cursor-pointer uppercase border-0 p-0"
              >
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {selectedProyectoId && itemsPresupuesto.length > 0 && (
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50"
              title="Descargar Presupuesto y APUs en Excel multi-hoja"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>{exportingExcel ? 'Generando Excel...' : 'Descargar Excel'}</span>
            </button>
          )}

          <button
            onClick={() => setShowCreateProjectModal(true)}
            className="flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary-hover transition cursor-pointer shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Nuevo Proyecto</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Indicadores Financieros Oficiales (UF, Dólar, UTM) */}
      <div className="bg-slate-900 text-white rounded-3xl p-3 px-6 flex flex-wrap justify-between items-center gap-4 shadow-sm animate-in fade-in duration-200">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-350 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>Indicadores Financieros Oficiales</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-xs font-black">
          <div className="flex items-center gap-2">
            <span className="text-slate-450 text-[10px] font-bold">VALOR UF:</span>
            <span className="text-amber-400 font-black">{loadingRates ? 'Cargando...' : formatCLP(exchangeRates.UF)}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-6">
            <span className="text-slate-455 text-[10px] font-bold">DÓLAR (USD):</span>
            <span className="text-emerald-400 font-black">{loadingRates ? 'Cargando...' : formatCLP(exchangeRates.USD)}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-6">
            <span className="text-slate-450 text-[10px] font-bold">UTM:</span>
            <span className="text-blue-400 font-black">{loadingRates ? 'Cargando...' : formatCLP(exchangeRates.UTM)}</span>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {successMsg && <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold border border-emerald-250 animate-in fade-in duration-150">{successMsg}</div>}
      {errorMsg && <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-xs font-semibold border border-red-250 animate-in fade-in duration-150">{errorMsg}</div>}

      <div className="space-y-6">
        
        {/* Ficha Resumen */}
        {currentProyecto && !showBlockerGate && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Cliente / Mandante</span>
              <p className="text-xs font-extrabold text-slate-800 truncate uppercase">{currentProyecto.cliente || 'No asignado'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Dirección / Faena</span>
              <p className="text-xs font-extrabold text-slate-800 truncate uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{currentProyecto.ubicacion || 'No asignada'}</span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Comuna (Chile)</span>
              <p className="text-xs font-extrabold text-slate-850 uppercase">{currentProyecto.comuna || 'No asignada'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Tipo Proyecto & Moneda Base</span>
              <p className="text-xs font-extrabold text-slate-850 uppercase flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${parseProjectTipoAndCurrency(currentProyecto.tipo_proyecto).tipo === 'Público' ? 'bg-blue-650' : 'bg-emerald-650'}`} />
                <span>{parseProjectTipoAndCurrency(currentProyecto.tipo_proyecto).tipo}</span>
                <span className="bg-slate-100 text-slate-700 font-black text-[9px] px-1.5 py-0.5 rounded-md border">
                  {projectBaseCurrency}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Plazo de Entrega</span>
              <p className="text-xs font-extrabold text-slate-800 truncate flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{currentProyecto.plazo_estimado ? `${currentProyecto.plazo_estimado} Días` : 'Sin límite'}</span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Presupuesto Límite ({projectBaseCurrency})</span>
              <p className="text-xs font-extrabold text-slate-850 truncate">
                {currentProyecto.presupuesto_estimado ? formatCurrencyValue(currentProyecto.presupuesto_estimado, projectBaseCurrency) : 'Sin límite'}
              </p>
            </div>
          </div>
        )}

        {/* BLOCKER GATE */}
        {showBlockerGate ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-xs max-w-xl mx-auto space-y-5 py-12 animate-in fade-in duration-200">
            <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Requiere Proyecto Activo</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Para poder interactuar con las planillas, importar presupuestos o planificar etapas de trabajo, primero debes seleccionar o crear un proyecto de construcción.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {proyectos.length > 0 && (
                <div className="w-full sm:w-auto">
                  <select
                    value={selectedProyectoId}
                    onChange={(e) => setSelectedProyectoId(e.target.value)}
                    className="border border-slate-250 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 uppercase focus:outline-none focus:border-primary bg-white cursor-pointer w-full"
                  >
                    <option value="">Selecciona Proyecto...</option>
                    {proyectos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={() => setShowCreateProjectModal(true)}
                className="flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-primary-hover transition w-full sm:w-auto cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Crear Nuevo Proyecto</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* VISTA A: RECTÁNGULOS */}
            {activeSection === '' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Card 1: Mis Presupuestos */}
                <div 
                  onClick={() => { setActiveSection('mis_presupuestos'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Mis Presupuestos
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Visualiza el listado completo de presupuestos creados, controla su estado de avance y cárgalos para seguir editando.
                    </p>
                  </div>
                </div>

                {/* Card 2: Crear Presupuesto */}
                <div 
                  onClick={() => { setActiveSection('crear'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Crear Presupuesto
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Estructura y edita la planilla de partidas bajo metodologías de Precio Unitario (con rendimiento) o Costo-Tiempo (arriendos).
                    </p>
                  </div>
                </div>

                {/* Card 3: Ingresar Presupuesto */}
                <div 
                  onClick={() => { setActiveSection('ingresar'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Ingresar Presupuesto (Carga Masiva)
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Importa rápidamente tu presupuesto estructurado pegando textos y datos tabulados o separados por comas.
                    </p>
                  </div>
                </div>

                {/* Card 4: Diagrama Gantt */}
                <div 
                  onClick={() => { setActiveSection('gantt'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Diagrama Gantt
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Programa etapas de trabajo, asigna predecesoras para encadenamiento automático y visualiza el cronograma mediante diagrama Gantt.
                    </p>
                  </div>
                </div>

                {/* Card 5: Recursos */}
                <div 
                  onClick={() => { setActiveSection('recursos'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <Hammer className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Recursos
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Controla y desglosa los insumos necesarios clasificados en Materiales, Mano de Obra, Maquinaria, Herramientas y Otros con su Comuna y Proveedor.
                    </p>
                  </div>
                </div>

                {/* Card 6: Análisis de Presupuestos */}
                <div 
                  onClick={() => { setActiveSection('analisis'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition">
                      Análisis de presupuestos
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Revisa la distribución de costos por categorías, simula flujos de caja con anticipos y retenciones, y visualiza curvas S financieras del proyecto.
                    </p>
                  </div>
                </div>

                {/* Card 7: Importación Inteligente con IA */}
                <div 
                  onClick={() => { setActiveSection('importar_ia'); setErrorMsg(''); setSuccessMsg(''); setImportAIError(''); setParsedAIBudget(null); }}
                  className="group bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-start gap-5 min-h-[140px]"
                >
                  <div className="p-4 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wider group-hover:text-primary transition flex items-center gap-1.5">
                      Importación con IA <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-black tracking-normal uppercase">Nuevo</span>
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal">
                      Sube presupuestos en formato Excel, PDF, imágenes o texto y genera de forma automática la planilla completa usando Inteligencia Artificial.
                    </p>
                  </div>
                </div>


              </div>
            ) : (
              /* VISTA B: APARTADO INDIVIDUAL */
              <div className="space-y-6">
                
                {/* Barra superior */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white p-4 border border-slate-200 rounded-2xl shadow-xs gap-3">
                  <button
                    onClick={() => { setActiveSection(''); setErrorMsg(''); setSuccessMsg(''); }}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-850 font-bold cursor-pointer transition mr-auto"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Volver al menú de apartados</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {activeSection === 'crear' && (
                      <>
                        {/* Selector de Moneda de Emisión / Visualización */}
                        <div className="flex items-center gap-1.5 bg-slate-100 border rounded-xl px-3.5 py-2">
                          <Coins className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-[10px] font-black uppercase text-slate-500">Moneda Emisión:</span>
                          <select
                            value={displayCurrency}
                            onChange={(e) => setDisplayCurrency(e.target.value)}
                            className="bg-transparent text-xs font-black text-slate-800 border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
                          >
                            <option value="CLP">CLP ($)</option>
                            <option value="USD">USD ($)</option>
                            <option value="UF">UF</option>
                          </select>
                        </div>

                        <button
                          onClick={handleExportExcel}
                          disabled={exportingExcel}
                          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
                          title="Descargar Presupuesto y APUs en Excel multi-hoja"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                          <span>{exportingExcel ? 'Generando...' : 'Descargar Excel'}</span>
                        </button>

                        <button
                          onClick={() => setShowIndirectModal(true)}
                          className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Sliders className="w-4 h-4 text-primary" />
                          <span>Costos Generales {proratedIndirectCosts.length > 0 ? `(+${proratePctIncrement}% Prorrateado)` : ''}</span>
                        </button>

                        <button
                          onClick={handleSaveBudget}
                          disabled={budgetLoading}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>{budgetLoading ? 'Guardando...' : 'Guardar Presupuesto'}</span>
                        </button>
                      </>
                    )}
                    {activeSection === 'gantt' && (
                      <button
                        onClick={handleSaveCronograma}
                        disabled={tasksLoading}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{tasksLoading ? 'Guardando...' : 'Guardar Planificación'}</span>
                      </button>
                    )}
                    {activeSection === 'recursos' && (
                      <button
                        onClick={handleSaveResources}
                        disabled={resourcesLoading}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{resourcesLoading ? 'Guardando...' : 'Guardar Recursos'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* CREAR PRESUPUESTO */}
                {activeSection === 'crear' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex flex-wrap items-center gap-6">
                        <div>
                          <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Costo Directo Subtotal ({displayCurrency})</h4>
                          <p className="text-xl font-black text-slate-850 mt-0.5">
                            {formatCurrencyValue(convertCurrency(totalDirectCost, projectBaseCurrency, displayCurrency), displayCurrency)}
                          </p>
                        </div>
                        {proratedIndirectCosts.length > 0 && (
                          <div className="border-l border-slate-200 pl-6">
                            <h4 className="text-[10px] text-purple-700 font-bold uppercase tracking-wider flex items-center gap-1">
                              <PieChart className="w-3 h-3 text-purple-600" />
                              <span>Factor Prorrateo Ponderado</span>
                            </h4>
                            <p className="text-xl font-black text-purple-900 mt-0.5">+{proratePctIncrement}%</p>
                          </div>
                        )}
                        <div className="border-l border-slate-200 pl-6">
                          <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total General Presupuesto ({displayCurrency})</h4>
                          <p className="text-xl font-black text-primary mt-0.5">
                            {formatCurrencyValue(convertCurrency(totalProjectCost, projectBaseCurrency, displayCurrency), displayCurrency)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleAddBudgetRow}
                        className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-primary" />
                        <span>Añadir Partida</span>
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none">
                              <th className="p-3.5 w-24">Código</th>
                              <th className="p-3.5">Concepto / Partida</th>
                              <th className="p-3.5 w-20">Unidad</th>
                              <th className="p-3.5 w-28">Cant. / Tiempo</th>
                              <th className="p-3.5 w-44">
                                {proratedIndirectCosts.length > 0 ? `P. Unit. Prorrateado (${displayCurrency})` : `P. Unit. Directo (${displayCurrency})`}
                              </th>
                              <th className="p-3.5 w-44">Importe ({displayCurrency})</th>
                              <th className="p-3.5 w-36 text-center">Metodología</th>
                              <th className="p-3.5 w-24 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150">
                            {itemsPresupuesto.map((item) => {
                              const isChapter = isChapterRow(item, itemsPresupuesto);
                              const directPriceInBase = parseFloat(item.costo_unitario) || 0;
                              const isProratedActive = prorateFactor > 1;
                              const effectivePriceInBase = isProratedActive ? (directPriceInBase * prorateFactor) : directPriceInBase;

                              // Conversión a Moneda de Visualización
                              const effectivePriceInDisplay = convertCurrency(effectivePriceInBase, projectBaseCurrency, displayCurrency);
                              
                              const chapterSumInBase = isChapter 
                                ? getChapterSum(item.codigo, itemsPresupuesto, isProratedActive, prorateFactor) 
                                : 0;
                              const chapterSumInDisplay = convertCurrency(chapterSumInBase, projectBaseCurrency, displayCurrency);

                              const importeInDisplay = isChapter
                                ? chapterSumInDisplay
                                : (parseFloat(item.cantidad) || 0) * effectivePriceInDisplay;

                              const isIndent = item.codigo && item.codigo.includes('.');
                              const isCostoTiempo = item.tipo_metodologia === 'Costo-Tiempo';

                              return (
                                <tr 
                                  key={item.id}
                                  className={`transition ${isChapter ? 'bg-slate-100/80 font-bold' : 'hover:bg-slate-50/40'}`}
                                >
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.codigo || ''}
                                      onChange={(e) => handleUpdateBudgetField(item.id, 'codigo', e.target.value)}
                                      placeholder="01.01"
                                      className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 ${isChapter ? 'font-black' : ''}`}
                                    />
                                  </td>
                                  <td className="p-2">
                                    <div className="flex items-center gap-1">
                                      {isIndent && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />}
                                      <input
                                        type="text"
                                        value={item.partida || ''}
                                        onChange={(e) => handleUpdateBudgetField(item.id, 'partida', e.target.value)}
                                        placeholder="ej: Fundaciones"
                                        className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 uppercase ${isChapter ? 'font-extrabold text-slate-900' : 'text-slate-700'}`}
                                      />
                                    </div>
                                  </td>
                                  <td className="p-2">
                                    {!isChapter && (
                                      <input
                                        type="text"
                                        value={item.unidad || ''}
                                        onChange={(e) => handleUpdateBudgetField(item.id, 'unidad', e.target.value)}
                                        placeholder={isCostoTiempo ? 'días' : 'm3'}
                                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-600 text-center uppercase"
                                      />
                                    )}
                                  </td>
                                  <td className="p-2">
                                    {!isChapter && (
                                      <input
                                        type="number"
                                        step="any"
                                        value={item.cantidad ?? ''}
                                        onChange={(e) => handleUpdateBudgetField(item.id, 'cantidad', e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 font-semibold"
                                      />
                                    )}
                                  </td>
                                  <td className="p-2">
                                    {!isChapter && (
                                      <div className="relative flex items-center">
                                        <input
                                          type="text"
                                          value={displayCurrency === 'CLP' ? Math.round(effectivePriceInDisplay) : effectivePriceInDisplay.toFixed(4)}
                                          onChange={(e) => {
                                            if (!isProratedActive && typeof item.id !== 'number') {
                                              // Convertir el input (que está en displayCurrency) a la base del proyecto
                                              const enteredVal = parseFloat(e.target.value) || 0;
                                              const baseVal = convertCurrency(enteredVal, displayCurrency, projectBaseCurrency);
                                              handleUpdateBudgetField(item.id, 'costo_unitario', baseVal);
                                            }
                                          }}
                                          placeholder="0"
                                          disabled={typeof item.id === 'number' || isProratedActive}
                                          className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs font-bold ${
                                            isProratedActive 
                                              ? 'text-purple-900 bg-purple-50/60 rounded px-1.5 font-black' 
                                              : typeof item.id === 'number' 
                                                ? 'text-slate-500 cursor-not-allowed bg-slate-50/50' 
                                                : 'text-slate-700'
                                          }`}
                                        />
                                        {isProratedActive && (
                                          <span className="text-[8.5px] font-black text-purple-700 bg-purple-100 px-1 py-0.5 rounded ml-1 shrink-0" title={`Precio Directo Base: ${formatCurrencyValue(directPriceInBase, projectBaseCurrency)}`}>
                                            +{proratePctIncrement}%
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3.5 font-bold text-slate-800">
                                    {formatCurrencyValue(importeInDisplay, displayCurrency)}
                                  </td>
                                  <td className="p-2 text-center">
                                    {!isChapter && (
                                      <span className={`inline-flex items-center gap-1 text-[9.5px] font-extrabold px-2.5 py-1 rounded-full border uppercase ${
                                        isCostoTiempo 
                                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}>
                                        {isCostoTiempo ? 'Costo-Tiempo' : 'Precio Unitario'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      {!isChapter && (
                                        <button
                                          onClick={() => openApuModal(item)}
                                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition"
                                          title="Análisis de Partida / Recursos"
                                        >
                                          <Settings className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteBudgetRow(item.id)}
                                        className="p-1.5 text-red-655 hover:bg-red-50 rounded-lg transition"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* PIE DE PÁGINA TOTALES */}
                            {itemsPresupuesto.length > 0 && (
                              <>
                                <tr className="bg-slate-50/50 font-bold border-t-2 border-slate-300">
                                  <td colSpan="5" className="p-3.5 text-right uppercase text-[10px] text-slate-500 font-extrabold tracking-wider">Costo Directo Total:</td>
                                  <td className="p-3.5 text-slate-850 font-black text-sm">
                                    {formatCurrencyValue(convertCurrency(totalDirectCost, projectBaseCurrency, displayCurrency), displayCurrency)}
                                  </td>
                                  <td colSpan="2"></td>
                                </tr>
                                
                                {proratedIndirectCosts.length > 0 && (
                                  <tr className="bg-purple-50/40 border-t border-purple-200 text-purple-900 font-bold">
                                    <td colSpan="8" className="p-3 text-center text-xs">
                                      <span className="inline-flex items-center gap-1.5 font-extrabold">
                                        <PieChart className="w-4 h-4 text-purple-600" />
                                        <span>Costos Generales Prorrateados (+{proratePctIncrement}% = {formatCurrencyValue(convertCurrency(totalProratedIndirectValue, projectBaseCurrency, displayCurrency), displayCurrency)}): {proratedIndirectCosts.map(c => c.concepto).join(', ')}</span>
                                      </span>
                                    </td>
                                  </tr>
                                )}

                                {nonProratedIndirectCosts.map((cost) => {
                                  const costValInBase = calculateIndirectCostValue(cost);
                                  const costValInDisplay = convertCurrency(costValInBase, projectBaseCurrency, displayCurrency);
                                  return (
                                    <tr key={cost.id} className="bg-slate-50/30 text-slate-655 font-semibold border-t border-slate-200">
                                      <td colSpan="5" className="p-3 text-right uppercase text-[9px] font-bold text-slate-450 tracking-wider">
                                        {cost.concepto} ({cost.tipo === 'Porcentaje' ? `${cost.valor}%` : 'Monto Fijo'}):
                                      </td>
                                      <td className="p-3 text-slate-800 font-bold">
                                        {formatCurrencyValue(costValInDisplay, displayCurrency)}
                                      </td>
                                      <td colSpan="2"></td>
                                    </tr>
                                  );
                                })}

                                <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
                                  <td colSpan="5" className="p-3.5 text-right uppercase text-xs text-slate-700 tracking-wider">Total General del Presupuesto:</td>
                                  <td className="p-3.5 text-primary font-black text-base">
                                    {formatCurrencyValue(convertCurrency(totalProjectCost, projectBaseCurrency, displayCurrency), displayCurrency)}
                                  </td>
                                  <td colSpan="2"></td>
                                </tr>
                              </>
                            )}

                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* INGRESAR PRESUPUESTO */}
                {activeSection === 'ingresar' && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Upload className="w-5 h-5 text-primary" />
                      <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Ingresar Presupuesto (Carga Masiva)</h3>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Copia y pega partidas directamente desde otro sistema o planilla de cálculo en el cuadro de texto.
                    </p>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-[10px] font-semibold text-slate-500 space-y-2">
                      <span className="font-bold text-slate-850 block">Formato aceptado (valores en {projectBaseCurrency}):</span>
                      <code className="bg-white px-2 py-1 rounded border font-mono block text-slate-800">
                        Código, Concepto, Unidad, Cantidad, CostoUnitario, Rendimiento
                      </code>
                    </div>

                    <textarea
                      rows="8"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Pega las líneas aquí..."
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-primary font-mono bg-slate-50/50"
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={handleImportCSV}
                        disabled={budgetLoading || !importText.trim()}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>Procesar e Importar</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* DIAGRAMA GANTT */}
                {activeSection === 'gantt' && (() => {
                  const resolveChapterTask = (chapter, list) => {
                    const children = list.filter(t => t.codigo && t.codigo !== chapter.codigo && t.codigo.startsWith(chapter.codigo + '.'));
                    if (children.length === 0) return { ...chapter, is_chapter: true };
                    
                    let minStart = null;
                    let maxEnd = null;
                    let totalAvance = 0;
                    let childrenCount = 0;

                    children.forEach(c => {
                      if (c.fecha_inicio) {
                        if (!minStart || c.fecha_inicio < minStart) minStart = c.fecha_inicio;
                      }
                      if (c.fecha_fin) {
                        if (!maxEnd || c.fecha_fin > maxEnd) maxEnd = c.fecha_fin;
                      }
                      totalAvance += parseFloat(c.porcentaje_avance) || 0;
                      childrenCount++;
                    });

                    const calculatedStart = minStart || chapter.fecha_inicio;
                    const calculatedEnd = maxEnd || chapter.fecha_fin;
                    
                    let calculatedDuration = chapter.duracion;
                    if (minStart && maxEnd) {
                      const s = new Date(minStart + 'T00:00:00');
                      const e = new Date(maxEnd + 'T00:00:00');
                      calculatedDuration = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    }

                    const calculatedAvance = childrenCount > 0 ? Math.round(totalAvance / childrenCount) : 0;

                    return {
                      ...chapter,
                      fecha_inicio: calculatedStart,
                      fecha_fin: calculatedEnd,
                      duracion: calculatedDuration,
                      porcentaje_avance: calculatedAvance,
                      is_chapter: true
                    };
                  };

                  const resolvedCronograma = cronograma.map(task => {
                    const isChapter = isChapterRow(task, cronograma);
                    if (isChapter) {
                      return resolveChapterTask(task, cronograma);
                    }
                    return { ...task, is_chapter: false };
                  });

                  return (
                    <div className="space-y-6">
                      
                      {/* Panel de Configuración de Calendario y Eficiencias */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                            <CalendarDays className="w-4.5 h-4.5 text-primary" />
                            <span>Calendario Laboral & Eficiencia</span>
                          </h4>
                          <span className="text-[9px] bg-slate-100 text-slate-500 font-extrabold uppercase px-2 py-0.5 rounded border">
                            Configuración Activa
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
                          {/* JORNADA Y TURNOS */}
                          <div className="md:col-span-4 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <h5 className="font-extrabold uppercase text-[10px] text-slate-500 tracking-wider">Jornada de Trabajo</h5>
                            
                            <label className="flex items-center gap-2 font-semibold cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={calendarConfig.trabajaSabado}
                                onChange={(e) => handleSaveCalendarConfig({ ...calendarConfig, trabajaSabado: e.target.checked })}
                                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                              />
                              <span>Considerar Sábados como Laboral</span>
                            </label>

                            <label className="flex items-center gap-2 font-semibold cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={calendarConfig.trabajaDomingo}
                                onChange={(e) => handleSaveCalendarConfig({ ...calendarConfig, trabajaDomingo: e.target.checked })}
                                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                              />
                              <span>Considerar Domingos como Laboral</span>
                            </label>

                            <div className="pt-1.5 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Horas Turno/Día:</span>
                              <input
                                type="number"
                                min="1"
                                max="24"
                                value={calendarConfig.turnoHoras ?? 9}
                                onChange={(e) => handleSaveCalendarConfig({ ...calendarConfig, turnoHoras: parseInt(e.target.value, 10) || 9 })}
                                className="w-16 border border-slate-250 rounded-lg p-1 text-center font-bold text-slate-800 bg-white"
                              />
                            </div>
                          </div>

                          {/* FERIADOS / FESTIVOS */}
                          <div className="md:col-span-4 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <h5 className="font-extrabold uppercase text-[10px] text-slate-500 tracking-wider">Feriados / Días No Laborables</h5>
                            
                            <div className="flex gap-2">
                              <input
                                type="date"
                                id="new-holiday-input"
                                className="flex-1 border border-slate-250 rounded-lg p-1 bg-white text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById('new-holiday-input');
                                  const dateVal = el?.value;
                                  if (dateVal && !calendarConfig.feriados.includes(dateVal)) {
                                    const updated = { ...calendarConfig, feriados: [...calendarConfig.feriados, dateVal].sort() };
                                    handleSaveCalendarConfig(updated);
                                    if (el) el.value = '';
                                  }
                                }}
                                className="bg-primary text-white font-bold px-3 py-1 rounded-lg text-xs hover:bg-primary-hover transition shrink-0 cursor-pointer"
                              >
                                + Agregar
                              </button>
                            </div>

                            <div className="max-h-[90px] overflow-y-auto space-y-1 pr-1 border rounded-lg bg-white p-1.5">
                              {calendarConfig.feriados.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic text-center py-2">Sin feriados registrados</p>
                              ) : (
                                calendarConfig.feriados.map(d => (
                                  <div key={d} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded-md border text-[10px] font-bold">
                                    <span className="font-mono text-slate-700">{d}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = { ...calendarConfig, feriados: calendarConfig.feriados.filter(x => x !== d) };
                                        handleSaveCalendarConfig(updated);
                                      }}
                                      className="text-red-500 hover:text-red-700 font-bold px-1"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* EFICIENCIAS MENORES / RESTRICCIONES */}
                          <div className="md:col-span-4 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <h5 className="font-extrabold uppercase text-[10px] text-slate-500 tracking-wider">Rendimiento / Eficiencia Especial</h5>
                            
                            <div className="flex flex-col gap-1.5 bg-white p-2 rounded-xl border border-slate-200">
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  id="new-eff-date"
                                  className="flex-1 border border-slate-250 rounded-lg p-1 text-[11px]"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  defaultValue="50"
                                  id="new-eff-pct"
                                  placeholder="%"
                                  className="w-14 border border-slate-250 rounded-lg p-1 text-center font-bold"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const dateEl = document.getElementById('new-eff-date');
                                  const pctEl = document.getElementById('new-eff-pct');
                                  const dateVal = dateEl?.value;
                                  const pctVal = parseInt(pctEl?.value, 10);
                                  if (dateVal && !isNaN(pctVal)) {
                                    const updated = {
                                      ...calendarConfig,
                                      eficienciasEspeciales: {
                                        ...calendarConfig.eficienciasEspeciales,
                                        [dateVal]: pctVal
                                      }
                                    };
                                    handleSaveCalendarConfig(updated);
                                    if (dateEl) dateEl.value = '';
                                  }
                                }}
                                className="bg-primary text-white font-bold py-1 rounded-lg text-[10px] hover:bg-primary-hover transition cursor-pointer"
                              >
                                Vincular Eficiencia Especial
                              </button>
                            </div>

                            <div className="max-h-[90px] overflow-y-auto space-y-1 pr-1 border rounded-lg bg-white p-1.5">
                              {Object.keys(calendarConfig.eficienciasEspeciales || {}).length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic text-center py-2">Sin restricciones de rendimiento</p>
                              ) : (
                                Object.entries(calendarConfig.eficienciasEspeciales).map(([date, pct]) => (
                                  <div key={date} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded-md border text-[10px] font-bold">
                                    <span className="font-mono text-slate-700">{date}: <strong className="text-amber-700">{pct}% Ef.</strong></span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = { ...calendarConfig.eficienciasEspeciales };
                                        delete copy[date];
                                        const updated = { ...calendarConfig, eficienciasEspeciales: copy };
                                        handleSaveCalendarConfig(updated);
                                      }}
                                      className="text-red-500 hover:text-red-700 font-bold px-1"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Layout Principal Gantt */}
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                        <div className="xl:col-span-6 space-y-4">
                          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex justify-between items-center">
                            <div>
                              <h3 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">Hoja de Planificación</h3>
                              <p className="text-[10px] text-slate-455 font-bold uppercase mt-0.5">Partidas del Presupuesto e Hitos de Control</p>
                            </div>
                            <button
                              onClick={handleAddMilestoneRow}
                              className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Plus className="w-4 h-4 text-primary" />
                              <span>Agregar Hito</span>
                            </button>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-660 font-bold text-[9px] uppercase tracking-wider select-none">
                                    <th className="p-3 w-16 text-center">Código</th>
                                    <th className="p-3">Tarea / Hito</th>
                                    <th className="p-3 w-24">Inicio</th>
                                    <th className="p-3 w-14 text-center">Días</th>
                                    <th className="p-3 w-16 text-center">Pred.</th>
                                    <th className="p-3 w-14 text-center">Tipo</th>
                                    <th className="p-3 w-14 text-center">Desf.</th>
                                    <th className="p-3 w-10"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-150">
                                  {resolvedCronograma.map((task) => {
                                    const isChapter = task.is_chapter;
                                    const isMilestone = task.duracion === 0;

                                    return (
                                      <tr key={task.id} className={`hover:bg-slate-50/50 transition ${isChapter ? 'bg-slate-100/80 font-bold' : ''}`}>
                                        <td className="p-2">
                                          <input
                                            type="text"
                                            value={task.codigo || ''}
                                            onChange={(e) => !isChapter && handleUpdateCronogramaField(task.id, 'codigo', e.target.value)}
                                            disabled={isChapter || task.is_partida}
                                            className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-center ${isChapter ? 'font-black text-slate-800' : 'text-slate-800'}`}
                                          />
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="text"
                                            value={task.tarea || ''}
                                            onChange={(e) => !isChapter && handleUpdateCronogramaField(task.id, 'tarea', e.target.value)}
                                            disabled={isChapter || task.is_partida}
                                            className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs uppercase ${isChapter ? 'font-black text-slate-900' : isMilestone ? 'text-slate-900 font-extrabold text-[11px]' : 'text-slate-850 font-semibold'}`}
                                          />
                                        </td>
                                        <td className="p-2">
                                          {isChapter ? (
                                            <span className="p-1 text-[11px] text-slate-500 font-bold block text-center select-none">{task.fecha_inicio}</span>
                                          ) : (
                                            <input
                                              type="date"
                                              value={task.fecha_inicio || ''}
                                              onChange={(e) => handleUpdateCronogramaField(task.id, 'fecha_inicio', e.target.value)}
                                              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-[11px] text-slate-700 font-medium"
                                            />
                                          )}
                                        </td>
                                        <td className="p-2">
                                          {isChapter ? (
                                            <span className="p-1 text-xs text-slate-500 font-bold block text-center select-none">{task.duracion}</span>
                                          ) : (
                                            <input
                                              type="number"
                                              min="1"
                                              value={task.duracion ?? ''}
                                              onChange={(e) => handleUpdateCronogramaField(task.id, 'duracion', e.target.value)}
                                              disabled={isMilestone}
                                              title={task.is_partida && task.rendimiento_meta > 0 ? "Calculado inicialmente por Cantidad/Rendimiento, pero editable manual" : ""}
                                              className={`w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1 text-xs text-center font-bold ${isMilestone ? 'text-slate-400 cursor-not-allowed bg-slate-55/20 rounded font-black' : 'text-slate-700'}`}
                                            />
                                          )}
                                        </td>
                                        <td className="p-2">
                                          <input
                                            type="text"
                                            value={task.predecesora_code || ''}
                                            onChange={(e) => !isChapter && handleUpdateCronogramaField(task.id, 'predecesora_code', e.target.value)}
                                            disabled={isChapter}
                                            placeholder={isChapter ? '' : 'código'}
                                            className="w-full bg-transparent border border-slate-200 focus:ring-1 focus:ring-primary rounded p-0.5 text-xs text-slate-800 text-center font-bold"
                                          />
                                        </td>
                                        <td className="p-2">
                                          {!isChapter && (
                                            <select
                                              value={task.predecesora_tipo || 'FC'}
                                              onChange={(e) => handleUpdateCronogramaField(task.id, 'predecesora_tipo', e.target.value)}
                                              disabled={isChapter || !task.predecesora_code}
                                              className={`w-full border border-slate-200 rounded p-0.5 text-[10px] text-slate-700 bg-white font-semibold text-center cursor-pointer ${!task.predecesora_code ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            >
                                              <option value="FC">FC</option>
                                              <option value="CC">CC</option>
                                            </select>
                                          )}
                                        </td>
                                        <td className="p-2">
                                          {!isChapter && (
                                            <input
                                              type="number"
                                              value={task.predecesora_desfase ?? 0}
                                              onChange={(e) => handleUpdateCronogramaField(task.id, 'predecesora_desfase', parseInt(e.target.value, 10) || 0)}
                                              disabled={isChapter || !task.predecesora_code}
                                              className={`w-full bg-transparent border border-slate-200 focus:ring-1 focus:ring-primary rounded p-0.5 text-xs text-slate-850 text-center font-bold ${!task.predecesora_code ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            />
                                          )}
                                        </td>

                                        <td className="p-2 text-center">
                                          {!isChapter && !task.is_partida && (
                                            <button
                                              onClick={() => handleDeleteCronogramaRow(task.id)}
                                              className="p-1 text-red-655 hover:bg-red-50 rounded-lg transition"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        <div className="xl:col-span-6 space-y-4">
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

                          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                              <span className="text-[10px] font-extrabold uppercase text-slate-555 tracking-wider">Diagrama Gantt</span>
                            </div>

                            <div className="p-4 overflow-x-auto">
                              <div 
                                className="grid border-r border-b border-slate-200 select-none min-w-[650px]"
                                style={{ gridTemplateColumns: `repeat(${ganttScale}, minmax(26px, 1fr))` }}
                              >
                                {ganttDays.map((day, idx) => (
                                  <div 
                                    key={idx}
                                    className={`text-center py-2 border-t border-l border-slate-200 flex flex-col justify-center items-center ${
                                      day.isWeekend ? 'bg-slate-100/70 text-slate-400' : 'bg-slate-50 text-slate-655'
                                    }`}
                                  >
                                    <span className="text-[7.5px] font-bold uppercase tracking-wider">{day.monthStr}</span>
                                    <span className="text-[10px] font-black">{day.dayNum}</span>
                                  </div>
                                ))}

                                {resolvedCronograma.map((task) => {
                                  const span = getGanttSpan(task.fecha_inicio, task.fecha_fin);
                                  const isMilestone = task.duracion === 0;

                                  let barColor = 'bg-blue-600';
                                  if (task.is_chapter) barColor = 'bg-slate-800';
                                  else if (task.estado === 'emerald') barColor = 'bg-emerald-600';
                                  else if (task.estado === 'purple') barColor = 'bg-purple-600';
                                  else if (task.estado === 'amber') barColor = 'bg-amber-500';
                                  else if (task.estado === 'rose') barColor = 'bg-rose-500';
                                  else if (task.estado === 'slate') barColor = 'bg-slate-500';

                                  return (
                                    <div 
                                      key={task.id}
                                      className="h-9 relative border-t border-l border-slate-200 flex items-center bg-slate-50/20"
                                      style={{ gridColumn: `1 / span ${ganttScale}` }}
                                    >
                                      <div 
                                        className="grid h-full w-full absolute top-0 left-0"
                                        style={{ gridTemplateColumns: `repeat(${ganttScale}, minmax(26px, 1fr))` }}
                                      >
                                        {span && (
                                          <div 
                                            className={`relative flex items-center h-full px-1 cursor-ew-resize select-none ${
                                              draggedTaskId === task.id ? 'ring-2 ring-primary ring-offset-1 rounded-lg z-25' : 'z-10'
                                            }`}
                                            style={{
                                              gridColumnStart: span.gridColumnStart,
                                              gridColumnEnd: span.gridColumnEnd
                                            }}
                                            onPointerDown={(e) => {
                                              if (task.is_chapter) return;
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setDraggedTaskId(task.id);
                                              setDragStartX(e.clientX);
                                              setDragStartLag(parseInt(task.predecesora_desfase, 10) || 0);
                                              setDragStartInicio(task.fecha_inicio);
                                              e.target.setPointerCapture(e.pointerId);
                                            }}
                                            onPointerMove={(e) => {
                                              if (draggedTaskId === task.id) {
                                                const deltaX = e.clientX - dragStartX;
                                                const dayWidth = 28; // Ancho promedio de celda día en px
                                                const daysShift = Math.round(deltaX / dayWidth);
                                                
                                                if (daysShift !== 0) {
                                                  if (task.predecesora_code) {
                                                    const newLag = dragStartLag + daysShift;
                                                    handleUpdateCronogramaField(task.id, 'predecesora_desfase', newLag);
                                                  } else {
                                                    const d = new Date(dragStartInicio + 'T00:00:00');
                                                    d.setDate(d.getDate() + daysShift);
                                                    const newStart = d.toISOString().split('T')[0];
                                                    handleUpdateCronogramaField(task.id, 'fecha_inicio', newStart);
                                                  }
                                                  
                                                  // Reiniciar referencias locales para evitar aceleración
                                                  setDragStartX(e.clientX);
                                                  if (task.predecesora_code) {
                                                    setDragStartLag(prev => prev + daysShift);
                                                  } else {
                                                    const d = new Date(dragStartInicio + 'T00:00:00');
                                                    d.setDate(d.getDate() + daysShift);
                                                    setDragStartInicio(d.toISOString().split('T')[0]);
                                                  }
                                                }
                                              }
                                            }}
                                            onPointerUp={(e) => {
                                              if (draggedTaskId === task.id) {
                                                e.target.releasePointerCapture(e.pointerId);
                                                setDraggedTaskId(null);
                                              }
                                            }}
                                          >
                                            {/* Floating color picker popover */}
                                            {showColorPickerTaskId === task.id && (
                                              <div 
                                                className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2.5 bg-white border border-slate-200 shadow-xl rounded-2xl px-3 py-2 flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150"
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {['blue', 'emerald', 'purple', 'amber', 'rose', 'slate'].map(color => {
                                                  let dotClass = 'w-4 h-4 rounded-full cursor-pointer transition border border-slate-100 hover:scale-125';
                                                  if (color === 'blue') dotClass += ' bg-blue-500 hover:bg-blue-600';
                                                  if (color === 'emerald') dotClass += ' bg-emerald-500 hover:bg-emerald-600';
                                                  if (color === 'purple') dotClass += ' bg-purple-500 hover:bg-purple-600';
                                                  if (color === 'amber') dotClass += ' bg-amber-500 hover:bg-amber-600';
                                                  if (color === 'rose') dotClass += ' bg-rose-500 hover:bg-rose-600';
                                                  if (color === 'slate') dotClass += ' bg-slate-500 hover:bg-slate-600';
                                                  
                                                  if (task.estado === color) {
                                                    dotClass += ' ring-2 ring-primary ring-offset-1 scale-110';
                                                  }
                                                  
                                                  return (
                                                    <div 
                                                      key={color} 
                                                      className={dotClass}
                                                      onClick={() => {
                                                        handleUpdateCronogramaField(task.id, 'estado', color);
                                                        setShowColorPickerTaskId(null);
                                                      }}
                                                    />
                                                  );
                                                })}
                                                <button
                                                  onClick={() => setShowColorPickerTaskId(null)}
                                                  className="text-slate-400 hover:text-slate-600 text-xs ml-1 border-l border-slate-200 pl-2 hover:scale-110 cursor-pointer"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            )}

                                            {isMilestone ? (
                                              <div className="group/bar flex items-center justify-between gap-1 bg-slate-900 text-white rounded-lg px-2 py-0.5 shadow border border-slate-700 text-[9px] font-black z-10 animate-in zoom-in duration-100 truncate w-full">
                                                <div className="flex items-center gap-1 truncate">
                                                  <span className="text-amber-400">◆</span>
                                                  <span className="truncate uppercase">{task.tarea}</span>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setShowColorPickerTaskId(showColorPickerTaskId === task.id ? null : task.id);
                                                  }}
                                                  className="opacity-0 group-hover/bar:opacity-100 p-0.5 hover:bg-white/20 rounded text-white transition cursor-pointer shrink-0 ml-1"
                                                  title="Cambiar color"
                                                >
                                                  🎨
                                                </button>
                                              </div>
                                            ) : (
                                              <div 
                                                className={`group/bar w-full h-5 ${barColor} text-white rounded-lg flex items-center justify-between px-2 text-[9px] font-bold shadow-xs truncate`}
                                                title={task.tarea}
                                              >
                                                <span className="truncate uppercase">{task.tarea}</span>
                                                {!task.is_chapter && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      setShowColorPickerTaskId(showColorPickerTaskId === task.id ? null : task.id);
                                                    }}
                                                    className="opacity-0 group-hover/bar:opacity-100 p-0.5 hover:bg-white/20 rounded text-white transition cursor-pointer shrink-0 ml-1"
                                                    title="Cambiar color"
                                                  >
                                                    🎨
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )}

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
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* RECURSOS */}
                {activeSection === 'recursos' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Costo Estimado Total ({projectBaseCurrency})</h4>
                        <p className="text-base font-black text-slate-850 mt-1">{formatCurrencyValue(totalResourceCost, projectBaseCurrency)}</p>
                      </div>
                      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Materiales ({projectBaseCurrency})</h4>
                        <p className="text-base font-bold text-blue-700 mt-1">{formatCurrencyValue(materialCost, projectBaseCurrency)}</p>
                      </div>
                      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Mano de Obra ({projectBaseCurrency})</h4>
                        <p className="text-base font-bold text-amber-700 mt-1">{formatCurrencyValue(laborCost, projectBaseCurrency)}</p>
                      </div>
                      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Maquinaria ({projectBaseCurrency})</h4>
                        <p className="text-base font-bold text-purple-700 mt-1">{formatCurrencyValue(machineryCost, projectBaseCurrency)}</p>
                      </div>
                      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Herramientas ({projectBaseCurrency})</h4>
                        <p className="text-base font-bold text-rose-700 mt-1">{formatCurrencyValue(herramientasCost, projectBaseCurrency)}</p>
                      </div>
                      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
                        <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Otros Insumos ({projectBaseCurrency})</h4>
                        <p className="text-base font-bold text-teal-700 mt-1">{formatCurrencyValue(otrosCost, projectBaseCurrency)}</p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleAddResourceRow}
                        className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-primary" />
                        <span>Añadir Recurso</span>
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-650 font-bold text-[9px] uppercase tracking-wider select-none">
                              <th className="p-3.5">Nombre Recurso</th>
                              <th className="p-3.5 w-36">Tipo</th>
                              <th className="p-3.5 w-32 text-center">Tarifa / Costo</th>
                              <th className="p-3.5 w-24 text-center">Moneda</th>
                              <th className="p-3.5 w-24">Unidad</th>
                              <th className="p-3.5 w-24">Cant. Est.</th>
                              <th className="p-3.5 w-36">Comuna / Ciudad</th>
                              <th className="p-3.5 w-36">Proveedor</th>
                              <th className="p-3.5 w-32 text-right">Costo Est. ({projectBaseCurrency})</th>
                              <th className="p-3.5 w-14 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150">
                            {recursos.map((item) => {
                              const resInfo = parseResourceUnitAndCurrency(item.unidad);
                              const costInBase = convertCurrency(parseFloat(item.costo_unitario) || 0, resInfo.moneda, projectBaseCurrency);
                              const totalRowInBase = (parseFloat(item.cantidad_estimada) || 0) * costInBase;

                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition">
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.recurso || ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'recurso', e.target.value)}
                                      placeholder="ej: Cemento Gris"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-800 uppercase font-semibold"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <select
                                      value={item.tipo || 'Material'}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'tipo', e.target.value)}
                                      className="w-full border-0 bg-transparent focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-705 font-bold"
                                    >
                                      <option value="Material">Material</option>
                                      <option value="Mano de Obra">Mano de Obra</option>
                                      <option value="Maquinaria">Maquinaria</option>
                                      <option value="Herramientas">Herramientas</option>
                                      <option value="Otros">Otros</option>
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      step="any"
                                      value={item.costo_unitario ?? ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'costo_unitario', e.target.value)}
                                      placeholder="0"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 text-center font-bold"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <select
                                      value={resInfo.moneda}
                                      onChange={(e) => {
                                        const serialized = serializeResourceUnitAndCurrency(resInfo.unidad, e.target.value);
                                        handleUpdateResourceField(item.id, 'unidad', serialized);
                                      }}
                                      className="w-full border border-slate-200 rounded-lg p-1 text-xs text-slate-700 font-bold bg-white text-center"
                                    >
                                      <option value="CLP">CLP ($)</option>
                                      <option value="USD">USD ($)</option>
                                      <option value="UF">UF</option>
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={resInfo.unidad}
                                      onChange={(e) => {
                                        const serialized = serializeResourceUnitAndCurrency(e.target.value, resInfo.moneda);
                                        handleUpdateResourceField(item.id, 'unidad', serialized);
                                      }}
                                      placeholder="un"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-600 text-center uppercase"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      step="any"
                                      value={item.cantidad_estimada ?? ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'cantidad_estimada', e.target.value)}
                                      placeholder="0"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 font-semibold text-center"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <select
                                      value={item.ciudad || ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'ciudad', e.target.value)}
                                      className="w-full border-0 bg-transparent focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 uppercase"
                                    >
                                      <option value="">Seleccione Ciudad...</option>
                                      {comunasChile.map((c, idx) => (
                                        <option key={idx} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.proveedor || ''}
                                      onChange={(e) => handleUpdateResourceField(item.id, 'proveedor', e.target.value)}
                                      placeholder="ej: Sodimac"
                                      className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-1.5 text-xs text-slate-700 uppercase"
                                    />
                                  </td>
                                  <td className="p-3.5 font-bold text-slate-800 text-right">
                                    {formatCurrencyValue(totalRowInBase, projectBaseCurrency)}
                                  </td>
                                  <td className="p-2 text-center">
                                    <button
                                      onClick={() => handleDeleteResourceRow(item.id)}
                                      className="p-1.5 text-red-655 hover:bg-red-50 rounded-lg transition cursor-pointer"
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
                    </div>
                  </div>
                )}

                {/* ANÁLISIS DE PRESUPUESTO */}
                {activeSection === 'analisis' && (() => {
                  // 1. Obtener el desglose unitario de una partida en base a sus recursos APU
                  const getItemApuBreakdown = (item, apuLinks) => {
                    const isPU = item.tipo_metodologia !== 'Costo-Tiempo';
                    const rend = isPU ? (parseFloat(item.rendimiento_meta) || 1) : 1;
                    const diasMes = parseFloat(item.dias_habiles_mes) || 22;
                    const hrsJornada = parseFloat(item.horas_jornada) || 9;
                    const precioDiesel = parseFloat(item.precio_combustible) || 1050;
                    const lsPct = parseFloat(item.leyes_sociales_pct) || 0;
                    const hmPct = parseFloat(item.herramientas_menores_pct) || 0;
                    const impPct = parseFloat(item.imponderables_pct) || 0;

                    let matSum = 0;
                    let laborSum = 0;
                    let machSum = 0;
                    let herrSum = 0;
                    let otrosSum = 0;

                    const links = apuLinks.filter(l => String(l.item_id) === String(item.id));

                    links.forEach(link => {
                      const res = recursos.find(r => String(r.id) === String(link.recurso_id));
                      if (!res) return;

                      const qty = parseFloat(link.cantidad_unidad) || 0;
                      const resRend = parseFloat(link.rendimiento) || 1;
                      const originalCost = parseFloat(res.costo_unitario) || 0;
                      
                      const resInfo = parseResourceUnitAndCurrency(res.unidad);
                      const unitCost = convertCurrency(originalCost, resInfo.moneda, projectBaseCurrency);
                      
                      const unitStr = resInfo.unidad.toLowerCase().trim();
                      const consumoLh = parseFloat(link.consumo_combustible_lh) || 0;

                      if (!isPU) {
                        // COSTO-TIEMPO
                        let fuelCost = 0;
                        if (res.tipo === 'Maquinaria' && consumoLh > 0) {
                          if (unitStr.includes('mes') || unitStr.includes('mensual')) {
                            fuelCost = (consumoLh * hrsJornada * diasMes * precioDiesel) * qty;
                          } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
                            fuelCost = (consumoLh * precioDiesel) * qty;
                          } else {
                            fuelCost = (consumoLh * hrsJornada * precioDiesel) * qty;
                          }
                        }
                        
                        const sub = (unitCost * qty) + fuelCost;

                        if (res.tipo === 'Material') matSum += sub;
                        else if (res.tipo === 'Mano de Obra') laborSum += sub;
                        else if (res.tipo === 'Maquinaria') machSum += sub;
                        else if (res.tipo === 'Herramientas') herrSum += sub;
                        else otrosSum += sub;
                      } else {
                        // PRECIO UNITARIO
                        if (res.tipo === 'Maquinaria') {
                          const isTimeUnit = unitStr.includes('mes') || unitStr.includes('mensual') || 
                                             unitStr.includes('hr') || unitStr.includes('hora') || 
                                             unitStr.includes('día') || unitStr.includes('dia') || unitStr.includes('jornada');

                          if (isTimeUnit) {
                            let dailyRate = unitCost;
                            if (unitStr.includes('mes') || unitStr.includes('mensual')) {
                              dailyRate = unitCost / diasMes;
                            } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
                              dailyRate = unitCost * hrsJornada;
                            }

                            const fuelDaily = consumoLh * hrsJornada * precioDiesel;
                            const totalDailyMachineCost = dailyRate + fuelDaily;
                            const unitSub = (totalDailyMachineCost * qty) / rend;
                            machSum += unitSub;
                          } else {
                            const fuelDaily = consumoLh * hrsJornada * precioDiesel;
                            const fuelPerUnit = rend > 0 ? (fuelDaily * qty) / rend : 0;
                            const unitSub = (unitCost * qty * resRend) + fuelPerUnit;
                            machSum += unitSub;
                          }
                        } else if (res.tipo === 'Herramientas') {
                          const isTimeUnit = unitStr.includes('mes') || unitStr.includes('mensual') || 
                                             unitStr.includes('hr') || unitStr.includes('hora') || 
                                             unitStr.includes('día') || unitStr.includes('dia') || unitStr.includes('jornada');

                          if (isTimeUnit) {
                            let dailyRate = unitCost;
                            if (unitStr.includes('mes') || unitStr.includes('mensual')) {
                              dailyRate = unitCost / diasMes;
                            } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
                              dailyRate = unitCost * hrsJornada;
                            }
                            const unitSub = (dailyRate * qty) / rend;
                            herrSum += unitSub;
                          } else {
                            const unitSub = unitCost * qty * resRend;
                            herrSum += unitSub;
                          }
                        } else if (res.tipo === 'Mano de Obra') {
                          if (unitStr.includes('mes') || unitStr.includes('mensual')) {
                            const dailyRate = unitCost / diasMes;
                            const unitSub = (dailyRate * qty) / rend;
                            laborSum += unitSub;
                          } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
                            const dailyRate = unitCost * hrsJornada;
                            const unitSub = (dailyRate * qty) / rend;
                            laborSum += unitSub;
                          } else if (unitStr.includes('día') || unitStr.includes('dia') || unitStr.includes('jornada')) {
                            const unitSub = (unitCost * qty) / rend;
                            laborSum += unitSub;
                          } else {
                            const unitSub = unitCost * qty * resRend;
                            laborSum += unitSub;
                          }
                        } else if (res.tipo === 'Otros') {
                          const unitSub = unitCost * qty * resRend;
                          otrosSum += unitSub;
                        } else {
                          // Materiales
                          const unitSub = unitCost * qty * resRend;
                          matSum += unitSub;
                        }
                      }
                    });

                    const laborTotal = laborSum * (1 + (lsPct + hmPct) / 100);
                    const subtotalDirecto = matSum + machSum + laborTotal + herrSum + otrosSum;
                    const totalUnitario = subtotalDirecto * (1 + impPct / 100);

                    return {
                      matUnit: matSum * (1 + impPct / 100),
                      laborUnit: laborTotal * (1 + impPct / 100),
                      machUnit: machSum * (1 + impPct / 100),
                      herrUnit: herrSum * (1 + impPct / 100),
                      otrosUnit: otrosSum * (1 + impPct / 100),
                      totalUnitario: totalUnitario
                    };
                  };

                  // 2. Calcular la distribución de costos directa
                  const costDist = (() => {
                    let mat = 0, labor = 0, mach = 0, herr = 0, otros = 0;
                    
                    itemsPresupuesto.forEach(item => {
                      if (isChapterRow(item, itemsPresupuesto)) return;
                      const qty = parseFloat(item.cantidad) || 0;
                      const links = allApuLinks.filter(l => String(l.item_id) === String(item.id));
                      
                      if (links.length > 0) {
                        const breakdown = getItemApuBreakdown(item, allApuLinks);
                        mat += breakdown.matUnit * qty;
                        labor += breakdown.laborUnit * qty;
                        mach += breakdown.machUnit * qty;
                        herr += breakdown.herrUnit * qty;
                        otros += breakdown.otrosUnit * qty;
                      } else {
                        const manualCost = (parseFloat(item.costo_unitario) || 0) * qty;
                        otros += manualCost;
                      }
                    });

                    const directSum = mat + labor + mach + herr + otros;
                    return { mat, labor, mach, herr, otros, directSum };
                  })();

                  // 3. Flujo Financiero mensual devengado
                  const finFlow = (() => {
                    const tasks = cronograma.filter(t => !isChapterRow(t, cronograma));
                    if (tasks.length === 0) return { months: [], data: [], totals: { revenue: 0, cost: 0, margin: 0, marginPct: 0 } };

                    let minDate = null;
                    let maxDate = null;
                    tasks.forEach(t => {
                      const start = t.fecha_inicio ? new Date(t.fecha_inicio + 'T00:00:00') : new Date();
                      const end = t.fecha_fin ? new Date(t.fecha_fin + 'T00:00:00') : start;
                      if (!minDate || start < minDate) minDate = start;
                      if (!maxDate || end > maxDate) maxDate = end;
                    });

                    if (!minDate) minDate = new Date();
                    if (!maxDate) maxDate = minDate;

                    const months = [];
                    let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
                    const endLimit = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
                    while (cur <= endLimit) {
                      const year = cur.getFullYear();
                      const month = String(cur.getMonth() + 1).padStart(2, '0');
                      const label = cur.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
                      months.push({ key: `${year}-${month}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
                      cur.setMonth(cur.getMonth() + 1);
                    }

                    const revMap = {};
                    const costMap = {};
                    const catMap = { Material: {}, 'Mano de Obra': {}, Maquinaria: {}, Herramientas: {}, Otros: {} };
                    
                    months.forEach(m => {
                      revMap[m.key] = 0;
                      costMap[m.key] = 0;
                      Object.keys(catMap).forEach(cat => {
                        catMap[cat][m.key] = 0;
                      });
                    });

                    tasks.forEach(task => {
                      const item = itemsPresupuesto.find(i => i.codigo === task.codigo);
                      if (!item) return;

                      const start = task.fecha_inicio ? new Date(task.fecha_inicio + 'T00:00:00') : new Date();
                      const end = task.fecha_fin ? new Date(task.fecha_fin + 'T00:00:00') : start;
                      const dur = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

                      const qty = parseFloat(item.cantidad) || 0;
                      const unitCost = parseFloat(item.costo_unitario) || 0;
                      const isProratedActive = prorateFactor > 1;
                      const salesPrice = isProratedActive ? unitCost * prorateFactor : unitCost;

                      const totalCost = unitCost * qty;
                      const totalRevenue = salesPrice * qty;

                      const dailyCost = totalCost / dur;
                      const dailyRevenue = totalRevenue / dur;

                      const breakdown = getItemApuBreakdown(item, allApuLinks);
                      const dailyCat = {
                        Material: (breakdown.matUnit * qty) / dur,
                        'Mano de Obra': (breakdown.laborUnit * qty) / dur,
                        Maquinaria: (breakdown.machUnit * qty) / dur,
                        Herramientas: (breakdown.herrUnit * qty) / dur,
                        Otros: ((breakdown.otrosUnit * qty) || ((allApuLinks.filter(l => String(l.item_id) === String(item.id)).length === 0) ? totalCost : 0)) / dur
                      };

                      let dayCur = new Date(start);
                      for (let d = 0; d < dur; d++) {
                        const year = dayCur.getFullYear();
                        const month = String(dayCur.getMonth() + 1).padStart(2, '0');
                        const key = `${year}-${month}`;
                        if (revMap[key] !== undefined) {
                          revMap[key] += dailyRevenue;
                          costMap[key] += dailyCost;
                          Object.keys(catMap).forEach(cat => {
                            catMap[cat][key] += dailyCat[cat];
                          });
                        }
                        dayCur.setDate(dayCur.getDate() + 1);
                      }
                    });

                    // Distribuir costos indirectos no prorrateados
                    const indirectMonthly = months.length > 0 ? totalNonProratedIndirectValue / months.length : 0;
                    months.forEach(m => {
                      costMap[m.key] += indirectMonthly;
                      catMap['Otros'][m.key] += indirectMonthly;
                    });

                    let accRev = 0;
                    let accCost = 0;
                    const data = months.map(m => {
                      const rev = revMap[m.key];
                      const cost = costMap[m.key];
                      const margin = rev - cost;
                      const marginPct = rev > 0 ? (margin / rev) * 100 : 0;
                      accRev += rev;
                      accCost += cost;

                      return {
                        month: m.label,
                        key: m.key,
                        revenue: Math.round(rev),
                        cost: Math.round(cost),
                        margin: Math.round(margin),
                        marginPct: parseFloat(marginPct.toFixed(1)),
                        cumRevenue: Math.round(accRev),
                        cumCost: Math.round(accCost),
                        cumMargin: Math.round(accRev - accCost),
                        cats: {
                          Material: Math.round(catMap['Material'][m.key]),
                          Labor: Math.round(catMap['Mano de Obra'][m.key]),
                          Machinery: Math.round(catMap['Maquinaria'][m.key]),
                          Tools: Math.round(catMap['Herramientas'][m.key]),
                          Others: Math.round(catMap['Otros'][m.key])
                        }
                      };
                    });

                    const totals = {
                      revenue: Math.round(accRev),
                      cost: Math.round(accCost),
                      margin: Math.round(accRev - accCost),
                      marginPct: accRev > 0 ? parseFloat(((accRev - accCost) / accRev * 100).toFixed(1)) : 0
                    };

                    return { months, data, totals };
                  })();

                  // 4. Flujo de Caja mensual simulado
                  const cashFlow = (() => {
                    if (finFlow.data.length === 0) return { months: [], data: [], minCum: 0 };
                    
                    const { data: finData, months: finMonths, totals: finTotals } = finFlow;

                    const maxDelay = Math.max(
                      Math.round(cajaCobroClientesDias / 30),
                      Math.round(cajaPagoMaterialesDias / 30),
                      Math.round(cajaPagoMaquinariaDias / 30),
                      Math.round(cajaPagoHerramientasDias / 30),
                      Math.round(cajaPagoOtrosDias / 30),
                      Math.round(cajaPagoIndirectosDias / 30),
                      cajaRetencionDevoluMes
                    ) + 1;

                    const totalCFMonths = finMonths.length + maxDelay;
                    const cfMonths = [];

                    let cur = new Date(new Date(finMonths[0].key + '-15T00:00:00'));
                    for (let i = 0; i < totalCFMonths; i++) {
                      const year = cur.getFullYear();
                      const month = String(cur.getMonth() + 1).padStart(2, '0');
                      const label = cur.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
                      cfMonths.push({ key: `${year}-${month}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
                      cur.setMonth(cur.getMonth() + 1);
                    }

                    const cashInMap = {};
                    const cashOutMap = {};
                    const cashInDetails = { Anticipo: {}, EstadosPago: {}, DevolucionRetencion: {} };
                    const cashOutDetails = { Material: {}, Labor: {}, Machinery: {}, Tools: {}, Others: {} };

                    cfMonths.forEach(m => {
                      cashInMap[m.key] = 0;
                      cashOutMap[m.key] = 0;
                      Object.keys(cashInDetails).forEach(k => cashInDetails[k][m.key] = 0);
                      Object.keys(cashOutDetails).forEach(k => cashOutDetails[k][m.key] = 0);
                    });

                    const totalVentas = finTotals.revenue;
                    const anticipoTotal = totalVentas * (cajaAnticipoPct / 100);
                    let totalRetained = 0;

                    if (cfMonths.length > 0) {
                      const m1 = cfMonths[0].key;
                      cashInDetails.Anticipo[m1] = anticipoTotal;
                      cashInMap[m1] += anticipoTotal;
                    }

                    finData.forEach((fd, i) => {
                      const amortizacion = fd.revenue * (cajaAnticipoPct / 100);
                      const facturado = fd.revenue - amortizacion;
                      const retencion = facturado * (cajaRetencionPct / 100);
                      const cobroNeto = facturado - retencion;
                      totalRetained += retencion;

                      const clientDelay = Math.round(cajaCobroClientesDias / 30);
                      const targetIdx = i + clientDelay;
                      if (targetIdx < cfMonths.length) {
                        const targetKey = cfMonths[targetIdx].key;
                        cashInDetails.EstadosPago[targetKey] += cobroNeto;
                        cashInMap[targetKey] += cobroNeto;
                      }
                    });

                    const lastFinMonthIdx = finData.length - 1;
                    const targetRetIdx = lastFinMonthIdx + cajaRetencionDevoluMes;
                    if (targetRetIdx < cfMonths.length) {
                      const targetKey = cfMonths[targetRetIdx].key;
                      cashInDetails.DevolucionRetencion[targetKey] = totalRetained;
                      cashInMap[targetKey] += totalRetained;
                    }

                    finData.forEach((fd, i) => {
                      const cats = fd.cats;
                      const delays = {
                        Material: Math.round(cajaPagoMaterialesDias / 30),
                        Labor: Math.round(cajaPagoManoObraDias / 30),
                        Machinery: Math.round(cajaPagoMaquinariaDias / 30),
                        Tools: Math.round(cajaPagoHerramientasDias / 30),
                        Others: Math.round(cajaPagoOtrosDias / 30)
                      };

                      Object.keys(delays).forEach(cat => {
                        const delay = delays[cat];
                        const targetIdx = i + delay;
                        if (targetIdx < cfMonths.length) {
                          const targetKey = cfMonths[targetIdx].key;
                          const amt = cats[cat];
                          cashOutDetails[cat][targetKey] += amt;
                          cashOutMap[targetKey] += amt;
                        }
                      });
                    });

                    let accCash = 0;
                    let minCum = 0;

                    const data = cfMonths.map(m => {
                      const inc = cashInMap[m.key] || 0;
                      const out = cashOutMap[m.key] || 0;
                      const net = inc - out;
                      accCash += net;
                      if (accCash < minCum) {
                        minCum = accCash;
                      }

                      return {
                        month: m.label,
                        key: m.key,
                        inflow: Math.round(inc),
                        outflow: Math.round(out),
                        netFlow: Math.round(net),
                        cumFlow: Math.round(accCash),
                        inflowDetails: {
                          Anticipo: Math.round(cashInDetails.Anticipo[m.key]),
                          EstadosPago: Math.round(cashInDetails.EstadosPago[m.key]),
                          Retencion: Math.round(cashInDetails.DevolucionRetencion[m.key])
                        },
                        outflowDetails: {
                          Material: Math.round(cashOutDetails.Material[m.key]),
                          Labor: Math.round(cashOutDetails.Labor[m.key]),
                          Machinery: Math.round(cashOutDetails.Machinery[m.key]),
                          Tools: Math.round(cashOutDetails.Tools[m.key]),
                          Others: Math.round(cashOutDetails.Others[m.key])
                        }
                      };
                    });

                    return { months: cfMonths, data, minCum: Math.round(minCum) };
                  })();

                  // Solver de TIR
                  const getIRR = (flows) => {
                    if (flows.length === 0) return null;
                    const hasPositive = flows.some(f => f > 0);
                    const hasNegative = flows.some(f => f < 0);
                    if (!hasPositive || !hasNegative) return null;

                    let guess = 0.05; // 5%
                    for (let i = 0; i < 100; i++) {
                      let npvValue = 0;
                      let dNpvValue = 0;
                      for (let t = 0; t < flows.length; t++) {
                        npvValue += flows[t] / Math.pow(1 + guess, t);
                        dNpvValue -= t * flows[t] / Math.pow(1 + guess, t + 1);
                      }
                      if (Math.abs(dNpvValue) < 1e-10) break;
                      const nextGuess = guess - npvValue / dNpvValue;
                      if (Math.abs(nextGuess - guess) < 1e-7) {
                        return parseFloat((nextGuess * 100).toFixed(2));
                      }
                      guess = nextGuess;
                    }
                    return null;
                  };

                  // Valor Actual Neto (NPV) con tasa de descuento de 1% mensual
                  const getNPV = (flows, ratePct = 1) => {
                    const r = ratePct / 100;
                    return flows.reduce((acc, val, t) => acc + val / Math.pow(1 + r, t), 0);
                  };

                  const cashFlowList = cashFlow.data.map(d => d.netFlow);
                  const projectIRR = getIRR(cashFlowList);
                  const projectNPV = getNPV(cashFlowList, 1);

                  // 5. Renderizar interfaz
                  return (
                    <div className="space-y-6 animate-in fade-in duration-250">
                      
                      {/* Sub-Tabs de navegación interna */}
                      <div className="flex border-b border-slate-200 bg-white p-2 rounded-2xl shadow-xs gap-1.5 overflow-x-auto">
                        <button
                          onClick={() => setAnalisisTab('distribucion')}
                          className={`text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer transition ${analisisTab === 'distribucion' ? 'bg-primary text-white shadow-xs' : 'text-slate-550 hover:bg-slate-100'}`}
                        >
                          PieChart & Distribución
                        </button>
                        <button
                          onClick={() => setAnalisisTab('flujo_fin')}
                          className={`text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer transition ${analisisTab === 'flujo_fin' ? 'bg-primary text-white shadow-xs' : 'text-slate-550 hover:bg-slate-100'}`}
                        >
                          Flujo Financiero (Devengado)
                        </button>
                        <button
                          onClick={() => setAnalisisTab('flujo_caja')}
                          className={`text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer transition ${analisisTab === 'flujo_caja' ? 'bg-primary text-white shadow-xs' : 'text-slate-550 hover:bg-slate-100'}`}
                        >
                          Flujo de Caja (Efectivo)
                        </button>
                        <button
                          onClick={() => setAnalisisTab('config')}
                          className={`text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer transition ${analisisTab === 'config' ? 'bg-primary text-white shadow-xs' : 'text-slate-550 hover:bg-slate-100'}`}
                        >
                          ⚙️ Configurar Flujos
                        </button>
                      </div>

                      {allApuLinksLoading ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
                          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                          <p className="text-xs text-slate-500 font-extrabold uppercase">Cargando desglose financiero del proyecto...</p>
                        </div>
                      ) : (
                        <>
                          {/* TAB 1: DISTRIBUCIÓN DE COSTOS */}
                          {analisisTab === 'distribucion' && (
                            <div className="space-y-6">
                              {/* Tarjetas Ejecutivas */}
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
                                  <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Venta Presupuestada (Ingreso)</h4>
                                  <p className="text-lg font-black text-slate-850 mt-1">{formatCurrencyValue(totalProjectCost, projectBaseCurrency)}</p>
                                </div>
                                <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
                                  <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Costo Directo (Insumos APU)</h4>
                                  <p className="text-lg font-bold text-slate-700 mt-1">{formatCurrencyValue(costDist.directSum, projectBaseCurrency)}</p>
                                </div>
                                <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
                                  <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Costos Indirectos (Gastos Gral.)</h4>
                                  <p className="text-lg font-bold text-purple-700 mt-1">{formatCurrencyValue(totalIndirectCostValue, projectBaseCurrency)}</p>
                                </div>
                                <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
                                  <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Margen Operacional Neto</h4>
                                  <p className="text-lg font-extrabold text-emerald-600 mt-1">
                                    {formatCurrencyValue(totalProjectCost - costDist.directSum - totalIndirectCostValue, projectBaseCurrency)}
                                    <span className="text-xs font-normal text-slate-455 ml-1.5">({totalProjectCost > 0 ? ((totalProjectCost - costDist.directSum - totalIndirectCostValue) / totalProjectCost * 100).toFixed(1) : 0}%)</span>
                                  </p>
                                </div>
                                <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
                                  <h4 className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Financiamiento Requerido</h4>
                                  <p className="text-lg font-extrabold text-rose-600 mt-1">{formatCurrencyValue(Math.abs(cashFlow.minCum), projectBaseCurrency)}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Tabla de distribución */}
                                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
                                  <div className="border-b border-slate-100 pb-3 mb-4">
                                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Distribución de Costos Directos e Indirectos</h4>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider select-none">
                                          <th className="p-3">Categoría de Costo</th>
                                          <th className="p-3 text-right">Monto Unitario Ponderado ({projectBaseCurrency})</th>
                                          <th className="p-3 text-center w-24">% Participación</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                                        <tr>
                                          <td className="p-3 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-blue-500" />
                                            <span>Materiales</span>
                                          </td>
                                          <td className="p-3 text-right">{formatCurrencyValue(costDist.mat, projectBaseCurrency)}</td>
                                          <td className="p-3 text-center">{costDist.directSum > 0 ? (costDist.mat / costDist.directSum * 100).toFixed(1) : 0}%</td>
                                        </tr>
                                        <tr>
                                          <td className="p-3 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-amber-500" />
                                            <span>Mano de Obra (+Leyes)</span>
                                          </td>
                                          <td className="p-3 text-right">{formatCurrencyValue(costDist.labor, projectBaseCurrency)}</td>
                                          <td className="p-3 text-center">{costDist.directSum > 0 ? (costDist.labor / costDist.directSum * 100).toFixed(1) : 0}%</td>
                                        </tr>
                                        <tr>
                                          <td className="p-3 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-purple-500" />
                                            <span>Maquinaria (+Diesel)</span>
                                          </td>
                                          <td className="p-3 text-right">{formatCurrencyValue(costDist.mach, projectBaseCurrency)}</td>
                                          <td className="p-3 text-center">{costDist.directSum > 0 ? (costDist.mach / costDist.directSum * 100).toFixed(1) : 0}%</td>
                                        </tr>
                                        <tr>
                                          <td className="p-3 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-rose-500" />
                                            <span>Herramientas</span>
                                          </td>
                                          <td className="p-3 text-right">{formatCurrencyValue(costDist.herr, projectBaseCurrency)}</td>
                                          <td className="p-3 text-center">{costDist.directSum > 0 ? (costDist.herr / costDist.directSum * 100).toFixed(1) : 0}%</td>
                                        </tr>
                                        <tr>
                                          <td className="p-3 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-slate-500" />
                                            <span>Otros Insumos / Manuales</span>
                                          </td>
                                          <td className="p-3 text-right">{formatCurrencyValue(costDist.otros, projectBaseCurrency)}</td>
                                          <td className="p-3 text-center">{costDist.directSum > 0 ? (costDist.otros / costDist.directSum * 100).toFixed(1) : 0}%</td>
                                        </tr>
                                        <tr className="bg-slate-50 border-t border-slate-200 font-extrabold text-slate-850">
                                          <td className="p-3 uppercase">Total Costos Directos</td>
                                          <td className="p-3 text-right">{formatCurrencyValue(costDist.directSum, projectBaseCurrency)}</td>
                                          <td className="p-3 text-center">100.0%</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Donut Chart Representación con barras apiladas o CSS */}
                                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                                  <div className="border-b border-slate-100 pb-3">
                                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Desglose Relativo</h4>
                                  </div>
                                  <div className="flex-1 flex flex-col justify-center py-6 space-y-4">
                                    {/* Materiales */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                                        <span>Materiales</span>
                                        <span>{costDist.directSum > 0 ? (costDist.mat / costDist.directSum * 100).toFixed(1) : 0}%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${costDist.directSum > 0 ? (costDist.mat / costDist.directSum * 100) : 0}%` }} />
                                      </div>
                                    </div>
                                    {/* Mano de obra */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                                        <span>Mano de Obra</span>
                                        <span>{costDist.directSum > 0 ? (costDist.labor / costDist.directSum * 100).toFixed(1) : 0}%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${costDist.directSum > 0 ? (costDist.labor / costDist.directSum * 100) : 0}%` }} />
                                      </div>
                                    </div>
                                    {/* Maquinaria */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                                        <span>Maquinaria</span>
                                        <span>{costDist.directSum > 0 ? (costDist.mach / costDist.directSum * 100).toFixed(1) : 0}%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${costDist.directSum > 0 ? (costDist.mach / costDist.directSum * 100) : 0}%` }} />
                                      </div>
                                    </div>
                                    {/* Herramientas */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                                        <span>Herramientas</span>
                                        <span>{costDist.directSum > 0 ? (costDist.herr / costDist.directSum * 100).toFixed(1) : 0}%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${costDist.directSum > 0 ? (costDist.herr / costDist.directSum * 100) : 0}%` }} />
                                      </div>
                                    </div>
                                    {/* Otros */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                                        <span>Otros / Sin APU</span>
                                        <span>{costDist.directSum > 0 ? (costDist.otros / costDist.directSum * 100).toFixed(1) : 0}%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-slate-500 h-full rounded-full" style={{ width: `${costDist.directSum > 0 ? (costDist.otros / costDist.directSum * 100) : 0}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 2: FLUJO FINANCIERO (DEVENGADO) */}
                          {analisisTab === 'flujo_fin' && (
                            <div className="space-y-6">
                              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Flujo Financiero Programado (Criterio Devengado)</h4>
                                  <span className="text-[9px] bg-blue-50 text-blue-700 font-extrabold uppercase px-2 py-0.5 rounded border border-blue-200">
                                    Base Gantt
                                  </span>
                                </div>
                                <div className="bg-blue-50/50 p-3 rounded-2xl text-[11px] text-blue-800 font-semibold border border-blue-150">
                                  💡 <strong>Nota sobre devengado</strong>: Distribuye de forma proporcional diaria los costos e ingresos a lo largo de las fechas programadas de inicio y fin de las tareas en el Diagrama Gantt. No considera los plazos de cobro ni crédito de caja.
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider select-none">
                                        <th className="p-3 w-48">Concepto</th>
                                        {finFlow.months.map(m => (
                                          <th key={m.key} className="p-3 text-right">{m.month}</th>
                                        ))}
                                        <th className="p-3 text-right bg-slate-100/50">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                                      {/* Ingresos devengados */}
                                      <tr>
                                        <td className="p-3 font-bold text-slate-800">Ingresos Devengados (Ventas)</td>
                                        {finFlow.data.map(fd => (
                                          <td key={fd.key} className="p-3 text-right text-emerald-700">{formatCurrencyValue(fd.revenue, projectBaseCurrency)}</td>
                                        ))}
                                        <td className="p-3 text-right bg-slate-100/50 text-emerald-800 font-bold">{formatCurrencyValue(finFlow.totals.revenue, projectBaseCurrency)}</td>
                                      </tr>
                                      {/* Egresos devengados */}
                                      <tr>
                                        <td className="p-3 font-bold text-slate-800">Egresos Devengados (Costos)</td>
                                        {finFlow.data.map(fd => (
                                          <td key={fd.key} className="p-3 text-right text-rose-700">{formatCurrencyValue(fd.cost, projectBaseCurrency)}</td>
                                        ))}
                                        <td className="p-3 text-right bg-slate-100/50 text-rose-800 font-bold">{formatCurrencyValue(finFlow.totals.cost, projectBaseCurrency)}</td>
                                      </tr>
                                      {/* Margen mensual */}
                                      <tr className="bg-slate-50/50 font-bold">
                                        <td className="p-3">Margen Mensual</td>
                                        {finFlow.data.map(fd => (
                                          <td key={fd.key} className={`p-3 text-right ${fd.margin >= 0 ? 'text-emerald-600' : 'text-red-655'}`}>
                                            {formatCurrencyValue(fd.margin, projectBaseCurrency)} ({fd.marginPct}%)
                                          </td>
                                        ))}
                                        <td className={`p-3 text-right bg-slate-100 font-extrabold ${finFlow.totals.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                          {formatCurrencyValue(finFlow.totals.margin, projectBaseCurrency)} ({finFlow.totals.marginPct}%)
                                        </td>
                                      </tr>
                                      {/* Acumulados */}
                                      <tr className="text-slate-500 font-medium">
                                        <td className="p-3 italic">Ingreso Acumulado</td>
                                        {finFlow.data.map(fd => (
                                          <td key={fd.key} className="p-3 text-right">{formatCurrencyValue(fd.cumRevenue, projectBaseCurrency)}</td>
                                        ))}
                                        <td className="p-3 text-right bg-slate-100/50">-</td>
                                      </tr>
                                      <tr className="text-slate-500 font-medium">
                                        <td className="p-3 italic">Egreso Acumulado</td>
                                        {finFlow.data.map(fd => (
                                          <td key={fd.key} className="p-3 text-right">{formatCurrencyValue(fd.cumCost, projectBaseCurrency)}</td>
                                        ))}
                                        <td className="p-3 text-right bg-slate-100/50">-</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 3: FLUJO DE CAJA (EFECTIVO) */}
                          {analisisTab === 'flujo_caja' && (
                            <div className="space-y-6">
                              {/* Indicadores Financieros de Caja */}
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
                                  <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">NPV / VAN Caja (Tasa 1% mensual)</h4>
                                  <p className={`text-base font-black mt-1 ${projectNPV >= 0 ? 'text-emerald-700' : 'text-red-655'}`}>
                                    {formatCurrencyValue(projectNPV, projectBaseCurrency)}
                                  </p>
                                </div>
                                <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
                                  <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">IRR / TIR Caja Mensual</h4>
                                  <p className="text-base font-black text-slate-800 mt-1">
                                    {projectIRR !== null ? `${projectIRR}% mensual` : 'N/D (No calculable)'}
                                  </p>
                                </div>
                                <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
                                  <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Máximo Déficit Acumulado</h4>
                                  <p className="text-base font-black text-rose-600 mt-1">
                                    {formatCurrencyValue(cashFlow.minCum, projectBaseCurrency)}
                                  </p>
                                </div>
                                <div className="bg-white p-5 border border-slate-200 rounded-3xl shadow-xs">
                                  <h4 className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Capital Trabajo Mínimo Recomendado</h4>
                                  <p className="text-base font-black text-blue-700 mt-1">
                                    {formatCurrencyValue(Math.abs(cashFlow.minCum) * 1.15, projectBaseCurrency)}
                                  </p>
                                </div>
                              </div>

                              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Proyección de Flujo de Caja Mensual (Caja)</h4>
                                  <span className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold uppercase px-2 py-0.5 rounded border border-emerald-200">
                                    Simulación Efectivo
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider select-none">
                                        <th className="p-3 w-52">Concepto Financiero</th>
                                        {cashFlow.months.map(m => (
                                          <th key={m.key} className="p-3 text-right">{m.month}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                                      {/* INGRESOS DE CAJA */}
                                      <tr className="bg-slate-50/50 font-black text-slate-850">
                                        <td className="p-3 uppercase tracking-wider text-[9px]">A. Ingresos de Caja (Cobros)</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-3 text-right text-emerald-700">{formatCurrencyValue(cd.inflow, projectBaseCurrency)}</td>
                                        ))}
                                      </tr>
                                      <tr className="text-slate-500 font-medium">
                                        <td className="p-2.5 pl-6 font-semibold">1. Anticipo Recibido</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-2.5 text-right">{cd.inflowDetails.Anticipo > 0 ? formatCurrencyValue(cd.inflowDetails.Anticipo, projectBaseCurrency) : '-'}</td>
                                        ))}
                                      </tr>
                                      <tr className="text-slate-500 font-medium">
                                        <td className="p-2.5 pl-6 font-semibold">2. Estados de Pago Cobrados</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-2.5 text-right">{cd.inflowDetails.EstadosPago > 0 ? formatCurrencyValue(cd.inflowDetails.EstadosPago, projectBaseCurrency) : '-'}</td>
                                        ))}
                                      </tr>
                                      <tr className="text-slate-500 font-medium border-b border-slate-200">
                                        <td className="p-2.5 pl-6 font-semibold">3. Devolución de Retenciones</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-2.5 text-right">{cd.inflowDetails.Retencion > 0 ? formatCurrencyValue(cd.inflowDetails.Retencion, projectBaseCurrency) : '-'}</td>
                                        ))}
                                      </tr>

                                      {/* EGRESOS DE CAJA */}
                                      <tr className="bg-slate-50/50 font-black text-slate-850">
                                        <td className="p-3 uppercase tracking-wider text-[9px]">B. Egresos de Caja (Pagos)</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-3 text-right text-rose-700">{formatCurrencyValue(cd.outflow, projectBaseCurrency)}</td>
                                        ))}
                                      </tr>
                                      <tr className="text-slate-500 font-medium">
                                        <td className="p-2.5 pl-6 font-semibold">1. Pagos Proveedores Materiales</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-2.5 text-right">{cd.outflowDetails.Material > 0 ? formatCurrencyValue(cd.outflowDetails.Material, projectBaseCurrency) : '-'}</td>
                                        ))}
                                      </tr>
                                      <tr className="text-slate-500 font-medium">
                                        <td className="p-2.5 pl-6 font-semibold">2. Pagos Mano de Obra (+Leyes)</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-2.5 text-right">{cd.outflowDetails.Labor > 0 ? formatCurrencyValue(cd.outflowDetails.Labor, projectBaseCurrency) : '-'}</td>
                                        ))}
                                      </tr>
                                      <tr className="text-slate-500 font-medium">
                                        <td className="p-2.5 pl-6 font-semibold">3. Pagos Proveedores Maquinaria</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-2.5 text-right">{cd.outflowDetails.Machinery > 0 ? formatCurrencyValue(cd.outflowDetails.Machinery, projectBaseCurrency) : '-'}</td>
                                        ))}
                                      </tr>
                                      <tr className="text-slate-500 font-medium">
                                        <td className="p-2.5 pl-6 font-semibold">4. Pagos Proveedores Herramientas</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-2.5 text-right">{cd.outflowDetails.Tools > 0 ? formatCurrencyValue(cd.outflowDetails.Tools, projectBaseCurrency) : '-'}</td>
                                        ))}
                                      </tr>
                                      <tr className="text-slate-500 font-medium border-b border-slate-200">
                                        <td className="p-2.5 pl-6 font-semibold">5. Pagos Otros / Indirectos</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className="p-2.5 text-right">{cd.outflowDetails.Others > 0 ? formatCurrencyValue(cd.outflowDetails.Others, projectBaseCurrency) : '-'}</td>
                                        ))}
                                      </tr>

                                      {/* NETOS */}
                                      <tr className="bg-slate-50 font-black text-slate-900 border-t border-slate-255">
                                        <td className="p-3">Flujo Neto Mensual (A - B)</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className={`p-3 text-right ${cd.netFlow >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {formatCurrencyValue(cd.netFlow, projectBaseCurrency)}
                                          </td>
                                        ))}
                                      </tr>
                                      <tr className="bg-slate-100 font-black text-slate-955 border-t-2 border-slate-300">
                                        <td className="p-3.5">Saldo de Caja Acumulado</td>
                                        {cashFlow.data.map(cd => (
                                          <td key={cd.key} className={`p-3.5 text-right ${cd.cumFlow >= 0 ? 'text-blue-700' : 'text-rose-600 bg-rose-50/50'}`}>
                                            {formatCurrencyValue(cd.cumFlow, projectBaseCurrency)}
                                          </td>
                                        ))}
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* GRÁFICO INTERACTIVO CURVA S EN SVG */}
                              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                                <div className="border-b border-slate-100 pb-3">
                                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Curva S de Proyección Financiera</h4>
                                </div>

                                {cashFlow.data.length > 0 && (() => {
                                  // Generar coordenadas para SVG
                                  const width = 800;
                                  const height = 350;
                                  const paddingLeft = 90;
                                  const paddingRight = 30;
                                  const paddingTop = 40;
                                  const paddingBottom = 50;

                                  const graphWidth = width - paddingLeft - paddingRight;
                                  const graphHeight = height - paddingTop - paddingBottom;

                                  const n = cashFlow.data.length;
                                  
                                  // Encontrar máximos y mínimos para escalar el eje Y
                                  const maxVal = Math.max(
                                    ...finFlow.data.map(d => d.cumRevenue),
                                    ...finFlow.data.map(d => d.cumCost),
                                    ...cashFlow.data.map(d => d.cumFlow),
                                    100000
                                  );

                                  const minVal = Math.min(
                                    ...cashFlow.data.map(d => d.cumFlow),
                                    0
                                  );

                                  const range = maxVal - minVal;

                                  const getX = (i) => paddingLeft + (i * graphWidth) / (n - 1);
                                  const getY = (val) => paddingTop + graphHeight - ((val - minVal) * graphHeight) / range;

                                  // Crear paths
                                  let revenuePath = "";
                                  let costPath = "";
                                  let cashPath = "";

                                  finFlow.data.forEach((fd, i) => {
                                    const x = getX(i);
                                    const y = getY(fd.cumRevenue);
                                    revenuePath += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
                                  });

                                  finFlow.data.forEach((fd, i) => {
                                    const x = getX(i);
                                    const y = getY(fd.cumCost);
                                    costPath += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
                                  });

                                  cashFlow.data.forEach((cd, i) => {
                                    const x = getX(i);
                                    const y = getY(cd.cumFlow);
                                    cashPath += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
                                  });

                                  // Crear polígono de gradiente para la caja acumulada
                                  let cashAreaPath = `M ${getX(0)} ${getY(0)} `;
                                  cashFlow.data.forEach((cd, i) => {
                                    cashAreaPath += `L ${getX(i)} ${getY(cd.cumFlow)} `;
                                  });
                                  cashAreaPath += `L ${getX(n-1)} ${getY(0)} Z`;

                                  // Eje Y etiquetas
                                  const yTicks = 5;
                                  const yLabels = [];
                                  for (let i = 0; i <= yTicks; i++) {
                                    const val = minVal + (i * range) / yTicks;
                                    yLabels.push({ val: val, y: getY(val) });
                                  }

                                  return (
                                    <div className="relative">
                                      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none font-bold text-[9px] fill-slate-500">
                                        <defs>
                                          <linearGradient id="cashAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                                          </linearGradient>
                                        </defs>

                                        {/* Grid horizontal */}
                                        {yLabels.map((tick, idx) => (
                                          <g key={idx}>
                                            <line 
                                              x1={paddingLeft} 
                                              y1={tick.y} 
                                              x2={width - paddingRight} 
                                              y2={tick.y} 
                                              stroke="#e2e8f0" 
                                              strokeWidth="1" 
                                              strokeDasharray="4 4"
                                            />
                                            <text x={paddingLeft - 10} y={tick.y + 3} textAnchor="end" className="fill-slate-400 font-extrabold text-[8.5px]">
                                              {formatCurrencyValue(tick.val, projectBaseCurrency)}
                                            </text>
                                          </g>
                                        ))}

                                        {/* Grid vertical y etiquetas X */}
                                        {cashFlow.data.map((cd, i) => {
                                          const x = getX(i);
                                          return (
                                            <g key={i}>
                                              <line 
                                                x1={x} 
                                                y1={paddingTop} 
                                                x2={x} 
                                                y2={paddingTop + graphHeight} 
                                                stroke="#f1f5f9" 
                                                strokeWidth="1.5"
                                              />
                                              <text 
                                                x={x} 
                                                y={paddingTop + graphHeight + 18} 
                                                textAnchor="middle" 
                                                className="fill-slate-500 font-bold text-[8px]"
                                              >
                                                {cd.month.split(' ')[0]}
                                              </text>
                                            </g>
                                          );
                                        })}

                                        {/* Línea cero */}
                                        {minVal < 0 && (
                                          <line 
                                            x1={paddingLeft} 
                                            y1={getY(0)} 
                                            x2={width - paddingRight} 
                                            y2={getY(0)} 
                                            stroke="#ef4444" 
                                            strokeWidth="1.5" 
                                            strokeDasharray="2 2"
                                            title="Línea de Caja Cero"
                                          />
                                        )}

                                        {/* Área sombreada de caja acumulada */}
                                        <path d={cashAreaPath} fill="url(#cashAreaGradient)" />

                                        {/* Dibujar líneas principales */}
                                        {revenuePath && (
                                          <path 
                                            d={revenuePath} 
                                            fill="none" 
                                            stroke="#10b981" 
                                            strokeWidth="3.5" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                          />
                                        )}
                                        {costPath && (
                                          <path 
                                            d={costPath} 
                                            fill="none" 
                                            stroke="#f43f5e" 
                                            strokeWidth="3" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                          />
                                        )}
                                        {cashPath && (
                                          <path 
                                            d={cashPath} 
                                            fill="none" 
                                            stroke="#3b82f6" 
                                            strokeWidth="3" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                          />
                                        )}

                                        {/* Marcadores de puntos */}
                                        {finFlow.data.map((fd, i) => (
                                          <circle 
                                            key={`rev-${i}`} 
                                            cx={getX(i)} 
                                            cy={getY(fd.cumRevenue)} 
                                            r="4" 
                                            fill="#10b981" 
                                            stroke="white" 
                                            strokeWidth="1.5" 
                                            className="hover:scale-150 transition cursor-pointer"
                                          />
                                        ))}

                                        {finFlow.data.map((fd, i) => (
                                          <circle 
                                            key={`cost-${i}`} 
                                            cx={getX(i)} 
                                            cy={getY(fd.cumCost)} 
                                            r="3.5" 
                                            fill="#f43f5e" 
                                            stroke="white" 
                                            strokeWidth="1.5" 
                                            className="hover:scale-150 transition cursor-pointer"
                                          />
                                        ))}

                                        {cashFlow.data.map((cd, i) => (
                                          <circle 
                                            key={`cash-${i}`} 
                                            cx={getX(i)} 
                                            cy={getY(cd.cumFlow)} 
                                            r="4" 
                                            fill="#3b82f6" 
                                            stroke="white" 
                                            strokeWidth="1.5" 
                                            className="hover:scale-150 transition cursor-pointer"
                                          />
                                        ))}
                                      </svg>

                                      {/* Leyenda Gráfico */}
                                      <div className="flex justify-center items-center gap-6 mt-3 text-[10px] font-black uppercase text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-3.5 h-1.5 rounded bg-emerald-500 inline-block" />
                                          <span>Ventas Acumuladas</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-3.5 h-1.5 rounded bg-rose-500 inline-block" />
                                          <span>Costos Acumulados</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-3.5 h-1.5 rounded bg-blue-500 inline-block" />
                                          <span>Saldo Caja Acumulado</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {/* TAB 4: CONFIGURACIÓN FINANCIERA */}
                          {analisisTab === 'config' && (
                            <div className="space-y-6">
                              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
                                <div className="border-b border-slate-100 pb-3">
                                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Parámetros Financieros y Plazos de Crédito</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-semibold text-slate-700">
                                  {/* CLIENTES */}
                                  <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                    <h5 className="font-extrabold uppercase text-[10px] text-slate-500 tracking-wider border-b pb-1.5">Clientes / Ingresos</h5>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Anticipo / Pago Inicial (%)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={cajaAnticipoPct}
                                          onChange={(e) => setCajaAnticipoPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Plazo Cobro Estados Pago</label>
                                        <select
                                          value={cajaCobroClientesDias}
                                          onChange={(e) => setCajaCobroClientesDias(parseInt(e.target.value, 10))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                        >
                                          <option value={0}>Al contado (Mismo mes)</option>
                                          <option value={30}>30 días (Mes siguiente)</option>
                                          <option value={60}>60 días (2 meses posterior)</option>
                                          <option value={90}>90 días (3 meses posterior)</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Retención Estados de Pago (%)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="50"
                                          value={cajaRetencionPct}
                                          onChange={(e) => setCajaRetencionPct(Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Devolución Retenciones</label>
                                        <select
                                          value={cajaRetencionDevoluMes}
                                          onChange={(e) => setCajaRetencionDevoluMes(parseInt(e.target.value, 10))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                        >
                                          <option value={0}>Al finalizar obra (Mes 0)</option>
                                          <option value={1}>1 mes posterior al fin</option>
                                          <option value={2}>2 meses posterior al fin</option>
                                          <option value={3}>3 meses posterior al fin</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>

                                  {/* PROVEEDORES */}
                                  <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                    <h5 className="font-extrabold uppercase text-[10px] text-slate-500 tracking-wider border-b pb-1.5">Proveedores / Egresos (Plazos de Crédito)</h5>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Plazo Materiales</label>
                                        <select
                                          value={cajaPagoMaterialesDias}
                                          onChange={(e) => setCajaPagoMaterialesDias(parseInt(e.target.value, 10))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                        >
                                          <option value={0}>Al contado (Mismo mes)</option>
                                          <option value={30}>30 días posterior</option>
                                          <option value={60}>60 días posterior</option>
                                          <option value={90}>90 días posterior</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Plazo Mano de Obra</label>
                                        <select
                                          value={cajaPagoManoObraDias}
                                          onChange={(e) => setCajaPagoManoObraDias(parseInt(e.target.value, 10))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                        >
                                          <option value={0}>Al contado (Mismo mes)</option>
                                          <option value={15}>Quincenal (Mismo mes)</option>
                                          <option value={30}>Mensual (30 días de desfase)</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Plazo Maquinaria</label>
                                        <select
                                          value={cajaPagoMaquinariaDias}
                                          onChange={(e) => setCajaPagoMaquinariaDias(parseInt(e.target.value, 10))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                        >
                                          <option value={0}>Al contado</option>
                                          <option value={30}>30 días de crédito</option>
                                          <option value={60}>60 días de crédito</option>
                                          <option value={90}>90 días de crédito</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Plazo Herramientas</label>
                                        <select
                                          value={cajaPagoHerramientasDias}
                                          onChange={(e) => setCajaPagoHerramientasDias(parseInt(e.target.value, 10))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                        >
                                          <option value={0}>Al contado</option>
                                          <option value={30}>30 días de crédito</option>
                                          <option value={60}>60 días de crédito</option>
                                          <option value={90}>90 días de crédito</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Plazo Otros Gastos</label>
                                        <select
                                          value={cajaPagoOtrosDias}
                                          onChange={(e) => setCajaPagoOtrosDias(parseInt(e.target.value, 10))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                        >
                                          <option value={0}>Al contado</option>
                                          <option value={30}>30 días posterior</option>
                                          <option value={60}>60 días posterior</option>
                                          <option value={90}>90 días posterior</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Plazo Gastos Indirectos</label>
                                        <select
                                          value={cajaPagoIndirectosDias}
                                          onChange={(e) => setCajaPagoIndirectosDias(parseInt(e.target.value, 10))}
                                          className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                        >
                                          <option value={0}>Al contado (Mismo mes)</option>
                                          <option value={30}>30 días posterior</option>
                                          <option value={60}>60 días posterior</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* IMPORTADOR INTELIGENTE CON IA */}
                {activeSection === 'importar_ia' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                              Importador Inteligente de Presupuestos con IA
                            </h3>
                            <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                              Carga automática de archivos usando Gemini 2.5 Flash
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* API KEY DE GEMINI */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                          <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1">
                            🔑 Configuración de API Key (Gemini)
                          </h4>
                          <span className="text-[9px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded uppercase">
                            BYOK - Almacenamiento Local Seguro
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-6 space-y-1">
                            <label className="block text-[9px] font-bold uppercase text-slate-450">Ingresa tu API Key de Gemini</label>
                            <input
                              type="password"
                              value={geminiApiKey}
                              onChange={(e) => setGeminiApiKey(e.target.value)}
                              placeholder="AIzaSy..."
                              className="w-full border border-slate-250 rounded-xl p-2.5 text-xs text-slate-800 bg-white placeholder-slate-350 focus:ring-1 focus:ring-primary focus:outline-none"
                            />
                          </div>

                          <div className="md:col-span-4 space-y-1">
                            <label className="block text-[9px] font-bold uppercase text-slate-450">Modelo de Inteligencia Artificial</label>
                            <select
                              value={geminiModel}
                              onChange={(e) => setGeminiModel(e.target.value)}
                              className="w-full border border-slate-250 rounded-xl p-2.5 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer font-bold"
                            >
                              <option value="gemini-3.5-flash">gemini-3.5-flash (Último - Recomendado)</option>
                              <option value="gemini-1.5-flash">gemini-1.5-flash (Estable)</option>
                              <option value="gemini-2.5-flash">gemini-2.5-flash (Deprecado)</option>
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <button
                              onClick={handleSaveIAConfig}
                              className="w-full bg-primary text-white font-extrabold text-xs uppercase py-2.5 rounded-xl hover:bg-primary-hover shadow-xs cursor-pointer transition h-10 flex items-center justify-center gap-1.5"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Guardar
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-455 font-semibold leading-normal">
                          💡 La clave se almacena exclusivamente en tu navegador. Si no tienes una clave, puedes obtener una de forma <strong>completamente gratuita y sin costo</strong> ingresando con tu cuenta de Google a <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-extrabold">Google AI Studio</a> y presionando "Get API Key".
                        </p>
                      </div>

                      {/* CARGA DE ARCHIVO */}
                      {!parsedAIBudget && (
                        <div className="space-y-4">
                          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition duration-200 flex flex-col items-center justify-center gap-3">
                            <div className="p-4 bg-primary/10 text-primary rounded-full">
                              <Upload className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-extrabold text-slate-700">Arrastra tu archivo aquí o presiona el botón para seleccionar</p>
                              <p className="text-[10px] text-slate-450">Formatos soportados: Excel (.xlsx, .xls), CSV, PDF (.pdf), Imágenes (.png, .jpg), Texto (.txt)</p>
                            </div>
                            <input
                              type="file"
                              id="aiImportFileInput"
                              onChange={(e) => setImportAIFile(e.target.files[0])}
                              accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.txt"
                              className="hidden"
                            />
                            <button
                              onClick={() => document.getElementById('aiImportFileInput').click()}
                              className="border border-slate-250 bg-white text-slate-700 font-extrabold text-xs uppercase px-4 py-2 rounded-xl hover:bg-slate-50 shadow-xs cursor-pointer transition"
                            >
                              Seleccionar Archivo
                            </button>
                          </div>

                          {importAIFile && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                                  <FileSpreadsheet className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="text-xs font-extrabold text-slate-800">{importAIFile.name}</p>
                                  <p className="text-[9px] text-slate-450 font-bold uppercase">
                                    {(importAIFile.size / 1024).toFixed(1)} KB | Tipo: {importAIFile.name.split('.').pop().toUpperCase()}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => setImportAIFile(null)}
                                className="text-red-655 hover:bg-red-50 p-1.5 rounded-lg transition"
                                title="Quitar archivo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {importAIError && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs font-semibold text-red-700 flex items-start gap-2 animate-shake">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{importAIError}</span>
                            </div>
                          )}

                          <div className="flex justify-end gap-3 pt-2">
                            <button
                              onClick={() => { setActiveSection(''); setImportAIFile(null); }}
                              className="border border-slate-250 bg-white text-slate-700 font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer shadow-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleProcessAIImport}
                              disabled={importAILoading || !importAIFile || !geminiApiKey}
                              className={`bg-primary text-white font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl shadow-xs hover:bg-primary-hover transition flex items-center gap-1.5 cursor-pointer ${(!importAIFile || !geminiApiKey) ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              {importAILoading ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  Procesando con IA...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Procesar Presupuesto con IA
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* LOADER PANTALLA COMPLETA O BLOQUE DE ESPERA */}
                      {importAILoading && !parsedAIBudget && (
                        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-12 text-center shadow-xs flex flex-col items-center justify-center space-y-4 animate-pulse">
                          <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                          <div>
                            <p className="text-xs text-slate-800 font-extrabold uppercase">La Inteligencia Artificial está analizando tu archivo...</p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-1">
                              Leyendo celdas, deduciendo la jerarquía de capítulos y extrayendo unidades de medida y precios. Esto puede tardar entre 5 y 15 segundos según el tamaño del documento.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* VISTA PREVIA DEL PRESUPUESTO EXTRAÍDO */}
                      {parsedAIBudget && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-semibold flex items-start gap-2">
                            <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                            <div>
                              <p className="font-extrabold uppercase text-[10px] text-emerald-700 tracking-wider">¡Presupuesto Interpretado con Éxito!</p>
                              <p className="mt-0.5">Hemos extraído la información. Revisa y edita los campos del proyecto a continuación y confirma la creación.</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            
                            {/* Panel Izquierdo: Metadatos del Proyecto */}
                            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 h-fit">
                              <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2 mb-2">
                                📝 Datos Básicos del Proyecto
                              </h4>
                              
                              <div className="space-y-3 text-xs font-semibold text-slate-700">
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-bold uppercase text-slate-450">Nombre de la Obra</label>
                                  <input
                                    type="text"
                                    value={aiProjNombre}
                                    onChange={(e) => setAiProjNombre(e.target.value)}
                                    placeholder="Nombre del proyecto"
                                    className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-bold uppercase text-slate-450">Cliente / Mandante</label>
                                  <input
                                    type="text"
                                    value={aiProjCliente}
                                    onChange={(e) => setAiProjCliente(e.target.value)}
                                    placeholder="Nombre del cliente"
                                    className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-bold uppercase text-slate-455">Comuna Faena</label>
                                  <select
                                    value={aiProjComuna}
                                    onChange={(e) => setAiProjComuna(e.target.value)}
                                    className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                  >
                                    <option value="">Selecciona Comuna...</option>
                                    {comunasChile.map((c, idx) => (
                                      <option key={idx} value={c}>{c}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-[9px] font-bold uppercase text-slate-450">Moneda Base</label>
                                    <select
                                      value={aiProjMoneda}
                                      onChange={(e) => setAiProjMoneda(e.target.value)}
                                      className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                                    >
                                      <option value="CLP">CLP ($)</option>
                                      <option value="USD">USD (US$)</option>
                                      <option value="UF">UF (UF)</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[9px] font-bold uppercase text-slate-455">Plazo (Días)</label>
                                    <input
                                      type="number"
                                      value={aiProjPlazo}
                                      onChange={(e) => setAiProjPlazo(parseInt(e.target.value, 10) || 0)}
                                      placeholder="30"
                                      className="w-full border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 bg-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Panel Derecho: Tabla de Partidas */}
                            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                              <h4 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2 mb-2">
                                📊 Planilla de Partidas Extraídas
                              </h4>
                              
                              <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-slate-150 rounded-xl">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-[9px] uppercase tracking-wider select-none sticky top-0 z-10">
                                      <th className="p-2.5 w-16">Item</th>
                                      <th className="p-2.5">Descripción de Partida / Capítulo</th>
                                      <th className="p-2.5 w-14 text-center">Un.</th>
                                      <th className="p-2.5 w-20 text-right">Cant.</th>
                                      <th className="p-2.5 w-24 text-right">P.U. ({aiProjMoneda})</th>
                                      <th className="p-2.5 w-28 text-right bg-slate-100/50">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-150 text-slate-700">
                                    {parsedAIBudget.items.map((item, idx) => {
                                      const qty = parseFloat(item.cantidad) || 0;
                                      const pu = parseFloat(item.costo_unitario) || 0;
                                      const totalVal = qty * pu;
                                      
                                      if (item.is_chapter) {
                                        return (
                                          <tr key={idx} className="bg-slate-50/70 font-extrabold text-slate-850">
                                            <td className="p-2.5 select-none">{item.codigo}</td>
                                            <td className="p-2.5 uppercase font-black text-slate-900" colSpan={4}>
                                              {item.descripcion}
                                            </td>
                                            <td className="p-2.5 text-right bg-slate-100/30 font-black">-</td>
                                          </tr>
                                        );
                                      }

                                      return (
                                        <tr key={idx} className="hover:bg-slate-50/50 font-semibold">
                                          <td className="p-2.5 text-slate-500 font-bold">{item.codigo}</td>
                                          <td className="p-2.5 text-slate-800 font-bold">{item.descripcion}</td>
                                          <td className="p-2.5 text-center text-slate-500 uppercase">{item.unidad || 'un'}</td>
                                          <td className="p-2.5 text-right">{qty}</td>
                                          <td className="p-2.5 text-right">{formatCurrencyValue(pu, aiProjMoneda)}</td>
                                          <td className="p-2.5 text-right font-extrabold bg-slate-100/30 text-slate-800">
                                            {formatCurrencyValue(totalVal, aiProjMoneda)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                          </div>

                          {importAIError && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs font-semibold text-red-700 flex items-start gap-2 animate-shake">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{importAIError}</span>
                            </div>
                          )}

                          <div className="flex justify-end gap-3 pt-2">
                            <button
                              onClick={() => { setParsedAIBudget(null); setImportAIFile(null); }}
                              className="border border-slate-250 bg-white text-slate-700 font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer shadow-xs"
                            >
                              Volver a subir
                            </button>
                            <button
                              onClick={handleConfirmAIImport}
                              disabled={importAILoading}
                              className="bg-primary text-white font-extrabold text-xs uppercase px-6 py-3 rounded-xl hover:bg-primary-hover shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            >
                              {importAILoading ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  Guardando Presupuesto...
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Confirmar y Crear Presupuesto
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* MIS PRESUPUESTOS */}
                {activeSection === 'mis_presupuestos' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-primary" />
                          <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Presupuestos Registrados</h3>
                        </div>
                      </div>

                      {proyectos.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 italic">
                          No hay ningún presupuesto registrado en el sistema. Crea uno nuevo para comenzar.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none">
                                <th className="p-3.5">Proyecto / Presupuesto</th>
                                <th className="p-3.5">Cliente</th>
                                <th className="p-3.5">Ubicación</th>
                                <th className="p-3.5 w-32 text-center">Plazo</th>
                                <th className="p-3.5 w-48 text-right">Límite Estimado</th>
                                <th className="p-3.5 w-32 text-center">Estado</th>
                                <th className="p-3.5 w-52 text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                              {proyectos.map((p) => {
                                const isActive = p.id === parseInt(selectedProyectoId, 10);
                                const pInfo = parseProjectTipoAndCurrency(p.tipo_proyecto);

                                return (
                                  <tr key={p.id} className={`hover:bg-slate-50/50 transition ${isActive ? 'bg-primary/5' : ''}`}>
                                    <td className="p-3.5 font-bold text-slate-800 uppercase">
                                      <div className="flex items-center gap-1.5">
                                        <span>{p.nombre}</span>
                                        <span className={`text-[8.5px] px-1.5 py-0.5 rounded-md font-extrabold ${pInfo.tipo === 'Público' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                                          {pInfo.tipo || 'Privado'}
                                        </span>
                                        <span className="bg-slate-100 text-slate-700 font-extrabold text-[8.5px] px-1 py-0.5 rounded border ml-1">
                                          {pInfo.monedaBase || 'CLP'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-3.5 text-slate-650 uppercase font-semibold">{p.cliente || '-'}</td>
                                    <td className="p-3.5 text-slate-600 uppercase font-semibold">{p.comuna || '-'}</td>
                                    <td className="p-3.5 text-center font-bold text-slate-700">{p.plazo_estimado ? `${p.plazo_estimado} días` : '-'}</td>
                                    <td className="p-3.5 text-right font-bold text-slate-850">
                                      {p.presupuesto_estimado ? formatCurrencyValue(p.presupuesto_estimado, pInfo.monedaBase || 'CLP') : '-'}
                                    </td>
                                    <td className="p-3.5 text-center">
                                      {isActive ? (
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border border-emerald-200">
                                          <Check className="w-3 h-3" /> Activo
                                        </span>
                                      ) : (
                                        <span className="inline-flex bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">
                                          Guardado
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3.5">
                                      <div className="flex items-center justify-center gap-2">
                                        {!isActive && (
                                          <button
                                            onClick={() => {
                                              setSelectedProyectoId(p.id);
                                              setSuccessMsg(`Proyecto "${p.nombre}" cargado exitosamente.`);
                                              setActiveSection('');
                                            }}
                                            className="bg-primary hover:bg-primary-hover text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                                          >
                                            Cargar Proyecto
                                          </button>
                                        )}
                                        <button
                                          onClick={async () => {
                                            if (confirm(`¿Estás seguro de eliminar el proyecto "${p.nombre}"?`)) {
                                              await supabase.from('presupuestos_proyectos').delete().eq('id', p.id);
                                              fetchProyectos();
                                            }
                                          }}
                                          className="p-1.5 text-red-655 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                        >
                                          <Trash2 className="w-4 h-4" />
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
                  </div>
                )}

              </div>
            )}
          </>
        )}

      </div>

      {/* ================= MODAL: ANÁLISIS DE PARTIDA (APU CON MONEDAS PARTICULARES) ================= */}
      {showApuModal && apuItem && (() => {
        const apuCalc = calculateApuCost();
        const isCostoTiempoMode = apuForm.tipo_metodologia === 'Costo-Tiempo';

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-5xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
              
              {/* Cabecera APU */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Settings className="w-4.5 h-4.5 text-primary" />
                    <span>Análisis APU: {apuItem.partida}</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Código: {apuItem.codigo || 'S/N'} | Moneda del Análisis: {projectBaseCurrency}</p>
                </div>
                <button 
                  onClick={() => setShowApuModal(false)} 
                  className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Ficha Resumen de Costo Unitario */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Unidad</span>
                  <p className="text-xs font-black text-slate-700 uppercase">{apuItem.unidad || 'Sin unidad'}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Cantidad / Tiempo</span>
                  <p className="text-xs font-black text-slate-700">{apuItem.cantidad || 0}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Metodología</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase mt-1 ${
                    isCostoTiempoMode ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {apuForm.tipo_metodologia}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Costo Unitario Resultante</span>
                  <p className="text-sm font-black text-primary">{formatCurrencyValue(apuCalc.totalUnitario, projectBaseCurrency)}</p>
                </div>
              </div>

              {/* ACCORDION: DESPLEGABLE DE CONFIGURACIÓN Y PARÁMETROS APU */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden mb-6 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowApuConfigAccordion(!showApuConfigAccordion)}
                  className="w-full px-4 py-3 bg-slate-100/70 hover:bg-slate-100 flex justify-between items-center text-xs font-extrabold text-slate-800 uppercase tracking-wider transition cursor-pointer border-b border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    <span>⚙️ Configuración y Parámetros del APU (En {projectBaseCurrency})</span>
                  </div>
                  {showApuConfigAccordion ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {showApuConfigAccordion && (
                  <div className="p-4 space-y-4 animate-in fade-in duration-150 bg-white">
                    
                    {/* Metodología */}
                    <div className="flex flex-wrap gap-4 border-b border-slate-100 pb-3">
                      <label className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border cursor-pointer transition ${
                        apuForm.tipo_metodologia === 'Precio Unitario' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        <input
                          type="radio"
                          name="tipo_metodologia"
                          value="Precio Unitario"
                          checked={apuForm.tipo_metodologia === 'Precio Unitario'}
                          onChange={(e) => setApuForm({ ...apuForm, tipo_metodologia: e.target.value })}
                          className="text-primary focus:ring-primary w-4 h-4"
                        />
                        <span>Precio Unitario (Cantidad + Rendimiento)</span>
                      </label>
                      <label className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border cursor-pointer transition ${
                        apuForm.tipo_metodologia === 'Costo-Tiempo' ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        <input
                          type="radio"
                          name="tipo_metodologia"
                          value="Costo-Tiempo"
                          checked={apuForm.tipo_metodologia === 'Costo-Tiempo'}
                          onChange={(e) => setApuForm({ ...apuForm, tipo_metodologia: e.target.value })}
                          className="text-primary focus:ring-primary w-4 h-4"
                        />
                        <span>Costo-Tiempo (Arriendo / Recursos en Tiempo)</span>
                      </label>
                    </div>

                    {/* Fila de Inputs de Parámetros */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                      {!isCostoTiempoMode ? (
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                            Rendimiento
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={apuForm.rendimiento_meta ?? ''}
                            onChange={(e) => setApuForm({ ...apuForm, rendimiento_meta: parseFloat(e.target.value) || 0 })}
                            placeholder="25"
                            className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                          />
                          <span className="text-[8px] text-slate-400 block mt-0.5">Unidades/Día</span>
                        </div>
                      ) : (
                        <div className="col-span-1 bg-purple-50 p-2 rounded-xl border border-purple-200 flex flex-col justify-center">
                          <span className="text-[9px] font-extrabold text-purple-800 uppercase">Sin Rendimiento</span>
                          <span className="text-[8px] font-semibold text-purple-650">Metodología en Tiempo</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                          Días Hábiles Mes
                        </label>
                        <input
                          type="number"
                          value={apuForm.dias_habiles_mes ?? ''}
                          onChange={(e) => setApuForm({ ...apuForm, dias_habiles_mes: parseFloat(e.target.value) || 0 })}
                          placeholder="22"
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                        />
                        <span className="text-[8px] text-slate-400 block mt-0.5">Días/Mes</span>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                          Horas Jornada
                        </label>
                        <input
                          type="number"
                          value={apuForm.horas_jornada ?? ''}
                          onChange={(e) => setApuForm({ ...apuForm, horas_jornada: parseFloat(e.target.value) || 0 })}
                          placeholder="9"
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                        />
                        <span className="text-[8px] text-slate-400 block mt-0.5">Horas/Día</span>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1 flex items-center gap-1">
                          <Fuel className="w-3 h-3 text-amber-600" />
                          <span>Diesel ({projectBaseCurrency}/L)</span>
                        </label>
                        <input
                          type="number"
                          value={apuForm.precio_combustible ?? ''}
                          onChange={(e) => setApuForm({ ...apuForm, precio_combustible: parseFloat(e.target.value) || 0 })}
                          placeholder="1050"
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                        />
                        <span className="text-[8px] text-slate-400 block mt-0.5">Precio/Litro</span>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                          Leyes Sociales (%)
                        </label>
                        <input
                          type="number"
                          value={apuForm.leyes_sociales_pct ?? ''}
                          onChange={(e) => setApuForm({ ...apuForm, leyes_sociales_pct: parseFloat(e.target.value) || 0 })}
                          placeholder="35"
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                        />
                        <span className="text-[8px] text-slate-400 block mt-0.5">Mano de Obra</span>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                          Herramientas (%)
                        </label>
                        <input
                          type="number"
                          value={apuForm.herramientas_menores_pct ?? ''}
                          onChange={(e) => setApuForm({ ...apuForm, herramientas_menores_pct: parseFloat(e.target.value) || 0 })}
                          placeholder="5"
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                        />
                        <span className="text-[8px] text-slate-400 block mt-0.5">Mano de Obra</span>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                          Imponderables (%)
                        </label>
                        <input
                          type="number"
                          value={apuForm.imponderables_pct ?? ''}
                          onChange={(e) => setApuForm({ ...apuForm, imponderables_pct: parseFloat(e.target.value) || 0 })}
                          placeholder="5"
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-primary"
                        />
                        <span className="text-[8px] text-slate-400 block mt-0.5">Sobre Subtotal</span>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* SELECCIONAR O CREAR RECURSO */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3 mb-6">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-700 tracking-wider">Añadir Insumos al Análisis</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAddResourceMode('existente')}
                      className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition ${addResourceMode === 'existente' ? 'bg-white text-primary shadow-xs border border-slate-200' : 'text-slate-500'}`}
                    >
                      Seleccionar Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddResourceMode('nuevo')}
                      className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition ${addResourceMode === 'nuevo' ? 'bg-primary text-white shadow-xs' : 'text-slate-500'}`}
                    >
                      ➕ Crear Nuevo Recurso
                    </button>
                  </div>
                </div>

                {/* OPCIÓN 1: EXISTENTE */}
                {addResourceMode === 'existente' && (
                  <div className="flex flex-col sm:flex-row items-end gap-3 pt-1">
                    <div className="flex-1">
                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Catálogo de Recursos del Proyecto</label>
                      <select
                        value={selectedAddResourceId}
                        onChange={(e) => setSelectedAddResourceId(e.target.value)}
                        className="w-full border border-slate-250 rounded-lg p-2 text-xs font-semibold text-slate-700 bg-white uppercase"
                      >
                        <option value="">Selecciona un Recurso...</option>
                        {recursos.map(r => {
                          const rInfo = parseResourceUnitAndCurrency(r.unidad);
                          return (
                            <option key={r.id} value={r.id}>
                              {r.recurso} [{r.tipo}] - {formatCurrencyValue(r.costo_unitario, rInfo.moneda)} / {rInfo.unidad} {r.ciudad ? `(${r.ciudad})` : ''} {r.proveedor ? `- Prov: ${r.proveedor}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddResourceToApu}
                      className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary-hover transition cursor-pointer shrink-0"
                    >
                      Vincular Recurso
                    </button>
                  </div>
                )}

                {/* OPCIÓN 2: NUEVO (INCLUYE MONEDA) */}
                {addResourceMode === 'nuevo' && (
                  <form onSubmit={handleCreateAndLinkNewResource} className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Nombre Recurso / Insumo *</label>
                        <input
                          type="text"
                          required
                          value={newResourceForm.recurso}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, recurso: e.target.value })}
                          placeholder="ej: Fierro Estructural"
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 focus:outline-none focus:border-primary uppercase bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Tipo de Recurso</label>
                        <select
                          value={newResourceForm.tipo}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, tipo: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 bg-white font-semibold"
                        >
                          <option value="Material">Material</option>
                          <option value="Mano de Obra">Mano de Obra</option>
                          <option value="Maquinaria">Maquinaria</option>
                          <option value="Herramientas">Herramientas</option>
                          <option value="Otros">Otros</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Moneda del Costo Particular</label>
                        <select
                          value={newResourceForm.moneda}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, moneda: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 bg-white font-bold"
                        >
                          <option value="CLP">CLP ($)</option>
                          <option value="USD">USD ($)</option>
                          <option value="UF">UF</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Costo Tarifa Particular *</label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={newResourceForm.costo_unitario}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, costo_unitario: e.target.value })}
                          placeholder="ej: 12500"
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Unidad de Medida</label>
                        <input
                          type="text"
                          value={newResourceForm.unidad}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, unidad: e.target.value })}
                          placeholder="ej: kg"
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 uppercase bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Comuna / Ciudad origen</label>
                        <select
                          value={newResourceForm.ciudad}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, ciudad: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 uppercase bg-white"
                        >
                          <option value="">Seleccione Ciudad...</option>
                          {comunasChile.map((c, idx) => (
                            <option key={idx} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Proveedor / Contratista</label>
                        <input
                          type="text"
                          value={newResourceForm.proveedor}
                          onChange={(e) => setNewResourceForm({ ...newResourceForm, proveedor: e.target.value })}
                          placeholder="ej: Sodimac"
                          className="w-full border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 uppercase bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardar en Recursos y Vincular</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* TABLA DE INSUMOS APU CON CONVERSIÓN INDIVIDUAL A MONEDA BASE DEL PROYECTO */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs mb-6">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-655 font-bold text-[9px] uppercase tracking-wider select-none">
                      <th className="p-3">Recurso / Insumo</th>
                      <th className="p-3 w-28">Tipo</th>
                      <th className="p-3 w-40 text-right">Tarifa Original</th>
                      <th className="p-3 w-24 text-center">Moneda</th>
                      <th className="p-3 w-24 text-center">Consumo / Cant.</th>
                      <th className="p-3 w-28 text-center">Consumo Diesel (L/hr)</th>
                      {!isCostoTiempoMode && (
                        <th className="p-3 w-24 text-center">Rend. Coef.</th>
                      )}
                      <th className="p-3 w-40 text-right">Costo Unit. Partida ({projectBaseCurrency})</th>
                      <th className="p-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {apuResources.map((link) => {
                      const res = recursos.find(r => String(r.id) === String(link.recurso_id));
                      if (!res) return null;

                      const qty = parseFloat(link.cantidad_unidad) || 0;
                      const resRend = parseFloat(link.rendimiento) || 1;
                      const originalCost = parseFloat(res.costo_unitario) || 0;
                      
                      const resInfo = parseResourceUnitAndCurrency(res.unidad);
                      // Convertir costo a moneda base del proyecto
                      const unitCost = convertCurrency(originalCost, resInfo.moneda, projectBaseCurrency);

                      const unitStr = resInfo.unidad.toLowerCase().trim();
                      const rendMeta = parseFloat(apuForm.rendimiento_meta) || 1;
                      const diasMes = parseFloat(apuForm.dias_habiles_mes) || 22;
                      const hrsJornada = parseFloat(apuForm.horas_jornada) || 9;
                      const precioDiesel = parseFloat(apuForm.precio_combustible) || 1050;
                      const consumoLh = parseFloat(link.consumo_combustible_lh) || 0;

                      let itemSub = 0;
                      if (!isCostoTiempoMode) {
                        // PRECIO UNITARIO
                        if (res.tipo === 'Maquinaria') {
                          const isTimeUnit = unitStr.includes('mes') || unitStr.includes('mensual') || 
                                             unitStr.includes('hr') || unitStr.includes('hora') || 
                                             unitStr.includes('día') || unitStr.includes('dia') || unitStr.includes('jornada');

                          if (isTimeUnit) {
                            let dailyRate = unitCost;
                            if (unitStr.includes('mes') || unitStr.includes('mensual')) {
                              dailyRate = unitCost / diasMes;
                            } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
                              dailyRate = unitCost * hrsJornada;
                            }

                            const fuelDaily = consumoLh * hrsJornada * precioDiesel;
                            const totalDailyMachine = dailyRate + fuelDaily;
                            itemSub = (totalDailyMachine * qty) / rendMeta;
                          } else {
                            const fuelDaily = consumoLh * hrsJornada * precioDiesel;
                            const fuelPerUnit = rendMeta > 0 ? (fuelDaily * qty) / rendMeta : 0;
                            itemSub = (unitCost * qty * resRend) + fuelPerUnit;
                          }
                        } else if (res.tipo === 'Herramientas') {
                          const isTimeUnit = unitStr.includes('mes') || unitStr.includes('mensual') || 
                                             unitStr.includes('hr') || unitStr.includes('hora') || 
                                             unitStr.includes('día') || unitStr.includes('dia') || unitStr.includes('jornada');

                          if (isTimeUnit) {
                            let dailyRate = unitCost;
                            if (unitStr.includes('mes') || unitStr.includes('mensual')) {
                              dailyRate = unitCost / diasMes;
                            } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
                              dailyRate = unitCost * hrsJornada;
                            }
                            itemSub = (dailyRate * qty) / rendMeta;
                          } else {
                            itemSub = unitCost * qty * resRend;
                          }
                        } else if (res.tipo === 'Mano de Obra') {
                          if (unitStr.includes('mes') || unitStr.includes('mensual')) {
                            const dailyRate = unitCost / diasMes;
                            itemSub = ((dailyRate * qty) / rendMeta);
                          } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
                            const dailyRate = unitCost * hrsJornada;
                            itemSub = ((dailyRate * qty) / rendMeta);
                          } else if (unitStr.includes('día') || unitStr.includes('dia')) {
                            itemSub = (unitCost * qty) / rendMeta;
                          } else {
                            itemSub = unitCost * qty * resRend;
                          }
                        } else {
                          itemSub = unitCost * qty * resRend;
                        }
                      } else {
                        // COSTO-TIEMPO (Cobro directo en tiempo sin rendimiento)
                        let fuelCost = 0;
                        if (res.tipo === 'Maquinaria' && consumoLh > 0) {
                          if (unitStr.includes('mes') || unitStr.includes('mensual')) {
                            fuelCost = (consumoLh * hrsJornada * diasMes * precioDiesel) * qty;
                          } else if (unitStr.includes('hr') || unitStr.includes('hora')) {
                            fuelCost = (consumoLh * precioDiesel) * qty;
                          } else {
                            fuelCost = (consumoLh * hrsJornada * precioDiesel) * qty;
                          }
                        }
                        
                        itemSub = (unitCost * qty) + fuelCost;
                      }

                      const isMach = res.tipo === 'Maquinaria';

                      return (
                        <tr key={link.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-2 font-bold text-slate-800 uppercase">
                            <span>{res.recurso}</span>
                            <span className="block text-[9.5px] text-slate-450 font-normal">
                              {res.ciudad ? `Ubicación: ${res.ciudad}` : ''} {res.proveedor ? `| Prov: ${res.proveedor}` : ''}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              res.tipo === 'Material' ? 'bg-blue-50 text-blue-700' :
                              res.tipo === 'Mano de Obra' ? 'bg-amber-50 text-amber-700' : 
                              res.tipo === 'Maquinaria' ? 'bg-purple-50 text-purple-700' : 
                              res.tipo === 'Herramientas' ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-700'
                            }`}>
                              {res.tipo}
                            </span>
                          </td>
                          <td className="p-2 text-right font-bold text-slate-700">
                            {formatCurrencyValue(originalCost, resInfo.moneda)}
                          </td>
                          <td className="p-2 text-center font-extrabold text-slate-600 uppercase">
                            {resInfo.moneda}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={qty}
                                onChange={(e) => handleUpdateApuResourceField(link.id, 'cantidad_unidad', parseFloat(e.target.value) || 0)}
                                className="w-16 border border-slate-200 focus:ring-1 focus:ring-primary rounded px-1.5 py-0.5 text-xs text-center font-bold text-slate-800 bg-white"
                              />
                              <span className="text-[10px] text-slate-450 uppercase">{resInfo.unidad}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            {isMach ? (
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={consumoLh}
                                  onChange={(e) => handleUpdateApuResourceField(link.id, 'consumo_combustible_lh', parseFloat(e.target.value) || 0)}
                                  className="w-14 border border-slate-200 focus:ring-1 focus:ring-primary rounded px-1.5 py-0.5 text-xs text-center font-bold text-slate-800 bg-white"
                                />
                                <span className="text-[9px] text-slate-450 uppercase">L/hr</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[10px]">-</span>
                            )}
                          </td>
                          {!isCostoTiempoMode && (
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={resRend}
                                onChange={(e) => handleUpdateApuResourceField(link.id, 'rendimiento', parseFloat(e.target.value) || 0)}
                                className="w-14 border border-slate-200 focus:ring-1 focus:ring-primary rounded px-1.5 py-0.5 text-xs text-center font-bold text-slate-800 bg-white"
                              />
                            </td>
                          )}
                          <td className="p-3.5 text-right font-black text-slate-800">
                            {formatCurrencyValue(itemSub, projectBaseCurrency)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteApuResource(link.id)}
                              className="p-1 text-red-655 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {apuResources.length === 0 && (
                      <tr>
                        <td colSpan={!isCostoTiempoMode ? 9 : 8} className="p-8 text-center text-xs text-slate-400 italic">
                          No has vinculado recursos a esta partida. Selecciona uno del catálogo o crea uno nuevo arriba.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* RESUMEN DE SUB-TOTALES POR CATEGORÍA EN MONEDA BASE DEL PROYECTO */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <span className="text-[10px] font-extrabold uppercase text-slate-550 tracking-wider block mb-2">Desglose de Costos de la Partida ($/Unidad en {projectBaseCurrency}):</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-semibold text-slate-700">
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block">Materiales:</span>
                    <span className="text-slate-850 font-bold">{formatCurrencyValue(apuCalc.matSum, projectBaseCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block">Mano Obra (+Leyes):</span>
                    <span className="text-amber-800 font-bold">{formatCurrencyValue(apuCalc.laborTotal, projectBaseCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block">Maquinaria (+Diesel):</span>
                    <span className="text-purple-800 font-bold">{formatCurrencyValue(apuCalc.machSum, projectBaseCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block">Herramientas:</span>
                    <span className="text-rose-800 font-bold">{formatCurrencyValue(apuCalc.herrSum, projectBaseCurrency)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-slate-400 block">Otros Insumos:</span>
                    <span className="text-teal-800 font-bold">{formatCurrencyValue(apuCalc.otrosSum, projectBaseCurrency)}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center font-bold">
                  <span className="uppercase text-slate-600 text-[10px]">Subtotal Directo + Imponderables ({apuForm.imponderables_pct}%):</span>
                  <span className="text-primary font-black text-sm">{formatCurrencyValue(apuCalc.totalUnitario, projectBaseCurrency)}</span>
                </div>
              </div>

              {/* Botones Modal */}
              <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowApuModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleSaveApu}
                  disabled={apuLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{apuLoading ? 'Guardando...' : 'Aplicar Análisis de Partida'}</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* COSTOS INDIRECTOS MODAL */}
      {showIndirectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4.5 h-4.5 text-primary" />
                <span>Configuración de Costos Indirectos ({projectBaseCurrency})</span>
              </h3>
              <button 
                onClick={() => setShowIndirectModal(false)} 
                className="text-slate-400 hover:text-slate-655 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Añade costos indirectos (gastos generales, utilidades, imprevistos). Marca la casilla <strong className="text-purple-900 font-extrabold">[x] Prorratear</strong> en cada fila si deseas absorber ese costo específico directamente dentro de los precios unitarios.
            </p>

            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {indirectCosts.map((cost) => (
                <div key={cost.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2.5 border border-slate-200 rounded-2xl">
                  <input
                    type="text"
                    value={cost.concepto || ''}
                    onChange={(e) => handleUpdateIndirectCostField(cost.id, 'concepto', e.target.value)}
                    placeholder="ej: GASTOS GENERALES"
                    className="flex-1 bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-850 focus:outline-none uppercase font-extrabold"
                  />
                  <select
                    value={cost.tipo}
                    onChange={(e) => handleUpdateIndirectCostField(cost.id, 'tipo', e.target.value)}
                    className="w-32 border border-slate-200 rounded-xl p-2 text-xs bg-white focus:outline-none font-bold text-slate-700"
                  >
                    <option value="Porcentaje">Porcentaje (%)</option>
                    <option value="Monto Fijo">Monto Fijo ($)</option>
                  </select>
                  <input
                    type="number"
                    value={cost.valor ?? ''}
                    onChange={(e) => handleUpdateIndirectCostField(cost.id, 'valor', e.target.value)}
                    placeholder="0"
                    className="w-24 bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 text-center font-bold"
                  />

                  {/* CHECKBOX PRORRATEAR INDIVIDUAL UNO A UNO */}
                  <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-extrabold cursor-pointer transition select-none ${
                    cost.prorratear 
                      ? 'bg-purple-100 text-purple-900 border-purple-300 shadow-xs' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={!!cost.prorratear}
                      onChange={(e) => handleUpdateIndirectCostField(cost.id, 'prorratear', e.target.checked)}
                      className="w-3.5 h-3.5 text-primary focus:ring-primary rounded border-slate-300 cursor-pointer"
                    />
                    <span>Prorratear</span>
                  </label>

                  <button
                    onClick={() => handleDeleteIndirectCostRow(cost.id)}
                    className="p-2 text-red-655 hover:bg-red-50 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {proratedIndirectCosts.length > 0 && (
              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 text-xs text-purple-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="leading-snug">
                  Los costos seleccionados ({proratedIndirectCosts.map(c => c.concepto).join(', ')}) incrementarán ponderadamente los Precios Unitarios en un <strong className="font-black text-purple-950">+{proratePctIncrement}%</strong> ({formatCurrencyValue(totalProratedIndirectValue, projectBaseCurrency)}).
                </span>
              </div>
            )}

            <div className="flex justify-between items-center border-t border-slate-100 pt-4">
              <button
                onClick={handleAddIndirectCostRow}
                className="flex items-center gap-1 bg-slate-50 border border-slate-250 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Añadir Fila de Costo Indirecto</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowIndirectModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveIndirectCosts}
                  disabled={indirectLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{indirectLoading ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREAR NUEVO PROYECTO MODAL */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <FolderPlus className="w-4.5 h-4.5 text-primary" />
                <span>Nuevo Proyecto de Presupuesto</span>
              </h3>
              <button 
                onClick={() => setShowCreateProjectModal(false)} 
                className="text-slate-400 hover:text-slate-655 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Nombre del Proyecto / Faena *</label>
                <input
                  type="text"
                  required
                  value={newProjectData.nombre}
                  onChange={(e) => setNewProjectData({ ...newProjectData, nombre: e.target.value })}
                  placeholder="ej: Edificio Costanera"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary uppercase"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Cliente / Mandante</label>
                <input
                  type="text"
                  value={newProjectData.cliente}
                  onChange={(e) => setNewProjectData({ ...newProjectData, cliente: e.target.value })}
                  placeholder="ej: Constructora Alerce Ltda."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Comuna (Chile)</label>
                  <select
                    value={newProjectData.comuna}
                    onChange={(e) => setNewProjectData({ ...newProjectData, comuna: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-707 focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="">Seleccione Comuna...</option>
                    {comunasChile.map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-455 mb-1">Dirección / Faena</label>
                  <input
                    type="text"
                    value={newProjectData.ubicacion}
                    onChange={(e) => setNewProjectData({ ...newProjectData, ubicacion: e.target.value })}
                    placeholder="ej: Av. Ossa 235"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Tipo de Proyecto</label>
                  <select
                    value={newProjectData.tipo_proyecto}
                    onChange={(e) => setNewProjectData({ ...newProjectData, tipo_proyecto: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-705 focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="Privado">Privado</option>
                    <option value="Público">Público</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Moneda Base del Proyecto</label>
                  <select
                    value={newProjectData.moneda_base}
                    onChange={(e) => setNewProjectData({ ...newProjectData, moneda_base: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-705 focus:outline-none focus:border-primary bg-white font-bold"
                  >
                    <option value="CLP">CLP ($)</option>
                    <option value="USD">USD ($)</option>
                    <option value="UF">UF</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Plazo de Entrega (Días)</label>
                  <input
                    type="number"
                    value={newProjectData.plazo_estimado}
                    onChange={(e) => setNewProjectData({ ...newProjectData, plazo_estimado: e.target.value })}
                    placeholder="ej: 120"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Presupuesto Límite (En Moneda Base)</label>
                  <input
                    type="number"
                    value={newProjectData.presupuesto_estimado}
                    onChange={(e) => setNewProjectData({ ...newProjectData, presupuesto_estimado: e.target.value })}
                    placeholder="ej: 5000"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingProyectos}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" />
                <span>Crear Proyecto e Iniciar</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
