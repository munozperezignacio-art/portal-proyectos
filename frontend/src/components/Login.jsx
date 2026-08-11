import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Eye, EyeOff, Lock, Building2, User, AlertCircle, Loader2, QrCode, Navigation, RotateCcw, CheckCircle2, AlertTriangle, Search, Mail, KeyRound } from 'lucide-react';
import { sendSystemEmail } from '../utils/emailService';
import { getAuthenticatedProfile } from '../utils/auth';

function Login({ onLoginSuccess, onBackHome }) {
  const [username, setUsername] = useState('');
  const [company, setCompany] = useState('Obraxis');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados de Recuperación de Contraseña
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);

  const [companiesList, setCompaniesList] = useState([]);
  const [selectedBranding, setSelectedBranding] = useState(null);

  // Estados Lector y Marcación QR Rápida
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [obrasListQR, setObrasListQR] = useState([]);
  const [selectedObraQR, setSelectedObraQR] = useState(null);
  const [qrWorkerData, setQrWorkerData] = useState({ trabajador: '', rut: '', rutInput: '', cargo: '' });
  const [rutValidationState, setRutValidationState] = useState({ status: 'idle', error: '' });
  const [personalListQR, setPersonalListQR] = useState([]);
  const [qrGpsLoc, setQrGpsLoc] = useState({ lat: null, lng: null, distance: null, status: 'idle', isWithin: false, error: '' });
  const [qrSubmitLoading, setQrSubmitLoading] = useState(false);
  const [qrSuccessMsg, setQrSuccessMsg] = useState('');
  const [qrErrorMsg, setQrErrorMsg] = useState('');
  const [qrWelcomeData, setQrWelcomeData] = useState(null);

  const qrCanvasRef = React.useRef(null);
  const [qrIsDrawing, setQrIsDrawing] = useState(false);
  const [qrHasSignature, setQrHasSignature] = useState(false);

  useEffect(() => {
    fetchObrasForQR();
  }, []);

  // --- Utilidades de Formato y Validación Módulo 11 de RUT Chileno ---
  const formatRut = (rawStr) => {
    if (!rawStr) return '';
    let clean = rawStr.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length === 0) return '';
    if (clean.length === 1) return clean;

    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formattedBody}-${dv}`;
  };

  const validateRut = (rawStr) => {
    if (!rawStr) return false;
    const clean = rawStr.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length < 8 || clean.length > 9) return false;

    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);

    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body.charAt(i), 10) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const expectedDvNum = 11 - (sum % 11);
    let expectedDv = 'K';
    if (expectedDvNum === 11) expectedDv = '0';
    else if (expectedDvNum < 10) expectedDv = expectedDvNum.toString();

    return dv === expectedDv;
  };

  const handleRutInputChange = (e) => {
    const rawVal = e.target.value;
    const formatted = formatRut(rawVal);
    const clean = rawVal.replace(/[^0-9kK]/g, '').toUpperCase();

    if (clean.length === 0) {
      setQrWorkerData({ trabajador: '', rut: '', rutInput: '', cargo: '' });
      setRutValidationState({ status: 'idle', error: '' });
      return;
    }

    if (clean.length < 8) {
      setQrWorkerData({ trabajador: '', rut: formatted, rutInput: formatted, cargo: '' });
      setRutValidationState({ status: 'typing', error: 'Ingresa los dígitos de tu RUT...' });
      return;
    }

    const isValid = validateRut(clean);
    if (!isValid) {
      setQrWorkerData({ trabajador: '', rut: formatted, rutInput: formatted, cargo: '' });
      setRutValidationState({ status: 'invalid', error: '⚠️ RUT inválido. Verifica el número e ingresa nuevamente.' });
      return;
    }

    // RUT válido Módulo 11 -> Buscar en la lista de personal de la obra
    const found = personalListQR.find(p => {
      const pClean = (p.rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
      return pClean === clean || p.rut === formatted;
    });

    if (found) {
      setQrWorkerData({ trabajador: found.nombre, rut: formatted, rutInput: formatted, cargo: found.cargo });
      setRutValidationState({ status: 'valid', error: '' });
    } else {
      setQrWorkerData({ trabajador: '', rut: formatted, rutInput: formatted, cargo: '' });
      setRutValidationState({ status: 'not_found', error: 'RUT no registrado en esta obra.' });
    }
  };

  const fetchObrasForQR = async () => {
    try {
      const { data } = await supabase.from('obras').select('*').order('nombre', { ascending: true });
      if (data) {
        setObrasListQR(data);

        // Detectar si la URL contiene parámetro de Obra proveniente de código QR escaneado
        const params = new URLSearchParams(window.location.search);
        const obraParam = params.get('obra') || params.get('obra_id') || params.get('asistencia');
        
        if (obraParam) {
          const match = data.find(o => 
            o.id.toString() === obraParam || 
            o.nombre.toLowerCase() === decodeURIComponent(obraParam).toLowerCase()
          );
          if (match) {
            handleSelectObraQR(match);
            setShowQRScanner(true);
          }
        }
      }
    } catch (e) {
      console.error('Error cargando obras para QR:', e);
    }
  };

  const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const handleSelectObraQR = async (obra) => {
    setSelectedObraQR(obra);
    setQrSuccessMsg('');
    setQrErrorMsg('');
    setQrWorkerData({ trabajador: '', rut: '' });
    clearSignatureQR();

    try {
      const { data } = await supabase.from('maestro_personal').select('nombre, rut, cargo').eq('obra_nombre', obra.nombre);
      setPersonalListQR(data || []);
    } catch (e) {
      setPersonalListQR([]);
    }

    requestGPSForLoginQR(obra);
  };

  const requestGPSForLoginQR = (obra) => {
    setQrGpsLoc({ lat: null, lng: null, distance: null, status: 'loading', isWithin: false, error: '' });
    if (!navigator.geolocation) {
      setQrGpsLoc({ lat: null, lng: null, distance: null, status: 'error', isWithin: false, error: 'GPS no soportado' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        let dist = null;
        let within = true;
        if (obra && obra.latitud && obra.longitud) {
          const oLat = parseFloat(obra.latitud);
          const oLng = parseFloat(obra.longitud);
          const maxR = parseFloat(obra.radio_cobertura_m || 200);
          dist = getHaversineDistance(uLat, uLng, oLat, oLng);
          if (dist !== null && dist > maxR) within = false;
        }
        setQrGpsLoc({ lat: uLat, lng: uLng, distance: dist, status: 'success', isWithin: within, error: '' });
      },
      (err) => {
        setQrGpsLoc({ lat: null, lng: null, distance: null, status: 'error', isWithin: false, error: 'Permiso GPS denegado. Activa tu ubicación para verificar.' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleStartDrawQR = (e) => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setQrIsDrawing(true);
  };

  const handleDrawQR = (e) => {
    if (!qrIsDrawing) return;
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setQrHasSignature(true);
  };

  const handleStopDrawQR = () => setQrIsDrawing(false);

  const clearSignatureQR = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setQrHasSignature(false);
  };

  const submitLoginAsistenciaQR = async (e) => {
    e.preventDefault();
    setQrSubmitLoading(true);
    setQrSuccessMsg('');
    setQrErrorMsg('');
    setQrWelcomeData(null);
    try {
      if (!qrWorkerData.trabajador) throw new Error('Debes seleccionar o ingresar un trabajador.');
      if (selectedObraQR?.latitud && selectedObraQR?.longitud && qrGpsLoc.status === 'success' && !qrGpsLoc.isWithin) {
        const maxR = selectedObraQR.radio_cobertura_m || 200;
        throw new Error(`⚠️ Marcación rechazada por ubicación: Te encuentras a ${qrGpsLoc.distance}m de la obra (máximo permitido ${maxR}m).`);
      }
      let firmaBase64 = null;
      if (qrCanvasRef.current && qrHasSignature) {
        firmaBase64 = qrCanvasRef.current.toDataURL('image/png');
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const workerName = qrWorkerData.trabajador.trim();
      const obraName = selectedObraQR.nombre;

      // Buscar si el trabajador ya registra marcaje de INGRESO hoy en esta obra sin salida
      let existingRecord = null;
      try {
        const { data: recs } = await supabase
          .from('asistencia_personal')
          .select('id, ingreso, salida, created_at')
          .eq('obra_nombre', obraName)
          .eq('trabajador', workerName)
          .gte('created_at', `${todayStr}T00:00:00.000Z`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recs && recs.length > 0 && recs[0].ingreso && !recs[0].salida) {
          existingRecord = recs[0];
        }
      } catch (checkErr) {
        console.warn("Aviso al verificar marcaje previo:", checkErr);
      }

      let isExit = false;

      if (existingRecord) {
        // Segundo marcaje del día -> Registrar SALIDA
        isExit = true;
        const { error: exitErr } = await supabase
          .from('asistencia_personal')
          .update({ salida: horaActual })
          .eq('id', existingRecord.id);

        if (exitErr) throw exitErr;
      } else {
        // Primer marcaje del día -> Registrar INGRESO
        const basePayload = {
          obra_nombre: obraName,
          supervisor: 'Autogestión_QR_Móvil',
          trabajador: workerName,
          rut: qrWorkerData.rut ? qrWorkerData.rut.trim() : null,
          asistencia: 'PRESENTE',
          ingreso: horaActual,
          salida: null,
          colacion: 'SI',
          horas_ordinarias: 9
        };

        const fullPayload = {
          ...basePayload,
          firma_base64: firmaBase64,
          latitud: qrGpsLoc.lat,
          longitud: qrGpsLoc.lng,
          distancia_obra_m: qrGpsLoc.distance,
          verificado_qr: true
        };

        let { error } = await supabase.from('asistencia_personal').insert([fullPayload]);

        if (error && error.message && error.message.includes('column')) {
          console.warn("Reintentando insercion de asistencia con campos base:", error.message);
          const retryRes = await supabase.from('asistencia_personal').insert([basePayload]);
          if (retryRes.error) throw retryRes.error;
        } else if (error) {
          throw error;
        }
      }

      // Configurar datos de la pantalla de confirmación/bienvenida (duración 4 segundos)
      setQrWelcomeData({
        tipo: isExit ? 'SALIDA' : 'INGRESO',
        trabajador: workerName,
        obra: obraName,
        hora: horaActual
      });

      setTimeout(() => {
        setQrWelcomeData(null);
        setShowQRScanner(false);
        setSelectedObraQR(null);
        clearSignatureQR();
      }, 4000);
    } catch (err) {
      setQrErrorMsg(err.message);
    } finally {
      setQrSubmitLoading(false);
    }
  };

  // Logo base64 obtenido de la versión original
  // Marca institucional; cada empresa conserva su propio logo configurado.
  const obraxisLogo = '/brand/obraxis-primary.png';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: loginData, error: loginError } = await supabase.functions.invoke('login-usuario', {
        body: { usuario: username.trim(), empresa: company.trim(), password }
      });
      if (loginError || loginData?.error || !loginData?.access_token) {
        throw new Error(loginData?.error || 'Usuario, empresa o contraseña incorrectos.');
      }
      const { data, error } = await supabase.auth.setSession({
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token
      });
      if (error || !data.user) throw new Error('No fue posible iniciar la sesión segura.');

      try {
        const profile = await getAuthenticatedProfile(data.user, company);
        onLoginSuccess(profile);
      } catch (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error inesperado al intentar iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar empresas de branding desde la base de datos
  useEffect(() => {
    async function loadBranding() {
      try {
        const { data, error } = await supabase
          .from('config_empresa')
          .select('empresa, logo_base64, color_primario, color_secundario')
          .order('empresa', { ascending: true });

        if (error) throw error;

        // Fallback robusto si la tabla está vacía o hay error
        const list = data && data.length > 0 ? data : [
          {
            empresa: 'Obraxis',
            logo_base64: obraxisLogo,
            color_primario: '#0f172a',
            color_secundario: '#2563eb'
          }
        ];
        
        setCompaniesList(list);
        
        // Seleccionar Obraxis por defecto
        const defaultCompany = list.find(c => c.empresa === 'Obraxis') || list[0];
        if (defaultCompany) {
          setCompany(defaultCompany.empresa);
          setSelectedBranding(defaultCompany);
        }
      } catch (err) {
        console.error('Error al cargar branding:', err);
        const fallback = [
          {
            empresa: 'Obraxis',
            logo_base64: obraxisLogo,
            color_primario: '#0f172a',
            color_secundario: '#2563eb'
          }
        ];
        setCompaniesList(fallback);
        setCompany('Obraxis');
        setSelectedBranding(fallback[0]);
      }
    }
    loadBranding();
  }, []);

  // Actualizar variables de CSS cuando cambia la empresa seleccionada
  useEffect(() => {
    if (!company || companiesList.length === 0) return;
    const match = companiesList.find(c => c.empresa === company);
    if (match) {
      setSelectedBranding(match);
      document.documentElement.style.setProperty('--primary-color', match.color_primario || '#1e3a8a');
      document.documentElement.style.setProperty('--primary-color-hover', match.color_secundario || '#1d4ed8');
    } else {
      setSelectedBranding(null);
      document.documentElement.style.setProperty('--primary-color', '#1e3a8a');
      document.documentElement.style.setProperty('--primary-color-hover', '#1d4ed8');
    }
  }, [company, companiesList]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-tr from-slate-900 via-slate-950 to-zinc-900">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100/20">
        
        {/* Encabezado y Logo */}
        <div className="text-center mb-6">
          <img src={selectedBranding?.logo_base64 || obraxisLogo} className="mx-auto max-h-24 object-contain mb-3" alt="Obraxis Logo" />
          <h2 className="text-xl font-bold text-slate-800">Portal de Proyectos</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">Control Operativo Centralizado</p>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 mb-4 text-xs font-medium animate-shake">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Usuario */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Usuario
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                className="pl-9 text-slate-800 font-medium w-full px-3 py-2.5 border rounded-lg border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition text-sm bg-slate-50"
              />
            </div>
          </div>

          {/* Empresa */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Empresa
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Building2 className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Escribe el nombre de tu empresa (ej. Obraxis)"
                className="pl-9 text-slate-800 font-medium w-full px-3 py-2.5 border rounded-lg border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition text-sm bg-slate-50"
              />
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 pr-10 text-slate-800 font-medium w-full px-3 py-2.5 border rounded-lg border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition text-sm bg-slate-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="flex justify-end mt-1">
              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setResetError('');
                  setShowForgotPasswordModal(true);
                }}
                className="text-[11px] font-bold text-blue-900 hover:underline cursor-pointer"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {/* Botón de Ingreso */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 rounded-lg shadow-md hover:-translate-y-0.5 transition active:translate-y-0 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando...</span>
              </>
            ) : (
              <span>Ingresar al Portal</span>
            )}
          </button>

        </form>

        {/* Acceso Rápido Asistencia QR desde Login */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowQRScanner(true)}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition"
          >
            <QrCode className="w-4 h-4 text-blue-400" />
            <span> Escanear QR / Marcación Rápida</span>
          </button>
        </div>

        {onBackHome && (
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={onBackHome}
              className="text-xs text-slate-500 hover:text-slate-700 font-bold hover:underline cursor-pointer"
            >
              ← Volver al Inicio (obraxis.cl)
            </button>
          </div>
        )}

      </div>

      {/* Modal Lector QR y Marcaje Directo desde Login */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-900 rounded-lg">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Marcación Rápida por QR</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Asistencia Móvil con Geofencing (200m)</p>
                </div>
              </div>
              <button onClick={() => setShowQRScanner(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {/* Paso 1: Selección / Escaneo de Obra */}
            {!selectedObraQR ? (
              <div className="space-y-4 my-2">
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Selecciona tu Obra o escanea el código QR de faena para verificar tu distancia y registrar tu asistencia inmediatamente:
                </p>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500">Seleccionar Obra de Faena</label>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                    {obrasListQR.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleSelectObraQR(o)}
                        className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition flex justify-between items-center cursor-pointer group"
                      >
                        <div>
                          <p className="font-bold text-xs text-slate-800 group-hover:text-blue-900 uppercase">{o.nombre}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{o.tipo || 'General'}</p>
                        </div>
                        <span className="text-[10px] font-bold text-blue-900 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">Escanear</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Paso 2: Formulario de Asistencia con Geofencing & Canvas */
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Obra Seleccionada</span>
                    <span className="text-xs font-extrabold text-blue-950 uppercase">{selectedObraQR.nombre}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedObraQR(null)}
                    className="text-[10px] text-blue-900 font-bold hover:underline cursor-pointer"
                  >
                    Cambiar
                  </button>
                </div>

                {/* Banner Estado GPS */}
                <div>
                  {qrGpsLoc.status === 'loading' && (
                    <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center gap-2 font-medium">
                      <Navigation className="w-4 h-4 animate-spin text-blue-900 shrink-0" />
                      <span>Verificando tu posición GPS en faena...</span>
                    </div>
                  )}

                  {qrGpsLoc.status === 'error' && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs space-y-1 font-medium">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Error GPS</span>
                      </div>
                      <p className="text-[10px]">{qrGpsLoc.error}</p>
                      <button
                        type="button"
                        onClick={() => requestGPSForLoginQR(selectedObraQR)}
                        className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-1 rounded transition"
                      >
                        Reintentar GPS
                      </button>
                    </div>
                  )}

                  {qrGpsLoc.status === 'success' && (
                    <div>
                      {selectedObraQR.latitud && selectedObraQR.longitud ? (
                        qrGpsLoc.isWithin ? (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <p className="font-bold text-emerald-950"> Ubicación Verificada en Faena</p>
                              <p className="text-[10px] text-emerald-700 font-medium">Distancia a faena: {qrGpsLoc.distance}m (Radio máximo: {selectedObraQR.radio_cobertura_m || 200}m)</p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2 font-medium">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-amber-950"> Fuera del Radio Autorizado de Obra</p>
                              <p className="text-[10px] text-amber-800 mt-0.5">Te encuentras a <strong>{qrGpsLoc.distance} metros</strong> de la obra. Para marcar asistencia debes estar dentro del radio de <strong>{selectedObraQR.radio_cobertura_m || 200} metros</strong>.</p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="p-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[11px] font-medium">
                           Obra sin coordenadas fijadas. Puedes registrar tu marcaje.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {qrSuccessMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold">{qrSuccessMsg}</div>}
                {qrErrorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold">{qrErrorMsg}</div>}

                <form onSubmit={submitLoginAsistenciaQR} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      RUT del Trabajador (Autoformato y Verificación)
                    </label>
                    <input
                      type="text"
                      required
                      value={qrWorkerData.rutInput || ''}
                      onChange={handleRutInputChange}
                      placeholder="Ej: 18.988.192-4 (o 189881924)"
                      maxLength={12}
                      className={`w-full border rounded-xl p-3 text-xs font-mono font-bold text-slate-800 focus:outline-none transition ${
                        rutValidationState.status === 'valid'
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 shadow-2xs'
                          : rutValidationState.status === 'invalid'
                          ? 'border-red-400 bg-red-50/50 text-red-900'
                          : 'border-slate-300 focus:border-blue-900'
                      }`}
                    />

                    {rutValidationState.status === 'valid' && (
                      <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-extrabold text-xs">{qrWorkerData.trabajador}</p>
                          {qrWorkerData.cargo && <p className="text-[10px] text-emerald-700 font-medium">Cargo: {qrWorkerData.cargo}</p>}
                        </div>
                      </div>
                    )}

                    {rutValidationState.status === 'invalid' && (
                      <div className="mt-1.5 text-[11px] font-bold text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{rutValidationState.error}</span>
                      </div>
                    )}

                    {rutValidationState.status === 'not_found' && (
                      <div className="mt-2 space-y-2 animate-in fade-in duration-200">
                        <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium flex items-start gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>RUT con formato válido pero no registrado en la lista de la obra. Si perteneces a esta faena, ingresa tu Nombre Completo:</span>
                        </div>
                        <input
                          type="text"
                          required
                          value={qrWorkerData.trabajador}
                          onChange={(e) => setQrWorkerData({ ...qrWorkerData, trabajador: e.target.value })}
                          placeholder="Ingresa tu Nombre y Apellido Completo"
                          className="w-full border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-900"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-500">Firma Manuscrita del Trabajador</label>
                      {qrHasSignature && (
                        <button
                          type="button"
                          onClick={clearSignatureQR}
                          className="text-[10px] text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Limpiar Firma</span>
                        </button>
                      )}
                    </div>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative overflow-hidden">
                      <canvas
                        ref={qrCanvasRef}
                        width={350}
                        height={120}
                        onMouseDown={handleStartDrawQR}
                        onMouseMove={handleDrawQR}
                        onMouseUp={handleStopDrawQR}
                        onTouchStart={handleStartDrawQR}
                        onTouchMove={handleDrawQR}
                        onTouchEnd={handleStopDrawQR}
                        className="w-full h-28 touch-none cursor-crosshair"
                      />
                      {!qrHasSignature && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs font-medium">
                          ✍️ Firma aquí con tu dedo
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={qrSubmitLoading || (selectedObraQR?.latitud && selectedObraQR?.longitud && qrGpsLoc.status === 'success' && !qrGpsLoc.isWithin)}
                    className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl shadow-sm text-xs cursor-pointer disabled:opacity-50 transition"
                  >
                    {qrSubmitLoading ? 'Guardando Registro...' : 'Confirmar y Enviar Asistencia'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación / Bienvenida de 4 Segundos */}
      {qrWelcomeData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[10000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in duration-300 relative overflow-hidden">
            
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-800 mb-1 leading-tight">
              {qrWelcomeData.tipo === 'INGRESO'
                ? `¡Bienvenido ${qrWelcomeData.trabajador}!`
                : `¡Hasta luego ${qrWelcomeData.trabajador}!`}
            </h3>

            <p className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-3">
              Obra: {qrWelcomeData.obra}
            </p>

            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl mb-5 space-y-1">
              <p className="text-xs font-semibold">
                Tu <strong>{qrWelcomeData.tipo === 'INGRESO' ? 'INGRESO' : 'SALIDA'}</strong> fue registrado a las:
              </p>
              <p className="text-3xl font-black text-emerald-600 tracking-wider">
                {qrWelcomeData.hora}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setQrWelcomeData(null);
                setShowQRScanner(false);
                setSelectedObraQR(null);
                clearSignatureQR();
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer transition"
            >
              Listo / Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE RECUPERACIÓN DE CONTRASEÑA (DESDE usuarios@obraxis.cl) */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-900 rounded-xl">
                  <KeyRound className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Recuperación de Contraseña</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Remitente oficial: usuarios@obraxis.cl</p>
                </div>
              </div>
              <button onClick={() => setShowForgotPasswordModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {resetSent ? (
              <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="font-extrabold text-sm text-emerald-900">¡Instrucciones Enviadas!</h4>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Hemos enviado un correo desde <b>usuarios@obraxis.cl</b> a <b>{resetEmail}</b> con el enlace seguro para reestablecer tu contraseña.
                </p>
                <p className="text-[10px] text-emerald-700 font-medium">
                  Si no lo ves en tu bandeja principal, revisa tu carpeta de Spam / Correo no deseado.
                </p>
                <button
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="mt-2 w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  Entendido / Volver al Login
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!resetEmail.trim() || !resetEmail.includes('@')) {
                    setResetError('Por favor ingresa un correo electrónico válido.');
                    return;
                  }
                  setResetLoading(true);
                  setResetError('');

                  try {
                    // 1. Trigger Supabase reset email
                    await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
                      redirectTo: `${window.location.origin}/reset-password`
                    });

                    // 2. Send transactional notification email via Resend (usuarios@obraxis.cl)
                    const htmlEmail = `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                        <h2 style="color: #1e3a8a; margin-top: 0;">🔑 Solicitud de Recuperación de Contraseña</h2>
                        <p style="color: #334155; font-size: 14px;">Hola,</p>
                        <p style="color: #334155; font-size: 14px;">Hemos recibido una solicitud para reestablecer la contraseña de acceso a tu cuenta en <b>Obraxis Portal de Proyectos</b>.</p>
                        <p style="color: #334155; font-size: 14px;">Si fuiste tú quien solicitó este cambio, haz clic en el siguiente botón para continuar:</p>
                        <div style="text-align: center; margin: 25px 0;">
                          <a href="${window.location.origin}" style="background-color: #1e3a8a; color: #ffffff; padding: 12px 24px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block;">Reestablecer Mi Contraseña</a>
                        </div>
                        <p style="color: #64748b; font-size: 12px; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                          Este correo fue enviado automáticamente desde <b>usuarios@obraxis.cl</b>. Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.
                        </p>
                      </div>
                    `;

                    await sendSystemEmail({
                      to: resetEmail.trim(),
                      subject: '🔑 Recuperación de Contraseña Obraxis',
                      htmlContent: htmlEmail,
                      customSender: 'usuarios@obraxis.cl'
                    });

                    setResetSent(true);
                  } catch (err) {
                    setResetError('No pudimos enviar el correo. Verifica el correo e intenta nuevamente: ' + err.message);
                  } finally {
                    setResetLoading(false);
                  }
                }}
                className="space-y-3 text-xs"
              >
                <p className="text-slate-600 text-xs leading-relaxed">
                  Ingresa la dirección de correo electrónico vinculada a tu cuenta de Obraxis. Te enviaremos las instrucciones desde <b>usuarios@obraxis.cl</b>.
                </p>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo Electrónico Registrado <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="ejemplo@empresa.cl"
                      className="w-full pl-9 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-900 font-medium"
                    />
                  </div>
                </div>

                {resetError && (
                  <p className="text-[11px] text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-200">
                    {resetError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl shadow-xs text-xs cursor-pointer transition flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Enviar Enlace desde usuarios@obraxis.cl</span>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
