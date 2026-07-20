import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ShieldAlert, Send, CheckCircle2, Camera, PenTool, AlertCircle, Loader2, Check, Plus 
} from 'lucide-react';

export default function PublicFormFiller({ formToken }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fillAnswers, setFillAnswers] = useState({});
  const [fillMetadata, setFillMetadata] = useState({
    proyecto_nombre: '',
    inspector: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Firmas Canvas
  const mainCanvasRef = useRef(null);
  const repeaterCanvasRefs = useRef({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [mainSignatureDataUrl, setMainSignatureDataUrl] = useState('');
  const [repeaterSignatures, setRepeaterSignatures] = useState({});

  useEffect(() => {
    if (formToken) {
      loadPublicForm();
    }
  }, [formToken]);

  const loadPublicForm = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('prevencion_formularios').select('*');
      
      const isNum = !isNaN(formToken);
      if (isNum) {
        query = query.eq('id', parseInt(formToken, 10));
      } else {
        query = query.eq('publico_token', formToken);
      }

      const { data, error: err } = await query.maybeSingle();
      if (err) throw err;

      if (!data) {
        setError('El formulario solicitado no existe o no se encuentra disponible.');
      } else {
        setForm(data);
        
        // Inicializar respuestas para bloques repetibles con 1 elemento por defecto
        const initial = {};
        (data.campos || []).forEach(f => {
          if (f.type === 'repeater') {
            initial[f.id] = [{}];
          }
        });
        setFillAnswers(initial);
      }
    } catch (err) {
      setError('Error cargando formulario: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manejo de bloques repetibles
  const handleAddRepeaterInstance = (fieldId) => {
    setFillAnswers(prev => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), {}]
    }));
  };

  const handleDeleteRepeaterInstance = (fieldId, index) => {
    setFillAnswers(prev => ({
      ...prev,
      [fieldId]: (prev[fieldId] || []).filter((_, idx) => idx !== index)
    }));
  };

  const handleUpdateRepeaterAnswer = (fieldId, instanceIndex, subFieldId, value) => {
    setFillAnswers(prev => {
      const instances = [...(prev[fieldId] || [])];
      instances[instanceIndex] = {
        ...(instances[instanceIndex] || {}),
        [subFieldId]: value
      };
      return { ...prev, [fieldId]: instances };
    });
  };

  // Lógica de dibujo de firma
  const startDrawing = (e, keyRef = 'main') => {
    const canvas = keyRef === 'main' ? mainCanvasRef.current : repeaterCanvasRefs.current[keyRef];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(keyRef);
  };

  const draw = (e, keyRef = 'main') => {
    if (isDrawing !== keyRef) return;
    const canvas = keyRef === 'main' ? mainCanvasRef.current : repeaterCanvasRefs.current[keyRef];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (keyRef = 'main') => {
    if (isDrawing === keyRef) {
      setIsDrawing(false);
      const canvas = keyRef === 'main' ? mainCanvasRef.current : repeaterCanvasRefs.current[keyRef];
      if (canvas) {
        const url = canvas.toDataURL();
        if (keyRef === 'main') setMainSignatureDataUrl(url);
        else {
          setRepeaterSignatures(prev => ({ ...prev, [keyRef]: url }));
        }
      }
    }
  };

  const clearSignature = (keyRef = 'main') => {
    const canvas = keyRef === 'main' ? mainCanvasRef.current : repeaterCanvasRefs.current[keyRef];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (keyRef === 'main') setMainSignatureDataUrl('');
      else {
        setRepeaterSignatures(prev => ({ ...prev, [keyRef]: '' }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form) return;

    setSubmitting(true);
    setError('');

    try {
      const finalAnswers = JSON.parse(JSON.stringify(fillAnswers));
      Object.entries(repeaterSignatures).forEach(([key, sigUrl]) => {
        const [fId, idx, subId] = key.split('_instance_');
        if (finalAnswers[fId] && finalAnswers[fId][idx]) {
          finalAnswers[fId][idx][subId] = sigUrl;
        }
      });

      const { error: insErr } = await supabase
        .from('prevencion_respuestas')
        .insert([
          {
            formulario_id: form.id,
            proyecto_nombre: fillMetadata.proyecto_nombre.trim() || 'Terreno',
            inspector: fillMetadata.inspector.trim() || 'Trabajador Terreno',
            respuestas: finalAnswers,
            firma_url: mainSignatureDataUrl
          }
        ]);

      if (insErr) throw insErr;
      setSubmittedSuccess(true);
    } catch (err) {
      setError('Error al enviar respuestas: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center space-y-3 max-w-sm w-full">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-700 uppercase">Cargando Formulario de Prevención...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center space-y-4 max-w-md w-full">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-sm uppercase">Formulario no Encontrado</h3>
          <p className="text-xs text-slate-500">{error || 'El enlace utilizado es inválido o no existe.'}</p>
        </div>
      </div>
    );
  }

  if (submittedSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center space-y-4 max-w-md w-full animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-slate-850 text-base uppercase tracking-tight">¡Inspección Enviada con Éxito!</h3>
            <p className="text-xs text-slate-500">
              Muchas gracias. El formulario "{form.titulo}" ha sido registrado correctamente en la plataforma de Prevención de Riesgos.
            </p>
          </div>
          <button
            onClick={() => {
              setSubmittedSuccess(false);
              setFillAnswers({});
              setMainSignatureDataUrl('');
              setRepeaterSignatures({});
              setFillMetadata({ proyecto_nombre: '', inspector: '' });
            }}
            className="mt-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer"
          >
            Enviar Otra Respuesta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 py-8 px-4 flex items-center justify-center font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xl w-full max-w-2xl p-6 sm:p-8 space-y-6">
        
        {/* Cabecera del Formulario Público */}
        <div className="border-b border-slate-150 pb-5 space-y-2 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-extrabold uppercase bg-primary/10 text-primary px-3 py-1 rounded-full">
              {form.categoria || 'Prevención de Riesgos'}
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-850 uppercase tracking-tight leading-snug">
            {form.titulo}
          </h1>
          {form.descripcion && (
            <p className="text-xs text-slate-500 leading-relaxed">{form.descripcion}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Identificación del Terreno */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Proyecto / Faena *</label>
              <input
                type="text"
                required
                value={fillMetadata.proyecto_nombre}
                onChange={(e) => setFillMetadata({ ...fillMetadata, proyecto_nombre: e.target.value })}
                placeholder="ej: Faena Costanera"
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold uppercase text-slate-800 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Inspector / Trabajador *</label>
              <input
                type="text"
                required
                value={fillMetadata.inspector}
                onChange={(e) => setFillMetadata({ ...fillMetadata, inspector: e.target.value })}
                placeholder="ej: Pedro Morales"
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold uppercase text-slate-800 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Preguntas Dinámicas */}
          <div className="space-y-6">
            {(form.campos || []).map((f, index) => {
              const isRepeater = f.type === 'repeater';

              if (isRepeater) {
                const instances = fillAnswers[f.id] || [{}];

                return (
                  <div key={f.id} className="space-y-4 border-2 border-amber-200 rounded-3xl p-5 bg-amber-50/20">
                    <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                      <h4 className="text-xs font-black text-amber-900 uppercase">{index + 1}. {f.label}</h4>
                      <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-100 px-2 py-0.5 rounded-full">
                        {instances.length} registrados
                      </span>
                    </div>

                    {instances.map((inst, instIdx) => (
                      <div key={instIdx} className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3 relative shadow-2xs">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                          <span className="text-[10px] font-extrabold text-amber-800 uppercase">
                            #{instIdx + 1} {f.label}
                          </span>
                          {instances.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRepeaterInstance(f.id, instIdx)}
                              className="text-red-500 hover:bg-red-50 text-[10px] font-bold px-2 py-0.5 rounded"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>

                        {(f.subFields || []).map((sub) => (
                          <div key={sub.id} className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase">
                              {sub.label}
                            </label>

                            {sub.type === 'text' && (
                              <input
                                type="text"
                                value={inst[sub.id] || ''}
                                onChange={(e) => handleUpdateRepeaterAnswer(f.id, instIdx, sub.id, e.target.value)}
                                placeholder="Escriba aquí..."
                                className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
                              />
                            )}

                            {sub.type === 'status_switch' && (
                              <div className="flex gap-2">
                                {['Cumple', 'No Cumple', 'N/A'].map(st => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleUpdateRepeaterAnswer(f.id, instIdx, sub.id, st)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                      inst[sub.id] === st
                                        ? st === 'Cumple' ? 'bg-emerald-600 text-white' :
                                          st === 'No Cumple' ? 'bg-red-650 text-white' : 'bg-slate-700 text-white'
                                        : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            )}

                            {sub.type === 'signature' && (
                              <div className="space-y-1">
                                <div className="border border-slate-200 rounded-xl p-1 bg-slate-50">
                                  <canvas
                                    ref={el => { repeaterCanvasRefs.current[`${f.id}_instance_${instIdx}_${sub.id}`] = el; }}
                                    width={450}
                                    height={120}
                                    onMouseDown={(e) => startDrawing(e, `${f.id}_instance_${instIdx}_${sub.id}`)}
                                    onMouseMove={(e) => draw(e, `${f.id}_instance_${instIdx}_${sub.id}`)}
                                    onMouseUp={() => stopDrawing(`${f.id}_instance_${instIdx}_${sub.id}`)}
                                    onTouchStart={(e) => startDrawing(e, `${f.id}_instance_${instIdx}_${sub.id}`)}
                                    onTouchMove={(e) => draw(e, `${f.id}_instance_${instIdx}_${sub.id}`)}
                                    onTouchEnd={() => stopDrawing(`${f.id}_instance_${instIdx}_${sub.id}`)}
                                    className="w-full h-28 bg-white rounded-lg touch-none cursor-crosshair"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => clearSignature(`${f.id}_instance_${instIdx}_${sub.id}`)}
                                  className="text-[10px] text-red-650 font-bold hover:underline"
                                >
                                  Limpiar Firma
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleAddRepeaterInstance(f.id)}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{f.buttonText || '+ Agregar Otro'}</span>
                    </button>
                  </div>
                );
              }

              // CAMPOS ESTÁNDAR
              return (
                <div key={f.id} className="space-y-2 border-b border-slate-100 pb-5">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase">
                    {index + 1}. {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>

                  {f.type === 'text' && (
                    <input
                      type="text"
                      required={f.required}
                      value={fillAnswers[f.id] || ''}
                      onChange={(e) => setFillAnswers({ ...fillAnswers, [f.id]: e.target.value })}
                      placeholder="Escriba aquí..."
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                    />
                  )}

                  {f.type === 'textarea' && (
                    <textarea
                      rows="3"
                      required={f.required}
                      value={fillAnswers[f.id] || ''}
                      onChange={(e) => setFillAnswers({ ...fillAnswers, [f.id]: e.target.value })}
                      placeholder="Escriba observaciones..."
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                    />
                  )}

                  {f.type === 'status_switch' && (
                    <div className="flex gap-3">
                      {['Cumple', 'No Cumple', 'N/A'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFillAnswers({ ...fillAnswers, [f.id]: st })}
                          className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                            fillAnswers[f.id] === st
                              ? st === 'Cumple' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' :
                                st === 'No Cumple' ? 'bg-red-650 text-white border-red-650 shadow-xs' : 'bg-slate-700 text-white border-slate-700 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-250'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  )}

                  {(f.type === 'radio' || f.type === 'checkbox') && (
                    <div className="space-y-1.5 pl-2">
                      {(f.options || []).map((opt, oIdx) => (
                        <label key={oIdx} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type={f.type === 'radio' ? 'radio' : 'checkbox'}
                            name={f.id}
                            checked={
                              f.type === 'radio'
                                ? fillAnswers[f.id] === opt
                                : (fillAnswers[f.id] || []).includes(opt)
                            }
                            onChange={(e) => {
                              if (f.type === 'radio') {
                                setFillAnswers({ ...fillAnswers, [f.id]: opt });
                              } else {
                                const currentArr = fillAnswers[f.id] || [];
                                const updated = e.target.checked
                                  ? [...currentArr, opt]
                                  : currentArr.filter(x => x !== opt);
                                setFillAnswers({ ...fillAnswers, [f.id]: updated });
                              }
                            }}
                            className="text-primary focus:ring-primary"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {f.type === 'signature' && (
                    <div className="space-y-2">
                      <div className="border-2 border-slate-200 rounded-2xl p-1 bg-slate-50/50">
                        <canvas
                          ref={mainCanvasRef}
                          width={500}
                          height={150}
                          onMouseDown={(e) => startDrawing(e, 'main')}
                          onMouseMove={(e) => draw(e, 'main')}
                          onMouseUp={() => stopDrawing('main')}
                          onTouchStart={(e) => startDrawing(e, 'main')}
                          onTouchMove={(e) => draw(e, 'main')}
                          onTouchEnd={() => stopDrawing('main')}
                          className="w-full h-32 bg-white rounded-xl touch-none border border-slate-200 cursor-crosshair"
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-450 font-bold">Dibuja tu firma en el recuadro con el dedo</span>
                        <button
                          type="button"
                          onClick={() => clearSignature('main')}
                          className="text-red-650 hover:underline font-bold"
                        >
                          Limpiar Firma
                        </button>
                      </div>
                    </div>
                  )}

                  {f.type === 'photo' && (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50">
                      <Camera className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <span className="text-xs font-bold text-slate-600 block">Cargar o Tomar Foto de Evidencia</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFillAnswers({ ...fillAnswers, [f.id]: reader.result });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="mt-2 text-xs text-slate-500 file:bg-primary file:text-white file:border-0 file:px-3 file:py-1 file:rounded-lg"
                      />
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-2xl shadow-sm text-xs cursor-pointer flex items-center justify-center gap-2 transition uppercase tracking-wider"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Enviando Inspección...' : 'Enviar Inspección de Prevención'}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
