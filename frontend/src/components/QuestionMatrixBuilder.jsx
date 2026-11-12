import { useState } from 'react';

// Each row uses a standard radio field so existing PDFs, exports and required-field
// checks read the same answers, including on clients predating this builder.
export default function QuestionMatrixBuilder({ onAdd }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState('');
  const [columns, setColumns] = useState('Sí\nNo\nNo aplica');
  const [required, setRequired] = useState(true);
  const lines = value => value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const questions = lines(rows), options = lines(columns);
  const valid = title.trim() && questions.length && options.length >= 2 &&
    new Set(questions).size === questions.length && new Set(options).size === options.length;
  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-800">+ Matriz de preguntas</button>;
  return <fieldset className="w-full rounded-xl border border-slate-200 p-4 space-y-3">
    <legend className="px-2 font-bold">Matriz de preguntas</legend>
    <label className="block">Título<input className="block w-full rounded border p-2" value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label className="block">Preguntas (una por línea)<textarea className="block w-full rounded border p-2" value={rows} onChange={e => setRows(e.target.value)} /></label>
    <label className="block">Alternativas (una por línea)<textarea className="block w-full rounded border p-2" value={columns} onChange={e => setColumns(e.target.value)} /></label>
    <label className="block"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> Exigir respuesta en cada fila</label>
    <button type="button" disabled={!valid} className="rounded bg-blue-800 px-3 py-2 text-white disabled:opacity-50" onClick={() => {
      const matrixId=crypto.randomUUID();
      onAdd(questions.map(question => ({id: crypto.randomUUID(), matrixId, type: 'radio', label: title.trim() + ' · ' + question, options: [...options], required})));
      setRows(''); setTitle(''); setEditing(false);
    }}>Agregar filas</button> <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
  </fieldset>;
}
