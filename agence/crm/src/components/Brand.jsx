import React from "react";
import { branding } from "../branding.mjs";

export function LogoMark() {
  return <span className="helix-mark" aria-hidden="true"><img src={branding.mark} alt="" draggable="false"/></span>;
}

export default function Brand({ onClick }) {
  return <button type="button" className="wordmark" aria-label={branding.name} onClick={onClick}>
    <LogoMark/><span className="brand-name">{branding.name}</span>
  </button>;
}
