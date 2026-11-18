import React from "react";
import { LogOut, PanelLeft, Plus } from "lucide-react";
import Brand from "./Brand";

const primaryPages = ["dashboard", "opportunities", "planning"];
const labels = { dashboard: "Accueil", opportunities: "Pipeline", planning: "Agenda" };

export function CrmSidebar({ pages, page, collapsed, onToggle, onNavigate, onCreate, pending, email, onLogout }) {
  function navigationItem([id, title, Icon], primary = false) {
    return (
      <button key={id} type="button" title={title} aria-label={title}
        aria-current={page === id ? "page" : undefined}
        className={page === id ? "active" : ""} onClick={() => onNavigate(id)}>
        <Icon size={primary ? 15 : 18} strokeWidth={1.75} aria-hidden="true" />
        <span className="crm-nav-label">{primary ? labels[id] : title}</span>
        {id === "tasks" && pending > 0 && <span className="count">{pending}</span>}
      </button>
    );
  }

  return (
    <aside className="crm-sidebar" aria-label="Navigation CRM">
      <div className="crm-sidebar-top">
        <Brand onClick={() => onNavigate("dashboard")} />
        <button type="button" className="crm-icon-button crm-sidebar-toggle"
          aria-label={collapsed ? "Déplier le panneau" : "Replier le panneau"}
          title={collapsed ? "Déplier le panneau" : "Replier le panneau"}
          aria-expanded={!collapsed} onClick={onToggle}>
          <PanelLeft size={18} strokeWidth={1.75} />
        </button>
      </div>
      <div className="crm-sidebar-scroll">
        <nav className="crm-primary-nav" aria-label="Raccourcis">
          {primaryPages.map(id => navigationItem(pages.find(item => item[0] === id), true))}
        </nav>
        <button type="button" className="crm-create" aria-label="Nouvelle entreprise" title="Nouvelle entreprise" onClick={onCreate}>
          <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
          <span className="crm-nav-label">Nouvelle entreprise</span>
        </button>
        <nav className="crm-secondary-nav" aria-label="Espaces">
          {pages.filter(([id]) => !primaryPages.includes(id)).map(item => navigationItem(item))}
        </nav>
      </div>
      <div className="crm-profile">
        <div className="avatar" aria-hidden="true">{(email || "Helix").slice(0, 2).toUpperCase()}</div>
        <div className="crm-profile-label">
          <strong title={email || "Espace local"}>{email || "Espace local"}</strong>
          <small>{email ? "Espace partagé" : "Données sur cet appareil"}</small>
        </div>
        {onLogout && <button type="button" className="crm-icon-button" aria-label="Déconnexion" title="Déconnexion" onClick={onLogout}><LogOut size={16} /></button>}
      </div>
    </aside>
  );
}
