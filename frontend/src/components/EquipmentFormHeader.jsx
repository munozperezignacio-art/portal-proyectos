export default function EquipmentFormHeader({title,company,code,revision}) {
 return <header className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">{company||'Obraxis'}</p>
  <h2 className="mt-2 text-xl font-bold text-slate-900">{title}</h2>
  {(code||revision)&&<p className="mt-2 text-xs text-slate-500">{code&&'Documento '+code}{revision&&' · Revisión '+revision}</p>}
 </header>;
}
