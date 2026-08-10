import React from 'react';

export default function PublicObraxisHeader() {
  return (
    <header className="mx-auto mb-4 flex max-w-6xl items-center justify-between rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-sm">
      <a href="https://www.obraxis.cl" className="inline-flex items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label="Ir a obraxis.cl">
        <img src="/brand/obraxis-primary.png" alt="Obraxis" className="h-8 w-auto object-contain" />
        <span className="text-sm font-black tracking-tight text-slate-900">Obraxis</span>
      </a>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Portal externo</span>
    </header>
  );
}
