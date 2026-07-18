import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Obras from './components/Obras';
import Personal from './components/Personal';
import Maquinaria from './components/Maquinaria';
import ConfigCorreos from './components/ConfigCorreos';
import { 
  LogOut, LayoutDashboard, Building2, Users, Truck, ShieldAlert, Settings, Info, Menu, X, Loader2,
  Layers, Handshake, Receipt, Coins, ClipboardCheck, Boxes, BadgeCheck
} from 'lucide-react';
import { supabase } from './supabaseClient';

const defaultCovers = [
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80", // construction site
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80", // crane/construction
  "https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=600&q=80", // plans
  "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=600&q=80", // concrete
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80", // buildings
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80"  // steel/glass structure
];

function App() {
  const [user, setUser] = useState(null);
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [companyBranding, setCompanyBranding] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer toggle
  const [obras, setObras] = useState([]);
  const [obrasLoading, setObrasLoading] = useState(false);
  const [selectedObraName, setSelectedObraName] = useState(null);

  // Favoritos guardados en localStorage
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('emin_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  // Cargar sesión del usuario desde localStorage al iniciar
  useEffect(() => {
    const savedUser = localStorage.getItem('emin_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('emin_user');
      }
    }
  }, []);

  // Cargar identidad visual de la empresa del usuario
  useEffect(() => {
    if (!user) return;
    async function fetchBranding() {
      try {
        const { data, error } = await supabase
          .from('config_empresa')
          .select('logo_base64, color_primario, color_secundario, modulos_activos')
          .eq('empresa', user.empresa)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setCompanyBranding(data);
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
  }, [user]);

  const fetchObras = async () => {
    if (!user) return;
    setObrasLoading(true);
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('nombre', { ascending: true });
      if (error) throw error;

      // Filtrar por permisos del usuario
      const permisoStr = user.obras ? user.obras.toString().trim().toLowerCase() : '';
      const obrasPermitidasArr = permisoStr.split(',').map(item => item.trim());
      const esTodas = obrasPermitidasArr.includes('todas') || user.rol.toLowerCase() === 'superusuario';

      const filtradas = (data || []).filter(o => {
        if (!o.nombre) return false;
        return esTodas || obrasPermitidasArr.includes(o.nombre.toString().trim().toLowerCase());
      });

      setObras(filtradas);
    } catch (err) {
      console.error('Error cargando obras en App:', err.message);
    } finally {
      setObrasLoading(false);
    }
  };

  const toggleFavorite = (e, name) => {
    e.stopPropagation();
    let updated;
    if (favorites.includes(name)) {
      updated = favorites.filter(f => f !== name);
    } else {
      updated = [...favorites, name];
    }
    setFavorites(updated);
    localStorage.setItem('emin_favorites', JSON.stringify(updated));
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('emin_user', JSON.stringify(userData));
    setCurrentModule('dashboard');
    setSelectedObraName(null);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('emin_user');
    setCurrentModule('dashboard');
    setSelectedObraName(null);
  };

  // Si no está autenticado, mostramos la pantalla de Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Parsear módulos permitidos del usuario
  const modulosPermitidos = user.modulos
    ? user.modulos.split(',').map((m) => m.trim().toLowerCase())
    : [];

  // Módulos habilitados para la empresa actual
  const modulosActivosEmpresa = companyBranding && companyBranding.modulos_activos
    ? companyBranding.modulos_activos.split(',').map(m => m.trim().toLowerCase())
    : null; // Si es nulo, por defecto todos están habilitados para compatibilidad

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
      id: 'acreditaciones',
      title: 'Acreditaciones',
      description: 'Gestión de acreditaciones de personal y maquinaria para ingreso a faenas.',
      icon: <BadgeCheck className="w-5 h-5" />,
      sidebarIcon: <BadgeCheck className="w-4 h-4" />,
      action: () => { setSelectedObraName(null); setCurrentModule('acreditaciones'); }
    },
    {
      id: 'calidad',
      title: 'Calidad de Obras',
      description: 'Aseguramiento de calidad, no conformidades y auditorías en terreno.',
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
      title: 'Presupuestos y Planificación',
      description: 'Planificación de tareas, presupuestos y control de costes en tiempo real.',
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
    const permitidoUsuario = modulosPermitidos.includes(m.id) || user.rol.toLowerCase() === 'superusuario';
    if (!permitidoUsuario) return false;

    // 2. Si el rol es superusuario de la aplicación, tiene acceso a todo de todas formas
    if (user.rol.toLowerCase() === 'superusuario') return true;

    // 3. Filtrar por módulos habilitados para la empresa
    if (modulosActivosEmpresa) {
      return modulosActivosEmpresa.includes(m.id);
    }
    return true;
  });

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">
      
      {/* SIDEBAR NAVIGATION (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-40 transition-all">
        
        {/* Brand/Logo Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-center bg-slate-50/50 min-h-[73px]">
          {companyBranding && companyBranding.logo_base64 ? (
            <img 
              src={companyBranding.logo_base64} 
              className="max-h-10 max-w-full object-contain mx-auto" 
              alt="Logo" 
            />
          ) : (
            <div className="bg-primary/10 px-3 py-2 rounded-xl flex items-center justify-center w-full">
              <span className="text-primary font-black text-sm tracking-wider uppercase">{user.empresa}</span>
            </div>
          )}
        </div>

        {/* User Info Card */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
            {user.usuario.substring(0, 2)}
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="text-xs font-bold text-slate-800 truncate">{user.usuario}</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{user.rol}</p>
          </div>
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
          {visibleModules.filter(m => m.id !== 'admin').map((m) => (
            <button
              key={m.id}
              onClick={m.action}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentModule === m.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {m.sidebarIcon}
              <span>{m.title}</span>
            </button>
          ))}

          {/* Panel de Administración en la base si corresponde */}
          {(modulosPermitidos.includes('admin') || user.rol.toLowerCase() === 'superusuario') && (
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

      {/* MOBILE HEADER & DRAWER SIDEBAR */}
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen">
        <header className="md:hidden bg-primary text-white p-4 flex justify-between items-center shadow-md z-30 transition-all">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-1 hover:bg-white/10 rounded-lg cursor-pointer transition"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">Portal de Faenas</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold bg-white/15 px-2.5 py-1 rounded-full uppercase">{user.empresa}</span>
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
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <span className="text-primary font-black text-sm tracking-wider uppercase">{user.empresa}</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg cursor-pointer">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

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
                {visibleModules.filter(m => m.id !== 'admin').map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { m.action(); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      currentModule === m.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {m.sidebarIcon}
                    <span>{m.title}</span>
                  </button>
                ))}

                {(modulosPermitidos.includes('admin') || user.rol.toLowerCase() === 'superusuario') && (
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
        <main className="p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto space-y-6">
          
          {currentModule === 'dashboard' ? (
            <div className="space-y-6">
                  {/* Dashboard Banner/Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 border border-slate-200 rounded-3xl shadow-xs">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Módulos de Gestión</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Selecciona un módulo para comenzar a trabajar.</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl uppercase tracking-wide">
                    Empresa: {user.empresa}
                  </span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl uppercase tracking-wide">
                    Rol: {user.rol}
                  </span>
                </div>
              </div>

              {/* Grid de Módulos (Forma rectangular, sin imágenes) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleModules.map((m) => (
                  <div
                    key={m.id}
                    onClick={m.action}
                    className="group bg-white border border-slate-250 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden flex items-start gap-4 min-h-[110px]"
                  >
                    {/* Dot Indicador (Azul) */}
                    <div className="absolute top-3 left-3 w-2.5 h-2.5 bg-blue-600 rounded-full border border-white shadow-sm" />
                    
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
            </div>
          ) : currentModule === 'obras' ? (
            <Obras 
              user={user} 
              onBack={() => {
                setSelectedObraName(null);
                setCurrentModule('dashboard');
              }} 
              initialObraName={selectedObraName}
            />
          ) : currentModule === 'rrhh' ? (
            <Personal user={user} onBack={() => {
              setSelectedObraName(null);
              setCurrentModule('dashboard');
            }} />
          ) : currentModule === 'maquinaria' ? (
            <Maquinaria user={user} onBack={() => {
              setSelectedObraName(null);
              setCurrentModule('dashboard');
            }} />
          ) : currentModule === 'admin' ? (
            <ConfigCorreos user={user} onBack={() => {
              setSelectedObraName(null);
              setCurrentModule('dashboard');
            }} />
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

        </main>
      </div>

    </div>
  );
}

export default App;
