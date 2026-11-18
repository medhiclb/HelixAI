import { CrmSidebar } from "./components/CrmSidebar.jsx";
import { CrmPageHeader } from "./components/CrmPageHeader.jsx";
import { GoogleLogin } from "./components/GoogleLogin.jsx";
import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Building2,
  Users,
  Kanban,
  CheckCheck,
  CalendarDays,
  NotebookPen,
  FileCheck2,
  FolderOpen,
  Plug,
  Plus,
  Search,
  ArrowUpRight,
  ChevronRight,
  X,
  LogOut,
  Download,
  Mail,
  Phone,
  Check,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  ArrowRight,
  Target,
} from "lucide-react";
import { branding } from "./branding.mjs";
import { HelixChat } from "./components/HelixChat";
import { demoMode, nativePostgres, db, readAll, saveRecord, deleteRecord, saveNoteWithFollowup } from "./store";
import {
  blank,
  stages,
  isOverdue,
  pipelineTotal,
  exportCsv,
} from "./domain.mjs";
import "./style.css";
import Brand from "./components/Brand";
import Planning from "./components/Planning";
import Mailbox, { Compose } from "./components/Mailbox";
import Connections from "./components/Connections";
import MeetingActions from "./components/MeetingActions";
import {SalesWorkspace} from "./components/SalesWorkspace";
import {Documents,Activity,Notifications,ExternalCalendars} from "./components/TeamTools";
import { localInput, scheduleItems, conflicts } from "./planning.mjs";
document.title = branding.name;

const pages = [
  ["dashboard", "Vue d’ensemble", LayoutDashboard],
  ["cabinets", "Entreprises", Building2],
  ["contacts", "Contacts", Users],
  ["opportunities", "Pipeline", Kanban],
  ["tasks", "Relances & tâches", CheckCheck],
  ["planning", "Planning commun", CalendarDays],
  ["meetings", "Rendez-vous", CalendarDays],
  ["mailbox", "Messagerie", Mail],
  ["events", "Événements", Target],
  ["notes", "Débriefs & notes", NotebookPen],
  ["proposals", "Propositions", FileCheck2],
  ["ai", branding.ai, NotebookPen],
  ["documents", "Documents", FolderOpen],
  ["history", "Historique", CheckCheck],
  ["team", "Équipe", Users],
  ["settings", "Connexions", Plug],
];
const schemas = {
  cabinets: [
    ["name", "Nom de l’entreprise", "text", true],
    ["city", "Ville"],
    ["specialty", "Secteur"],
    ["website", "Site internet", "url"],
    ["email", "Email", "email"],
    ["phone", "Téléphone", "tel"],
    ["size", "Effectif", "number"],
    ["source", "Origine du contact"],
    ["owner", "Responsable", "member"],
    ["description", "Informations", "textarea"],
  ],
  contacts: [
    ["name", "Nom complet", "text", true],
    ["cabinet_id", "Entreprise", "cabinet"],
    ["role", "Fonction"],
    ["email", "Email", "email"],
    ["phone", "Téléphone", "tel"],
    ["owner", "Responsable", "member"],
  ],
  opportunities: [
    ["name", "Opportunité", "text", true],
    ["cabinet_id", "Entreprise", "cabinet"],
    ["stage", "Étape", "stage"],
    ["amount", "Montant annuel (€)", "number"],
    ["close_at", "Signature prévue", "date"],
    ["owner", "Responsable", "member"],
    ["description", "Contexte", "textarea"],
  ],
  tasks: [
    ["name", "Action à réaliser", "text", true],
    ["cabinet_id", "Entreprise", "cabinet"],
    ["owner", "Responsable", "member"],
    ["due_at", "Échéance", "datetime-local", true],
    ["priority", "Priorité", "priority"],
    ["description", "Détails", "textarea"],
  ],
  meetings: [
    ["name", "Objet du rendez-vous", "text", true],
    ["cabinet_id", "Entreprise", "cabinet"],
    ["owner", "Organisateur", "member"],
    ["attendees", "Participants (emails séparés par des virgules)"],
    ["starts_at", "Début", "datetime-local", true],
    ["ends_at", "Fin", "datetime-local", true],
    ["location", "Lieu ou lien de visioconférence"],
    ["status", "Statut", "status"],
    ["description", "Ordre du jour", "textarea"],
  ],
  events: [
    ["name", "Nom de l’événement", "text", true],
    ["starts_at", "Début", "datetime-local", true],
    ["ends_at", "Fin", "datetime-local"],
    ["location", "Lieu"],
    ["owner", "Responsable", "member"],
    ["description", "Objectifs et participants", "textarea"],
  ],
  notes: [
    ["name", "Titre du débrief", "text", true],
    ["cabinet_id", "Entreprise", "cabinet"],
    ["meeting_id", "Rendez-vous", "meeting"],
    ["owner", "Auteur", "member"],
    ["description", "Compte rendu", "textarea", true],
    ["needs", "Besoins identifiés", "textarea"],
    ["objections", "Objections / points à éclaircir", "textarea"],
    ["next_step", "Prochaine étape"],
    ["due_at", "Date de suivi", "datetime-local"],
  ],
};
const money = (n) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n || 0);
const date = (x, time = false) =>
  x
    ? new Date(x).toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
      })
    : "·";
