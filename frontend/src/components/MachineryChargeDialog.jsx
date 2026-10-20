import React,{useState} from 'react';
export default function MachineryChargeDialog({conflict,onChoose,onCancel}){
  const [selected,setSelected]=useState('');
  return <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-label="Elegir obra del cargo diario" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
    <h3 className="text-lg font-black">Este equipo ya tiene un reporte en otra obra</h3>
    <p className="text-sm">{conflict.equipo||'Equipo'} · {conflict.fecha}. ¿A qué obra se cargará la tarifa completa de este día?</p>
    <p className="text-xs text-slate-600">Se conservarán los reportes de ambas obras, pero habrá un solo cargo diario. Elegir otra obra traslada el cargo; no lo duplica. El nuevo reporte aún no se ha guardado.</p>
    <label className="block text-sm font-bold">Obra que asume el cargo<select aria-label="Obra que asume el cargo" value={selected} onChange={e=>setSelected(e.target.value)} className="mt-2 w-full rounded-xl border bg-white p-3"><option value="">Selecciona una obra</option>{conflict.obras.map(obra=><option key={obra} value={obra}>{obra}</option>)}</select></label>
    <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm">Cancelar reporte</button><button type="button" disabled={!selected} onClick={()=>onChoose(selected)} className="rounded-xl bg-blue-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Confirmar y guardar</button></div>
  </section></div>;
}
