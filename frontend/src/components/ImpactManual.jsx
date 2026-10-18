import { useRef, useState } from 'react';
import manual from '../data/impactManual.json';
import { impactImages } from '../data/impactImages';

export default function ImpactManual() {
  const [opened, setOpened] = useState(false);
  const [index, setIndex] = useState(0);
  const heading = useRef(null);
  const entry = useRef(null);
  const dialog = useRef(null);
  const step = manual.pasos[index];
  const photo = impactImages[step.paso];
  const navigate = next => {
    setIndex(Math.max(0, Math.min(manual.pasos.length - 1, next)));
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };
  const button = 'rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed';

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4" aria-label="Manual visual de armado Impact">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold text-teal-700">PC-MN-06 · Manual visual</p><h3 className="text-lg font-extrabold text-slate-900">Armado de equipo Impact</h3><p className="text-sm text-slate-600">20 pasos · Fotografías ampliables · Detalles técnicos</p></div>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Borrador para revisión técnica</span>
    </div>
    {!opened ? <button ref={entry} onClick={() => { setOpened(true); navigate(index); }} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white">Abrir paso a paso</button> : <>
      <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-950">Guía de apoyo para personal capacitado, con procedimiento aprobado y supervisión. Pendiente de revisión técnica. El documento tiene portada Rev. 01 e interiores Rev. 00.</div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="min-w-0 flex-1 text-sm font-bold">Ir al paso <select aria-label="Ir al paso" value={index} onChange={event => navigate(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2">{manual.pasos.map((item, position) => <option key={item.paso} value={position}>{item.paso}. {item.titulo}</option>)}</select></label>
        <button className="text-sm font-bold text-slate-600 underline" onClick={() => { setOpened(false); requestAnimationFrame(() => entry.current?.focus()); }}>Cerrar manual</button>
      </div>
      <progress aria-label="Posición de lectura" value={index + 1} max={manual.pasos.length} className="h-2 w-full accent-teal-700" />
      <article className="mx-auto max-w-3xl space-y-4">
        <div ref={heading} tabIndex={-1} className="scroll-mt-5 outline-none" aria-live="polite"><p className="text-sm font-bold text-teal-700">Paso {step.paso} de {manual.pasos.length}</p><h4 className="text-2xl font-extrabold text-slate-900">{step.titulo}</h4></div>
        {photo ? <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><button className="block w-full cursor-zoom-in p-2" onClick={() => dialog.current?.showModal()} aria-label={`Ampliar fotografía: ${step.imagen_descripcion}`}><img src={photo} alt={step.imagen_descripcion} className="mx-auto max-h-[420px] w-full object-contain" /></button><figcaption className="p-3 text-sm font-semibold text-slate-700">{step.imagen_descripcion}<span className="mt-1 block text-xs font-normal">Fotografía del procedimiento · Toca para ampliar</span></figcaption></figure> : <div className="rounded-xl bg-teal-50 p-5"><ul className="space-y-3 text-lg font-semibold text-teal-950">{step.elementos_visuales.map(text => <li key={text}>{text}</li>)}</ul><p className="mt-4 text-xs text-slate-600">El documento no incluye una fotografía específica de esta acción.</p></div>}
        <p className="text-xl leading-relaxed text-slate-900">{step.texto}</p>
        <details key={step.paso} className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-bold">Detalle técnico y controles</summary><p className="mt-3 text-sm leading-relaxed text-slate-700">{step.detalle}</p><p className="mt-3 text-xs text-slate-500">Fuente: PC-MN-06 · páginas {step.paginas_fuente}</p></details>
        {index === manual.pasos.length - 1 && <p className="rounded-xl bg-slate-100 p-3 text-sm">Fin de la guía. La lectura no reemplaza la revisión ni la aprobación del armado.</p>}
        <nav className="flex justify-between gap-3" aria-label="Navegación del manual"><button disabled={index === 0} onClick={() => navigate(index - 1)} className={button}>Anterior</button><button disabled={index === manual.pasos.length - 1} onClick={() => navigate(index + 1)} className={`${button} bg-teal-700 text-white`}>Siguiente</button></nav>
      </article>
      <dialog ref={dialog} aria-label="Fotografía ampliada" className="fixed inset-0 m-auto max-h-[95dvh] w-[95vw] max-w-6xl overflow-auto rounded-2xl p-4 backdrop:bg-black/80"><form method="dialog" className="sticky top-0 flex justify-end"><button autoFocus className="rounded-lg bg-slate-900 px-4 py-3 font-bold text-white">Cerrar fotografía</button></form><img src={photo} alt={step.imagen_descripcion} className="mx-auto mt-3 h-auto w-full" /><p className="p-3 text-sm">{step.imagen_descripcion}</p></dialog>
    </>}
  </section>;
}
