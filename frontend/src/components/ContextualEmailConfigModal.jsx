import React, { useState, useEffect } from 'react';
import { Settings, Mail, Check, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function ContextualEmailConfigModal({
  isOpen,
  onClose,
  moduloTitle = 'Configuración de Correos',
  moduloKey = 'general',
  obraNombre = '',
  user
}) {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailsCC, setEmailsCC] = useState([]);
  const [newEmailCC, setNewEmailCC] = useState('');
  const [autoNotify, setAutoNotify] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const storageKey = `emails_config_${user?.empresa || 'Obraxis'}_${moduloKey}_${obraNombre || 'global'}`;

  useEffect(() => {
    if (!isOpen) return;
    loadConfig();
  }, [isOpen, moduloKey, obraNombre]);

  const loadConfig = async () => {
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      // 1. Cargar primero de localStorage
      const local = localStorage.getItem(storageKey);
      if (local) {
        const parsed = JSON.parse(local);
        setEmails(parsed.emails || []);
        setEmailsCC(parsed.emailsCC || []);
        setAutoNotify(parsed.autoNotify !== undefined ? parsed.autoNotify : true);
      }

      // 2. Cargar de Supabase config_empresa si existe
      if (user?.empresa) {
        const { data } = await supabase
          .from('config_empresa')
          .select('email_notificaciones, email_notificaciones_cc')
          .eq('empresa', user.empresa)
          .single();

        if (data && !local) {
          if (data.email_notificaciones) {
            setEmails(data.email_notificaciones.split(',').map(e => e.trim()).filter(Boolean));
          }
          if (data.email_notificaciones_cc) {
            setEmailsCC(data.email_notificaciones_cc.split(',').map(e => e.trim()).filter(Boolean));
          }
        }
      }
    } catch (e) {
      console.warn("Aviso al cargar correos:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = (type) => {
    if (type === 'to') {
      if (!newEmail || !newEmail.includes('@')) return;
      if (!emails.includes(newEmail.trim())) {
        setEmails([...emails, newEmail.trim()]);
      }
      setNewEmail('');
    } else {
      if (!newEmailCC || !newEmailCC.includes('@')) return;
      if (!emailsCC.includes(newEmailCC.trim())) {
        setEmailsCC([...emailsCC, newEmailCC.trim()]);
      }
      setNewEmailCC('');
    }
  };

  const handleRemoveEmail = (emailToRemove, type) => {
    if (type === 'to') {
      setEmails(emails.filter(e => e !== emailToRemove));
    } else {
      setEmailsCC(emailsCC.filter(e => e !== emailToRemove));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const configObj = {
        emails,
        emailsCC,
        autoNotify,
        updatedAt: new Date().toISOString()
      };

      // Guardar localmente para respuesta instantánea
      localStorage.setItem(storageKey, JSON.stringify(configObj));

      // Intentar sincronizar con Supabase
      if (user?.empresa) {
        const toStr = emails.join(', ');
        const ccStr = emailsCC.join(', ');
        await supabase
          .from('config_empresa')
          .update({
            email_notificaciones: toStr,
            email_notificaciones_cc: ccStr
          })
          .eq('empresa', user.empresa);
      }

      setMsg({ type: 'success', text: 'Configuración de correos guardada exitosamente.' });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Error al guardar la configuración.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-900 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">{moduloTitle}</h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {obraNombre ? `Destinatarios para ${obraNombre}` : 'Destinatarios del Módulo'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
        </div>

        {msg.text && (
          <div className={`p-2.5 rounded-xl text-xs font-semibold mb-3 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Destinatarios Principales */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Destinatarios Principales (Para)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail('to'); } }}
                placeholder="ejemplo@obraxis.cl"
                className="flex-1 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-900"
              />
              <button
                type="button"
                onClick={() => handleAddEmail('to')}
                className="bg-blue-900 text-white px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-800 transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {emails.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic">No hay correos principales agregados.</span>
              ) : (
                emails.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 bg-blue-100 text-blue-950 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-blue-200">
                    <Mail className="w-3 h-3 text-blue-800" />
                    <span>{e}</span>
                    <button type="button" onClick={() => handleRemoveEmail(e, 'to')} className="text-blue-700 hover:text-red-600 font-bold ml-1 cursor-pointer">✕</button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Destinatarios en Copia (CC) */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Correos en Copia (CC)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={newEmailCC}
                onChange={(e) => setNewEmailCC(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail('cc'); } }}
                placeholder="gerencia@obraxis.cl"
                className="flex-1 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-900"
              />
              <button
                type="button"
                onClick={() => handleAddEmail('cc')}
                className="bg-slate-800 text-white px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-700 transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar CC</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {emailsCC.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic">No hay correos en copia.</span>
              ) : (
                emailsCC.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 bg-slate-200 text-slate-800 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-300">
                    <Mail className="w-3 h-3 text-slate-600" />
                    <span>{e}</span>
                    <button type="button" onClick={() => handleRemoveEmail(e, 'cc')} className="text-slate-600 hover:text-red-600 font-bold ml-1 cursor-pointer">✕</button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Opción de envío automático */}
          <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
            <input
              type="checkbox"
              id="autoNotifyCheck"
              checked={autoNotify}
              onChange={(e) => setAutoNotify(e.target.checked)}
              className="w-4 h-4 accent-blue-900 rounded cursor-pointer"
            />
            <label htmlFor="autoNotifyCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
              Enviar notificaciones por correo automáticamente al generar o guardar registros.
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl text-xs shadow-sm cursor-pointer disabled:opacity-70 transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Guardando...' : 'Guardar Destinatarios'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl text-xs cursor-pointer transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
