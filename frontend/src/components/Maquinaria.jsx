import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Truck, ArrowLeft, Search, Plus, Edit, Trash2, Loader2, AlertCircle, Check, Building2, Eye, Camera, Image 
} from 'lucide-react';

function Maquinaria({ user, onBack }) {
  const [maquinaria, setMaquinaria] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObraFilter, setSelectedObraFilter] = useState('');

  // Estados para modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingEquip, setEditingEquip] = useState(null);
  const [viewingEquip, setViewingEquip] = useState(null); // Para ver detalles y fotos ampliadas
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Formulario
  const [formData, setFormData] = useState({
    tipo: 'Retroexcavadora',
    patente: '',
    marca: '',
    obra_nombre: '',
    horometro_inicial: '0',
    tipo_activo: 'Propio',
    foto_frontal: '',
    foto_izquierda: '',
    foto_derecha: '',
    foto_posterior: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dataMaq, error: errMaq } = await supabase
        .from('inventario_maquinaria')
        .select('*')
        .order('tipo', { ascending: true });
      if (errMaq) throw errMaq;
      setMaquinaria(dataMaq || []);

      const { data: dataObras, error: errObras } = await supabase
        .from('obras')
        .select('nombre')
        .order('nombre', { ascending: true });
      if (errObras) throw errObras;
      setObras(dataObras || []);
    } catch (err) {
      console.error('Error cargando maquinaria/obras:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingEquip(null);
    setFormData({
      tipo: 'Retroexcavadora',
      patente: '',
      marca: '',
      obra_nombre: obras.length > 0 ? obras[0].nombre : '',
      horometro_inicial: '0',
      tipo_activo: 'Propio',
      foto_frontal: '',
      foto_izquierda: '',
      foto_derecha: '',
      foto_posterior: ''
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (equip) => {
    setEditingEquip(equip);
    setFormData({
      tipo: equip.tipo || 'Retroexcavadora',
      patente: equip.patente || '',
      marca: equip.marca || '',
      obra_nombre: equip.obra_nombre || '',
      horometro_inicial: equip.horometro_inicial ? equip.horometro_inicial.toString() : '0',
      tipo_activo: equip.tipo_activo || 'Propio',
      foto_frontal: equip.foto_frontal || '',
      foto_izquierda: equip.foto_izquierda || '',
      foto_derecha: equip.foto_derecha || '',
      foto_posterior: equip.foto_posterior || ''
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleDeleteEquip = async (equip) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el equipo ${equip.tipo} (${equip.patente})?`)) return;

    try {
      const { error } = await supabase.from('inventario_maquinaria').delete().eq('id', equip.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert(`Error al eliminar maquinaria: ${err.message}`);
    }
  };

  // Convertir archivo a base64
  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tamaño máximo (2MB para no saturar base64 en la base de datos)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen excede el límite de 2MB. Por favor, sube una foto comprimida o de menor resolución.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        [field]: reader.result // Cadena base64
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const dataToSave = {
      tipo: formData.tipo,
      patente: formData.patente.toUpperCase().trim(),
      marca: formData.marca.trim(),
      obra_nombre: formData.obra_nombre,
      horometro_inicial: parseFloat(formData.horometro_inicial) || 0,
      tipo_activo: formData.tipo_activo,
      foto_frontal: formData.foto_frontal || null,
      foto_izquierda: formData.foto_izquierda || null,
      foto_derecha: formData.foto_derecha || null,
      foto_posterior: formData.foto_posterior || null,
      registrado_por: user.usuario
    };

    try {
      if (editingEquip) {
        // Actualizar
        const { error } = await supabase
          .from('inventario_maquinaria')
          .update(dataToSave)
          .eq('id', editingEquip.id);
        if (error) throw error;
        setSuccessMsg('Ficha de equipo actualizada con éxito.');
      } else {
        // Validar patente duplicada
        if (dataToSave.patente) {
          const { data: existing } = await supabase
            .from('inventario_maquinaria')
            .select('id')
            .eq('patente', dataToSave.patente)
            .maybeSingle();

          if (existing) {
            throw new Error(`Ya existe un equipo registrado con la patente ${dataToSave.patente}`);
          }
        }

        const { error } = await supabase.from('inventario_maquinaria').insert([dataToSave]);
        if (error) throw error;
        setSuccessMsg('Equipo ingresado con éxito al inventario.');
      }

      fetchData();
      setTimeout(() => setModalOpen(false), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const filteredMaquinaria = maquinaria.filter(m => {
    const matchesSearch = 
      (m.tipo && m.tipo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.patente && m.patente.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.marca && m.marca.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesObra = 
      selectedObraFilter === '' || 
      (m.obra_nombre && m.obra_nombre.toLowerCase() === selectedObraFilter.toLowerCase());

    return matchesSearch && matchesObra;
  });

  const tiposMaquinaria = [
    'Retroexcavadora', 'Excavadora', 'Camión Tolva', 'Cargador Frontal', 
    'Rodillo Compactador', 'Minibuses / Camionetas', 'Generador / Torre Luz', 'Otro'
  ];

  return (
    <div className="space-y-4">
      
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-200 rounded-lg transition cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Gestión de Maquinaria</h2>
        </div>
        
        <button
          onClick={handleOpenAddModal}
          className="bg-blue-900 hover:bg-blue-800 text-white font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Ingresar Equipo</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Buscar por tipo, patente o marca..."
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

      {/* Listado */}
      {loading ? (
        <p className="text-sm text-slate-500 p-2">⏳ Cargando flota...</p>
      ) : filteredMaquinaria.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-8">No se encontraron maquinarias registradas.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMaquinaria.map((m) => (
            <div 
              key={m.id} 
              className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-slate-350 transition duration-200"
            >
              <div className="p-5 flex gap-4">
                {/* Miniatura Foto Frontal */}
                <div className="w-20 h-20 bg-slate-100 rounded-xl border border-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {m.foto_frontal ? (
                    <img src={m.foto_frontal} alt={m.tipo} className="w-full h-full object-cover" />
                  ) : (
                    <Truck className="w-8 h-8 text-slate-450" />
                  )}
                </div>
                
                {/* Datos */}
                <div className="space-y-1">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    m.tipo_activo === 'Propio' ? 'bg-emerald-50 text-emerald-700 border border-emerald-155' : 'bg-orange-50 text-orange-700 border border-orange-155'
                  }`}>
                    {m.tipo_activo || 'Propio'}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 leading-snug">{m.tipo}</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">{m.marca} | Patente: <span className="text-slate-700 font-bold">{m.patente || 'N/A'}</span></p>
                  
                  <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{m.obra_nombre || 'Sin obra asignada'}</span>
                  </p>
                </div>
              </div>

              {/* Pie de Tarjeta Acciones */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">Horómetro inicial: <span className="text-slate-800 font-bold">{m.horometro_inicial || 0} Hrs</span></span>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewingEquip(m)}
                    className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1 font-semibold text-[10px]"
                    title="Ver Fotos"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Fotos</span>
                  </button>
                  
                  <button
                    onClick={() => handleOpenEditModal(m)}
                    className="p-1.5 hover:bg-blue-50 text-blue-900 rounded-lg transition cursor-pointer"
                    title="Editar"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteEquip(m)}
                    className="p-1.5 hover:bg-red-50 text-red-650 rounded-lg transition cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Modal: Ingresar / Editar Maquinaria */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingEquip ? 'Editar Ficha Maquinaria' : 'Ingresar Nuevo Equipo'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Equipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 bg-white"
                  >
                    {tiposMaquinaria.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Activo</label>
                  <select
                    value={formData.tipo_activo}
                    onChange={(e) => setFormData({ ...formData, tipo_activo: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white"
                  >
                    <option value="Propio">Propio</option>
                    <option value="Arrendado">Arrendado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Marca / Modelo</label>
                  <input
                    type="text"
                    required
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    placeholder="Ej. CAT 320"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Patente / Identificador</label>
                  <input
                    type="text"
                    required
                    value={formData.patente}
                    onChange={(e) => setFormData({ ...formData, patente: e.target.value })}
                    placeholder="ABCD-12"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Obra Asignada</label>
                  <select
                    required
                    value={formData.obra_nombre}
                    onChange={(e) => setFormData({ ...formData, obra_nombre: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white"
                  >
                    {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Horómetro Inicial</label>
                  <input
                    type="number"
                    required
                    value={formData.horometro_inicial}
                    onChange={(e) => setFormData({ ...formData, horometro_inicial: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Registro de Fotos (Base64) */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1 tracking-wider">Control Fotográfico (Máx 2MB c/u)</label>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Foto Frontal */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-bold text-slate-400">Frontal</span>
                    <label className="flex flex-col items-center justify-center p-2.5 border border-dashed border-slate-200 hover:border-blue-500 rounded-lg cursor-pointer bg-slate-50 hover:bg-blue-50/20 transition">
                      <Camera className="w-4 h-4 text-slate-400 mb-0.5" />
                      <span className="text-[9px] text-slate-550 font-semibold">{formData.foto_frontal ? 'Cargada ✓' : 'Subir foto'}</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'foto_frontal')} className="hidden" />
                    </label>
                  </div>

                  {/* Foto Izquierda */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-bold text-slate-400">Izquierda</span>
                    <label className="flex flex-col items-center justify-center p-2.5 border border-dashed border-slate-200 hover:border-blue-500 rounded-lg cursor-pointer bg-slate-50 hover:bg-blue-50/20 transition">
                      <Camera className="w-4 h-4 text-slate-400 mb-0.5" />
                      <span className="text-[9px] text-slate-550 font-semibold">{formData.foto_izquierda ? 'Cargada ✓' : 'Subir foto'}</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'foto_izquierda')} className="hidden" />
                    </label>
                  </div>

                  {/* Foto Derecha */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-bold text-slate-400">Derecha</span>
                    <label className="flex flex-col items-center justify-center p-2.5 border border-dashed border-slate-200 hover:border-blue-500 rounded-lg cursor-pointer bg-slate-50 hover:bg-blue-50/20 transition">
                      <Camera className="w-4 h-4 text-slate-400 mb-0.5" />
                      <span className="text-[9px] text-slate-550 font-semibold">{formData.foto_derecha ? 'Cargada ✓' : 'Subir foto'}</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'foto_derecha')} className="hidden" />
                    </label>
                  </div>

                  {/* Foto Posterior */}
                  <div className="space-y-1">
                    <span className="block text-[9px] font-bold text-slate-400">Posterior</span>
                    <label className="flex flex-col items-center justify-center p-2.5 border border-dashed border-slate-200 hover:border-blue-500 rounded-lg cursor-pointer bg-slate-50 hover:bg-blue-50/20 transition">
                      <Camera className="w-4 h-4 text-slate-400 mb-0.5" />
                      <span className="text-[9px] text-slate-550 font-semibold">{formData.foto_posterior ? 'Cargada ✓' : 'Subir foto'}</span>
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'foto_posterior')} className="hidden" />
                    </label>
                  </div>
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
                  <span>Guardar Ficha Equipo</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ver fotos del Equipo */}
      {viewingEquip && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{viewingEquip.tipo} ({viewingEquip.patente})</h3>
                <p className="text-[10px] text-slate-400 font-semibold">{viewingEquip.marca}</p>
              </div>
              <button onClick={() => setViewingEquip(null)} className="text-slate-400 hover:text-slate-650 font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Foto Frontal */}
              <div className="space-y-1">
                <span className="block text-[10px] font-bold text-slate-400">Frontal</span>
                <div className="aspect-square bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                  {viewingEquip.foto_frontal ? (
                    <img src={viewingEquip.foto_frontal} alt="Frontal" className="w-full h-full object-cover cursor-zoom-in" onClick={() => window.open(viewingEquip.foto_frontal)} />
                  ) : (
                    <Image className="w-6 h-6 text-slate-300" />
                  )}
                </div>
              </div>

              {/* Foto Izquierda */}
              <div className="space-y-1">
                <span className="block text-[10px] font-bold text-slate-400">Izquierda</span>
                <div className="aspect-square bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                  {viewingEquip.foto_izquierda ? (
                    <img src={viewingEquip.foto_izquierda} alt="Izquierda" className="w-full h-full object-cover cursor-zoom-in" onClick={() => window.open(viewingEquip.foto_izquierda)} />
                  ) : (
                    <Image className="w-6 h-6 text-slate-300" />
                  )}
                </div>
              </div>

              {/* Foto Derecha */}
              <div className="space-y-1">
                <span className="block text-[10px] font-bold text-slate-400">Derecha</span>
                <div className="aspect-square bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                  {viewingEquip.foto_derecha ? (
                    <img src={viewingEquip.foto_derecha} alt="Derecha" className="w-full h-full object-cover cursor-zoom-in" onClick={() => window.open(viewingEquip.foto_derecha)} />
                  ) : (
                    <Image className="w-6 h-6 text-slate-300" />
                  )}
                </div>
              </div>

              {/* Foto Posterior */}
              <div className="space-y-1">
                <span className="block text-[10px] font-bold text-slate-400">Posterior</span>
                <div className="aspect-square bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                  {viewingEquip.foto_posterior ? (
                    <img src={viewingEquip.foto_posterior} alt="Posterior" className="w-full h-full object-cover cursor-zoom-in" onClick={() => window.open(viewingEquip.foto_posterior)} />
                  ) : (
                    <Image className="w-6 h-6 text-slate-300" />
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-[9px] text-slate-400 font-medium text-center mt-4">Haz clic sobre cualquier imagen cargada para verla en pantalla completa.</p>
          </div>
        </div>
      )}

    </div>
  );
}

export default Maquinaria;
