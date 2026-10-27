import {advanceNotificationRecipients} from './advanceNotificationRecipients.js';

export const WORK_EMAIL_EVENTS = [
  {id:'avance_registrado',label:'Reportes de avance',description:'Al crear o editar un avance. Incluye curva S y producción reciente.',permission:'obras.avances.enviar'},
  {id:'asistencia_registrada',label:'Asistencia registrada desde la obra',description:'Un resumen por guardado, también al registrar varios trabajadores. No incluye firmas, RUT ni ubicación GPS. Los marcajes del portal público QR no envían este aviso.',permission:'obras.personal.enviar'},
  {id:'maquinaria_registrada',label:'Uso y partes de maquinaria',description:'Al registrar uso de un equipo o guardar un parte de maquinaria desde esta obra.',permission:'obras.maquinaria.enviar'},
  {id:'material_registrado',label:'Movimientos de materiales',description:'Al guardar un ingreso o uso de materiales desde esta obra.',permission:'obras.gestion.enviar'},
  {id:'mantenimiento_registrado',label:'Mantenciones registradas',description:'Al registrar una mantención desde esta obra.',permission:'obras.maquinaria.enviar'},
  {id:'maquinaria_falla_reportada',label:'Fallas y paralizaciones',description:'Al registrar una falla o paralización desde esta obra.',permission:'obras.maquinaria.enviar'},
  {id:'incidente_accidente',label:'Incidentes y accidentes',description:'Aviso sin datos personales ni detalles sensibles, al registrar un evento HSE desde esta obra.',permission:'obras.prevencion.enviar'}
];
export const normalizeEmails = value => [...new Set((Array.isArray(value)?value:String(value||'').split(',')).map(item=>String(item).trim().toLowerCase()).filter(Boolean))];
export const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const workEmailKey = (workId,work) => workId ? `obra:${workId}` : `avances_obra:${work}`;
export const ALL_WORKS_EMAIL_KEY = 'obras:global';
export function allWorksEmailSetting(config={},event) {
  return config.correos_contextuales?.[ALL_WORKS_EMAIL_KEY]?.events?.[event] || {emails:[],emailsCC:[],autoNotify:true};
}

export function workEmailSetting(config={},work,workId,event) {
  const contexts=config.correos_contextuales||{};
  const context=contexts[workEmailKey(workId,work)] || contexts[`avances_obra:${work}`];
  const specific=context?.events?.[event];
  if(specific) return {...specific,source:'specific',exclusive:true};
  // Old work-wide destinations applied only to advances, never to new event types.
  if(event!=='avance_registrado')return {emails:[],emailsCC:[],autoNotify:false,source:'unconfigured',exclusive:true};
  if(context && Object.hasOwn(context,'autoNotify'))return {...context,source:'legacy',exclusive:false};
  return {emails:normalizeEmails(config.email_notificaciones),emailsCC:normalizeEmails(config.email_notificaciones_cc),autoNotify:config.notificaciones_automaticas!==false,source:'company',exclusive:false};
}

export function workEmailRecipients({config={},company,work,workId,event,rules=[],users=[]}) {
  const setting=workEmailSetting(config,work,workId,event);
  const global=allWorksEmailSetting(config,event);
  let to=setting.autoNotify?normalizeEmails(setting.emails).filter(validEmail):[];
  let cc=setting.autoNotify?normalizeEmails(setting.emailsCC).filter(validEmail):[];
  if(setting.autoNotify && event==='avance_registrado' && !setting.exclusive)to=advanceNotificationRecipients({rules,users,company,work,fallback:to});
  if(global.autoNotify){
    to=normalizeEmails([...to,...normalizeEmails(global.emails)]).filter(validEmail);
    cc=normalizeEmails([...cc,...normalizeEmails(global.emailsCC)]).filter(validEmail);
  }
  // An address present as a direct recipient or through a rule gets only one email.
  return {to,cc:cc.filter(email=>!to.includes(email))};
}

export function workEmailPatch(current,work,workId,events,scope='work') {
  const key=scope==='all'?ALL_WORKS_EMAIL_KEY:workEmailKey(workId,work);
  const contexts=current.correos_contextuales||{};
  const previous=contexts[key]||(scope==='all'?{}:contexts[`avances_obra:${work}`])||{};
  return {correos_contextuales:{...contexts,[key]:{...previous,events:{...(previous.events||{}),...events},updatedAt:new Date().toISOString()}}};
}

// One address cannot have both a company-wide rule and a local rule for an event.
// Keep other event types and unrelated module settings untouched.
export function uniqueWorkEmailPatch(patch) {
  const contexts=JSON.parse(JSON.stringify(patch.correos_contextuales||{}));
  const clean=setting=>{
    if(!setting)return;
    setting.emails=normalizeEmails(setting.emails);
    setting.emailsCC=normalizeEmails(setting.emailsCC).filter(email=>!setting.emails.includes(email));
  };
  for(const definition of WORK_EMAIL_EVENTS){
    const global=contexts[ALL_WORKS_EMAIL_KEY]?.events?.[definition.id];
    clean(global);
    const globalEmails=new Set([...(global?.emails||[]),...(global?.emailsCC||[])]);
    for(const [key,context] of Object.entries(contexts)){
      if(key===ALL_WORKS_EMAIL_KEY || !/^(obra:|avances_obra:)/.test(key))continue;
      const setting=context.events?.[definition.id] || (definition.id==='avance_registrado' && Object.hasOwn(context,'autoNotify')?context:null);
      clean(setting);
      if(setting){setting.emails=setting.emails.filter(email=>!globalEmails.has(email));setting.emailsCC=setting.emailsCC.filter(email=>!globalEmails.has(email));}
    }
  }
  return {...patch,correos_contextuales:contexts};
}

export function moveWorkEmail(forms,event,email,type,targetScope) {
  const result=structuredClone(forms);
  for(const key of [event,`all:${event}`]){
    result[key]={emails:[],emailsCC:[],autoNotify:true,...result[key]};
    result[key].emails=normalizeEmails(result[key].emails).filter(value=>value!==email);
    result[key].emailsCC=normalizeEmails(result[key].emailsCC).filter(value=>value!==email);
  }
  if(targetScope){
    const key=targetScope==='all'?`all:${event}`:event;
    result[key][type==='to'?'emails':'emailsCC'].push(email);
  }
  return result;
}

// The server accepts ten total recipients. Preserve CC, including CC-only groups.
export function workEmailBatches({to=[],cc=[]}) {
  const direct=normalizeEmails(to),copies=normalizeEmails(cc).filter(email=>!direct.includes(email));
  const all=[...direct.map(email=>({email,copy:false})),...copies.map(email=>({email,copy:true}))];
  const batches=[];
  for(let offset=0;offset<all.length;offset+=10){
    const slice=all.slice(offset,offset+10);
    const batch={to:slice.filter(item=>!item.copy).map(item=>item.email),cc:slice.filter(item=>item.copy).map(item=>item.email)};
    if(!batch.to.length)batch.to.push(batch.cc.shift());
    batches.push(batch);
  }
  return batches;
}
