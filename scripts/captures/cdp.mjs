/*
 * Un Chrome sans fenêtre, piloté par son protocole de débogage (CDP), pour
 * les captures du README (scripts/captures/capturer.mjs, 28/09/2026).
 *
 * Aucune dépendance : Node 22+ a `WebSocket` et `fetch`. Le Chrome est celui
 * de la machine (Google Chrome, ou `CHROME` pour un autre), lancé avec un
 * profil jetable : ni les comptes ni l'historique du poste ne sont touchés.
 *
 * Ce que le module sait faire, et rien de plus : ouvrir une page à une taille
 * donnée (1280 × 800, densité 2), exécuter du JavaScript dans la page,
 * cliquer, taper, prendre une capture, et remplacer la réponse d'une requête
 * (`intercepter`) pour les écrans dont la source ne peut pas tourner ici.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROMES = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Une valeur écrite dans du code JavaScript envoyé à la page : `JSON.stringify`,
 * plus `<`, `>`, `/` et les fins de ligne Unicode échappés, pour qu'aucune
 * valeur ne puisse fermer une balise ni couper la ligne (CodeQL, 04/10/2026).
 */
export const enJs = (v) => JSON.stringify(v).replace(/[<>/\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

export async function lancerChrome({ largeur = 1280, hauteur = 800, densite = 2, langue = "en" } = {}) {
  const binaire = CHROMES.find((c) => existsSync(c));
  if (!binaire) throw new Error("Chrome introuvable : donnez son chemin dans CHROME.");
  const profil = mkdtempSync(join(tmpdir(), "helix-captures-chrome-"));
  const processus = spawn(
    binaire,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profil}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-sync",
      "--disable-background-networking",
      "--disable-component-update",
      // Sans cache des pages quittées : il gardait leurs flux (EventSource) ouverts, et les six connexions
      // qu'un navigateur ouvre au plus vers une même adresse finissaient prises (écrans restés à « Chargement », 28/09/2026).
      "--disable-features=BackForwardCache",
      "--disable-back-forward-cache",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      `--lang=${langue}`,
      `--window-size=${largeur},${hauteur}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  // Chrome écrit l'adresse de son protocole sur sa sortie d'erreur.
  const adresse = await new Promise((ok, ko) => {
    let lu = "";
    const delai = setTimeout(() => ko(new Error(`Chrome muet :\n${lu.slice(-1500)}`)), 20_000);
    processus.stderr.on("data", (b) => {
      lu += b;
      const m = lu.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(delai);
        ok(m[1]);
      }
    });
    processus.on("exit", (code) => ko(new Error(`Chrome arrêté (${code}) :\n${lu.slice(-1500)}`)));
  });
  const racine = new URL(adresse);
  const cibles = await (await fetch(`http://${racine.host}/json/list`)).json();
  const page = cibles.find((c) => c.type === "page");
  const onglet = new Onglet(page.webSocketDebuggerUrl);
  await onglet.ouvrir();
  await onglet.envoyer("Page.enable");
  await onglet.envoyer("Runtime.enable");
  await onglet.envoyer("Emulation.setDeviceMetricsOverride", { width: largeur, height: hauteur, deviceScaleFactor: densite, mobile: false });
  await onglet.envoyer("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "no-preference" }] });
  // Langue du navigateur : `navigator.languages`, que l'interface lit quand rien n'est choisi.
  await onglet.envoyer("Emulation.setLocaleOverride", { locale: langue }).catch(() => {});
  await onglet.envoyer("Emulation.setTimezoneOverride", { timezoneId: "Europe/Paris" }).catch(() => {});
  onglet.fermerTout = async () => {
    try {
      onglet.ws.close();
    } catch {
      /* déjà fermé */
    }
    processus.kill("SIGTERM");
    await attendre(300);
    try {
      rmSync(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      /* Chrome écrit encore un instant : le dossier temporaire reste, sans conséquence */
    }
  };
  return onglet;
}

class Onglet {
  constructor(url) {
    this.url = url;
    this.numero = 0;
    this.attentes = new Map();
    this.ecouteurs = new Map();
    this.interceptions = [];
  }

  ouvrir() {
    return new Promise((ok, ko) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => ok();
      this.ws.onerror = (e) => ko(e);
      // Chrome parti (arrêté, planté) : les commandes en attente échouent au lieu d'attendre pour toujours.
      this.ws.onclose = () => {
        for (const { ko: rejeter } of this.attentes.values()) rejeter(new Error("Chrome ne répond plus (connexion fermée)."));
        this.attentes.clear();
      };
      this.ws.onmessage = (m) => {
        const msg = JSON.parse(String(m.data));
        if (msg.id && this.attentes.has(msg.id)) {
          const { ok: resoudre, ko: rejeter } = this.attentes.get(msg.id);
          this.attentes.delete(msg.id);
          if (msg.error) rejeter(new Error(`${msg.error.message} ${msg.error.data ?? ""}`));
          else resoudre(msg.result);
          return;
        }
        for (const f of this.ecouteurs.get(msg.method) ?? []) f(msg.params);
      };
    });
  }

  envoyer(methode, params = {}) {
    const id = ++this.numero;
    if (this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Chrome ne répond plus (connexion fermée)."));
    this.ws.send(JSON.stringify({ id, method: methode, params }));
    return new Promise((ok, ko) => {
      // Une minute au plus par commande : une page figée ne bloque pas toute la scène.
      const delai = setTimeout(() => {
        if (this.attentes.delete(id)) ko(new Error(`Chrome n'a pas répondu à ${methode} en une minute.`));
      }, 60_000);
      this.attentes.set(id, {
        ok: (v) => (clearTimeout(delai), ok(v)),
        ko: (e) => (clearTimeout(delai), ko(e)),
      });
    });
  }

  sur(methode, f) {
    if (!this.ecouteurs.has(methode)) this.ecouteurs.set(methode, []);
    this.ecouteurs.get(methode).push(f);
  }

  /** Garde la trace des requêtes vers la passerelle (méthode, adresse, statut) : pour comprendre un écran resté vide. */
  async noterRequetes() {
    this.requetes = [];
    await this.envoyer("Network.enable");
    this.sur("Network.requestWillBeSent", (p) => {
      if (/^https?:\/\/127\.0\.0\.1/.test(p.request.url)) this.requetes.push({ id: p.requestId, quoi: `${p.request.method} ${p.request.url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api/, "")}` });
    });
    this.sur("Page.frameNavigated", (p) => {
      if (!p.frame.parentId) this.requetes.push({ navigation: true, quoi: `(page ${p.frame.url})`, statut: "" });
    });
    const fin = (p) => {
      const r = this.requetes.find((x) => x.id === p.requestId);
      if (r) r.fini = true;
    };
    this.sur("Network.loadingFinished", fin);
    this.sur("Network.loadingFailed", (p) => {
      fin(p);
      const r = this.requetes.find((x) => x.id === p.requestId);
      if (r) r.statut ??= `échec ${p.errorText}${p.canceled ? " (annulée)" : ""}${p.blockedReason ? ` ${p.blockedReason}` : ""}`;
    });
    this.sur("Network.responseReceived", (p) => {
      const r = this.requetes.find((x) => x.id === p.requestId);
      if (r) r.statut = p.response.status;
    });
  }

  /** Script posé avant tout autre dans chaque page chargée (le stockage local de la scène). */
  async avantChaquePage(source) {
    await this.envoyer("Page.addScriptToEvaluateOnNewDocument", { source });
  }

  async aller(url) {
    const charge = new Promise((ok) => {
      const f = () => {
        this.ecouteurs.set("Page.loadEventFired", (this.ecouteurs.get("Page.loadEventFired") ?? []).filter((x) => x !== f));
        ok();
      };
      this.sur("Page.loadEventFired", f);
    });
    await this.envoyer("Page.navigate", { url });
    await Promise.race([charge, attendre(20_000)]);
  }

  /** Évalue une expression dans la page et rend sa valeur (les promesses sont attendues). */
  async eval(expression) {
    const r = await this.envoyer("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`Dans la page : ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }

  /** Attend qu'une expression soit vraie (texte affiché, élément présent). */
  async attendreQue(expression, { delai = 20_000, quoi = expression } = {}) {
    const fin = Date.now() + delai;
    for (;;) {
      try {
        if (await this.eval(`Boolean(${expression})`)) return;
      } catch {
        /* page en cours de chargement */
      }
      if (Date.now() > fin) throw new Error(`Jamais vu à l'écran : ${quoi}`);
      await attendre(150);
    }
  }

  /** Attend qu'un texte soit affiché dans la page. */
  attendreTexte(texte, delai) {
    return this.attendreQue(`document.body && document.body.innerText.includes(${JSON.stringify(texte)})`, { delai, quoi: texte });
  }

  /**
   * Centre de l'élément visible le plus petit dont le texte vaut `texte`
   * (ou le contient, `contient`), parmi `selecteur`. Le plus petit : le
   * bouton plutôt que la barre qui le contient.
   */
  async centre(texte, { selecteur = "button, a, [role=button], [role=tab], [role=menuitem], [role=option], li, label, div, span, p, h1, h2, h3", contient = false } = {}) {
    const r = await this.eval(`(() => {
      const voulu = ${JSON.stringify(texte)};
      const els = [...document.querySelectorAll(${JSON.stringify(selecteur)})].filter((e) => {
        const t = (e.innerText || e.getAttribute("aria-label") || e.getAttribute("title") || "").trim();
        if (!(${contient} ? t.includes(voulu) : t === voulu)) return false;
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight;
      });
      els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
      const e = els[0];
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    })()`);
    if (!r) throw new Error(`Rien à cliquer : « ${texte} »`);
    return r;
  }

  async cliquerEn({ x, y }) {
    await this.envoyer("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await this.envoyer("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.envoyer("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }

  async cliquer(texte, options) {
    await this.cliquerEn(await this.centre(texte, options));
  }

  /** Clic sur le premier élément qui répond au sélecteur CSS. */
  async cliquerSelecteur(selecteur) {
    const r = await this.eval(`(() => {
      const e = document.querySelector(${enJs(selecteur)});
      if (!e) return null;
      e.scrollIntoView({ block: "nearest" });
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    })()`);
    if (!r) throw new Error(`Aucun élément : ${selecteur}`);
    await this.cliquerEn(r);
  }

  /** Pose des fichiers dans un `<input type=file>` (le premier qui répond au sélecteur). */
  async fichiers(selecteur, chemins) {
    const { root } = await this.envoyer("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await this.envoyer("DOM.querySelector", { nodeId: root.nodeId, selector: selecteur });
    if (!nodeId) throw new Error(`Aucun champ de fichier : ${selecteur}`);
    await this.envoyer("DOM.setFileInputFiles", { nodeId, files: chemins });
  }

  /** Fait défiler l'élément qui répond au sélecteur (ou la page) jusqu'à `haut` pixels. */
  async defiler(selecteur, haut) {
    await this.eval(`(() => { const e = ${selecteur ? `document.querySelector(${enJs(selecteur)})` : "document.scrollingElement"}; if (e) e.scrollTop = ${haut}; })()`);
  }

  /** Tape du texte comme un clavier (caractère par caractère, `pause` entre deux). */
  async taper(texte, pause = 0) {
    if (!pause) return this.envoyer("Input.insertText", { text: texte });
    for (const c of texte) {
      await this.envoyer("Input.insertText", { text: c });
      await attendre(pause);
    }
  }

  async touche(nom) {
    const codes = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8 };
    const base = { key: nom, code: nom, windowsVirtualKeyCode: codes[nom], nativeVirtualKeyCode: codes[nom] };
    await this.envoyer("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base, ...(nom === "Enter" ? { text: "\r" } : {}) });
    if (nom === "Enter") await this.envoyer("Input.dispatchKeyEvent", { type: "char", ...base, text: "\r" });
    await this.envoyer("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  }

  async capture({ densite = 2 } = {}) {
    const { data } = await this.envoyer("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      ...(densite === 1 ? { clip: { x: 0, y: 0, width: 1280, height: 800, scale: 0.5 } } : {}),
    });
    return Buffer.from(data, "base64");
  }

  /**
   * Remplace les réponses des requêtes dont l'adresse répond à `motif`
   * (expression régulière) par ce que rend `fabrique(url, reponseReelle, methode)`.
   *
   * `sansPasserelle: false` (le défaut) : la requête part, la passerelle
   * répond, `reponseReelle` est son corps (JSON lu) et la scène le complète ;
   * rendre `undefined` laisse passer la vraie réponse.
   * `sansPasserelle: true` : la requête ne part jamais, la scène répond seule
   * (`reponseReelle` vaut null).
   */
  async intercepter(motif, fabrique, { sansPasserelle = false } = {}) {
    this.interceptions.push({ motif, fabrique, sansPasserelle });
    if (this.interceptions.length > 1) return;
    this.sur("Fetch.requestPaused", async (p) => {
      const auStadeReponse = p.responseStatusCode !== undefined;
      const regle = this.interceptions.find((r) => r.motif.test(p.request.url) && r.sansPasserelle === !auStadeReponse);
      (this.requetes ??= []).push({ quoi: `[${auStadeReponse ? "réponse" : "requête"}${regle ? ", scène" : ""}] ${p.request.method} ${p.request.url.replace(/^.*\/api/, "")}`, statut: "intercepté" });
      try {
        if (!regle) {
          await this.envoyer("Fetch.continueRequest", { requestId: p.requestId });
          return;
        }
        let reelle = null;
        if (auStadeReponse) {
          try {
            const { body, base64Encoded } = await this.envoyer("Fetch.getResponseBody", { requestId: p.requestId });
            reelle = JSON.parse(base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body);
          } catch {
            reelle = null;
          }
        }
        const rendu = await regle.fabrique(p.request.url, reelle, p.request.method);
        if (rendu === undefined) {
          await this.envoyer("Fetch.continueRequest", { requestId: p.requestId });
          return;
        }
        await this.envoyer("Fetch.fulfillRequest", {
          requestId: p.requestId,
          responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body: Buffer.from(JSON.stringify(rendu)).toString("base64"),
        });
      } catch {
        await this.envoyer("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {});
      }
    });
  }

  /** Branche les interceptions posées : à appeler une fois, avant la navigation. */
  async activerInterceptions(motifs) {
    await this.envoyer("Fetch.enable", { patterns: motifs });
  }
}
