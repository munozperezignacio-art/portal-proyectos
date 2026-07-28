import React from 'react';
import { 
  Building2, Users, Truck, ShieldAlert, LayoutDashboard, ChevronRight, 
  Layers, ClipboardCheck, BadgeCheck 
} from 'lucide-react';
import { obraxisLogoBase64 } from '../obraxisLogoBase64';

export default function LandingPage({ onGoToLogin, user, onGoToDashboard }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* 1. Header/Navbar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={obraxisLogoBase64} alt="Obraxis Logo" className="h-9 object-contain bg-white rounded-xl px-3 py-1 shadow-sm" />
        </div>

        <div>
          {user ? (
            <button
              onClick={onGoToDashboard}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-blue-900/30"
            >
              <span>Ir al Portal</span>
              <LayoutDashboard className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onGoToLogin}
              className="flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 text-white border border-slate-700 text-xs font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer"
            >
              <span>Iniciar Sesión</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32 px-6 flex-1 flex flex-col justify-center items-center text-center bg-radial from-slate-800 via-slate-900 to-slate-950">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30"></div>

        <div className="max-w-3xl relative z-10 space-y-6">
          <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full">
            <BadgeCheck className="w-3.5 h-3.5" />
            SaaS de Control Civil & Obras
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white uppercase leading-none">
            La plataforma definitiva para la gestión de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Proyectos y Obras</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 font-semibold leading-relaxed max-w-2xl mx-auto">
            Optimiza el rendimiento diario de tu faena. Controla asistencia, maquinaria, combustible, prevención de riesgos y presupuestos civiles en una única plataforma unificada.
          </p>

          <div className="pt-6 flex flex-wrap justify-center gap-4">
            {user ? (
              <button
                onClick={onGoToDashboard}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider px-8 py-4 rounded-2xl transition cursor-pointer shadow-lg shadow-blue-900/40 flex items-center gap-2"
              >
                <span>Acceder a mi panel</span>
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            ) : (
              <button
                onClick={onGoToLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider px-8 py-4 rounded-2xl transition cursor-pointer shadow-lg shadow-blue-900/40 flex items-center gap-2"
              >
                <span>Ingresar al Portal</span>
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. Features Grid */}
      <section className="py-20 px-6 bg-slate-950 border-t border-slate-900">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-wide">Módulos Integrados</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Solución todo-en-uno para el control en terreno</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-6 rounded-3xl transition duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center shadow-inner">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-white uppercase">Control de Proyectos</h3>
              <p className="text-xs text-slate-450 font-semibold leading-relaxed">
                Seguimiento de producción diaria en obra, control de faenas activas e inventarios físicos de materiales.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-3xl transition duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-white uppercase">Asistencia RRHH</h3>
              <p className="text-xs text-slate-450 font-semibold leading-relaxed">
                Planillas de marcas y control biométrico en terreno. Liquidación de horas ordinarias y extras autorizadas.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-6 rounded-3xl transition duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shadow-inner">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-white uppercase">Maquinaria y Combustible</h3>
              <p className="text-xs text-slate-450 font-semibold leading-relaxed">
                Inventario fotográfico de flota, registro de horómetros de entrada/salida y carga de combustible.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-red-500/50 p-6 rounded-3xl transition duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center shadow-inner">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-white uppercase">Seguridad y Prevención</h3>
              <p className="text-xs text-slate-450 font-semibold leading-relaxed">
                Creador de formularios dinámicos con firma electrónica y calendario semanal de cumplimiento automatizado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8 px-6 text-center text-[10px] text-slate-650 font-bold uppercase tracking-wider">
        <div>© 2026 Obraxis. Todos los derechos reservados.</div>
      </footer>
    </div>
  );
}
