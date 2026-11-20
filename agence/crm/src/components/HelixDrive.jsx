import React, { useEffect, useState } from "react";
import { db } from "../store";
import { loadGoogle } from "./GoogleLogin.jsx";

const root = { id: "1yJ7sJrrPaDbrLPTKQNG-N_n3HvDcR_1y", name: "Helix" };
const actelyo = { id: "1htXBnWwDxNOqDjDmfw_ipa4rnzDj0aJa", name: "Actelyo" };
const actelyoFolders = [
  actelyo,
  { id: "1l-iRgTd_3rDVV9pfnr2lEuwYVIMSJDD8", name: "Présentation commerciale" },
  { id: "1YbRz7FbgWbd2vwMT_IzAGIO2xWzcz5f_", name: "TechnoDroit et salon" },
  { id: "1gvdEux09EPN2Goe4YguZG8pckh_iWpdb", name: "Stratégie et prospection" },
  { id: "1CUkLAS3h1YGUIK_B8yFrhilc7Df7gM5d", name: "Documentation du logiciel" },
];
const shortcuts = [
  root, ...actelyoFolders,
  { id: "1x8hS9NYoYOtlluJMNcO5PPAyZyRmsjHV", name: "Comptes rendus Helix" },
  { id: "19c9IpbJatJIiRpAI-s43lyOuEvGHY7Os", name: "Clients Helix" },
  { id: "1CqeNfxTaHZ4V8oGmndM7BN9WGotPru1H", name: "Livrables de prospection Helix" },
];
const folderType = "application/vnd.google-apps.folder";
const scope = "https://www.googleapis.com/auth/drive.metadata.readonly";

function isFolder(file) {
  return (file.shortcutDetails?.targetMimeType || file.mimeType) === folderType;
}

function targetId(file) {
  return file.shortcutDetails?.targetId || file.id;
}

export function HelixDrive({ actelyoOnly = false }) {
  const [clientId, setClientId] = useState("");
  const [credential, setCredential] = useState(null);
  const [path, setPath] = useState([actelyoOnly ? actelyo : root]);
  const [page, setPage] = useState({ files: [] });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const folder = path.at(-1);

  useEffect(() => {
    let active = true;
    if (typeof db?.auth.googleChallenge === "function") {
      Promise.all([db.auth.googleChallenge(), loadGoogle()]).then(([result]) => {
        if (result.error || !result.clientId) throw new Error("Connexion Google indisponible.");
        if (active) setClientId(result.clientId);
      }).catch(error => { if (active) setError(error.message); });
    }
    return () => { active = false; };
  }, []);

  function connect() {
    setError("");
    const oauth = window.google.accounts.oauth2;
    oauth.initTokenClient({
      client_id: clientId,
      scope,
      include_granted_scopes: false,
      callback: response => {
        if (response.error || !oauth.hasGrantedAllScopes(response, scope)) {
          setError("L’accès en lecture aux métadonnées Drive n’a pas été autorisé.");
          return;
        }
        setCredential({ token: response.access_token, expires: Date.now() + Number(response.expires_in) * 1000 });
      },
      error_callback: () => setError("La connexion Drive a été interrompue."),
    }).requestAccessToken();
  }

  async function list(signal, nextPage) {
    if (credential.expires <= Date.now()) {
      setBusy(false);
      setCredential(null);
      setError("La session Drive a expiré. Reconnecte Google Drive.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: "nextPageToken,files(id,name,mimeType,shortcutDetails(targetId,targetMimeType))",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        orderBy: "folder,name_natural",
        pageSize: "100",
      });
      if (search) {
        const term = search.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
        params.set("q", params.get("q") + ` and name contains '${term}'`);
      }
      if (nextPage) params.set("pageToken", nextPage);
      const response = await fetch("https://www.googleapis.com/drive/v3/files?" + params, {
        headers: { Authorization: "Bearer " + credential.token },
        signal,
      });
      if (response.status === 401 && !signal.aborted) {
        setCredential(null);
        throw new Error("Reconnecte Google Drive pour continuer.");
      }
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        if (details?.error?.errors?.some(entry => entry.reason === "accessNotConfigured")) {
          throw new Error("L’API Google Drive doit être activée dans le projet Google Cloud Helix CRM.");
        }
        throw new Error("Impossible de charger ce dossier. Vérifie les droits de ton compte Google.");
      }
      const result = await response.json();
      if (!signal.aborted) setPage(previous => ({
        files: nextPage ? [...previous.files, ...(result.files || [])] : result.files || [],
        next: result.nextPageToken,
      }));
    } catch (error) {
      if (!signal.aborted) setError(error.message);
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  const listing = React.useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    listing.current = controller;
    setPage({ files: [] });
    setPreview(null);
    if (credential) list(controller.signal);
    return () => controller.abort();
  }, [folder.id, credential, search]);

  function navigate(nextPath) {
    setQuery("");
    setSearch("");
    setPath(nextPath);
  }

  return <section className="panel team-tools">
    <h2>{actelyoOnly ? "Dossiers Drive Actelyo" : "Drive Helix"}</h2>
    <nav className="connection-buttons" aria-label="Accès rapides Drive">
      {(actelyoOnly ? actelyoFolders : shortcuts).map(item => <button type="button" className="secondary"
        key={item.id} aria-pressed={folder.id === item.id} onClick={() => navigate([item])}>{item.name}</button>)}
    </nav>
    <a className="secondary" href={`https://drive.google.com/drive/folders/${folder.id}`} target="_blank" rel="noreferrer">Ouvrir dans Drive</a>
    {!credential && clientId && <button type="button" className="secondary" onClick={connect}>Connecter Google Drive</button>}
    {error && <p role="alert">{error}</p>}
    {credential && <>
      <nav aria-label="Dossiers Drive">
        {path.map((item, index) => <button key={index + ":" + item.id} type="button" className="secondary"
          disabled={index === path.length - 1} onClick={() => navigate(path.slice(0, index + 1))}>{item.name}</button>)}
      </nav>
      <label>Rechercher dans ce dossier
        <input type="search" value={query} onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            setSearch(query.trim());
          }} />
      </label>
      <button type="button" className="secondary" onClick={() => setSearch(query.trim())}>Rechercher</button>
      {search && <button type="button" className="secondary" onClick={() => { setQuery(""); setSearch(""); }}>Effacer</button>}
      {busy && <p role="status">Chargement du dossier…</p>}
      {!busy && !error && !page.files.length && <p>{search ? "Aucun résultat dans ce dossier." : "Ce dossier est vide."}</p>}
      {page.files.map(file => <div className="team-row" key={file.id}>
        <div>{file.name}</div>
        {isFolder(file) ? <button type="button" className="secondary"
          onClick={() => navigate([...path, { name: file.name, id: targetId(file) }])}>Parcourir</button> :
          <button type="button" className="secondary" onClick={() => setPreview(file)}>Aperçu</button>}
      </div>)}
      {page.next && <button type="button" className="secondary" disabled={busy}
        onClick={() => list(listing.current.signal, page.next)}>Afficher la suite</button>}
      {preview && <div>
        <button type="button" className="secondary" onClick={() => setPreview(null)}>Fermer l’aperçu</button>
        <a className="secondary" target="_blank" rel="noreferrer"
          href={`https://drive.google.com/open?id=${encodeURIComponent(targetId(preview))}`}>Ouvrir le fichier</a>
        <iframe title={preview.name} src={`https://drive.google.com/file/d/${encodeURIComponent(targetId(preview))}/preview`}
          style={{ width: "100%", height: "min(65vh, 650px)", border: 0 }} />
      </div>}
    </>}
  </section>;
}
