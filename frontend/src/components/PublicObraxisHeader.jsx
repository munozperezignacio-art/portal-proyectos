import React from 'react';

export default function PublicObraxisHeader() {
  return (
    <header className="mb-5 flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-md sm:px-6 sm:py-4">
      <a
        href="https://www.obraxis.cl"
        className="inline-flex min-w-0 items-center rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label="Ir a obraxis.cl"
      >
        <span
          role="img"
          aria-label="Obraxis"
          className="block h-[54px] w-[218px] shrink-0 bg-no-repeat sm:h-[64px] sm:w-[276px]"
          style={{
            backgroundImage: 'url(/brand/obraxis-logo-variants.png)',
            backgroundSize: '614px 410px',
            backgroundPosition: '-318px -92px',
          }}
        />
      </a>

      <a
        href="https://www.obraxis.cl/#contacto"
        target="_blank"
        rel="noreferrer"
        className="group inline-flex shrink-0 items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-right text-xs font-bold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-300 sm:px-5 sm:py-3 sm:text-sm"
      >
        <span className="hidden text-slate-500 lg:inline">¿Aún no eres parte?</span>
        <span className="whitespace-nowrap">Contáctanos <span aria-hidden="true">→</span></span>
      </a>
    </header>
  );
}
