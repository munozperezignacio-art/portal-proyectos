import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldAlert, Play, CheckCircle2, AlertCircle, Loader2, Check, ArrowRight, Award, ClipboardList } from 'lucide-react';

export default function PublicTrainingFiller({ trainingToken }) {
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Formulario del trabajador
  const [workerName, setWorkerName] = useState('');
  const [workerRut, setWorkerRut] = useState('');
  
  // Respuestas del cuestionario: { preguntaIndex: opcionIndex }
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState(null); // { puntaje_obtenido, puntaje_maximo, nota, aprobado }

  useEffect(() => {
    if (trainingToken) {
      loadPublicTraining();
    }
  }, [trainingToken]);

  const loadPublicTraining = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('prevencion_capacitaciones').select('*');
      
      const isNum = !isNaN(trainingToken);
      if (isNum) {
        query = query.eq('id', parseInt(trainingToken, 10));
      } else {
        query = query.eq('publico_token', trainingToken);
      }

      const { data, error: err } = await query.maybeSingle();
      if (err) throw err;

      if (!data) {
        setError('La capacitación solicitada no existe o fue dada de baja.');
      } else {
        setTraining(data);
      }
    } catch (err) {
      setError('Error cargando capacitación: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Convertidor de URL de YouTube/Vimeo a Embed Link
  const getEmbedUrl = (url) => {
    if (!url) return null;
    // YouTube
    const ytReg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const ytMatch = url.match(ytReg);
    if (ytMatch && ytMatch[2].length === 11) {
      return `https://www.youtube.com/embed/${ytMatch[2]}`;
    }
    // Vimeo
    const vimeoReg = /vimeo\.com\/(\d+)/;
    const vimeoMatch = url.match(vimeoReg);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return null;
  };

  // Formateador de RUT chileno en tiempo real
  const formatRut = (value) => {
    const clean = value.replace(/[^0-9kK]/g, '');
    if (!clean) return '';
    if (clean.length <= 1) return clean;
    const dv = clean.slice(-1);
    const body = clean.slice(0, -1);
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formattedBody}-${dv.toUpperCase()}`;
  };

  const handleRutChange = (e) => {
    setWorkerRut(formatRut(e.target.value));
  };

  const calculateChileanGrade = (score, max) => {
    if (max === 0) return 1.0;
    const pct = score / max;
    let grade = 1.0;
    if (pct < 0.6) {
      grade = 1.0 + 3.0 * (pct / 0.6);
    } else {
      grade = 4.0 + 3.0 * ((pct - 0.6) / 0.4);
    }
    return Math.round(grade * 10) / 10;
  };

  const handleSubmitEvaluation = async (e) => {
    e.preventDefault();
    if (!workerName.trim() || !workerRut.trim()) {
      alert("Por favor, ingresa tu Nombre y RUT antes de enviar la evaluación.");
      return;
    }

    const preguntas = training.preguntas || [];
    if (preguntas.length === 0) {
      alert("Esta capacitación no tiene preguntas de evaluación configuradas.");
      return;
    }

    // Validar que se hayan contestado todas las preguntas
    if (Object.keys(answers).length < preguntas.length) {
      alert("Por favor, responde todas las preguntas del cuestionario.");
      return;
    }

    setSubmitting(true);
    try {
      let puntajeObtenido = 0;
      let puntajeMaximo = 0;

      preguntas.forEach((preg, idx) => {
        const puntos = parseFloat(preg.puntos) || 1;
        puntajeMaximo += puntos;

        const answerIndexSelected = answers[idx];
        if (answerIndexSelected === parseInt(preg.correct_idx)) {
          puntajeObtenido += puntos;
        }
      });

      const notaFinal = calculateChileanGrade(puntajeObtenido, puntajeMaximo);
      const aprobado = notaFinal >= 4.0;

      const { error: insErr } = await supabase
        .from('prevencion_capacitaciones_intentos')
        .insert([{
          capacitacion_id: training.id,
          nombre_trabajador: workerName,
          rut_trabajador: workerRut,
          respuestas: answers,
          puntaje_obtenido: puntajeObtenido,
          puntaje_maximo: puntajeMaximo,
          nota: notaFinal,
          aprobado: aprobado
        }]);

      if (insErr) throw insErr;

      setAttemptResult({
        puntaje_obtenido: puntajeObtenido,
        puntaje_maximo: puntajeMaximo,
        nota: notaFinal,
        aprobado: aprobado
      });

    } catch (err) {
      alert("Error al guardar la evaluación: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const embedUrl = training ? getEmbedUrl(training.video_url) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cargando material instructivo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white border border-red-200 rounded-3xl p-8 shadow-md text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Acceso Denegado / No Disponible</h2>
          <p className="text-xs text-slate-550 leading-relaxed font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (attemptResult) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white border border-slate-250 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-primary shadow-xs">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="font-black text-slate-850 text-base uppercase tracking-wider">Evaluación Procesada con éxito</h2>
            <p className="text-xs text-slate-450 font-bold uppercase">{training.titulo}</p>
          </div>

          <div className={`p-6 rounded-2xl border ${attemptResult.aprobado ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1">Nota Final Obtenida</p>
            <h1 className="text-5xl font-black tracking-tight">{attemptResult.nota.toFixed(1)}</h1>
            <p className="text-[11px] font-bold mt-2 uppercase tracking-wide">
              {attemptResult.aprobado ? '🎉 APROBADO (Escala 60%)' : '❌ REPROBADO (Requiere nota mínima 4.0)'}
            </p>
            <p className="text-[9.5px] mt-1 font-semibold text-slate-500">
              Puntaje: {attemptResult.puntaje_obtenido} de {attemptResult.puntaje_maximo} puntos.
            </p>
          </div>

          <div className="text-xs text-slate-500 font-semibold max-w-sm mx-auto leading-relaxed border-t pt-4">
            Tu respuesta y evaluación han quedado registradas en el Portal de Prevención de la empresa constructora. Ya puedes cerrar esta ventana.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Encabezado */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 tracking-wider">Módulo de Prevención</span>
            <h1 className="text-base font-black text-slate-850 uppercase tracking-wide leading-tight">{training.titulo}</h1>
            {training.descripcion && <p className="text-xs text-slate-500 font-semibold">{training.descripcion}</p>}
          </div>
        </div>

        {/* Video instructivo (Si existe) */}
        {embedUrl && (
          <div className="bg-white border border-slate-250 rounded-3xl p-4 shadow-xs space-y-3">
            <h3 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Play className="w-4 h-4 text-red-500" /> Video de la Capacitación
            </h3>
            <div className="aspect-video w-full rounded-2xl overflow-hidden border bg-black shadow-xs">
              <iframe
                src={embedUrl}
                title="Training Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
          </div>
        )}

        {/* Manuales / Instrucciones */}
        {training.contenido_texto && (
          <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-3">
            <h3 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-primary" /> Contenido de Estudio
            </h3>
            <div className="text-xs text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap">
              {training.contenido_texto}
            </div>
          </div>
        )}

        {/* Formulario e Intentos */}
        <form onSubmit={handleSubmitEvaluation} className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs space-y-6">
          <h3 className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-emerald-600" /> Evaluación de Conocimientos
          </h3>

          {/* Datos del Trabajador */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-slate-450 block">Nombre Completo del Trabajador</label>
              <input 
                type="text" 
                required 
                value={workerName} 
                onChange={(e) => setWorkerName(e.target.value)} 
                placeholder="ej: Pedro González" 
                className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-slate-450 block">RUT del Trabajador</label>
              <input 
                type="text" 
                required 
                value={workerRut} 
                onChange={handleRutChange} 
                placeholder="12.345.678-9" 
                className="w-full border border-slate-250 rounded-xl p-2.5 bg-white text-slate-800"
              />
            </div>
          </div>

          {/* Preguntas de Evaluación */}
          <div className="space-y-6 border-t pt-6">
            {(training.preguntas || []).map((preg, pregIdx) => (
              <div key={pregIdx} className="bg-slate-50 border border-slate-150 p-5 rounded-2xl space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <h4 className="font-extrabold text-xs text-slate-800">
                    {pregIdx + 1}. {preg.pregunta}
                  </h4>
                  <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-655 shrink-0 select-none">
                    {preg.puntos || 1} pts
                  </span>
                </div>

                <div className="space-y-2">
                  {(preg.opciones || []).map((op, opIdx) => {
                    const isSelected = answers[pregIdx] === opIdx;
                    return (
                      <label 
                        key={opIdx} 
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition ${
                          isSelected ? 'bg-primary/5 border-primary text-primary font-bold shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`preg-${pregIdx}`}
                          checked={isSelected}
                          onChange={() => setAnswers({ ...answers, [pregIdx]: opIdx })}
                          className="w-4 h-4 text-primary border-slate-350 focus:ring-primary"
                        />
                        <span className="text-xs font-semibold">{op}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {(training.preguntas || []).length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 font-bold uppercase border border-dashed rounded-2xl bg-slate-50">
                Esta capacitación no cuenta con evaluación configurada en este momento.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={submitting || (training.preguntas || []).length === 0}
              className="bg-primary text-white font-extrabold text-xs uppercase px-6 py-3 rounded-xl hover:bg-primary-hover shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Enviar Respuestas y Finalizar
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
