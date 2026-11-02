import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Film, Mic, Search, Grid2X2, Calendar, FolderOpen, GraduationCap } from "lucide-react";
import { features } from "@/config/branding";
import { Input } from "@/components/ui/Field";
import { t } from "@/lib/i18n";

/** Chaque service ouvre son propre atelier ; pas de carte annonçant un outil inexistant. */
export function ServicesPage(){
 const [recherche,setRecherche]=useState('');
 const services=[
  {id:'video',titre:t("Studio vidéo"),description:t("De l'idée au montage : scènes, images, clips, titres et bande sonore."),categorie:t("Création"),chemin:'/videos',icone:Film},
  {id:'cours',titre:t("Prof particulier"),description:t("Vos cours, un prof à votre rythme et des exercices corrigés pour progresser."),categorie:t("Apprentissage"),chemin:'/services/cours',icone:GraduationCap},
  {id:'entretien',titre:t("Simulations d'entretien"),description:t("Préparez votre poste, entraînez vos réponses à l'oral et recevez un bilan personnalisé."),categorie:t("Entraînement"),chemin:'/services/entretiens',icone:Mic},
  ...(features.reunions?[{id:'reunions',titre:t("Réunions"),description:t("Retrouvez les enregistrements, transcriptions et comptes rendus de votre équipe."),categorie:t("Travail"),chemin:'/reunions',icone:Calendar}]:[]),
  ...(features.bibliotheque?[{id:'documents',titre:t("Fichiers"),description:t("Rassemblez vos documents et retrouvez les informations utiles à vos projets."),categorie:t("Travail"),chemin:'/bibliotheque',icone:FolderOpen}]:[]),
 ];
 return <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-6xl space-y-8 p-5 pb-12 sm:p-8 lg:p-10"><header className="space-y-4"><div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Grid2X2 size={18} aria-hidden="true"/>{t("Services")}</div><h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">{t("Un espace pour chaque projet.")}</h1><p className="max-w-2xl text-muted-foreground">{t("Choisissez votre outil, puis retrouvez vos créations et vos sessions dans son espace dédié.")}</p></header>
 <div className="relative max-w-md"><Search size={18} aria-hidden="true" className="pointer-events-none absolute start-3 top-3 text-muted-foreground"/><Input className="ps-10" aria-label={t("Rechercher un service")} placeholder={t("Rechercher un service")} value={recherche} onChange={e=>setRecherche(e.target.value)}/></div>
 <div className="grid gap-5 md:grid-cols-2">{services.filter(s=>(s.titre+' '+s.description+' '+s.categorie).toLocaleLowerCase().includes(recherche.toLocaleLowerCase())).map(s=><Link key={s.id} to={s.chemin} className="group flex min-h-60 flex-col rounded-3xl border border-border bg-card p-6 transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="mb-6 flex items-center justify-between"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent"><s.icone size={27} strokeWidth={1.5} aria-hidden="true"/></span><span className="text-xs font-medium text-muted-foreground">{s.categorie}</span></div><h2 className="text-xl font-semibold">{s.titre}</h2><p className="mb-6 mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{s.description}</p><span className="mt-auto inline-flex items-center gap-2 text-sm font-medium">{t("Ouvrir")}<ArrowUpRight size={17} aria-hidden="true"/></span></Link>)}</div>
 </div></div>;
}
