import { backendLocalSur } from "./optimisationLocale.ts";
import { redirectionPour, refusSortie } from "./sortieReseau.ts";
import { models, resolve } from "./router.ts";
import { backendById, loadModel } from "./backends.ts";
import * as usage from "./usage.ts";
import { moteurDeLaMachine, type ModelInfo } from "./types.ts";
import { appliquerCorrection, correctionPour, depasseLeContexte, messageDuFournisseur } from "./modelesCloud.ts";
import { t, tf } from "./langue.ts";

/**
 * Une réponse de modèle demandée par l'instance elle-même, hors conversation :
 * le compte rendu d'une réunion, par exemple.
 *
 * Un modèle de la machine d'abord (le texte ne quitte pas l'instance) ; à
 * défaut, un modèle fourni par le prestataire. Jamais un modèle branché par la
 * clé de quelqu'un : ce serait sa carte bancaire, sans qu'il l'ait décidé. Le
 * modèle retenu est rendu avec la réponse, pour que l'écran dise où le texte
 * est passé.
 */

export type Message = { role: "system" | "user" | "assistant"; content: string };

export type Completion =
  | { ok: true; texte: string; modele: string; origine: "local" | "agence"; pays?: string }
  | { ok: false; message: string; tropLong?: boolean };

/** Modèle de conversation à utiliser : local et chargé d'abord, puis local, puis celui du prestataire. */
async function choisir(qui: string): Promise<{ model: ModelInfo } | { error: string }> {
  // Un modèle entraîné sur la machine n'est jamais pris d'office (router.ts).
  const tous = (await models()).filter((m) => m.roles.includes("chat") && !m.proprietaire && !m.entraine);
  const locaux = tous.filter((m) => (m.origine ?? "local") === "local");
  const local = locaux.find((m) => m.loaded) ?? locaux[0];
  if (local) return { model: local };
  const r = await resolve({ role: "chat", acces: qui });
  if ("error" in r) return { error: r.error };
  if (r.model.origine === "cle") return { error: "Aucun modèle de la machine ni du prestataire n'est disponible." };
  return { model: r.model };
}

