import React, { useState } from 'react';
import {
  BarChart3, BriefcaseBusiness, Building2, ChevronRight, ClipboardList,
  FileText, HardHat, Menu, ShieldCheck, Users, Wrench, X
} from 'lucide-react';
import './CorporatePreview.css';

const navigation = ['Inicio', 'Soluciones', 'Proyectos', 'Control', 'Empresa'];

const projects = [
  { code: 'OB-024', name: 'Edificio Corporativo Norte', client: 'Inmobiliaria Andina', progress: 68, status: 'En ejecución', budget: '$ 4.820 MM' },
  { code: 'OB-019', name: 'Centro Logístico Quilicura', client: 'Transportes del Pacífico', progress: 91, status: 'Cierre técnico', budget: '$ 2.140 MM' },
  { code: 'OB-031', name: 'Mejoramiento Planta Industrial', client: 'Manufacturas Nacionales', progress: 34, status: 'En ejecución', budget: '$ 1.760 MM' },
  { code: 'OB-027', name: 'Condominio Parque Central', client: 'Desarrollos Urbanos', progress: 52, status: 'En ejecución', budget: '$ 6.350 MM' },
];

const solutions = [
  { icon: Building2, title: 'Dirección de proyectos', text: 'Portafolio consolidado, planificación, hitos y responsables en una única vista ejecutiva.' },
  { icon: ClipboardList, title: 'Presupuesto y costos', text: 'Control presupuestario, análisis de precios unitarios y desviaciones con trazabilidad.' },
  { icon: HardHat, title: 'Operación en terreno', text: 'Avance, asistencia, maquinaria, bodega y reportabilidad diaria desde cada obra.' },
  { icon: ShieldCheck, title: 'Cumplimiento', text: 'Prevención, calidad, acreditaciones y documentación contractual bajo control.' },
];

