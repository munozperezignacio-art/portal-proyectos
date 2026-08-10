import React from 'react';
import { ArrowLeft } from 'lucide-react';

// Cabecera única para los módulos corporativos. Mantiene consistente jerarquía,
// retorno, iconografía, espaciado y el tono de los subtítulos.
export default function ModuleHeader({ title, subtitle, Icon, onBack, actions, className = '' }) {
  return <header className={`flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between ${className}`}>
    <div className="flex min-w-0 items-center gap-3">
      <button type="button" onClick={onBack} className="shrink-0 rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900" title="Volver" aria-label="Volver"><ArrowLeft className="h-5 w-5" /></button>
      {Icon && <div className="shrink-0 rounded-xl bg-slate-50 p-2.5 text-primary"><Icon className="h-6 w-6" /></div>}
      <div className="min-w-0"><h1 className="text-lg font-black leading-tight tracking-tight text-slate-900 sm:text-xl">{title}</h1>{subtitle && <p className="mt-1 text-xs font-normal leading-relaxed text-slate-500 sm:text-[13px]">{subtitle}</p>}</div>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}
