import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Users, ArrowLeft, Search, Plus, Edit, Trash2, Loader2, AlertCircle, Check, Building2, UserPlus 
} from 'lucide-react';

function Personal({ user, onBack }) {
  const [personal, setPersonal] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObraFilter, setSelectedObraFilter] = useState('');

  // Estados para modal de agregar/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null); // null para agregar, worker object para editar
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    rut: '',
    cargo: '',
    obra_nombre: '',
    inicio: '',
    termino: '',
    colacion: '0',
    movilizacion: '0'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar personal
      const { data: dataPers, error: errPers } = await supabase
        .from('maestro_personal')
        .select('*')
        .order('nombre', { ascending: true });
      if (errPers) throw errPers;
      setPersonal(dataPers || []);

      // 2. Cargar obras (para el dropdown de selección de obra)
      const { data: dataObras, error: errObras } = await supabase
        .from('obras')
        .select('nombre')
        .order('nombre', { ascending: true });
      if (errObras) throw errObras;
      setObras(dataObras || []);
    } catch (err) {
      console.error('Error cargando personal/obras:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingWorker(null);
    setFormData({
      nombre: '',
      rut: '',
      cargo: '',
      obra_nombre: obras.length > 0 ? obras[0].nombre : '',
      inicio: '',
      termino: '',
      colacion: '0',
      movilizacion: '0'
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (worker) => {
    setEditingWorker(worker);
    setFormData({
      nombre: worker.nombre || '',
      rut: worker.rut || '',
      cargo: worker.cargo || '',
      obra_nombre: worker.obra_nombre || '',
      inicio: worker.inicio || '',
      termino: worker.termino || '',
      colacion: worker.colacion ? worker.colacion.toString() : '0',
      movilizacion: worker.movilizacion ? worker.movilizacion.toString() : '0'
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleDeleteWorker = async (worker) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${worker.nombre}?`)) return;

    try {
      const { error } = await supabase.from('maestro_personal').delete().eq('id', worker.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert(`Error al eliminar trabajador: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const dataToSave = {
      nombre: formData.nombre.trim(),
      rut: formData.rut ? formData.rut.trim() : null,
      cargo: formData.cargo.trim(),
      obra_nombre: formData.obra_nombre,
      inicio: formData.inicio || null,
      termino: formData.termino || null,
      colacion: parseFloat(formData.colacion) || 0,
      movilizacion: parseFloat(formData.movilizacion) || 0
    };

    try {
      if (editingWorker) {
        // Actualizar existente
        const { error } = await supabase
          .from('maestro_personal')
          .update(dataToSave)
          .eq('id', editingWorker.id);
        if (error) throw error;
        setSuccessMsg('Trabajador actualizado correctamente.');
      } else {
        // Insertar nuevo. Verificamos si el RUT ya existe
        if (dataToSave.rut) {
          const { data: existing } = await supabase
            .from('maestro_personal')
            .select('id')
            .eq('rut', dataToSave.rut)
            .maybeSingle();

          if (existing) {
            throw new Error(`Ya existe un trabajador registrado con el RUT ${dataToSave.rut}`);
          }
        }

        const { error } = await supabase.from('maestro_personal').insert([dataToSave]);
        if (error) throw error;
        setSuccessMsg('Trabajador registrado y asignado con éxito.');
      }

      fetchData();
      setTimeout(() => setModalOpen(false), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Filtrar personal en pantalla
  const filteredPersonal = personal.filter(p => {
    const matchesSearch = 
      (p.nombre && p.nombre.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.rut && p.rut.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.cargo && p.cargo.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesObra = 
      selectedObraFilter === '' || 
      (p.obra_nombre && p.obra_nombre.toLowerCase() === selectedObraFilter.toLowerCase());

    return matchesSearch && matchesObra;
  });

  return (
    <div className="space-y-4">
      
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-200 rounded-lg transition cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Recursos Humanos</h2>
        </div>
        
        <button
          onClick={handleOpenAddModal}
          className="bg-blue-900 hover:bg-blue-800 text-white font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Contratar</span>
        </button>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre, RUT o cargo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-slate-800 font-medium w-full px-3 py-2 border rounded-lg border-slate-200 focus:outline-none focus:border-blue-600 transition text-xs"
          />
        </div>

        <div>
          <select
            value={selectedObraFilter}
            onChange={(e) => setSelectedObraFilter(e.target.value)}
            className="text-slate-800 font-medium w-full px-3 py-2 border rounded-lg border-slate-200 focus:outline-none focus:border-blue-600 transition text-xs bg-white"
          >
            <option value="">Filtrar por obra (Todas)</option>
            {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* Listado de Personal */}
      {loading ? (
        <p className="text-sm text-slate-500 p-2">⏳ Cargando personal...</p>
      ) : filteredPersonal.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-8">No se encontraron trabajadores registrados.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Trabajador</th>
                  <th className="p-4">Cargo / Obra</th>
                  <th className="p-4 hidden sm:table-cell">RUT</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPersonal.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-slate-800">
                      {p.nombre}
                      <span className="block sm:hidden text-[10px] text-slate-400 font-normal mt-0.5">{p.rut || 'Sin RUT'}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-slate-700">{p.cargo}</span>
                      <span className="block text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{p.obra_nombre || 'Sin obra asignada'}</span>
                      </span>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-slate-600 font-medium">{p.rut || '-'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 hover:bg-blue-50 text-blue-900 rounded-lg transition cursor-pointer"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWorker(p)}
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Agregar / Editar Trabajador */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingWorker ? 'Editar Ficha Trabajador' : 'Contratar Nuevo Personal'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej. Juan Pérez González"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT (Opcional)</label>
                  <input
                    type="text"
                    value={formData.rut}
                    onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                    placeholder="12.345.678-9"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cargo</label>
                  <input
                    type="text"
                    required
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    placeholder="Ej. Ayudante, Maestro"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Obra / Proyecto</label>
                <select
                  required
                  value={formData.obra_nombre}
                  onChange={(e) => setFormData({ ...formData, obra_nombre: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white"
                >
                  {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={formData.inicio}
                    onChange={(e) => setFormData({ ...formData, inicio: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha de Término</label>
                  <input
                    type="date"
                    value={formData.termino}
                    onChange={(e) => setFormData({ ...formData, termino: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Asig. Colación ($)</label>
                  <input
                    type="number"
                    value={formData.colacion}
                    onChange={(e) => setFormData({ ...formData, colacion: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Asig. Movilización ($)</label>
                  <input
                    type="number"
                    value={formData.movilizacion}
                    onChange={(e) => setFormData({ ...formData, movilizacion: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5"
              >
                {modalLoading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Guardar Ficha</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Personal;
