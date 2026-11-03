import { apiFetch } from "./endpoint";
import { branding } from "@/config/branding";
import { t, tf } from "@/lib/i18n";
import { plateformePoste } from "./plateforme";

/**
 * Dictée, côté interface.
 *
 * Deux moitiés, et une règle qui les tient ensemble : **le son ne va qu'à
 * l'instance**. Ce module capture le micro avec `MediaRecorder`, envoie
 * l'enregistrement à `POST /helix/dictee`, et rend le texte. La transcription
 * elle-même tourne dans l'instance, par Whisper, sans réseau.
 *
 * Ce qui est volontairement absent : la reconnaissance vocale intégrée au
 * navigateur. Dans Chromium, donc dans Electron, elle envoie le son aux
 * serveurs de Google. Elle ne doit jamais apparaître dans ce code, même en
 * solution de repli.
 */

export interface DiagnosticDictee {
  installee: boolean;
  paquetInstalle: boolean;
  modeleInstalle: boolean;
  modele: string;
  /** Pourquoi ce modèle convient à la machine qui transcrit. */
  raison: string;
  source: string;
  installable: boolean;
  obstacles: string[];
  telechargementMo: number;
  placeMo: number;
  dossier: string;
  installationEnCours: boolean;
}

export interface ProgresDictee {
  phase: "verification" | "python" | "modele" | "essai" | "termine";
  message: string;
  percent: number;
  detail?: string;
}

export interface BilanDictee {
  ok: boolean;
  duree: number;
  message: string;
  diagnostic: DiagnosticDictee;
}

export interface Transcription {
  texte: string;
  langue: string;
  modele: string;
  dureeAudio: number;
  dureeMs: number;
}

/** Durée maximale d'une dictée : au-delà, l'enregistrement s'arrête et part. */
export const DICTEE_MAX_SECONDES = 5 * 60;

/** État de la dictée sur l'instance. `null` si l'instance ne répond pas. */
export async function etat(): Promise<DiagnosticDictee | null> {
  try {
    const res = await apiFetch("/helix/dictee");
    if (!res.ok) return null;
    return (await res.json()) as DiagnosticDictee;
  } catch {
    return null;
  }
}

/**
 * Installe la dictée et suit sa progression.
 *
 * L'accord part explicitement dans le corps : l'instance refuse d'installer
 * sans lui. La réponse est un flux d'événements lu au fil de l'eau, comme pour
 * l'atelier (`EventSource` ne sait pas envoyer de POST).
 */
export async function installer(onProgres: (p: ProgresDictee) => void): Promise<BilanDictee> {
  const res = await apiFetch("/helix/dictee/installer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accord: true }),
  });

  if (!res.ok) {
    const corps = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(corps.error?.message ?? tf("L'installation a été refusée ({0}).", res.status));
  }
  if (!res.body) throw new Error(t("L'instance n'a envoyé aucun suivi d'installation."));

  const lecteur = res.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";
  let bilan: BilanDictee | null = null;
  let erreur: string | null = null;

  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });

    const evenements = tampon.split("\n\n");
    tampon = evenements.pop() ?? "";

    for (const evenement of evenements) {
      for (const ligne of evenement.split("\n")) {
        if (!ligne.startsWith("data:")) continue;
        try {
          const trame = JSON.parse(ligne.slice(5).trim()) as
            | ({ type: "progres" } & ProgresDictee)
            | { type: "bilan"; bilan: BilanDictee }
            | { type: "erreur"; message: string };
          if (trame.type === "progres") onProgres(trame);
          else if (trame.type === "bilan") bilan = trame.bilan;
          else erreur = trame.message;
        } catch {
          /* fragment illisible : la trame suivante fera foi */
        }
      }
    }
  }

  if (erreur) throw new Error(erreur);
  if (!bilan) throw new Error(t("L'installation s'est interrompue sans rendre de bilan."));
  return bilan;
}

