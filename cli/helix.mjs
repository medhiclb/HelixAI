#!/usr/bin/env node
/**
 * La ligne de commande de l'instance : le Chat et l'agent de code dans un
 * terminal, comme on en a l'habitude avec les agents de code en ligne de
 * commande. Demandé par le client le 25/09/2026.
 *
 * Tout passe par l'instance, comme pour l'extension VS Code
 * (extensions/vscode/extension.js, dont ce fichier reprend la manière) : ses
 * modèles, ses règles, sa barrière d'approbation, son journal. La ligne de
 * commande ne parle à aucun autre service et n'exécute rien elle-même : elle
 * affiche, et elle transmet les réponses de la personne.
 *
 * Aucune dépendance : Node 20 ou plus (fetch intégré), modules standard.
 *
 * Instance : celle de l'application de cet ordinateur par défaut
 * (http://127.0.0.1:8787, jeton lu dans ~/.helix/data/instance-token). Une
 * instance d'entreprise se donne par --adresse / HELIX_ADRESSE et
 * --jeton / HELIX_JETON.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { T, OUTILS, NOM, libelleConnecteur } from "./textes.mjs";

const VERSION = "0.1.0";
const ADRESSE_DEFAUT = "http://127.0.0.1:8787";

/* ------------------------------------------------------------------ */
/* Affichage                                                           */
/* ------------------------------------------------------------------ */

const couleurs = process.stdout.isTTY && !process.env.NO_COLOR;
const style = (code) => (texte) => (couleurs ? `\x1b[${code}m${texte}\x1b[0m` : texte);
const discret = style("2");
const vert = style("32");
const rouge = style("31");
const jaune = style("33");
const gras = style("1");

/** Ce qui a été écrit en dernier finit-il par un retour à la ligne ? */
let enDebutDeLigne = true;
/**
 * Une ligne d'état réécrite sur place (« Le modèle lit la demande (1 min 12 s,
 * 45 %)... »), seulement dans un vrai terminal : elle s'efface dès que quelque
 * chose d'autre s'écrit. Hors terminal (sortie redirigée), un état ne s'écrit
 * qu'en changeant, sur une ligne à lui.
 */
const surPlace = Boolean(process.stdout.isTTY);
let etatAffiche = false;
function effacerEtat() {
  if (!etatAffiche) return;
  process.stdout.write("\r\x1b[2K");
  etatAffiche = false;
  enDebutDeLigne = true;
}
/**
 * Une demande d'accord est à l'écran (`Approbations`) : la ligne d'état ne se
 * réécrit plus. Revue du 26/09/2026 : réécrite chaque seconde par
 * `\r\x1b[2K`, elle effaçait la ligne de la question pendant qu'on la lisait.
 */
let accordAffiche = false;
function etatSurPlace(texte) {
  if (!surPlace || accordAffiche) return;
  if (!enDebutDeLigne && !etatAffiche) process.stdout.write("\n");
  const largeur = process.stdout.columns ? process.stdout.columns - 1 : 100;
  process.stdout.write(`\r\x1b[2K${discret(texte.length > largeur ? `${texte.slice(0, largeur - 1)}…` : texte)}`);
  etatAffiche = true;
  enDebutDeLigne = false;
}
function ecrire(texte) {
  if (!texte) return;
  effacerEtat();
  process.stdout.write(texte);
  enDebutDeLigne = texte.endsWith("\n");
}
/** Une ligne à part, même si une réponse était en train de s'écrire. */
function ligne(texte = "") {
  effacerEtat();
  if (!enDebutDeLigne) process.stdout.write("\n");
  process.stdout.write(`${texte}\n`);
  enDebutDeLigne = true;
}
const avertir = (texte) => {
  effacerEtat();
  if (!enDebutDeLigne) process.stderr.write("\n");
  process.stderr.write(`${texte}\n`);
  enDebutDeLigne = true;
};

/**
 * Ce qui vient de l'instance s'affiche sans ce qui pourrait piloter le
 * terminal : ESC et les autres contrôles C0 et C1 (sauf retour à la ligne et
 * tabulation), et les caractères qui renversent l'ordre d'affichage
 * (U+202A–U+202E, U+2066–U+2069).
 *
 * Revue de sécurité du 25/09/2026 : le résumé d'une carte d'accord, le
 * destinataire, l'objet et le corps d'un mail, une commande, le texte d'une
 * réponse, les libellés d'outils viennent du modèle, et s'écrivaient tels
 * quels. Une séquence `\x1b[2K\r` efface la ligne affichée et en écrit une
 * autre : on aurait répondu « o » à autre chose que ce qu'on lisait. Le
 * nettoyage est fait à la lecture de chaque réponse et de chaque évènement,
 * avant tout affichage ; les couleurs de la ligne de commande sont ajoutées
 * après. Même règle côté instance (`nettoyer`, gateway/src/approbation.ts).
 */
export function nettoyer(texte) {
  return String(texte).replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "");
}
function nettoyerTout(valeur, profondeur = 0) {
  if (typeof valeur === "string") return nettoyer(valeur);
  if (profondeur > 8 || valeur === null || typeof valeur !== "object") return valeur;
  if (Array.isArray(valeur)) return valeur.map((v) => nettoyerTout(v, profondeur + 1));
  return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, nettoyerTout(v, profondeur + 1)]));
}
const lireJson = (texte) => nettoyerTout(JSON.parse(texte));
const jsonPropre = async (r) => nettoyerTout(await r.json());

/** Erreur à montrer telle quelle, sans pile : c'est un message pour la personne. */
class ErreurCli extends Error {}

/* ------------------------------------------------------------------ */
/* Arguments                                                           */
/* ------------------------------------------------------------------ */

const COMMANDES = new Set(["chat", "code", "connexion", "deconnexion", "modeles", "outils", "aide"]);
const AVEC_VALEUR = new Set(["--adresse", "--jeton", "--modele", "--effort", "--compte", "--dossier"]);

function analyser(argv) {
  const options = {};
  const positionnels = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positionnels.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const egal = a.indexOf("=");
      const nom = egal === -1 ? a : a.slice(0, egal);
      if (AVEC_VALEUR.has(nom)) {
        const valeur = egal === -1 ? argv[++i] : a.slice(egal + 1);
        if (valeur === undefined) throw new ErreurCli(T.optionSansValeur(nom));
        options[nom.slice(2)] = valeur;
      } else {
        options[nom.slice(2)] = true;
      }
    } else if (a === "-h") options.aide = true;
    else if (a === "-v") options.version = true;
    else positionnels.push(a);
  }
  let commande = "chat";
  if (positionnels.length > 0 && COMMANDES.has(positionnels[0])) commande = positionnels.shift();
  else if (positionnels[0] === "deconnecter" || positionnels[0] === "déconnexion") {
    positionnels.shift();
    commande = "deconnexion";
  }
  return { commande, options, texte: positionnels.join(" ").trim() };
}

/* ------------------------------------------------------------------ */
/* Instance, jeton, séance                                             */
/* ------------------------------------------------------------------ */

const LOCALES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Adresse de l'instance, et la règle de l'application : sans schéma, https est
 * supposé (sauf sur la boucle locale), et http est refusé pour une autre
 * machine (PROJET.md § 4, passe de 0.22.0). Le jeton et la séance voyagent
 * dans chaque requête ; en clair sur le réseau, n'importe qui les lirait.
 */
function adresseInstance(brute) {
  let texte = String(brute).trim().replace(/\/+$/, "");
  if (!/^[a-z]+:\/\//i.test(texte)) {
    const hote = texte.split("/")[0].replace(/:\d+$/, "");
    texte = `${LOCALES.has(hote) ? "http" : "https"}://${texte}`;
  }
  let url;
  try {
    url = new URL(texte);
  } catch {
    throw new ErreurCli(T.adresseInvalide(brute));
  }
  const locale = LOCALES.has(url.hostname);
  if (url.protocol === "http:" && !locale) throw new ErreurCli(T.httpDistant(texte));
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ErreurCli(T.adresseInvalide(brute));
  return { adresse: `${url.protocol}//${url.host}`, locale };
}

