import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Obras from './components/Obras';
import Personal from './components/Personal';
import Maquinaria from './components/Maquinaria';
import ConfigCorreos from './components/ConfigCorreos';
import { 
  LogOut, LayoutDashboard, Building2, Users, Truck, ShieldAlert, Settings, Info, Menu, X 
} from 'lucide-react';
import { supabase } from './supabaseClient';

function App() {
  const [user, setUser] = useState(null);
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [companyBranding, setCompanyBranding] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Sidebar drawer for mobile

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
          .select('logo_base64, color_primario, color_secundario')
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
  }, [user]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('emin_user', JSON.stringify(userData));
    setCurrentModule('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('emin_user');
    setCurrentModule('dashboard');
  };

  // Si no está autenticado, mostramos la pantalla de Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Parsear módulos permitidos del usuario
  const modulosPermitidos = user.modulos
    ? user.modulos.split(',').map((m) => m.trim().toLowerCase())
    : [];

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
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Inicio</h5>
            <button
              onClick={() => setCurrentModule('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentModule === 'dashboard'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
          </div>

          <div>
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Operaciones</h5>
            <div className="space-y-1">
              {(modulosPermitidos.includes('obras') || user.rol.toLowerCase() === 'superusuario') && (
                <button
                  onClick={() => setCurrentModule('obras')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    currentModule === 'obras'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Proyectos y Obras</span>
                </button>
              )}
              {(modulosPermitidos.includes('prevencion') || user.rol.toLowerCase() === 'superusuario') && (
                <button
                  onClick={() => setCurrentModule('prevencion')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    currentModule === 'prevencion'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Prevención de Riesgos</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Recursos</h5>
            <div className="space-y-1">
              {(modulosPermitidos.includes('rrhh') || user.rol.toLowerCase() === 'superusuario') && (
                <button
                  onClick={() => setCurrentModule('rrhh')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    currentModule === 'rrhh'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Personal (RRHH)</span>
                </button>
              )}
              {(modulosPermitidos.includes('maquinaria') || user.rol.toLowerCase() === 'superusuario') && (
                <button
                  onClick={() => setCurrentModule('maquinaria')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    currentModule === 'maquinaria'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Maquinaria</span>
                </button>
              )}
            </div>
          </div>

          {(modulosPermitidos.includes('admin') || user.rol.toLowerCase() === 'superusuario') && (
            <div>
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Configuración</h5>
              <button
                onClick={() => setCurrentModule('admin')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentModule === 'admin'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Panel de Control</span>
              </button>
            </div>
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
              <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
                <button
                  onClick={() => { setCurrentModule('dashboard'); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    currentModule === 'dashboard'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>

                <div className="space-y-1">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">Operaciones</h5>
                  {(modulosPermitidos.includes('obras') || user.rol.toLowerCase() === 'superusuario') && (
                    <button
                      onClick={() => { setCurrentModule('obras'); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        currentModule === 'obras'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Proyectos y Obras</span>
                    </button>
                  )}
                  {(modulosPermitidos.includes('prevencion') || user.rol.toLowerCase() === 'superusuario') && (
                    <button
                      onClick={() => { setCurrentModule('prevencion'); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        currentModule === 'prevencion'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Prevención de Riesgos</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">Recursos</h5>
                  {(modulosPermitidos.includes('rrhh') || user.rol.toLowerCase() === 'superusuario') && (
                    <button
                      onClick={() => { setCurrentModule('rrhh'); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        currentModule === 'rrhh'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Personal (RRHH)</span>
                    </button>
                  )}
                  {(modulosPermitidos.includes('maquinaria') || user.rol.toLowerCase() === 'superusuario') && (
                    <button
                      onClick={() => { setCurrentModule('maquinaria'); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        currentModule === 'maquinaria'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>Maquinaria</span>
                    </button>
                  )}
                </div>

                {(modulosPermitidos.includes('admin') || user.rol.toLowerCase() === 'superusuario') && (
                  <div className="space-y-1">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">Configuración</h5>
                    <button
                      onClick={() => { setCurrentModule('admin'); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        currentModule === 'admin'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Panel de Control</span>
                    </button>
                  </div>
                )}
              </nav>

              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
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
                  <h2 className="text-xl font-bold text-slate-800">Bienvenido al Portal de Gestión, {user.usuario}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Control centralizado y monitoreo de proyectos para {user.empresa}.</p>
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

              {/* Trello / Kanban Board Layout (3 columns) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* COLUMNA 1: OPERACIONES */}
                <div className="bg-slate-100/60 border border-slate-200 p-5 rounded-3xl space-y-4">
                  <div className="border-b border-slate-250 pb-3">
                    <h3 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>1. Operaciones en Terreno</span>
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Tarjeta Proyectos */}
                    {(modulosPermitidos.includes('obras') || user.rol.toLowerCase() === 'superusuario') ? (
                      <div
                        onClick={() => setCurrentModule('obras')}
                        className="group bg-white p-5 border border-slate-200 rounded-2xl shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-0.5 transition cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary text-white rounded-xl group-hover:bg-primary-hover transition">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-bold text-slate-800 group-hover:text-primary transition text-xs">Proyectos y Obras Activas</h4>
                            <p className="text-[10px] text-slate-500 leading-normal">Control diario de producción, dotación, maquinarias y materiales en faena.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 p-5 rounded-2xl text-center text-slate-400 text-[10px] italic">
                        Sin acceso a Obras
                      </div>
                    )}

                    {/* Tarjeta Prevención */}
                    {(modulosPermitidos.includes('prevencion') || user.rol.toLowerCase() === 'superusuario') ? (
                      <div
                        onClick={() => setCurrentModule('prevencion')}
                        className="group bg-white p-5 border border-slate-200 rounded-2xl shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-0.5 transition cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary text-white rounded-xl group-hover:bg-primary-hover transition">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-bold text-slate-800 group-hover:text-primary transition text-xs">Prevención de Riesgos</h4>
                            <p className="text-[10px] text-slate-500 leading-normal">Reportes de incidentes, observaciones de seguridad y registros en terreno.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 p-5 rounded-2xl text-center text-slate-400 text-[10px] italic">
                        Sin acceso a Prevención
                      </div>
                    )}
                  </div>
                </div>

                {/* COLUMNA 2: RECURSOS */}
                <div className="bg-slate-100/60 border border-slate-200 p-5 rounded-3xl space-y-4">
                  <div className="border-b border-slate-250 pb-3">
                    <h3 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span>2. Recursos y Activos</span>
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Tarjeta RRHH */}
                    {(modulosPermitidos.includes('rrhh') || user.rol.toLowerCase() === 'superusuario') ? (
                      <div
                        onClick={() => setCurrentModule('rrhh')}
                        className="group bg-white p-5 border border-slate-200 rounded-2xl shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-0.5 transition cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary text-white rounded-xl group-hover:bg-primary-hover transition">
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-bold text-slate-800 group-hover:text-primary transition text-xs">Recursos Humanos (RRHH)</h4>
                            <p className="text-[10px] text-slate-500 leading-normal">Fichas de personal, asignación de trabajadores a proyectos y altas/bajas.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 p-5 rounded-2xl text-center text-slate-400 text-[10px] italic">
                        Sin acceso a RRHH
                      </div>
                    )}

                    {/* Tarjeta Maquinaria */}
                    {(modulosPermitidos.includes('maquinaria') || user.rol.toLowerCase() === 'superusuario') ? (
                      <div
                        onClick={() => setCurrentModule('maquinaria')}
                        className="group bg-white p-5 border border-slate-200 rounded-2xl shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-0.5 transition cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary text-white rounded-xl group-hover:bg-primary-hover transition">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-bold text-slate-800 group-hover:text-primary transition text-xs">Gestión de Maquinaria</h4>
                            <p className="text-[10px] text-slate-500 leading-normal">Control de inventario, equipos activos en faenas y asignación directa.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 p-5 rounded-2xl text-center text-slate-400 text-[10px] italic">
                        Sin acceso a Maquinaria
                      </div>
                    )}
                  </div>
                </div>

                {/* COLUMNA 3: ADMINISTRACION */}
                <div className="bg-slate-100/60 border border-slate-200 p-5 rounded-3xl space-y-4">
                  <div className="border-b border-slate-250 pb-3">
                    <h3 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      <span>3. Administración</span>
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Tarjeta Configuración */}
                    {(modulosPermitidos.includes('admin') || user.rol.toLowerCase() === 'superusuario') ? (
                      <div
                        onClick={() => setCurrentModule('admin')}
                        className="group bg-white p-5 border border-slate-200 rounded-2xl shadow-xs hover:shadow-md hover:border-primary hover:-translate-y-0.5 transition cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary text-white rounded-xl group-hover:bg-primary-hover transition">
                            <Settings className="w-5 h-5" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-bold text-slate-800 group-hover:text-primary transition text-xs">Panel de Configuración</h4>
                            <p className="text-[10px] text-slate-500 leading-normal">Configuración de correos, branding de empresas y gestión de usuarios.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 p-5 rounded-2xl text-center text-slate-400 text-[10px] italic">
                        Sin acceso a Configuración
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : currentModule === 'obras' ? (
            <Obras user={user} onBack={() => setCurrentModule('dashboard')} />
          ) : currentModule === 'rrhh' ? (
            <Personal user={user} onBack={() => setCurrentModule('dashboard')} />
          ) : currentModule === 'maquinaria' ? (
            <Maquinaria user={user} onBack={() => setCurrentModule('dashboard')} />
          ) : currentModule === 'admin' ? (
            <ConfigCorreos user={user} onBack={() => setCurrentModule('dashboard')} />
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
