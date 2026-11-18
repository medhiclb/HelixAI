import React from "react";

export function CrmPageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="crm-page-heading">
      <div className="crm-page-title">
        <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
