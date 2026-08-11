import React from 'react';

export default function PublicObraxisHeader() {
  return (
    <header className="mb-5 flex w-full items-center overflow-hidden rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-md sm:px-6 sm:py-4">
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
    </header>
  );
}
