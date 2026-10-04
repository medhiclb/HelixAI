/**
 * Pont entre l'interface et le système, réduit au strict nécessaire.
 *
 * L'isolation de contexte est active : la page n'a aucun accès à Node. Ce
 * fichier ouvre trois portes. La première : demander au système d'afficher
 * son sélecteur de dossier. La page ne peut pas choisir le dossier à sa place,
 * ni lire quoi que ce soit ; elle déclenche une fenêtre que la personne remplit
 * elle-même, et récupère le chemin qu'elle a désigné.
 *
 * Tout ce qui touche aux fichiers continue de passer par la passerelle, qui
 * vérifie. Ce pont ne contourne rien.
 */

const { contextBridge, ipcRenderer } = require("electron");

/*
 * La seconde : l'état de la mise à jour de l'application (electron/miseAJour.cjs).
 * La page lit un état, demande une vérification, ou l'installation d'une
 * version déjà téléchargée et vérifiée. Elle ne fournit ni adresse ni fichier :
 * le flux vient du paquet, le lien de téléchargement aussi.
 */
/*
 * Coffre des secrets (electron/coffre.cjs).
 *
 * Lu **ici**, une fois, avant le premier script de la page : l'interface a
 * besoin de son jeton de séance au moment même où elle construit l'adresse de
 * la passerelle, c'est-à-dire avant d'avoir pu attendre quoi que ce soit. Un
 * seul aller-retour synchrone au démarrage ; ensuite, les écritures sont
 * asynchrones. Le rendu ne voit jamais le fichier ni la clé : seulement les
 * valeurs qu'il y a lui-même rangées.
 */
const coffreInitial = (() => {
  try {
    return ipcRenderer.sendSync("helix:coffre-initial");
  } catch {
    return { disponible: false, valeurs: {} };
  }
})();

/*
 * Un processus principal d'une version antérieure (application reconstruite
 * pendant qu'elle tournait) n'a pas ce canal : pas de réponse, pas de grand
 * stockage, et l'interface garde le stockage du navigateur.
 */
const grandInitial = (() => {
  try {
    const r = ipcRenderer.sendSync("helix:grand-initial");
    return r && typeof r === "object" ? r : { disponible: false, cles: [], valeurs: {} };
  } catch {
    return { disponible: false, cles: [], valeurs: {} };
  }
})();

