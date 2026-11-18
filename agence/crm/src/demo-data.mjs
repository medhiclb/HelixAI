import { blank } from "./domain.mjs";

export function demoData(now = new Date()) {
  const at = hours => new Date(now.getTime() + hours * 3600000).toISOString();
  return {
    ...blank(),
    cabinets: [
      { id: "demo-company-1", name: "Atelier Sillage", city: "Lille", specialty: "Conseil" },
      { id: "demo-company-2", name: "Horizon Fabrique", city: "Lyon", specialty: "Industrie" },
      { id: "demo-company-3", name: "Bureau Noroît", city: "Nantes", specialty: "Services" },
    ],
    contacts: [
      { id: "demo-contact-1", cabinet_id: "demo-company-1", name: "Camille Laurent", role: "Direction", email: "camille@example.test" },
      { id: "demo-contact-2", cabinet_id: "demo-company-2", name: "Alex Martin", role: "Opérations", email: "alex@example.test" },
    ],
    opportunities: [
      { id: "demo-deal-1", cabinet_id: "demo-company-1", name: "Pilote HelixAI", stage: "Démo planifiée", amount: 12000 },
      { id: "demo-deal-2", cabinet_id: "demo-company-2", name: "Automatisation documentaire", stage: "Proposition", amount: 18500 },
      { id: "demo-deal-3", cabinet_id: "demo-company-3", name: "Audit IA et données", stage: "À qualifier", amount: 4800 },
    ],
    tasks: [
      { id: "demo-task-1", cabinet_id: "demo-company-1", name: "Confirmer les participants à la démo", due_at: at(24), priority: "Haute", done: false },
      { id: "demo-task-2", cabinet_id: "demo-company-2", name: "Relancer la proposition envoyée", due_at: at(72), priority: "Normale", done: false },
    ],
    meetings: [
      { id: "demo-meeting-1", cabinet_id: "demo-company-1", name: "Démo HelixAI", starts_at: at(48), ends_at: at(49), location: "Visioconférence", status: "Prévu" },
    ],
    notes: [
      { id: "demo-note-1", cabinet_id: "demo-company-1", name: "Débrief du premier échange", description: "Le prospect souhaite tester un pilote sur ses documents internes.", next_step: "Préparer le périmètre du pilote." },
    ],
  };
}
