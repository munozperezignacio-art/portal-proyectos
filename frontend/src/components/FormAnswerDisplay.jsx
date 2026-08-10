import React from 'react';

const textValue = value => {
  if (value === null || value === undefined || value === '') return 'Sin respuesta';
  if (Array.isArray(value)) return value.map(textValue).join(', ');
  if (typeof value === 'object') return value.nombre || value.label || value.value || value.texto || Object.values(value).filter(item => typeof item !== 'object').join(' · ') || 'Sin respuesta';
  return String(value);
};

const isImage = (field, value) => (field?.type === 'photo' || field?.type === 'signature') && typeof value === 'string' && value.startsWith('data:image');

export default function FormAnswerDisplay({ field, value }) {
  const instances = Array.isArray(value) && (field?.type === 'repeater' || value.some(item => item && typeof item === 'object')) ? value : null;
  if (instances) return <div className="mt-2 space-y-3">
    {instances.length ? instances.map((instance, index) => <div key={index} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
      {Object.entries(instance || {}).map(([subId, subValue]) => { const subField = field.subFields?.find(candidate => candidate.id === subId); const label = subField?.label || subId; return <div key={subId} className="py-1.5"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>{isImage(subField, subValue) ? <img src={subValue} alt={label} className={subField.type === 'photo' ? 'mt-1 max-h-56 rounded-lg border border-slate-200' : 'mt-1 max-h-20'} /> : <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{textValue(subValue)}</p>}</div>; })}
    </div>) : <p className="text-sm text-slate-500">Sin registros ingresados.</p>}
  </div>;
  if (isImage(field, value)) return <img src={value} alt={field.label} className={field.type === 'photo' ? 'mt-2 max-h-64 rounded-lg border border-slate-200' : 'mt-2 max-h-24'} />;
  return <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{textValue(value)}</p>;
}