export async function completer(
  messages: Message[],
  options: {
    qui: string;
    localSeulement?: boolean;
    maxTokens?: number;
    delaiMs?: number;
    /**
     * Réponse tenue à un schéma JSON (LM Studio : `response_format`, sortie
     * contrainte par grammaire). Ajouté le 26/09/2026 pour le plan des
     * applications de Helix Code (application.ts) : un petit modèle libre
     * d'écrire oublie une accolade une fois sur quelques-unes.
     */
    schema?: { nom: string; schema: Record<string, unknown> };
    /**
     * Ce modèle-là plutôt que celui de conversation : le plan d'une demande de
     * Helix Code se fait avec le modèle choisi pour le code (sequenceCode.ts).
     */
    modele?: string;
    /** Second essai après une réponse coupée par la longueur : jamais de troisième. */
    deuxiemeEssai?: boolean;
  },
): Promise<Completion> {
  // Le modèle nommé peut venir de la clé personnelle de la personne (Code, 27/09/2026) : il lui est servi.
  const choix = options.modele ? await resolve({ model: options.modele, acces: options.qui }) : await choisir(options.qui);
  if ("error" in choix) return { ok: false, message: choix.error };
  const { model } = choix;
  const backend = backendById(model.backendId);
  if (options.localSeulement && (!backend || !backendLocalSur(backend))) return { ok: false, message: t("Aucun modèle de texte local disponible.") };
  if (!backend) return { ok: false, message: tf("Moteur introuvable pour {0}.", model.id) };
  /*
   * Un modèle téléchargé mais pas en mémoire : Helix le charge avec ses
   * réglages (backends.ts, `optionsDeChargement`), comme le Chat, au lieu de
   * laisser LM Studio le charger seul avec les siens (27/09/2026).
   */
  if (moteurDeLaMachine(model.backendKind) && model.loaded === false) {
    const charge = await loadModel(model.id);
    if (!charge.ok) return { ok: false, message: charge.message };
  }

  /*
   * Les modèles Qwen3 raisonnent avant de répondre, longuement : pour un
   * compte rendu, le raisonnement double le temps sans rien ajouter. `/no_think`
   * est l'interrupteur que la famille documente.
   */
  const sansRaisonnement = /qwen3(?![.\d])/i.test(model.id);
  const envoyes = sansRaisonnement
    ? messages.map((m, i) => (i === messages.length - 1 && m.role === "user" ? { ...m, content: `${m.content}\n\n/no_think` } : m))
    : messages;
  /*
   * Un modèle qui réfléchit sans interrupteur connu (gpt-oss, Magistral, un
   * « thinking » ou « reasoning ») dépense ses jetons de sortie à réfléchir
   * avant d'écrire (16/10/2026) : avec 800 jetons pour un résumé de réunion,
   * la réflexion prenait tout, et il ne restait « rien répondu ». Sa
   * réflexion a sa propre part, en plus de ce que l'appelant demande.
   */
  const reflechitQuandMeme = Boolean(model.reasoning) && !/qwen3/i.test(model.id);
  const demandes = options.maxTokens ?? 2048;
  const payload: Record<string, unknown> = {
    model: model.id,
    messages: envoyes,
    stream: false,
    temperature: 0.2,
    max_tokens: reflechitQuandMeme ? demandes + 4096 : demandes,
    // Qwen3.5 et suivants : `/no_think` n'y fait plus rien, LM Studio suit ce champ (chat.ts).
    ...(moteurDeLaMachine(backend.kind) && /qwen3/i.test(model.id) ? { reasoning_effort: "none" } : {}),
    ...(options.schema && moteurDeLaMachine(backend.kind)
      ? { response_format: { type: "json_schema", json_schema: { name: options.schema.nom, strict: true, schema: options.schema.schema } } }
      : {}),
  };

  const refus = await refusSortie(backend);
  if (refus) return { ok: false, message: refus };
  const limite = AbortSignal.timeout(options.delaiMs ?? 10 * 60_000);
  const envoyer = (corps: Record<string, unknown>) =>
    fetch(`${backend.baseUrl}/chat/completions`, {
      method: "POST",
      redirect: options.localSeulement ? "error" : redirectionPour(backend),
      headers: {
        "Content-Type": "application/json",
        ...(backend.entetes ?? {}),
        ...(backend.apiKey ? { Authorization: `Bearer ${backend.apiKey}` } : {}),
      },
      body: JSON.stringify(corps),
      signal: limite,
    });
  let reponse: Response;
  let texteReponse = "";
  let envoye = payload;
  try {
    reponse = await envoyer(envoye);
    texteReponse = await reponse.text();
    /*
     * Un fournisseur qui refuse un champ (gpt-5 : `max_tokens` et
     * `temperature` ; Mistral : tout champ inconnu) : on retire ou renomme ce
     * que son refus nomme, et on rejoue, trois fois au plus (modelesCloud.ts,
     * 27/09/2026). Le plan de Helix Code passe ici avec le modèle choisi.
     */
    for (let essai = 0; essai < 3 && reponse.status >= 400 && reponse.status < 500 && ![401, 403, 404, 408, 429].includes(reponse.status); essai++) {
      const correction = correctionPour(envoye, texteReponse);
      if (!correction) break;
      envoye = appliquerCorrection(envoye, correction);
      reponse = await envoyer(envoye);
      texteReponse = await reponse.text();
    }
  } catch {
    return { ok: false, message: tf("Le modèle {0} n'a pas répondu à temps.", model.id) };
  }
  let corps: {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string } | string;
  } | null = null;
  try {
    corps = JSON.parse(texteReponse);
  } catch {
    corps = null;
  }
  if (!reponse.ok || !corps) {
    const detail = typeof corps?.error === "string" ? corps.error : (corps?.error?.message ?? "");
    const distant = backend.origine === "cle" || backend.origine === "agence";
    const parLeFournisseur =
      distant && reponse.status !== 400 && reponse.status !== 413 ? messageDuFournisseur(reponse.status, texteReponse, model.id, backend.fournisseur ?? backend.label) : null;
    if (parLeFournisseur) return { ok: false, message: parLeFournisseur };
    const tropLong = depasseLeContexte(reponse.status, detail || texteReponse);
    return {
      ok: false,
      tropLong,
      message: tropLong ? t("Le texte dépasse ce que le modèle peut lire d'un coup.") : tf("Le modèle a refusé la demande ({0}).", reponse.status),
    };
  }
  usage.releverReponse(options.qui, model, payload, corps);
  const brut = corps.choices?.[0]?.message?.content ?? "";
  // Une réflexion jamais refermée (coupée par la longueur) n'est pas une réponse.
  const texte = brut.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
  const fin = (corps.choices?.[0] as { finish_reason?: string } | undefined)?.finish_reason;
  /*
   * Coupée par la longueur (16/10/2026) : vide (la réflexion a tout pris), ou
   * un JSON tenu à un schéma resté sans sa fin. Un second essai, une fois,
   * avec deux fois plus de place pour la sortie.
   */
  if (fin === "length" && (!texte || options.schema) && !options.deuxiemeEssai) {
    console.log(`[completion] réponse de ${model.id} coupée par la longueur (${texte.length} caractères) : nouvel essai avec plus de place`);
    return completer(messages, { ...options, maxTokens: demandes * 2, deuxiemeEssai: true });
  }
  if (!texte) return { ok: false, message: fin === "length" ? tf("La réflexion de {0} a pris toute la place de la réponse.", model.id) : t("Le modèle n'a rien répondu.") };
  return { ok: true, texte, modele: model.id, origine: (model.origine ?? "local") === "local" ? "local" : "agence", ...(model.pays ? { pays: model.pays } : {}) };
}
