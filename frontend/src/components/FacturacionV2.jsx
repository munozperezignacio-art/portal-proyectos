import React, { useEffect, useState } from 'react';
import { FileCode2, LayoutDashboard, WalletCards } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ModuleHeader from './ModuleHeader';
import FacturacionElectronica from './FacturacionElectronica';
import OperacionDTE from './OperacionDTE';

export default function FacturacionV2({ user, companyBranding, onBack }) {
  const [workspace, setWorkspace] = useState('integrada');
  const [sessionReady, setSessionReady] = useState(false);
  const role = String(user?.rol_base || user?.rol || '').toLowerCase();
  const isPlatformAdmin = role.includes('superusuario') || role.includes('superadmin') || (user?.empresa === 'Obraxis' && role.includes('admin'));
  const enabledSubmenus = String(companyBranding?.submenus_activos || user?.submenus || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  const dteEnabled = isPlatformAdmin || enabledSubmenus.length === 0 || enabledSubmenus.includes('facturacion_operacion_dte');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        localStorage.removeItem('obraxis_user');
        localStorage.removeItem('obraxis_user_login_time');
        window.history.replaceState({}, '', '/login');
        window.location.reload();
        return;
      }
      setSessionReady(true);
    });
  }, []);

  if (!sessionReady) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">Validando sesión segura…</div>;

  return <div className="space-y-5">
    <ModuleHeader title="Facturación Electrónica" subtitle="Gestión financiera por centros y operación tributaria DTE con trazabilidad completa." Icon={WalletCards} onBack={onBack} />
    <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => setWorkspace('integrada')} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${workspace === 'integrada' ? 'border-blue-950 bg-blue-950 text-white shadow-md' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'}`}><LayoutDashboard className="mt-0.5 h-5 w-5 shrink-0"/><span><b className="block text-sm">Gestión financiera integrada</b><small className={`mt-1 block ${workspace === 'integrada' ? 'text-blue-100' : 'text-slate-500'}`}>Centros de gestión, gastos reales, obras y Estados de Pago.</small></span></button>
        {dteEnabled ? <button type="button" onClick={() => setWorkspace('dte')} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${workspace === 'dte' ? 'border-emerald-800 bg-emerald-800 text-white shadow-md' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'}`}><FileCode2 className="mt-0.5 h-5 w-5 shrink-0"/><span><b className="block text-sm">Operación DTE</b><small className={`mt-1 block ${workspace === 'dte' ? 'text-emerald-100' : 'text-slate-500'}`}>Emisión, recepción, aceptación o reclamo, folios, RCV y configuración tributaria.</small></span></button> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500"><b className="block text-slate-700">Operación DTE no contratada</b>Puede habilitarse desde Panel de control → empresa → módulos y submódulos.</div>}
      </div>
    </section>
    {workspace === 'dte' && dteEnabled ? <OperacionDTE user={user} /> : <FacturacionElectronica user={user} onBack={onBack} embedded />}
  </div>;
}