const dossierDonnees = () => process.env.HELIX_DATA_DIR || path.join(os.homedir(), ".helix", "data");
const fichierSeance = () => process.env.HELIX_CLI_SEANCE || path.join(os.homedir(), ".helix", "cli-seance");

function contexte(options) {
  const { adresse, locale } = adresseInstance(options.adresse || process.env.HELIX_ADRESSE || ADRESSE_DEFAUT);
  let jeton = String(options.jeton || process.env.HELIX_JETON || "").trim();
  /*
   * Le jeton de l'application de ce poste n'est lu que pour une adresse
   * locale : l'envoyer à une instance d'entreprise lui remettrait la clé de
   * l'instance de cet ordinateur. Et seulement pour le port que l'application
   * a réellement ouvert (`instance-port`, écrit par la passerelle à côté du
   * jeton) : revue du 26/09/2026, n'importe quel programme du poste écoutant
   * sur un autre port de la boucle locale le recevait.
   */
  if (!jeton && locale) {
    try {
      const ouvert = fs.readFileSync(path.join(dossierDonnees(), "instance-port"), "utf8").trim();
      const vise = new URL(adresse).port || (adresse.startsWith("https:") ? "443" : "80");
      if (ouvert === vise) jeton = fs.readFileSync(path.join(dossierDonnees(), "instance-token"), "utf8").trim();
    } catch {
      /* pas d'application sur ce poste (ou d'une version qui ne note pas son port) : il faudra HELIX_JETON */
    }
  }
  return { adresse, locale, jeton, seance: lireSeance(adresse)?.seance ?? "" };
}

/**
 * Le fichier de séance : `{ instances: { "<adresse>": { seance, compte, … } } }`.
 * Une séance par instance, envoyée seulement à celle qui l'a ouverte. Jamais
 * le mot de passe. Rendu `undefined` si le fichier existe mais ne se lit pas :
 * on ne réécrit pas par-dessus ce qu'on n'a pas pu lire.
 */
