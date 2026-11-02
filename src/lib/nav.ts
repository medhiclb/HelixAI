import type { LucideIcon } from "lucide-react";
import {
  Sparkle,
  AppWindow,
  CodeXml,
  FolderKanban,
  Bot,
  FolderOpen,
  Calendar,
  Users,
  SquareCheckBig,
  Film,
} from "lucide-react";
import { features, type Features } from "@/config/branding";
import { t } from "@/lib/i18n";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  /** Module dont dépend cette entrée. Absent = toujours affichée. */
  feature?: keyof Features;
}

const PRIMARY: NavItem[] = [
  { label: t("Chat"), path: "/", icon: Sparkle },
  { label: t("Cowork"), path: "/cowork", icon: AppWindow, feature: "cowork" },
  { label: t("Code"), path: "/code", icon: CodeXml, feature: "code" },
];

const SECONDARY: NavItem[] = [
  { label: t("Studio vidéo"), path: "/videos", icon: Film },
  { label: t("Projets"), path: "/projets", icon: FolderKanban, feature: "projets" },
  { label: t("Agents"), path: "/agents", icon: Bot, feature: "agents" },
  /*
     « Fichiers » et non « Bibliothèque » : le mot décrit ce qu'on y trouve.
     « Bibliothèque » demandait de deviner — documents ? modèles ? Le chemin
     reste `/bibliotheque` : c'est une adresse que des postes ont pu mettre en
     favori, et la renommer casserait ce qui marche pour rien.
  */
  { label: t("Fichiers"), path: "/bibliotheque", icon: FolderOpen, feature: "bibliotheque" },
  { label: t("Réunions"), path: "/reunions", icon: Calendar, feature: "reunions" },
  { label: t("Groupes"), path: "/groupes", icon: Users, feature: "groupes" },
  { label: t("Tâches"), path: "/taches", icon: SquareCheckBig, feature: "taches" },
];

const enabled = (item: NavItem) => !item.feature || features[item.feature];

/** Bloc de navigation principal (carte encadrée) : les modes actifs. */
export const primaryNav: NavItem[] = PRIMARY.filter(enabled);

/** Liste de navigation secondaire filtrée par l'édition. */
export const secondaryNav: NavItem[] = SECONDARY.filter(enabled);