contextBridge.exposeInMainWorld("helix", {
  /** La langue de l'écran, pour les textes de l'application elle-même (zone de notification, menu). */
  langue: (code) => ipcRenderer.send("helix:langue", String(code)),
  /** Le système du poste (`darwin`, `win32`, `linux`) : l'écran dit ce qui vaut ici. */
  plateforme: process.platform,
  /** Le processeur (`arm64`, `x64`) : « Signaler un problème » distingue ainsi un Mac Apple silicon d'un Mac Intel (27/09/2026). */
  architecture: process.arch,
  /**
   * Ouvre le sélecteur de dossier du système. Renvoie le chemin, ou null.
   * `options` (titre, message, bouton), déjà traduits par l'écran : sans eux,
   * ceux du dossier de travail (l'emplacement des modèles a les siens, 28/09/2026).
   */
  choisirDossier: (options) => ipcRenderer.invoke("helix:choisir-dossier", options),
  /**
   * Copier du texte (electron/pressePapiers.cjs, 27/09/2026) : la permission
   * du presse-papiers est refusée à la page, les boutons « Copier » passent
   * donc par ici. Écrire seulement, jamais lire ; `vider` n'efface que la
   * dernière copie faite par Helix, si elle y est encore.
   */
  pressePapiers: {
    ecrire: (texte) => ipcRenderer.invoke("helix:presse-papiers-ecrire", texte),
    vider: (texte) => ipcRenderer.invoke("helix:presse-papiers-vider", texte),
  },
  /**
   * Relance la passerelle de cette machine. Sert quand l'instance vient d'être
   * ouverte aux collègues : l'adresse d'écoute se choisit au démarrage.
   */
  redemarrerPasserelle: () => ipcRenderer.invoke("helix:passerelle-redemarrer"),
  /** La ligne de commande `helix` : état, pose du lanceur dans ~/.local/bin (helix.cmd dans ~\.helix\bin sous Windows), retrait. */
  ligneDeCommande: {
    etat: () => ipcRenderer.invoke("helix:cli-etat"),
    installer: () => ipcRenderer.invoke("helix:cli-installer"),
    retirer: () => ipcRenderer.invoke("helix:cli-retirer"),
  },
  coffre: {
    /** Le système sait-il chiffrer ? Sinon l'interface garde son repli. */
    disponible: coffreInitial.disponible === true,
    /** Valeurs présentes au démarrage. Copie figée, jamais relue du disque. */
    valeurs: coffreInitial.valeurs ?? {},
    /**
     * Préférences de l'ancienne origine `file://`, à appliquer une seule fois
     * (electron/reprise.cjs). Vide ensuite, et pour toujours.
     */
    reprise: coffreInitial.reprise ?? {},
    poser: (cle, valeur) => ipcRenderer.invoke("helix:coffre-poser", cle, valeur),
    vider: () => ipcRenderer.invoke("helix:coffre-vider"),
  },
  /** Grand stockage des Chats (electron/grandStockage.cjs), sans la limite du navigateur. */
  grand: {
    disponible: grandInitial.disponible === true,
    cles: grandInitial.cles ?? [],
    valeurs: grandInitial.valeurs ?? {},
    illisibles: Array.isArray(grandInitial.illisibles) ? grandInitial.illisibles : [],
    /** Fichiers trouvés illisibles pendant cette séance : pourquoi, et où la copie a été gardée (bandeau de l'interface). */
    incidents: grandInitial.incidents && typeof grandInitial.incidents === "object" ? grandInitial.incidents : {},
    poser: (cle, valeur) => ipcRenderer.invoke("helix:grand-poser", cle, valeur),
    /** L'instance a rendu cette collection : le processus principal cesse de la tenir pour illisible. */
    relu: (cle) => ipcRenderer.invoke("helix:grand-relu", cle),
  },
  miseAJour: {
    etat: () => ipcRenderer.invoke("helix:maj-etat"),
    verifier: () => ipcRenderer.invoke("helix:maj-verifier"),
    installer: () => ipcRenderer.invoke("helix:maj-installer"),
    ouvrirPaquet: () => ipcRenderer.invoke("helix:maj-ouvrir-paquet"),
    /** Abonnement aux changements ; renvoie la fonction de désabonnement. */
    surChangement: (rappel) => {
      const ecouteur = (_evenement, etat) => rappel(etat);
      ipcRenderer.on("helix:maj-etat", ecouteur);
      return () => ipcRenderer.removeListener("helix:maj-etat", ecouteur);
    },
  },
  /*
   * La troisième : le bot de réunion (electron/botReunion.cjs). La page
   * désigne une réunion Google Meet et confie l'adresse de l'instance et sa
   * séance, pour que le son parte au bon endroit ; le processus principal
   * vérifie le lien et n'ouvre que Google Meet.
   */
  /**
   * Invitation arrivée par lien `helix://rejoindre` : le collègue a cliqué
   * dans son mail, le système a réveillé l'application, et l'écran de
   * rattachement se remplit tout seul. Le rappel peut arriver avant que la
   * page soit prête : le processus principal garde alors le lien et le
   * redonne à l'abonnement.
   */
  surInvitation: (rappel) => {
    const ecouteur = (_evenement, invitation) => rappel(invitation);
    ipcRenderer.on("helix:invitation", ecouteur);
    ipcRenderer.send("helix:invitation-prete");
    return () => ipcRenderer.removeListener("helix:invitation", ecouteur);
  },
  bot: {
    envoyer: (demande) => ipcRenderer.invoke("helix:bot-envoyer", demande),
    arreter: (reunionId) => ipcRenderer.invoke("helix:bot-arreter", reunionId),
    afficher: (reunionId) => ipcRenderer.invoke("helix:bot-afficher", reunionId),
    liste: () => ipcRenderer.invoke("helix:bot-liste"),
    automatique: (autorisation) => ipcRenderer.invoke("helix:bot-auto", autorisation),
    compte: (action) => ipcRenderer.invoke("helix:bot-compte", action),
    surChangement: (rappel) => {
      const ecouteur = (_evenement, bots) => rappel(bots);
      ipcRenderer.on("helix:bot-etat", ecouteur);
      return () => ipcRenderer.removeListener("helix:bot-etat", ecouteur);
    },
  },
});