function CorporatePreview({ onEnterPlatform, onBackHome, variant = 'contemporary', onFormalPreview }) {
  const [section, setSection] = useState('Inicio');
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectSection = (item) => {
    setSection(item);
    setMobileOpen(false);
    document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`corp-site ${variant === 'formal' ? 'corp-formal' : 'corp-contemporary'}`}>
      <div className="corp-utility">
        <div className="corp-container corp-utility-inner">
          <span>Plataforma integral para empresas constructoras</span>
          <div><a href="mailto:contacto@obraxis.cl">contacto@obraxis.cl</a><span>Chile</span></div>
        </div>
      </div>

      <header className="corp-header">
        <div className="corp-container corp-header-inner">
          <button className="corp-brand" onClick={onBackHome} aria-label="Volver al sitio principal">
            <span className="corp-brand-mark">OX</span>
            <span className="corp-brand-copy"><strong>OBRAXIS</strong><small>GESTIÓN DE PROYECTOS</small></span>
          </button>
          <nav className="corp-nav" aria-label="Navegación principal">
            {navigation.map(item => <button key={item} className={section === item ? 'active' : ''} onClick={() => selectSection(item)}>{item}</button>)}
          </nav>
          <button className="corp-login" onClick={onEnterPlatform}>Acceso clientes <ChevronRight size={15} /></button>
          <button className="corp-menu" onClick={() => setMobileOpen(value => !value)} aria-label="Abrir menú">{mobileOpen ? <X /> : <Menu />}</button>
        </div>
        {mobileOpen && <nav className="corp-mobile-nav">{navigation.map(item => <button key={item} onClick={() => selectSection(item)}>{item}</button>)}<button onClick={onEnterPlatform}>Acceso clientes</button></nav>}
      </header>

      <main>
        <section id="inicio" className="corp-hero">
          <div className="corp-container corp-hero-grid">
            <div className="corp-hero-copy">
              <p className="corp-eyebrow">CONTROL CORPORATIVO DE OBRAS</p>
              <h1>Información confiable para dirigir proyectos con precisión.</h1>
              <p className="corp-lead">Obraxis conecta la planificación, los recursos y el control financiero de su empresa constructora en una plataforma clara, segura y auditable.</p>
              <div className="corp-actions">
                <button className="corp-primary" onClick={onEnterPlatform}>Ingresar a la plataforma</button>
                <button className="corp-secondary" onClick={() => selectSection('Soluciones')}>Conocer soluciones</button>
              </div>
              <dl className="corp-trust">
                <div><dt>12</dt><dd>módulos integrados</dd></div>
                <div><dt>100%</dt><dd>trazabilidad operativa</dd></div>
                <div><dt>24/7</dt><dd>información disponible</dd></div>
              </dl>
            </div>
            <div className="corp-report" aria-label="Resumen ejecutivo de proyectos">
              <div className="corp-report-head"><div><span>REPORTE EJECUTIVO</span><strong>Portafolio de proyectos</strong></div><span className="corp-period">AGOSTO 2026</span></div>
              <div className="corp-kpis">
                <div><small>Presupuesto vigente</small><strong>$ 15.070 MM</strong><span>4 proyectos activos</span></div>
                <div><small>Avance consolidado</small><strong>61,3%</strong><span className="positive">+2,8% período</span></div>
                <div><small>Costo comprometido</small><strong>58,7%</strong><span>Dentro de rango</span></div>
              </div>
              <div className="corp-report-title"><span>Estado de obras</span><span>Avance</span></div>
              {projects.slice(0, 3).map(project => <div className="corp-report-row" key={project.code}><div><strong>{project.name}</strong><small>{project.code} · {project.client}</small></div><div className="corp-progress"><span style={{ width: `${project.progress}%` }} /></div><b>{project.progress}%</b></div>)}
              <div className="corp-report-foot"><span>Actualizado hoy, 08:30</span><button onClick={() => selectSection('Proyectos')}>Ver informe completo</button></div>
            </div>
          </div>
        </section>

        <section id="soluciones" className="corp-section corp-solutions">
          <div className="corp-container">
            <div className="corp-section-head"><div><p className="corp-eyebrow">CAPACIDADES</p><h2>Una plataforma para toda la organización</h2></div><p>Desde la oficina central hasta el frente de trabajo, cada equipo opera con la misma información y criterios de control.</p></div>
            <div className="corp-solution-grid">{solutions.map(({ icon: Icon, title, text }, index) => <article key={title}><span className="corp-number">0{index + 1}</span><Icon /><h3>{title}</h3><p>{text}</p><button>Revisar capacidades <ChevronRight size={14} /></button></article>)}</div>
          </div>
        </section>

        <section id="proyectos" className="corp-section corp-projects">
          <div className="corp-container">
            <div className="corp-section-head"><div><p className="corp-eyebrow">VISTA OPERACIONAL</p><h2>Control ejecutivo de proyectos</h2></div><button className="corp-outline"><FileText size={16} /> Emitir informe</button></div>
            <div className="corp-table-wrap"><table className="corp-table"><thead><tr><th>Código</th><th>Proyecto / mandante</th><th>Estado</th><th>Avance</th><th>Presupuesto</th><th></th></tr></thead><tbody>{projects.map(project => <tr key={project.code}><td><b>{project.code}</b></td><td><strong>{project.name}</strong><small>{project.client}</small></td><td><span className={project.status.includes('Cierre') ? 'status closing' : 'status'}>{project.status}</span></td><td><div className="table-progress"><span><i style={{ width: `${project.progress}%` }} /></span><b>{project.progress}%</b></div></td><td>{project.budget}</td><td><button aria-label={`Abrir ${project.name}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div>
          </div>
        </section>

        <section id="control" className="corp-control">
          <div className="corp-container corp-control-grid">
            <div><p className="corp-eyebrow light">GESTIÓN BASADA EN EVIDENCIA</p><h2>Decisiones respaldadas por información de obra.</h2><p>Indicadores comparables, responsabilidades claras y antecedentes disponibles para cada revisión gerencial.</p></div>
            <div className="corp-control-list"><div><BarChart3 /><span><strong>Indicadores ejecutivos</strong><small>Avance, costo, plazo y productividad.</small></span></div><div><Users /><span><strong>Gobierno y permisos</strong><small>Acceso por empresa, rol, módulo y obra.</small></span></div><div><Wrench /><span><strong>Continuidad operacional</strong><small>Recursos, equipos y alertas bajo seguimiento.</small></span></div><div><BriefcaseBusiness /><span><strong>Trazabilidad contractual</strong><small>Documentos, aprobaciones y compromisos.</small></span></div></div>
          </div>
        </section>
      </main>

      <footer id="empresa" className="corp-footer"><div className="corp-container corp-footer-inner"><div className="corp-brand footer"><span className="corp-brand-mark">OX</span><span className="corp-brand-copy"><strong>OBRAXIS</strong><small>GESTIÓN DE PROYECTOS</small></span></div><p>Plataforma chilena para la gestión integral de empresas constructoras.</p><div><button onClick={onBackHome}>Sitio actual</button>{variant !== 'formal' && <button onClick={onFormalPreview}>Versión formal</button>}<button onClick={onEnterPlatform}>Acceso clientes</button></div></div><div className="corp-container corp-copyright"><span>© 2026 Obraxis SpA</span><span>{variant === 'formal' ? 'Propuesta corporativa formal' : 'Propuesta corporativa contemporánea'} · Minisitio de evaluación</span></div></footer>
    </div>
  );
}

export default CorporatePreview;
