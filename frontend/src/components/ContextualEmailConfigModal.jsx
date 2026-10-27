import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Settings, Mail, Check, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {WORK_EMAIL_EVENTS,workEmailSetting,allWorksEmailSetting,workEmailPatch,normalizeEmails,validEmail} from '../utils/workEmailRouting';

export default function ContextualEmailConfigModal({
  isOpen,
  onClose,
  moduloTitle = 'Configuración de Correos',
  moduloKey = 'general',
  obraNombre = '',
  obraId,
  user
}) {
  const isWork=moduloKey==='avances_obra';
  const [event,setEvent]=useState('avance_registrado');
  const [scope,setScope]=useState('work');
  const formKey=scope==='all'?`all:${event}`:event;
  const [eventForms,setEventForms]=useState({});
  const [dirtyEvents,setDirtyEvents]=useState([]);
  const [configLoaded,setConfigLoaded]=useState(false);
  const requestVersion=useRef(0);
  const [baseEmails, setBaseEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [baseEmailsCC, setBaseEmailsCC] = useState([]);
  const [newEmailCC, setNewEmailCC] = useState('');
  const [baseAutoNotify, setBaseAutoNotify] = useState(true);
  const currentEvent=eventForms[formKey]||{};
  const emails=isWork?(currentEvent.emails||[]):baseEmails;
  const emailsCC=isWork?(currentEvent.emailsCC||[]):baseEmailsCC;
  const autoNotify=isWork?Boolean(currentEvent.autoNotify):baseAutoNotify;
  const updateEvent=patch=>{setDirtyEvents(current=>[...new Set([...current,formKey])]);setEventForms(current=>({...current,[formKey]:{...current[formKey],...patch}}));};
  const setEmails=value=>isWork?updateEvent({emails:value}):setBaseEmails(value);
  const setEmailsCC=value=>isWork?updateEvent({emailsCC:value}):setBaseEmailsCC(value);
  const setAutoNotify=value=>isWork?updateEvent({autoNotify:value}):setBaseAutoNotify(value);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const contextKey = `${moduloKey}:${obraNombre || 'global'}`;

  const loadConfig = useCallback(async () => {
    const version=++requestVersion.current;
    setLoading(true);
    setConfigLoaded(false);
    setMsg({ type: '', text: '' });
    try {
      if (user?.empresa) {
        const { data, error } = await supabase
          .from('config_empresa')
          .select('email_notificaciones, email_notificaciones_cc, notificaciones_automaticas, correos_contextuales')
          .eq('empresa', user.empresa)
          .single();
        if(version!==requestVersion.current)return;
        if (error) throw error;

        const contextual = data?.correos_contextuales?.[contextKey];
        setBaseEmails(normalizeEmails(contextual?.emails ?? data?.email_notificaciones));
        setBaseEmailsCC(normalizeEmails(contextual?.emailsCC ?? data?.email_notificaciones_cc));
        setBaseAutoNotify(contextual?.autoNotify ?? data?.notificaciones_automaticas ?? true);
        if(isWork)setEventForms(Object.fromEntries(WORK_EMAIL_EVENTS.flatMap(item=>{
          const setting=workEmailSetting(data,obraNombre,obraId,item.id);
          const global=allWorksEmailSetting(data,item.id);
          const form=value=>({emails:normalizeEmails(value.emails),emailsCC:normalizeEmails(value.emailsCC),autoNotify:Boolean(value.autoNotify)});
          return [[item.id,form(setting)],[`all:${item.id}`,form(global)]];
        })));
        setConfigLoaded(true);
      }
    } catch (e) {
      if(version!==requestVersion.current)return;
      setMsg({ type: 'error', text: e.message || 'No fue posible cargar la configuración de correos.' });
    } finally {
      if(version===requestVersion.current)setLoading(false);
    }
  }, [contextKey, user?.empresa,isWork,obraId,obraNombre]);

  useEffect(() => {
    if (!isOpen) return;
    setEvent('avance_registrado');setScope('work');setEventForms({});setDirtyEvents([]);setNewEmail('');setNewEmailCC('');
    loadConfig();
    return ()=>{requestVersion.current++;};
  }, [isOpen, loadConfig]);

  const handleAddEmail = (type) => {
    const address=(type==='to'?newEmail:newEmailCC).trim().toLowerCase();
    if(!validEmail(address)){setMsg({type:'error',text:'Ingresa un correo válido antes de agregarlo.'});return;}
    setMsg({type:'',text:''});
    if (type === 'to') {
      if (!newEmail || !newEmail.includes('@')) return;
      if (!emails.includes(address) && !emailsCC.includes(address)) {
        setEmails([...emails, address]);
      }
      setNewEmail('');
    } else {
      if (!newEmailCC || !newEmailCC.includes('@')) return;
      if (!emailsCC.includes(address) && !emails.includes(address)) {
        setEmailsCC([...emailsCC, address]);
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
      if (!user?.empresa) throw new Error('No existe una empresa activa para guardar esta configuración.');
      if(!configLoaded)throw new Error('Primero debe cargarse la configuración de la empresa.');
      if(newEmail.trim() || newEmailCC.trim())throw new Error('Agrega el correo que escribiste con el botón Agregar antes de guardar.');
      if(isWork && Object.values(eventForms).some(item=>[...item.emails,...item.emailsCC].some(email=>!validEmail(email))))throw new Error('Revisa los correos de los tipos de notificación.');

      const { data: current, error: loadError } = await supabase
        .from('config_empresa')
        .select('correos_contextuales, updated_at')
        .eq('empresa', user.empresa)
        .single();
      if (loadError) throw loadError;

      const contexts = {
        ...(current?.correos_contextuales || {}),
        [contextKey]: { emails, emailsCC, autoNotify, updatedAt: new Date().toISOString() }
      };

      const changedEvents=Object.fromEntries(dirtyEvents.filter(id=>!id.startsWith('all:')).map(id=>[id,eventForms[id]]));
      const globalEvents=Object.fromEntries(dirtyEvents.filter(id=>id.startsWith('all:')).map(id=>[id.slice(4),eventForms[id]]));
      let patch=isWork?(Object.keys(changedEvents).length?workEmailPatch(current,obraNombre,obraId,changedEvents):{correos_contextuales:current.correos_contextuales||{}}):{
        email_notificaciones:emails.join(', '),email_notificaciones_cc:emailsCC.join(', '),notificaciones_automaticas:autoNotify,correos_contextuales:contexts
      };
      if(isWork && Object.keys(globalEvents).length)patch=workEmailPatch({...current,...patch},obraNombre,obraId,globalEvents,'all');
      let query = supabase
        .from('config_empresa')
        .update({...patch,updated_at:new Date().toISOString()})
        .eq('empresa', user.empresa);
      if(current?.updated_at)query=query.eq('updated_at',current.updated_at);
      const {error:saveError}=await query.select('empresa').single();
      if (saveError) throw saveError;
      setDirtyEvents([]);

      setMsg({ type: 'success', text: 'Configuración de correos guardada exitosamente.' });
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
          <button disabled={loading} aria-label="Cerrar configuración de correos" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer disabled:opacity-50">✕</button>
        </div>

        {msg.text && (
          <div className={`p-2.5 rounded-xl text-xs font-semibold mb-3 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <fieldset disabled={loading||!configLoaded} className="space-y-4 disabled:opacity-60">
          {isWork && <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <label htmlFor="workEmailEvent" className="block text-xs font-bold text-slate-800">Tipo de notificación</label>
            <select id="workEmailEvent" value={event} onChange={e=>{
              if(newEmail.trim()||newEmailCC.trim()){setMsg({type:'error',text:'Agrega o borra el correo escrito antes de cambiar de tipo.'});return;}
              setEvent(e.target.value);setMsg({type:'',text:''});
            }} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs">
              {WORK_EMAIL_EVENTS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <p className="text-xs text-slate-600">{WORK_EMAIL_EVENTS.find(item=>item.id===event)?.description}</p>
            <label htmlFor="workEmailScope" className="block text-xs font-bold text-slate-800">Aplicar correos a</label>
            <select id="workEmailScope" value={scope} onChange={e=>{
              if(newEmail.trim()||newEmailCC.trim()){setMsg({type:'error',text:'Agrega o borra el correo escrito antes de cambiar de alcance.'});return;}
              setScope(e.target.value);setMsg({type:'',text:''});
            }} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs">
              <option value="work">Solo esta obra</option>
              <option value="all">Todas las obras (existentes y nuevas)</option>
            </select>
            <p className="text-xs font-semibold text-blue-900">{scope==='all'?`Todas las obras de ${user?.empresa}: los correos que agregues aquí también se aplicarán a obras futuras.`:`Solo ${obraNombre}: los correos que agregues aquí no se aplicarán a otras obras.`}</p>
            <p className="text-xs text-slate-600">Cada tipo y alcance tiene su propia lista. Los destinatarios de ambos alcances se suman sin duplicados. Puedes editar ambos antes de guardar.</p>
            <details className="text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Prioridad y otras notificaciones</summary>
              <p className="mt-2">Desactivar el envío solo afecta la lista del alcance seleccionado. Los correos de «Todas las obras» siguen recibiendo aunque la lista local esté desactivada. Para detenerlos, cambia a ese alcance y desactívalo. Las reglas antiguas de avance se conservan hasta guardar una configuración específica de esta obra.</p>
              <p className="mt-2">Los recordatorios de pendientes, registros de prevención e informes programados se administran en Control de notificaciones y en sus módulos respectivos. No se activan desde aquí.</p>
              <p className="mt-2">El envío respeta los permisos del usuario. Si solo agregas CC, una dirección se usará como destinatario principal.</p>
            </details>
          </div>}
          
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
                className="min-w-0 flex-1 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-900"
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
                className="min-w-0 flex-1 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-900"
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
              {isWork?`Enviar automáticamente a los destinatarios de ${scope==='all'?'todas las obras':'esta obra'}.`:'Enviar notificaciones por correo automáticamente al generar o guardar registros.'}
            </label>
          </div>
          {isWork && autoNotify && !emails.length && !emailsCC.length && <p className="text-xs text-amber-800">Sin destinatarios en este alcance. El otro alcance mantiene su configuración. No se usará el correo del usuario como respaldo.</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl text-xs shadow-sm cursor-pointer disabled:opacity-70 transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Guardando...' : isWork?'Guardar configuración de correos':'Guardar Destinatarios'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl text-xs cursor-pointer transition"
            >
              Cancelar
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
