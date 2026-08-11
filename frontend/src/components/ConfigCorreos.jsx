import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { sendSystemEmail } from '../utils/emailService';
import { formatRut } from '../utils/rutUtils';
import PermissionsGovernancePanel from './PermissionsGovernancePanel';
import NotificationMaster from './NotificationMaster';
import { PERMISSIONS_CATALOG, permissionKey } from '../utils/permissionsCatalog';
import { 
  Settings, ArrowLeft, Search, Plus, Edit, Trash2, Loader2, AlertCircle, Check, Mail, Filter, User, Lock, Building2, ShieldAlert, Copy, Archive, ArchiveRestore, ShieldCheck
} from 'lucide-react';

function ConfigCorreos({ user, onBack }) {
  const platformSessionUser = (() => {
    try { return JSON.parse(localStorage.getItem('obraxis_user') || 'null'); } catch { return null; }
  })();
  const platformRole = String(platformSessionUser?.rol_base || platformSessionUser?.rol || '').toLowerCase();
  const isObraxisGlobalAdmin = platformSessionUser?.empresa === 'Obraxis' && platformRole === 'superusuario';
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
  const [activeTab, setActiveTab] = useState('notificaciones');
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
    nombre: '',
    correo: '',
    cargo: '',
    contrasena: '',
    empresa: '',
    rol: 'Inspector',
    modulos: [],
    submenus: []
  });

  const [companyFormData, setCompanyFormData] = useState({
    empresa: '',
    razon_social: '',
    rut: '',
    giro: '',
    direccion: '',
    comuna: '',
    telefono: '',
    administrador: '',
    correo_administrador: '',
    logo_base64: '',
    color_primario: '#1e3a8a',
    color_secundario: '#1d4ed8',
    modulos_activos: [],
    submenus_activos: [],
    email_api_key: '',
    email_sender: 'notificaciones@obraxis.cl'
  });

  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchCompanyQuery, setSearchCompanyQuery] = useState('');
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [companyModalLoading, setCompanyModalLoading] = useState(false);
  const [testMailLoading, setTestMailLoading] = useState(false);

  // Estados para CRUD de Roles Personalizados
  const [rolesList, setRolesList] = useState([]);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleEditing, setRoleEditing] = useState(null);
  const [roleModalLoading, setRoleModalLoading] = useState(false);
  const [searchRoleQuery, setSearchRoleQuery] = useState('');
  const [roleToConfigure, setRoleToConfigure] = useState('');
  const [roleFormData, setRoleFormData] = useState({
    nombre: '',
    rol_base: 'Personalizado',
    descripcion: '',
    empresa: ''
  });

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
    fetchCompaniesForSelect();
  }, []);

  useEffect(() => {
    if (activeTab === 'branding') {
      fetchBranding();
    } else if (activeTab === 'notificaciones') {
      fetchRoles();
    } else if (activeTab === 'usuarios') {
      fetchUsers();
      fetchCompaniesForSelect();
      fetchRoles();
    } else if (activeTab === 'empresas') {
      fetchAllCompanies();
    } else if (activeTab === 'roles') {
      fetchRoles();
      fetchUsers();
      fetchCompaniesForSelect();
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
      let query = supabase.from('usuarios').select('*').eq('empresa', user.empresa);
      const { data, error } = await query.order('usuario', { ascending: true });
      if (error) throw error;
      setUsersList(data || []);
    } catch (err) {
      console.error('Error fetching users:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompaniesForSelect = async () => {
    if (!isObraxisGlobalAdmin) {
      setAllCompaniesList(user?.empresa ? [{ empresa: user.empresa }] : []);
      return;
    }
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

  const fetchRoles = async () => {
    try {
      let query = supabase.from('roles').select('*').eq('empresa', user.empresa);
      const { data, error } = await query.order('nombre', { ascending: true });
      if (error) throw error;
      setRolesList(data || []);
    } catch (err) {
      console.error('Error fetching roles:', err.message);
    }
  };

  const handleOpenAddRoleModal = () => {
    setRoleEditing(null);
    const defaultEmpresa = user?.empresa || 'Obraxis';
    setRoleFormData({
      nombre: '',
      rol_base: 'Personalizado',
      descripcion: '',
      empresa: defaultEmpresa
    });
    setSuccessMsg('');
    setErrorMsg('');
    setRoleModalOpen(true);
  };

  const handleOpenEditRoleModal = (role) => {
    setRoleEditing(role);
    setRoleFormData({
      nombre: role.nombre,
      rol_base: 'Personalizado',
      descripcion: role.descripcion || '',
      empresa: role.empresa
    });
    setSuccessMsg('');
    setErrorMsg('');
    setRoleModalOpen(true);
  };

  const handleSubmitRole = async (e) => {
    e.preventDefault();
    setRoleModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const dataToSave = {
      nombre: roleFormData.nombre.trim(),
      rol_base: 'Personalizado',
      descripcion: roleFormData.descripcion.trim(),
      empresa: roleFormData.empresa
    };

    try {
      if (roleEditing) {
        const { data, error } = await supabase
          .from('roles')
          .update(dataToSave)
          .eq('id', roleEditing.id)
          .eq('empresa', user.empresa)
          .select('id')
          .single();
        if (error) throw error;
        if (roleEditing.nombre !== dataToSave.nombre) {
          const { error: usersRoleError } = await supabase
            .from('usuarios')
            .update({ rol: dataToSave.nombre })
            .eq('empresa', roleEditing.empresa)
            .eq('rol', roleEditing.nombre);
          if (usersRoleError) throw usersRoleError;
        }
        setRoleToConfigure(String(data.id));
        setSuccessMsg('Rol actualizado correctamente.');
      } else {
        const { data, error } = await supabase
          .from('roles')
          .insert([{ ...dataToSave, modulos: '', submenus: '', permisos: {} }])
          .select('id')
          .single();
        if (error) throw error;
        setRoleToConfigure(String(data.id));
        setSuccessMsg('Rol creado correctamente.');
      }
      await fetchRoles();
      setRoleModalOpen(false);
      setActiveTab('permisos');
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar el rol.');
    } finally {
      setRoleModalLoading(false);
    }
  };

  const handleDeleteRole = async (role) => {
    const assignedUsers = usersList.filter(usr => usr.empresa === role.empresa && usr.rol === role.nombre).length;
    if (assignedUsers > 0) {
      alert(`No se puede eliminar este rol porque está asignado a ${assignedUsers} usuario${assignedUsers === 1 ? '' : 's'}. Puedes archivarlo.`);
      return;
    }
    if (!window.confirm(`¿Estás seguro de eliminar el rol "${role.nombre}"?`)) return;
    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', role.id)
        .eq('empresa', user.empresa);
      if (error) throw error;
      fetchRoles();
    } catch (err) {
      alert('Error al eliminar el rol: ' + err.message);
    }
  };

  const handleDuplicateRole = async (role) => {
    try {
      const copyBase = `${role.nombre} (copia`;
      const existingNames = new Set(rolesList.filter(item => item.empresa === role.empresa).map(item => item.nombre));
      let copyName = `${copyBase})`;
      let copyNumber = 2;
      while (existingNames.has(copyName)) copyName = `${copyBase} ${copyNumber++})`;
      const { data, error } = await supabase.from('roles').insert([{
        nombre: copyName,
        descripcion: role.descripcion || '',
        empresa: role.empresa,
        rol_base: 'Personalizado',
        modulos: '',
        submenus: '',
        permisos: role.permisos || {},
        archivado: false
      }]).select('id').single();
      if (error) throw error;
      setRoleToConfigure(String(data.id));
      await fetchRoles();
      setActiveTab('permisos');
    } catch (err) {
      alert('Error al duplicar el rol: ' + err.message);
    }
  };

  const handleToggleArchiveRole = async (role) => {
    try {
      const { error } = await supabase.from('roles').update({ archivado: !role.archivado }).eq('id', role.id).eq('empresa', user.empresa);
      if (error) throw error;
      await fetchRoles();
    } catch (err) {
      alert('Error al actualizar el rol: ' + err.message);
    }
  };


  const handleOpenAddUserModal = () => {
    setUserEditing(null);
    const defaultEmpresa = user?.empresa || 'Obraxis';
    setUserFormData({
      usuario: '',
      nombre: '',
      correo: '',
      cargo: '',
      contrasena: '',
      empresa: defaultEmpresa,
      rol: 'Inspector',
      modulos: [],
      submenus: []
    });
    setSuccessMsg('');
    setErrorMsg('');
    setUserModalOpen(true);
  };

  const handleOpenEditUserModal = (usr) => {
    setUserEditing(usr);
    setUserFormData({
      usuario: usr.usuario || '',
      nombre: usr.nombre || '',
      correo: usr.correo || '',
      cargo: usr.cargo || '',
      contrasena: usr.contrasena || '',
      empresa: usr.empresa || 'Obraxis',
      rol: usr.rol || 'Inspector',
      modulos: usr.modulos ? usr.modulos.split(',').map(m => m.trim()) : [],
      submenus: usr.submenus ? usr.submenus.split(',').map(s => s.trim()) : []
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

  const handleUserRoleChange = (e) => {
    const roleName = e.target.value;
    const selectedCustomRole = rolesList.find(r => r.nombre === roleName && r.empresa === userFormData.empresa);
    
    if (selectedCustomRole) {
      setUserFormData({
        ...userFormData,
        rol: roleName,
        modulos: selectedCustomRole.modulos ? selectedCustomRole.modulos.split(',').map(m => m.trim()) : [],
        submenus: selectedCustomRole.submenus ? selectedCustomRole.submenus.split(',').map(s => s.trim()) : []
      });
    } else {
      setUserFormData({
        ...userFormData,
        rol: roleName
      });
    }
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    setUserModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const selectedRole = rolesList.find(r => r.nombre === userFormData.rol);
    const rolBase = selectedRole ? 'Personalizado' : (userFormData.rol_base || 'Personalizado');

    const dataToSave = {
      usuario: userFormData.usuario.trim(),
      nombre: userFormData.nombre.trim(),
      correo: userFormData.correo.trim(),
      cargo: userFormData.cargo.trim(),
      empresa: userFormData.empresa,
      rol: userFormData.rol,
      rol_base: rolBase,
      modulos: userFormData.modulos.join(','),
      submenus: (userFormData.submenus || []).join(',')
    };
    if (!userEditing || userFormData.contrasena.trim()) dataToSave.contrasena = userFormData.contrasena.trim();

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
        setSuccessMsg('Usuario e identidad segura creados correctamente.');

        // Enviar correo de bienvenida si se registró un correo
        if (dataToSave.correo) {
          const welcomeHtml = `
            <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
              <h2 style="color: #1e3a8a; font-size: 20px; font-weight: 700; margin-bottom: 16px;">¡Bienvenido/a a Obraxis!</h2>
              <p style="font-size: 14px; line-height: 1.5;">Hola <strong>${dataToSave.nombre || dataToSave.usuario}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.5;">Tu cuenta de usuario ha sido creada de manera exitosa en nuestra plataforma de gestión de proyectos. A continuación, te compartimos tus credenciales de acceso:</p>
              
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 24px 0;">
                <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Credenciales de Acceso</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #475569; width: 120px;"><strong>🏢 Empresa:</strong></td>
                    <td style="padding: 6px 0; color: #1e293b;">${dataToSave.empresa}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #475569;"><strong>👤 Usuario:</strong></td>
                    <td style="padding: 6px 0; color: #1e293b; font-family: monospace; font-weight: bold;">${dataToSave.usuario}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #475569;"><strong>🔑 Contraseña:</strong></td>
                    <td style="padding: 6px 0; color: #1e293b; font-family: monospace; font-weight: bold;">${dataToSave.contrasena}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #475569;"><strong>💼 Cargo:</strong></td>
                    <td style="padding: 6px 0; color: #1e293b;">${dataToSave.cargo || 'No especificado'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #475569;"><strong>🛡️ Rol:</strong></td>
                    <td style="padding: 6px 0; color: #1e293b;">${dataToSave.rol}</td>
                  </tr>
                </table>
              </div>

              <p style="font-size: 14px; line-height: 1.5; margin-bottom: 24px;">Puedes iniciar sesión en cualquier momento ingresando a nuestro portal web:</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="https://obraxis.cl/login" style="background-color: #1e3a8a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Ingresar a la Plataforma</a>
              </div>

              <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">Este es un correo de notificación automático generado por la plataforma Obraxis. Por favor, no respondas a esta dirección.</p>
            </div>
          `;

          try {
            await sendSystemEmail({
              to: dataToSave.correo,
              subject: '🔐 Tus credenciales de acceso a Obraxis',
              htmlContent: welcomeHtml,
              customSender: 'usuarios@obraxis.cl'
            });
          } catch (mailErr) {
            console.error('Error al enviar correo de credenciales:', mailErr.message);
          }
        }
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
    if (!isObraxisGlobalAdmin) {
      setAllCompaniesList([]);
      setLoading(false);
      return;
    }
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
    if (!isObraxisGlobalAdmin) {
      alert('Solo Obraxis puede crear nuevas empresas.');
      return;
    }
    setCompanyEditing(null);
    setCompanyFormData({
      empresa: '',
      razon_social: '',
      rut: '',
      giro: '',
      direccion: '',
      comuna: '',
      telefono: '',
      administrador: '',
      correo_administrador: '',
      logo_base64: '',
      color_primario: '#1e3a8a',
      color_secundario: '#1d4ed8',
      modulos_activos: ['admin'],
      submenus_activos: []
    });
    setSuccessMsg('');
    setErrorMsg('');
    setCompanyModalOpen(true);
  };

  const handleOpenEditCompanyModal = (comp) => {
    if (!isObraxisGlobalAdmin) {
      alert('Solo Obraxis puede modificar empresas.');
      return;
    }
    setCompanyEditing(comp);
    setCompanyFormData({
      empresa: comp.empresa,
      razon_social: comp.razon_social || '',
      rut: comp.rut || '',
      giro: comp.giro || '',
      direccion: comp.direccion || '',
      comuna: comp.comuna || '',
      telefono: comp.telefono || '',
      administrador: comp.administrador || '',
      correo_administrador: comp.correo_administrador || '',
      logo_base64: comp.logo_base64 || '',
      color_primario: comp.color_primario || '#1e3a8a',
      color_secundario: comp.color_secundario || '#1d4ed8',
      modulos_activos: comp.modulos_activos ? comp.modulos_activos.split(',').map(m => m.trim()) : [],
      submenus_activos: comp.submenus_activos ? comp.submenus_activos.split(',').map(s => s.trim()) : [],
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
    if (!isObraxisGlobalAdmin) {
      setErrorMsg('Solo Obraxis puede crear o modificar empresas.');
      return;
    }
    setCompanyModalLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const contractedModules = (companyFormData.modulos_activos || []).filter(moduleId => moduleId !== 'admin');
    if (contractedModules.length === 0) {
      setCompanyModalLoading(false);
      setErrorMsg('Selecciona al menos un módulo contratado para la empresa.');
      return;
    }
    const activeModules = Array.from(new Set(['admin', ...contractedModules]));
    const validSubmenus = (companyFormData.submenus_activos || []).filter(submenuId => {
      const submenu = submenusDisponibles.find(item => item.id === submenuId);
      return submenu && activeModules.includes(submenu.modulo);
    });

    const dataToSave = {
      empresa: companyFormData.empresa.trim(),
      razon_social: companyFormData.razon_social ? companyFormData.razon_social.trim() : '',
      rut: companyFormData.rut ? companyFormData.rut.trim() : '',
      giro: companyFormData.giro ? companyFormData.giro.trim() : '',
      direccion: companyFormData.direccion ? companyFormData.direccion.trim() : '',
      comuna: companyFormData.comuna ? companyFormData.comuna.trim() : '',
      telefono: companyFormData.telefono ? companyFormData.telefono.trim() : '',
      administrador: companyFormData.administrador ? companyFormData.administrador.trim() : '',
      correo_administrador: companyFormData.correo_administrador ? companyFormData.correo_administrador.trim() : '',
      logo_base64: companyFormData.logo_base64,
      color_primario: companyFormData.color_primario,
      color_secundario: companyFormData.color_secundario,
      modulos_activos: activeModules.join(','),
      submenus_activos: validSubmenus.join(','),
      pais: 'Chile',
      zona_horaria: 'America/Santiago',
      moneda: 'CLP',
      configuracion_completa: true,
      updated_at: new Date().toISOString(),
      email_api_key: companyFormData.email_api_key ? companyFormData.email_api_key.trim() : null,
      email_sender: companyFormData.email_sender ? companyFormData.email_sender.trim() : 'notificaciones@obraxis.cl'
    };

    try {
      if (companyEditing) {
        const oldName = companyEditing.empresa;
        const newName = companyFormData.empresa.trim();

        const { error } = await supabase
          .from('config_empresa')
          .update(dataToSave)
          .eq('id', companyEditing.id);
        if (error) throw error;

        // Cascade rename company in other tables if renamed
        if (oldName !== newName) {
          await supabase.from('usuarios').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('roles').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('obras').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('maestro_personal').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('inventario_maquinaria').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('prevencion_formularios').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('prevencion_respuestas').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('prevencion_capacitaciones').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('prevencion_cumplimiento_asignaciones').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('prevencion_cumplimiento_registros').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('config_correos').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('facturacion_centros_gestion').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('facturacion_secciones').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('facturacion_proveedores').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('facturacion_recepciones').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('facturacion_config').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('facturacion_folios').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('facturacion_ordenes_compra').update({ empresa: newName }).eq('empresa', oldName);
          await supabase.from('facturacion_documentos').update({ empresa: newName }).eq('empresa', oldName);
        }
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

        const adminRoleName = 'Administrador de Empresa';
        const adminPermissions = Object.fromEntries(PERMISSIONS_CATALOG.flatMap(module => module.menus.flatMap(menu => menu.actions.map(action => [permissionKey(module.id, menu.id, action), true]))));
        const initialPassword = `Ox-${Array.from(crypto.getRandomValues(new Uint8Array(6)), value => (value % 36).toString(36)).join('').toUpperCase()}`;
        const emailPrefix = dataToSave.correo_administrador.split('@')[0] || 'administrador';
        const companySlug = dataToSave.empresa.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
        const baseUsername = `${emailPrefix.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase()}.${companySlug}`;
        let adminUsername = baseUsername;
        const { data: existingUsers } = await supabase.from('usuarios').select('usuario').ilike('usuario', `${baseUsername}%`);
        const usedNames = new Set((existingUsers || []).map(item => item.usuario));
        let suffix = 2;
        while (usedNames.has(adminUsername)) adminUsername = `${baseUsername}${suffix++}`;

        const { error: roleError } = await supabase.from('roles').insert([{
          nombre: adminRoleName,
          rol_base: 'Personalizado',
          descripcion: 'Administración general de la empresa y configuración inicial de permisos.',
          empresa: dataToSave.empresa,
          modulos: '',
          submenus: '',
          permisos: adminPermissions,
          archivado: false
        }]);
        if (roleError) {
          await supabase.from('config_empresa').delete().eq('empresa', dataToSave.empresa);
          throw roleError;
        }

        const { error: userError } = await supabase.from('usuarios').insert([{
          usuario: adminUsername,
          nombre: dataToSave.administrador,
          correo: dataToSave.correo_administrador,
          cargo: 'Administrador de Empresa',
          contrasena: initialPassword,
          empresa: dataToSave.empresa,
          rol: adminRoleName,
          rol_base: 'Personalizado',
          obras: 'todas',
          modulos: dataToSave.modulos_activos,
          submenus: dataToSave.submenus_activos,
          permisos: adminPermissions
        }]);
        if (userError) {
          await supabase.from('roles').delete().eq('empresa', dataToSave.empresa).eq('nombre', adminRoleName);
          await supabase.from('config_empresa').delete().eq('empresa', dataToSave.empresa);
          throw userError;
        }

        let credentialsMailSent = false;
        try {
          const mailResult = await sendSystemEmail({
            to: dataToSave.correo_administrador,
            subject: `Bienvenido a Obraxis · ${dataToSave.empresa}`,
            htmlContent: `<div style="max-width:650px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;font-family:Arial,sans-serif;color:#1e293b"><h2 style="color:#073b76">Tu empresa ya está habilitada en Obraxis</h2><p>Hola <strong>${dataToSave.administrador}</strong>,</p><p>Se creó la cuenta inicial de administración para <strong>${dataToSave.empresa}</strong>.</p><div style="background:#f8fafc;border-radius:12px;padding:18px;margin:20px 0"><p><strong>Usuario:</strong> ${adminUsername}</p><p><strong>Contraseña temporal:</strong> ${initialPassword}</p><p><strong>Rol:</strong> ${adminRoleName}</p></div><p style="text-align:center"><a href="https://www.obraxis.cl/login" style="display:inline-block;background:#073b76;color:#fff;padding:12px 22px;border-radius:9px;text-decoration:none;font-weight:bold">Ingresar a Obraxis</a></p><p style="font-size:12px;color:#64748b">Al ingresar podrás cambiar nombres, crear nuevos roles y configurar sus permisos sin acceder a información de otras empresas.</p></div>`
          });
          credentialsMailSent = Boolean(mailResult?.success);
          if (!credentialsMailSent) console.error('No fue posible enviar las credenciales:', mailResult?.error);
        } catch (mailError) {
          console.error('Empresa creada, pero no fue posible enviar las credenciales:', mailError);
        }

        setSuccessMsg(credentialsMailSent
          ? `Nueva empresa creada. Usuario inicial: ${adminUsername}. Se enviaron las credenciales a ${dataToSave.correo_administrador}.`
          : `Nueva empresa creada. Usuario: ${adminUsername} · Contraseña temporal: ${initialPassword}. No fue posible enviar el correo; guarda estas credenciales.`);
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
    if (!isObraxisGlobalAdmin) {
      alert('Solo Obraxis puede eliminar empresas.');
      return;
    }
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
  const moduleCatalog = [
    { id: 'admin', label: 'Administración', description: 'Usuarios, roles, permisos y configuración base.', base: true },
    { id: 'obras', label: 'Proyectos y Obras', description: 'Gestión diaria, planificación, costos y control de obras.' },
    { id: 'presupuestos', label: 'Presupuestos', description: 'APU, estimaciones, recursos y cronogramas.' },
    { id: 'rrhh', label: 'Recursos Humanos', description: 'Personal, contratos, asistencia y asignaciones.' },
    { id: 'maquinaria', label: 'Maquinaria y Equipos', description: 'Inventario, uso, mantenciones y disponibilidad.' },
    { id: 'bodega', label: 'Bodega e Inventario', description: 'Stock, movimientos y centros de gestión.' },
    { id: 'prevencion', label: 'Prevención de Riesgos', description: 'Registros, procedimientos, incidentes y matrices.' },
    { id: 'formularios_capacitaciones', label: 'Formularios y Capacitación', description: 'Formularios dinámicos, registros y cursos.' },
    { id: 'calidad', label: 'Calidad', description: 'PAC, RDI, recepciones y no conformidades.' },
    { id: 'acreditaciones', label: 'Acreditaciones', description: 'Empresas, personal, equipos y documentación.' },
    { id: 'clientes', label: 'Clientes', description: 'Contactos, oportunidades y relación comercial.' },
    { id: 'facturacion', label: 'Facturación Electrónica', description: 'Centros de gestión, DTE, compras y ventas.' },
    { id: 'gastos', label: 'Rendición de Gastos', description: 'Rendiciones, comprobantes y aprobaciones.' }
  ];
  const modulosDisponibles = moduleCatalog.map(item => item.id);
  const submenusDisponibles = [
    { id: 'prevencion_formularios', label: 'Prevención: Plantillas de Formularios', modulo: 'prevencion' },
    { id: 'prevencion_cumplimiento', label: 'Prevención: Matriz de Cumplimiento', modulo: 'prevencion' },
    { id: 'prevencion_capacitaciones', label: 'Prevención: Capacitaciones', modulo: 'prevencion' },
    { id: 'prevencion_estadisticas', label: 'Prevención: Estadísticas y Reportes', modulo: 'prevencion' },
    { id: 'presupuestos_items', label: 'Presupuestos: APU y Estimación', modulo: 'presupuestos' },
    { id: 'presupuestos_cronograma', label: 'Presupuestos: Cronograma Gantt', modulo: 'presupuestos' },
    { id: 'presupuestos_recursos', label: 'Presupuestos: Listado de Recursos', modulo: 'presupuestos' },
    { id: 'presupuestos_indirectos', label: 'Presupuestos: Costos Indirectos', modulo: 'presupuestos' },
    { id: 'facturacion_emitidos', label: 'Facturación: Historial DTE', modulo: 'facturacion' },
    { id: 'facturacion_clientes', label: 'Facturación: Directorio de Clientes', modulo: 'facturacion' },
    { id: 'facturacion_configuracion', label: 'Facturación: Ajustes de Factura', modulo: 'facturacion' },
    { id: 'facturacion_operacion_dte', label: 'Facturación: Operación DTE completa', modulo: 'facturacion' },
    { id: 'obras_produccion', label: 'Obras: Avance de Producción', modulo: 'obras' },
    { id: 'obras_asistencia', label: 'Obras: Asistencia Diaria', modulo: 'obras' },
    { id: 'obras_maquinaria', label: 'Obras: Reporte de Maquinaria', modulo: 'obras' },
    { id: 'obras_materiales', label: 'Obras: Ingreso/Uso de Materiales', modulo: 'obras' }
  ];

  const toggleCompanyModule = (moduleId) => {
    if (moduleId === 'admin') return;
    const currentModules = companyFormData.modulos_activos || [];
    const isActive = currentModules.includes(moduleId);
    const moduleSubmenus = submenusDisponibles.filter(item => item.modulo === moduleId).map(item => item.id);
    setCompanyFormData(current => ({
      ...current,
      modulos_activos: isActive
        ? currentModules.filter(item => item !== moduleId)
        : Array.from(new Set([...currentModules, moduleId, 'admin'])),
      submenus_activos: isActive
        ? (current.submenus_activos || []).filter(item => !moduleSubmenus.includes(item))
        : Array.from(new Set([...(current.submenus_activos || []), ...moduleSubmenus]))
    }));
  };

  const toggleCompanySubmenus = (moduleId, enabled) => {
    const ids = submenusDisponibles.filter(item => item.modulo === moduleId).map(item => item.id);
    setCompanyFormData(current => ({
      ...current,
      submenus_activos: enabled
        ? Array.from(new Set([...(current.submenus_activos || []), ...ids]))
        : (current.submenus_activos || []).filter(item => !ids.includes(item))
    }));
  };

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

        {activeTab === 'roles' && (
          <button
            onClick={handleOpenAddRoleModal}
            className="bg-primary hover:bg-primary-hover text-white font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Rol</span>
          </button>
        )}

        {activeTab === 'empresas' && isObraxisGlobalAdmin && (
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
          onClick={() => setActiveTab('notificaciones')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'notificaciones'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Master de Notificaciones
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
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'roles' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Roles
        </button>
        <button
          onClick={() => setActiveTab('permisos')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'permisos'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Permisos y Flujos
        </button>
        {isObraxisGlobalAdmin && (
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
        {isObraxisGlobalAdmin && (
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
      {activeTab === 'notificaciones' ? (
        <NotificationMaster user={user} obras={obras} roles={rolesList} />
      ) : activeTab === 'alertas' ? (
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
      ) : activeTab === 'permisos' ? (
        <PermissionsGovernancePanel user={user} initialRoleId={roleToConfigure} />
      ) : activeTab === 'roles' ? (
        /* PANEL DE ROLES PERSONALIZADOS */
        <>
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por nombre de rol o descripción..."
                value={searchRoleQuery}
                onChange={(e) => setSearchRoleQuery(e.target.value)}
                className="pl-9 text-slate-800 font-medium w-full px-3 py-2 border rounded-lg border-slate-200 focus:outline-none focus:border-primary transition text-xs"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rolesList.filter(role => 
                role.nombre.toLowerCase().includes(searchRoleQuery.toLowerCase()) ||
                (role.descripcion && role.descripcion.toLowerCase().includes(searchRoleQuery.toLowerCase()))
              ).map((role) => (
                <div key={role.id} className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition ${role.archivado ? 'border-amber-200 opacity-75' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-800">{role.nombre}</h3>
                        {role.archivado && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">Archivado</span>}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-wider">
                        Empresa: {role.empresa}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setRoleToConfigure(String(role.id)); setActiveTab('permisos'); }} className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition cursor-pointer" title="Configurar permisos">
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDuplicateRole(role)} className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition cursor-pointer" title="Duplicar">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEditRoleModal(role)}
                        className="p-1.5 hover:bg-slate-100 text-primary rounded-lg transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleToggleArchiveRole(role)} className="p-1.5 hover:bg-amber-50 text-amber-700 rounded-lg transition cursor-pointer" title={role.archivado ? 'Restaurar' : 'Archivar'}>
                        {role.archivado ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role)}
                        className="p-1.5 hover:bg-red-50 text-red-650 rounded-lg transition cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {role.descripcion && (
                    <p className="text-xs text-slate-500 line-clamp-2">{role.descripcion}</p>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Usuarios asignados</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">{usersList.filter(usr => usr.empresa === role.empresa && usr.rol === role.nombre).length}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : activeTab === 'empresas' && isObraxisGlobalAdmin ? (
        /* PANEL DE EMPRESAS (Solo superusuario Obraxis) */
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-5xl p-4 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[94vh] overflow-y-auto my-auto">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {userEditing ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}
              </h3>
              <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmitUser} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre Real</label>
                <input
                  type="text"
                  required
                  value={userFormData.nombre || ''}
                  onChange={(e) => setUserFormData({ ...userFormData, nombre: e.target.value })}
                  placeholder="ej: Juan Pérez"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={userFormData.correo || ''}
                    onChange={(e) => setUserFormData({ ...userFormData, correo: e.target.value })}
                    placeholder="ej: juan@empresa.cl"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cargo</label>
                  <input
                    type="text"
                    required
                    value={userFormData.cargo || ''}
                    onChange={(e) => setUserFormData({ ...userFormData, cargo: e.target.value })}
                    placeholder="ej: Supervisor de Obra"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Usuario de Login</label>
                  <input
                    type="text"
                    required
                    disabled={!!userEditing}
                    value={userFormData.usuario}
                    onChange={(e) => setUserFormData({ ...userFormData, usuario: e.target.value })}
                    placeholder="ej: jperez"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">{userEditing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}</label>
                  <input
                    type="text"
                    required={!userEditing}
                    value={userFormData.contrasena}
                    onChange={(e) => setUserFormData({ ...userFormData, contrasena: e.target.value })}
                    placeholder={userEditing ? 'Dejar vacío para conservarla' : 'Contraseña inicial'}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Empresa</label>
                {(user?.rol_base || user?.rol || 'Inspector').toLowerCase() === 'superusuario' ? (
                  <select
                    value={userFormData.empresa}
                    onChange={(e) => setUserFormData({ ...userFormData, empresa: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white cursor-pointer"
                  >
                    {allCompaniesList.map(c => <option key={c.empresa} value={c.empresa}>{c.empresa}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={userFormData.empresa}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-slate-100"
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Rol / Permisos</label>
                <select
                  value={userFormData.rol}
                  onChange={handleUserRoleChange}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white cursor-pointer"
                >
                  {rolesList.filter(r => r.empresa === userFormData.empresa && !r.archivado).length > 0 && (
                    <optgroup label="Roles de la empresa">
                      {rolesList.filter(r => r.empresa === userFormData.empresa && !r.archivado).map(r => (
                        <option key={r.id} value={r.nombre}>{r.nombre}</option>
                      ))}
                    </optgroup>
                  )}
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

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Submenús Permitidos</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 max-h-[160px] overflow-y-auto">
                  {submenusDisponibles.filter(s => {
                    if (!userFormData.modulos.includes(s.modulo)) return false;
                    if ((user?.rol_base || user?.rol || 'Inspector').toLowerCase() !== 'superusuario') {
                      const comp = allCompaniesList.find(c => c.empresa === userFormData.empresa);
                      if (comp && comp.submenus_activos) {
                        const compSubs = comp.submenus_activos.split(',').map(x => x.trim().toLowerCase());
                        return compSubs.includes(s.id);
                      }
                      return true;
                    }
                    return true;
                  }).map((s) => {
                    const isChecked = userFormData.submenus?.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-[10px] font-semibold text-slate-650 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked || false}
                          onChange={() => {
                            const activeSubs = [...(userFormData.submenus || [])];
                            if (activeSubs.includes(s.id)) {
                              setUserFormData({
                                ...userFormData,
                                submenus: activeSubs.filter(x => x !== s.id)
                              });
                            } else {
                              setUserFormData({
                                ...userFormData,
                                submenus: [...activeSubs, s.id]
                              });
                            }
                          }}
                          className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>{s.label}</span>
                      </label>
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-2 backdrop-blur-sm sm:p-5">
          <div className="my-auto w-full max-w-6xl overflow-y-auto rounded-3xl border border-slate-100 bg-white p-4 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[94vh] sm:p-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {companyEditing ? 'Editar Empresa' : 'Registrar Nueva Empresa'}
              </h3>
              <button onClick={() => setCompanyModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmitCompany} className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-black text-slate-900">Datos mínimos de la empresa</h4>
                <p className="mt-1 text-xs text-slate-500">Se utilizarán en documentos, correos y flujos corporativos.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre corto (uso Obraxis)</label>
                <input
                  type="text"
                  required
                  value={companyFormData.empresa}
                  onChange={(e) => setCompanyFormData({ ...companyFormData, empresa: e.target.value })}
                  placeholder="ej: OBRAXIS"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Razón Social</label>
                <input
                  type="text"
                  required
                  value={companyFormData.razon_social || ''}
                  onChange={(e) => setCompanyFormData({ ...companyFormData, razon_social: e.target.value })}
                  placeholder="ej: OBRAXIS S.A."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Giro</label><input type="text" required value={companyFormData.giro || ''} onChange={(e) => setCompanyFormData({ ...companyFormData, giro: e.target.value })} placeholder="Construcción de edificios" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary" /></div>
                <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Comuna</label><input type="text" required value={companyFormData.comuna || ''} onChange={(e) => setCompanyFormData({ ...companyFormData, comuna: e.target.value })} placeholder="Santiago" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary" /></div>
                <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Teléfono</label><input type="tel" required value={companyFormData.telefono || ''} onChange={(e) => setCompanyFormData({ ...companyFormData, telefono: e.target.value })} placeholder="+56 2 2345 6789" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary" /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">RUT</label>
                  <input
                    type="text"
                    required
                    value={companyFormData.rut || ''}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, rut: formatRut(e.target.value) })}
                    placeholder="ej: 76.123.456-7"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Dirección</label>
                  <input
                    type="text"
                    required
                    value={companyFormData.direccion || ''}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, direccion: e.target.value })}
                    placeholder="ej: Av. Vitacura 123"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Administrador Obraxis Empresa</label>
                  <input
                    type="text"
                    required
                    value={companyFormData.administrador || ''}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, administrador: e.target.value })}
                    placeholder="ej: Juan Pérez"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Correo Administrador</label>
                  <input
                    type="email"
                    required
                    value={companyFormData.correo_administrador || ''}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, correo_administrador: e.target.value })}
                    placeholder="ej: administrador@obraxis.cl"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>
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

              <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-black text-slate-900">Módulos contratados</h4><p className="mt-1 text-xs text-slate-500">Define las áreas que puede utilizar la empresa. Administración siempre está incluida.</p></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-blue-900">{(companyFormData.modulos_activos || []).filter(id => id !== 'admin').length} contratados</span></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {moduleCatalog.map((module) => {
                    const isChecked = module.base || companyFormData.modulos_activos?.includes(module.id);
                    return (
                      <button
                        type="button"
                        key={module.id}
                        disabled={module.base}
                        onClick={() => toggleCompanyModule(module.id)}
                        className={`rounded-xl border p-3 text-left transition ${module.base ? 'cursor-default' : 'cursor-pointer'} ${
                          isChecked 
                            ? 'bg-blue-950 text-white border-blue-950 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2"><span className="text-xs font-black">{module.label}</span><span className={`h-4 w-4 rounded-full border ${isChecked ? 'border-white bg-emerald-400' : 'border-slate-300 bg-white'}`}></span></span>
                        <span className={`mt-1 block text-[10px] leading-relaxed ${isChecked ? 'text-blue-100' : 'text-slate-400'}`}>{module.description}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4"><h4 className="text-sm font-black text-slate-900">Submódulos habilitados</h4><p className="mt-1 text-xs text-slate-500">Sólo se muestran opciones pertenecientes a módulos contratados.</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 max-h-[240px] overflow-y-auto">
                  {submenusDisponibles.filter(s => (companyFormData.modulos_activos || []).includes(s.modulo)).map((s) => {
                    const isChecked = companyFormData.submenus_activos?.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-[10px] font-semibold text-slate-650 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked || false}
                          onChange={() => {
                            const activeSubmenus = [...(companyFormData.submenus_activos || [])];
                            if (activeSubmenus.includes(s.id)) {
                              setCompanyFormData({
                                ...companyFormData,
                                submenus_activos: activeSubmenus.filter(x => x !== s.id)
                              });
                            } else {
                              setCompanyFormData({
                                ...companyFormData,
                                submenus_activos: [...activeSubmenus, s.id]
                              });
                            }
                          }}
                          className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>{s.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

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

      {/* Modal: Crear / Editar Rol */}
      {roleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                {roleEditing ? 'Editar Rol' : 'Registrar Nuevo Rol'}
              </h3>
              <button onClick={() => setRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
            </div>

            {successMsg && <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{successMsg}</div>}
            {errorMsg && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg text-xs font-semibold mb-3">{errorMsg}</div>}

            <form onSubmit={handleSubmitRole} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre del Rol</label>
                <input
                  type="text"
                  required
                  value={roleFormData.nombre}
                  onChange={(e) => setRoleFormData({ ...roleFormData, nombre: e.target.value })}
                  placeholder="ej: Prevencionista de Faena"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Descripción</label>
                <textarea
                  value={roleFormData.descripcion}
                  onChange={(e) => setRoleFormData({ ...roleFormData, descripcion: e.target.value })}
                  placeholder="ej: Supervisa la seguridad del personal en faena y gestiona EPP"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-primary h-16 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Empresa</label>
                {(user?.rol_base || user?.rol || 'Inspector').toLowerCase() === 'superusuario' ? (
                  <select value={roleFormData.empresa} onChange={(e) => setRoleFormData({ ...roleFormData, empresa: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none bg-white cursor-pointer">
                    {allCompaniesList.map(c => <option key={c.empresa} value={c.empresa}>{c.empresa}</option>)}
                  </select>
                ) : (
                  <input type="text" disabled value={roleFormData.empresa} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 bg-slate-100" />
                )}
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold leading-relaxed text-emerald-900">
                Este espacio solo define la identidad del rol. Al guardar, continuarás automáticamente en <strong>Permisos y Flujos</strong> para configurar lo que puede ver y hacer.
              </div>

              <button
                type="submit"
                disabled={roleModalLoading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 transition"
              >
                {roleModalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Guardar Rol</span>}
              </button>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}

export default ConfigCorreos;