function App() {
  const [page, setPage] = useState("dashboard"),
    [data, setData] = useState(blank()),
    [query, setQuery] = useState(""),
    [owner, setOwner] = useState(""),
    [modal, setModal] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [session, setSession] = useState(null),
    [workspace, setWorkspace] = useState(null),
    [members, setMembers] = useState([]),
    [email, setEmail] = useState(""),
    [connections, setConnections] = useState([]),
    [notice, setNotice] = useState("");
  const [busySlots, setBusySlots] = useState([]),
    [health, setHealth] = useState(null),
    [compose, setCompose] = useState(null),
    [spaces, setSpaces] = useState([]),
    [syncing, setSyncing] = useState(false);
  const exchangingPostgresLink = useRef(nativePostgres && new URLSearchParams(location.hash.slice(1)).has("crm_access"));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeWorkspace = useRef(workspace);
  activeWorkspace.current = workspace;
  useEffect(() => {
    const loginParams = new URLSearchParams(location.search);
    const loginHash = nativePostgres
      ? new URLSearchParams(location.hash.slice(1)).get("crm_access")
      : loginParams.get("token_hash");
    if (loginHash && db) {
      history.replaceState(null, "", location.pathname);
      db.auth.verifyOtp({token_hash: loginHash, type: "email"}).then(({error})=>{
        if(error) setError("Ce lien de connexion est expiré ou déjà utilisé. Demandez un nouveau lien.");
      }).catch(()=>setError("La connexion n’a pas pu être vérifiée. Demandez un nouveau lien."));
    }
    if (!demoMode) fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then(setHealth)
      .catch(() => setHealth(null));
    const params = new URLSearchParams(location.search);
    if (params.has("connected")) {
      setPage("settings");
      setNotice("Compte connecté. La première synchronisation va démarrer.");
      history.replaceState(null, "", location.pathname);
    }
    if (params.get("connection") === "cancelled") {
      setPage("settings");
      setNotice(
        "Connexion annulée. Vous pouvez la relancer quand vous le souhaitez."
      );
    }
  }, []);
  useEffect(() => {
    if (!db) {
      readAll().then(setData);
      return;
    }
    if (!exchangingPostgresLink.current) db.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setWorkspace(null);
      setData(blank());
      setConnections([]);
      setMembers([]);
      setBusySlots([]);
      return;
    }
    (async () => {
      const { error: joinError } = await db.rpc("crm_join_invitations");
      if (joinError)
        throw Error("La base doit être mise à jour : " + joinError.message);
      let { data: m, error: e } = await db
        .from("crm_members")
        .select("workspace_id,crm_workspaces(name)")
        .eq("user_id", session.user.id);
      if (e) throw e;
      if (!m?.length) {
        const { data: id, error } = await db.rpc("crm_create_workspace", {
          workspace_name: branding.name,
        });
        if (error) throw error;
        m = [{ workspace_id: id, crm_workspaces: { name: branding.name } }];
      }
      setSpaces(m);
      const remembered = localStorage.getItem(
        "crm-workspace-" + session.user.id
      );
      const selected =
        m.find((x) => x.workspace_id === remembered) || m[m.length - 1];
      setWorkspace(selected.workspace_id);
    })().catch((e) => setError(e.message));
  }, [session]);
  useEffect(() => {
    if (!workspace) return;
    setData(blank());
    setMembers([]);
    setConnections([]);
    setBusySlots([]);
    refresh();
    loadMembers();
    loadConnections();
    const channel = nativePostgres ? null : db.channel("crm-live").on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "crm_records",
        filter: `workspace_id=eq.${workspace}`,
      },
      () => refresh()
    );
    channel?.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "crm_busy_slots",
        filter: `workspace_id=eq.${workspace}`,
      },
      () => loadBusySlots()
    );
    channel?.on("postgres_changes",{event:"*",schema:"public",table:"crm_members",filter:`workspace_id=eq.${workspace}`},()=>loadMembers());
    channel?.subscribe();
    loadBusySlots();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
        loadBusySlots();
        loadMembers();
      }
    }, 60000);
    return () => {
      if (channel) db.removeChannel(channel);
      clearInterval(poll);
    };
  }, [workspace]);
  async function loadMembers() {
    if(!db || !workspace)return;
    const {data,error}=await db.from("crm_members").select("*").eq("workspace_id",workspace);
    if(activeWorkspace.current===workspace) {
      if(error)setError(error.message);else setMembers(data || []);
    }
  }
  async function refresh() {
    try {
      const records = await readAll(workspace);
      if (activeWorkspace.current === workspace) setData(records);
    } catch (e) {
      setError(e.message);
    }
  }
  async function api(path, body) {
    if (nativePostgres) throw Error("Cette intégration n’est pas encore disponible sur PostgreSQL.");
    if (!db || !workspace)
      throw Error(
        "Activez la base partagée et connectez-vous pour utiliser cette fonction."
      );
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) throw Error("Votre session a expiré. Reconnectez-vous.");
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.session.access_token}`,
      },
      body: JSON.stringify({ ...body, workspace_id: workspace }),
    });
    let result;
    try {
      result = await res.json();
    } catch {
      throw Error(
        "Le serveur ne répond pas correctement. Vérifiez le déploiement et votre connexion."
      );
    }
    if (!res.ok) throw Error(result.error || "Échec de la requête");
    return result;
  }
  async function loadConnections() {
    try {
      const { data, error } = await db
        .from("crm_connections")
        .select(
          "id,provider,email,last_sync_at,calendar_id,share_emails,sync_error,capabilities,next_sync_at"
        )
        .eq("workspace_id", workspace)
        .eq("user_id", session.user.id);
      if (error) throw error;
      if (activeWorkspace.current === workspace) setConnections(data || []);
    } catch (e) {
      setError(e.message);
    }
  }
  async function loadBusySlots() {
    if (!db || !workspace) return;
    const { data, error } = await db
      .from("crm_busy_slots")
      .select("*")
      .eq("workspace_id", workspace);
    if (error) {
      setError(error.message);
      return;
    }
    const external=await db.from("crm_external_slots").select("*").eq("workspace_id",workspace);
    if(external.error)setError(external.error.message);
    if (activeWorkspace.current === workspace) setBusySlots([...(data || []),...(external.data||[])]);
  }
  useEffect(()=>{if(!db||!workspace||nativePostgres)return;let stopped=false,running=false;const sync=async()=>{if(stopped||running||document.visibilityState!=="visible")return;running=true;try{const r=await api("/api/team",{action:"calendar_sync_due"});if(r.results?.some(x=>!x.ok))setNotice("Un agenda externe n’a pas pu être synchronisé. Vérifiez Connexions.");if(!stopped)await loadBusySlots();}catch(e){if(!stopped)setNotice(e.message);}finally{running=false;}};const first=setTimeout(sync,3000),timer=setInterval(sync,300000);return()=>{stopped=true;clearTimeout(first);clearInterval(timer);};},[workspace]);
  const connectionKey = connections.map((c) => c.id).join(",");
  useEffect(() => {
    if (!workspace || !connectionKey) return;
    let stopped = false,
      running = false;
    async function sync() {
      if (stopped || running || document.visibilityState === "hidden") return;
      running = true;
      setSyncing(true);
      try {
        for (const c of connections) {
          if (stopped) break;
          try {
            await api("/api/sync", { provider: c.provider });
          } catch (e) {
            if (!stopped) setNotice("Synchronisation : " + e.message);
          }
        }
        if (!stopped) {
          await loadConnections();
          await refresh();
          await loadBusySlots();
        }
      } finally {
        running = false;
        if (!stopped) setSyncing(false);
      }
    }
    const start = setTimeout(sync, 1500),
      timer = setInterval(sync, 60000);
    return () => {
      stopped = true;
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [workspace, connectionKey]);
  async function persist(entity, record) {
    setBusy(true);
    setError("");
    try {
      if (entity === "meetings" && (!record.starts_at || !record.ends_at))
        throw Error("Indiquez le début et la fin du rendez-vous.");
      if (entity === "tasks" && !record.due_at)
        throw Error("Indiquez une échéance pour la relance.");
      if (
        record.ends_at &&
        new Date(record.ends_at) <= new Date(record.starts_at)
      )
        throw Error("La fin doit être après le début.");
      const normalized = { ...record };
      if (entity === "notes" && record.next_step && record.due_at)
        normalized.follow_up_id = record.follow_up_id || crypto.randomUUID();
      if (entity === "meetings" && record.calendar_linked)
        normalized.calendar_dirty = true;
      for (const key of ["starts_at", "ends_at", "due_at"])
        if (normalized[key])
          normalized[key] = new Date(normalized[key]).toISOString();
      if (record.calendar_linked && record.owner !== session?.user.id)
        throw Error(
          "Seul l’organisateur peut modifier un rendez-vous lié à son agenda."
        );
      if (
        record.calendar_linked &&
        record.status === "Annulé" &&
        data.meetings.find((x) => x.id === record.id)?.status !== "Annulé"
      )
        throw Error(
          "Utilisez « Annuler dans l’agenda » pour annuler ce rendez-vous et notifier les participants."
        );
      if (entity === "notes" && record.next_step && record.due_at) {
        const noteId=normalized.id || crypto.randomUUID();
        await saveNoteWithFollowup({...normalized,id:noteId},{
          ...(data.tasks.find(t=>t.id===normalized.follow_up_id) || {}),
          id:normalized.follow_up_id,name:record.next_step,cabinet_id:record.cabinet_id,
          owner:record.owner,due_at:normalized.due_at,priority:"Normale",note_id:noteId,
        },workspace);
      } else await saveRecord(entity,normalized,workspace);
      await refresh();
      setModal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(entity, record) {
    if (record.calendar_linked && record.status !== "Annulé") {
      setError(
        "Annulez d’abord le rendez-vous dans votre agenda avant de supprimer la fiche CRM."
      );
      return;
    }
    if (!confirm(`Supprimer « ${record.name} » ?`)) return;
    try {
      await deleteRecord(entity, record.id, workspace, record._revision);
      await refresh();
      setModal(null);
    } catch (e) {
      setError(e.message);
    }
  }
  const cabinet = (id) =>
    data.cabinets.find((c) => c.id === id)?.name || "Sans entreprise";
  const member = (id) =>
    members.find((m) => m.user_id === id)?.display_name || id || "Non attribué";
  const filtered = (entity) =>
    data[entity].filter(
      (x) =>
        (!owner || x.owner === owner) &&
        (!query ||
          [
            x.name,
            x.email,
            x.city,
            x.description,
            cabinet(x.cabinet_id),
            member(x.owner),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()))
    );
  const pending = data.tasks
    .filter((x) => !x.done)
    .sort((a, b) => (a.due_at || "z").localeCompare(b.due_at || "z"));
  const upcoming = data.meetings
    .filter((x) => x.status !== "Annulé" && new Date(x.starts_at) >= new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const add = (
    entity = schemas[page]
      ? page
      : ["planning", "meetings"].includes(page)
      ? "meetings"
      : "cabinets"
  ) =>
    setModal({
      entity,
      record: {
        stage: stages[0],
        priority: "Normale",
        status: "Prévu",
        owner: session?.user.id || "",
      },
    });
  const edit = (entity, record) => {
    const value = { ...record };
    for (const key of ["starts_at", "ends_at", "due_at"])
      if (value[key]) value[key] = localInput(value[key]);
    setModal({ entity, record: value });
  };
  function download(entity) {
    const blob = new Blob([exportCsv(data[entity])], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helix-${entity}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function TaskRow({ task }) {
    return (
      <div className="task-row">
        <button
          className="tick"
          aria-label="Terminer la tâche"
          onClick={() => persist("tasks", { ...task, done: !task.done })}
        >
          {task.done && <Check size={13} />}
        </button>
        <button
          className="text-button grow"
          onClick={() => edit("tasks", task)}
        >
          <strong>{task.name}</strong>
          <small>
            {cabinet(task.cabinet_id)} · {member(task.owner)}
          </small>
        </button>
        <span className={isOverdue(task) ? "badge red" : "badge"}>
          {date(task.due_at)}
        </span>
      </div>
    );
  }
  function MeetingCard({ meeting }) {
    return (
      <button
        className="meeting-card"
        onClick={() => edit("meetings", meeting)}
      >
        <div className="date-block">
          <b>{new Date(meeting.starts_at).getDate()}</b>
          <span>
            {new Date(meeting.starts_at).toLocaleDateString("fr-FR", {
              month: "short",
            })}
          </span>
        </div>
        <div className="grow">
          <strong>{meeting.name}</strong>
          <small>{cabinet(meeting.cabinet_id)}</small>
          <small>
            {date(meeting.starts_at, true)} · {member(meeting.owner)}
          </small>
        </div>
        <ChevronRight size={16} />
      </button>
    );
  }
  function Empty({ entity, text = "Votre prochaine relation commence ici." }) {
    return (
      <div className="empty">
        <Building2 size={28} />
        <h3>Aucun élément pour le moment</h3>
        <p>{text}</p>
        {entity && (
          <button className="primary" onClick={() => add(entity)}>
            <Plus size={15} />
            Créer le premier élément
          </button>
        )}
      </div>
    );
  }
  if (db && session && !workspace)
    return (
      <div className="login">
        <section className="login-card">
          <h1>Ouverture de votre espace</h1>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button className="secondary" onClick={() => db.auth.signOut()}>
                Se déconnecter
              </button>
            </>
          ) : (
            <p>Vérification de vos accès et de votre équipe…</p>
          )}
        </section>
      </div>
    );
  if (!db && import.meta.env.PROD && !demoMode) {
    return <main className="auth-screen"><section className="panel"><Brand/><h1>Configuration en cours</h1><p>La connexion à l’espace privé est en cours de configuration.</p><a className="primary" href="/demo">Explorer le CRM</a></section></main>;
  }

  if (db && !session)
    return (
      <div className="login">
        <div className="login-card">
          <Brand onClick={()=>setPage("dashboard")}/>
          <p className="eyebrow">RELATIONS ENTREPRISES</p>
          <h1>
            Chaque relation
            <br />
            mérite un suivi.
          </h1>
          <p>Connectez-vous à l’espace commun de l’équipe Helix. L’accès est réservé aux adresses autorisées.</p>
          {nativePostgres && <GoogleLogin auth={db.auth} onError={setError} />}
          {(!nativePostgres || import.meta.env.VITE_CRM_EMAIL_LOGIN === "true") && <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);setError("");setNotice("");
              try {
                const { error } = await db.auth.signInWithOtp({email, options:{emailRedirectTo:window.location.origin}});
                if (error) throw error;
                setNotice("Votre lien de connexion a été envoyé.");
              } catch(e){setError(e.message);} finally {setBusy(false);}

            }}
          >
            <label>
              Email professionnel
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Envoi en cours…" : "Recevoir mon lien de connexion"} <ArrowRight size={16} />
            </button>
          </form>}
          <p><a href="/demo">Explorer la démo</a></p>
          {error && <p role="alert">{error}</p>}
          {notice && <p>{notice}</p>}
        </div>
      </div>
    );
  const [, pageTitle, PageIcon] = pages.find(([id]) => id === page) || pages[0];
  return (
    <div className={`app crm-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <CrmSidebar pages={pages} page={page} collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(value => !value)}
        onNavigate={id => { setPage(id); setQuery(""); }}
        onCreate={() => setModal({ entity: "cabinets", record: { owner: session?.user.id || "" } })}
        pending={pending.length} email={session?.user.email}
        onLogout={session ? () => db.auth.signOut() : undefined}/>
      <div className="main">
        <header>
          <div className="breadcrumb">
            <strong>{pages.find((x) => x[0] === page)?.[1]}</strong>
          </div>
          <div className="header-right">
            {db&&workspace&&<Notifications workspace={workspace} onOpen={id=>{for(const [entity,rows] of Object.entries(data)){const record=rows.find(r=>r.id===id);if(record){setPage(entity);edit(entity,record);break;}}}}/>}
            <span className="live-dot" />
            {syncing
              ? "Synchronisation…"
              : db
              ? "Espace partagé"
              : demoMode ? "Démo" : "Mode local"}
          </div>
        </header>
        <main>
          {!db && (
            <div className="local-banner">
              {demoMode
                ? "Aperçu avec des données fictives. Les modifications restent dans ce navigateur."
                : "Mode local. Les données restent sur cet appareil."}
              {demoMode && <> <a href="/">Accès privé</a></>}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")}>
                <X size={15} />
              </button>
            </div>
          )}
          <CrmPageHeader icon={PageIcon} title={page === "dashboard" ? "Tableau de bord" : pageTitle}
            subtitle={page === "dashboard" ? "Suivi commercial de l’agence" : undefined}>
            <button
              hidden={["ai","proposals","documents","history","settings","team"].includes(page)}
              className="primary"
              onClick={() => (page === "mailbox" ? setCompose({}) : add())}
            >
              <Plus size={16} />
              {page === "mailbox"
                ? "Nouveau message"
                : page === "planning"
                ? "Nouveau rendez-vous"
                : page === "dashboard"
                ? "Nouvelle entreprise"
                : "Ajouter"}
            </button>
          </CrmPageHeader>
          {page === "ai" ? <HelixChat api={api} data={data}/> : page === "proposals" ? <SalesWorkspace workspace={workspace} data={data} userId={session?.user.id} onSaved={refresh}/> : page === "documents" ? <Documents workspace={workspace} api={api} data={data}/> : page === "history" ? <Activity workspace={workspace} members={members}/> : page === "planning" ? (
            <Planning
              data={data}
              busy={busySlots}
              members={members}
              onEdit={edit}
              onCreate={(record) =>
                setModal({
                  entity: "meetings",
                  record: {
                    owner: session?.user.id || "",
                    status: "Prévu",
                    ...record,
                  },
                })
              }
            />
          ) : page === "mailbox" ? (
            <Mailbox
              key={workspace}
              workspace={workspace}
              session={session}
              connections={connections}
              api={api}
              cabinets={data.cabinets}
              members={members}
              onNotice={setNotice}
              onCompose={setCompose}
            />
          ) : page === "dashboard" ? (
            <>
              <div className="stats">
                {[
                  [
                    "Entreprises suivies",
                    data.cabinets.length,
                    "Votre portefeuille de relations",
                    Building2,
                  ],
                  [
                    "Pipeline en cours",
                    money(pipelineTotal(data.opportunities)),
                    "Valeur annuelle des opportunités",
                    Kanban,
                  ],
                  [
                    "Relances à faire",
                    pending.length,
                    `${pending.filter((t) => isOverdue(t)).length} en retard`,
                    CheckCheck,
                  ],
                  [
                    "Prochains rendez-vous",
                    upcoming.length,
                    "Les échanges à venir",
                    CalendarDays,
                  ],
                ].map(([title, value, sub, Icon]) => (
                  <div className="stat" key={title}>
                    <div className="stat-top">
                      {title}
                      <Icon size={17} />
                    </div>
                    <div className="stat-number">{value}</div>
                    <small>{sub}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">NE RIEN LAISSER PASSER</p>
                      <h2>Les prochaines actions</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("tasks")}
                    >
                      Tout voir <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {pending.length ? (
                    pending
                      .slice(0, 6)
                      .map((t) => <TaskRow key={t.id} task={t} />)
                  ) : (
                    <Empty
                      entity="tasks"
                      text="Planifiez une première relance et gardez le fil."
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">À L’AGENDA</p>
                      <h2>Les prochains échanges</h2>
                    </div>
                    <CalendarDays size={19} />
                  </div>
                  {upcoming.length ? (
                    upcoming
                      .slice(0, 4)
                      .map((m) => <MeetingCard key={m.id} meeting={m} />)
                  ) : (
                    <Empty
                      entity="meetings"
                      text="Démonstrations, découvertes et points de suivi."
                    />
                  )}
                </section>
                <section className="panel pipeline-summary">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">DE LA RENCONTRE À LA CONFIANCE</p>
                      <h2>Votre dynamique commerciale</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("opportunities")}
                    >
                      Ouvrir le pipeline <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="stage-summary">
                    {stages.slice(0, 6).map((s, i) => (
                      <div key={s}>
                        <span className={"stage-line stage-" + i} />
                        <small>{s}</small>
                        <strong>
                          {
                            data.opportunities.filter((x) => x.stage === s)
                              .length
                          }
                        </strong>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : page === "settings" ? (
            <>
            <ExternalCalendars workspace={workspace} api={api} onChange={loadBusySlots}/>
            <Connections
              connections={connections}
              api={api}
              health={health}
              enabled={!!(db && workspace)}
              onRefresh={async () => {
                await loadConnections();
                await refresh();
                await loadBusySlots();
              }}
              onError={setError}
              onNotice={setNotice}
            />
          </>
          ) : page === "team" ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Ensemble, au bon endroit.</h2>
                  <p>Attribution des relances, rendez-vous et opportunités.</p>
                </div>
              </div>
              {members.map((m) => (
                <div className="task-row" key={m.user_id}>
                  <div className="avatar">
                    {m.display_name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="grow">
                    <strong>{m.display_name}</strong>
                    <small>{m.email}</small>
                  </div>
                  <span className="badge">
                    {m.role === "admin" ? "Administrateur" : "Membre"}
                  </span>
                  <small>
                    {
                      data.tasks.filter((t) => t.owner === m.user_id && !t.done)
                        .length
                    }{" "}
                    tâches ouvertes
                  </small>
                </div>
              ))}
              <p className="mail-explanation">L’accès est réservé aux adresses de l’équipe Helix. Chacun rejoint automatiquement cet espace lors de sa première connexion ; aucune invitation n’est nécessaire.</p>
            </section>
          ) : (
            <>
              <div className="toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    placeholder="Rechercher dans cette vue…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filtrer par membre"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  <option value="">Toute l’équipe</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
                <button className="secondary" onClick={() => download(page)}>
                  <Download size={15} />
                  Exporter
                </button>
              </div>
              {page === "opportunities" ? (
                <div className="kanban">
                  {stages.map((s, i) => (
                    <section className="kanban-column" key={s}>
                      <div className="column-heading">
                        <span className={"stage-dot stage-" + i} />
                        <strong>{s}</strong>
                        <span>
                          {filtered(page).filter((x) => x.stage === s).length}
                        </span>
                        <button
                          aria-label={`Ajouter à ${s}`}
                          onClick={() =>
                            setModal({
                              entity: page,
                              record: {
                                stage: s,
                                owner: session?.user.id || "",
                              },
                            })
                          }
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <small>
                        {money(
                          filtered(page)
                            .filter((x) => x.stage === s)
                            .reduce((n, x) => n + Number(x.amount || 0), 0)
                        )}
                      </small>
                      {filtered(page)
                        .filter((x) => x.stage === s)
                        .map((x) => (
                          <button
                            className="deal"
                            key={x.id}
                            onClick={() => edit(page, x)}
                          >
                            <small>{cabinet(x.cabinet_id)}</small>
                            <h3>{x.name}</h3>
                            <strong>{money(x.amount)}</strong>
                            <div className="deal-footer">
                              <span>{member(x.owner)}</span>
                              <span>{date(x.close_at)}</span>
                            </div>
                          </button>
                        ))}
                    </section>
                  ))}
                </div>
              ) : page === "tasks" ? (
                <section className="panel">
                  {filtered(page).length ? (
                    filtered(page)
                      .sort(
                        (a, b) =>
                          Number(a.done || false) - Number(b.done || false) ||
                          (a.due_at || "").localeCompare(b.due_at || "")
                      )
                      .map((t) => <TaskRow key={t.id} task={t} />)
                  ) : (
                    <Empty entity={page} />
                  )}
                </section>
              ) : page === "meetings" ? (
                <section className="panel">
                  {filtered(page).length ? (
                    filtered(page)
                      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                      .map((m) => <MeetingCard key={m.id} meeting={m} />)
                  ) : (
                    <Empty entity={page} />
                  )}
                </section>
              ) : page === "notes" ? (
                <div className="cards">
                  {filtered(page).map((x) => (
                    <button
                      className="panel note-card"
                      key={x.id}
                      onClick={() => edit(page, x)}
                    >
                      <span className="badge">{cabinet(x.cabinet_id)}</span>
                      <h2>{x.name}</h2>
                      <p>{x.description}</p>
                      {x.next_step && (
                        <div className="next-step">
                          <ArrowRight size={15} />
                          {x.next_step}
                        </div>
                      )}
                      <small>
                        {member(x.owner)} · {date(x.created_at)}
                      </small>
                    </button>
                  ))}
                  {!filtered(page).length && <Empty entity={page} />}
                </div>
              ) : (
                <section className="panel table-panel">
                  {filtered(page).length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>
                              {page === "cabinets"
                                ? "Entreprise"
                                : page === "contacts"
                                ? "Contact"
                                : "Événement"}
                            </th>
                            <th>
                              {page === "cabinets"
                                ? "Ville / spécialité"
                                : page === "contacts"
                                ? "Entreprise"
                                : "Date"}
                            </th>
                            <th>{page === "events" ? "Lieu" : "Contact"}</th>
                            <th>Responsable</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filtered(page).map((x) => (
                            <tr
                              key={x.id}
                              onClick={() => edit(page, x)}
                              tabIndex={0}
                              onKeyDown={(e) =>
                                e.key === "Enter" && edit(page, x)
                              }
                            >
                              <td>
                                <div className="table-name">
                                  <div className="cabinet-icon">
                                    {x.name?.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <strong>{x.name}</strong>
                                    <small>{x.role || x.source || ""}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {page === "cabinets" ? (
                                  <>
                                    {x.city || "·"}
                                    <small>{x.specialty}</small>
                                  </>
                                ) : page === "contacts" ? (
                                  cabinet(x.cabinet_id)
                                ) : (
                                  date(x.starts_at, true)
                                )}
                              </td>
                              <td>
                                {page === "events" ? (
                                  x.location
                                ) : (
                                  <>
                                    <span>{x.email || "·"}</span>
                                    <small>{x.phone}</small>
                                  </>
                                )}
                              </td>
                              <td>
                                <span className="badge">{member(x.owner)}</span>
                              </td>
                              <td>
                                <ChevronRight size={16} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty entity={page} />
                  )}
                </section>
              )}
            </>
          )}
          <footer>
            <a href={branding.site}>Site de l’agence</a>
          </footer>
        </main>
      </div>
      {compose && (
        <Compose
          workspace={workspace}
          connections={connections}
          api={api}
          cabinets={data.cabinets}
          initial={compose}
          onClose={() => setCompose(null)}
          onSent={(text) => {
            setNotice(text);
            refresh();
          }}
        />
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <section
            key={`${modal.record.id || "new"}:${modal.record._revision || 0}`}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">RELATIONS ENTREPRISES</p>
                <h2 id="modal-title">
                  {modal.record.id ? "Modifier" : "Créer"} ·{" "}
                  {pages.find((x) => x[0] === modal.entity)?.[1]}
                </h2>
              </div>
              <button aria-label="Fermer" onClick={() => setModal(null)}>
                <X size={20} />
              </button>
            </div>
            {modal.record.id&&<details className="record-tools"><summary>Documents et historique de cette fiche</summary><Documents workspace={workspace} api={api} recordId={modal.record.id}/><Activity workspace={workspace} members={members} recordId={modal.record.id}/></details>}
            {error && (
              <div className="error" role="alert">
                {error}
                {modal.record.id && /modifi|changé|existe déjà/.test(error) && <button type="button" className="secondary" onClick={async()=>{
                  if(!confirm("Recharger la fiche remplacera votre saisie non enregistrée par la dernière version. Copiez vos changements si vous souhaitez les conserver. Continuer ?"))return;
                  try {
                    const latest=await readAll(workspace);setData(latest);
                    const current=latest[modal.entity].find(r=>r.id===modal.record.id);
                    if(!current){setError("Cette fiche a été supprimée.");return;}
                    setError("");edit(modal.entity,current);
                  } catch(e){setError(e.message);}
                }}>Recharger la dernière version</button>}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                persist(modal.entity, {
                  ...modal.record,
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                });
              }}
            >
              {modal.entity === "meetings" &&
                conflicts(modal.record, scheduleItems(data, busySlots, members))
                  .length > 0 && (
                  <div className="local-banner">
                    Attention : ce créneau chevauche un autre rendez-vous ou une
                    indisponibilité de l’organisateur.
                  </div>
                )}
              <div className="form-fields">
                {schemas[modal.entity].map(
                  ([key, label, type = "text", required]) => (
                    <label
                      key={key}
                      className={type === "textarea" ? "full" : ""}
                    >
                      {label}
                      {required ? " *" : ""}
                      {[
                        "cabinet",
                        "member",
                        "stage",
                        "priority",
                        "status",
                        "meeting",
                      ].includes(type) ? (
                        <select
                          name={key}
                          value={modal.record[key] || ""}
                          onChange={(e) =>
                            setModal({
                              ...modal,
                              record: {
                                ...modal.record,
                                [key]: e.target.value,
                              },
                            })
                          }
                        >
                          <option value="">Sélectionner…</option>
                          {(type === "cabinet"
                            ? data.cabinets.map((x) => [x.id, x.name])
                            : type === "meeting"
                            ? data.meetings.map((x) => [x.id, x.name])
                            : type === "member"
                            ? members.map((x) => [x.user_id, x.display_name])
                            : (type === "stage"
                                ? stages
                                : type === "priority"
                                ? ["Basse", "Normale", "Haute"]
                                : ["Prévu", "Réalisé", "Annulé"]
                              ).map((x) => [x, x])
                          ).map(([value, text]) => (
                            <option key={value} value={value}>
                              {text}
                            </option>
                          ))}
                        </select>
                      ) : type === "textarea" ? (
                        <textarea
                          name={key}
                          required={required}
                          rows={4}
                          value={modal.record[key] || ""}
                          onChange={(e) =>
                            setModal({
                              ...modal,
                              record: {
                                ...modal.record,
                                [key]: e.target.value,
                              },
                            })
                          }
                        />
                      ) : (
                        <input
                          name={key}
                          required={required}
                          type={type}
                          min={type === "number" ? 0 : undefined}
                          value={modal.record[key] || ""}
                          onChange={(e) =>
                            setModal({
                              ...modal,
                              record: {
                                ...modal.record,
                                [key]: e.target.value,
                              },
                            })
                          }
                        />
                      )}
                    </label>
                  )
                )}
              </div>
              {modal.entity === "cabinets" && modal.record.id && (
                <div className="related">
                  <h3>Historique de l’entreprise</h3>
                  <div className="connection-buttons">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const c = modal.record;
                        setModal({
                          entity: "tasks",
                          record: {
                            cabinet_id: c.id,
                            owner: session?.user.id || "",
                            priority: "Normale",
                          },
                        });
                      }}
                    >
                      Planifier une relance
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const c = modal.record;
                        setModal({
                          entity: "meetings",
                          record: {
                            cabinet_id: c.id,
                            owner: session?.user.id || "",
                            status: "Prévu",
                            attendees: c.email || "",
                          },
                        });
                      }}
                    >
                      Créer un rendez-vous
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        const c = modal.record;
                        setModal(null);
                        setCompose({
                          cabinet_id: c.id,
                          to:
                            c.email ||
                            data.contacts.find(
                              (x) => x.cabinet_id === c.id && x.email
                            )?.email ||
                            "",
                        });
                      }}
                    >
                      Écrire depuis ma messagerie
                    </button>
                  </div>
                  {["contacts", "tasks", "meetings", "notes"].map((entity) => (
                    <div key={entity}>
                      <strong>{pages.find((p) => p[0] === entity)?.[1]}</strong>
                      {data[entity]
                        .filter((x) => x.cabinet_id === modal.record.id)
                        .map((x) => (
                          <button
                            type="button"
                            className="history-item"
                            key={x.id}
                            onClick={() => edit(entity, x)}
                          >
                            {x.name}
                            <small>{date(x.created_at)}</small>
                          </button>
                        ))}
                    </div>
                  ))}
                  {(modal.record.email ||
                    data.contacts.some(
                      (c) => c.cabinet_id === modal.record.id && c.email
                    )) && (
                    <a
                      href={`mailto:${
                        modal.record.email ||
                        data.contacts.find(
                          (c) => c.cabinet_id === modal.record.id && c.email
                        )?.email
                      }`}
                    >
                      Écrire à l’entreprise <Mail size={14} />
                    </a>
                  )}
                  <h4>Emails synchronisés</h4>
                  <Emails workspace={workspace} cabinetId={modal.record.id} />
                </div>
              )}
              {modal.entity === "meetings" && modal.record.id && (
                <MeetingActions
                  key={modal.record.id}
                  record={modal.record}
                  session={session}
                  connections={connections}
                  api={api}
                  onUpdated={(r) => {
                    edit("meetings", r);
                    refresh();
                    loadBusySlots();
                  }}
                  onNotice={setNotice}
                />
              )}
              {modal.entity === "meetings" && modal.record.id && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setModal({
                      entity: "notes",
                      record: {
                        name: `Débrief · ${modal.record.name}`,
                        cabinet_id: modal.record.cabinet_id,
                        meeting_id: modal.record.id,
                        owner: session?.user.id || "",
                      },
                    })
                  }
                >
                  Rédiger le débrief
                </button>
              )}
              <div className="modal-actions">
                {modal.record.id && (
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => remove(modal.entity, modal.record)}
                  >
                    <Trash2 size={15} />
                    Supprimer
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setModal(null)}
                >
                  Annuler
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Emails({ workspace, cabinetId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!db) return;
    db.from("crm_messages")
      .select("id,subject,sender,sent_at,snippet")
      .eq("workspace_id", workspace)
      .eq("cabinet_id", cabinetId)
      .order("sent_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setRows(data || []));
  }, [workspace, cabinetId]);
  return rows.length ? (
    rows.map((r) => (
      <div className="email-item" key={r.id}>
        <strong>{r.subject}</strong>
        <small>
          {r.sender} · {date(r.sent_at, true)}
        </small>
        <p>{r.snippet}</p>
      </div>
    ))
  ) : (
    <p>Aucun échange synchronisé pour cette entreprise.</p>
  );
}
createRoot(document.getElementById("root")).render(<App />);
