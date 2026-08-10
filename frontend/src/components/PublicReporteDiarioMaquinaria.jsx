import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Truck, Calendar, Gauge, Fuel, User, CheckCircle2, AlertCircle, ArrowLeft, Send, ShieldCheck, Building2 } from 'lucide-react';

export default function PublicReporteDiarioMaquinaria({ equipoId, patente }) {
  const [equipo, setEquipo] = useState(null);
  const [loadingEquipo, setLoadingEquipo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    horometro_inicial: '',
    horometro_final: '',
    combustible_cargado: '0',
    operador: '',
    observaciones: ''
  });

  useEffect(() => {
    fetchEquipoData();
  }, [equipoId, patente]);

  const fetchEquipoData = async () => {
    setLoadingEquipo(true);
    try {
      let found = null;
      if (equipoId) {
        const { data } = await supabase.from('inventario_maquinaria').select('*').eq('id', equipoId).single();
        if (data) found = data;
      }

      if (!found && patente) {
        const { data } = await supabase.from('inventario_maquinaria').select('*').ilike('patente', patente.trim()).single();
        if (data) found = data;
      }

      if (!found) {
        // Fallback a localStorage
        const localMaq = localStorage.getItem('obraxis_inventario_maquinaria');
        if (localMaq) {
          try {
            const list = JSON.parse(localMaq);
            found = list.find(m => m.id.toString() === (equipoId || '').toString() || (m.patente && m.patente.toLowerCase() === (patente || '').toLowerCase()));
          } catch (e) {}
        }
      }

      setEquipo(found || {
        id: equipoId || '1',
        tipo: 'Maquinaria en Faena',
        patente: patente || 'S/I',
        obra_nombre: 'Arriendo a Tercero'
      });

      if (found && found.horometro_inicial) {
        setForm(prev => ({ ...prev, horometro_inicial: found.horometro_inicial.toString() }));
      }
    } catch (err) {
      console.warn('Error al buscar equipo público:', err);
    } finally {
      setLoadingEquipo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    const hIni = parseFloat(form.horometro_inicial) || 0;
    const hFin = parseFloat(form.horometro_final) || 0;

    if (hFin < hIni) {
      setErrorMsg('El horómetro final no puede ser inferior al horómetro inicial.');
      setSubmitting(false);
      return;
    }

    const hrsTrabajadas = Math.max(0, hFin - hIni);

    const newLog = {
      equipo_id: equipo ? equipo.id : equipoId,
      equipo_tipo: equipo ? equipo.tipo : 'Maquinaria',
      equipo_patente: equipo ? equipo.patente : patente,
      obra_nombre: equipo ? (equipo.obra_nombre || 'Arriendo a Tercero') : 'Arriendo a Tercero',
      fecha: form.fecha,
      horometro_inicial: hIni,
      horometro_final: hFin,
      horas_trabajadas: hrsTrabajadas,
      combustible_cargado: parseFloat(form.combustible_cargado) || 0,
      operador: form.operador.trim(),
      observaciones: form.observaciones.trim(),
      empresa: equipo ? equipo.empresa : 'OBRAXIS',
      created_at: new Date().toISOString()
    };

    try {
      // Intento en Supabase
      const { error } = await supabase.from('maquinaria_uso_diario').insert([newLog]);
      
      // Actualizar también el horómetro inicial del equipo en inventario
      await supabase.from('inventario_maquinaria').update({ horometro_inicial: hFin }).eq('id', equipo.id);

      // Resguardo en localStorage
      const local = localStorage.getItem('obraxis_maquinaria_uso');
      let currentList = [];
      if (local) {
        try { currentList = JSON.parse(local); } catch(e){}
      }
      const updatedList = [newLog, ...currentList];
      localStorage.setItem('obraxis_maquinaria_uso', JSON.stringify(updatedList));

      setSubmitted(true);
    } catch (err) {
      console.warn('Error backend, guardando localmente:', err.message);
      const local = localStorage.getItem('obraxis_maquinaria_uso');
      let currentList = [];
      if (local) {
        try { currentList = JSON.parse(local); } catch(e){}
      }
      localStorage.setItem('obraxis_maquinaria_uso', JSON.stringify([newLog, ...currentList]));
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const hrsTrabajadasCalculadas = Math.max(0, (parseFloat(form.horometro_final) || 0) - (parseFloat(form.horometro_inicial) || 0));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col justify-between p-4 sm:p-6">
      <div className="max-w-md w-full mx-auto space-y-6 animate-in fade-in duration-200 py-4">
        
        {/* Logo y Encabezado Oficial Obraxis */}
        <div className="text-center space-y-3 bg-slate-800/80 p-6 rounded-3xl border border-slate-700 shadow-xl backdrop-blur-md">
          <img src="/brand/obraxis-primary.png" alt="Obraxis" className="h-16 w-40 mx-auto object-contain mb-1" />
          <div>
            <span className="text-[9px] font-black tracking-widest uppercase bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30">
              REPORTE DIARIO DE MAQUINARIA EN FAENA
            </span>
            <h1 className="text-lg font-black uppercase text-white mt-2 tracking-tight">Registro Operacional de Horómetro</h1>
          </div>

          {loadingEquipo ? (
            <p className="text-xs text-slate-400">⏳ Cargando ficha de equipo...</p>
          ) : equipo ? (
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-700 text-xs space-y-1 text-left">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-amber-400 uppercase text-sm">{equipo.tipo}</span>
                <span className="font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-[10px]">{equipo.patente || patente}</span>
              </div>
              <p className="text-slate-300 font-medium text-[11px]">Ubicación / Faena: <b>{equipo.obra_nombre || 'Arriendo a Tercero'}</b></p>
            </div>
          ) : null}
        </div>

        {/* Formulario enviado con éxito */}
        {submitted ? (
          <div className="bg-slate-800 border border-emerald-500/40 p-6 rounded-3xl text-center space-y-4 shadow-xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase">¡Parte Diario Guardado!</h2>
              <p className="text-xs text-slate-300 mt-1">El registro de horómetro y uso diario del equipo <b className="text-amber-400">{equipo?.patente || patente}</b> fue ingresado correctamente a la bitácora.</p>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-700 text-xs space-y-1 text-left">
              <p className="text-slate-400">Fecha: <b className="text-white">{form.fecha}</b></p>
              <p className="text-slate-400">Horas Trabajadas: <b className="text-emerald-400">+{hrsTrabajadasCalculadas} hrs</b></p>
              <p className="text-slate-400">Operador: <b className="text-white">{form.operador}</b></p>
            </div>

            <button
              onClick={() => {
                setSubmitted(false);
                setForm(prev => ({
                  ...prev,
                  horometro_inicial: form.horometro_final || prev.horometro_inicial,
                  horometro_final: '',
                  combustible_cargado: '0',
                  observaciones: ''
                }));
              }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-2xl transition cursor-pointer shadow-md uppercase"
            >
              Registrar Otro Día / Horómetro
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-800/90 border border-slate-700 p-6 rounded-3xl shadow-xl space-y-4 text-xs">
            
            {errorMsg && (
              <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-300 rounded-2xl font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[10.5px] font-bold uppercase text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Fecha del Registro *</span>
              </label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm(prev => ({ ...prev, fecha: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 font-bold text-white text-xs focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-300 mb-1 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>H. Inicial (hrs) *</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="ej: 1250.0"
                  value={form.horometro_inicial}
                  onChange={(e) => setForm(prev => ({ ...prev, horometro_inicial: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 font-bold text-white text-xs focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-300 mb-1 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>H. Final (hrs) *</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="ej: 1258.5"
                  value={form.horometro_final}
                  onChange={(e) => setForm(prev => ({ ...prev, horometro_final: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 font-bold text-white text-xs focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Cálculo horas operativas en tiempo real */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex justify-between items-center text-xs">
              <span className="font-bold text-amber-300">Horas Trabajadas Calculadas:</span>
              <span className="font-black text-amber-400 text-sm">+{hrsTrabajadasCalculadas} hrs</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-300 mb-1 flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-400" />
                  <span>Combustible (Lts)</span>
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.combustible_cargado}
                  onChange={(e) => setForm(prev => ({ ...prev, combustible_cargado: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 font-bold text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Operador *</span>
                </label>
                <input
                  type="text"
                  placeholder="Nombre u Operador"
                  value={form.operador}
                  onChange={(e) => setForm(prev => ({ ...prev, operador: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 font-bold text-white text-xs focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] font-bold uppercase text-slate-300 mb-1">Observaciones / Novedades</label>
              <textarea
                rows="2"
                placeholder="Novedades del equipo, cambio de aceite, mantención..."
                value={form.observaciones}
                onChange={(e) => setForm(prev => ({ ...prev, observaciones: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 font-medium text-white text-xs focus:border-amber-500 focus:outline-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-2xl transition cursor-pointer shadow-lg uppercase tracking-wider flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? 'Guardando Registro...' : 'Enviar Reporte Diario'}
            </button>
          </form>
        )}
      </div>

      <footer className="text-center text-[10px] text-slate-500 py-2 border-t border-slate-800">
        © Obraxis | Control Inteligente de Maquinaria y Equipos en Faena
      </footer>
    </div>
  );
}
