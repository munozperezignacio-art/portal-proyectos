import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Obras from './components/Obras';
import Personal from './components/Personal';
import Maquinaria from './components/Maquinaria';
import ConfigCorreos from './components/ConfigCorreos';
import { LogOut, LayoutDashboard, Building2, Users, Truck, ShieldAlert, Settings, Info } from 'lucide-react';

function App() {
  const [user, setUser] = useState(null);
  const [currentModule, setCurrentModule] = useState('dashboard');

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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      
      {/* Header Superior Principal */}
      <header className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-lg">
            <span className="text-blue-900 font-black text-sm tracking-wider px-1">EMIN</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Portal de Proyectos</h1>
            <p className="text-[10px] text-blue-200">Plataforma de Faenas</p>
          </div>
        </div>

        {/* Acciones y Perfil */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-white">{user.usuario}</p>
            <p className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">{user.rol}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-blue-800/80 text-xs px-3 py-2 rounded-lg text-blue-100 hover:bg-blue-700 transition font-medium border border-blue-700/50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Subheader Informativo */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex justify-between items-center text-xs">
        <div className="text-slate-500">
          Empresa: <span className="font-semibold text-slate-700">{user.empresa}</span> | 
          Rol: <span className="font-semibold text-slate-700 uppercase ml-1">{user.rol}</span>
        </div>
        {currentModule !== 'dashboard' && (
          <button
            onClick={() => setCurrentModule('dashboard')}
            className="text-blue-900 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Volver al Dashboard</span>
          </button>
        )}
      </div>

      {/* Panel Principal */}
      <main className="p-6 flex-1 max-w-xl w-full mx-auto space-y-4">
        {currentModule === 'dashboard' ? (
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Módulos de Control</h2>
            
            <div className="grid grid-cols-1 gap-4">
              
              {/* Tarjeta Proyectos y Obras */}
              {(modulosPermitidos.includes('obras') || user.rol.toLowerCase() === 'superusuario') && (
                <div
                  onClick={() => setCurrentModule('obras')}
                  className="group w-full p-5 bg-white border border-slate-200 rounded-2xl shadow-sm text-left transition-all hover:shadow-md hover:border-blue-500 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-900 text-white rounded-xl group-hover:bg-blue-800 transition">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 group-hover:text-blue-900 transition text-sm">Proyectos y Obras Activas</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Control diario de producción, asistencia, maquinaria e inventario en faena.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tarjeta RRHH */}
              {(modulosPermitidos.includes('rrhh') || user.rol.toLowerCase() === 'superusuario') && (
                <div
                  onClick={() => setCurrentModule('rrhh')}
                  className="group w-full p-5 bg-white border border-slate-200 rounded-2xl shadow-sm text-left transition-all hover:shadow-md hover:border-blue-500 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-900 text-white rounded-xl group-hover:bg-blue-800 transition">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 group-hover:text-blue-900 transition text-sm">Recursos Humanos</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Control de personal, asignación de trabajadores a proyectos y fichas de contratación.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tarjeta Gestión Maquinarias */}
              {(modulosPermitidos.includes('maquinaria') || user.rol.toLowerCase() === 'superusuario') && (
                <div
                  onClick={() => setCurrentModule('maquinaria')}
                  className="group w-full p-5 bg-white border border-slate-200 rounded-2xl shadow-sm text-left transition-all hover:shadow-md hover:border-blue-500 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-900 text-white rounded-xl group-hover:bg-blue-800 transition">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 group-hover:text-blue-900 transition text-sm">Gestión de Maquinaria</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Alta de equipos, asignación directa, disponibilidad y requerimientos.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tarjeta Prevención */}
              {(modulosPermitidos.includes('prevencion') || user.rol.toLowerCase() === 'superusuario') && (
                <div
                  onClick={() => setCurrentModule('prevencion')}
                  className="group w-full p-5 bg-white border border-slate-200 rounded-2xl shadow-sm text-left transition-all hover:shadow-md hover:border-blue-500 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-900 text-white rounded-xl group-hover:bg-blue-800 transition">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 group-hover:text-blue-900 transition text-sm">Prevención de Riesgos</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Reportes de seguridad, observaciones en terreno y control de incidentes.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tarjeta Administrador */}
              {(modulosPermitidos.includes('admin') || user.rol.toLowerCase() === 'superusuario') && (
                <div
                  onClick={() => setCurrentModule('admin')}
                  className="group w-full p-5 bg-white border border-slate-200 rounded-2xl shadow-sm text-left transition-all hover:shadow-md hover:border-blue-500 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-900 text-white rounded-xl group-hover:bg-blue-800 transition">
                      <Settings className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 group-hover:text-blue-900 transition text-sm">Administración y Configuración</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Configuración de correos, gestión de usuarios de la plataforma y parámetros.</p>
                    </div>
                  </div>
                </div>
              )}

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
          /* Renderizar vistas del módulo */
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <span>Módulo: {currentModule.toUpperCase()}</span>
            </h2>
            <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-sm">
              <Info className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <span>El Módulo de {currentModule.toUpperCase()} se encuentra en desarrollo en el siguiente paso.</span>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
