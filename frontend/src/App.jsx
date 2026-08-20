import React, { useEffect, useMemo, useState } from 'react';
import { 
  LogOut, LayoutDashboard, Building2, Users, Truck, ShieldAlert, Settings, Info, Menu, X, Loader2,
  Layers, Handshake, Receipt, Coins, ClipboardCheck, Boxes, BadgeCheck,
  Hammer, ChevronLeft, ChevronRight, Search, Star
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { getAuthenticatedProfile } from './utils/auth';
import { recoverFromStaleChunk } from './utils/staleChunkRecovery';

// Cada módulo operativo se descarga solo cuando el usuario lo abre. Esto acelera el ingreso al portal y al dashboard.
// Si Vercel publica una versión nueva mientras el portal está abierto, los archivos con hash de la versión anterior pueden dejar de existir.
// Ante ese caso se recarga una sola vez para obtener los módulos vigentes.
const lazyWithRetry = (importModule, moduleName) => React.lazy(async () => {
  try {
    return await importModule();
  } catch (error) {
    if (recoverFromStaleChunk(error)) {
      return new Promise(() => {});
    }
    console.error(`No fue posible cargar el módulo ${moduleName}:`, error);
    throw error;
  }
});

const Login = lazyWithRetry(() => import('./components/Login'), 'login');
const LandingPage = lazyWithRetry(() => import('./components/LandingPage'), 'landing');
const Obras = lazyWithRetry(() => import('./components/Obras'), 'obras');
const Personal = lazyWithRetry(() => import('./components/Personal'), 'personal');
const Maquinaria = lazyWithRetry(() => import('./components/Maquinaria'), 'maquinaria');
const ConfigCorreos = lazyWithRetry(() => import('./components/ConfigCorreos'), 'config-correos');
const PresupuestosPlanif = lazyWithRetry(() => import('./components/PresupuestosPlanif'), 'presupuestos');
const Prevencion = lazyWithRetry(() => import('./components/Prevencion'), 'prevencion');
const CalidadObras = lazyWithRetry(() => import('./components/CalidadObras'), 'calidad');
const Facturacion = lazyWithRetry(() => import('./components/FacturacionV2'), 'facturacion');
const BodegaEmpresa = lazyWithRetry(() => import('./components/BodegaEmpresa'), 'bodega');
const RendicionGastos = lazyWithRetry(() => import('./components/RendicionGastos'), 'gastos');
const Acreditaciones = lazyWithRetry(() => import('./components/Acreditaciones'), 'acreditaciones');
const FormulariosCapacitaciones = lazyWithRetry(() => import('./components/FormulariosCapacitaciones'), 'formularios');
const PublicFormFiller = lazyWithRetry(() => import('./components/PublicFormFiller'), 'formulario-publico');
const PublicTrainingFiller = lazyWithRetry(() => import('./components/PublicTrainingFiller'), 'capacitacion-publica');
const PublicSubcontractAcreditacion = lazyWithRetry(() => import('./components/PublicSubcontractAcreditacion'), 'subcontrato-publico');
const SubcontractOperationsPortal = lazyWithRetry(() => import('./components/SubcontractOperationsPortal'), 'operacion-subcontrato');
const PublicSupplierAcreditacion = lazyWithRetry(() => import('./components/PublicSupplierAcreditacion'), 'proveedor-publico');
const PublicReporteDiarioMaquinaria = lazyWithRetry(() => import('./components/PublicReporteDiarioMaquinaria'), 'maquinaria-publica');
const PublicEstadoPago = lazyWithRetry(() => import('./components/PublicEstadoPago'), 'estado-pago-publico');
const PublicLibroObra = lazyWithRetry(() => import('./components/PublicLibroObra'), 'libro-obra-publico');
const ClientesPortal = lazyWithRetry(() => import('./components/ClientesPortal'), 'clientes');
const GestionMandante = lazyWithRetry(() => import('./components/GestionMandante'), 'mandante');
const PublicClientePortal = lazyWithRetry(() => import('./components/PublicClientePortal'), 'portal-cliente');
const PublicMandantePortal = lazyWithRetry(() => import('./components/PublicMandantePortal'), 'portal-mandante');
const FloatingOX = lazyWithRetry(() => import('./components/FloatingOX'), 'ox');
const PlatformNotificationCenter = lazyWithRetry(() => import('./components/PlatformNotificationCenter'), 'notificaciones-plataforma');

function ModuleLoader() {
  return (
    <div className="min-h-72 flex flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className="w-7 h-7 text-primary animate-spin" />
      <span className="text-xs font-bold">Cargando módulo…</span>
    </div>
  );
}

const moduleGroups = [
  { label: 'Proyectos', ids: ['obras', 'presupuestos'] },
  { label: 'Operación', ids: ['rrhh', 'maquinaria', 'bodega'] },
  { label: 'Control y cumplimiento', ids: ['prevencion', 'formularios_capacitaciones', 'acreditaciones', 'calidad'] },
  { label: 'Administración', ids: ['clientes', 'mandante', 'facturacion', 'gastos'] },
];

function GroupedModuleLinks({ modules, currentModule, onSelect }) {
  return moduleGroups.map(group => {
    const entries = modules.filter(module => group.ids.includes(module.id));
    if (!entries.length) return null;
    return <div key={group.label} className="space-y-1.5">
      <p className="px-3 pt-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{group.label}</p>
      {entries.map(module => <button key={module.id} onClick={() => onSelect(module)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer text-left ${currentModule === module.id ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><span className="shrink-0">{module.sidebarIcon}</span><span className="leading-snug flex-1 min-w-0">{module.sidebarTitle || module.title}</span></button>)}
    </div>;
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedCompanyOverride, setSelectedCompanyOverride] = useState(null);
  const [empresasList, setEmpresasList] = useState([]);
  const [path, setPath] = useState(window.location.pathname);

  const navigateTo = (newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  // Escuchar popstate
  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [companyBranding, setCompanyBranding] = useState(() => {
    try {
      const saved = localStorage.getItem('obraxis_company_branding');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.color_primario) {
          document.documentElement.style.setProperty('--primary-color', parsed.color_primario);
        }
        if (parsed?.color_secundario) {
          document.documentElement.style.setProperty('--primary-color-hover', parsed.color_secundario);
        }
        return parsed;
      }
    } catch {}
    return null;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer toggle
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true); // Desktop sidebar collapse toggle
  const [, setObras] = useState([]);
  const [, setObrasLoading] = useState(false);
  const [selectedObraName, setSelectedObraName] = useState(null);
  const [oxObra, setOxObra] = useState(null);
  const [oxDestination, setOxDestination] = useState(null);

  const activeUserContext = useMemo(() => user
    ? (selectedCompanyOverride ? { ...user, empresa: selectedCompanyOverride } : user)
    : null, [selectedCompanyOverride, user]);

  // Favoritos guardados en localStorage
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('obraxis_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [moduleSearch, setModuleSearch] = useState('');
  const [runtimeConfig, setRuntimeConfig] = useState({ mantenimiento_activo: false, mensaje_mantenimiento: '' });

  useEffect(() => {
    let active = true;
    supabase.functions.invoke('runtime-config', { body: {} }).then(({ data }) => {
      if (active && data?.data) setRuntimeConfig(data.data);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Restaurar y validar la sesión administrada por Supabase Auth.
  useEffect(() => {
    let active = true;

    const clearLocalUser = () => {
      localStorage.removeItem('obraxis_user');
      if (active) setUser(null);
    };

    const restoreSession = async () => {
      try {
        // getUser validates the token with Supabase Auth before protected UI is shown.
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return clearLocalUser();
        const profile = await getAuthenticatedProfile(data.user);
        if (active) setUser(profile);
      } catch (error) {
        console.error('No se pudo restaurar la sesión:', error);
        clearLocalUser();
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    restoreSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearLocalUser();
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Cargar lista de empresas si el usuario es superusuario
  useEffect(() => {
    const rBase = (user?.rol_base || user?.rol || 'Inspector').toLowerCase();
    if (user && user.empresa === 'Obraxis' && rBase === 'superusuario') {
      async function fetchCompanies() {
        try {
          const { data } = await supabase.from('config_empresa').select('empresa');
          if (data) {
            setEmpresasList(data.map(d => d.empresa));
          }
        } catch (e) {
          console.error('Error al cargar empresas:', e);
        }
      }
      fetchCompanies();
    } else {
      setEmpresasList([]);
      setSelectedCompanyOverride(null);
    }
  }, [user]);

  // Cargar identidad visual de la empresa activa
  useEffect(() => {
    if (!activeUserContext) return;
    async function fetchObras() {
      setObrasLoading(true);
      try {
        const { data, error } = await supabase.from('obras').select('*').eq('empresa', activeUserContext.empresa).order('nombre', { ascending: true });
        if (error) throw error;
        const permisoStr = activeUserContext.obras ? activeUserContext.obras.toString().trim().toLowerCase() : '';
        const obrasPermitidasArr = permisoStr.split(',').map(item => item.trim());
        const esTodas = obrasPermitidasArr.includes('todas') || (activeUserContext.rol_base || activeUserContext.rol || 'Inspector').toLowerCase() === 'superusuario';
        setObras((data || []).filter(item => item.nombre && (esTodas || obrasPermitidasArr.includes(item.nombre.toString().trim().toLowerCase()))));
      } catch (error) {
        console.error('Error cargando obras en App:', error.message);
      } finally {
        setObrasLoading(false);
      }
    }
    async function fetchBranding() {
      try {
        let data = null;
        const { data: brandData, error: brandErr } = await supabase
          .from('config_empresa')
          .select('logo_base64, color_primario, color_secundario, modulos_activos')
          .eq('empresa', activeUserContext.empresa)
          .maybeSingle();

        if (brandErr && brandErr.message.includes('column')) {
          // Fallback en caso de que no existan las columnas de IA en la tabla config_empresa
          const { data: fallbackData, error: fallbackErr } = await supabase
            .from('config_empresa')
            .select('logo_base64, color_primario, color_secundario, modulos_activos')
            .eq('empresa', activeUserContext.empresa)
            .maybeSingle();
          if (fallbackErr) throw fallbackErr;
          data = fallbackData;
        } else if (brandErr) {
          throw brandErr;
        } else {
          data = brandData;
        }
        
        if (data) {
          setCompanyBranding(data);
          try { localStorage.setItem('obraxis_company_branding', JSON.stringify(data)); } catch{}
          document.documentElement.style.setProperty('--primary-color', data.color_primario || '#1e3a8a');
          document.documentElement.style.setProperty('--primary-color-hover', data.color_secundario || '#1d4ed8');
        } else {
          setCompanyBranding(null);
          document.documentElement.style.setProperty('--primary-color', '#1e3a8a');
          document.documentElement.style.setProperty('--primary-color-hover', '#1d4ed8');
        }
      } catch (err) {
        console.error('Error al cargar branding en App:', err);
      }
    }
    fetchBranding();
    fetchObras();
  }, [activeUserContext]);

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

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('obraxis_user', JSON.stringify(userData));
    setCurrentModule('dashboard');
    setSelectedObraName(null);
    navigateTo('/dashboard');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('obraxis_user');
    setCurrentModule('dashboard');
    setSelectedObraName(null);
    navigateTo('/');
  };

  const openNotificationDestination = (notification) => {
    const code = String(notification?.evento_codigo || '').toLowerCase();
    const module = code.startsWith('maquinaria_') || code.startsWith('mantenimiento_') ? 'maquinaria'
      : code.startsWith('rrhh_') || code.startsWith('personal_') ? 'rrhh'
      : code.startsWith('prevencion_') || code.startsWith('cumplimiento_') ? 'prevencion'
      : code.startsWith('calidad_') || code.startsWith('rdi_') || code.startsWith('nc_') ? 'calidad'
      : code.startsWith('acreditacion_') ? 'acreditaciones'
      : code.startsWith('bodega_') ? 'bodega'
      : code.startsWith('facturacion_') || code.startsWith('dte_') ? 'facturacion'
      : code.startsWith('gastos_') ? 'gastos'
      : 'obras';
    setSelectedObraName(notification?.obra_nombre || null);
    setCurrentModule(module);
    navigateTo('/dashboard');
  };

  // Detectar si se está accediendo a un formulario o capacitación pública de prevención a través de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const publicAsistenciaToken = urlParams.get('asistencia');
  const publicEquipoArriendo = urlParams.get('maquinaria_token') || urlParams.get('arriendo_qr') || urlParams.get('reporte_diario_equipo');
  const publicEstadoPagoToken = urlParams.get('estado_pago');
  const publicLibroObraToken = urlParams.get('libro_obra');
  const publicClienteToken = urlParams.get('cliente_portal');
  const publicMandanteToken = urlParams.get('mandante_portal');
  // Los QR antiguos apuntan a la raíz y los nuevos a /login. En ambos casos
  // se abre directamente el marcaje, nunca el landing comercial.
  if (publicAsistenciaToken) {
    return <React.Suspense fallback={<ModuleLoader />}><Login onLoginSuccess={handleLoginSuccess} onBackHome={() => navigateTo('/')} /></React.Suspense>;
  }
  if (publicMandanteToken) {
    return <React.Suspense fallback={<ModuleLoader />}><PublicMandantePortal token={publicMandanteToken} /></React.Suspense>;
  }
  if (publicClienteToken) {
    return <React.Suspense fallback={<ModuleLoader />}><PublicClientePortal token={publicClienteToken} /></React.Suspense>;
  }
  if (publicLibroObraToken) {
    return <React.Suspense fallback={<ModuleLoader />}><PublicLibroObra token={publicLibroObraToken} /></React.Suspense>;
  }
  if (publicEstadoPagoToken) {
    return <React.Suspense fallback={<ModuleLoader />}><PublicEstadoPago token={publicEstadoPagoToken} role={urlParams.get('rol_ep') === 'aprobacion' ? 'aprobacion' : 'revision'} /></React.Suspense>;
  }
  if (publicEquipoArriendo) {
    return <React.Suspense fallback={<ModuleLoader />}><PublicReporteDiarioMaquinaria token={publicEquipoArriendo} /></React.Suspense>;
  }

  const publicFormToken = urlParams.get('prevencion_form');
  if (publicFormToken) {
    return <React.Suspense fallback={<ModuleLoader />}><PublicFormFiller formToken={publicFormToken} /></React.Suspense>;
  }
  const publicTrainingToken = urlParams.get('prevencion_capacitacion');
  if (publicTrainingToken) {
    return <React.Suspense fallback={<ModuleLoader />}><PublicTrainingFiller trainingToken={publicTrainingToken} /></React.Suspense>;
  }

  const publicSubcontractToken = urlParams.get('acreditacion_token') || (urlParams.get('acreditacion_subcontrato') ? urlParams.get('token') : null);
  const publicSubcontractOperationToken = urlParams.get('subcontrato_operacion');
  const publicSubcontractEmpresa = urlParams.get('acreditacion_subcontrato');
  const publicSupplierEmpresa = urlParams.get('acreditacion_proveedor');

  if (publicSubcontractOperationToken) {
    return <React.Suspense fallback={<ModuleLoader/>}><SubcontractOperationsPortal token={publicSubcontractOperationToken}/></React.Suspense>;
  }
  if (publicSupplierEmpresa || (publicSubcontractToken && urlParams.get('type') === 'proveedor')) {
    return <React.Suspense fallback={<ModuleLoader />}><PublicSupplierAcreditacion token={publicSubcontractToken} companyNameParam={publicSupplierEmpresa} /></React.Suspense>;
  }
  if (publicSubcontractToken || publicSubcontractEmpresa) {
    return <React.Suspense fallback={<ModuleLoader />}><PublicSubcontractAcreditacion token={publicSubcontractToken} companyNameParam={publicSubcontractEmpresa} /></React.Suspense>;
  }

  // --- CONTROL DE RUTAS OFICIAL OBRAXIS ---
  const rawPath = (path || '').toLowerCase();
  const normalizedPath = rawPath.endsWith('/') && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;

  if (authLoading) return <ModuleLoader />;

  // 1. Ruta /login -> Inicio de Sesión y Marcación QR
  if (normalizedPath === '/login') {
    return (
      <React.Suspense fallback={<ModuleLoader />}><Login
        onLoginSuccess={handleLoginSuccess}
        onBackHome={() => navigateTo('/')}
      /></React.Suspense>
    );
  }

  // 2. Ruta / (Raíz), /home o /landing -> Home & Landing Page Oficial Obraxis
  if (normalizedPath === '/' || normalizedPath === '' || normalizedPath === '/home' || normalizedPath === '/landing' || normalizedPath.endsWith('/index.html')) {
    return (
      <React.Suspense fallback={<ModuleLoader />}><LandingPage
        user={user}
        onGoToLogin={() => navigateTo('/login')}
        onGoToDashboard={() => navigateTo('/dashboard')}
      /></React.Suspense>
    );
  }

  // 3. Ruta /dashboard o submódulos (Entorno de Trabajo de Proyectos)
  // Si el usuario intenta acceder al dashboard sin iniciar sesión, ir a /login
  if (!user) {
    return <React.Suspense fallback={<ModuleLoader />}><Login onLoginSuccess={handleLoginSuccess} onBackHome={() => navigateTo('/')} /></React.Suspense>;
  }

  const isGlobalObraxisAdmin = user.empresa === 'Obraxis' && ['superusuario', 'superadmin'].includes(String(user.rol_base || user.rol || '').toLowerCase());
  if (runtimeConfig.mantenimiento_activo && !isGlobalObraxisAdmin) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6"><div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-2xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Hammer className="h-8 w-8" /></div><h1 className="mt-5 text-2xl font-black text-slate-900">Mejoras programadas</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">{runtimeConfig.mensaje_mantenimiento || 'Estamos realizando mejoras programadas. Intenta nuevamente en unos minutos.'}</p><p className="mt-5 text-xs text-slate-400">{runtimeConfig.correo_soporte ? `Soporte: ${runtimeConfig.correo_soporte}` : 'Equipo Obraxis'}</p><button type="button" onClick={handleLogout} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black text-white">Cerrar sesión</button></div></div>;
  }

  // Parsear módulos permitidos del usuario
  const modulosPermitidos = user.modulos
    ? user.modulos.split(',').map((m) => m.trim().toLowerCase())
    : [];

  // Módulos habilitados para la empresa actual (Obraxis siempre tiene todos los módulos habilitados)
  const modulosActivosEmpresa = (companyBranding && companyBranding.modulos_activos && user.empresa !== 'Obraxis')
    ? companyBranding.modulos_activos.split(',').map(m => m.trim().toLowerCase()).filter(Boolean)
    : null; // Si es nulo o es Obraxis, por defecto todos están habilitados para la empresa

  const allModulesList = [
    {
      id: 'obras',
      title: 'Proyectos y Obras Activas',
      description: 'Control diario de producción, asistencia, maquinaria e inventario en faena.',
      icon: <Building2 className="w-5 h-5" />,
      sidebarIcon: <Building2 className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('obras'); }
    },
    {
      id: 'rrhh',
      title: 'Recursos Humanos',
      description: 'Control de personal, asignación de trabajadores a proyectos y fichas.',
      icon: <Users className="w-5 h-5" />,
      sidebarIcon: <Users className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('rrhh'); }
    },
    {
      id: 'maquinaria',
      title: 'Gestión de Maquinaria',
      description: 'Alta de equipos, asignación directa, disponibilidad y requerimientos.',
      icon: <Truck className="w-5 h-5" />,
      sidebarIcon: <Truck className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('maquinaria'); }
    },
    {
      id: 'prevencion',
      title: 'Prevención de Riesgos',
      description: 'Reportes de seguridad, observaciones en terreno y control de incidentes.',
      icon: <ShieldAlert className="w-5 h-5" />,
      sidebarIcon: <ShieldAlert className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('prevencion'); }
    },
    {
      id: 'formularios_capacitaciones',
      title: 'Formularios y Capacitaciones',
      sidebarTitle: 'Formularios y Capacitación',
      description: 'Gestor dinámico de formularios, listas de chequeo, charlas de seguridad y capacitaciones.',
      icon: <ClipboardCheck className="w-5 h-5" />,
      sidebarIcon: <ClipboardCheck className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('formularios_capacitaciones'); }
    },
    {
      id: 'acreditaciones',
      title: 'Acreditaciones',
      description: 'Gestión de acreditaciones de personal y maquinaria para ingreso a faenas.',
      icon: <BadgeCheck className="w-5 h-5" />,
      sidebarIcon: <BadgeCheck className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('acreditaciones'); }
    },
    {
      id: 'calidad',
      title: 'Calidad Global',
      description: 'Vista corporativa de PAC, RDI y no conformidades entre todas las obras.',
      icon: <ClipboardCheck className="w-5 h-5" />,
      sidebarIcon: <ClipboardCheck className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('calidad'); }
    },
    {
      id: 'bodega',
      title: 'Bodega e Inventario',
      description: 'Control de inventario, stock mínimo, entradas y salidas de herramientas.',
      icon: <Boxes className="w-5 h-5" />,
      sidebarIcon: <Boxes className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('bodega'); }
    },
    {
      id: 'presupuestos',
      title: 'Presupuestos',
      description: 'Gestión de estimaciones de costos, diagramas Gantt y recursos del proyecto.',
      icon: <Layers className="w-5 h-5" />,
      sidebarIcon: <Layers className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('presupuestos'); }
    },
    {
      id: 'clientes',
      title: 'Gestión de Clientes',
      description: 'Seguimiento de relaciones comerciales, contactos y propuestas.',
      icon: <Handshake className="w-5 h-5" />,
      sidebarIcon: <Handshake className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('clientes'); }
    },
    {
      id: 'mandante',
      title: 'Gestión del Mandante',
      description: 'Control contractual para mandantes y propietarios, con empresas conectadas, portales externos y acreditaciones.',
      icon: <Building2 className="w-5 h-5" />,
      sidebarIcon: <Building2 className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('mandante'); }
    },
    {
      id: 'facturacion',
      title: 'Facturación Electrónica',
      description: 'Emisión de facturas electrónicas, control tributario y cobros integrados.',
      icon: <Receipt className="w-5 h-5" />,
      sidebarIcon: <Receipt className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('facturacion'); }
    },
    {
      id: 'gastos',
      title: 'Rendición de Gastos',
      description: 'Control y aprobación de rendiciones, caja chica e informes de viáticos.',
      icon: <Coins className="w-5 h-5" />,
      sidebarIcon: <Coins className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('gastos'); }
    }
  ];

  const visibleModules = allModulesList.filter(m => {
    // 1. Filtrar por permisos del usuario
    const permitidoUsuario = modulosPermitidos.includes(m.id) || (user.rol_base || user.rol || 'Inspector').toLowerCase() === 'superusuario';
    if (!permitidoUsuario) return false;

    // 2. Si el rol es superusuario global de Obraxis, tiene acceso a todo de todas formas
    if ((user.rol_base || user.rol || 'Inspector').toLowerCase() === 'superusuario' && user.empresa === 'Obraxis') return true;

    // 3. Filtrar por módulos habilitados para la empresa (el módulo 'admin' siempre está activo para el Panel de Control)
    if (m.id === 'admin') return true;
    if (modulosActivosEmpresa) {
      return modulosActivosEmpresa.includes(m.id);
    }
    return true;
  });
  const dashboardModules = visibleModules
    .filter(module => `${module.title} ${module.description}`.toLowerCase().includes(moduleSearch.trim().toLowerCase()))
    .sort((left, right) => Number(favorites.includes(right.id)) - Number(favorites.includes(left.id)) || left.title.localeCompare(right.title));

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">
      
      {/* SIDEBAR NAVIGATION (Desktop) */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-40 transition-all duration-300 ${
        desktopSidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0'
      }`}>
        
        {/* Brand/Logo Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 min-h-[73px]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <img 
              src={companyBranding?.logo_base64 || '/brand/obraxis-primary.png'}
              className="w-10 h-10 object-contain shrink-0" 
              alt="Obraxis Icon" 
            />
            <div className="flex flex-col min-w-0">
              <span className="text-slate-800 font-extrabold text-[13px] tracking-wide uppercase leading-tight">Obraxis</span>
              <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider truncate leading-none mt-0.5">
                {activeUserContext?.empresa || 'Obraxis'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setDesktopSidebarOpen(false)}
            title="Ocultar menú lateral"
            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Cambiador de Empresa para Superusuario Obraxis (Escritorio) */}
        {user && user.empresa === 'Obraxis' && (user.rol_base || user.rol || 'Inspector').toLowerCase() === 'superusuario' && empresasList.length > 0 && (
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-1.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>Trabajar en Empresa</span>
            </div>
            <select
              value={selectedCompanyOverride || 'Obraxis'}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCompanyOverride(val === 'Obraxis' ? null : val);
              }}
              className="w-full bg-white border border-slate-250 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-primary cursor-pointer shadow-2xs"
            >
              <option value="Obraxis">Obraxis (Global)</option>
              {empresasList.filter(c => c !== 'Obraxis').map((c, idx) => (
                <option key={idx} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* User Info Card */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
            {user.usuario.substring(0, 2)}
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="text-xs font-bold text-slate-800 truncate">{user.usuario}</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{user.rol}</p>
          </div>
          <React.Suspense fallback={null}><PlatformNotificationCenter user={activeUserContext} onNavigate={openNotificationDestination}/></React.Suspense>
        </div>

        {/* Menu Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {/* Dashboard/Inicio */}
          <button
            onClick={() => {
              setSelectedObraName(null);
              setCurrentModule('dashboard');
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentModule === 'dashboard'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <div className="border-t border-slate-150 my-2" />

          {/* Listado plano de módulos dinámicos */}
          <GroupedModuleLinks modules={visibleModules.filter(m => m.id !== 'admin')} currentModule={currentModule} onSelect={module => module.action()} />

          {/* Panel de Administración en la base si corresponde */}
          {(modulosPermitidos.includes('admin') || (user.rol_base || user.rol || 'Inspector').toLowerCase() === 'superusuario') && (
            <>
              <div className="border-t border-slate-150 my-2" />
              <button
                onClick={() => {
                  setSelectedObraName(null);
                  setCurrentModule('admin');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentModule === 'admin'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Panel de Control</span>
              </button>
            </>
          )}
        </nav>

        {/* Logout at bottom */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-650 hover:bg-red-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Floating button to restore desktop sidebar */}
      {!desktopSidebarOpen && (
        <button
          onClick={() => setDesktopSidebarOpen(true)}
          title="Mostrar menú lateral"
          className="hidden md:flex items-center justify-center w-10 h-10 bg-white border border-slate-200 rounded-r-xl shadow-md fixed bottom-6 left-0 z-50 text-slate-600 hover:text-slate-900 transition-all hover:pl-2 cursor-pointer border-l-0"
        >
          <ChevronRight className="w-5 h-5 text-primary" />
        </button>
      )}

      {/* MOBILE HEADER & DRAWER SIDEBAR */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        desktopSidebarOpen ? 'md:pl-64' : 'md:pl-0'
      }`}>
        <header className="md:hidden bg-primary text-white p-4 flex justify-between items-center shadow-md z-30 transition-all">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-1 hover:bg-white/10 rounded-lg cursor-pointer transition"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">Obraxis</h1>
          </div>
          <div className="flex items-center gap-2">
            <React.Suspense fallback={null}><PlatformNotificationCenter compact user={activeUserContext} onNavigate={openNotificationDestination}/></React.Suspense>
            <span className="text-[10px] font-bold bg-white/15 px-2.5 py-1 rounded-full uppercase">{activeUserContext?.empresa || 'Obraxis'}</span>
          </div>
        </header>

        {/* Mobile Slide-over Drawer */}
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Sidebar drawer content */}
            <aside className="fixed inset-y-0 left-0 w-64 bg-white z-50 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200 md:hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img 
                    src={companyBranding?.logo_base64 || '/brand/obraxis-primary.png'}
                    className="w-8 h-8 object-contain shrink-0" 
                    alt="Obraxis Icon" 
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-slate-800 font-extrabold text-[12px] tracking-wide uppercase leading-tight">Obraxis</span>
                    <span className="text-slate-400 font-black text-[8px] uppercase tracking-wider truncate leading-none mt-0.5">
                      {activeUserContext?.empresa || 'Obraxis'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg cursor-pointer">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Cambiador de Empresa para Superusuario Obraxis (Móvil) */}
              {user && user.empresa === 'Obraxis' && (user.rol_base || user.rol || 'Inspector').toLowerCase() === 'superusuario' && empresasList.length > 0 && (
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-1 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>Trabajar en Empresa</span>
                  </div>
                  <select
                    value={selectedCompanyOverride || 'Obraxis'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCompanyOverride(val === 'Obraxis' ? null : val);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl p-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-primary cursor-pointer shadow-2xs"
                  >
                    <option value="Obraxis">Obraxis (Global)</option>
                    {empresasList.filter(c => c !== 'Obraxis').map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* User info */}
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs uppercase">
                  {user.usuario.substring(0, 2)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{user.usuario}</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{user.rol}</p>
                </div>
              </div>

              {/* Navigation links */}
              <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedObraName(null);
                    setCurrentModule('dashboard');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    currentModule === 'dashboard'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>

                <div className="border-t border-slate-150 my-2" />

                {/* Módulos en formato plano */}
                <GroupedModuleLinks modules={visibleModules.filter(m => m.id !== 'admin')} currentModule={currentModule} onSelect={module => { module.action(); setSidebarOpen(false); }} />

                {(modulosPermitidos.includes('admin') || (user.rol_base || user.rol || 'Inspector').toLowerCase() === 'superusuario') && (
                  <>
                    <div className="border-t border-slate-150 my-2" />
                    <button
                      onClick={() => {
                        setSelectedObraName(null);
                        setCurrentModule('admin');
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        currentModule === 'admin'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Panel de Control</span>
                    </button>
                  </>
                )}
              </nav>

              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-650 hover:bg-red-50 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </aside>
          </>
        )}

        {/* MAIN PANEL CONTENT (Desktop & Mobile) */}
        <main className="p-3 sm:p-5 lg:p-8 flex-1 max-w-7xl w-full mx-auto space-y-5 sm:space-y-6">
          <React.Suspense fallback={<ModuleLoader />}>
          {currentModule === 'dashboard' ? (
            <div className="space-y-6">
                  {/* Dashboard Banner/Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 border border-slate-200 rounded-3xl shadow-xs">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Módulos de Gestión</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Selecciona un módulo para comenzar a trabajar.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl uppercase tracking-wide">
                    Empresa: {activeUserContext?.empresa || 'Obraxis'}
                  </span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl uppercase tracking-wide">
                    Rol: {user.rol}
                  </span>
                </div>
              </div>

              {/* Grid de Módulos (Forma rectangular, sin imágenes) */}
              <div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={moduleSearch} onChange={event => setModuleSearch(event.target.value)} placeholder="Buscar un módulo o una tarea…" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></div>
              <p className="text-xs text-slate-500">{favorites.length ? 'Los módulos marcados con estrella aparecen primero.' : 'Marca con estrella los módulos que utilizas a diario.'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {dashboardModules.map((m) => (
                  <div
                    key={m.id}
                    onClick={m.action}
                    className="group bg-white border border-slate-250 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden flex items-start gap-4 min-h-[110px]"
                  >
                    {/* Dot Indicador (Azul) */}
                    <button onClick={event => toggleFavorite(event, m.id)} title={favorites.includes(m.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'} className={`absolute right-3 top-3 rounded-lg p-1.5 transition ${favorites.includes(m.id) ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:bg-slate-100 hover:text-amber-500'}`}><Star className={`h-4 w-4 ${favorites.includes(m.id) ? 'fill-current' : ''}`} /></button>
                    
                    {/* Icono del Módulo */}
                    <div className="p-3.5 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-white transition-all duration-300 mt-1">
                      {m.icon}
                    </div>

                    {/* Info del Módulo */}
                    <div className="flex-1 space-y-1 pl-1">
                      <h3 className="font-extrabold text-slate-800 text-xs tracking-wide leading-snug group-hover:text-primary transition uppercase">
                        {m.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        {m.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {!dashboardModules.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No encontramos un módulo con ese nombre. Prueba con “obras”, “seguridad” o “personal”.</div>}
            </div>
          ) : currentModule === 'obras' ? (
            <Obras 
              user={activeUserContext} 
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }} 
              initialObraName={selectedObraName}
              companyBranding={companyBranding}
              onOXContextChange={setOxObra}
              oxDestination={oxDestination}
              onOXDestinationHandled={() => setOxDestination(null)}
            />
          ) : currentModule === 'rrhh' ? (
            <Personal user={activeUserContext} onBack={() => {
              setSelectedObraName(null);
              setCurrentModule('dashboard');
            }} />
          ) : currentModule === 'maquinaria' ? (
            <Maquinaria user={activeUserContext} onBack={() => {
              setSelectedObraName(null);
              setCurrentModule('dashboard');
            }} />
          ) : currentModule === 'admin' ? (
            <ConfigCorreos user={activeUserContext} onBack={() => {
              setSelectedObraName(null);
              setCurrentModule('dashboard');
            }} />
          ) : currentModule === 'presupuestos' ? (
            <PresupuestosPlanif 
              user={activeUserContext} 
              companyBranding={companyBranding} 
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }} 
            />
          ) : currentModule === 'prevencion' ? (
            <Prevencion 
              user={activeUserContext} 
              companyBranding={companyBranding}
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }} 
            />
          ) : currentModule === 'calidad' ? (
            <CalidadObras user={activeUserContext} onBack={() => {
              setSelectedObraName(null);
              setCurrentModule('dashboard');
            }} />
          ) : currentModule === 'acreditaciones' ? (
            <Acreditaciones 
              user={activeUserContext} 
              companyBranding={companyBranding}
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }} 
            />
          ) : currentModule === 'formularios_capacitaciones' ? (
            <FormulariosCapacitaciones 
              user={activeUserContext} 
              companyBranding={companyBranding} 
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }} 
            />
          ) : currentModule === 'clientes' ? (
            <ClientesPortal
              user={activeUserContext}
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }}
            />
          ) : currentModule === 'mandante' ? (
            <GestionMandante
              user={activeUserContext}
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }}
            />
          ) : currentModule === 'facturacion' ? (
            <Facturacion 
              user={activeUserContext} 
              companyBranding={companyBranding} 
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }} 
            />
          ) : currentModule === 'bodega' ? (
            <BodegaEmpresa
              user={activeUserContext}
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }}
            />
          ) : currentModule === 'gastos' ? (
            <RendicionGastos
              user={activeUserContext}
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }}
            />
          ) : (
            /* Fallback */
            <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <span>Módulo: {currentModule.toUpperCase()}</span>
              </h2>
              <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-sm">
                <Info className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <span>Módulo en construcción.</span>
              </div>
            </div>
          )}
          </React.Suspense>

          <FloatingOX
            user={activeUserContext}
            obra={currentModule === 'obras' ? oxObra : null}
            moduleContext={{
              id: currentModule === 'formularios_capacitaciones' ? 'formularios' : currentModule,
              label: currentModule === 'dashboard' ? 'Inicio' : (allModulesList.find(module => module.id === currentModule)?.title || currentModule),
            }}
            onNavigate={(destination) => {
              if (currentModule === 'obras') { setOxDestination(destination); return; }
              const target = destination === 'inicio' ? 'dashboard' : destination;
              if (allModulesList.some(module => module.id === target) || target === 'dashboard') setCurrentModule(target);
            }}
          />

        </main>
      </div>

    </div>
  );
}

export default App;
