import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { sendSystemEmail } from '../utils/emailService';
import { 
  Settings, ArrowLeft, Search, Plus, Edit, Trash2, Loader2, AlertCircle, Check, Mail, Filter, User, Lock, Building2, ShieldAlert
} from 'lucide-react';

function ConfigCorreos({ user, onBack }) {
  const [configs, setConfigs] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para modal de alertas
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Formulario de alertas
  const [formData, setFormData] = useState({
    tipo: 'Produccion Diaria',
    correos: '',
    filtro: ''
  });

  // NUEVO: Estados de Branding
  const [logoBase64, setLogoBase64] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1e3a8a');
  const [secondaryColor, setSecondaryColor] = useState('#1d4ed8');
  const [activeTab, setActiveTab] = useState('alertas');
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState('');
  const [brandingError, setBrandingError] = useState('');

  // NUEVO: Estados de Gestión de Usuarios y Empresas
  const [usersList, setUsersList] = useState([]);
  const [allCompaniesList, setAllCompaniesList] = useState([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userEditing, setUserEditing] = useState(null);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyEditing, setCompanyEditing] = useState(null);
  
  const [userFormData, setUserFormData] = useState({
    usuario: '',
    contrasena: '',
    empresa: '',
    rol: 'Inspector',
    modulos: []
  });

  const [companyFormData, setCompanyFormData] = useState({
    empresa: '',
    logo_base64: '',
    color_primario: '#1e3a8a',
    color_secundario: '#1d4ed8',
    modulos_activos: [],
    email_api_key: '',
    email_sender: 'notificaciones@obraxis.cl'
  });

  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchCompanyQuery, setSearchCompanyQuery] = useState('');
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [companyModalLoading, setCompanyModalLoading] = useState(false);
  const [testMailLoading, setTestMailLoading] = useState(false);

  // Estados de Configuración de la Plataforma Global (Obraxis)
  const [platApiKey, setPlatApiKey] = useState('');
  const [platSender, setPlatSender] = useState('notificaciones@obraxis.cl');
  const [platGeminiKey, setPlatGeminiKey] = useState('');
  const [platGeminiModel, setPlatGeminiModel] = useState('gemini-3.5-flash');
  const [platSuccess, setPlatSuccess] = useState('');
  const [platError, setPlatError] = useState('');
  const [platLoading, setPlatLoading] = useState(false);
  const [platTestMailLoading, setPlatTestMailLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'branding') {
      fetchBranding();
    } else if (activeTab === 'usuarios') {
      fetchUsers();
      fetchCompaniesForSelect();
    } else if (activeTab === 'empresas') {
      fetchAllCompanies();
    } else if (activeTab === 'plataforma') {
      fetchPlatformSettings();
    }
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dataConfigs, error: errConfigs } = await supabase
        .from('config_correos')
        .select('*')
        .order('tipo', { ascending: true });
      if (errConfigs) throw errConfigs;
      setConfigs(dataConfigs || []);

      const { data: dataObras, error: errObras } = await supabase
        .from('obras')
        .select('nombre')
        .order('nombre', { ascending: true });
      if (errObras) throw errObras;
      setObras(dataObras || []);
    } catch (err) {
      console.error('Error cargando configuraciones/obras:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar branding de nuestra propia empresa
  const fetchBranding = async () => {
    setBrandingLoading(true);
    setBrandingSuccess('');
    setBrandingError('');
    try {
      const { data, error } = await supabase
        .from('config_empresa')
        .select('*')
        .eq('empresa', user.empresa)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLogoBase64(data.logo_base64 || '');
        setPrimaryColor(data.color_primario || '#1e3a8a');
        setSecondaryColor(data.color_secundario || '#1d4ed8');
      }
    } catch (err) {
      console.error('Error fetching branding:', err.message);
      setBrandingError('Error al cargar la personalización corporativa.');
    } finally {
      setBrandingLoading(false);
    }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    setBrandingLoading(true);
    setBrandingSuccess('');
    setBrandingError('');

    try {
      const { error } = await supabase
        .from('config_empresa')
        .upsert([
          {
            empresa: user.empresa,
            logo_base64: logoBase64,
            color_primario: primaryColor,
            color_secundario: secondaryColor
          }
        ], { onConflict: 'empresa' });

      if (error) throw error;

      document.documentElement.style.setProperty('--primary-color', primaryColor);
      document.documentElement.style.setProperty('--primary-color-hover', secondaryColor);

      setBrandingSuccess('¡Personalización guardada! Los colores se han aplicado en tiempo real.');
      setTimeout(() => {
        setBrandingSuccess('');
      }, 4000);
    } catch (err) {
      console.error('Error saving branding:', err.message);
      setBrandingError(`Error al guardar: ${err.message}`);
    } finally {
      setBrandingLoading(false);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("El logotipo no debe superar los 2MB de tamaño.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // --- CRUD DE USUARIOS ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('usuario', { ascending: true });
      if (error) throw error;
      setUsersList(data || []);
    } catch (err) {
      console.error('Error fetching users:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompaniesForSelect = async () => {
    try {
      const { data, error } = await supabase
        .from('config_empresa')
        .select('empresa')
        .order('empresa', { ascending: true });
      if (error) throw error;
      setAllCompaniesList(data || []);
    } catch (err) {
      console.error('Error fetching companies list:', err.message);
    }
  };

  const handleOpenAddUserModal = () => {
    setUserEditing(null);
    setUserFormData({
      usuario: '',
      contrasena: '',
      empresa: allCompaniesList[0]?.empresa || 'Obraxis',
      rol: 'Inspector',
      modulos: []
    });
    setSuccessMsg('');
    setErrorMsg('');
    setUserModalOpen(true);
  };

  const handleOpenEditUserModal = (usr) => {
    setUserEditing(usr);
    setUserFormData({
      usuario: usr.usuario,
      contrasena: usr.contrasena,
      empresa: usr.empresa || 'Obraxis',
      rol: usr.rol || 'Inspector',
      modulos: usr.modulos ? usr.modulos.split(',').map(m => m.trim()) : []
    });
    setSuccessMsg('');
    setErrorMsg('');
    setUserModalOpen(true);
  };

  const handleToggleModule = (mod) => {
    const mods = [...userFormData.modulos];
    const idx = mods.indexOf(mod);
    if (idx === -1) {
      mods.push(mod);
    } else {
      mods.splice(idx, 1);
    }
    setUserFormData({ ...userFormData, modulos: mods });
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    setUserModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const dataToSave = {
      usuario: userFormData.usuario.trim(),
      contrasena: userFormData.contrasena.trim(),
      empresa: userFormData.empresa,
      rol: userFormData.rol,
      modulos: userFormData.modulos.join(',')
    };

    try {
      if (userEditing) {
        const { error } = await supabase
          .from('usuarios')
          .update(dataToSave)
          .eq('id', userEditing.id);
        if (error) throw error;
        setSuccessMsg('Usuario actualizado con éxito.');
      } else {
        const { error } = await supabase
          .from('usuarios')
          .insert([dataToSave]);
        if (error) throw error;
        setSuccessMsg('Usuario creado correctamente.');
      }

      fetchUsers();
      setTimeout(() => setUserModalOpen(false), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUserModalLoading(false);
    }
  };

  const handleDeleteUser = async (usr) => {
    if (usr.usuario === user.usuario) {
      alert("No puedes eliminar tu propio usuario actual.");
      return;
    }
    if (!window.confirm(`¿Estás seguro de que deseas eliminar al usuario ${usr.usuario}?`)) return;

    try {
      const { error } = await supabase.from('usuarios').delete().eq('id', usr.id);
      if (error) throw error;
      fetchUsers();
    } catch (err) {
      alert(`Error al eliminar usuario: ${err.message}`);
    }
  };

  // --- CRUD DE EMPRESAS ---
  const fetchAllCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('config_empresa')
        .select('*')
        .order('empresa', { ascending: true });
      if (error) throw error;
      setAllCompaniesList(data || []);
    } catch (err) {
      console.error('Error fetching all companies:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddCompanyModal = () => {
    setCompanyEditing(null);
    setCompanyFormData({
      empresa: '',
      logo_base64: '',
      color_primario: '#1e3a8a',
      color_secundario: '#1d4ed8',
      modulos_activos: []
    });
    setSuccessMsg('');
    setErrorMsg('');
    setCompanyModalOpen(true);
  };

  const handleOpenEditCompanyModal = (comp) => {
    setCompanyEditing(comp);
    setCompanyFormData({
      empresa: comp.empresa,
      logo_base64: comp.logo_base64 || '',
      color_primario: comp.color_primario || '#1e3a8a',
      color_secundario: comp.color_secundario || '#1d4ed8',
      modulos_activos: comp.modulos_activos ? comp.modulos_activos.split(',').map(m => m.trim()) : [],
      email_api_key: comp.email_api_key || '',
      email_sender: comp.email_sender || 'notificaciones@obraxis.cl'
    });
    setSuccessMsg('');
    setErrorMsg('');
    setCompanyModalOpen(true);
  };

  const handleCompanyLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("El logotipo no debe superar los 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCompanyFormData({ ...companyFormData, logo_base64: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitCompany = async (e) => {
    e.preventDefault();
    setCompanyModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const dataToSave = {
      empresa: companyFormData.empresa.trim(),
      logo_base64: companyFormData.logo_base64,
      color_primario: companyFormData.color_primario,
      color_secundario: companyFormData.color_secundario,
      modulos_activos: (companyFormData.modulos_activos || []).join(','),
      email_api_key: companyFormData.email_api_key ? companyFormData.email_api_key.trim() : null,
      email_sender: companyFormData.email_sender ? companyFormData.email_sender.trim() : 'notificaciones@obraxis.cl'
    };

    try {
      if (companyEditing) {
        const { error } = await supabase
          .from('config_empresa')
          .update(dataToSave)
          .eq('id', companyEditing.id);
        if (error) throw error;
        setSuccessMsg('Empresa actualizada con éxito.');
        
        if (companyEditing.empresa === user.empresa) {
          document.documentElement.style.setProperty('--primary-color', companyFormData.color_primario);
          document.documentElement.style.setProperty('--primary-color-hover', companyFormData.color_secundario);
        }
      } else {
        const { error } = await supabase
          .from('config_empresa')
          .insert([dataToSave]);
        if (error) throw error;
        setSuccessMsg('Nueva empresa registrada con éxito.');
      }

      fetchAllCompanies();
      setTimeout(() => setCompanyModalOpen(false), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCompanyModalLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!companyFormData.email_api_key) {
      alert("Por favor ingrese la API Key de Resend primero.");
      return;
    }
    setTestMailLoading(true);
    try {
      const testHtml = `
        <div style="font-family: sans-serif; padding: 25px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; rounded: 12px; background-color: #ffffff;">
          <h2 style="color: #2563eb; margin-top: 0;">🧪 Prueba de Conexión de Correo</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">Este correo confirma que la configuración de la API de Resend para el dominio <b>obraxis.cl</b> funciona correctamente.</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 12px; color: #475569;"><b>Remitente:</b> ${companyFormData.email_sender}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #475569;"><b>Estado:</b> Conexión exitosa ✅</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0;">Enviado por Obraxis - Portal de Proyectos</p>
        </div>
      `;
      const recipient = user.correo || 'notificaciones@obraxis.cl';
      const res = await sendSystemEmail({
        to: recipient,
        subject: '🧪 Prueba de Envío de Correo - Obraxis',
        htmlContent: testHtml
      });

      if (res.success) {
        alert(`¡Correo de prueba enviado con éxito a ${recipient}!`);
      } else {
        alert(`Error al enviar: ${res.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setTestMailLoading(false);
    }
  };

  const handleDeleteCompany = async (comp) => {
    if (comp.empresa === 'Obraxis') {
      alert("No se puede eliminar la empresa principal Obraxis.");
      return;
    }
    if (comp.empresa === user.empresa) {
      alert("No puedes eliminar la empresa a la que perteneces actualmente.");
      return;
    }
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la empresa ${comp.empresa}? Se borrarán sus datos visuales.`)) return;

    try {
      const { error } = await supabase.from('config_empresa').delete().eq('id', comp.id);
      if (error) throw error;
      fetchAllCompanies();
    } catch (err) {
      alert(`Error al eliminar empresa: ${err.message}`);
    }
  };

  const fetchPlatformSettings = async () => {
    setPlatLoading(true);
    setPlatSuccess('');
    setPlatError('');
    try {
      const { data, error } = await supabase
        .from('config_empresa')
        .select('*')
        .eq('empresa', 'Obraxis')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPlatApiKey(data.email_api_key || '');
        setPlatSender(data.email_sender || 'notificaciones@obraxis.cl');
        setPlatGeminiKey(data.gemini_api_key || '');
        setPlatGeminiModel(data.gemini_model || 'gemini-3.5-flash');
      }
    } catch (err) {
      setPlatError(err.message);
    } finally {
      setPlatLoading(false);
    }
  };

  const handleSavePlatformSettings = async (e) => {
    e.preventDefault();
    setPlatLoading(true);
    setPlatSuccess('');
    setPlatError('');
    try {
      const { error } = await supabase
        .from('config_empresa')
        .update({
          email_api_key: platApiKey ? platApiKey.trim() : null,
          email_sender: platSender ? platSender.trim() : 'notificaciones@obraxis.cl',
          gemini_api_key: platGeminiKey ? platGeminiKey.trim() : null,
          gemini_model: platGeminiModel ? platGeminiModel.trim() : 'gemini-3.5-flash'
        })
        .eq('empresa', 'Obraxis');

      if (error) throw error;
      setPlatSuccess('Configuración global de Obraxis actualizada correctamente.');
    } catch (err) {
      setPlatError(err.message);
    } finally {
      setPlatLoading(false);
    }
  };

  const handleSendPlatformTestEmail = async () => {
    const keyToUse = platApiKey.trim();
    const senderToUse = platSender.trim();
    if (!keyToUse) {
      alert("Por favor ingrese la API Key de Resend primero.");
      return;
    }
    setPlatTestMailLoading(true);
    try {
      const testHtml = `
        <div style="font-family: sans-serif; padding: 25px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #2563eb; margin-top: 0;">🧪 Prueba de Conexión de Correo Global</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">Este correo confirma que la configuración de la API de Resend para el dominio global <b>obraxis.cl</b> funciona correctamente.</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 12px; color: #475569;"><b>Remitente Global:</b> ${senderToUse}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #475569;"><b>Estado:</b> Conexión exitosa ✅</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0;">Enviado por Obraxis - Portal de Proyectos</p>
        </div>
      `;
      const recipient = user.correo || 'notificaciones@obraxis.cl';
      const res = await sendSystemEmail({
        to: recipient,
        subject: '🧪 Prueba de Envío de Correo Global - Obraxis',
        htmlContent: testHtml
      });

      if (res.success) {
        alert(`¡Correo de prueba enviado con éxito a ${recipient}!`);
      } else {
        alert(`Error al enviar: ${res.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setPlatTestMailLoading(false);
    }
  };

  // --- CRUD DE ALERTAS (EXISTENTE) ---
  const handleOpenAddModal = () => {
    setEditingConfig(null);
    setFormData({
      tipo: 'Produccion Diaria',
      correos: '',
      filtro: ''
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (cfg) => {
    setEditingConfig(cfg);
    setFormData({
      tipo: cfg.tipo || 'Produccion Diaria',
      correos: cfg.correos || '',
      filtro: cfg.filtro || ''
    });
    setSuccessMsg('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleDeleteConfig = async (cfg) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la alerta para ${cfg.tipo}?`)) return;

    try {
      const { error } = await supabase.from('config_correos').delete().eq('id', cfg.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const emails = formData.correos.split(',').map(email => email.trim());
    const invalidEmail = emails.find(email => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return !re.test(email);
    });

    if (invalidEmail) {
      setErrorMsg(`El correo "${invalidEmail}" no tiene un formato válido.`);
      setModalLoading(false);
      return;
    }

    const dataToSave = {
      tipo: formData.tipo,
      correos: emails.join(', '),
      filtro: formData.filtro || null
    };

    try {
      if (editingConfig) {
        const { error } = await supabase
          .from('config_correos')
          .update(dataToSave)
          .eq('id', editingConfig.id);
        if (error) throw error;
        setSuccessMsg('Alerta guardada con éxito.');
      } else {
        const { error } = await supabase.from('config_correos').insert([dataToSave]);
        if (error) throw error;
        setSuccessMsg('Nueva alerta de reporte configurada correctamente.');
      }

      fetchData();
      setTimeout(() => setModalOpen(false), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const filteredConfigs = configs.filter(c => {
    return (
      (c.tipo && c.tipo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.correos && c.correos.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.filtro && c.filtro.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const filteredUsers = usersList.filter(u => {
    return (
      (u.usuario && u.usuario.toLowerCase().includes(searchUserQuery.toLowerCase())) ||
      (u.empresa && u.empresa.toLowerCase().includes(searchUserQuery.toLowerCase())) ||
      (u.rol && u.rol.toLowerCase().includes(searchUserQuery.toLowerCase()))
    );
  });

  const filteredCompanies = allCompaniesList.filter(c => {
    return c.empresa && c.empresa.toLowerCase().includes(searchCompanyQuery.toLowerCase());
  });

  const tiposReporte = ['Produccion Diaria', 'Uso Maquinaria', 'Asistencia Personal', 'Prevencion y Seguridad'];
  const modulosDisponibles = ['obras', 'rrhh', 'maquinaria', 'prevencion', 'acreditaciones', 'calidad', 'bodega', 'presupuestos', 'clientes', 'facturacion', 'gastos', 'admin'];

  return (
    <div className="space-y-4">
      
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-200 rounded-lg transition cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Panel de Configuración General</h2>
        </div>
        
        {activeTab === 'alertas' && (
          <button
            onClick={handleOpenAddModal}
            className="bg-primary hover:bg-primary-hover text-white font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Configurar Alerta</span>
          </button>
        )}

        {activeTab === 'usuarios' && (
          <button
            onClick={handleOpenAddUserModal}
            className="bg-primary hover:bg-primary-hover text-white font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Usuario</span>
          </button>
        )}

        {activeTab === 'empresas' && user.rol.toLowerCase() === 'superusuario' && (
          <button
            onClick={handleOpenAddCompanyModal}
            className="bg-primary hover:bg-primary-hover text-white font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Empresa</span>
          </button>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200 gap-2 mb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('alertas')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'alertas' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Alertas de Correo
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'branding' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Marca Corporativa
        </button>
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'usuarios' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Gestión de Usuarios
        </button>
        {user.rol.toLowerCase() === 'superusuario' && (
          <button
            onClick={() => setActiveTab('empresas')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'empresas' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Gestión de Empresas
          </button>
        )}
        {user.empresa === 'Obraxis' && user.rol.toLowerCase() === 'superusuario' && (
          <button
            onClick={() => setActiveTab('plataforma')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'plataforma' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ⚙️ Ajustes Globales Obraxis
          </button>
        )}
      </div>

      {/* RENDER SECCIONES */}
      {activeTab === 'alertas' ? (
        <>
          {/* Buscador de alertas */}
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por tipo de reporte o correo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-slate-800 font-medium w-full px-3 py-2 border rounded-lg border-slate-200 focus:outline-none focus:border-primary transition text-xs"
              />
            </div>
          </div>

          {/* Listado de alertas */}
          {loading ? (
            <p className="text-sm text-slate-500 p-2">⏳ Cargando alertas...</p>
          ) : filteredConfigs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No se encontraron alertas.</p>
          ) : (
            <div className="space-y-4">
              {filteredConfigs.map((cfg) => (
                <div 
                  key={cfg.id} 
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-300 transition duration-200"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-primary" />
                        <span>{cfg.tipo}</span>
                      </h3>
                      {cfg.filtro && (
                        <span className="text-[9px] font-bold bg-blue-50 text-primary border border-blue-150 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          <Filter className="w-2.5 h-2.5" />
                          <span>Proyecto: {cfg.filtro}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(cfg)}
                        className="p-1.5 hover:bg-slate-100 text-primary rounded-lg transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(cfg)}
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 font-medium text-slate-600 border-t border-slate-100 pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Destinatarios</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {cfg.correos.split(',').map((email, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[10px]">
                          {email.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : activeTab === 'branding' ? (
        /* Branding editor de mi empresa */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-lg space-y-6">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Personalización Visual de la Empresa</h3>
            <p className="text-xs text-slate-500 mt-1">Define el logo corporativo y la paleta de colores para tu portal ({user.empresa}) en vivo.</p>
          </div>

          {brandingSuccess && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-xs font-semibold">{brandingSuccess}</div>}
          {brandingError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-semibold">{brandingError}</div>}

          {brandingLoading && !logoBase64 ? (
            <p className="text-xs text-slate-500">⏳ Cargando configuraciones...</p>
          ) : (
            <form onSubmit={handleSaveBranding} className="space-y-5">
              
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2">Logotipo de la Empresa (Máx 2MB)</label>
                <div className="flex items-center gap-4">
                  {logoBase64 ? (
                    <div className="border border-slate-200 p-2 rounded-xl bg-slate-50 flex items-center justify-center h-20 w-36 overflow-hidden">
                      <img src={logoBase64} className="max-h-full max-w-full object-contain" alt="Preview Logo" />
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-300 rounded-xl flex items-center justify-center h-20 w-36 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase p-2 text-center">
                      Sin Logo
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      id="logo-upload"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs cursor-pointer transition border border-slate-250"
                    >
                      Subir Imagen
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Color Principal</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#1e3a8a"
                      className="border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 w-full uppercase focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Color Hover</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#1d4ed8"
                      className="border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 w-full uppercase focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={brandingLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-lg text-xs shadow-sm transition disabled:opacity-75"
              >
                Guardar Personalización
              </button>
            </form>
          )}
        </div>
      ) : activeTab === 'usuarios' ? (
        /* PANEL DE USUARIOS */
        <>
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por usuario, empresa, rol..."
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                className="pl-9 text-slate-800 font-medium w-full px-3 py-2 border rounded-lg border-slate-200 focus:outline-none focus:border-primary transition text-xs"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 p-2">⏳ Cargando usuarios...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No se encontraron usuarios.</p>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((usr) => (
                <div 
                  key={usr.id} 
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-300 transition duration-200"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-primary" />
                        <span>{usr.usuario}</span>
                      </h3>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full inline-flex items-center">
                          Rol: {usr.rol}
                        </span>
                        <span className="text-[9px] font-bold bg-blue-50 text-primary border border-blue-100 px-2 py-0.5 rounded-full inline-flex items-center">
                          Empresa: {usr.empresa || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleOpenEditUserModal(usr)}
                        className="p-1.5 hover:bg-slate-100 text-primary rounded-lg transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(usr)}
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 font-medium text-slate-600 border-t border-slate-100 pt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Módulos Asignados</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {usr.modulos ? (
                        usr.modulos.split(',').map((m, idx) => (
                          <span key={idx} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[9px] font-bold capitalize">
                            {m.trim()}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">Sin módulos asignados</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : activeTab === 'empresas' ? (
        /* PANEL DE EMPRESAS (Solo superusuario) */
        <>
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por nombre de empresa..."
                value={searchCompanyQuery}
                onChange={(e) => setSearchCompanyQuery(e.target.value)}
                className="pl-9 text-slate-800 font-medium w-full px-3 py-2 border rounded-lg border-slate-200 focus:outline-none focus:border-primary transition text-xs"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500 p-2">⏳ Cargando empresas...</p>
          ) : filteredCompanies.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No se encontraron empresas.</p>
          ) : (
            <div className="space-y-4">
              {filteredCompanies.map((comp) => (
                <div 
                  key={comp.id} 
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition duration-200"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {comp.logo_base64 ? (
                        <img src={comp.logo_base64} className="h-10 max-w-[120px] object-contain border border-slate-100 p-1 rounded" alt="Logo" />
                      ) : (
                        <div className="h-10 w-16 bg-slate-100 flex items-center justify-center rounded text-[10px] text-slate-400 font-bold uppercase">No Logo</div>
                      )}
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{comp.empresa}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-block w-3.5 h-3.5 rounded border border-slate-200" style={{ backgroundColor: comp.color_primario }} title="Color principal" />
                          <span className="inline-block w-3.5 h-3.5 rounded border border-slate-200" style={{ backgroundColor: comp.color_secundario }} title="Color Hover" />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleOpenEditCompanyModal(comp)}
                        className="p-1.5 hover:bg-slate-100 text-primary rounded-lg transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(comp)}
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* PANEL DE PLATAFORMA GLOBAL (Ajustes Obraxis) */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-lg space-y-6">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Ajustes Globales de la Plataforma (Obraxis)</h3>
            <p className="text-xs text-slate-500 mt-1">Configura las credenciales generales de correo (Resend) y el motor de inteligencia artificial (Gemini) para toda la plataforma.</p>
          </div>

          {platSuccess && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-xs font-semibold">{platSuccess}</div>}
          {platError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-semibold">{platError}</div>}

          {platLoading && !platApiKey ? (
            <p className="text-xs text-slate-500">⏳ Cargando configuraciones globales...</p>
          ) : (
            <form onSubmit={handleSavePlatformSettings} className="space-y-6">
              
              {/* Sección Resend */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-xs text-primary border-b border-slate-100 pb-1 uppercase tracking-wide">Servicio de Correos (Resend API)</h4>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Resend API Key</label>
                  <input
                    type="password"
                    value={platApiKey}
                    onChange={(e) => setPlatApiKey(e.target.value)}
                    placeholder="re_xxxxxxxxxxxxxxxx"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo Remitente Autorizado</label>
                  <input
                    type="email"
                    value={platSender}
                    onChange={(e) => setPlatSender(e.target.value)}
                    placeholder="notificaciones@obraxis.cl"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendPlatformTestEmail}
                  disabled={platTestMailLoading}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-lg text-xs transition disabled:opacity-70 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {platTestMailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Enviar Correo de Prueba</span>}
                </button>
              </div>

              {/* Sección Gemini AI */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-xs text-primary border-b border-slate-100 pb-1 uppercase tracking-wide">Motor de Inteligencia Artificial (Gemini AI)</h4>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Gemini API Key</label>
                  <input
                    type="password"
                    value={platGeminiKey}
                    onChange={(e) => setPlatGeminiKey(e.target.value)}
                    placeholder="AIzaSyxxxxxxxxxxxx"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Modelo de IA Activo</label>
                  <input
                    type="text"
                    value={platGeminiModel}
                    onChange={(e) => setPlatGeminiModel(e.target.value)}
                    placeholder="gemini-3.5-flash"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={platLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-lg text-xs shadow-sm transition disabled:opacity-75"
              >
                Guardar Ajustes Globales
              </button>
            </form>
          )}
        </div>
      )}

      {/* Modal: Crear / Editar Alerta */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingConfig ? 'Editar Alerta' : 'Configurar Nueva Alerta'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Reporte</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white cursor-pointer"
                >
                  {tiposReporte.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Destinatarios (Separados por coma)</label>
                <textarea
                  required
                  rows={3}
                  value={formData.correos}
                  onChange={(e) => setFormData({ ...formData, correos: e.target.value })}
                  placeholder="ejemplo1@obraxis.cl, ejemplo2@obraxis.cl"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Filtro de Obra (Opcional)</label>
                <select
                  value={formData.filtro}
                  onChange={(e) => setFormData({ ...formData, filtro: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="">Aplicar a todas las obras</option>
                  {obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                </select>
              </div>

              <button
                type="submit"
                disabled={modalLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 transition"
              >
                {modalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Guardar Configuración</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Usuario */}
      {userModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {userEditing ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}
              </h3>
              <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmitUser} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre de Usuario</label>
                <input
                  type="text"
                  required
                  disabled={!!userEditing}
                  value={userFormData.usuario}
                  onChange={(e) => setUserFormData({ ...userFormData, usuario: e.target.value })}
                  placeholder="ej: juan.perez"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Contraseña</label>
                <input
                  type="text"
                  required
                  value={userFormData.contrasena}
                  onChange={(e) => setUserFormData({ ...userFormData, contrasena: e.target.value })}
                  placeholder="Contraseña"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Empresa</label>
                <select
                  value={userFormData.empresa}
                  onChange={(e) => setUserFormData({ ...userFormData, empresa: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white cursor-pointer"
                >
                  {allCompaniesList.map(c => <option key={c.empresa} value={c.empresa}>{c.empresa}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Rol</label>
                <select
                  value={userFormData.rol}
                  onChange={(e) => setUserFormData({ ...userFormData, rol: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="Inspector">Inspector</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Superusuario">Superusuario</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Módulos Permitidos</label>
                <div className="flex flex-wrap gap-2">
                  {modulosDisponibles.filter(m => {
                    if (userFormData.rol === 'Superusuario') return true;
                    const comp = allCompaniesList.find(c => c.empresa === userFormData.empresa);
                    if (comp && comp.modulos_activos) {
                      const compMods = comp.modulos_activos.split(',').map(x => x.trim().toLowerCase());
                      return m === 'admin' || compMods.includes(m);
                    }
                    return true;
                  }).map((m) => {
                    const isChecked = userFormData.modulos.includes(m);
                    return (
                      <button
                        type="button"
                        key={m}
                        onClick={() => handleToggleModule(m)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition border ${
                          isChecked 
                            ? 'bg-primary text-white border-primary' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={userModalLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 transition"
              >
                {userModalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Guardar Usuario</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Empresa */}
      {companyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {companyEditing ? 'Editar Empresa' : 'Registrar Nueva Empresa'}
              </h3>
              <button onClick={() => setCompanyModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmitCompany} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre de la Empresa</label>
                <input
                  type="text"
                  required
                  disabled={!!companyEditing}
                  value={companyFormData.empresa}
                  onChange={(e) => setCompanyFormData({ ...companyFormData, empresa: e.target.value })}
                  placeholder="ej: Constructora Alfa"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2">Logotipo</label>
                <div className="flex items-center gap-4">
                  {companyFormData.logo_base64 ? (
                    <div className="border border-slate-200 p-2 rounded-xl bg-slate-50 flex items-center justify-center h-16 w-28 overflow-hidden">
                      <img src={companyFormData.logo_base64} className="max-h-full max-w-full object-contain" alt="Preview Logo" />
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-350 rounded-xl flex items-center justify-center h-16 w-28 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase p-2 text-center">Sin Logo</div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      id="comp-logo-upload"
                      onChange={handleCompanyLogoChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="comp-logo-upload"
                      className="inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer transition border border-slate-250"
                    >
                      Subir Logo
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Color Principal</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={companyFormData.color_primario}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, color_primario: e.target.value })}
                      className="w-8 h-8 border border-slate-200 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={companyFormData.color_primario}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, color_primario: e.target.value })}
                      className="border border-slate-200 rounded p-1 text-[10px] text-slate-800 w-full uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Color Hover</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={companyFormData.color_secundario}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, color_secundario: e.target.value })}
                      className="w-8 h-8 border border-slate-200 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={companyFormData.color_secundario}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, color_secundario: e.target.value })}
                      className="border border-slate-200 rounded p-1 text-[10px] text-slate-800 w-full uppercase"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Módulos Habilitados para la Empresa</label>
                <div className="flex flex-wrap gap-1.5">
                  {modulosDisponibles.filter(m => m !== 'admin').map((m) => {
                    const isChecked = companyFormData.modulos_activos?.includes(m);
                    return (
                      <button
                        type="button"
                        key={m}
                        onClick={() => {
                          const activeMods = [...(companyFormData.modulos_activos || [])];
                          if (activeMods.includes(m)) {
                            setCompanyFormData({
                              ...companyFormData,
                              modulos_activos: activeMods.filter(x => x !== m)
                            });
                          } else {
                            setCompanyFormData({
                              ...companyFormData,
                              modulos_activos: [...activeMods, m]
                            });
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold capitalize transition border cursor-pointer ${
                          isChecked 
                            ? 'bg-primary text-white border-primary' 
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {companyFormData.empresa === 'Obraxis' && (
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h4 className="font-bold text-slate-800 text-xs">Configuración de Correo (Resend API)</h4>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Resend API Key</label>
                    <input
                      type="password"
                      value={companyFormData.email_api_key || ''}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, email_api_key: e.target.value })}
                      placeholder="re_xxxxxxxx"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo Remitente Autorizado</label>
                    <input
                      type="email"
                      value={companyFormData.email_sender || ''}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, email_sender: e.target.value })}
                      placeholder="notificaciones@obraxis.cl"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testMailLoading}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-lg text-xs transition disabled:opacity-70 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {testMailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Enviar Correo de Prueba</span>}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={companyModalLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 transition"
              >
                {companyModalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Guardar Empresa</span>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ConfigCorreos;