/** Envoie un enregistrement à l'instance et rend le texte transcrit. */
export async function transcrire(son: Blob, langue = "fr", signal?: AbortSignal): Promise<Transcription> {
  let res: Response;
  try {
    res = await apiFetch(`/helix/dictee?langue=${encodeURIComponent(langue)}`, {
      signal,
      method: "POST",
      headers: { "Content-Type": son.type || "application/octet-stream" },
      body: son,
    });
  } catch {
    throw new Error(t("L'instance n'a pas répondu. Vérifiez qu'elle est démarrée."));
  }
  const corps = (await res.json().catch(() => ({}))) as Partial<Transcription> & {
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(corps.error?.message ?? tf("La transcription a échoué ({0}).", res.status));
  return corps as Transcription;
}

/** Le poste sait-il capturer le micro ? */
export function captureDisponible(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/**
 * Format d'enregistrement. Opus dans WebM est ce que Chromium produit
 * nativement ; les deux autres couvrent un navigateur qui ne le ferait pas.
 * L'instance n'accepte que ces conteneurs-là.
 */
function formatEnregistrement(): string | undefined {
  const candidats = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidats.find((f) => MediaRecorder.isTypeSupported(f));
}

/** Traduit un refus du navigateur en consigne compréhensible. */
export function messageErreurMicro(err: unknown): string {
  const nom = err instanceof DOMException ? err.name : "";
  if (nom === "NotAllowedError" || nom === "SecurityError") {
    // Le réglage n'est pas au même endroit selon le système.
    const p = plateformePoste();
    if (p === "win32") return tf("L'accès au micro est refusé. Autorisez les applications de bureau à utiliser le micro (Réglages de Windows, Confidentialité et sécurité, Microphone), puis relancez {0}.", branding.name);
    if (p === "linux") return t("L'accès au micro est refusé. Vérifiez qu'un micro est choisi et non coupé dans les réglages du son du système, puis réessayez.");
    return tf("L'accès au micro est refusé. Autorisez {0} dans Réglages Système, Confidentialité et sécurité, Micro, puis réessayez.", branding.name);
  }
  if (nom === "NotFoundError" || nom === "OverconstrainedError") {
    return t("Aucun micro n'a été détecté sur ce poste.");
  }
  if (nom === "NotReadableError") {
    return t("Le micro est occupé par une autre application.");
  }
  return err instanceof Error ? err.message : t("Le micro n'a pas pu être ouvert.");
}

/**
 * Un enregistrement en cours. `demarrer` ouvre le micro ; `arreter` le referme
 * et rend le son ; `abandonner` le referme sans rien rendre.
 *
 * Le micro est relâché dans tous les cas : un voyant d'enregistrement qui
 * reste allumé après la dictée, c'est exactement ce qui fait perdre confiance.
 */
export class Enregistreur {
  private flux: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private morceaux: Blob[] = [];

  async demarrer(observerFlux?: (flux: MediaStream) => void): Promise<void> {
    this.flux = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    try { observerFlux?.(this.flux); } catch (e) { this.relacher(); throw e; }
    const mimeType = formatEnregistrement();
    this.morceaux = [];
    this.recorder = new MediaRecorder(this.flux, {
      ...(mimeType ? { mimeType } : {}),
      // 32 kbit/s suffisent largement à la voix, et gardent cinq minutes sous 1,5 Mo.
      audioBitsPerSecond: 32_000,
    });
    this.recorder.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) this.morceaux.push(e.data);
    });
    this.recorder.start();
  }

  arreter(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      this.relacher();
      return Promise.reject(new Error(t("Aucun enregistrement en cours.")));
    }
    return new Promise((resoudre) => {
      recorder.addEventListener(
        "stop",
        () => {
          const son = new Blob(this.morceaux, { type: recorder.mimeType || "audio/webm" });
          this.relacher();
          resoudre(son);
        },
        { once: true },
      );
      recorder.stop();
    });
  }

  abandonner(): void {
    try {
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    } catch {
      /* déjà arrêté */
    }
    this.relacher();
  }

  private relacher(): void {
    this.flux?.getTracks().forEach((piste) => piste.stop());
    this.flux = null;
    this.recorder = null;
  }
}