function lireFichierSeances() {
  const chemin = fichierSeance();
  let brut;
  try {
    brut = fs.readFileSync(chemin, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return { instances: {} };
    return undefined;
  }
  try {
    const lu = JSON.parse(brut);
    return lu && typeof lu === "object" && lu.instances && typeof lu.instances === "object" ? lu : undefined;
  } catch {
    return undefined;
  }
}

function lireSeance(adresse) {
  return lireFichierSeances()?.instances?.[adresse];
}

function ecrireSeances(contenu) {
  const chemin = fichierSeance();
  fs.mkdirSync(path.dirname(chemin), { recursive: true, mode: 0o700 });
  // `mode` ne change pas un dossier qui existe déjà (revue du 26/09/2026 : ~/.helix restait en 0755).
  try {
    fs.chmodSync(path.dirname(chemin), 0o700);
  } catch {
    /* dossier d'un autre propriétaire : on n'y touche pas */
  }
  // Écriture atomique, en 0600 dès la création : la séance vaut identité.
  const temp = `${chemin}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(contenu, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temp, chemin);
  fs.chmodSync(chemin, 0o600);
}

function modifierSeance(adresse, valeur) {
  const contenu = lireFichierSeances();
  if (!contenu) throw new ErreurCli(T.fichierSeanceIllisible(fichierSeance()));
  if (valeur) contenu.instances[adresse] = valeur;
  else delete contenu.instances[adresse];
  if (Object.keys(contenu.instances).length === 0) {
    try {
      fs.unlinkSync(fichierSeance());
    } catch {
      /* déjà absent */
    }
    return;
  }
  ecrireSeances(contenu);
}

/** Appel à l'instance, avec le jeton, et la séance quand on l'a. */
async function appel(ctx, chemin, { methode = "GET", corps, seance = true, signal, entetes } = {}) {
  if (!ctx.jeton) throw new ErreurCli(T.sansJeton);
  try {
    return await fetch(`${ctx.adresse}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${ctx.jeton}`,
        /*
         * La ligne de commande parle français (cli/textes.mjs) : les messages de
         * l'instance aussi. Sans cet en-tête, l'instance répond en anglais à qui
         * ne dit pas sa langue (décidé le 27/09/2026, gateway/src/langue.ts), et
         * le terminal mêlait les deux langues (« Files », « Choose your own
         * password… » au milieu du français ; essai-cli.mjs échouait depuis).
         */
        "X-Helix-Langue": "fr",
        ...(corps !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(seance && ctx.seance ? { "X-Helix-Session": ctx.seance } : {}),
        ...(entetes ?? {}),
      },
      body: corps !== undefined ? JSON.stringify(corps) : undefined,
      signal,
      /*
       * Jamais de redirection suivie : `fetch` renverrait `X-Helix-Session`
       * (et le jeton) à l'adresse désignée par la redirection, même d'une
       * autre origine (vérifié sur Node 24, revue du 26/09/2026).
       */
      redirect: "error",
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ErreurCli(T.injoignable(ctx.adresse));
  }
}

/**
 * Transforme une réponse en erreur lisible. Un 401 peut venir du jeton
 * d'instance ou de la séance : on le demande à l'instance plutôt que de
 * deviner, pour dire à la personne la bonne chose à faire.
 */
async function echec(ctx, r) {
  const corps = await jsonPropre(r).catch(() => ({}));
  if (r.status === 401) {
    const sonde = await appel(ctx, "/helix/models", { seance: false }).catch(() => null);
    if (sonde && sonde.status === 401) return new ErreurCli(T.jetonRefuse);
    if (ctx.seance) return new ErreurCli(T.seanceExpiree);
    return new ErreurCli(corps?.error?.message ? `${corps.error.message}\n${T.nonConnecte}` : T.nonConnecte);
  }
  return new ErreurCli(corps?.error?.message || T.refus(r.status));
}

async function json(ctx, chemin, options) {
  const r = await appel(ctx, chemin, options);
  if (!r.ok) throw await echec(ctx, r);
  return jsonPropre(r);
}

/**
 * Données d'un flux d'évènements (SSE), une par évènement. Les commentaires
 * (« : veille ») sont ignorés : ils ne servent qu'à garder la connexion.
 */
async function* evenements(reponse) {
  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let reste = "";
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) return;
    reste += decodeur.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const blocs = reste.split("\n\n");
    reste = blocs.pop() ?? "";
    for (const bloc of blocs) {
      const donnee = bloc
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).replace(/^ /, ""))
        .join("\n");
      if (donnee) yield donnee;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Saisie                                                              */
/* ------------------------------------------------------------------ */

const interactif = Boolean(process.stdin.isTTY);

/** Entrée non interactive (tube, fichier) : lue une fois, puis servie ligne à ligne. */
let entreeLue = null;
async function toutLEntree() {
  if (entreeLue !== null) return entreeLue;
  const morceaux = [];
  for await (const m of process.stdin) morceaux.push(m);
  entreeLue = Buffer.concat(morceaux).toString("utf8");
  return entreeLue;
}
let lignesEntree = null;
async function ligneEntree() {
  if (lignesEntree === null) lignesEntree = (await toutLEntree()).split(/\r?\n/);
  return lignesEntree.length > 0 ? lignesEntree.shift() : null;
}

/** L'interface de saisie de la conversation en cours, s'il y en a une. */
let saisie = null;

/**
 * Pose une question et rend la réponse, ou `null` (fin de l'entrée, abandon).
 * Sur un terminal, la question passe par l'interface de la conversation si
 * elle existe, sinon par une interface ouverte pour l'occasion.
 */
async function demander(question, signal) {
  if (!interactif) {
    ecrire(question);
    const l = await ligneEntree();
    ligne();
    return l;
  }
  const rl = saisie ?? readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise((ok) => {
      const surFermeture = () => ok(null);
      rl.once("close", surFermeture);
      if (signal) {
        if (signal.aborted) return ok(null);
        signal.addEventListener(
          "abort",
          () => {
            rl.off("close", surFermeture);
            ligne();
            ok(null);
          },
          { once: true },
        );
      }
      try {
        rl.question(question, signal ? { signal } : {}, (reponse) => {
          rl.off("close", surFermeture);
          enDebutDeLigne = true;
          ok(reponse);
        });
      } catch {
        // Interface déjà fermée (Ctrl+D) : pas de réponse, donc pas d'accord.
        ok(null);
      }
    });
  } finally {
    if (rl !== saisie) rl.close();
  }
}

/**
 * Un secret, sans écho : le mot de passe ne s'affiche pas et ne passe par
 * aucune interface qui le garderait en historique. Hors terminal (tube), il
 * est lu sur l'entrée, ce qui sert aux essais automatiques.
 */
async function demanderSecret(question) {
  if (!interactif) {
    const l = await ligneEntree();
    if (l === null) throw new ErreurCli(T.saisieInterrompue);
    return l;
  }
  process.stdout.write(question);
  const entree = process.stdin;
  return new Promise((ok, ko) => {
    let valeur = "";
    const fin = (erreur) => {
      entree.setRawMode(false);
      entree.pause();
      entree.off("data", surTouche);
      process.stdout.write("\n");
      if (erreur) ko(erreur);
      else ok(valeur);
    };
    const surTouche = (morceau) => {
      for (const car of morceau.toString("utf8")) {
        if (car === "\r" || car === "\n") return fin();
        if (car === "\u0003" || car === "\u0004") return fin(new ErreurCli(T.saisieInterrompue));
        if (car === "\u007f" || car === "\b") valeur = valeur.slice(0, -1);
        else if (car >= " ") valeur += car;
      }
    };
    entree.setRawMode(true);
    entree.resume();
    entree.on("data", surTouche);
  });
}

/* ------------------------------------------------------------------ */
/* Approbations                                                        */
/* ------------------------------------------------------------------ */

/**
 * Les demandes d'accord de l'agent, suivies pendant toute la commande.
 *
 * La barrière est dans la passerelle (approbation.ts) : l'agent y attend la
 * réponse de la personne, deux minutes au plus, l'expiration valant refus. La
 * ligne de commande ne décide rien. Elle écoute le flux des demandes de la
 * personne connectée, les montre en entier (pour un mail : destinataires,
 * objet, texte), et transmet la réponse. Seul un « o » ou un « oui » explicite
 * accorde ; tout le reste, Ctrl+C compris, refuse. Sans terminal pour poser la
 * question, elle dit de répondre dans l'application et ne répond rien.
 */
class Approbations {
  constructor(ctx) {
    this.ctx = ctx;
    this.arret = new AbortController();
    this.file = [];
    this.enCours = null;
    this.traitement = Promise.resolve();
  }

  demarrer() {
    if (!this.ctx.seance) return this;
    void this.ecouter();
    return this;
  }

  arreter() {
    this.arret.abort();
    this.enCours?.annuler.abort();
  }

  /** Ctrl+C pendant une question : refus. */
  refuserEnCours() {
    if (!this.enCours) return false;
    this.enCours.refuser = true;
    this.enCours.annuler.abort();
    return true;
  }

  async ecouter() {
    let essais = 0;
    while (!this.arret.signal.aborted && essais < 5) {
      try {
        const r = await appel(this.ctx, "/helix/approbation/evenements", { signal: this.arret.signal });
        if (!r.ok || !r.body) return;
        essais = 0;
        for await (const donnee of evenements(r)) {
          let ev;
          try {
            ev = lireJson(donnee);
          } catch {
            continue;
          }
          this.recevoir(ev);
        }
      } catch {
        if (this.arret.signal.aborted) return;
      }
      essais++;
      await new Promise((ok) => setTimeout(ok, 1000));
    }
  }

  recevoir(ev) {
    if (ev.type === "approbation_demandee" && ev.nature === "outil" && typeof ev.id === "string") {
      if (this.enCours?.id === ev.id || this.file.some((d) => d.id === ev.id)) return;
      this.file.push(ev);
      this.traitement = this.traitement.then(() => this.suivante()).catch(() => {});
      return;
    }
    if (ev.type === "approbation_resolue" || ev.type === "approbation_expiree") {
      this.file = this.file.filter((d) => d.id !== ev.id);
      if (this.enCours?.id === ev.id && !this.enCours.repondu) {
        this.enCours.issue = ev.type === "approbation_expiree" ? "expiree" : "ailleurs";
        this.enCours.annuler.abort();
      }
    }
  }

  async suivante() {
    const demande = this.file.shift();
    if (!demande) return;
    const courant = { id: demande.id, annuler: new AbortController(), repondu: false, issue: null, refuser: false };
    this.enCours = courant;
    effacerEtat();
    accordAffiche = true;
    try {
      ligne();
      const detail = demande.detail ?? {};
      // D'où vient la demande (Chat, Code, employé) : une carte de Code pendant un Chat se reconnaît.
      const surface = detail.employe ? "employe" : detail.surface === "code" ? "code" : "chat";
      ligne(jaune(gras(`${T.approbationTitre} (${T.approbationSurface[surface]}) :`)) + " " + T.approbationVeut(demande.resume ?? "agir"));
      if (detail.employe) ligne(discret(T.approbationEmploye(detail.employe)));
      if (typeof detail.commande === "string") {
        ligne(`  ${T.approbationCommande} :\n${detail.commande.replace(/^/gm, "    ")}`);
        ligne(jaune(`  ${T.approbationDroits}`));
      }
      const envoi = detail.envoi;
      if (envoi && typeof envoi === "object") {
        const m = T.approbationMail;
        if (envoi.objet) ligne(`  ${m.objet} : ${envoi.objet}`);
        if (envoi.corps) ligne(`  ${m.corps} :\n${String(envoi.corps).replace(/^/gm, "    ")}`);
        // Les destinataires en dernier, juste avant la question : un long corps ne les fait pas sortir de l'écran.
        if (envoi.cc) ligne(`  ${m.cc} : ${envoi.cc}`);
        if (envoi.a) ligne(`  ${m.a} : ${envoi.a}`);
      }
      /*
       * Ce que l'outil recevra, comme la carte de l'application (ToolApproval.tsx) :
       * un post, des cellules, les champs d'un connecteur. Tournée du 28/09/2026
       * (SECURITE.md § 41) : le terminal n'en montrait que le résumé, soit les
       * 120 premiers caractères d'un post, et on acceptait le reste sans l'avoir lu.
       */
      if (typeof detail.arguments === "string" && typeof detail.commande !== "string" && !(envoi && typeof envoi === "object")) {
        ligne(`  ${T.approbationContenu} :\n${detail.arguments.replace(/^/gm, "    ")}`);
      }
      // Messageries : comme la carte de l'application, le destinataire et le texte final d'un modèle WhatsApp.
      if (typeof detail.texteFinal === "string") ligne(`  ${T.approbationTexteFinal} :\n${detail.texteFinal.replace(/^/gm, "    ")}`);
      if (typeof detail.destinataire === "string") ligne(`  ${T.approbationDestinataire} : ${detail.destinataire}`);
      if (!interactif) {
        ligne(jaune(T.approbationSansTerminal(demande.resume ?? "")));
        return;
      }
      const reponse = await demander(T.approbationQuestion, courant.annuler.signal);
      if (courant.issue === "ailleurs") return ligne(discret(T.approbationAilleurs));
      if (courant.issue === "expiree") return ligne(discret(T.approbationExpiree));
      if (this.arret.signal.aborted && !courant.refuser) return;
      const accord = !courant.refuser && reponse !== null && /^\s*(o|oui)\s*$/i.test(reponse);
      courant.repondu = true;
      const r = await appel(this.ctx, "/helix/approbation/repondre", {
        methode: "POST",
        corps: { id: demande.id, accord },
      }).catch((err) => ({ ok: false, status: 0, json: async () => ({ error: { message: err.message } }) }));
      if (r.ok) ligne(accord ? vert(T.approbationAccordee) : rouge(T.approbationRefusee));
      else if (r.status === 404) ligne(discret(T.approbationExpiree));
      else ligne(rouge(T.approbationEchec((await jsonPropre(r).catch(() => ({})))?.error?.message ?? String(r.status))));
    } finally {
      this.enCours = null;
      accordAffiche = false;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Libellés d'outils                                                   */
/* ------------------------------------------------------------------ */

/** Chemin lisible : relatif au dossier courant quand il est dedans, `~` sinon. */
function cheminLisible(p, base = process.cwd()) {
  if (typeof p !== "string" || !p) return "";
  const absolu = path.resolve(base, p);
  const rel = path.relative(base, absolu);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel;
  if (!rel) return ".";
  const maison = os.homedir();
  /*
   * Sous Windows, le séparateur est `\` et la casse ne compte pas : avec `/`
   * seul, aucun chemin du dossier du compte n'y était raccourci en `~`
   * (relecture Windows du 04/10/2026).
   */
  const windows = process.platform === "win32";
  const comparable = (s) => (windows ? s.toLowerCase() : s);
  const dedans = comparable(absolu) === comparable(maison) || comparable(absolu).startsWith(comparable(`${maison}${path.sep}`));
  return dedans ? `~${absolu.slice(maison.length)}` : absolu;
}

/** « write » + { filePath } → « Écriture index.html ». */
function libelleOutil(nom, args = {}, base) {
  let serveur = "";
  let court = String(nom || "outil");
  // Connecteurs servis à l'agent de code : « helix_drive__chercher » chez OpenCode.
  if (court.startsWith("helix_")) court = court.slice("helix_".length);
  const sep = court.indexOf("__");
  if (sep > 0) {
    serveur = court.slice(0, sep);
    court = court.slice(sep + 2);
  }
  const cible =
    args.filePath ?? args.path ?? args.chemin ?? args.source ?? (Array.isArray(args.paths) ? args.paths[0] : undefined);
  const lisible =
    typeof cible === "string" ? cheminLisible(cible, base) : typeof args.command === "string" ? args.command.split("\n")[0].slice(0, 120) : typeof args.pattern === "string" ? args.pattern : typeof args.url === "string" ? args.url : "";
  if (serveur && serveur !== "fichiers") return `${libelleConnecteur(serveur, court)}${lisible ? ` ${lisible}` : ""}`;
  // Une sous-tâche dit ce qu'elle fait (sa description, écrite par l'agent pour la personne) : « ✓ task » ne disait rien.
  if (court === "task" && typeof args.description === "string" && args.description.trim()) return `${OUTILS.task} : ${args.description.trim()}`;
  return `${OUTILS[court] ?? court}${lisible ? ` ${lisible}` : ""}`;
}

/** La liste de tâches que tient l'agent (`todowrite`), une ligne par tâche. */
function lignesTaches(args) {
  if (!Array.isArray(args?.todos)) return [];
  const marque = { completed: "✓", in_progress: "▸", cancelled: "✗" };
  return args.todos
    .filter((t) => typeof t?.content === "string" && t.content.trim())
    .slice(0, 30)
    .map((t) => `  ${marque[t.status] ?? "·"} ${t.content.trim()}`);
}

const premiereLigne = (texte) => String(texte ?? "").trim().split("\n")[0].slice(0, 200);

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

/*
 * Réflexion écrite dans le texte, entre `<think>` et `</think>` (29/09/2026) :
 * certains moteurs ne la séparent pas (réglage de LM Studio, gabarit du modèle
 * non reconnu, service qui rend le texte brut), et les balises s'affichaient
 * ici avec toute la réflexion. Même découpage que la passerelle
 * (gateway/src/reflexionEnLigne.ts, essayé par la section 40 de
 * scripts/securite.mjs) : une réflexion en tête du texte, balises coupées
 * n'importe où entre deux morceaux, ou la balise fermante seule quand le
 * gabarit du modèle a déjà ouvert la sienne (`requalifie` : les derniers
 * caractères déjà rendus comme réponse étaient la réflexion).
 */
function separateurReflexion() {
  const OUVRANTE = "<think>";
  const FERMANTE = "</think>";
  const debutDe = (tete, balise) => tete.length < balise.length && balise.startsWith(tete);
  const suffixe = (s, balise) => {
    for (let n = Math.min(balise.length - 1, s.length); n > 0; n--) if (balise.startsWith(s.slice(s.length - n))) return n;
    return 0;
  };
  let etat = "debut";
  let retenu = "";
  let rendus = 0;
  let vue = false;
  return {
    /** Réflexion reçue par son canal séparé : le texte qui suit est la réponse. */
    canalSepare() {
      if (etat === "debut" && rendus === 0) etat = "apres";
    },
    /** @param {string} morceau @returns {{texte: string, reflexion: string, requalifie?: number}} */
    ajouter(morceau) {
      const sortie = { texte: "", reflexion: "" };
      let reste = retenu + morceau;
      retenu = "";
      while (reste) {
        if (etat === "reponse") {
          sortie.texte += reste;
          reste = "";
        } else if (etat === "debut") {
          const tete = reste.trimStart();
          if (rendus === 0) {
            if (!tete || debutDe(tete, OUVRANTE) || debutDe(tete, FERMANTE)) {
              retenu = reste;
              break;
            }
            if (tete.startsWith(OUVRANTE) || tete.startsWith(FERMANTE)) {
              etat = tete.startsWith(OUVRANTE) ? "dedans" : "apres";
              reste = tete.slice(tete.startsWith(OUVRANTE) ? OUVRANTE.length : FERMANTE.length);
              continue;
            }
          }
          const i = reste.indexOf(FERMANTE);
          if (i >= 0) {
            if (rendus > 0) sortie.requalifie = rendus;
            sortie.reflexion += reste.slice(0, i);
            rendus = 0;
            etat = "apres";
            reste = reste.slice(i + FERMANTE.length);
            continue;
          }
          const n = suffixe(reste, FERMANTE);
          sortie.texte += reste.slice(0, reste.length - n);
          rendus += reste.length - n;
          retenu = reste.slice(reste.length - n);
          reste = "";
        } else if (etat === "dedans") {
          if (!vue) reste = reste.trimStart();
          if (!reste) break;
          const i = reste.indexOf(FERMANTE);
          if (i >= 0) {
            sortie.reflexion += reste.slice(0, i);
            etat = "apres";
            reste = reste.slice(i + FERMANTE.length);
            continue;
          }
          const n = suffixe(reste, FERMANTE);
          sortie.reflexion += reste.slice(0, reste.length - n);
          if (reste.length > n) vue = true;
          retenu = reste.slice(reste.length - n);
          reste = "";
        } else {
          const tete = reste.trimStart();
          if (!tete || debutDe(tete, FERMANTE)) {
            retenu = tete;
            break;
          }
          if (tete.startsWith(FERMANTE)) {
            reste = tete.slice(FERMANTE.length);
            continue;
          }
          etat = "reponse";
          reste = tete;
        }
      }
      return sortie;
    },
    /** Fin du flux : ce qui était retenu est rendu à sa place. */
    finir() {
      const r = retenu;
      retenu = "";
      if (etat === "dedans") return { texte: "", reflexion: r };
      const t = r.trim();
      if ((etat === "debut" || etat === "apres") && rendus === 0 && (!t || OUVRANTE.startsWith(t) || FERMANTE.startsWith(t))) return { texte: "", reflexion: "" };
      return { texte: r, reflexion: "" };
    },
  };
}

/**
 * Une question au Chat, réponse écrite au fil de l'eau.
 *
 * Sans `--outils`, c'est l'API compatible, comme l'extension VS Code : le
 * modèle converse, rien n'agit. Avec, c'est `tools: true` : l'instance donne
 * au modèle ses outils (fichiers de Cowork, connecteurs), les exécute elle-même
 * après sa barrière d'approbation, et raconte ce qu'elle fait par des
 * évènements `helix` que l'on affiche ligne à ligne.
 */
async function questionChat(ctx, etat, signal) {
  const messages = etat.outils ? etat.historique : [{ role: "system", content: T.noteSansOutils }, ...etat.historique];
  const r = await appel(ctx, "/v1/chat/completions", {
    methode: "POST",
    signal,
    corps: {
      messages,
      stream: true,
      ...(etat.modele ? { model: etat.modele } : {}),
      ...(etat.outils ? { tools: true } : {}),
    },
  });
  if (!r.ok || !r.body) throw await echec(ctx, r);
  if (!etat.modeleVu) etat.modeleVu = r.headers.get("x-helix-model") || "";

  let reponse = "";
  let outil = null;
  /** Le dernier statut écrit hors terminal, chiffres ôtés : le même, qui ne fait que compter, ne se réécrit pas. */
  let statutDit = "";
  /*
   * La réflexion, par son canal (`reasoning_content`, `reasoning`) ou écrite
   * dans le texte entre balises : jamais affichée, mais dite sur place avec
   * son temps, puis sa durée une fois finie, comme dans le Chat (29/09/2026).
   */
  const separateur = separateurReflexion();
  let reflexionDepuis = 0;
  let reflexionFin = 0;
  const reflechit = () => {
    reflexionDepuis ||= Date.now();
    reflexionFin = Date.now();
    etatSurPlace(T.chatReflexion(T.duree(reflexionFin - reflexionDepuis)));
  };
  const rendre = (m) => {
    if (m.requalifie) {
      // Déjà écrit comme réponse : on ne peut que le dire, et le retirer de ce que retient la conversation.
      reponse = reponse.slice(0, Math.max(0, reponse.length - m.requalifie));
      reflexionDepuis ||= Date.now();
      ligne(discret(T.chatReflexionRequalifiee));
    }
    if (m.reflexion) reflechit();
    if (m.texte) {
      // Dans un terminal seulement : une sortie redirigée ne reçoit que la réponse.
      if (surPlace && reflexionDepuis && !reponse) ligne(discret(T.chatReflexionFaite(T.duree(reflexionFin - reflexionDepuis))));
      reponse += m.texte;
      ecrire(m.texte);
    }
  };
  for await (const donnee of evenements(r)) {
    if (donnee === "[DONE]") break;
    let ev;
    try {
      ev = lireJson(donnee);
    } catch {
      continue;
    }
    if (ev.error) throw new ErreurCli(ev.error.message || T.refus(500));
    const h = ev.helix;
    if (h) {
      if (h.type === "tool_start") outil = libelleOutil(h.name, h.args ?? {}, os.homedir());
      else if (h.type === "tool_end") {
        const libelle = outil ?? libelleOutil(h.name);
        ligne(h.ok ? vert(`✓ ${libelle}`) : rouge(`✗ ${libelle}`) + (h.ok ? "" : discret(` : ${premiereLigne(h.preview)}`)));
        outil = null;
      } else if (h.type === "plan" && Array.isArray(h.etapes)) {
        ligne(discret(T.plan(h.etapes.length)));
        h.etapes.forEach((e, i) => ligne(discret(`  ${i + 1}. ${e}`)));
      } else if (h.type === "etape" && typeof h.titre === "string") {
        ligne(gras(T.etape((h.index ?? 0) + 1, h.total ?? "?", h.titre)));
      } else if (h.type === "statut") {
        /*
         * L'instance redit chaque seconde où en est le modèle (« … lit la demande (12 s)... »,
         * 29/09/2026) : réécrit sur place dans un terminal ; ailleurs, une ligne seulement quand
         * l'étape change, pas une par seconde. Un statut vide : l'attente est finie.
         */
        if (!h.message) effacerEtat();
        else if (surPlace) etatSurPlace(h.message);
        else if (h.message.replace(/\d+/g, "") !== statutDit) ligne(discret(h.message));
        statutDit = h.message ? h.message.replace(/\d+/g, "") : statutDit;
      } else if (h.type === "error") throw new ErreurCli(h.message || T.refus(500));
      continue;
    }
    const delta = ev.choices?.[0]?.delta;
    if (delta?.reasoning_content || delta?.reasoning) {
      separateur.canalSepare();
      reflechit();
    }
    if (typeof delta?.content === "string" && delta.content) rendre(separateur.ajouter(delta.content));
  }
  rendre(separateur.finir());
  effacerEtat();
  if (!reponse.trim()) ligne(discret(T.reponseVide));
  else if (!enDebutDeLigne) ecrire("\n");
  return reponse;
}

async function commandeChat(ctx, options, texteInitial) {
  const etat = { historique: [], modele: options.modele || "", outils: Boolean(options.outils), modeleVu: "" };
  if (etat.outils && !ctx.seance) throw new ErreurCli(T.outilsSansSeance);

  const approbations = etat.outils ? new Approbations(ctx).demarrer() : null;
  try {
    if (etat.outils) await presenterOutils(ctx);

    // Une question donnée d'avance, ou par un tube : une réponse, puis on s'en va.
    let question = texteInitial;
    if (!interactif) {
      const entree = (await toutLEntree()).trim();
      question = question ? (entree ? `${question}\n\n${entree}` : question) : entree;
    }
    if (question || !interactif) {
      if (!question) return;
      etat.historique.push({ role: "user", content: question });
      const arret = new AbortController();
      const surCtrlC = () => (approbations?.refuserEnCours() ? undefined : arret.abort());
      process.on("SIGINT", surCtrlC);
      try {
        await questionChat(ctx, etat, arret.signal);
      } catch (err) {
        if (arret.signal.aborted) return void ligne(discret(T.arrete));
        throw err;
      } finally {
        process.off("SIGINT", surCtrlC);
      }
      return;
    }

    await boucle(ctx, etat, {
      invite: () => `${gras(T.vous)} › `,
      surNouveau: () => {
        etat.historique = [];
        ligne(discret(T.nouveauChat));
      },
      surModele: async (nom) => {
        if (nom) {
          etat.modele = nom;
          etat.modeleVu = "";
          return ligne(discret(T.modeleChange(nom)));
        }
        ligne(discret(T.modeleCourant(etat.modele || etat.modeleVu)));
        await listerModeles(ctx);
      },
      approbations,
      tour: async (texte, signal) => {
        etat.historique.push({ role: "user", content: texte });
        try {
          const reponse = await questionChat(ctx, etat, signal);
          etat.historique.push({ role: "assistant", content: reponse });
        } catch (err) {
          etat.historique.pop();
          throw err;
        }
      },
    });
  } finally {
    approbations?.arreter();
  }
}

/** Ce que l'agent aura sous la main, dit avant de commencer. */
async function presenterOutils(ctx) {
  try {
    const { groupes } = await json(ctx, "/helix/outils");
    const actifs = (groupes ?? []).filter((g) => g.actif).map((g) => g.label);
    ligne(discret(actifs.length ? T.outilsActifs(actifs.join(", ")) : T.aucunOutil));
    const mcp = await json(ctx, "/helix/mcp").catch(() => null);
    if (mcp?.workspace && (groupes ?? []).some((g) => g.id === "fichiers" && g.actif)) {
      ligne(discret(T.dossierOutils(cheminLisible(mcp.workspace, os.homedir()))));
    }
  } catch (err) {
    if (err instanceof ErreurCli) throw err;
  }
}

/**
 * La conversation interactive, commune au Chat et au Code : invite, commandes
 * « / », Ctrl+C qui arrête la réponse en cours ou, au repos, fait sortir.
 */
async function boucle(ctx, etat, { invite, surNouveau, surModele, tour, surArret, approbations }) {
  saisie = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true, historySize: 200 });
  const rl = saisie;
  let fermee = false;
  rl.on("close", () => (fermee = true));
  let enCours = null;
  rl.on("SIGINT", () => {
    if (approbations?.refuserEnCours()) return;
    if (enCours) {
      enCours.abort();
      return;
    }
    rl.close();
  });
  ligne(discret(T.aideConversation));
  try {
    for (;;) {
      const texte = await demander(invite());
      if (texte === null) break;
      const t = texte.trim();
      if (!t) continue;
      if (t === "/quitter" || t === "/q" || t === "/exit") break;
      if (t === "/aide" || t === "/?") {
        ligne(T.aideConversation);
        continue;
      }
      if (t === "/nouveau") {
        await surNouveau();
        continue;
      }
      if (t === "/modele" || t.startsWith("/modele ")) {
        await surModele(t.slice("/modele".length).trim()).catch((err) => avertir(rouge(T.erreur(err.message))));
        continue;
      }
      enCours = new AbortController();
      try {
        await tour(t, enCours.signal);
      } catch (err) {
        if (enCours.signal.aborted) {
          await surArret?.();
          ligne(discret(T.arrete));
        } else if (err instanceof ErreurCli) {
          avertir(rouge(err.message));
        } else throw err;
      } finally {
        enCours = null;
      }
    }
  } finally {
    if (!fermee) rl.close();
    saisie = null;
    ligne(discret(T.aurevoir));
  }
}

/* ------------------------------------------------------------------ */
/* Code                                                                */
/* ------------------------------------------------------------------ */

/**
 * Traduit un évènement d'OpenCode, comme l'écran Code (src/lib/code.ts) :
 * mêmes évènements, mêmes fins de tour. `null` pour ce qui ne s'affiche pas.
 */
function traduire(brut) {
  const type = brut?.type ?? "";
  const d = brut?.data ?? {};
  const erreur = (e) => (typeof e === "string" ? e : typeof e?.message === "string" ? e.message : "");
  if (type === "session.next.prompted" && typeof d.messageID === "string") return { genre: "demande", messageID: d.messageID };
  // Le modèle n'a encore rien rendu : il lit, attend son tour ou se charge (gateway/src/attenteModele.ts).
  if (type === "helix.statut" && ["lecture", "attente", "chargement", "fin"].includes(d.etat)) {
    const nombre = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    const ecoule = Math.max(0, (nombre(d.timestamp) ?? Date.now()) - (nombre(d.depuis) ?? Date.now()));
    return { genre: "attente", etat: d.etat, depuis: Date.now() - ecoule, progression: nombre(d.progression), jetons: nombre(d.jetons), sousTache: d.sousTache === true };
  }
  if (type === "helix.activite") return { genre: "activite", phase: d.phase, outil: typeof d.tool === "string" ? d.tool : undefined, sousTache: d.sousTache === true };
  if (type === "helix.soustache" && (d.etat === "fini" || d.etat === "echec")) {
    return { genre: "sous-outil", outil: String(d.tool ?? "outil"), args: d.input ?? {}, ok: d.etat === "fini" };
  }
  if (type === "session.next.text.ended" && typeof d.text === "string") return { genre: "texte", texte: d.text };
  if (type === "session.next.tool.called") return { genre: "outil", callID: String(d.callID ?? ""), outil: String(d.tool ?? "outil"), args: d.input ?? {} };
  if (type === "session.next.tool.success") return { genre: "outil-fin", callID: String(d.callID ?? ""), ok: true };
  if (type === "session.next.tool.failed") return { genre: "outil-fin", callID: String(d.callID ?? ""), ok: false, message: erreur(d.error) };
  if (type === "session.next.step.failed") return { genre: "erreur", message: erreur(d.error) || T.codeEchec };
  if (type === "session.next.retried") return { genre: "statut", texte: T.codeStatutRetente(erreur(d.error)) };
  if (type === "session.next.compaction.started") return { genre: "statut", texte: T.codeResume };
  if (type === "session.next.step.ended") {
    if (d.finish === "tool-calls" || d.finish === "tool_calls") return null;
    if (d.finish === "stop") return { genre: "fini" };
    if (typeof d.finish === "string") return { genre: "fin", note: T.codeFin[d.finish] ?? T.codeFin.autre };
  }
  return null;
}

async function ouvrirSessionCode(ctx, etat) {
  const r = await appel(ctx, "/helix/code/session", {
    methode: "POST",
    corps: { dossier: etat.dossier, ...(etat.modele ? { model: etat.modele } : {}), ...(etat.effort ? { effort: etat.effort } : {}) },
  });
  if (!r.ok) throw await echec(ctx, r);
  const corps = await jsonPropre(r).catch(() => ({}));
  const id = corps?.data?.id ?? corps?.id;
  if (!id) throw new ErreurCli(T.refus(r.status));
  etat.session = id;
  etat.dernier = undefined;
}

/**
 * Une demande à l'agent de code, jusqu'à la fin de son tour.
 *
 * Le flux d'abord, la demande ensuite : aucun évènement ne se perd entre les
 * deux. Le flux d'une session rejoue son histoire à chaque ouverture ; `after`
 * (dernier numéro reçu) l'évite, et l'identifiant du message rendu par l'envoi
 * écarte les derniers échos d'un tour précédent, comme le fait l'écran Code
 * (src/hooks/useCode.ts).
 */
async function demandeCode(ctx, etat, texte, signal) {
  const tour = { messageID: undefined, connu: false, actif: false, attente: [], outils: new Map(), ecrit: false, modele: null };
  /** « Le modèle lit la demande (1 min 12 s, 45 %, environ 3 000 jetons)... », comme l'écran Code. */
  const texteModele = (a) => {
    const duree = T.duree(Date.now() - a.depuis);
    if (a.etat === "chargement") return T.codeChargement(duree);
    if (a.etat === "attente") return T.codeAttenteTour(duree);
    const environ = a.jetons ? (a.jetons >= 1000 ? Math.round(a.jetons / 1000) * 1000 : a.jetons).toLocaleString("fr-FR") : "";
    const detail = [duree, a.progression !== undefined ? T.pourcent(a.progression) : "", environ ? T.environJetons(environ) : ""].filter(Boolean).join(", ");
    return T.codeLecture(detail, a.sousTache);
  };
  // Dans un terminal, le temps de lecture avance à la seconde ; l'instance n'en envoie que toutes les dix.
  const horloge = surPlace ? setInterval(() => tour.modele && etatSurPlace(texteModele(tour.modele)), 1000) : null;
  let finir;
  let echouer;
  const fin = new Promise((ok, ko) => {
    finir = ok;
    echouer = ko;
  });
  fin.catch(() => {});

  const appliquer = (ev) => {
    if (ev.genre === "demande") {
      tour.actif = tour.messageID === undefined || ev.messageID === tour.messageID;
      return;
    }
    if (!tour.actif) return;
    // Le modèle a rendu quelque chose : il ne lit plus.
    if (ev.genre !== "attente") tour.modele = null;
    switch (ev.genre) {
      case "attente": {
        if (ev.etat === "fin") {
          effacerEtat();
          break;
        }
        const change = !tour.modele || tour.modele.etat !== ev.etat;
        tour.modele = ev;
        if (surPlace) etatSurPlace(texteModele(ev));
        else if (change) ligne(discret(texteModele(ev)));
        break;
      }
      case "activite":
        // Dans un terminal seulement : ce qui se passe entre deux lignes, effacé dès que la suite s'écrit.
        if (!surPlace || ev.sousTache) break;
        if (ev.phase === "reflexion") etatSurPlace(T.codeReflexion);
        else if (ev.phase === "outil" && ev.outil) etatSurPlace(T.codePreparation(OUTILS[ev.outil] ?? ev.outil));
        else effacerEtat();
        break;
      case "texte":
        if (ev.texte.trim()) {
          ligne(ev.texte.trim());
          tour.ecrit = true;
        }
        break;
      case "outil": {
        const libelle = libelleOutil(ev.outil, ev.args, etat.dossier);
        tour.outils.set(ev.callID, libelle);
        if (ev.outil === "todowrite") {
          const taches = lignesTaches(ev.args);
          if (taches.length) {
            ligne(discret(T.codeTaches));
            taches.forEach((t) => ligne(discret(t)));
          }
        }
        // Une sous-tâche peut durer des minutes : on la dit quand elle commence, pas seulement à la fin.
        if (ev.outil === "task") ligne(discret(`▸ ${libelle}`));
        break;
      }
      case "sous-outil":
        ligne(discret(`  ↳ ${ev.ok ? "✓" : "✗"} ${libelleOutil(ev.outil, ev.args, etat.dossier)}`));
        break;
      case "outil-fin": {
        const libelle = tour.outils.get(ev.callID) ?? T.codeEchec;
        ligne(ev.ok ? vert(`✓ ${libelle}`) : rouge(`✗ ${libelle}`) + (ev.message ? discret(` : ${premiereLigne(ev.message)}`) : ""));
        tour.ecrit = true;
        break;
      }
      case "statut":
        ligne(discret(ev.texte));
        break;
      case "erreur":
        echouer(new ErreurCli(ev.message));
        break;
      case "fin":
        ligne(jaune(ev.note));
        finir();
        break;
      case "fini":
        if (!tour.ecrit) ligne(discret(T.codeFini));
        finir();
        break;
    }
  };
  const recevoir = (ev) => {
    if (!tour.connu && !tour.actif) {
      tour.attente.push(ev);
      return;
    }
    appliquer(ev);
  };

  /** Le flux d'une session, repris là où il s'était arrêté s'il tombe en plein travail. */
  const ecouter = async (session, apres, arret) => {
    let reprises = 0;
    while (!arret.aborted) {
      const suite = apres !== undefined ? `&after=${apres}` : "";
      const r = await appel(ctx, `/helix/code/events?sessionID=${encodeURIComponent(session)}${suite}`, { signal: arret });
      if (!r.ok || !r.body) throw await echec(ctx, r);
      for await (const donnee of evenements(r)) {
        let brut;
        try {
          brut = lireJson(donnee);
        } catch {
          continue;
        }
        const seq = brut?.durable?.seq;
        if (typeof seq === "number" && (apres === undefined || seq > apres)) {
          apres = seq;
          if (etat.session === session) etat.dernier = seq;
        }
        const ev = traduire(brut);
        if (ev) recevoir(ev);
      }
      if (++reprises > 3) throw new ErreurCli(T.codeFluxPerdu);
    }
  };
  /** Un flux se ferme à l'arrêt demandé, à la fin du tour, ou quand on change de session. */
  const lancer = (session, apres) => {
    const propre = new AbortController();
    const arret = AbortSignal.any([signal, propre.signal]);
    ecouter(session, apres, arret).catch((err) => {
      if (!arret.aborted) echouer(err);
    });
    return propre;
  };

  let flux = lancer(etat.session, etat.dernier);
  try {
    const r = await appel(ctx, "/helix/code/prompt", {
      methode: "POST",
      signal,
      corps: {
        sessionID: etat.session,
        text: texte,
        ...(etat.modeleEnvoi ? { model: etat.modeleEnvoi } : {}),
        ...(etat.effort ? { effort: etat.effort } : {}),
      },
    });
    const corps = await jsonPropre(r).catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) throw await echec(ctx, { status: 401, json: async () => corps });
      throw new ErreurCli(corps?.error?.message || T.refus(r.status));
    }
    etat.modeleEnvoi = undefined;
    if (corps?.helixRelance?.sessionID) {
      // L'instance a relancé la demande dans une session neuve : on suit celle-là.
      flux.abort();
      etat.session = corps.helixRelance.sessionID;
      etat.dernier = undefined;
      ligne(discret(T.codeRelance));
      tour.attente = [];
      tour.actif = false;
      flux = lancer(etat.session, undefined);
    }
    tour.messageID = typeof corps?.data?.id === "string" ? corps.data.id : undefined;
    tour.connu = true;
    // Sans identifiant rendu par l'envoi, on ne peut pas trier : tout est pris.
    if (tour.messageID === undefined) tour.actif = true;
    for (const ev of tour.attente.splice(0)) appliquer(ev);

    await new Promise((ok, ko) => {
      fin.then(ok, ko);
      if (signal.aborted) ko(Object.assign(new Error("arret"), { name: "AbortError" }));
      signal.addEventListener("abort", () => ko(Object.assign(new Error("arret"), { name: "AbortError" })), { once: true });
    });
  } finally {
    if (horloge) clearInterval(horloge);
    effacerEtat();
    flux.abort();
  }
}

async function interrompreCode(ctx, etat) {
  if (!etat.session) return;
  await appel(ctx, "/helix/code/interrupt", { methode: "POST", corps: { sessionID: etat.session } }).catch(() => {});
  ligne(discret(T.codeInterrompu));
}

async function commandeCode(ctx, options, texteInitial) {
  if (!ctx.seance) throw new ErreurCli(T.codeSansSeance);
  /*
   * Le dossier du projet est un chemin **de la machine de l'instance** : c'est
   * elle qui y fait travailler l'agent. Le dossier courant de ce poste n'a de
   * sens que pour une instance locale (revue du 25/09/2026 : il partait tel
   * quel vers une instance d'entreprise). Ailleurs, `--dossier` le donne.
   */
  const dossierDistant = typeof options.dossier === "string" ? options.dossier.trim() : "";
  if (!ctx.locale && !dossierDistant) throw new ErreurCli(T.codeDossierDistant(ctx.adresse));
  const etat = {
    dossier: dossierDistant || process.cwd(),
    modele: options.modele || "",
    effort: options.effort || "",
    session: null,
    dernier: undefined,
    modeleEnvoi: undefined,
  };
  const approbations = new Approbations(ctx).demarrer();
  try {
    await ouvrirSessionCode(ctx, etat);
    ligne(discret(T.codeSession(cheminLisible(etat.dossier, os.homedir()))));

    let demande = texteInitial;
    if (!interactif) {
      const entree = (await toutLEntree()).trim();
      demande = demande ? (entree ? `${demande}\n\n${entree}` : demande) : entree;
    }
    if (demande || !interactif) {
      if (!demande) return;
      const arret = new AbortController();
      let arrets = 0;
      const surCtrlC = () => {
        if (approbations.refuserEnCours()) return;
        if (++arrets > 1) process.exit(130);
        arret.abort();
      };
      process.on("SIGINT", surCtrlC);
      try {
        await demandeCode(ctx, etat, demande, arret.signal);
      } catch (err) {
        if (arret.signal.aborted) {
          await interrompreCode(ctx, etat);
          process.exitCode = 130;
          return;
        }
        throw err;
      } finally {
        process.off("SIGINT", surCtrlC);
      }
      return;
    }

    await boucle(ctx, etat, {
      invite: () => `${gras("code")} › `,
      surNouveau: async () => {
        await ouvrirSessionCode(ctx, etat);
        ligne(discret(T.codeNouvelleSession));
      },
      surModele: async (nom) => {
        if (nom) {
          etat.modele = nom;
          etat.modeleEnvoi = nom;
          return ligne(discret(T.modeleChange(nom)));
        }
        ligne(discret(T.modeleCourant(etat.modele)));
        await listerModeles(ctx);
      },
      surArret: () => interrompreCode(ctx, etat),
      approbations,
      tour: (texte, signal) => demandeCode(ctx, etat, texte, signal),
    });
  } finally {
    approbations.arreter();
  }
}

/* ------------------------------------------------------------------ */
/* Connexion                                                           */
/* ------------------------------------------------------------------ */

async function commandeConnexion(ctx, options) {
  const { value: comptes = [] } = await json(ctx, "/helix/data/accounts", { seance: false });
  if (comptes.length === 0) throw new ErreurCli(T.aucunCompte);

  let compte;
  if (options.compte) {
    const voulu = String(options.compte).trim().toLowerCase();
    compte = comptes.find((c) => String(c.email ?? "").toLowerCase() === voulu || c.id === options.compte);
    if (!compte) throw new ErreurCli(T.compteInconnu(options.compte));
  } else if (comptes.length === 1) {
    compte = comptes[0];
  } else {
    if (!interactif) throw new ErreurCli(`${T.choisirCompte} ${comptes.map((c) => c.email).join(", ")} (--compte)`);
    ligne(T.choisirCompte);
    comptes.forEach((c, i) => ligne(`  ${i + 1}. ${c.fullName || c.email}${c.email ? discret(` <${c.email}>`) : ""}`));
    const choix = Number((await demander(T.numeroCompte(comptes.length))) ?? "");
    compte = comptes[choix - 1];
    if (!compte) throw new ErreurCli(T.choixInvalide);
  }

  const nom = compte.fullName || compte.email;
  const motDePasse = await demanderSecret(T.motDePasse(nom));
  const poste = `Terminal (${os.hostname()})`;
  let r = await appel(ctx, "/helix/auth/verify", {
    methode: "POST",
    seance: false,
    corps: { accountId: compte.id, password: motDePasse, poste, rester: true },
  });
  let corps = await jsonPropre(r).catch(() => ({}));
  if (!r.ok && corps?.error?.code === "deux-facteurs-requis" && corps.defi) {
    const code = await demander(T.codeDeuxFacteurs);
    if (!code) throw new ErreurCli(T.saisieInterrompue);
    r = await appel(ctx, "/helix/auth/deux-facteurs", {
      methode: "POST",
      seance: false,
      corps: { defi: corps.defi, code: code.trim(), poste, rester: true },
    });
    corps = await jsonPropre(r).catch(() => ({}));
  }
  if (!r.ok && corps?.error?.code === "deux-facteurs-a-activer") throw new ErreurCli(T.deuxFacteursAActiver);
  if (!r.ok && corps?.error?.code === "mot-de-passe-a-definir") throw new ErreurCli(T.premierMotDePasse);
  const jetonSeance = corps?.session?.token;
  if (!r.ok || !jetonSeance) throw new ErreurCli(corps?.error?.message || T.connexionRefusee);

  modifierSeance(ctx.adresse, {
    seance: jetonSeance,
    compte: nom,
    email: compte.email ?? "",
    le: new Date().toISOString(),
  });
  ligne(vert(T.connecte(nom, ctx.adresse, cheminLisible(fichierSeance(), os.homedir()))));
}

async function commandeDeconnexion(ctx) {
  if (!ctx.seance) return ligne(T.dejaDeconnecte);
  // Fermée sur l'instance d'abord : oubliée ici seulement, elle resterait valable.
  let fermee = false;
  try {
    const r = await appel(ctx, "/helix/auth/sessions");
    if (r.ok) {
      const { sessions = [] } = await jsonPropre(r);
      const courante = sessions.find((s) => s.courante);
      if (courante) {
        const f = await appel(ctx, "/helix/auth/revoke", { methode: "POST", corps: { id: courante.id } });
        fermee = f.ok;
      }
    } else if (r.status === 401) fermee = true; // déjà fermée ou expirée
  } catch {
    /* instance injoignable : on oublie quand même, et on le dit */
  }
  modifierSeance(ctx.adresse, null);
  ligne(fermee ? T.deconnecte : T.deconnecteLocal);
}

/* ------------------------------------------------------------------ */
/* Listes                                                              */
/* ------------------------------------------------------------------ */

async function listerModeles(ctx) {
  const { data = [] } = await json(ctx, "/v1/models");
  const utiles = data.filter((m) => !(m.helix?.roles ?? []).every((r) => r === "embed"));
  if (utiles.length === 0) return ligne(T.aucunModele);
  ligne(T.modelesTitre);
  for (const m of utiles) {
    const roles = (m.helix?.roles ?? []).join(", ");
    const charge = m.helix?.loaded ? ` ${vert(T.modeleCharge)}` : "";
    ligne(`  ${m.id}${charge}${roles ? discret(`  (${roles})`) : ""}`);
  }
}

/**
 * Groupes d'outils que l'agent de code ne reçoit pas (gateway/src/outilsCode.ts) :
 * ils agissent sur le dossier de Cowork ou sur l'écran, pas sur le projet. Tous
 * les autres (courrier, agenda, Drive, Slack, bibliothèque, réunions, serveurs
 * MCP du catalogue) lui sont servis aussi.
 */
const HORS_CODE = new Set(["fichiers", "bureau", "ecran", "controle"]);

async function listerOutils(ctx) {
  const { groupes = [] } = await json(ctx, "/helix/outils", { seance: false });
  ligne(T.outilsTitre);
  for (const g of groupes) {
    const etatG = g.actif ? vert(T.outilsActif) : discret(T.outilsInactif);
    const code = g.actif && !HORS_CODE.has(g.id) ? discret(`, ${T.outilsCode}`) : "";
    ligne(`  ${gras(g.label)} ${discret(`[${g.id}]`)} : ${etatG}${code}`);
    if (g.description) ligne(discret(`      ${g.description}`));
    if (!g.actif && g.obstacle) ligne(discret(`      ${g.obstacle}`));
  }
  if (ctx.seance) {
    const r = await appel(ctx, "/helix/approbation");
    if (r.ok) ligne(T.outilsNiveau((await jsonPropre(r)).niveau));
    else ligne(discret(T.outilsNiveauInconnu));
  } else ligne(discret(T.outilsNiveauInconnu));
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

async function principal() {
  const { commande, options, texte } = analyser(process.argv.slice(2));
  if (options.version) return ligne(`${NOM} CLI ${VERSION}`);
  if (options.aide || options.help || commande === "aide") return ligne(T.aide);
  const ctx = contexte(options);
  switch (commande) {
    case "chat":
      return commandeChat(ctx, options, texte);
    case "code":
      return commandeCode(ctx, options, texte);
    case "connexion":
      return commandeConnexion(ctx, options);
    case "deconnexion":
      return commandeDeconnexion(ctx);
    case "modeles":
      return listerModeles(ctx);
    case "outils":
      return listerOutils(ctx);
    default:
      throw new ErreurCli(T.commandeInconnue(commande));
  }
}

principal().then(
  () => {
    // Un flux resté ouvert (approbations) ne doit pas retenir le processus.
    process.exit(process.exitCode ?? 0);
  },
  (err) => {
    if (err instanceof ErreurCli) avertir(rouge(err.message));
    else avertir(rouge(T.erreur(err?.stack || String(err))));
    process.exit(1);
  },
);
